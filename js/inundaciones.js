
/* ============================================================
   MAPAS DE INUNDACION - CUENCA DEL RIO TUMBES

   REFERENCIA HIDROLOGICA FIJA: ESTACION EL TIGRE

   - Los mapas SIEMPRE utilizan Q_TIGRE_P.
   - No dependen de la ubicacion seleccionada en el hidrograma.
   - Seis horizontes: +12, +24, +36, +48, +60 y +72 horas.
   - Seleccion automatica de PNG segun caudal de El Tigre.
   - Imagenes georreferenciadas mediante manifest.json.
   - Google Satellite predeterminado.
   - Alternativa Google Maps.
   - Leyenda de profundidad de inundacion con 10 clases.
   - Se elimina la informacion PNG y umbral de las tarjetas.
   ============================================================ */

window.FLOOD_MANIFEST = null;
window.FLOOD_MAPS = window.FLOOD_MAPS || [];

const FLOOD_FOLDER = "data/inundaciones/";
const FLOOD_HORIZONS = [12, 24, 36, 48, 60, 72];

// REFERENCIA FIJA PARA LAS MANCHAS DE INUNDACION
const FLOOD_REFERENCE_STATION = "Q_TIGRE_P";

// PALETA DE COLORES DE PROFUNDIDAD (10 CLASES)
const FLOOD_COLORS = [
    "#d6f0ff",
    "#c4e7ff",
    "#b2deff",
    "#95d4ff",
    "#74c0fc",
    "#4dabf7",
    "#339af0",
    "#228be6",
    "#1864ab",
    "#0b3d91"
];

// CORTES DE CLASIFICACION DEL ARCHIVO q100.json
const FLOOD_DEFAULT_BREAKS = [
    0.001042068,
    0.700313395,
    1.399584722,
    2.098856050,
    2.798127377,
    3.497398704,
    4.196670032,
    4.895941359,
    5.595212687,
    6.294484014,
    6.993755341
];

window.FLOOD_BREAKS = null;


/* ============================================================
   1. NORMALIZAR TEXTO
   ============================================================ */

window.norm = function (value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
};


/* ============================================================
   2. CARGAR MANIFEST
   ============================================================ */

window.loadFloodManifest = async function () {

    if (window.FLOOD_MANIFEST) {
        return window.FLOOD_MANIFEST;
    }

    const path =
        CONFIG.manifestInundaciones ||
        FLOOD_FOLDER + "manifest.json";

    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(
            "No se pudo leer manifest.json. HTTP " +
            response.status
        );
    }

    const data = await response.json();

    if (!Array.isArray(data.images)) {
        throw new Error(
            "El manifest no contiene la lista images."
        );
    }

    window.FLOOD_MANIFEST = data;

    return data;
};


/* ============================================================
   3. CARGAR CORTES DE LA LEYENDA
   ============================================================ */

async function loadFloodBreaks() {

    if (window.FLOOD_BREAKS) {
        return window.FLOOD_BREAKS;
    }

    try {

        const response = await fetch(
            FLOOD_FOLDER + "q100.json"
        );

        if (!response.ok) {
            throw new Error("No se pudo leer q100.json");
        }

        const data = await response.json();

        if (
            Array.isArray(data.breaks) &&
            data.breaks.length === 11
        ) {

            window.FLOOD_BREAKS = data.breaks;

            return window.FLOOD_BREAKS;
        }

    } catch (error) {

        console.warn(
            "Se utilizaran los cortes de clasificacion predeterminados:",
            error
        );

    }

    window.FLOOD_BREAKS = FLOOD_DEFAULT_BREAKS;

    return window.FLOOD_BREAKS;
}


/* ============================================================
   4. OBTENER CAUDAL NUMERICO
   ============================================================ */

function getFloodNumber(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}


/* ============================================================
   5. SELECCIONAR PNG SEGUN CAUDAL DE EL TIGRE
   ============================================================ */

