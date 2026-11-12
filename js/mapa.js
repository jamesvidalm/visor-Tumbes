
 // ============================================================
 // MAPA.JS - SISTEMA HIDROLOGICO TUMBES
 // ============================================================
 // - Estaciones hidrometricas con seleccion de hidrogramas.
 // - Diez subcuencas con colores independientes.
 // - Precipitacion GFS como raster georreferenciado.
 // - Escala de precipitacion de 20 intervalos.
 // - Leyenda horizontal inferior.
 // - Play / Pause / Stop compacto arriba a la derecha.
 // - Interruptor para activar/desactivar precipitacion.
 // - Fechas, minimo y maximo automaticos del JSON.
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
window.lluviaGFSVisible = true;

window.intervalosGFS = [];

window.resumenGFS = {
    minimo: null,
    maximo: null,
    minimoPositivo: null,
    fechaInicio: null,
    fechaFin: null,
    totalHoras: 0
};


// Colores de lluvia inspirados en la imagen proporcionada
// Azul oscuro -> celeste -> verde -> amarillo -> naranja -> rojo -> magenta

window.coloresGFS = [
    "#142b8c",
    "#174bb5",
    "#176bd0",
    "#168de0",
    "#25b9e8",
    "#38d6db",
    "#20c997",
    "#16b85b",
    "#38c92d",
    "#7bd51b",
    "#b6df12",
    "#e8e51a",
    "#ffd21a",
    "#ffad16",
    "#ff8618",
    "#ff5b1b",
    "#f52b19",
    "#df101e",
    "#bd075d",
    "#ed00bd"
];


// Colores independientes para las diez subcuencas
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

    if (window.timerGFS) {
        clearInterval(window.timerGFS);
        window.timerGFS = null;
    }

    if (window.mapaTumbes) {
        window.mapaTumbes.remove();
        window.mapaTumbes = null;
    }

    window.datosGFS = null;
    window.rasterGFS = null;
    window.leyendaGFS = null;
    window.horaGFS = 0;
    window.reproduciendoGFS = false;
    window.lluviaGFSVisible = true;

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

    // Control de capas existentes
    L.control.layers(
        null,
        {
            "Estaciones": window.capaEstaciones,
            "Subcuencas": window.capaQuebradas
        },
        {
            collapsed: true,
            position: "topleft"
        }
    ).addTo(map);

    // Controles compactos de lluvia
    crearControlHorarioGFS(map);

    // Leyenda horizontal inferior
    crearLeyendaGFS(map);

    setTimeout(function() {
        map.invalidateSize();
    }, 300);

    console.log("Mapa Tumbes inicializado.");

    return map;
};


// ============================================================
// 2. CARGAR SUBCUENCAS GEOJSON
// ============================================================

window.addPolygons = async function(map, select) {

    if (!window.CONFIG) {
        throw new Error("No existe CONFIG.");
    }

    const lista = CONFIG.quebradas || [];

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
                    weight: 2,
                    opacity: 1,
                    fillColor: color,
                    fillOpacity: 0.32
                },

                onEachFeature: function(feature, lyr) {

                    lyr.bindTooltip(q.nombre);

                    lyr.bindPopup(
                        "<b>Subcuenca " + q.nombre + "</b>"
                    );

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

    resultados.forEach((r, i) => {

        if (r.status === "rejected") {

            console.error(
                "Error cargando subcuenca:",
                lista[i].nombre,
                r.reason
            );

        }

    });

};


// ============================================================
// 3. CALCULAR MINIMO Y MAXIMO DEL JSON
// ============================================================

function calcularResumenGFS(data) {

    let minimo = Infinity;
    let maximo = -Infinity;
    let minimoPositivo = Infinity;

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

            if (lluvia > 0) {
                minimoPositivo = Math.min(minimoPositivo, lluvia);
            }

            cantidad++;

        });

    });

    if (cantidad === 0) {
        throw new Error(
            "El JSON no contiene valores validos de precipitacion."
        );
    }

    window.resumenGFS = {

        minimo: minimo,
        maximo: maximo,

        minimoPositivo:
            minimoPositivo === Infinity ? null : minimoPositivo,

        fechaInicio: data.time[0],
        fechaFin: data.time[data.time.length - 1],
        totalHoras: data.time.length

    };

    console.log("======================================");
    console.log("RESUMEN DEL PRONOSTICO GFS");
    console.log("======================================");
    console.log("Minimo:", minimo, "mm/h");
    console.log("Maximo:", maximo, "mm/h");
    console.log("Minimo positivo:", window.resumenGFS.minimoPositivo);
    console.log("Inicio:", data.time[0]);
    console.log("Fin:", data.time[data.time.length - 1]);
    console.log("Horas:", data.time.length);
    console.log("Celdas:", data.points.length);
    console.log("======================================");

}


