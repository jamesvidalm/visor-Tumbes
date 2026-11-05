
const COLORES_QUEBRADAS = [
    "#e63946", // Cabuyal
    "#00b4d8", // Vaquería
    "#f4a261", // El Tigre
    "#9b5de5", // Cabeza de Toro
    "#2a9d8f", // Jardina
    "#f15bb5", // Higuerón
    "#fee440", // Corrales
    "#4361ee"  // Ceibal
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

    // Marcadores de estaciones
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

        marker.bindPopup(
            "<b>" + p.nombre + "</b><br>Selecciona para consultar el hidrograma"
        );

        marker.on("click", () => onSelect(p));

        bounds.push([p.lat, p.lon]);
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, {
            padding: [40, 40]
        });
    }

    return map;
};


// Cargar los polígonos y crear leyenda
window.addPolygons = async function(map, onSelect) {

    const legend = L.control({
        position: "bottomright"
    });

    legend.onAdd = function() {

        const div = L.DomUtil.create("div", "quebradas-legend");

        div.style.background = "rgba(10, 19, 34, 0.94)";
        div.style.color = "#ffffff";
        div.style.padding = "12px";
        div.style.borderRadius = "8px";
        div.style.border = "1px solid #40516b";
        div.style.fontSize = "12px";
        div.style.lineHeight = "22px";
        div.style.maxHeight = "240px";
        div.style.overflowY = "auto";

        const title = document.createElement("div");
        title.textContent = "QUEBRADAS";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "6px";
        title.style.color = "#8eb9ed";

        div.appendChild(title);

        CONFIG.quebradas.forEach((q, i) => {

            const item = document.createElement("div");
            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.gap = "8px";

            const symbol = document.createElement("span");
            symbol.style.width = "13px";
            symbol.style.height = "13px";
            symbol.style.display = "inline-block";
            symbol.style.background = COLORES_QUEBRADAS[
                i % COLORES_QUEBRADAS.length
            ];
            symbol.style.border = "1px solid white";
            symbol.style.borderRadius = "3px";
            symbol.style.flexShrink = "0";

            const name = document.createElement("span");
            name.textContent = q.nombre;

            item.appendChild(symbol);
            item.appendChild(name);
            div.appendChild(item);

        });

        L.DomEvent.disableClickPropagation(div);

        return div;
    };

    legend.addTo(map);


    // Dibujar cada quebrada
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

                    layer.bindPopup(
                        "<b>" + q.nombre + "</b><br>" +
                        "Selecciona para consultar su hidrograma"
                    );

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
                "Error cargando " + q.nombre + ":",
                error
            );

        }

    }

};


