window.initMap = function(points, onSelect) {
    const map = L.map("map").setView([-3.86, -80.43], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
    }).addTo(map);

    const bounds = [];

    points.forEach(p => {
        const marker = L.circleMarker([p.lat, p.lon], {
            radius: 8,
            color: "#071421",
            weight: 2,
            fillColor: "#42c8e8",
            fillOpacity: 1
        }).addTo(map);

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
    for (const q of CONFIG.quebradas) {
        try {
            const response = await fetch(CONFIG.carpetaQuebradas + q.archivo);

            if (!response.ok) {
                throw new Error("HTTP " + response.status + ": " + q.archivo);
            }

            const geo = await response.json();

            L.geoJSON(geo, {
                style: {
                    color: "#a78bfa",
                    weight: 2,
                    fillColor: "#8b5cf6",
                    fillOpacity: 0.18
                },
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(q.nombre);
                    layer.on("click", () => onSelect({
                        nombre: q.nombre,
                        columna: q.columna,
                        tipo: "quebrada"
                    }));
                }
            }).addTo(map);

        } catch (error) {
            console.error("Error en quebrada " + q.nombre + ":", error);
        }
    }
};

