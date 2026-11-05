
const COLORES_QUEBRADAS = [
    "#e63946",
    "#00b4d8",
    "#f4a261",
    "#9b5de5",
    "#2a9d8f",
    "#f15bb5",
    "#d4a017",
    "#4361ee"
];

window.initMap = function(points, onSelect) {

    const map = L.map("map", {
        preferCanvas: true
    }).setView([-3.86, -80.43], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
    }).addTo(map);

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
        marker.on("click", () => onSelect(p));

        bounds.push([p.lat, p.lon]);

    });

    if (bounds.length) {
        map.fitBounds(bounds, { padding: [40, 40] });
    }

    return map;
};


window.addPolygons = async function(map, onSelect) {

    // Leyenda de quebradas
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = function() {

        const div = L.DomUtil.create("div", "legend-quebradas");

        div.style.background = "rgba(10,19,34,0.95)";
        div.style.color = "white";
        div.style.padding = "12px";
        div.style.borderRadius = "8px";
        div.style.border = "1px solid #40516b";
        div.style.fontSize = "12px";
        div.style.lineHeight = "23px";

        const title = document.createElement("div");
        title.textContent = "LEYENDA DE QUEBRADAS";
        title.style.fontWeight = "bold";
        title.style.color = "#8eb9ed";
        title.style.marginBottom = "5px";

        div.appendChild(title);

        CONFIG.quebradas.forEach((q, i) => {

            const item = document.createElement("div");
            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.gap = "8px";

            const square = document.createElement("span");
            square.style.width = "13px";
            square.style.height = "13px";
            square.style.backgroundColor =
                COLORES_QUEBRADAS[i % COLORES_QUEBRADAS.length];
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


    // Cargar polígonos
    for (let i = 0; i < CONFIG.quebradas.length; i++) {

        const q = CONFIG.quebradas[i];
        const color = COLORES_QUEBRADAS[
            i % COLORES_QUEBRADAS.length
        ];

        try {

            const url = CONFIG.carpetaQuebradas + q.archivo;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(
                    "HTTP " + response.status + ": " + url
                );
            }

            const geojson = await response.json();

            L.geoJSON(geojson, {

                style: {
                    color: color,
                    weight: 2.5,
                    opacity: 1,
                    fillColor: color,
                    fillOpacity: 0.30
                },

                onEachFeature: (feature, layer) => {

                    layer.bindTooltip(q.nombre);

                    layer.on("click", () => {

                        onSelect({
                            id: q.nombre,
                            nombre: q.nombre,
                            columna: q.columna,
                            columnas: [q.columna],
                            etiquetas: [q.nombre],
                            tipo: "quebrada"
                        });

                    });

                }

            }).addTo(map);

        } catch (error) {

            console.error(
                "Error en quebrada " + q.nombre + ":",
                error
            );

        }

    }

};


