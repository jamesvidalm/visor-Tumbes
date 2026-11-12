
// ============================================================
// MAPA.JS - SISTEMA HIDROLOGICO TUMBES
// ============================================================
// - Mantiene estaciones hidrometricas.
// - Mantiene las 10 quebradas GeoJSON.
// - Precipitacion GFS como RASTER.
// - Animacion horaria PLAY / PAUSE / STOP.
// - Deslizador para seleccionar la hora.
// - Minimo y maximo automaticos del JSON.
// - Fecha inicial y final automaticas.
// - Leyenda dinamica de 10 intervalos.
// - Actualizacion al reemplazar el archivo JSON.
// - Sin representar la lluvia mediante puntos.
// - Sin interpolacion.
// ============================================================


// ============================================================
// 0. VARIABLES GLOBALES
// ============================================================

window.mapaTumbes = null;

window.capaEstaciones = null;
window.capaQuebradas = null;
window.capaGFS = null;

window.datosGFS = null;
window.horaGFS = 0;
window.rasterGFS = null;

window.leyendaGFS = null;
window.timerGFS = null;
window.reproduciendoGFS = false;

window.intervalosGFS = [];

window.resumenGFS = {
    minimo: null,
    maximo: null,
    fechaInicio: null,
    fechaFin: null,
    totalHoras: 0
};

window.coloresGFS = [
    "#313695",
    "#4575b4",
    "#74add1",
    "#abd9e9",
    "#e0f3f8",
    "#ffffbf",
    "#fee090",
    "#fdae61",
    "#f46d43",
    "#d73027"
];


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

    // Detener animacion anterior
    if (window.timerGFS) {
        clearInterval(window.timerGFS);
        window.timerGFS = null;
    }

    // Eliminar mapa anterior
    if (window.mapaTumbes) {
        window.mapaTumbes.remove();
        window.mapaTumbes = null;
    }

    window.datosGFS = null;
    window.rasterGFS = null;
    window.leyendaGFS = null;
    window.horaGFS = 0;
    window.reproduciendoGFS = false;

    // Crear mapa
    const map = L.map("map", {
        center: [-3.75, -80.45],
        zoom: 9,
        zoomControl: true
    });

    window.mapaTumbes = map;

    // Mapa base original
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19
        }
    ).addTo(map);

    // Crear capas
    window.capaEstaciones = L.layerGroup().addTo(map);
    window.capaQuebradas = L.layerGroup().addTo(map);
    window.capaGFS = L.layerGroup().addTo(map);

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

    // Control de animacion
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
// 3. CALCULAR MINIMO, MAXIMO Y FECHAS DEL JSON
// ============================================================

function calcularResumenGFS(data) {

    let minimo = Infinity;
    let maximo = -Infinity;
    let cantidad = 0;

    data.points.forEach(p => {

        p.precipitation.forEach(valor => {

            if (
                valor === null ||
                valor === undefined ||
                !Number.isFinite(Number(valor))
            ) {
                return;
            }

            const lluvia = Number(valor);

            minimo = Math.min(minimo, lluvia);
            maximo = Math.max(maximo, lluvia);

            cantidad++;

        });

    });

    if (cantidad === 0) {
        throw new Error(
            "El JSON GFS no contiene valores validos de precipitacion."
        );
    }

    window.resumenGFS = {

        minimo: minimo,
        maximo: maximo,

        fechaInicio: data.time[0],

        fechaFin: data.time[data.time.length - 1],

        totalHoras: data.time.length

    };

    console.log("======================================");
    console.log("RESUMEN DEL PRONOSTICO GFS");
    console.log("======================================");
    console.log("Precipitacion minima:", minimo, "mm/h");
    console.log("Precipitacion maxima:", maximo, "mm/h");
    console.log("Fecha inicial:", data.time[0]);
    console.log("Fecha final:", data.time[data.time.length - 1]);
    console.log("Total de horas:", data.time.length);
    console.log("Valores validos:", cantidad);
    console.log("======================================");

}


// ============================================================
// 4. CALCULAR 10 INTERVALOS DINAMICOS
// ============================================================

