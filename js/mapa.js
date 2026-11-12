
/* ============================================================
   MAPA.JS - SISTEMA DE MONITOREO HIDROLÓGICO TUMBES

   MAPAS BASE:
   1. OpenTopoMap (predeterminado)
   2. OpenStreetMap
   3. Google Satellite

   CAPAS SIEMPRE VISIBLES:
   - Estaciones hidrométricas (azul)
   - Ríos (azul)
   - Quebradas (colores diferenciados)

   No permite activar/desactivar las capas temáticas.
   ============================================================ */


/* ============================================================
   COLORES DE LAS QUEBRADAS
   ============================================================ */

const COLORES_QUEBRADAS = [
    "#e31a1c", // Cabuyal
    "#1f78b4", // Vaquería
    "#33a02c", // El Tigre
    "#984ea3", // Cabeza de Toro
    "#ff7f00", // Jardina
    "#a65628", // Higuerón
    "#f781bf", // Corrales
    "#17becf", // Ceibal
    "#b2a500", // Cazaderos
    "#393b79"  // Ozumares
];


/* ============================================================
   ARCHIVOS GEOJSON DE LOS RÍOS
   RUTA: data/quebradas/
   ============================================================ */

const ARCHIVOS_RIOS = [
    { nombre: "Río Cabeza de Toro", archivo: "rio_CabezadeToro.geojson" },
    { nombre: "Río Cabuyal", archivo: "rio_cabuyal.geojson" },
    { nombre: "Río Cazaderos", archivo: "rio_cazaderos.geojson" },
    { nombre: "Río Ceibal", archivo: "rio_ceibal.geojson" },
    { nombre: "Río Corrales", archivo: "rio_corrales.geojson" },
    { nombre: "Río Higuerón", archivo: "rio_higueron.geojson" },
    { nombre: "Río Jardina", archivo: "rio_jardina.geojson" },
    { nombre: "Río Ozumares", archivo: "rio_ozumares.geojson" },
    { nombre: "Río Tigre", archivo: "rio_tigre.geojson" },
    { nombre: "Río Vaquería", archivo: "rio_vaqueria.geojson" }
];


/* ============================================================
   INICIALIZAR MAPA
   ============================================================ */

window.initMap = function (points, onSelect) {

    const map = L.map("map", {
        center: [-3.86, -80.43],
        zoom: 10,
        zoomControl: true
    });


    /* --------------------------------------------------------
       MAPAS BASE
       -------------------------------------------------------- */

    const openTopoMap = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,
            attribution:
                '© OpenStreetMap contributors | © OpenTopoMap'
        }
    );

    const openStreetMap = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '© OpenStreetMap contributors'
        }
    );

    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );


    // OpenTopoMap es el mapa predeterminado
    openTopoMap.addTo(map);


    /* --------------------------------------------------------
       SELECTOR EXCLUSIVO DE MAPAS BASE

       No se agregan estaciones, ríos ni quebradas aquí.
       -------------------------------------------------------- */

    L.control.layers(
        {
            "OpenTopoMap": openTopoMap,
            "OpenStreetMap": openStreetMap,
            "Google Satellite": googleSatellite
        },
        null,
        {
            collapsed: true,
            position: "topright"
        }
    ).addTo(map);


    /* --------------------------------------------------------
       ESTACIONES HIDROMÉTRICAS
       SIEMPRE VISIBLES Y DE COLOR AZUL
       -------------------------------------------------------- */

    const estacionesLayer = L.layerGroup().addTo(map);

    if (Array.isArray(points)) {

        points.forEach(function (point) {

            const lat = Number(
                point.lat ?? point.Lat ?? point.latitude
            );

            const lon = Number(
                point.lon ??
                point.long ??
                point.Long ??
                point.longitude
            );

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                console.warn(
                    "Coordenadas inválidas de estación:",
                    point
                );
                return;
            }

            const nombre =
                point.nombre ||
                point.nombre_estacion ||
                point.id ||
                "Estación hidrométrica";


            // Marcador azul
            const marker = L.circleMarker(
                [lat, lon],
                {
                    radius: 7,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#0066cc",
                    fillOpacity: 1
                }
            );

            marker.bindTooltip(nombre, {
                direction: "top",
                offset: [0, -7]
            });


            // Mantener selección del hidrograma
            marker.on("click", function () {

                if (typeof onSelect === "function") {
                    onSelect(point);
                }

            });

            marker.addTo(estacionesLayer);

        });

    }


    /* --------------------------------------------------------
       ESCALA
       -------------------------------------------------------- */

    L.control.scale({
        imperial: false,
        metric: true,
        position: "bottomleft"
    }).addTo(map);


    /* --------------------------------------------------------
       REFERENCIAS GLOBALES
       -------------------------------------------------------- */

    window.estacionesLayer = estacionesLayer;

    return map;
};


