/* ============================================================
   MAPAS DE INUNDACION - CUENCA DEL RIO TUMBES

   - Referencia hidrologica fija: Q_TIGRE_P.
   - Seis horizontes: +12, +24, +36, +48, +60 y +72 horas.
   - Seleccion automatica de PNG segun caudal de El Tigre.
   - Imagenes georreferenciadas mediante manifest.json.
   - Google Satellite predeterminado.
   - Alternativa Google Maps.
   - UNA SOLA LEYENDA GENERAL DE 10 INTERVALOS.
   - Leyenda debajo de los seis mapas.
   - Sin textos PNG ni Umbral en las tarjetas.
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
   3. INTERVALOS DE PROFUNDIDAD
   ============================================================ */

function loadFloodBreaks() {

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

   Se permite una tolerancia de hasta 3 horas.
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

    // Tolerancia máxima: 3 horas.
    if (
        !bestRow ||
        minDifference > 3 * 60 * 60 * 1000
    ) {
        return null;
    }

    return getFloodNumber(
        bestRow[FLOOD_REFERENCE_STATION]
    );
}


/* ============================================================
   8. CREAR UNA SOLA LEYENDA GENERAL
   ============================================================ */

function createFloodLegend(breaks) {

    const legend = document.createElement("div");

    legend.id = "flood-legend";

    legend.innerHTML = `
        <div class="flood-legend-title">
            <strong>PROFUNDIDAD DE INUNDACIÓN (m)</strong>
            <span>10 intervalos</span>
        </div>

        <div class="flood-legend-items">
            ${FLOOD_COLORS.map((color, i) => `
                <div class="flood-legend-item">
                    <span
                        class="flood-legend-color"
                        style="background:${color}"
                    ></span>

                    <span class="flood-legend-range">
                        ${Number(breaks[i]).toFixed(2)}
                        – ${Number(breaks[i + 1]).toFixed(2)} m
                    </span>
                </div>
            `).join("")}
        </div>
    `;

    return legend;
}


