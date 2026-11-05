// Configuración basada en los encabezados reales de caudales_Tumbes.xlsx
window.CONFIG = {
  caudalesFile: "data/caudales/caudales_Tumbes.xlsx",
  ubicacionesFile: "data/ubicacion/ubicacion.xlsx",
  hojaCaudales: "Hoja1",
  hojaUbicaciones: "Ubicacion",
  // Dos puntos físicos. Q_TIGRE y Q_TIGRE_P pertenecen al mismo punto El Tigre.
  puntos: [
    { id: "El Tigre", nombre: "El Tigre", lat: -3.7687, lon: -80.4569,
      columnas: ["Q_TIGRE", "Q_TIGRE_P"], etiquetas: ["Caudal real", "Caudal pronosticado"] },
    { id: "Cabo Inga", nombre: "Cabo Inga", lat: -3.97892, lon: -80.3992,
      columnas: ["Q_CABOINGA", "Q_CABOINGA_P"], etiquetas: ["Caudal real", "Caudal pronosticado"] }
  ],
  // Exporta cada polígono desde QGIS como GeoJSON EPSG:4326 y conserva estos nombres.
  carpetaQuebradas: "data/quebradas/",
  quebradas: [
    {nombre:"Cabuyal", archivo:"cabuyal.geojson", columna:"QD_CABUYAL"},
    {nombre:"Vaquería", archivo:"vaqueria.geojson", columna:"QD_VAQUERIA"},
    {nombre:"El Tigre", archivo:"ElTigreQ.geojson", columna:"QD_ELTIGRE"},
    {nombre:"Cabeza de Toro", archivo:"cabezaDeToro.geojson", columna:"QD_CABEZADETORO"},
    {nombre:"Jardina", archivo:"jardina.geojson", columna:"QD_JARDINA"},
    {nombre:"Higuerón", archivo:"higueron.geojson", columna:"QD_HIGUERON"},
    {nombre:"Corrales", archivo:"corrales.geojson", columna:"QD_CORRALES"},
    {nombre:"Ceibal", archivo:"ceibal.geojson", columna:"QD_CEIBAL"}
  ]
};
