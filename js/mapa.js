
// ============================================================
// MAPA.JS - SISTEMA HIDROLOGICO TUMBES
// ============================================================
// - Inicializa Leaflet.
// - Representa estaciones hidrometricas.
// - Representa quebradas GeoJSON.
// - Carga precipitacion GFS desde JSON.
// - Selector horario de precipitacion.
// - Sin interpolacion.
// ============================================================

window.mapaTumbes = null;

window.capaEstaciones = null;
window.capaQuebradas = null;
window.capaGFS = null;

window.datosGFS = null;
window.horaGFS = 0;


// ============================================================
// 1. INICIALIZAR MAPA
// ============================================================

window.initMap = function(points, select) {

    const container = document.getElementById("map");

    if (!container) {
        throw new Error("No existe el contenedor #map.");
    }

    if (typeof L === "undefined") {
        throw new Error("Leaflet no esta cargado.");
    }

    // Evitar inicializacion duplicada
    if (window.mapaTumbes) {
        window.mapaTumbes.remove();
        window.mapaTumbes = null;
    }

    const map = L.map("map", {
        center: [-3.75, -80.45],
        zoom: 9,
        zoomControl: true
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

    // Capas
    window.capaEstaciones = L.layerGroup().addTo(map);
    window.capaQuebradas = L.layerGroup().addTo(map);
    window.capaGFS = L.layerGroup().addTo(map);

    // Estaciones
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

        marker.bindTooltip(point.nombre);

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
            "Estaciones": window.capaEstaciones,
            "Quebradas": window.capaQuebradas,
            "Precipitacion GFS": window.capaGFS
        },
        {
            collapsed: true,
            position: "topright"
        }
    ).addTo(map);

    // Control horario GFS
    crearControlHorarioGFS(map);

    setTimeout(function() {
        map.invalidateSize();
    }, 300);

    console.log("Mapa Tumbes inicializado.");

    return map;
};


// ============================================================
// 2. CARGAR QUEBRADAS GEOJSON
// ============================================================

window.addPolygons = async function(map, select) {

    if (!window.CONFIG) {
        throw new Error("No existe CONFIG.");
    }

    const lista = CONFIG.quebradas || [];

    const resultados = await Promise.allSettled(

        lista.map(async q => {

            const ruta = CONFIG.carpetaQuebradas + q.archivo;

            const response = await fetch(ruta);

            if (!response.ok) {
                throw new Error(
                    "No se pudo cargar " + ruta +
                    " HTTP " + response.status
                );
            }

            const geojson = await response.json();

            const layer = L.geoJSON(geojson, {

                style: {
                    color: "#a78bfa",
                    weight: 2,
                    opacity: 0.9,
                    fillColor: "#a78bfa",
                    fillOpacity: 0.10
                },

                onEachFeature: function(feature, lyr) {

                    lyr.bindTooltip(q.nombre);

                    lyr.bindPopup(
                        "<b>Quebrada " + q.nombre + "</b>"
                    );

                    lyr.on("click", function() {

                        select({
                            id: q.nombre,
                            nombre: q.nombre,
                            columna: q.columna,
                            columnas: [q.columna]
                        });

                    });

                }

            });

            layer.addTo(window.capaQuebradas);

            console.log("Quebrada cargada:", q.nombre);

            return q.nombre;

        })

    );

    resultados.forEach((r, i) => {

        if (r.status === "rejected") {
            console.error(
                "Error cargando quebrada:",
                lista[i].nombre,
                r.reason
            );
        }

    });

};


// ============================================================
// 3. COLORES DE PRECIPITACION
// ============================================================

window.colorPrecipitacion = function(valor) {

    if (valor === null || !Number.isFinite(valor)) {
        return "#64748b";
    }

    if (valor <= 0) return "#94a3b8";
    if (valor <= 0.1) return "#bae6fd";
    if (valor <= 1) return "#38bdf8";
    if (valor <= 2) return "#22c55e";
    if (valor <= 5) return "#facc15";
    if (valor <= 10) return "#f97316";

    return "#ef4444";
};


// ============================================================
// 4. LEYENDA DE PRECIPITACION
// ============================================================

function crearLeyendaGFS() {

    const legend = L.control({
        position: "bottomright"
    });

    legend.onAdd = function() {

        const div = L.DomUtil.create(
            "div",
            "gfs-legend"
        );

        div.style.background = "rgba(10,19,34,0.94)";
        div.style.padding = "10px 12px";
        div.style.borderRadius = "8px";
        div.style.color = "#ffffff";
        div.style.fontSize = "11px";
        div.style.lineHeight = "20px";
        div.style.border = "1px solid #334155";

        div.innerHTML = `
            <strong>PRECIPITACION GFS (mm/h)</strong><br>
            <span style="color:#94a3b8">●</span> 0<br>
            <span style="color:#bae6fd">●</span> 0 - 0.1<br>
            <span style="color:#38bdf8">●</span> 0.1 - 1<br>
            <span style="color:#22c55e">●</span> 1 - 2<br>
            <span style="color:#facc15">●</span> 2 - 5<br>
            <span style="color:#f97316">●</span> 5 - 10<br>
            <span style="color:#ef4444">●</span> > 10
        `;

        return div;
    };

    return legend;
}


// ============================================================
// 5. CONTROL DE SELECCION HORARIA
// ============================================================

