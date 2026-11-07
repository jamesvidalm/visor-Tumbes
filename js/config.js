
window.CONFIG = {

    caudalesFile: "data/caudales/caudales_Tumbes.xlsx",
    ubicacionesFile: "data/ubicacion/ubicacion.xlsx",

    hojaCaudales: "Hoja1",
    hojaUbicaciones: "Ubicacion",

    // INICIO DEL PRONOSTICO
    inicioPronostico:"2026-11-07T02:00:00-05:00",

    // CARPETA DE MAPAS DE INUNDACION
    manifestInundaciones: "data/inundaciones/manifest.json",

    puntos: [
        {
            id: "El Tigre",
            nombre: "El Tigre",
            columnas: ["Q_TIGRE", "Q_TIGRE_P"],
            etiquetas: [
                "Caudal observado",
                "Caudal pronosticado"
            ]
        },
        {
            id: "Cabo Inga",
            nombre: "Cabo Inga",
            columnas: ["Q_CABOINGA", "Q_CABOINGA_P"],
            etiquetas: [
                "Caudal observado",
                "Caudal pronosticado"
            ]
        }
    ],

    carpetaQuebradas: "data/quebradas/",

    quebradas: [
        {
            nombre: "Cabuyal",
            archivo: "cabuyal.geojson",
            columna: "QD_CABUYAL"
        },
        {
            nombre: "Vaquería",
            archivo: "vaqueria.geojson",
            columna: "QD_VAQUERIA"
        },
        {
            nombre: "El Tigre",
            archivo: "ElTigreQ.geojson",
            columna: "QD_ELTIGRE"
        },
        {
            nombre: "Cabeza de Toro",
            archivo: "cabezadeToro.geojson",
            columna: "QD_CABEZADETORO"
        },
        {
            nombre: "Jardina",
            archivo: "jardina.geojson",
            columna: "QD_JARDINA"
        },
        {
            nombre: "Higuerón",
            archivo: "higueron.geojson",
            columna: "QD_HIGUERON"
        },
        {
            nombre: "Corrales",
            archivo: "corrales.geojson",
            columna: "QD_CORRALES"
        },
        {
            nombre: "Ceibal",
            archivo: "ceibal.geojson",
            columna: "QD_CEIBAL"
        }
    ]
};
