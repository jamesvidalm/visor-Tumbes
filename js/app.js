async function readExcel(path, preferredSheet){
  const response = await fetch(path);
  if(!response.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${response.status}). Comprueba la ruta y el nombre exacto en GitHub.`);
  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer,{type:"array",cellDates:true});
  const sheetName = preferredSheet || workbook.SheetNames[0];
  if(!workbook.Sheets[sheetName]) throw new Error(`No existe la hoja ${sheetName} en ${path}.`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{defval:null,raw:true});
}
function field(row,candidates){
  const keys=Object.keys(row);
  const key=keys.find(k=>candidates.some(c=>norm(k)===norm(c)));
  return key ? row[key] : null;
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
    if(!flows.length) throw new Error("El Excel de caudales no contiene registros.");

    const headers=Object.keys(flows[0]);
    const required=[
      "fecha","Q_TIGRE","Q_TIGRE_P","Q_CABOINGA","Q_CABOINGA_P",
      "QD_HIGUERON","QD_CABUYAL","QD_VAQUERIA","QD_CEIBAL",
      "QD_ELTIGRE","QD_JARDINA","QD_CABEZADETORO","QD_CORRALES"
    ];
    const missing=required.filter(c=>!headers.includes(c));
    if(missing.length) throw new Error("Faltan columnas en caudales_Tumbes.xlsx: "+missing.join(", "));

    window.CAUDAL_ROWS=flows;
    const locations=[];
    CONFIG.estaciones.forEach(st=>{
      const match=coords.find(r=>norm(field(r,CONFIG.camposUbicacion.nombre))===norm(st.nombre));
      if(!match){console.warn("No se encontró coordenada para "+st.nombre);return;}
      const lat=Number(field(match,CONFIG.camposUbicacion.lat));
      const lon=Number(field(match,CONFIG.camposUbicacion.lon));
      if(Number.isFinite(lat)&&Number.isFinite(lon)){
        locations.push({nombre:st.nombre,lat,lon,item:{...st,tipo:"estacion"}});
      }else{
        console.warn("Coordenadas no válidas para "+st.nombre,match);
      }
    });
    if(!locations.length) throw new Error("No se encontraron puntos válidos en data/ubicacion/ubicacion.xlsx. Revisa columnas ID, Lat y Long.");

    addStationMarkers(locations,makeSelection);
    const bounds=locations.map(p=>[p.lat,p.lon]);
    for(const q of CONFIG.quebradas){
      try{ await addBasinLayer(q,makeSelection); }
      catch(e){ console.warn("GeoJSON no cargado: "+q.archivo+" — "+e.message); }
    }
    if(bounds.length) MAP.fitBounds(bounds,{padding:[35,35]});

    try{ await loadFloodManifest(); }
    catch(e){ console.warn("No se cargó el manifest de inundaciones:",e.message); }

    document.getElementById("data-status").textContent=
      `${flows.length.toLocaleString("es-PE")} registros horarios · ${locations.length} puntos`;
  }catch(e){
    console.error(e);
    document.getElementById("data-status").textContent="Error al cargar datos";
    document.getElementById("selection-info").textContent=e.message;
  }
}
window.CAUDAL_ROWS=[];
document.addEventListener("DOMContentLoaded",start);
