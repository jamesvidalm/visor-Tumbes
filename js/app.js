
// ============================================================
// APP.JS - DASHBOARD HIDROLOGICO CUENCA DEL RIO TUMBES
// ============================================================
// - Carga Excel de caudales.
// - Carga Excel de ubicaciones.
// - Inicializa estaciones.
// - Carga las 10 quebradas.
// - Carga precipitacion GFS desde JSON.
// - Mantiene los hidrogramas existentes.
// ============================================================


// ============================================================
// 1. CARGAR ARCHIVOS EXCEL
// ============================================================

async function loadWorkbook(path, sheetName) {

    const res = await fetch(path);

    if (!res.ok) {
        throw new Error(
            "No se pudo cargar " + path +
            " (HTTP " + res.status + ")."
        );
    }

    const wb = XLSX.read(await res.arrayBuffer(), {
        type: "array",
        cellDates: true
    });

    const sheet =
        wb.Sheets[sheetName] ||
        wb.Sheets[wb.SheetNames[0]];

    if (!sheet) {
        throw new Error(
            "No se encontro la hoja: " + sheetName
        );
    }

    return XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: true
    });

}


// ============================================================
// 2. ACTUALIZAR TEXTOS
// ============================================================

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}


// ============================================================
// 3. NORMALIZAR NOMBRES
// ============================================================

function normalizeName(value) {

    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();

}


// ============================================================
// 4. INICIAR DASHBOARD
// ============================================================

async function startDashboard() {

    try {

        console.log("==================================");
        console.log("INICIANDO DASHBOARD TUMBES");
        console.log("==================================");

        // ----------------------------------------------------
        // 4.1 VERIFICAR CONFIGURACION
        // ----------------------------------------------------

        if (!window.CONFIG) {
            throw new Error(
                "No se encontro CONFIG. Verifica config.js."
            );
        }

        if (!Array.isArray(CONFIG.puntos)) {
            throw new Error(
                "CONFIG.puntos no esta correctamente definido."
            );
        }

        if (!Array.isArray(CONFIG.quebradas)) {
            throw new Error(
                "CONFIG.quebradas no esta correctamente definido."
            );
        }

        // ----------------------------------------------------
        // 4.2 CARGAR EXCEL
        // ----------------------------------------------------

        console.log("Cargando archivos Excel...");

        const [flows, locations] = await Promise.all([

            loadWorkbook(
                CONFIG.caudalesFile,
                CONFIG.hojaCaudales
            ),

            loadWorkbook(
                CONFIG.ubicacionesFile,
                CONFIG.hojaUbicaciones
            )

        ]);

        if (!flows.length) {
            throw new Error(
                "El Excel de caudales no contiene registros."
            );
        }

        if (!locations.length) {
            throw new Error(
                "El Excel de ubicaciones no contiene registros."
            );
        }

        // ----------------------------------------------------
        // 4.3 VERIFICAR COLUMNAS
        // ----------------------------------------------------

        const headers = Object.keys(flows[0]);

        const required = [

            "fecha",

            "Q_TIGRE",
            "Q_TIGRE_P",

            "Q_CABOINGA",
            "Q_CABOINGA_P",

            "QD_HIGUERON",
            "QD_CABUYAL",
            "QD_VAQUERIA",
            "QD_CEIBAL",
            "QD_ELTIGRE",
            "QD_JARDINA",
            "QD_CABEZADETORO",
            "QD_CORRALES",
            "QD_CAZADEROS",
            "QD_OZUMARES"

        ];

        const missing = required.filter(
            column => !headers.includes(column)
        );

        if (missing.length) {
            throw new Error(
                "Faltan columnas en el Excel: " +
                missing.join(", ")
            );
        }

        console.log("Columnas verificadas.");

        // ----------------------------------------------------
        // 4.4 COORDENADAS DE ESTACIONES
        // ----------------------------------------------------

        const points = CONFIG.puntos.map(p => {

            const row = locations.find(
                r =>
                    normalizeName(r.ID) ===
                    normalizeName(p.id)
            );

            if (!row) {
                throw new Error(
                    "No se encontro " + p.id +
                    " en ubicacion.xlsx."
                );
            }

            const lat = Number(row.Lat);
            const lon = Number(row.Long);

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon)
            ) {
                throw new Error(
                    "Coordenadas invalidas para " + p.id
                );
            }

            return {
                ...p,
                lat,
                lon
            };

        });

        // ----------------------------------------------------
        // 4.5 SELECCIONAR ESTACION O QUEBRADA
        // ----------------------------------------------------

        const select = item => {

            console.log(
                "Elemento seleccionado:",
                item.nombre || item.id
            );

            renderHydrograph(item, flows);

        };

        // ----------------------------------------------------
        // 4.6 INICIALIZAR MAPA
        // ----------------------------------------------------

        console.log("Inicializando mapa...");

        if (typeof window.initMap !== "function") {
            throw new Error(
                "No existe initMap(). Verifica js/mapa.js."
            );
        }

        const map = window.initMap(points, select);

        if (!map) {
            throw new Error(
                "No se pudo inicializar el mapa."
            );
        }

        // ----------------------------------------------------
        // 4.7 CARGAR QUEBRADAS
        // ----------------------------------------------------

        console.log("Cargando quebradas...");

        if (typeof window.addPolygons === "function") {

            await window.addPolygons(map, select);

        } else {

            console.warn(
                "No se encontro addPolygons()."
            );

        }

        // ----------------------------------------------------
        // 4.8 CARGAR PRONOSTICO GFS JSON
        // ----------------------------------------------------

        console.log("Cargando pronostico GFS...");

        try {

            await window.loadGFS();

            setText(
                "data-status",
                "GFS: " +
                window.datosGFS.points.length +
                " puntos | " +
                window.datosGFS.time.length +
                " horas"
            );

        } catch (gfsError) {

            console.error(
                "Error de lectura GFS:",
                gfsError
            );

            setText(
                "data-status",
                "Error al cargar precipitacion GFS"
            );

        }

        // ----------------------------------------------------
        // 4.9 RESUMEN
        // ----------------------------------------------------

        console.log("==================================");
        console.log("DASHBOARD CARGADO");
        console.log("==================================");

        console.log(
            "Registros hidrologicos:",
            flows.length
        );

        console.log(
            "Estaciones:",
            points.length
        );

        console.log(
            "Quebradas:",
            CONFIG.quebradas.length
        );

        console.log(
            "Archivo GFS:",
            CONFIG.gfsFile
        );

        console.log("==================================");

    } catch (err) {

        console.error(
            "ERROR AL INICIAR DASHBOARD:",
            err
        );

        setText(
            "hydro-subtitle",
            "Error: " + err.message
        );

        setText(
            "data-status",
            "Error de lectura hidrologica"
        );

    }

}


// ============================================================
// 5. EJECUTAR DASHBOARD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    startDashboard
);

