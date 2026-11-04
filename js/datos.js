// Configuración de nombres: ajusta aquí si los nombres de tus Excel/GeoJSON son distintos.
window.CONFIG = {
  caudalesFile: "data/caudales.xlsx",
  ubicacionesFile: "data/ubicacion.xlsx",
  caudalesSheet: null,       // null = primera hoja
  ubicacionesSheet: null,    // null = primera hoja
  // Columna de caudal asociada a cada punto del mapa:
  estaciones: [
    {nombre:"TIGRE", columna:"Q_TIGRE"},
    {nombre:"TIGRE_P", columna:"Q_TIGRE_P"},
    {nombre:"CABOINGA", columna:"Q_CABOINGA"}
  ],
  // Nombre del archivo GeoJSON y columna de caudal que se graficará al hacer clic:
  quebradas: [
    {nombre:"HIGUERON", archivo:"QD_HIGUERON.geojson", columna:"Q_HIGUERON"},
    {nombre:"CABUYAL", archivo:"QD_CABUYAL.geojson", columna:"Q_CABUYAL"},
    {nombre:"VAQUERIA", archivo:"QD_VAQUERIA.geojson", columna:"Q_VAQUERIA"},
    {nombre:"CEIBAL", archivo:"QD_CEIBAL.geojson", columna:"Q_CEIBAL"},
    {nombre:"ELTIGRE", archivo:"QD_ELTIGRE.geojson", columna:"Q_ELTIGRE"},
    {nombre:"JARDINA", archivo:"QD_JARDINA.geojson", columna:"Q_JARDINA"},
    {nombre:"CABEZADETORO", archivo:"QD_CABEZADETORO.geojson", columna:"Q_CABEZADETORO"},
    {nombre:"CORRALES", archivo:"QD_CORRALES.geojson", columna:"Q_CORRALES"}
  ],
  carpetaQuebradas:"data/quebradas/",
  manifestInundaciones:"data/inundaciones/manifest.json",
  // Nombres de campos aceptados en ubicacion.xlsx:
  camposUbicacion:{nombre:["punto","nombre","estacion","codigo"],lat:["lat","latitud"],lon:["lon","long","longitud"]}
};