// ============================================================
// 4. CALCULAR 20 INTERVALOS DE LLUVIA
// ============================================================

function calcularIntervalosGFS() {

    const maximo = window.resumenGFS.maximo;
    const minimoPositivo = window.resumenGFS.minimoPositivo;

    window.intervalosGFS = [];

    // No hay lluvia positiva
    if (maximo <= 0 || minimoPositivo === null) {
        return;
    }

    // La escala empieza en cero para facilitar la lectura
    const minimoEscala = 0;
    const paso = (maximo - minimoEscala) / 20;

    for (let i = 0; i < 20; i++) {

        window.intervalosGFS.push({

            minimo: i * paso,
            maximo: (i + 1) * paso,

            color: window.coloresGFS[i]

        });

    }

}


// ============================================================
// 5. OBTENER COLOR DE PRECIPITACION
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

        const item = intervalos[i];

        if (
            lluvia >= item.minimo &&
            (
                lluvia < item.maximo ||
                i === intervalos.length - 1
            )
        ) {
            return item.color;
        }

    }

    return window.coloresGFS[19];

};


// ============================================================
// 6. LEYENDA HORIZONTAL INFERIOR
// ============================================================

function crearLeyendaGFS(map) {

    const legend = L.control({
        position: "bottomleft"
    });

    legend.onAdd = function() {

        const div = L.DomUtil.create(
            "div",
            "gfs-horizontal-legend"
        );

        div.id = "gfs-horizontal-legend";

        div.style.background = "rgba(10,19,34,0.94)";
        div.style.color = "#ffffff";
        div.style.padding = "8px 12px";
        div.style.borderRadius = "7px";
        div.style.border = "1px solid #475569";
        div.style.width = "min(570px, 72vw)";
        div.style.boxSizing = "border-box";
        div.style.fontSize = "10px";

        L.DomEvent.disableClickPropagation(div);

        L.DomEvent.disableScrollPropagation(div);

        return div;

    };

    legend.addTo(map);

    window.leyendaGFS = legend;

    actualizarLeyendaGFS();

}


// ============================================================
// 7. ACTUALIZAR LEYENDA
// ============================================================

function actualizarLeyendaGFS() {

    const div = document.getElementById(
        "gfs-horizontal-legend"
    );

    if (!div) return;

    const r = window.resumenGFS;

    if (r.maximo === null) {

        div.innerHTML = `
            <div style="font-weight:bold;color:#93c5fd">
                PRECIPITACION GFS (mm/h)
            </div>
            <div>Esperando datos...</div>
        `;

        return;
    }

    let html = `

        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:8px;
            margin-bottom:7px;
        ">

            <strong style="font-size:11px;color:#93c5fd">
                PRECIPITACION GFS (mm/h)
            </strong>

            <span style="color:#cbd5e1">
                Min: ${r.minimo.toFixed(2)}
                &nbsp; | &nbsp;
                Max: ${r.maximo.toFixed(2)}
            </span>

        </div>

    `;

    if (r.maximo <= 0) {

        html += `
            <div style="font-size:10px;color:#cbd5e1">
                Sin precipitacion en el pronostico
            </div>
        `;

    } else {

        // Barra de 20 intervalos horizontales
        html += `
            <div style="
                display:grid;
                grid-template-columns:repeat(20, minmax(0, 1fr));
                gap:2px;
                height:13px;
                width:100%;
            ">
        `;

        window.coloresGFS.forEach(color => {

            html += `
                <div style="
                    background:${color};
                    border:1px solid rgba(255,255,255,0.24);
                    border-radius:1px;
                "></div>
            `;

        });

        html += `</div>`;

        html += `
            <div style="
                display:flex;
                justify-content:space-between;
                font-size:9px;
                color:#e2e8f0;
                margin-top:4px;
            ">
                <span>0</span>
                <span>${(r.maximo * 0.25).toFixed(2)}</span>
                <span>${(r.maximo * 0.50).toFixed(2)}</span>
                <span>${(r.maximo * 0.75).toFixed(2)}</span>
                <span>${r.maximo.toFixed(2)}</span>
            </div>
        `;

    }

    html += `
        <div style="
            display:flex;
            justify-content:space-between;
            gap:8px;
            margin-top:7px;
            padding-top:6px;
            border-top:1px solid #475569;
            color:#cbd5e1;
            font-size:9px;
        ">
            <span>Inicio: ${String(r.fechaInicio).replace("T", " ")}</span>
            <span>Fin: ${String(r.fechaFin).replace("T", " ")}</span>
            <span>${r.totalHoras} horas</span>
        </div>
    `;

    div.innerHTML = html;

}


