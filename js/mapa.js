/* ============================================================
   MAPA.JS - SISTEMA DE MONITOREO HIDROLÓGICO TUMBES
   Fondo predeterminado: OpenTopoMap
   Fondo alternativo: Google Satellite
   Incluye: estaciones, subcuencas y ríos
   ============================================================ */

const COLORES_QUEBRADAS = [
    "#e41a1c",
    "#377eb8",
    "#4daf4a",
    "#984ea3",
    "#ff7f00",
    "#a65628",
    "#f781bf",
    "#17becf",
    "#bcbd22",
    "#393b79"
];

// Archivos de los ríos dentro de data/quebradas/
const ARCHIVOS_RIOS = [
    { nombre: "Río Cabeza de Toro", archivo: "rio_CabezadeToro.geojson" },
    { nombre: "Río Cabuyal", archivo: "rio_cabuyal.geojson" },
    { nombre: "Río Cazaderos", archivo: "rio_cazaderos.geojson" },
    { nombre: "Río Ceibal", archivo: "rio_ceibal.geojson" },
    { nombre: "Río Corrales", archivo: "rio_corrales.geojson" },
    { nombre: "Río Higuerón", archivo: "rio_higueron.geojson" },
    { nombre: "Río Jardina", archivo: "rio_jardina.geojson" },
    { nombre: "Río Ozumares", archivo: "rio_ozumares.geojson" },
    { nombre: "Río Tigrе", archivo: "rio_tigre.geojson" },
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

    // --------------------------------------------------------
    // MAPAS BASE
    // --------------------------------------------------------

    const openTopoMap = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,
            attribution:
                'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap'
        }
    );

    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    // OpenTopoMap queda como fondo inicial
    openTopoMap.addTo(map);

    // --------------------------------------------------------
    // CAPAS DE ESTACIONES
    // --------------------------------------------------------

    const estacionesLayer = L.layerGroup().addTo(map);

    if (Array.isArray(points)) {

        points.forEach(function (point) {

            const lat = Number(
                point.lat ?? point.Lat ?? point.latitude
            );

            const lon = Number(
                point.lon ?? point.long ?? point.Long ?? point.longitude
            );

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                console.warn("Coordenadas inválidas de estación:", point);
                return;
            }

            const nombre =
                point.nombre ||
                point.nombre_estacion ||
                point.id ||
                "Estación";

            const marker = L.circleMarker([lat, lon], {
                radius: 7,
                color: "#ffffff",
                weight: 2,
                fillColor: "#e53935",
                fillOpacity: 1
            });

            marker.bindTooltip(nombre, {
                direction: "top",
                offset: [0, -5]
            });

            marker.on("click", function () {
                if (typeof onSelect === "function") {
                    onSelect(point);
                }
            });

            marker.addTo(estacionesLayer);
        });
    }

    // --------------------------------------------------------
    // CONTROL DE CAPAS
    // --------------------------------------------------------

    const mapasBase = {
        "OpenTopoMap": openTopoMap,
        "Google Satellite": googleSatellite
    };

    const capasSuperpuestas = {
        "Estaciones hidrológicas": estacionesLayer
    };

    L.control.layers(
        mapasBase,
        capasSuperpuestas,
        {
            collapsed: true,
            position: "topright"
        }
    ).addTo(map);

    // --------------------------------------------------------
    // ESCALA
    // --------------------------------------------------------

    L.control.scale({
        imperial: false,
        metric: true,
        position: "bottomleft"
    }).addTo(map);

    // Guardar referencia de las estaciones
    window.estacionesLayer = estacionesLayer;

    return map;
};


/* ============================================================
   CARGAR SUBCUENCAS Y RÍOS
   ============================================================ */

