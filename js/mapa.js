
// ============================================================
// MAPA.JS - DASHBOARD HIDROLOGICO CUENCA DEL RIO TUMBES
// ============================================================
// - Muestra estaciones El Tigre y Cabo Inga.
// - Carga polígonos GeoJSON desde CONFIG.quebradas.
// - Permite seleccionar estaciones y quebradas.
// - Actualiza el hidrograma al hacer clic.
// - Leyenda dinámica para las 10 quebradas.
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


    // Fondo OpenStreetMap.
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }
    ).addTo(map);


    const bounds = [];


    // --------------------------------------------------------
    // ESTACIONES HIDROLÓGICAS
    // --------------------------------------------------------

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

        marker.on("click", () => {

            onSelect(p);

        });


        bounds.push([p.lat, p.lon]);

    });


    // Ajustar mapa a las estaciones.
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


    // --------------------------------------------------------
    // VERIFICAR CONFIGURACIÓN
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // 3.1 CREAR LEYENDA DINÁMICA
    // --------------------------------------------------------

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


        // Título de leyenda.
        const title = document.createElement("div");

        title.textContent = "LEYENDA DE QUEBRADAS";

        title.style.fontWeight = "bold";
        title.style.color = "#8eb9ed";
        title.style.marginBottom = "5px";


        div.appendChild(title);


        // Generar leyenda para todas las quebradas.
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


    // --------------------------------------------------------
    // 3.2 CARGAR TODOS LOS POLÍGONOS GEOJSON
    // --------------------------------------------------------

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

            // Ruta del GeoJSON.
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


            // ------------------------------------------------
            // CREAR CAPA GEOJSON
            // ------------------------------------------------

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


                        // ------------------------------------
                        // SELECCIONAR QUEBRADA
                        // ------------------------------------

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


    // --------------------------------------------------------
    // 3.3 RESUMEN DE CARGA
    // --------------------------------------------------------

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
            "Revisa las rutas GeoJSON en la consola."
        );

    } else {

        console.log(
            "Las 10 quebradas se cargaron correctamente."
        );

    }

    console.log("==================================");


    return capasQuebradas;

};