function calcularIntervalosGFS() {

    const minimo = window.resumenGFS.minimo;
    const maximo = window.resumenGFS.maximo;

    window.intervalosGFS = [];

    // Si todos los valores son iguales
    if (maximo === minimo) {

        if (maximo <= 0) {
            return;
        }

        window.intervalosGFS.push({

            minimo: minimo,
            maximo: maximo,
            color: window.coloresGFS[0]

        });

        return;
    }

    const paso = (maximo - minimo) / 10;

    for (let i = 0; i < 10; i++) {

        window.intervalosGFS.push({

            minimo: minimo + i * paso,

            maximo: minimo + (i + 1) * paso,

            color: window.coloresGFS[i]

        });

    }

}


// ============================================================
// 5. OBTENER COLOR SEGUN PRECIPITACION
// ============================================================

window.colorPrecipitacion = function(valor) {

    const lluvia = Number(valor);

    if (!Number.isFinite(lluvia) || lluvia <= 0) {
        return null;
    }

    const intervalos = window.intervalosGFS;

    if (!intervalos.length) {
        return null;
    }

    for (let i = 0; i < intervalos.length; i++) {

        const intervalo = intervalos[i];

        if (
            lluvia >= intervalo.minimo &&
            (
                lluvia < intervalo.maximo ||
                i === intervalos.length - 1
            )
        ) {
            return intervalo.color;
        }

    }

    // Caso en que minimo y maximo son iguales
    if (
        window.resumenGFS.minimo ===
        window.resumenGFS.maximo
    ) {
        return window.coloresGFS[0];
    }

    return window.coloresGFS[9];

};


// ============================================================
// 6. CREAR LEYENDA DE PRECIPITACION
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

        div.id = "gfs-legend-content";

        div.style.background = "rgba(10,19,34,0.96)";
        div.style.padding = "11px 13px";
        div.style.borderRadius = "8px";
        div.style.color = "#ffffff";
        div.style.fontSize = "11px";
        div.style.lineHeight = "19px";
        div.style.border = "1px solid #334155";
        div.style.minWidth = "165px";

        L.DomEvent.disableClickPropagation(div);

        return div;
    };

    return legend;

}


// ============================================================
// 7. ACTUALIZAR LEYENDA DINAMICA
// ============================================================

function actualizarLeyendaGFS() {

    const div = document.getElementById(
        "gfs-legend-content"
    );

    if (!div) return;

    const r = window.resumenGFS;
    const intervalos = window.intervalosGFS;

    let html = `
        <div style="
            font-weight:bold;
            color:#93c5fd;
            font-size:12px;
            margin-bottom:8px;
        ">
            PRECIPITACION GFS
        </div>

        <div style="margin-bottom:8px">
            <div style="color:#cbd5e1">
                Minimo: <b>${r.minimo.toFixed(3)} mm/h</b>
            </div>

            <div style="color:#cbd5e1">
                Maximo: <b>${r.maximo.toFixed(3)} mm/h</b>
            </div>
        </div>

        <div style="
            border-top:1px solid #475569;
            padding-top:7px;
            margin-bottom:5px;
            color:#93c5fd;
            font-weight:bold;
        ">
            INTERVALOS (mm/h)
        </div>
    `;

    if (r.maximo <= 0) {

        html += `
            <div style="color:#cbd5e1">
                Sin precipitacion
            </div>
        `;

    } else {

        intervalos.forEach((item, i) => {

            let etiqueta;

            if (intervalos.length === 1) {

                etiqueta = item.minimo.toFixed(3);

            } else {

                etiqueta =
                    item.minimo.toFixed(3) +
                    " - " +
                    item.maximo.toFixed(3);

            }

            html += `
                <div style="
                    display:flex;
                    align-items:center;
                    gap:7px;
                ">

                    <span style="
                        width:16px;
                        height:12px;
                        background:${item.color};
                        border:1px solid rgba(255,255,255,0.5);
                        display:inline-block;
                        flex-shrink:0;
                    "></span>

                    <span>${etiqueta}</span>

                </div>
            `;

        });

    }

    html += `
        <div style="
            border-top:1px solid #475569;
            margin-top:8px;
            padding-top:7px;
            font-size:10px;
            color:#cbd5e1;
        ">

            <div>
                Inicio: ${String(r.fechaInicio).replace("T", " ")}
            </div>

            <div>
                Fin: ${String(r.fechaFin).replace("T", " ")}
            </div>

            <div>
                Duracion: ${r.totalHoras} horas
            </div>

            <div style="margin-top:4px;color:#94a3b8">
                GFS | UTC-5
            </div>

        </div>
    `;

    div.innerHTML = html;

}


