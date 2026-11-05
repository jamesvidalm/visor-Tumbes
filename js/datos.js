// Configuración de archivos y columnas reales del proyecto Tumbes.
window.CONFIG = {
  caudalesFile: "data/caudales/caudales_Tumbes.xlsx",
  ubicacionesFile: "data/ubicacion/ubicacion.xlsx",
  caudalesSheet: "Hoja1",
  ubicacionesSheet: "Ubicacion",

  // Dos marcadores físicos. Cada marcador muestra dos series en su hidrograma.
  estaciones: [
    {
      nombre: "El Tigre",
      columna: "Q_TIGRE_P", // se usa para seleccionar el escenario de inundación
      columnas: ["Q_TIGRE", "Q_TIGRE_P"],
      etiquetas: ["Caudal real", "Caudal pronosticado"]
    },
    {
      nombre: "Cabo Inga",
      columna: "Q_CABOINGA_P",
      columnas: ["Q_CABOINGA", "Q_CABOINGA_P"],
      etiquetas: ["Caudal real", "Caudal pronosticado"]
    }
  ],

  quebradas: [
    {nombre:"Cabuyal", archivo:"cabuyal.geojson", columna:"QD_CABUYAL"},
    {nombre:"Vaquería", archivo:"vaqueria.geojson", columna:"QD_VAQUERIA"},
    {nombre:"El Tigre", archivo:"ElTigreQ.geojson", columna:"QD_ELTIGRE"},
    {nombre:"Cabeza de Toro", archivo:"cabezaDeToro.geojson", columna:"QD_CABEZADETORO"},
    {nombre:"Jardina", archivo:"jardina.geojson", columna:"QD_JARDINA"},
    {nombre:"Higuerón", archivo:"higueron.geojson", columna:"QD_HIGUERON"},
    {nombre:"Corrales", archivo:"corrales.geojson", columna:"QD_CORRALES"},
    {nombre:"Ceibal", archivo:"ceibal.geojson", columna:"QD_CEIBAL"}
  ],

  carpetaQuebradas: "data/quebradas/",
  manifestInundaciones: "data/inundaciones/manifest.json",
  camposUbicacion: {
    nombre:["ID","punto","nombre","estacion","codigo"],
    lat:["Lat","lat","latitud"],
    lon:["Long","lon","long","longitud"]
  }
};