// ============================================================
// 8. CONTROL COMPACTO ARRIBA A LA DERECHA
// ============================================================

function crearControlHorarioGFS(map) {

    const control = L.control({
        position: "topright"
    });

    control.onAdd = function() {

        const div = L.DomUtil.create(
            "div",
            "gfs-compact-control"
        );

        div.style.background = "rgba(10,19,34,0.94)";
        div.style.padding = "8px 9px";
        div.style.borderRadius = "7px";
        div.style.color = "#ffffff";
        div.style.border = "1px solid #475569";
        div.style.width = "205px";
        div.style.boxSizing = "border-box";

        div.innerHTML = `

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:6px;
            ">

                <strong style="
                    font-size:10px;
                    color:#93c5fd;
                ">
                    PRONOSTICO GFS
                </strong>

                <label style="
                    display:flex;
                    align-items:center;
                    gap:4px;
                    font-size:9px;
                    cursor:pointer;
                ">

                    <input
                        type="checkbox"
                        id="gfs-visible"
                        checked
                        style="accent-color:#22c55e"
                    >

                    Lluvia

                </label>

            </div>

            <div id="gfs-hour-label" style="
                font-size:10px;
                color:#e2e8f0;
                margin-bottom:5px;
                text-align:center;
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
                    margin:2px 0 6px 0;
                    accent-color:#38bdf8;
                    cursor:pointer;
                "
            >

            <div style="
                display:flex;
                gap:5px;
                justify-content:center;
            ">

                <button id="gfs-play" disabled style="
                    background:#15803d;
                    color:white;
                    border:0;
                    padding:5px 9px;
                    border-radius:4px;
                    cursor:pointer;
                    font-size:10px;
                ">▶</button>

                <button id="gfs-pause" disabled style="
                    background:#b45309;
                    color:white;
                    border:0;
                    padding:5px 9px;
                    border-radius:4px;
                    cursor:pointer;
                    font-size:10px;
                ">Ⅱ</button>

                <button id="gfs-stop" disabled style="
                    background:#b91c1c;
                    color:white;
                    border:0;
                    padding:5px 9px;
                    border-radius:4px;
                    cursor:pointer;
                    font-size:10px;
                ">■</button>

            </div>

            <div id="gfs-step-label" style="
                font-size:9px;
                text-align:center;
                color:#94a3b8;
                margin-top:5px;
            ">
                Sin datos
            </div>

        `;

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;

    };

    control.addTo(map);

    const play = document.getElementById("gfs-play");
    const pause = document.getElementById("gfs-pause");
    const stop = document.getElementById("gfs-stop");

    const slider = document.getElementById("gfs-hour-slider");
    const visible = document.getElementById("gfs-visible");

    play.addEventListener("click", reproducirGFS);
    pause.addEventListener("click", pausarGFS);
    stop.addEventListener("click", detenerGFS);

    slider.addEventListener("input", function() {

        pausarGFS();

        window.horaGFS = Number(this.value);

        window.renderGFS();

    });

    // Activar y desactivar lluvia
    visible.addEventListener("change", function() {

        window.lluviaGFSVisible = this.checked;

        if (window.lluviaGFSVisible) {

            if (window.rasterGFS && window.capaGFS) {
                window.rasterGFS.addTo(window.capaGFS);
            }

        } else {

            if (window.capaGFS) {
                window.capaGFS.clearLayers();
            }

        }

    });

}


// ============================================================
// 9. ACTUALIZAR CONTROLES
// ============================================================

