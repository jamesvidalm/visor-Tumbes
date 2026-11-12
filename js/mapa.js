
 // ============================================================
 // MAPA.JS - DASHBOARD HIDROLOGICO CUENCA DEL RIO TUMBES
 // ============================================================
 // - Estaciones: El Tigre y Cabo Inga.
 // - Diez quebradas GeoJSON.
 // - Cuatro mapas base intercambiables.
 // - OpenTopoMap como mapa predeterminado.
 // - Leyenda dinámica de quebradas.
 // - Selección de polígonos para actualizar hidrogramas.
 // ============================================================


// ============================================================
// 1. COLORES DE LAS QUEBRADAS
// ============================================================

const COLORES_QUEBRADAS = [
    "#e63946",
    "#00b4d8",
    "#f4a261",
    "#9b5de5",
    "#2a9d8f",
    "#f15bb5",
    "#d4a017",
    "#4361ee",
    "#06d6a0",
    "#fb8500"
];


// ============================================================
// 2. INICIALIZAR MAPA
// ============================================================

window.initMap = function(points, onSelect) {

    const map = L.map("map", {
        preferCanvas: true
    }).setView([-3.86, -80.43], 10);


    // ========================================================
    // 2.1 MAPAS BASE
    // ========================================================

    // OPEN TOPOMAP
    // Muestra relieve, curvas de nivel y características
    // topográficas del territorio.

    const openTopoMap = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,
            maxNativeZoom: 17,
            attribution:
                "© OpenTopoMap | © OpenStreetMap contributors"
        }
    );


    // OPEN STREET MAP
    // Mapa convencional con carreteras y localidades.

    const openStreetMap = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "© OpenStreetMap contributors"
        }
    );


    // GOOGLE SATELLITE
    // Imagen satelital.

    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );


    // GOOGLE MAPS
    // Mapa convencional de Google.

    const googleMaps = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );


    // ========================================================
    // 2.2 MAPA PREDETERMINADO
    // ========================================================

    // OPEN TOPOMAP SE CARGA AUTOMÁTICAMENTE.

    openTopoMap.addTo(map);


    // ========================================================
    // 2.3 SELECTOR DE MAPAS BASE
    // ========================================================

    const mapasBase = {

        "OpenTopoMap - Relieve": openTopoMap,

        "OpenStreetMap - Calles": openStreetMap,

        "Google Satellite": googleSatellite,

        "Google Maps": googleMaps

    };


    L.control.layers(
        mapasBase,
        null,
        {
            position: "topright",
            collapsed: false
        }
    ).addTo(map);


    // ========================================================
    // 2.4 MARCADORES DE ESTACIONES
    // ========================================================

    const bounds = [];


    points.forEach(p => {

        const marker = L.circleMarker(
            [p.lat, p.lon],
            {
                radius: 8,
                color: "#071421",
                weight: 2,
                fillColor: "#42c8e8",
                fillOpacity: 1
            }
        ).addTo(map);


        marker.bindTooltip(p.nombre);


        // Seleccionar estación y actualizar hidrograma.

        marker.on("click", () => {

            onSelect(p);

        });


        bounds.push([p.lat, p.lon]);

    });


    // ========================================================
    // 2.5 AJUSTAR VISTA DEL MAPA
    // ========================================================

    if (bounds.length) {

        map.fitBounds(
            bounds,
            {
                padding: [40, 40]
            }
        );

    }


    return map;

};


// ============================================================
// 3. AGREGAR POLÍGONOS DE LAS QUEBRADAS
// ============================================================