/* ============================================================
   CARGAR QUEBRADAS Y RÍOS
   ============================================================ */

window.addPolygons = async function (map, onSelect) {

    const carpeta = CONFIG.carpetaQuebradas || "data/quebradas/";

    const quebradasLayer = L.layerGroup().addTo(map);
    const riosLayer = L.layerGroup().addTo(map);

    const listaQuebradas = Array.isArray(CONFIG.quebradas)
        ? CONFIG.quebradas
        : [];


    /* ========================================================
       CARGAR QUEBRADAS
       ======================================================== */

    for (let i = 0; i < listaQuebradas.length; i++) {

        const q = listaQuebradas[i];

        if (!q.archivo) {
            console.warn(
                "La quebrada no tiene archivo:",
                q.nombre
            );
            continue;
        }

        const color = COLORES_QUEBRADAS[
            i % COLORES_QUEBRADAS.length
        ];

        const url = carpeta + q.archivo;

        try {

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const geojson = await response.json();

            const layer = L.geoJSON(geojson, {

                style: {
                    color: color,
                    weight: 2.5,
                    opacity: 1,
                    fillColor: color,
                    fillOpacity: 0.18
                },

                onEachFeature: function (feature, featureLayer) {

                    featureLayer.bindTooltip(
                        q.nombre,
                        {
                            sticky: true,
                            direction: "top"
                        }
                    );


                    // Resaltar al pasar el cursor
                    featureLayer.on("mouseover", function () {

                        featureLayer.setStyle({
                            weight: 4,
                            fillOpacity: 0.30
                        });

                    });


                    featureLayer.on("mouseout", function () {

                        featureLayer.setStyle({
                            weight: 2.5,
                            fillOpacity: 0.18
                        });

                    });


                    // Mantener selección del hidrograma
                    featureLayer.on("click", function () {

                        if (typeof onSelect === "function") {

                            onSelect({
                                id: q.nombre,
                                nombre: q.nombre,
                                columna: q.columna,
                                columnas: q.columnas || [q.columna],
                                etiquetas: q.etiquetas || ["Caudal"],
                                tipo: "quebrada"
                            });

                        }

                    });

                }

            });

            layer.addTo(quebradasLayer);

            console.log("Quebrada cargada:", q.nombre);

        } catch (error) {

            console.error(
                "Error cargando quebrada " + q.nombre + ":",
                error
            );

        }

    }


    /* ========================================================
       CARGAR RÍOS
       ======================================================== */

    for (const rio of ARCHIVOS_RIOS) {

        const url = carpeta + rio.archivo;

        try {

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const geojson = await response.json();

            const layer = L.geoJSON(geojson, {

                style: {
                    color: "#0066cc",
                    weight: 2.5,
                    opacity: 1,
                    lineCap: "round",
                    lineJoin: "round"
                },

                onEachFeature: function (feature, featureLayer) {

                    featureLayer.bindTooltip(
                        rio.nombre,
                        {
                            sticky: true,
                            direction: "top"
                        }
                    );


                    // Resaltar el río al pasar el cursor
                    featureLayer.on("mouseover", function () {

                        featureLayer.setStyle({
                            color: "#00a6ff",
                            weight: 4,
                            opacity: 1
                        });

                    });


                    featureLayer.on("mouseout", function () {

                        featureLayer.setStyle({
                            color: "#0066cc",
                            weight: 2.5,
                            opacity: 1
                        });

                    });

                }

            });

            layer.addTo(riosLayer);

            console.log("Río cargado:", rio.nombre);

        } catch (error) {

            console.error(
                "Error cargando " + rio.nombre +
                " (" + rio.archivo + "):",
                error
            );

        }

    }


    /* ========================================================
       LEYENDA DEL MAPA
       QUEBRADAS + ESTACIÓN HIDROMÉTRICA
       ======================================================== */

    const leyenda = L.control({
        position: "bottomright"
    });

    leyenda.onAdd = function () {

        const div = L.DomUtil.create(
            "div",
            "leyenda-hidrologica"
        );

        div.style.background = "rgba(255,255,255,0.96)";
        div.style.padding = "12px";
        div.style.borderRadius = "7px";
        div.style.boxShadow = "0 1px 6px rgba(0,0,0,0.35)";
        div.style.maxHeight = "310px";
        div.style.overflowY = "auto";
        div.style.minWidth = "175px";
        div.style.fontSize = "12px";
        div.style.color = "#263238";

        let html = `
            <div style="
                font-weight:700;
                font-size:13px;
                color:#263238;
                margin-bottom:10px;
                border-bottom:1px solid #ddd;
                padding-bottom:7px;
            ">
                LEYENDA
            </div>

            <div style="
                font-weight:700;
                margin-bottom:7px;
                color:#333;
            ">
                QUEBRADAS
            </div>
        `;


        // Leyenda de quebradas
        listaQuebradas.forEach(function (q, i) {

            const color = COLORES_QUEBRADAS[
                i % COLORES_QUEBRADAS.length
            ];

            html += `
                <div style="
                    display:flex;
                    align-items:center;
                    margin:6px 0;
                    color:#263238;
                ">
                    <span style="
                        display:inline-block;
                        flex-shrink:0;
                        width:13px;
                        height:13px;
                        background:${color};
                        margin-right:8px;
                        border:1px solid #555;
                    "></span>

                    <span>${q.nombre}</span>
                </div>
            `;

        });


        // Separador
        html += `
            <div style="
                border-top:1px solid #ddd;
                margin:10px 0 8px 0;
            "></div>

            <div style="
                font-weight:700;
                margin-bottom:8px;
                color:#333;
            ">
                ESTACIÓN HIDROMÉTRICA
            </div>

            <div style="
                display:flex;
                align-items:center;
                color:#263238;
            ">
                <span style="
                    display:inline-block;
                    width:13px;
                    height:13px;
                    border-radius:50%;
                    background:#0066cc;
                    border:2px solid white;
                    box-shadow:0 0 0 1px #0066cc;
                    margin-right:8px;
                    flex-shrink:0;
                "></span>

                <span>Estación hidrométrica</span>
            </div>
        `;

        div.innerHTML = html;

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;
    };

    leyenda.addTo(map);


    /* ========================================================
       REFERENCIAS DE CAPAS
       ======================================================== */

    window.quebradasLayer = quebradasLayer;
    window.riosLayer = riosLayer;
    window.leyendaHidrologica = leyenda;

    console.log("====================================");
    console.log("MAPA HIDROLÓGICO CARGADO");
    console.log("Quebradas:", listaQuebradas.length);
    console.log("Ríos:", ARCHIVOS_RIOS.length);
    console.log("Estaciones:", window.estacionesLayer
        ? window.estacionesLayer.getLayers().length
        : 0
    );
    console.log("Fondo predeterminado: OpenTopoMap");
    console.log("====================================");

    return {
        quebradasLayer: quebradasLayer,
        riosLayer: riosLayer
    };

};

