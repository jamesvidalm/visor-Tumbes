
async function loadWorkbook(path, sheetName) {
    const res = await fetch(path);

    if (!res.ok) {
        throw new Error(
            "No se pudo cargar " + path + " (HTTP " + res.status + ")."
        );
    }

    const wb = XLSX.read(await res.arrayBuffer(), {
        type: "array",
        cellDates: true
    });

    const sheet = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];

    return XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: true
    });
}

// Actualizar elementos HTML de forma segura
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    } else {
        console.warn(`No se encontró el elemento HTML: #${id}`);
    }
}

async function startDashboard() {

    try {

        const [flows, locations] = await Promise.all([
            loadWorkbook(CONFIG.caudalesFile, CONFIG.hojaCaudales),
            loadWorkbook(CONFIG.ubicacionesFile, CONFIG.hojaUbicaciones)
        ]);

        if (!flows.length) {
            throw new Error("El Excel de caudales no contiene registros.");
        }

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

        const missing = required.filter(c => !headers.includes(c));

        if (missing.length) {
            throw new Error(
                "Faltan columnas en el Excel: " + missing.join(", ")
            );
        }

        // Normalizar nombres
        const norm = s =>
            String(s || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();

        // Coordenadas de estaciones
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

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                throw new Error(
                    "Coordenadas inválidas para " + p.id + "."
                );
            }

            return {
                ...p,
                lat,
                lon
            };
        });

        // Generar gráficos
        const select = item => renderHydrograph(item, flows);

        // Inicializar mapa
        const map = initMap(points, select);

        // Cargar polígonos
        await addPolygons(map, select);

        // Estado del dashboard
        setText(
            "data-status",
            `${flows.length} registros horarios · ${points.length} puntos`
        );

        console.log("Dashboard cargado correctamente.");

    } catch (err) {

        console.error("Error al iniciar el dashboard:", err);

        setText("data-status", "Error de lectura");
        setText("hydro-subtitle", err.message);

    }
}

document.addEventListener("DOMContentLoaded", startDashboard);