window.addPolygons = async function(map, onSelect) {


    // ========================================================
    // 3.1 VERIFICAR CONFIGURACIÓN
    // ========================================================

    if (
        !window.CONFIG ||
        !Array.isArray(CONFIG.quebradas)
    ) {

        throw new Error(
            "No se encontró CONFIG.quebradas en data.js."
        );

    }


    console.log(
        "Quebradas configuradas:",
        CONFIG.quebradas.length
    );


    // ========================================================
    // 3.2 CREAR LEYENDA
    // ========================================================

    const legend = L.control({
        position: "bottomright"
    });


    legend.onAdd = function() {

        const div = L.DomUtil.create(
            "div",
            "legend-quebradas"
        );


        div.style.background = "rgba(10,19,34,0.95)";
        div.style.color = "white";
        div.style.padding = "12px";
        div.style.borderRadius = "8px";
        div.style.border = "1px solid #40516b";
        div.style.fontSize = "12px";
        div.style.lineHeight = "23px";
        div.style.maxHeight = "300px";
        div.style.overflowY = "auto";


        // Título.

        const title = document.createElement("div");

        title.textContent = "LEYENDA DE QUEBRADAS";

        title.style.fontWeight = "bold";
        title.style.color = "#8eb9ed";
        title.style.marginBottom = "5px";

        div.appendChild(title);


        // Agregar las diez quebradas automáticamente.

        CONFIG.quebradas.forEach((q, i) => {

            const item = document.createElement("div");

            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.gap = "8px";


            const square = document.createElement("span");

            square.style.width = "13px";
            square.style.height = "13px";

            square.style.backgroundColor =
                COLORES_QUEBRADAS[
                    i % COLORES_QUEBRADAS.length
                ];

            square.style.border = "1px solid white";
            square.style.flexShrink = "0";


            const name = document.createElement("span");

            name.textContent = q.nombre;


            item.appendChild(square);
            item.appendChild(name);

            div.appendChild(item);

        });


        L.DomEvent.disableClickPropagation(div);

        return div;

    };


    legend.addTo(map);


    // ========================================================
    // 3.3 CARGAR POLÍGONOS GEOJSON
    // ========================================================

    const capasQuebradas = [];


    for (
        let i = 0;
        i < CONFIG.quebradas.length;
        i++
    ) {

        const q = CONFIG.quebradas[i];


        const color = COLORES_QUEBRADAS[
            i % COLORES_QUEBRADAS.length
        ];


        try {

            // Ruta del archivo GeoJSON.

            const url =
                CONFIG.carpetaQuebradas + q.archivo;


            console.log(
                "Cargando quebrada:",
                q.nombre,
                url
            );


            const response = await fetch(url);


            if (!response.ok) {

                throw new Error(
                    "HTTP " + response.status +
                    ": " + url
                );

            }


            const geojson = await response.json();


            // =================================================
            // CREAR CAPA GEOJSON
            // =================================================

            const capa = L.geoJSON(
                geojson,
                {

                    style: {

                        color: color,
                        weight: 2.5,
                        opacity: 1,
                        fillColor: color,
                        fillOpacity: 0.30

                    },


                    onEachFeature: (feature, layer) => {


                        // Nombre de la quebrada.

                        layer.bindTooltip(q.nombre);


                        // =====================================
                        // SELECCIONAR QUEBRADA
                        // =====================================

                        layer.on("click", () => {

                            console.log(
                                "Quebrada seleccionada:",
                                q.nombre
                            );


                            onSelect({

                                id: q.nombre,

                                nombre: q.nombre,

                                columna: q.columna,

                                columnas: [
                                    q.columna
                                ],

                                etiquetas: [
                                    q.nombre
                                ],

                                tipo: "quebrada"

                            });

                        });

                    }

                }
            );


            // Agregar polígono al mapa.

            capa.addTo(map);

            capasQuebradas.push(capa);


            console.log(
                "Quebrada cargada correctamente:",
                q.nombre
            );


        } catch (error) {

            console.error(
                "Error en quebrada " + q.nombre + ":",
                error
            );

        }

    }


    // ========================================================
    // 3.4 RESUMEN DE CARGA
    // ========================================================

    console.log("==================================");

    console.log(
        "QUEBRADAS CONFIGURADAS:",
        CONFIG.quebradas.length
    );

    console.log(
        "QUEBRADAS CARGADAS:",
        capasQuebradas.length
    );


    if (
        capasQuebradas.length !==
        CONFIG.quebradas.length
    ) {

        console.warn(
            "Algunas quebradas no pudieron cargarse. " +
            "Revisa las rutas de los archivos GeoJSON."
        );

    } else {

        console.log(
            "Todas las quebradas se cargaron correctamente."
        );

    }


    console.log("==================================");


    return capasQuebradas;

};