/* ============================================================
   9. CREAR PANEL DE MAPAS DE INUNDACION

   CORRECCION PRINCIPAL:
   El panel de inundaciones se inserta DESPUES de toda la
   cuadrícula de monitoreo (mapa + hidrograma).

   De esta manera ocupa todo el ancho disponible y no queda
   limitado a la columna del hidrograma.
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

    if (!hydroPanel) {
        throw new Error(
            "No se encontró el panel del hidrograma."
        );
    }

    // Obtener el contenedor completo de mapa + hidrograma.
    const monitoringLayout = hydroPanel.closest(".monitoring-layout");

    if (!monitoringLayout) {
        throw new Error(
            "No se encontró .monitoring-layout. Verifica index.html."
        );
    }

    section = document.createElement("section");

    section.id = "flood-section";
    section.className = "panel";

    section.innerHTML = `
        <div class="panel-head">
            <div>
                <small>02 / MAPAS DE INUNDACIÓN</small>
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

        <div id="flood-legend-container"></div>
    `;

    // INSERTAR DESPUES DE TODO EL BLOQUE DE MONITOREO.
    // NO insertar después del panel del hidrograma.
    monitoringLayout.insertAdjacentElement("afterend", section);

    // Estilos específicos de los mapas de inundación.
    let style = document.getElementById("flood-map-styles");

    if (!style) {

        style = document.createElement("style");
        style.id = "flood-map-styles";

        style.textContent = `

            /* PANEL COMPLETO DE INUNDACIONES */

            #flood-section {
                display: block;
                width: 100%;
                max-width: none;
                min-width: 0;
                margin: 20px 0;
                overflow: hidden;
                box-sizing: border-box;
            }

            /* SEIS MAPAS EN UNA SOLA FILA */

            #flood-grid {
                display: grid;
                width: 100%;
                max-width: none;
                min-width: 0;
                grid-template-columns: repeat(6, minmax(0, 1fr));
                gap: 10px;
                margin-top: 16px;
                overflow: visible;
                align-items: start;
                box-sizing: border-box;
            }

            /* TARJETAS */

            .flood-card {
                width: 100%;
                min-width: 0;
                overflow: hidden;
                border: 1px solid #26354b;
                border-radius: 10px;
                background: #111d2d;
                box-sizing: border-box;
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

            /* MAPAS LEAFLET */

            .flood-map {
                display: block;
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

            /* LEYENDA GENERAL */

            #flood-legend {
                width: 100%;
                margin-top: 18px;
                padding: 16px 18px;
                border: 1px solid #26354b;
                border-radius: 10px;
                background: #111d2d;
                box-sizing: border-box;
            }

            .flood-legend-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
            }

            .flood-legend-title strong {
                color: #e5edf7;
                font-size: 12px;
                letter-spacing: 0.6px;
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
                flex: 0 0 25px;
                width: 25px;
                height: 17px;
                border: 1px solid rgba(255,255,255,0.25);
                border-radius: 3px;
            }

            .flood-legend-range {
                color: #d7e2f0;
                font-size: 11px;
                white-space: nowrap;
            }

            /* PANTALLAS MEDIANAS */

            @media (max-width: 1100px) {

                #flood-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .flood-legend-items {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }

            /* CELULARES */

            @media (max-width: 600px) {

                #flood-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .flood-legend-items {
                    grid-template-columns: 1fr;
                }

                #flood-legend {
                    padding: 12px;
                }
            }
        `;

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

    // Google Satellite como fondo predeterminado.
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
   12. MOSTRAR LOS SEIS MAPAS Y UNA LEYENDA GENERAL
   ============================================================ */

window.renderFloodImages = async function (item, rows) {

    try {

        rows = Array.isArray(rows) ? rows : [];

        // Crear panel de inundaciones a ancho completo.
        createFloodPanel();

        const grid = document.getElementById("flood-grid");

        const label = document.getElementById("scenario-label");

        const title = document.getElementById("flood-title");

        const legendContainer = document.getElementById(
            "flood-legend-container"
        );

        // Eliminar mapas anteriores.
        clearFloodMaps();

        grid.innerHTML = "";
        legendContainer.innerHTML = "";

        title.textContent =
            "Escenarios de inundación - Estación El Tigre";

        // Intervalos de profundidad predeterminados.
        const breaks = loadFloodBreaks();

        // Comprobar pronóstico de El Tigre.
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

        // Cargar manifest.
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

        // Crear los seis horizontes.
        FLOOD_HORIZONS.forEach(hour => {

            const targetDate = new Date(
                startDate.getTime() + hour * 3600000
            );

            const caudal = getFloodFlowAtHour(
                rows,
                targetDate
            );

            // Crear tarjeta.
            const card = document.createElement("article");

            card.className = "flood-card";

            // Encabezado.
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

            // Contenedor del mapa.
            const mapDiv = document.createElement("div");

            mapDiv.className = "flood-map";
            mapDiv.id = "flood-map-" + hour;

            card.appendChild(header);
            card.appendChild(mapDiv);

            grid.appendChild(card);

            // Si no existe caudal, mostrar mensaje.
            if (caudal === null) {

                mapDiv.innerHTML =
                    '<div class="flood-error">' +
                    'No existe caudal de El Tigre para este horizonte.' +
                    '</div>';

                return;
            }

            // Seleccionar PNG según caudal.
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

            // Comprobar límites geográficos.
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

            // Comprobar Leaflet.
            if (typeof L === "undefined") {

                mapDiv.innerHTML =
                    '<div class="flood-error">' +
                    'Leaflet no está cargado.' +
                    '</div>';

                return;
            }

            // Crear mapa.
            const map = L.map(mapDiv, {
                zoomControl: true,
                attributionControl: true,
                scrollWheelZoom: false
            });

            const bounds = L.latLngBounds(
                selected.bounds[0],
                selected.bounds[1]
            );

            // Agregar fondos Google.
            addFloodBaseLayers(map, bounds);

            // Agregar mancha de inundación.
            L.imageOverlay(
                FLOOD_FOLDER + selected.image,
                bounds,
                {
                    opacity: 0.85,
                    interactive: false
                }
            ).addTo(map);

            window.FLOOD_MAPS.push(map);

        });

        // Una sola leyenda debajo de los seis mapas.
        legendContainer.appendChild(
            createFloodLegend(breaks)
        );

        // Ajustar dimensiones de los seis mapas.
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