function getFloodImage(caudal, images) {

    if (!Number.isFinite(caudal)) {
        return null;
    }

    const available = images
        .map(image => {

            const match = String(image.id).match(/^q(\d+)$/i);

            if (!match) return null;

            return {
                ...image,
                threshold: Number(match[1])
            };

        })
        .filter(Boolean)
        .sort((a, b) => a.threshold - b.threshold);

    if (!available.length) {
        return null;
    }

    const minimum = available[0].threshold;

    let target;

    if (caudal <= minimum) {
        target = minimum;
    } else {
        target = Math.floor(caudal / 25) * 25;
    }

    let selected = available
        .filter(image => image.threshold <= target)
        .pop();

    if (!selected) {
        selected = available[0];
    }

    return selected;
}


/* ============================================================
   6. FECHA Y HORA DE INICIO DEL PRONOSTICO
   ============================================================ */

function getFloodStartDate() {

    const value =
        CONFIG.inicioPronostico ||
        "2026-11-05T02:00:00-05:00";

    return new Date(value);
}


/* ============================================================
   7. BUSCAR CAUDAL DE EL TIGRE EN CADA HORIZONTE
   ============================================================ */

function getFloodFlowAtHour(rows, targetDate) {

    let bestRow = null;
    let minDifference = Infinity;

    rows.forEach(row => {

        const date = window.parseDate(row.fecha);

        if (!date || isNaN(date.getTime())) {
            return;
        }

        const difference = Math.abs(
            date.getTime() - targetDate.getTime()
        );

        if (difference < minDifference) {
            minDifference = difference;
            bestRow = row;
        }

    });

    // Tolerancia de 30 minutos.
    if (
        !bestRow ||
        minDifference > 30 * 60 * 1000
    ) {
        return null;
    }

    // SIEMPRE UTILIZAR EL PRONOSTICO DE EL TIGRE
    return getFloodNumber(
        bestRow[FLOOD_REFERENCE_STATION]
    );
}


/* ============================================================
   8. CREAR LEYENDA DE PROFUNDIDAD DE INUNDACION
   ============================================================ */

function createFloodLegend() {

    const grid = document.getElementById("flood-grid");

    if (!grid) return;

    let legend = document.getElementById("flood-legend");

    if (!legend) {

        legend = document.createElement("div");

        legend.id = "flood-legend";

        grid.insertAdjacentElement("afterend", legend);
    }

    const breaks = window.FLOOD_BREAKS || FLOOD_DEFAULT_BREAKS;

    let html = `
        <div class="flood-legend-title">
            <strong>Profundidad de inundación (m)</strong>
            <span>10 clases</span>
        </div>

        <div class="flood-legend-items">
    `;

    for (let i = 0; i < 10; i++) {

        const lower = Number(breaks[i]);
        const upper = Number(breaks[i + 1]);

        html += `
            <div class="flood-legend-item">
                <span
                    class="flood-legend-color"
                    style="background:${FLOOD_COLORS[i]}"
                ></span>

                <span class="flood-legend-range">
                    ${lower.toFixed(2)} – ${upper.toFixed(2)} m
                </span>
            </div>
        `;
    }

    html += `
        </div>

        <div class="flood-legend-note">
            Las profundidades se expresan en metros.
        </div>
    `;

    legend.innerHTML = html;
}


/* ============================================================
   9. CREAR PANEL DE MAPAS DE INUNDACION
   ============================================================ */