// ============================================================
// 8. CREAR CONTROL PLAY / PAUSE / STOP
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

        div.style.background = "rgba(10,19,34,0.96)";
        div.style.padding = "11px";
        div.style.borderRadius = "8px";
        div.style.color = "#ffffff";
        div.style.border = "1px solid #334155";
        div.style.width = "270px";
        div.style.boxSizing = "border-box";

        div.innerHTML = `

            <div style="
                font-size:12px;
                font-weight:bold;
                color:#93c5fd;
                margin-bottom:9px;
            ">
                PRONOSTICO DE LLUVIA GFS
            </div>

            <div id="gfs-hour-label" style="
                font-size:11px;
                color:#ffffff;
                margin-bottom:8px;
            ">
                Esperando datos...
            </div>

            <input
                type="range"
                id="gfs-hour-slider"
                min="0"
                max="0"
                value="0"
                step="1"
                disabled
                style="
                    width:100%;
                    margin:5px 0 10px 0;
                    cursor:pointer;
                    accent-color:#38bdf8;
                "
            >

            <div style="
                display:flex;
                gap:6px;
                justify-content:center;
            ">

                <button id="gfs-play" disabled style="
                    background:#15803d;
                    color:white;
                    border:0;
                    padding:7px 13px;
                    border-radius:5px;
                    cursor:pointer;
                    font-size:11px;
                    font-weight:bold;
                ">▶ Play</button>

                <button id="gfs-pause" disabled style="
                    background:#b45309;
                    color:white;
                    border:0;
                    padding:7px 13px;
                    border-radius:5px;
                    cursor:pointer;
                    font-size:11px;
                    font-weight:bold;
                ">Ⅱ Pause</button>

                <button id="gfs-stop" disabled style="
                    background:#b91c1c;
                    color:white;
                    border:0;
                    padding:7px 13px;
                    border-radius:5px;
                    cursor:pointer;
                    font-size:11px;
                    font-weight:bold;
                ">■ Stop</button>

            </div>

            <div id="gfs-step-label" style="
                font-size:10px;
                text-align:center;
                color:#94a3b8;
                margin-top:8px;
            ">
                Sin datos
            </div>

            <div id="gfs-summary-control" style="
                border-top:1px solid #475569;
                margin-top:9px;
                padding-top:7px;
                font-size:10px;
                line-height:17px;
                color:#cbd5e1;
            ">
                Minimo: -- mm/h<br>
                Maximo: -- mm/h<br>
                Inicio: --<br>
                Fin: --
            </div>

        `;

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;
    };

    control.addTo(map);

    // Eventos de botones y deslizador
    const play = document.getElementById("gfs-play");
    const pause = document.getElementById("gfs-pause");
    const stop = document.getElementById("gfs-stop");
    const slider = document.getElementById("gfs-hour-slider");

    play.addEventListener("click", reproducirGFS);
    pause.addEventListener("click", pausarGFS);
    stop.addEventListener("click", detenerGFS);

    slider.addEventListener("input", function() {

        pausarGFS();

        window.horaGFS = Number(this.value);

        window.renderGFS();

    });

}


// ============================================================
// 9. ACTUALIZAR RESUMEN DEL CONTROL
// ============================================================

function actualizarResumenControlGFS() {

    const div = document.getElementById(
        "gfs-summary-control"
    );

    if (!div || !window.datosGFS) return;

    const r = window.resumenGFS;

    div.innerHTML = `

        <div>Minimo: <b>${r.minimo.toFixed(3)} mm/h</b></div>

        <div>Maximo: <b>${r.maximo.toFixed(3)} mm/h</b></div>

        <div>Inicio: ${String(r.fechaInicio).replace("T", " ")}</div>

        <div>Fin: ${String(r.fechaFin).replace("T", " ")}</div>

    `;

}


// ============================================================
// 10. ACTUALIZAR CONTROL HORARIO
// ============================================================

function actualizarControlHorarioGFS() {

    if (!window.datosGFS) return;

    const slider = document.getElementById(
        "gfs-hour-slider"
    );

    const play = document.getElementById("gfs-play");
    const pause = document.getElementById("gfs-pause");
    const stop = document.getElementById("gfs-stop");
    const stepLabel = document.getElementById("gfs-step-label");

    const total = window.datosGFS.time.length;

    if (slider) {

        slider.max = total - 1;
        slider.value = window.horaGFS;
        slider.disabled = false;

    }

    [play, pause, stop].forEach(button => {

        if (button) {
            button.disabled = false;
        }

    });

    if (stepLabel) {

        stepLabel.textContent =
            "Hora " + (window.horaGFS + 1) +
            " de " + total;

    }

    actualizarResumenControlGFS();

}


