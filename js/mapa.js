
// ============================================================
// MAPA.JS - SISTEMA HIDROLOGICO TUMBES
// ============================================================
// - Estaciones hidrometricas.
// - Diez subcuencas GeoJSON.
// - Colores independientes por subcuenca.
// - Leyenda de subcuencas.
// - Seleccion para consultar hidrogramas.
// - Sin GFS, sin raster y sin animacion.
// ============================================================


// ============================================================
// 1. VARIABLES GLOBALES
// ============================================================

window.mapaTumbes = null;
window.capaEstaciones = null;
window.capaQuebradas = null;


// ============================================================
// 2. COLORES DE SUBCUENCAS
// ============================================================

window.coloresQuebradas = [
    "#e63946",
    "#00b4d8",
    "#f4a261",
    "#9b5de5",
    "#2a9d8f",
    "#f15bb5",
    "#d4a017",
    "#4361ee",
    "#84a98c",
    "#e76f51"
];


// ============================================================
// 3. INICIALIZAR MAPA
// ============================================================

window.initMap = function(points, select) {

    const container = document.getElementById("map");

    if (!container) {
        throw new Error("No existe el contenedor #map.");
    }

    if (typeof L === "undefined") {
        throw new Error("Leaflet no esta cargado.");
    }

    if (window.mapaTumbes) {
        window.mapaTumbes.remove();
        window.mapaTumbes = null;
    }

    const map = L.map("map", {
        center: [-3.75, -80.45],
        zoom: 9,
        zoomControl: true,
        preferCanvas: true
    });

    window.mapaTumbes = map;

    // Mapa base
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19
        }
    ).addTo(map);

    // Capas independientes
    window.capaEstaciones = L.layerGroup().addTo(map);
    window.capaQuebradas = L.layerGroup().addTo(map);

    // --------------------------------------------------------
    // ESTACIONES HIDROMETRICAS
    // --------------------------------------------------------

    points.forEach(point => {

        const marker = L.circleMarker(
            [point.lat, point.lon],
            {
                radius: 7,
                color: "#ffffff",
                weight: 2,
                fillColor: "#22c5e5",
                fillOpacity: 1
            }
        );

        marker.bindTooltip(point.nombre, {
            direction: "top"
        });

        marker.bindPopup(
            "<b>" + point.nombre + "</b><br>" +
            "Estacion hidrometrica"
        );

        marker.on("click", function() {
            select(point);
        });

        marker.addTo(window.capaEstaciones);

    });

    // Control de capas
    L.control.layers(
        null,
        {
            "Estaciones hidrometricas": window.capaEstaciones,
            "Subcuencas": window.capaQuebradas
        },
        {
            collapsed: true,
            position: "topright"
        }
    ).addTo(map);

    // Leyenda
    crearLeyendaQuebradas(map);

    setTimeout(function() {
        map.invalidateSize();
    }, 300);

    console.log("Mapa Tumbes inicializado.");
    console.log("Estaciones:", points.length);

    return map;

};


// ============================================================
// 4. CARGAR SUBCUENCAS GEOJSON
// ============================================================

window.addPolygons = async function(map, select) {

    if (!window.CONFIG) {
        throw new Error("No existe CONFIG.");
    }

    const lista = CONFIG.quebradas || [];

    if (!lista.length) {
        console.warn("No hay subcuencas en CONFIG.");
        return;
    }

    const resultados = await Promise.allSettled(

        lista.map(async (q, i) => {

            const ruta = CONFIG.carpetaQuebradas + q.archivo;

            const response = await fetch(ruta);

            if (!response.ok) {
                throw new Error(
                    "No se pudo cargar " + ruta +
                    " HTTP " + response.status
                );
            }

            const geojson = await response.json();

            const color = window.coloresQuebradas[
                i % window.coloresQuebradas.length
            ];

            const layer = L.geoJSON(geojson, {

                style: {
                    color: color,
                    weight: 2.2,
                    opacity: 1,
                    fillColor: color,
                    fillOpacity: 0.38
                },

                onEachFeature: function(feature, lyr) {

                    lyr.bindTooltip(q.nombre, {
                        sticky: true,
                        direction: "top"
                    });

                    lyr.bindPopup(
                        "<b>Subcuenca " + q.nombre + "</b>"
                    );

                    lyr.on("mouseover", function() {

                        this.setStyle({
                            weight: 3.5,
                            color: "#ffffff",
                            fillOpacity: 0.58
                        });

                        this.bringToFront();

                    });

                    lyr.on("mouseout", function() {

                        layer.resetStyle(this);

                    });

                    lyr.on("click", function() {

                        select({
                            id: q.nombre,
                            nombre: q.nombre,
                            columna: q.columna,
                            columnas: [q.columna],
                            etiquetas: [q.nombre],
                            tipo: "quebrada"
                        });

                    });

                }

            });

            layer.addTo(window.capaQuebradas);

            console.log(
                "Subcuenca cargada:",
                q.nombre,
                "| Color:",
                color
            );

            return q.nombre;

        })

    );

    resultados.forEach((resultado, i) => {

        if (resultado.status === "rejected") {

            console.error(
                "Error cargando subcuenca:",
                lista[i].nombre,
                resultado.reason
            );

        }

    });

    const cargadas = resultados.filter(
        resultado => resultado.status === "fulfilled"
    ).length;

    console.log(
        "Subcuencas cargadas:",
        cargadas,
        "de",
        lista.length
    );

};


// ============================================================
// 5. LEYENDA DE SUBCUENCAS
// ============================================================

function crearLeyendaQuebradas(map) {

    const legend = L.control({
        position: "bottomright"
    });

    legend.onAdd = function() {

        const div = L.DomUtil.create(
            "div",
            "legend-quebradas"
        );

        div.style.background = "rgba(10,19,34,0.95)";
        div.style.color = "#ffffff";
        div.style.padding = "11px 13px";
        div.style.borderRadius = "8px";
        div.style.border = "1px solid #40516b";
        div.style.fontSize = "11px";
        div.style.lineHeight = "21px";
        div.style.minWidth = "165px";
        div.style.maxHeight = "260px";
        div.style.overflowY = "auto";
        div.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";

        const title = document.createElement("div");

        title.textContent = "SUBCUENCAS";
        title.style.fontWeight = "bold";
        title.style.fontSize = "11px";
        title.style.color = "#93c5fd";
        title.style.marginBottom = "7px";
        title.style.paddingBottom = "5px";
        title.style.borderBottom = "1px solid #40516b";

        div.appendChild(title);

        (CONFIG.quebradas || []).forEach((q, i) => {

            const color = window.coloresQuebradas[
                i % window.coloresQuebradas.length
            ];

            const item = document.createElement("div");

            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.gap = "8px";
            item.style.marginBottom = "3px";

            const square = document.createElement("span");

            square.style.width = "13px";
            square.style.height = "13px";
            square.style.flexShrink = "0";
            square.style.backgroundColor = color;
            square.style.border = "1px solid rgba(255,255,255,0.7)";
            square.style.borderRadius = "3px";

            const name = document.createElement("span");

            name.textContent = q.nombre;
            name.style.color = "#e2e8f0";

            item.appendChild(square);
            item.appendChild(name);

            div.appendChild(item);

        });

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;

    };

    legend.addTo(map);

}
