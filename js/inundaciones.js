
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
   - Seis mapas en una sola fila.
   ============================================================ */

window.FLOOD_MANIFEST = null;
window.FLOOD_MAPS = window.FLOOD_MAPS || [];

const FLOOD_FOLDER = "data/inundaciones/";
const FLOOD_HORIZONS = [12, 24, 36, 48, 60, 72];

// REFERENCIA FIJA PARA LAS MANCHAS DE INUNDACION
const FLOOD_REFERENCE_STATION = "Q_TIGRE_P";


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
   3. OBTENER CAUDAL NUMERICO
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
   4. SELECCIONAR PNG SEGUN CAUDAL DE EL TIGRE
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
   5. FECHA Y HORA DE INICIO DEL PRONOSTICO
   ============================================================ */

function getFloodStartDate() {

    const value =
        CONFIG.inicioPronostico ||
        "2026-11-05T02:00:00-05:00";

    return new Date(value);
}


/* ============================================================
   6. BUSCAR CAUDAL DE EL TIGRE EN CADA HORIZONTE
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
   7. CREAR PANEL DE MAPAS DE INUNDACION
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

    if (!document.getElementById("flood-map-styles")) {
        document.head.appendChild(style);
    }

    return section;
}


/* ============================================================
   8. LIMPIAR MAPAS ANTERIORES
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
   9. FONDOS GOOGLE Y SELECTOR
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
   10. MOSTRAR LOS SEIS MAPAS
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
            " · Columna: Q_TIGRE_P" +
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

            // MANCHA PNG: NO CAMBIA AL SELECCIONAR OTRA UBICACION
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
                "Referencia: El Tigre" +
                " · PNG: " + selected.id.toUpperCase() +
                " · Umbral: " + selected.threshold + " m³/s";

            card.appendChild(mapInfo);

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