window.addPolygons = async function (map, onSelect) {

    const carpeta = CONFIG.carpetaQuebradas || "data/quebradas/";

    const subcuencasLayer = L.layerGroup().addTo(map);
    const riosLayer = L.layerGroup().addTo(map);

    // --------------------------------------------------------
    // SUBCUENCAS
    // --------------------------------------------------------

    const listaQuebradas = Array.isArray(CONFIG.quebradas)
        ? CONFIG.quebradas
        : [];

    const leyenda = L.control({ position: "bottomright" });

    leyenda.onAdd = function () {

        const div = L.DomUtil.create("div", "leyenda-quebradas");

        div.style.background = "white";
        div.style.padding = "10px";
        div.style.borderRadius = "6px";
        div.style.boxShadow = "0 1px 5px rgba(0,0,0,0.35)";
        div.style.maxHeight = "250px";
        div.style.overflowY = "auto";
        div.style.fontSize = "12px";

        let html = `
            <div style="font-weight:bold;margin-bottom:7px;">
                SUBCUENCAS
            </div>
        `;

        listaQuebradas.forEach(function (q, index) {

            const color = COLORES_QUEBRADAS[
                index % COLORES_QUEBRADAS.length
            ];

            html += `
                <div style="display:flex;align-items:center;margin:4px 0;">
                    <span style="
                        display:inline-block;
                        width:13px;
                        height:13px;
                        background:${color};
                        margin-right:7px;
                        border:1px solid #555;
                    "></span>
                    <span>${q.nombre}</span>
                </div>
            `;
        });

        div.innerHTML = html;

        L.DomEvent.disableClickPropagation(div);

        return div;
    };

    leyenda.addTo(map);

    // Cargar archivos de subcuencas
    for (let index = 0; index < listaQuebradas.length; index++) {

        const q = listaQuebradas[index];

        if (!q.archivo) {
            console.warn("La subcuenca no tiene archivo:", q.nombre);
            continue;
        }

        const color = COLORES_QUEBRADAS[
            index % COLORES_QUEBRADAS.length
        ];

        const url = carpeta + q.archivo;

        try {

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const geojson = await response.json();

            const layer = L.geoJSON(geojson, {

                style: function () {
                    return {
                        color: color,
                        weight: 2,
                        opacity: 1,
                        fillColor: color,
                        fillOpacity: 0.20
                    };
                },

                onEachFeature: function (feature, featureLayer) {

                    featureLayer.bindTooltip(q.nombre, {
                        sticky: true
                    });

                    featureLayer.on("mouseover", function () {
                        featureLayer.setStyle({
                            weight: 3,
                            fillOpacity: 0.35
                        });
                    });

                    featureLayer.on("mouseout", function () {
                        featureLayer.setStyle({
                            weight: 2,
                            fillOpacity: 0.20
                        });
                    });

                    // Al hacer clic en una subcuenca,
                    // se conserva la selección del hidrograma.
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

            layer.addTo(subcuencasLayer);

        } catch (error) {

            console.error(
                "Error cargando subcuenca " + q.nombre + ":",
                error
            );
        }
    }

    // --------------------------------------------------------
    // RÍOS
    // --------------------------------------------------------

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
                    color: "#0877d1",
                    weight: 2.5,
                    opacity: 0.95,
                    lineCap: "round",
                    lineJoin: "round"
                },

                onEachFeature: function (feature, featureLayer) {

                    featureLayer.bindTooltip(rio.nombre, {
                        sticky: true,
                        direction: "top"
                    });

                    featureLayer.on("mouseover", function () {
                        featureLayer.setStyle({
                            color: "#00a6ff",
                            weight: 4,
                            opacity: 1
                        });
                    });

                    featureLayer.on("mouseout", function () {
                        featureLayer.setStyle({
                            color: "#0877d1",
                            weight: 2.5,
                            opacity: 0.95
                        });
                    });
                }

            });

            layer.addTo(riosLayer);

        } catch (error) {

            console.error(
                "Error cargando " + rio.nombre + " (" + rio.archivo + "):",
                error
            );
        }
    }

    // --------------------------------------------------------
    // AGREGAR CAPAS AL CONTROL
    // --------------------------------------------------------

    const controlCapas = document.querySelector(
        ".leaflet-control-layers"
    );

    if (controlCapas && controlCapas._leaflet_id) {
        // El control principal ya está creado en initMap.
        // Se agregan las capas al control existente.
    }

    // Crear un control adicional para mostrar/ocultar
    // subcuencas y ríos.
    L.control.layers(
        null,
        {
            "Subcuencas": subcuencasLayer,
            "Ríos": riosLayer
        },
        {
            collapsed: true,
            position: "topright"
        }
    ).addTo(map);

    // Guardar referencias de las capas
    window.subcuencasLayer = subcuencasLayer;
    window.riosLayer = riosLayer;

    console.log("Carga de subcuencas y ríos finalizada.");

    return {
        subcuencasLayer: subcuencasLayer,
        riosLayer: riosLayer
    };
};
