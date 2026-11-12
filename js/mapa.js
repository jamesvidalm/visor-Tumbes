
 // ============================================================
 // MAPA.JS - DASHBOARD HIDROLOGICO CUENCA DEL RIO TUMBES
 // ============================================================
 // - Estaciones El Tigre y Cabo Inga.
 // - Diez polígonos de quebradas.
 // - Diez capas de ríos GeoJSON.
 // - Ríos en color azul, sin leyenda independiente.
 // - OpenTopoMap como fondo predeterminado.
 // - Selector de mapas contraído inicialmente.
 // - Clic en polígono para actualizar hidrograma.
 // ============================================================


// ============================================================
// 1. COLORES DE LOS POLÍGONOS
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
// 2. ARCHIVOS GEOJSON DE LOS RÍOS
// ============================================================

const ARCHIVOS_RIOS = {
    "CABUYAL": "rio_cabuyal.geojson",
    "VAQUERIA": "rio_vaqueria.geojson",
    "EL TIGRE": "rio_tigre.geojson",
    "CABEZA DE TORO": "rio_CabezadeToro.geojson",
    "JARDINA": "rio_jardina.geojson",
    "HIGUERON": "rio_higueron.geojson",
    "CORRALES": "rio_corrales.geojson",
    "CEIBAL": "rio_ceibal.geojson",
    "CAZADEROS": "rio_cazaderos.geojson",
    "OZUMARES": "rio_ozumares.geojson"
};


// ============================================================
// 3. NORMALIZAR NOMBRES
// ============================================================

function normalizarNombreMapa(valor) {

    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();

}


// ============================================================
// 4. INICIALIZAR MAPA
// ============================================================

window.initMap = function(points, onSelect) {

    const map = L.map("map", {
        preferCanvas: true
    }).setView([-3.86, -80.43], 10);


    // ========================================================
    // 4.1 MAPAS BASE
    // ========================================================

    // OPEN TOPOMAP
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
    const openStreetMap = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "© OpenStreetMap contributors"
        }
    );


    // GOOGLE SATELLITE
    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );


    // GOOGLE MAPS
    const googleMaps = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );


    // ========================================================
    // 4.2 FONDO PREDETERMINADO
    // ========================================================

    openTopoMap.addTo(map);


    // ========================================================
    // 4.3 SELECTOR DE MAPAS
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

            // Contraído inicialmente.
            // Se despliega al pasar el cursor o pulsarlo.
            collapsed: true
        }
    ).addTo(map);


    // ========================================================
    // 4.4 MARCADORES DE ESTACIONES
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


        marker.on("click", () => {

            onSelect(p);

        });


        bounds.push([p.lat, p.lon]);

    });


    // Ajustar vista a las estaciones.
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
// 5. AGREGAR POLÍGONOS Y RÍOS
// ============================================================

