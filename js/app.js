
// ============================================================
// APP.JS - DASHBOARD HIDROLOGICO CUENCA DEL RIO TUMBES
// ============================================================
// - Carga Excel de caudales.
// - Carga Excel de ubicaciones.
// - Verifica las columnas necesarias.
// - Inicializa estaciones El Tigre y Cabo Inga.
// - Carga las 10 quebradas mediante CONFIG.quebradas.
// - Permite actualizar el hidrograma al seleccionar elementos.
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
            "No se encontró la hoja: " + sheetName
        );
    }

    return XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: true
    });
}


// ============================================================
// 2. ACTUALIZAR ELEMENTOS HTML DE FORMA SEGURA
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
// 4. INICIALIZAR DASHBOARD
// ============================================================

async function startDashboard() {

    try {

        console.log("==================================");
        console.log("INICIANDO DASHBOARD TUMBES");
        console.log("==================================");


        // ----------------------------------------------------
        // 4.1 VERIFICAR CONFIGURACIÓN
        // ----------------------------------------------------

        if (!window.CONFIG) {
            throw new Error(
                "No se encontró window.CONFIG. Verifica js/data.js."
            );
        }

        if (!Array.isArray(CONFIG.puntos)) {
            throw new Error(
                "CONFIG.puntos no está correctamente definido."
            );
        }

        if (!Array.isArray(CONFIG.quebradas)) {
            throw new Error(
                "CONFIG.quebradas no está correctamente definido."
            );
        }


        // ----------------------------------------------------
        // 4.2 CARGAR DATOS EXCEL
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
        // 4.3 VERIFICAR COLUMNAS DEL EXCEL
        // ----------------------------------------------------

        const headers = Object.keys(flows[0]);

        const required = [

            // Estaciones principales
            "fecha",
            "Q_TIGRE",
            "Q_TIGRE_P",
            "Q_CABOINGA",
            "Q_CABOINGA_P",

            // Quebradas existentes
            "QD_HIGUERON",
            "QD_CABUYAL",
            "QD_VAQUERIA",
            "QD_CEIBAL",
            "QD_ELTIGRE",
            "QD_JARDINA",
            "QD_CABEZADETORO",
            "QD_CORRALES",

            // NUEVAS QUEBRADAS
            "QD_CAZADEROS",
            "QD_OZUMARES"

        ];


        const missing = required.filter(
            column => !headers.includes(column)
        );


        if (missing.length) {

            throw new Error(
                "Faltan columnas en el Excel de caudales: " +
                missing.join(", ")
            );

        }


        console.log("Columnas del Excel verificadas.");


        // ----------------------------------------------------
        // 4.4 OBTENER COORDENADAS DE ESTACIONES
        // ----------------------------------------------------

        const points = CONFIG.puntos.map(p => {

            const row = locations.find(
                r =>
                    normalizeName(r.ID) ===
                    normalizeName(p.id)
            );


            if (!row) {

                throw new Error(
                    "No se encontró " + p.id +
                    " en ubicacion.xlsx (columna ID)."
                );

            }


            const lat = Number(row.Lat);
            const lon = Number(row.Long);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon)
            ) {

                throw new Error(
                    "Coordenadas inválidas para " +
                    p.id + "."
                );

            }


            return {
                ...p,
                lat,
                lon
            };

        });


        // ----------------------------------------------------
        // 4.5 FUNCIÓN PARA SELECCIONAR ESTACIONES Y QUEBRADAS
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

        const map = initMap(points, select);


        if (!map) {
            throw new Error(
                "No se pudo inicializar el mapa."
            );
        }


        // ----------------------------------------------------
        // 4.7 CARGAR LOS POLÍGONOS DE LAS 10 QUEBRADAS
        // ----------------------------------------------------

        console.log("Cargando quebradas...");

        console.log(
            "Número de quebradas configuradas:",
            CONFIG.quebradas.length
        );


        await addPolygons(map, select);


        // ----------------------------------------------------
        // 4.8 INFORMACIÓN FINAL
        // ----------------------------------------------------

        console.log("");
        console.log("==================================");
        console.log("DASHBOARD CARGADO CORRECTAMENTE");
        console.log("==================================");

        console.log(
            "Registros horarios:",
            flows.length
        );

        console.log(
            "Estaciones:",
            points.length
        );

        console.log(
            "Quebradas configuradas:",
            CONFIG.quebradas.length
        );

        CONFIG.quebradas.forEach((q, index) => {

            console.log(
                (index + 1) + ". " +
                q.nombre +
                " | " +
                q.columna +
                " | " +
                q.archivo
            );

        });

        console.log(
            "Inicio del pronóstico:",
            CONFIG.inicioPronostico
        );

        console.log("==================================");


    } catch (err) {

        console.error(
            "ERROR AL INICIAR EL DASHBOARD:",
            err
        );

        setText(
            "hydro-subtitle",
            "Error: " + err.message
        );

        setText(
            "data-status",
            "Error de lectura"
        );

    }

}


// ============================================================
// 5. EJECUTAR CUANDO SE CARGUE EL HTML
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    startDashboard
);

