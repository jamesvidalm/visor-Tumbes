async function readExcel(path, preferredSheet){
  const response=await fetch(path); if(!response.ok)throw new Error("No se encontró "+path);
  const buffer=await response.arrayBuffer(), wb=XLSX.read(buffer,{type:"array",cellDates:true});
  const sheet=preferredSheet||wb.SheetNames[0];
  if(!wb.Sheets[sheet])throw new Error("No existe la hoja "+sheet+" en "+path);
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet],{defval:null,raw:true});
}
function field(row, candidates){
  const keys=Object.keys(row), key=keys.find(k=>candidates.some(c=>norm(k)===norm(c)));
  return key?row[key]:null;
}
function makeSelection(item){
  window.SELECTED=item;
  renderHydrograph(item,window.CAUDAL_ROWS);
  renderFloodImages(item,window.CAUDAL_ROWS);
}
async function start(){
  initMap();
  try{
    const [flows,coords]=await Promise.all([
      readExcel(CONFIG.caudalesFile,CONFIG.caudalesSheet),
      readExcel(CONFIG.ubicacionesFile,CONFIG.ubicacionesSheet)
    ]);
    if(!flows.length)throw new Error("El Excel de caudales no tiene registros.");
    const first=flows[0]; if(!Object.keys(first).some(k=>norm(k)==="FECHA"))throw new Error("El Excel debe tener una columna llamada fecha.");
    CAUDAL_ROWS=flows;
    const locations=[];
    CONFIG.estaciones.forEach(st=>{
      const match=coords.find(r=>norm(field(r,CONFIG.camposUbicacion.nombre))===norm(st.nombre));
      if(!match){console.warn("No se encontró ubicación para",st.nombre);return;}
      const lat=Number(field(match,CONFIG.camposUbicacion.lat)),lon=Number(field(match,CONFIG.camposUbicacion.lon));
      if(Number.isFinite(lat)&&Number.isFinite(lon))locations.push({nombre:st.nombre,lat,lon,item:{...st,tipo:"estacion"}});
    });
    addStationMarkers(locations,makeSelection);
    const bounds=[];
    locations.forEach(p=>bounds.push([p.lat,p.lon]));
    for(const q of CONFIG.quebradas){try{await addBasinLayer(q,makeSelection);}catch(e){console.warn(e.message);}}
    if(bounds.length)MAP.fitBounds(bounds,{padding:[25,25]});
    await loadFloodManifest();
    document.getElementById("data-status").textContent=`${flows.length.toLocaleString("es-PE")} horas · ${locations.length} puntos`;
    if(!locations.length)document.getElementById("data-status").textContent="Excel leído; revisa coordenadas";
  }catch(e){
    console.error(e);document.getElementById("data-status").textContent="Error al cargar datos";
    document.getElementById("selection-info").textContent=e.message;
  }
}
window.CAUDAL_ROWS=[];
document.addEventListener("DOMContentLoaded",start);