function createFloodPanel() {

    let section = document.getElementById("flood-section");

    if (section) {
        return section;
    }

    const hydroChart = document.getElementById("hydro-chart");

    if (!hydroChart) {
        throw new Error(
            "No se encontró hydro-chart en index.html."
        );
    }

    const hydroPanel = hydroChart.closest(".panel");

    section = document.createElement("section");

    section.id = "flood-section";
    section.className = "panel";

    section.innerHTML = `
        <div class="panel-head">
            <div>
                <small>03 / MAPAS DE INUNDACION</small>
                <h3 id="flood-title">
                    Escenarios de inundación - Estación El Tigre
                </h3>
            </div>

            <span class="unit">HORIZONTES · HORAS</span>
        </div>

        <div id="scenario-label" class="subinfo">
            Mapas asociados al pronóstico de caudal de la estación El Tigre.
        </div>

        <div id="flood-grid"></div>

        <div id="flood-legend"></div>
    `;

    hydroPanel.insertAdjacentElement("afterend", section);

    const style = document.createElement("style");

    style.id = "flood-map-styles";

    style.textContent = `

        #flood-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 10px;
            margin-top: 16px;
            width: 100%;
            overflow-x: auto;
        }

        .flood-card {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #26354b;
            border-radius: 10px;
            background: #111d2d;
        }

        .flood-card-header {
            padding: 10px 8px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            border-bottom: 1px solid #26354b;
        }

        .flood-card-header strong {
            color: #e5edf7;
            font-size: 12px;
        }

        .flood-card-header span {
            color: #fbbf24;
            font-size: 11px;
        }

        .flood-map {
            width: 100%;
            height: 280px;
            background: #dce5eb;
        }

        .flood-error {
            padding: 25px 12px;
            color: #fca5a5;
            text-align: center;
            font-size: 13px;
        }

        .flood-map .leaflet-control-layers {
            font-size: 11px;
        }

        /* LEYENDA DE PROFUNDIDAD */

        #flood-legend {
            margin-top: 18px;
            padding: 15px 18px;
            border: 1px solid #26354b;
            border-radius: 10px;
            background: #111d2d;
        }

        .flood-legend-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 13px;
        }

        .flood-legend-title strong {
            color: #e5edf7;
            font-size: 13px;
        }

        .flood-legend-title span {
            color: #a9bad0;
            font-size: 11px;
        }

        .flood-legend-items {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px 18px;
        }

        .flood-legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .flood-legend-color {
            display: inline-block;
            flex: 0 0 24px;
            width: 24px;
            height: 16px;
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 3px;
        }

        .flood-legend-range {
            color: #d7e2f0;
            font-size: 11px;
            white-space: nowrap;
        }

        .flood-legend-note {
            margin-top: 12px;
            color: #91a4bc;
            font-size: 10px;
        }

        .flood-card .leaflet-control-attribution {
            font-size: 8px;
        }

        @media (max-width: 1100px) {

            #flood-grid {
                overflow-x: auto;
                grid-template-columns: repeat(6, 220px);
            }

            .flood-legend-items {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }

        @media (max-width: 600px) {

            #flood-legend {
                padding: 12px;
            }

            .flood-legend-items {
                grid-template-columns: 1fr;
            }
        }
    `;

    if (!document.getElementById("flood-map-styles")) {
        document.head.appendChild(style);
    }

    return section;
}


/* ============================================================
   10. LIMPIAR MAPAS ANTERIORES
   ============================================================ */

function clearFloodMaps() {

    window.FLOOD_MAPS.forEach(map => {

        try {
            map.remove();
        } catch (error) {
            console.warn(error);
        }

    });

    window.FLOOD_MAPS = [];
}


/* ============================================================
   11. FONDOS GOOGLE Y SELECTOR
   ============================================================ */

function addFloodBaseLayers(map, bounds) {

    // GOOGLE SATELLITE: FONDO PREDETERMINADO
    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    // GOOGLE MAPS: CALLES Y NOMBRES
    const googleMaps = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    // SATELLITE POR DEFECTO
    googleSatellite.addTo(map);

    const baseMaps = {
        "Google Satellite": googleSatellite,
        "Google Maps": googleMaps
    };

    // SELECTOR PARA CAMBIAR EL FONDO
    L.control.layers(
        baseMaps,
        null,
        {
            collapsed: true,
            position: "topright"
        }
    ).addTo(map);

    map.fitBounds(bounds);
}


/* ============================================================
   12. MOSTRAR LOS SEIS MAPAS
   ============================================================ */