// ============================================================
// 11. PLAY
// ============================================================

function reproducirGFS() {

    if (!window.datosGFS) return;

    if (window.reproduciendoGFS) return;

    const total = window.datosGFS.time.length;

    // Reiniciar si llego al final
    if (window.horaGFS >= total - 1) {

        window.horaGFS = 0;

        window.renderGFS();

    }

    window.reproduciendoGFS = true;

    if (window.timerGFS) {
        clearInterval(window.timerGFS);
    }

    window.timerGFS = setInterval(function() {

        if (window.horaGFS >= total - 1) {

            pausarGFS();

            return;

        }

        window.horaGFS++;

        window.renderGFS();

    }, 800);

}


// ============================================================
// 12. PAUSE
// ============================================================

function pausarGFS() {

    if (window.timerGFS) {

        clearInterval(window.timerGFS);

        window.timerGFS = null;

    }

    window.reproduciendoGFS = false;

}


// ============================================================
// 13. STOP
// ============================================================

function detenerGFS() {

    pausarGFS();

    window.horaGFS = 0;

    if (window.datosGFS) {

        window.renderGFS();

    }

}


// ============================================================
// 14. CARGAR JSON GFS
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

        // Validar estructura general
        if (
            !Array.isArray(data.time) ||
            !Array.isArray(data.points)
        ) {

            throw new Error(
                "Estructura JSON GFS incorrecta."
            );

        }

        if (!data.points.length || !data.time.length) {

            throw new Error(
                "El JSON GFS esta vacio."
            );

        }

        // Validar fechas
        data.time.forEach((fecha, i) => {

            if (
                typeof fecha !== "string" ||
                !fecha.trim()
            ) {

                throw new Error(
                    "Fecha incorrecta en la posicion " + i
                );

            }

        });

        // Validar puntos y precipitaciones
        data.points.forEach(p => {

            if (
                !Number.isFinite(Number(p.latitude)) ||
                !Number.isFinite(Number(p.longitude)) ||
                !Array.isArray(p.precipitation) ||
                p.precipitation.length !== data.time.length
            ) {

                throw new Error(
                    "Registro GFS con estructura incorrecta: " + p.id
                );

            }

        });

        // Detener animacion anterior
        pausarGFS();

        // Guardar datos nuevos
        window.datosGFS = data;

        window.horaGFS = 0;

        // Calcular estadisticas globales del nuevo JSON
        calcularResumenGFS(data);

        // Calcular intervalos de la leyenda
        calcularIntervalosGFS();

        // Crear leyenda
        if (!window.leyendaGFS) {

            window.leyendaGFS = crearLeyendaGFS();

            window.leyendaGFS.addTo(window.mapaTumbes);

        }

        // Actualizar leyenda y controles
        actualizarLeyendaGFS();

        actualizarControlHorarioGFS();

        // Dibujar primera hora
        window.renderGFS();

        console.log("======================================");
        console.log("GFS CARGADO CORRECTAMENTE");
        console.log("Archivo:", CONFIG.gfsFile);
        console.log("Celdas:", data.points.length);
        console.log("Horas:", data.time.length);
        console.log("Minimo:", window.resumenGFS.minimo);
        console.log("Maximo:", window.resumenGFS.maximo);
        console.log("Inicio:", window.resumenGFS.fechaInicio);
        console.log("Fin:", window.resumenGFS.fechaFin);
        console.log("======================================");

        return true;

    } catch (error) {

        console.error("ERROR GFS:", error);

        const label = document.getElementById("gfs-hour-label");
        const slider = document.getElementById("gfs-hour-slider");

        if (label) {
            label.textContent = error.message;
        }

        if (slider) {
            slider.disabled = true;
        }

        throw error;

    }

};


// ============================================================
// 15. GENERAR RASTER DESDE JSON
// ============================================================

