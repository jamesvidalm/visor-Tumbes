
/* ============================================================
   MAPAS DE INUNDACION - CUENCA DEL RIO TUMBES

   - Referencia hidrologica fija: Q_TIGRE_P.
   - Seis horizontes: +12, +24, +36, +48, +60 y +72 horas.
   - Seleccion automatica de PNG segun caudal de El Tigre.
   - Imagenes georreferenciadas mediante manifest.json.
   - Google Satellite predeterminado.
   - Alternativa Google Maps.
   - LEYENDA DISCRETA DENTRO DE CADA MAPA.
   - 10 intervalos de profundidad en metros.
   - Sin textos PNG, Referencia ni Umbral en las tarjetas.
   ============================================================ */

window.FLOOD_MANIFEST = null;
window.FLOOD_MAPS = window.FLOOD_MAPS || [];

const FLOOD_FOLDER = "data/inundaciones/";
const FLOOD_HORIZONS = [12, 24, 36, 48, 60, 72];
const FLOOD_REFERENCE_STATION = "Q_TIGRE_P";

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

const FLOOD_DEFAULT_BREAKS = [
    0.0010420680046081543,
    0.7003133952617645,
    1.3995847225189209,
    2.098856049776077,
    2.7981273770332336,
    3.49739870429039,
    4.196670031547546,
    4.895941358804703,
    5.595212686061859,
    6.294484013319015,
    6.993755340576172
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
   3. CARGAR INTERVALOS DE PROFUNDIDAD
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
            "Se utilizaran los intervalos predeterminados:",
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

    const target = caudal <= minimum
        ? minimum
        : Math.floor(caudal / 25) * 25;

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

    if (
        !bestRow ||
        minDifference > 30 * 60 * 1000
    ) {
        return null;
    }

    return getFloodNumber(
        bestRow[FLOOD_REFERENCE_STATION]
    );
}


/* ============================================================
   8. LEYENDA DENTRO DEL MAPA LEAFLET

   Cada mapa tendrá su propio control de leyenda.
   Posición: esquina inferior derecha.
   ============================================================ */

function addFloodLegend(map, breaks) {

    const legend = L.control({
        position: "bottomright"
    });

    legend.onAdd = function () {

        const div = L.DomUtil.create(
            "div",
            "flood-map-legend"
        );

        let html = `
            <div class="flood-map-legend-title">
                Profundidad (m)
            </div>
            <div class="flood-map-legend-content">
        `;

        for (let i = 0; i < 10; i++) {

            const lower = Number(breaks[i]);
            const upper = Number(breaks[i + 1]);

            html += `
                <div class="flood-map-legend-row">
                    <span
                        class="flood-map-legend-color"
                        style="background:${FLOOD_COLORS[i]}"
                    ></span>

                    <span>
                        ${lower.toFixed(2)} – ${upper.toFixed(2)}
                    </span>
                </div>
            `;
        }

        html += `
            </div>
        `;

        div.innerHTML = html;

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        return div;
    };

    legend.addTo(map);

    return legend;
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
            align-items: start;
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
            position: relative;
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

        /* LEYENDA SUPERPUESTA DENTRO DE CADA MAPA */

        .flood-map-legend {
            background: rgba(255,255,255,0.96);
            color: #172033;
            border: 1px solid #9ca3af;
            border-radius: 6px;
            padding: 8px 9px;
            box-shadow: 0 1px 7px rgba(0,0,0,0.30);
            font-family: Arial, sans-serif;
            width: 145px;
            max-height: 230px;
            overflow-y: auto;
        }

        .flood-map-legend-title {
            font-size: 11px;
            font-weight: 800;
            text-align: center;
            padding-bottom: 6px;
            margin-bottom: 5px;
            border-bottom: 1px solid #d1d5db;
        }

        .flood-map-legend-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .flood-map-legend-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 9px;
            line-height: 1.2;
            white-space: nowrap;
        }

        .flood-map-legend-color {
            display: inline-block;
            width: 17px;
            height: 12px;
            flex: 0 0 17px;
            border: 1px solid rgba(0,0,0,0.25);
            border-radius: 1px;
        }

        .flood-map .leaflet-control {
            margin: 7px;
        }

        .flood-map .leaflet-control-attribution {
            font-size: 8px;
        }

        @media (max-width: 1100px) {

            #flood-grid {
                overflow-x: auto;
                grid-template-columns: repeat(6, 220px);
            }
        }

        @media (max-width: 600px) {

            #flood-grid {
                grid-template-columns: repeat(6, 220px);
            }

            .flood-map-legend {
                width: 135px;
                padding: 7px;
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

    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    const googleMaps = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    googleSatellite.addTo(map);

    const baseMaps = {
        "Google Satellite": googleSatellite,
        "Google Maps": googleMaps
    };

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

        title.textContent =
            "Escenarios de inundación - Estación El Tigre";

        // CARGAR INTERVALOS DE PROFUNDIDAD
        const breaks = await loadFloodBreaks();

        // COMPROBAR PRONOSTICO DE EL TIGRE
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

        // CARGAR MANIFEST
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

            const caudal = getFloodFlowAtHour(
                rows,
                targetDate
            );

            // TARJETA
            const card = document.createElement("article");

            card.className = "flood-card";

            // ENCABEZADO
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

            // CONTENEDOR DEL MAPA
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

            // SELECCIONAR PNG SEGUN CAUDAL
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

            // FONDOS GOOGLE
            addFloodBaseLayers(map, bounds);

            // MANCHA DE INUNDACION
            L.imageOverlay(
                FLOOD_FOLDER + selected.image,
                bounds,
                {
                    opacity: 0.85,
                    interactive: false
                }
            ).addTo(map);

            // LEYENDA DENTRO DEL MAPA
            addFloodLegend(map, breaks);

            window.FLOOD_MAPS.push(map);

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