function actualizarControlHorarioGFS() {

    if (!window.datosGFS) return;

    const slider = document.getElementById("gfs-hour-slider");
    const play = document.getElementById("gfs-play");
    const pause = document.getElementById("gfs-pause");
    const stop = document.getElementById("gfs-stop");
    const label = document.getElementById("gfs-hour-label");
    const step = document.getElementById("gfs-step-label");

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

    if (label) {

        label.textContent =
            String(window.datosGFS.time[window.horaGFS])
            .replace("T", " ");

    }

    if (step) {

        step.textContent =
            "Hora " + (window.horaGFS + 1) +
            " / " + total;

    }

}


// ============================================================
// 10. PLAY
// ============================================================

function reproducirGFS() {

    if (!window.datosGFS) return;

    if (window.reproduciendoGFS) return;

    const total = window.datosGFS.time.length;

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
// 11. PAUSE
// ============================================================

function pausarGFS() {

    if (window.timerGFS) {

        clearInterval(window.timerGFS);

        window.timerGFS = null;

    }

    window.reproduciendoGFS = false;

}


// ============================================================
// 12. STOP
// ============================================================

function detenerGFS() {

    pausarGFS();

    window.horaGFS = 0;

    if (window.datosGFS) {
        window.renderGFS();
    }

}


// ============================================================
// 13. CARGAR JSON GFS
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

        data.time.forEach((fecha, i) => {

            if (
                typeof fecha !== "string" ||
                !fecha.trim()
            ) {

                throw new Error(
                    "Fecha incorrecta en posicion " + i
                );

            }

        });

        data.points.forEach(p => {

            if (
                !Number.isFinite(Number(p.latitude)) ||
                !Number.isFinite(Number(p.longitude)) ||
                !Array.isArray(p.precipitation) ||
                p.precipitation.length !== data.time.length
            ) {

                throw new Error(
                    "Registro GFS incorrecto: " + p.id
                );

            }

        });

        pausarGFS();

        window.datosGFS = data;
        window.horaGFS = 0;

        // Resumen automatico
        calcularResumenGFS(data);

        // Escala de 20 intervalos
        calcularIntervalosGFS();

        // Actualizar leyenda
        actualizarLeyendaGFS();

        // Activar control de lluvia
        const checkbox = document.getElementById("gfs-visible");

        if (checkbox) {
            checkbox.checked = true;
        }

        window.lluviaGFSVisible = true;

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
// 14. GENERAR RASTER DESDE JSON
// ============================================================

function generarRasterGFS(hora) {

    const data = window.datosGFS;

    if (!data || !data.points.length) {
        return null;
    }

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

    if (!filas || !columnas) {
        return null;
    }

    const canvas = document.createElement("canvas");

    canvas.width = columnas;
    canvas.height = filas;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, columnas, filas);

    const indiceLat = new Map();
    const indiceLon = new Map();

    latitudes.forEach((lat, i) => {
        indiceLat.set(lat, i);
    });

    longitudes.forEach((lon, i) => {
        indiceLon.set(lon, i);
    });

    // Cada registro se dibuja como celda raster.
    // No se dibujan puntos ni marcadores.
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

        // Celdas sin lluvia transparentes
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
// 15. REPRESENTAR RASTER GFS
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

    const raster = generarRasterGFS(hora);

    if (!raster) {

        console.error("No se pudo generar el raster GFS.");

        return;

    }

    // Retirar imagen anterior
    window.capaGFS.clearLayers();

    // Crear imagen PNG del raster
    const imagen = raster.canvas.toDataURL("image/png");

    window.rasterGFS = L.imageOverlay(
        imagen,
        raster.bounds,
        {
            opacity: 0.78,
            interactive: false
        }
    );

    // Mostrar solo si el interruptor esta activado
    if (window.lluviaGFSVisible) {

        window.rasterGFS.addTo(window.capaGFS);

    }

    const elemento = window.rasterGFS.getElement();

    if (elemento) {
        elemento.style.imageRendering = "pixelated";
    }

    // Actualizar fecha y hora
    const label = document.getElementById("gfs-hour-label");

    if (label) {

        label.textContent =
            String(fecha).replace("T", " ");

    }

    actualizarControlHorarioGFS();

    console.log(
        "Raster GFS actualizado:",
        fecha,
        "| hora:",
        hora,
        "| dimensiones:",
        raster.filas,
        "x",
        raster.columnas,
        "| lluvia visible:",
        window.lluviaGFSVisible
    );

};