function generarRasterGFS(hora) {

    const data = window.datosGFS;

    if (!data || !data.points.length) {
        return null;
    }

    // Coordenadas unicas
    const latitudes = [
        ...new Set(
            data.points.map(p => Number(p.latitude))
        )
    ].sort((a, b) => b - a);

    const longitudes = [
        ...new Set(
            data.points.map(p => Number(p.longitude))
        )
    ].sort((a, b) => a - b);

    const filas = latitudes.length;
    const columnas = longitudes.length;

    if (filas < 1 || columnas < 1) {
        return null;
    }

    // Crear imagen raster
    const canvas = document.createElement("canvas");

    canvas.width = columnas;
    canvas.height = filas;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, columnas, filas);

    // Indices de coordenadas
    const indiceLat = new Map();
    const indiceLon = new Map();

    latitudes.forEach((lat, i) => {
        indiceLat.set(lat, i);
    });

    longitudes.forEach((lon, i) => {
        indiceLon.set(lon, i);
    });

    // Dibujar celdas raster
    data.points.forEach(p => {

        const lat = Number(p.latitude);
        const lon = Number(p.longitude);

        const valor = p.precipitation[hora];

        if (
            valor === null ||
            valor === undefined ||
            !Number.isFinite(Number(valor))
        ) {
            return;
        }

        const lluvia = Number(valor);

        // Cero y negativos transparentes
        if (lluvia <= 0) {
            return;
        }

        const fila = indiceLat.get(lat);
        const columna = indiceLon.get(lon);

        if (
            fila === undefined ||
            columna === undefined
        ) {
            return;
        }

        const color = window.colorPrecipitacion(lluvia);

        if (!color) return;

        ctx.fillStyle = color;

        ctx.fillRect(columna, fila, 1, 1);

    });

    // Calcular resolucion de la malla
    function calcularPaso(valores) {

        if (valores.length < 2) return 0;

        let paso = Infinity;

        for (let i = 1; i < valores.length; i++) {

            const diferencia = Math.abs(
                valores[i] - valores[i - 1]
            );

            if (diferencia > 0 && diferencia < paso) {
                paso = diferencia;
            }

        }

        return Number.isFinite(paso) ? paso : 0;

    }

    const pasoLat = calcularPaso(latitudes);
    const pasoLon = calcularPaso(longitudes);

    // Extension geografica
    const norte = latitudes[0] + pasoLat / 2;
    const sur = latitudes[filas - 1] - pasoLat / 2;

    const oeste = longitudes[0] - pasoLon / 2;
    const este = longitudes[columnas - 1] + pasoLon / 2;

    const bounds = [
        [sur, oeste],
        [norte, este]
    ];

    return {
        canvas: canvas,
        bounds: bounds,
        filas: filas,
        columnas: columnas
    };

}


// ============================================================
// 16. REPRESENTAR RASTER GFS EN EL MAPA
// ============================================================

window.renderGFS = function() {

    if (
        !window.datosGFS ||
        !window.mapaTumbes ||
        !window.capaGFS
    ) {
        return;
    }

    const data = window.datosGFS;
    const hora = window.horaGFS;

    if (
        hora < 0 ||
        hora >= data.time.length
    ) {
        return;
    }

    const fecha = data.time[hora];

    // Generar raster de la hora seleccionada
    const raster = generarRasterGFS(hora);

    if (!raster) {

        console.error("No se pudo generar el raster GFS.");

        return;

    }

    // Retirar imagen de la hora anterior
    window.capaGFS.clearLayers();

    // Convertir canvas en imagen
    const imagen = raster.canvas.toDataURL("image/png");

    // Superponer raster georreferenciado
    window.rasterGFS = L.imageOverlay(
        imagen,
        raster.bounds,
        {
            opacity: 0.78,
            interactive: false
        }
    );

    window.rasterGFS.addTo(window.capaGFS);

    // Mostrar celdas sin suavizado
    const elemento = window.rasterGFS.getElement();

    if (elemento) {
        elemento.style.imageRendering = "pixelated";
    }

    // Fecha de la hora visualizada
    const label = document.getElementById("gfs-hour-label");

    if (label) {

        label.textContent =
            "Fecha: " +
            String(fecha).replace("T", " ") +
            " | UTC-5";

    }

    // Actualizar slider, contador y resumen
    actualizarControlHorarioGFS();

    console.log(
        "Raster GFS:",
        fecha,
        "| hora:",
        hora,
        "| dimensiones:",
        raster.filas,
        "x",
        raster.columnas
    );

};
