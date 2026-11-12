
/* =====================================================
   LECTURA DE ARCHIVOS EXCEL
===================================================== */

async function loadWorkbook(path, sheetName) {

    const res = await fetch(path);

    if (!res.ok) {
        throw new Error(
            "No se pudo cargar " + path +
            " (HTTP " + res.status + ")."
        );
    }

    const wb = XLSX.read(
        await res.arrayBuffer(),
        {
            type: "array",
            cellDates: true
        }
    );

    const sheet =
        wb.Sheets[sheetName] ||
        wb.Sheets[wb.SheetNames[0]];

    return XLSX.utils.sheet_to_json(
        sheet,
        {
            defval: null,
            raw: true
        }
    );
}


/* =====================================================
   NORMALIZACIÓN DE NOMBRES
===================================================== */

function normalizeName(value) {

    return String(value || "")

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "")

        .toUpperCase()

        .trim();
}


/* =====================================================
   ESTADO DEL DASHBOARD
===================================================== */

function updateDataStatus(message, error = false) {

    const element = document.getElementById("data-status");

    if (!element) return;

    element.textContent = message;

    element.style.color = error
        ? "#f87171"
        : "#71839d";
}


/* =====================================================
   SELECCIÓN DE UBICACIÓN
===================================================== */

function selectHydrograph(item, flows) {

    if (!item) return;

    console.log(
        "Ubicación seleccionada:",
        item
    );

    /*
       Actualizar el hidrograma según la estación
       o quebrada seleccionada en el mapa.
    */

    renderHydrograph(item, flows);

}


/* =====================================================
   IDENTIFICAR EL PUNTO EL TIGRE
===================================================== */

function findElTigre(points) {

    return points.find(point => {

        const values = Object.values(point);

        return values.some(value => {

            if (typeof value !== "string") {
                return false;
            }

            return normalizeName(value).includes("TIGRE");

        });

    });

}


/* =====================================================
   INICIALIZACIÓN DEL DASHBOARD
===================================================== */

async function startDashboard() {

    updateDataStatus("Cargando información...");

    try {

        /* ---------------------------------------------
           1. CARGAR EXCEL
        --------------------------------------------- */

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


        /* ---------------------------------------------
           2. VALIDAR COLUMNAS
        --------------------------------------------- */

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
            "QD_CORRALES"

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


        /* ---------------------------------------------
           3. OBTENER COORDENADAS
        --------------------------------------------- */

        const points = CONFIG.puntos.map(point => {

            const row = locations.find(

                r => normalizeName(r.ID) ===
                     normalizeName(point.id)

            );

            if (!row) {

                throw new Error(
                    "No se encontró " +
                    point.id +
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
                    point.id
                );

            }

            return {

                ...point,

                lat,

                lon

            };

        });


        /* ---------------------------------------------
           4. FUNCIÓN DE SELECCIÓN
        --------------------------------------------- */

        const select = item => {

            selectHydrograph(item, flows);

        };


        /* ---------------------------------------------
           5. INICIALIZAR MAPA
        --------------------------------------------- */

        const map = initMap(

            points,

            select

        );


        /* ---------------------------------------------
           6. AGREGAR POLÍGONOS DE QUEBRADAS
        --------------------------------------------- */

        await addPolygons(

            map,

            select

        );


        /* ---------------------------------------------
           7. SELECCIONAR EL TIGRE POR DEFECTO
        --------------------------------------------- */

        const elTigre = findElTigre(points);

        if (!elTigre) {

            throw new Error(
                "No se encontró la estación El Tigre " +
                "en CONFIG.puntos. Revisa su identificador " +
                "o nombre en js/config.js."
            );

        }

        // Cargar automáticamente el hidrograma de El Tigre.

        select(elTigre);


        /* ---------------------------------------------
           8. ESTADO FINAL
        --------------------------------------------- */

        updateDataStatus(

            `${flows.length} registros horarios · ${points.length} estaciones`

        );


        console.log(
            "Dashboard cargado correctamente."
        );

        console.log(
            "Estación inicial:",
            elTigre
        );


    } catch (err) {

        console.error(
            "Error al iniciar el dashboard:",
            err
        );

        updateDataStatus(
            "Error de lectura",
            true
        );

        const subtitle = document.getElementById(
            "hydro-subtitle"
        );

        if (subtitle) {
            subtitle.textContent = err.message;
        }

    }

}


/* =====================================================
   INICIO AUTOMÁTICO
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    startDashboard
);
