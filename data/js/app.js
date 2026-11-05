async function loadWorkbook(path,sheetName){
  const res=await fetch(path);
  if(!res.ok)throw new Error("No se pudo cargar "+path+" (HTTP "+res.status+").");
  const wb=XLSX.read(await res.arrayBuffer(),{type:"array",cellDates:true});
  const sheet=wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true});
}
async function startDashboard(){
  try{
    const [flows,locations]=await Promise.all([
      loadWorkbook(CONFIG.caudalesFile,CONFIG.hojaCaudales),
      loadWorkbook(CONFIG.ubicacionesFile,CONFIG.hojaUbicaciones)
    ]);
    if(!flows.length)throw new Error("El Excel de caudales no contiene registros.");
    const headers=Object.keys(flows[0]);
    const required=["fecha","Q_TIGRE","Q_TIGRE_P","Q_CABOINGA","Q_CABOINGA_P","QD_HIGUERON","QD_CABUYAL","QD_VAQUERIA","QD_CEIBAL","QD_ELTIGRE","QD_JARDINA","QD_CABEZADETORO","QD_CORRALES"];
    const missing=required.filter(c=>!headers.includes(c));
    if(missing.length)throw new Error("Faltan columnas en el Excel: "+missing.join(", "));
    // Las coordenadas de los marcadores se leen desde data/ubicacion/ubicacion.xlsx.
    const norm=s=>String(s||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase().trim();
    const points=CONFIG.puntos.map(p=>{
      const row=locations.find(r=>norm(r.ID)===norm(p.id));
      if(!row)throw new Error("No se encontró "+p.id+" en ubicacion.xlsx (columna ID).");
      const lat=Number(row.Lat),lon=Number(row.Long);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error("Coordenadas inválidas para "+p.id+".");
      return {...p,lat,lon};
    });
    const select=item=>renderHydrograph(item,flows);
    const map=initMap(points,select);
    await addPolygons(map,select);
    document.getElementById("data-status").textContent=`${flows.length} registros horarios · 2 puntos`;
  }catch(err){
    console.error(err);
    document.getElementById("data-status").textContent="Error de lectura";
    document.getElementById("hydro-subtitle").textContent=err.message;
  }
}
document.addEventListener("DOMContentLoaded",startDashboard);
