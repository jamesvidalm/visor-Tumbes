window.initMap = function(){
  const map=L.map("map",{preferCanvas:true}).setView([-3.75,-80.45],10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
  window.MAP=map; window.MAP_LAYERS=[];
  return map;
};
window.addStationMarkers = function(locations, select){
  locations.forEach(p=>{
    const marker=L.circleMarker([p.lat,p.lon],{radius:7,color:"#071421",weight:2,fillColor:"#42c8e8",fillOpacity:1}).addTo(MAP);
    marker.bindTooltip(p.nombre); marker.on("click",()=>select(p.item)); MAP_LAYERS.push(marker);
  });
};
window.addBasinLayer = async function(config, select){
  const r=await fetch(CONFIG.carpetaQuebradas+config.archivo);
  if(!r.ok) throw new Error("No se pudo cargar "+config.archivo);
  const geo=await r.json();
  const layer=L.geoJSON(geo,{style:{color:"#a78bfa",weight:2,fillColor:"#8b5cf6",fillOpacity:.13},
    onEachFeature:(feature,lyr)=>{lyr.bindTooltip(config.nombre);lyr.on("click",()=>select({nombre:config.nombre,columna:config.columna,tipo:"quebrada"}));}
  }).addTo(MAP); MAP_LAYERS.push(layer);
};