window.addPolygons = async function(map, onSelect) {


    // ========================================================
    // 5.1 VERIFICAR CONFIGURACIÓN
    // ========================================================

    if (
        !window.CONFIG ||
        !Array.isArray(CONFIG.quebradas)
    ) {

        throw new Error(
            "No se encontró CONFIG.quebradas en config.js."
        );

    }


    console.log("==================================");

    console.log(
        "QUEBRADAS CONFIGURADAS:",
        CONFIG.quebradas.length
    );


    // ========================================================
    // 5.2 LEYENDA: SOLO POLÍGONOS
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


        const title = document.createElement("div");

        title.textContent = "LEYENDA DE QUEBRADAS";

        title.style.fontWeight = "bold";
        title.style.color = "#8eb9ed";
        title.style.marginBottom = "5px";

        div.appendChild(title);


        // Solo se muestran las quebradas.
        // Los ríos NO se agregan a esta leyenda.

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
    // 5.3 CONTADORES
    // ========================================================

    const capasQuebradas = [];
    const capasRios = [];

    let erroresQuebradas = 0;
    let erroresRios = 0;


    // ========================================================
    // 5.4 CARGAR CADA QUEBRADA Y SU RÍO
    // ========================================================

    for (
        let i = 0;
        i < CONFIG.quebradas.length;
        i++
    ) {

        const q = CONFIG.quebradas[i];

        const nombreNormalizado =
            normalizarNombreMapa(q.nombre);


        const color = COLORES_QUEBRADAS[
            i % COLORES_QUEBRADAS.length
        ];


        // ----------------------------------------------------
        // A. CARGAR POLÍGONO DE QUEBRADA
        // ----------------------------------------------------

        try {

            const urlPoligono =
                CONFIG.carpetaQuebradas + q.archivo;


            console.log(
                "Cargando polígono:",
                q.nombre,
                urlPoligono
            );


            const responsePoligono =
                await fetch(urlPoligono);


            if (!responsePoligono.ok) {

                throw new Error(
                    "HTTP " + responsePoligono.status +
                    ": " + urlPoligono
                );

            }


            const geojsonPoligono =
                await responsePoligono.json();


            const capaQuebrada = L.geoJSON(
                geojsonPoligono,
                {

                    style: {

                        color: color,
                        weight: 2.5,
                        opacity: 1,
                        fillColor: color,
                        fillOpacity: 0.30

                    },


                    onEachFeature: (feature, layer) => {

                        layer.bindTooltip(q.nombre);


                        // Clic en el polígono:
                        // actualiza el hidrograma.

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


            capaQuebrada.addTo(map);

            capasQuebradas.push(capaQuebrada);


            console.log(
                "Polígono cargado:",
                q.nombre
            );


        } catch (error) {

            erroresQuebradas++;

            console.error(
                "Error en polígono " + q.nombre + ":",
                error
            );

        }


        // ----------------------------------------------------
        // B. CARGAR RÍO DE LA QUEBRADA
        // ----------------------------------------------------

        try {

            const archivoRio =
                ARCHIVOS_RIOS[nombreNormalizado];


            if (!archivoRio) {

                throw new Error(
                    "No se configuró el archivo del río para " +
                    q.nombre
                );

            }


            const urlRio =
                CONFIG.carpetaQuebradas + archivoRio;


            console.log(
                "Cargando río:",
                q.nombre,
                urlRio
            );


            const responseRio = await fetch(urlRio);


            if (!responseRio.ok) {

                throw new Error(
                    "HTTP " + responseRio.status +
                    ": " + urlRio
                );

            }


            const geojsonRio = await responseRio.json();


            // ------------------------------------------------
            // ESTILO DE RÍOS
            // ------------------------------------------------

            const capaRio = L.geoJSON(
                geojsonRio,
                {

                    style: {

                        // Color azul para todos los ríos.
                        color: "#168BDB",

                        weight: 2.5,

                        opacity: 0.95,

                        lineCap: "round",

                        lineJoin: "round"

                    },


                    // Los ríos no capturan clics.
                    // Así los polígonos siguen siendo seleccionables.

                    interactive: false,

                    bubblingMouseEvents: false

                }
            );


            capaRio.addTo(map);

            capasRios.push(capaRio);


            console.log(
                "Río cargado correctamente:",
                q.nombre,
                archivoRio
            );


        } catch (error) {

            erroresRios++;

            console.error(
                "Error cargando río de " + q.nombre + ":",
                error
            );

        }

    }


    // ========================================================
    // 5.5 RESUMEN DE CARGA
    // ========================================================

    console.log("");
    console.log("==================================");

    console.log(
        "QUEBRADAS CONFIGURADAS:",
        CONFIG.quebradas.length
    );

    console.log(
        "POLÍGONOS CARGADOS:",
        capasQuebradas.length
    );

    console.log(
        "RÍOS CARGADOS:",
        capasRios.length
    );

    console.log(
        "ERRORES EN POLÍGONOS:",
        erroresQuebradas
    );

    console.log(
        "ERRORES EN RÍOS:",
        erroresRios
    );


    if (
        capasQuebradas.length === CONFIG.quebradas.length &&
        capasRios.length === CONFIG.quebradas.length
    ) {

        console.log(
            "TODAS LAS QUEBRADAS Y SUS RÍOS SE CARGARON CORRECTAMENTE."
        );

    } else {

        console.warn(
            "Hay archivos que no pudieron cargarse. " +
            "Revisa las rutas y nombres en GitHub."
        );

    }


    console.log("==================================");


    // Retornar las capas cargadas.
    return {
        quebradas: capasQuebradas,
        rios: capasRios
    };

};
