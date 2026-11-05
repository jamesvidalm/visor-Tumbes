
/* ============================================================
   MAPAS DE INUNDACION - CUENCA DEL RIO TUMBES

   - Seis horizontes: +12, +24, +36, +48, +60 y +72 horas.
   - Seleccion automatica de PNG segun caudal pronosticado.
   - Imagenes georreferenciadas mediante manifest.json.
   - Fondo predeterminado: GOOGLE SATELLITE.
   - Alternativa: GOOGLE MAPS (calles).
   - Selector de fondo en cada mapa.
   - Seis mapas en una sola fila horizontal.
   ============================================================ */

window.FLOOD_MANIFEST = null;
window.FLOOD_MAPS = window.FLOOD_MAPS || [];

const FLOOD_FOLDER = "data/inundaciones/";
const FLOOD_HORIZONS = [12, 24, 36, 48, 60, 72];


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
   3. IDENTIFICAR COLUMNA DE CAUDAL PRONOSTICADO
   ============================================================ */

function getFloodForecastColumn(item) {

    if (Array.isArray(item.columnas)) {

        const forecastColumn = item.columnas.find(
            column => String(column).endsWith("_P")
        );

        if (forecastColumn) {
            return forecastColumn;
        }
    }

    if (item.columna) {
        return item.columna;
    }

    return null;
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
   5. SELECCIONAR PNG SEGUN EL CAUDAL
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
   7. BUSCAR CAUDAL EN CADA HORIZONTE
   ============================================================ */

function getFloodFlowAtHour(rows, column, targetDate) {

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

    return getFloodNumber(bestRow[column]);
}


/* ============================================================
   8. CREAR PANEL DE MAPAS
   ============================================================ */

function createFloodPanel() {

    let section = document.getElementById("flood-section");

    if (section) {
        return section;
    }

    const hydroChart = document.getElementById("hydro-chart");

    if (!hydroChart) {
        throw new Error("No se encontró hydro-chart en index.html.");
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
                    Manchas de inundación pronosticadas
                </h3>
            </div>

            <span class="unit">HORIZONTES · HORAS</span>
        </div>

        <div id="scenario-label" class="subinfo">
            Selecciona una estación o quebrada en el mapa.
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
            justify-content: center;
            align-items: flex-start;
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

        .flood-map-info {
            padding: 8px;
            font-size: 11px;
            color: #a9bad0;
            border-top: 1px solid #26354b;
        }

        .flood-map .leaflet-control-layers {
            font-size: 11px;
        }

        @media (max-width: 1100px) {

            #flood-grid {
                overflow-x: auto;
                grid-template-columns: repeat(6, 220px);
            }

        }
    `;

    document.head.appendChild(style);

    return section;
}


/* ============================================================
   9. LIMPIAR MAPAS ANTERIORES
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
   10. CREAR FONDOS GOOGLE Y SELECTOR
   ============================================================ */

function addFloodBaseLayers(map, bounds) {

    // GOOGLE SATELLITE: fondo predeterminado.
    const googleSatellite = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    // GOOGLE MAPS: calles, nombres y carreteras.
    const googleMaps = L.tileLayer(
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        {
            maxZoom: 20,
            attribution: "© Google"
        }
    );

    // Satellite se carga por defecto.
    googleSatellite.addTo(map);

    // Selector de mapas base.
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
   11. MOSTRAR LOS SEIS MAPAS
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
            "Manchas de inundación – " + item.nombre;

        const column = getFloodForecastColumn(item);

        if (!column) {

            label.textContent =
                "No se encontró la columna de caudal pronosticado.";

            return;
        }

        const data = await window.loadFloodManifest();

        const startDate = getFloodStartDate();

        label.textContent =
            item.nombre +
            " · Caudal pronosticado · Inicio: " +
            startDate.toLocaleString("es-PE", {
                timeZone: "America/Lima",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });

        FLOOD_HORIZONS.forEach(hour => {

            const targetDate = new Date(
                startDate.getTime() + hour * 3600000
            );

            const caudal = getFloodFlowAtHour(
                rows,
                column,
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
                    ? "Sin dato"
                    : "Q = " + caudal.toFixed(2) + " m³/s";

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
                    'No existe caudal pronosticado para este horizonte.' +
                    '</div>';

                return;
            }

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

            // Crear mapa.
            const map = L.map(mapDiv, {
                zoomControl: true,
                attributionControl: true,
                scrollWheelZoom: false
            });

            // Límites geográficos.
            const bounds = L.latLngBounds(
                selected.bounds[0],
                selected.bounds[1]
            );

            // Agregar fondos y selector.
            // Google Satellite queda seleccionado por defecto.
            addFloodBaseLayers(map, bounds);

            // Superponer la mancha de inundación PNG.
            // Esta capa permanece visible al cambiar el fondo.
            L.imageOverlay(
                FLOOD_FOLDER + selected.image,
                bounds,
                {
                    opacity: 0.85,
                    interactive: false
                }
            ).addTo(map);

            window.FLOOD_MAPS.push(map);

            const mapInfo = document.createElement("div");
            mapInfo.className = "flood-map-info";

            mapInfo.textContent =
                "Imagen: " +
                selected.id.toUpperCase() +
                " · Umbral: " +
                selected.threshold +
                " m³/s";

            card.appendChild(mapInfo);

        });

        // Actualizar dimensiones.
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