function crearControlHorarioGFS(map) {

    const control = L.control({
        position: "topleft"
    });

    control.onAdd = function() {

        const div = L.DomUtil.create(
            "div",
            "gfs-time-control"
        );

        div.style.background = "rgba(10,19,34,0.95)";
        div.style.padding = "10px";
        div.style.borderRadius = "8px";
        div.style.color = "#ffffff";
        div.style.border = "1px solid #334155";
        div.style.minWidth = "180px";

        div.innerHTML = `
            <div style="font-size:11px;font-weight:bold;margin-bottom:7px">
                PRONOSTICO GFS
            </div>

            <select id="gfs-hour-select"
                style="
                    width:100%;
                    padding:7px;
                    background:#1e293b;
                    color:white;
                    border:1px solid #475569;
                    border-radius:5px;
                ">
                <option value="">Esperando JSON...</option>
            </select>

            <div id="gfs-hour-label"
                style="font-size:11px;margin-top:7px;color:#93c5fd">
                Sin datos
            </div>
        `;

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;
    };

    control.addTo(map);
}


// ============================================================
// 6. CARGAR JSON GFS
// ============================================================

window.loadGFS = async function() {

    try {

        console.log("Cargando precipitacion GFS...");

        const ruta = CONFIG.gfsFile;

        const response = await fetch(ruta, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                "No se pudo leer " + ruta +
                " HTTP " + response.status
            );
        }

        const data = await response.json();

        // Validacion
        if (
            !data.time ||
            !Array.isArray(data.time) ||
            !data.points ||
            !Array.isArray(data.points)
        ) {
            throw new Error(
                "Estructura JSON GFS incorrecta."
            );
        }

        if (!data.points.length || !data.time.length) {
            throw new Error("El JSON GFS esta vacio.");
        }

        // Validar puntos
        data.points.forEach(p => {

            if (
                !Number.isFinite(Number(p.latitude)) ||
                !Number.isFinite(Number(p.longitude)) ||
                !Array.isArray(p.precipitation) ||
                p.precipitation.length !== data.time.length
            ) {
                throw new Error(
                    "Punto GFS con estructura incorrecta: " + p.id
                );
            }

        });

        window.datosGFS = data;
        window.horaGFS = 0;

        // Llenar selector
        const selector = document.getElementById(
            "gfs-hour-select"
        );

        if (!selector) {
            throw new Error("No se encontro el selector horario GFS.");
        }

        selector.innerHTML = "";

        data.time.forEach((fecha, index) => {

            const option = document.createElement("option");

            option.value = index;
            option.textContent =
                "Hora +" + index + " | " + fecha.replace("T", " ");

            selector.appendChild(option);

        });

        selector.addEventListener("change", function() {

            window.horaGFS = Number(this.value);

            window.renderGFS();

        });

        // Leyenda
        if (!window.leyendaGFS) {
            window.leyendaGFS = crearLeyendaGFS();
            window.leyendaGFS.addTo(window.mapaTumbes);
        }

        // Primera hora
        window.renderGFS();

        console.log("=================================");
        console.log("GFS CARGADO CORRECTAMENTE");
        console.log("Horas:", data.time.length);
        console.log("Puntos:", data.points.length);
        console.log("=================================");

        return true;

    } catch (error) {

        console.error("ERROR GFS:", error);

        const label = document.getElementById(
            "gfs-hour-label"
        );

        const selector = document.getElementById(
            "gfs-hour-select"
        );

        if (selector) {
            selector.innerHTML =
                '<option>Error al cargar JSON GFS</option>';
        }

        if (label) {
            label.textContent = error.message;
        }

        throw error;
    }

};


// ============================================================
// 7. REPRESENTAR LLUVIA GFS EN EL MAPA
// ============================================================

window.renderGFS = function() {

    if (!window.datosGFS || !window.mapaTumbes) {
        return;
    }

    const data = window.datosGFS;

    const hora = window.horaGFS;

    const fecha = data.time[hora];

    window.capaGFS.clearLayers();

    data.points.forEach(p => {

        const valor = p.precipitation[hora];

        // No representar datos faltantes
        if (
            valor === null ||
            valor === undefined ||
            !Number.isFinite(Number(valor))
        ) {
            return;
        }

        const lluvia = Number(valor);

        const color = window.colorPrecipitacion(lluvia);

        const marker = L.circleMarker(
            [
                Number(p.latitude),
                Number(p.longitude)
            ],
            {
                radius: 7,
                color: "#ffffff",
                weight: 1,
                fillColor: color,
                fillOpacity: 0.9
            }
        );

        marker.bindPopup(`
            <div style="min-width:150px">
                <strong>${p.id}</strong><br>
                Latitud: ${p.latitude}<br>
                Longitud: ${p.longitude}<br>
                <hr>
                <strong>Precipitacion: ${lluvia.toFixed(2)} mm/h</strong><br>
                Hora: ${fecha.replace("T", " ")}
                <br>Hora de Peru (UTC-5)
            </div>
        `);

        marker.addTo(window.capaGFS);

    });

    const label = document.getElementById(
        "gfs-hour-label"
    );

    if (label) {
        label.textContent =
            "Fecha: " + fecha.replace("T", " ") +
            " | UTC-5";
    }

    console.log(
        "GFS visualizado:",
        fecha,
        "| hora:",
        hora
    );

};
