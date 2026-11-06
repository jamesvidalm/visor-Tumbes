

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
        throw new Error("No se encontró la hoja: " + sheetName);
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
// 3. INICIALIZAR DASHBOARD
// ============================================================

async function startDashboard() {

    try {

        console.log("Iniciando dashboard...");


        // ----------------------------------------------------
        // 3.1 CARGAR DATOS
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // 3.2 VERIFICAR COLUMNAS
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
            "QD_CORRALES"
        ];

        const missing = required.filter(
            c => !headers.includes(c)
        );

        if (missing.length) {

            throw new Error(
                "Faltan columnas en el Excel: " +
                missing.join(", ")
            );

        }


        // ----------------------------------------------------
        // 3.3 NORMALIZAR NOMBRES
        // ----------------------------------------------------

        const norm = s =>
            String(s || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();


        // ----------------------------------------------------
        // 3.4 OBTENER COORDENADAS DE ESTACIONES
        // ----------------------------------------------------

        const points = CONFIG.puntos.map(p => {

            const row = locations.find(
                r => norm(r.ID) === norm(p.id)
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
        // 3.5 FUNCIÓN PARA SELECCIONAR ESTACIONES
        // ----------------------------------------------------

        const select = item => {

            renderHydrograph(item, flows);

        };


        // ----------------------------------------------------
        // 3.6 INICIALIZAR MAPA
        // ----------------------------------------------------

        const map = initMap(points, select);


        // ----------------------------------------------------
        // 3.7 CARGAR POLÍGONOS DE QUEBRADAS
        // ----------------------------------------------------

        await addPolygons(map, select);


        // ----------------------------------------------------
        // 3.8 FINALIZAR
        // ----------------------------------------------------

        console.log("==================================");
        console.log("DASHBOARD CARGADO CORRECTAMENTE");
        console.log("Registros horarios:", flows.length);
        console.log("Estaciones:", points.length);
        console.log("Polígonos:", CONFIG.quebradas.length);
        console.log("Inicio del pronóstico:", CONFIG.inicioPronostico);
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

    }

}


// ============================================================
// 4. EJECUTAR CUANDO SE CARGUE EL HTML
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    startDashboard
);