window.renderFloodImages = async function (item, rows) {

    try {

        rows = Array.isArray(rows) ? rows : [];

        createFloodPanel();

        const grid = document.getElementById("flood-grid");
        const label = document.getElementById("scenario-label");
        const title = document.getElementById("flood-title");

        clearFloodMaps();

        grid.innerHTML = "";

        // IMPORTANTE:
        // El nombre seleccionado NO modifica la referencia
        // de los mapas de inundacion.

        title.textContent =
            "Escenarios de inundación - Estación El Tigre";

        // CARGAR LEYENDA
        await loadFloodBreaks();

        createFloodLegend();

        // COMPROBAR QUE EXISTE EL PRONOSTICO DE EL TIGRE
        if (!rows.some(row =>
            getFloodNumber(row[FLOOD_REFERENCE_STATION]) !== null
        )) {

            label.textContent =
                "No se encontraron datos de pronóstico para la estación El Tigre (Q_TIGRE_P).";

            grid.innerHTML =
                '<div class="flood-error">' +
                'No hay datos de caudal pronosticado de El Tigre.' +
                '</div>';

            return;
        }

        // Cargar manifest
        const data = await window.loadFloodManifest();

        const startDate = getFloodStartDate();

        label.textContent =
            "Referencia hidrológica: Estación El Tigre" +
            " · Inicio: " +
            startDate.toLocaleString("es-PE", {
                timeZone: "America/Lima",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });

        // CREAR LOS SEIS HORIZONTES
        FLOOD_HORIZONS.forEach(hour => {

            const targetDate = new Date(
                startDate.getTime() + hour * 3600000
            );

            // SIEMPRE CAUDAL PRONOSTICADO DE EL TIGRE
            const caudal = getFloodFlowAtHour(
                rows,
                targetDate
            );

            const card = document.createElement("article");
            card.className = "flood-card";

            const header = document.createElement("div");
            header.className = "flood-card-header";

            const heading = document.createElement("strong");
            heading.textContent = "+" + hour + " horas";

            const value = document.createElement("span");

            value.textContent =
                caudal === null
                    ? "Sin dato de El Tigre"
                    : "Q El Tigre = " + caudal.toFixed(2) + " m³/s";

            header.appendChild(heading);
            header.appendChild(value);

            const mapDiv = document.createElement("div");
            mapDiv.className = "flood-map";
            mapDiv.id = "flood-map-" + hour;

            card.appendChild(header);
            card.appendChild(mapDiv);

            grid.appendChild(card);

            if (caudal === null) {

                mapDiv.innerHTML =
                    '<div class="flood-error">' +
                    'No existe caudal de El Tigre para este horizonte.' +
                    '</div>';

                return;
            }

            // SELECCIONAR PNG SEGUN EL CAUDAL DE EL TIGRE
            const selected = getFloodImage(
                caudal,
                data.images
            );

            if (!selected) {

                mapDiv.innerHTML =
                    '<div class="flood-error">' +
                    'No se encontró un PNG para este caudal.' +
                    '</div>';

                return;
            }

            if (
                !Array.isArray(selected.bounds) ||
                selected.bounds.length !== 2
            ) {

                mapDiv.innerHTML =
                    '<div class="flood-error">' +
                    'La imagen no tiene límites geográficos.' +
                    '</div>';

                return;
            }

            if (typeof L === "undefined") {

                mapDiv.innerHTML =
                    '<div class="flood-error">' +
                    'Leaflet no está cargado.' +
                    '</div>';

                return;
            }

            // CREAR MAPA
            const map = L.map(mapDiv, {
                zoomControl: true,
                attributionControl: true,
                scrollWheelZoom: false
            });

            const bounds = L.latLngBounds(
                selected.bounds[0],
                selected.bounds[1]
            );

            // GOOGLE SATELLITE PREDETERMINADO
            // GOOGLE MAPS COMO ALTERNATIVA
            addFloodBaseLayers(map, bounds);

            // MANCHA PNG
            L.imageOverlay(
                FLOOD_FOLDER + selected.image,
                bounds,
                {
                    opacity: 0.85,
                    interactive: false
                }
            ).addTo(map);

            window.FLOOD_MAPS.push(map);

            // NO SE CREA mapInfo:
            // SE ELIMINA REFERENCIA, PNG Y UMBRAL DE LAS TARJETAS.

        });

        // AJUSTAR DIMENSIONES DE LOS SEIS MAPAS
        setTimeout(() => {

            window.FLOOD_MAPS.forEach(map => {
                map.invalidateSize();
            });

        }, 300);

    } catch (error) {

        console.error(
            "Error al mostrar mapas de inundación:",
            error
        );

        const label = document.getElementById("scenario-label");

        if (label) {
            label.textContent = error.message;
        }

    }

};

