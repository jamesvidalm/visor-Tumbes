// ============================================================
// HIDROGRAMAS - CUENCA DEL RÍO TUMBES  (versión mejorada)
// ============================================================
// - Inicio del pronóstico: CONFIG.inicioPronostico (js/config.js)
// - Estaciones: observado desde -48 h, pronóstico hasta +72 h
// - Quebradas: solo pronóstico hasta +72 h
// - Banda de incertidumbre +/- 20 %
// - Umbrales: 600, 800 y 1000 m³/s
// - Limpia el texto placeholder del contenedor
// - Indica la cobertura real del pronóstico (horas disponibles)
// ============================================================

window.renderHydrograph = function (item, rows) {

    const title = document.getElementById("hydro-title");
    const subtitle = document.getElementById("hydro-subtitle");
    const chart = document.getElementById("hydro-chart");

    if (!title || !subtitle || !chart) {
        console.error("No se encontraron los elementos del hidrograma.");
        return;
    }

    // Quita mensajes de texto (placeholders) antes de dibujar.
    // Si ya hay un gráfico de Plotly, se conserva para usar react().
    function limpiarContenedor() {
        if (!chart.classList.contains("js-plotly-plot")) {
            chart.innerHTML = "";
        }
    }

    function mostrarMensaje(texto) {
        if (window.Plotly && chart.classList.contains("js-plotly-plot")) {
            Plotly.purge(chart);
        }
        chart.innerHTML = texto;
    }

    rows = Array.isArray(rows) ? rows : [];

    const nombre = String(item.nombre || item.id || "").trim();
    const nombreLower = nombre.toLowerCase();

    let columns = item.columnas || (item.columna ? [item.columna] : []);

    if (!columns.length && nombreLower.includes("cabo inga")) {
        columns = ["Q_CABOINGA", "Q_CABOINGA_P"];
    }
    if (!columns.length && nombreLower.includes("el tigre")) {
        columns = ["Q_TIGRE", "Q_TIGRE_P"];
    }

    title.textContent = nombre || "Hidrograma";

    if (!rows.length || !columns.length) {
        subtitle.textContent = "No hay datos disponibles.";
        mostrarMensaje("No existen datos para esta ubicación.");
        return;
    }

    // ========================================================
    // 1. CONFIGURACIÓN TEMPORAL
    // ========================================================

    if (!window.CONFIG || !CONFIG.inicioPronostico) {
        console.error("No se encontró CONFIG.inicioPronostico.");
        subtitle.textContent = "Configura la fecha de inicio en js/config.js.";
        mostrarMensaje("No se pudo determinar el inicio del pronóstico.");
        return;
    }

    const inicioPronostico = new Date(CONFIG.inicioPronostico);

    if (isNaN(inicioPronostico.getTime())) {
        subtitle.textContent = "La fecha de inicio configurada no es válida.";
        mostrarMensaje("Revisa CONFIG.inicioPronostico en js/config.js.");
        return;
    }

    const HORAS_ANTES = 48;
    const HORAS_PRONOSTICO = 72;
    const MS_HORA = 3600000;

    const inicioObservaciones = new Date(inicioPronostico.getTime() - HORAS_ANTES * MS_HORA);
    const finPronostico = new Date(inicioPronostico.getTime() + HORAS_PRONOSTICO * MS_HORA);

    const esCaboInga = nombreLower.includes("cabo inga");
    const esElTigre = nombreLower.includes("el tigre");
    const esEstacion = esCaboInga || esElTigre;

    const COLOR_OBSERVADO = "#38bdf8";
    const COLOR_PRONOSTICO = "#a78bfa";
    const COLOR_BANDA = "rgba(167,139,250,0.18)";
    const COLOR_TRANSPARENTE = "rgba(167,139,250,0)";

    const forecastPairs = {
        "Q_TIGRE_P": "Q_TIGRE",
        "Q_CABOINGA_P": "Q_CABOINGA"
    };

    // ========================================================
    // 2. UTILIDADES
    // ========================================================

    function getNumber(row, column) {
        const value = row[column];
        if (value === null || value === undefined || String(value).trim() === "") {
            return null;
        }
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function formatoFecha(d) {
        return d.toLocaleString("es-PE", {
            timeZone: "America/Lima",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

    const records = rows
        .map(row => ({ row: row, date: window.parseDate(row.fecha) }))
        .filter(r => r.date instanceof Date && !isNaN(r.date.getTime()))
        .sort((a, b) => a.date - b.date);

    if (!records.length) {
        subtitle.textContent = "No se encontraron fechas válidas.";
        mostrarMensaje("Revisa la columna fecha del Excel.");
        return;
    }

    const forecastRecords = records.filter(r =>
        r.date >= inicioPronostico && r.date <= finPronostico
    );

    const traces = [];
    let totalObserved = 0;
    let totalForecast = 0;
    let ultimaFechaPronostico = null;   // última fecha con pronóstico real

    // ========================================================
    // 3. CAUDAL OBSERVADO (EL TIGRE / CABO INGA)
    // ========================================================

    function agregarObservado(column) {

        const observedRecords = records.filter(r => r.date >= inicioObservaciones);
        const esCabo = column === "Q_CABOINGA";

        // Cabo Inga: se omiten vacíos. El Tigre: se conservan como null.
        const x = [];
        const y = [];

        observedRecords.forEach(r => {
            const v = getNumber(r.row, column);
            if (esCabo && v === null) return;
            x.push(r.date);
            y.push(v);
        });

        const validCount = y.filter(v => v !== null).length;

        if (!validCount) {
            console.log("Sin caudales observados de", column);
            return;
        }

        totalObserved += validCount;

        traces.push({
            x, y,
            type: "scatter",
            mode: esCabo ? "lines+markers" : "lines",
            name: "Caudal observado",
            legendgroup: "observado",
            showlegend: true,
            connectgaps: false,
            line: esCabo
                ? { color: COLOR_OBSERVADO, width: 3, shape: "spline", smoothing: 1.1 }
                : { color: COLOR_OBSERVADO, width: 2.8 },
            ...(esCabo ? { marker: { color: COLOR_OBSERVADO, size: 6 } } : {}),
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal observado: %{y:.2f} m³/s<extra></extra>"
        });
    }

    columns.forEach(column => {
        if (forecastPairs[column]) return;
        if (column !== "Q_TIGRE" && column !== "Q_CABOINGA") return;
        agregarObservado(column);
    });

    // ========================================================
    // 4. PRONÓSTICO (ESTACIONES Y QUEBRADAS)
    // ========================================================

    function agregarPronostico(column) {

        const points = forecastRecords.map(r => ({
            x: r.date,
            y: getNumber(r.row, column)
        }));

        const validos = points.filter(p => p.y !== null);

        if (!validos.length) {
            console.log("Sin datos de pronóstico:", column);
            return;
        }

        // Diagnóstico de cobertura
        const ultima = validos[validos.length - 1].x;
        if (!ultimaFechaPronostico || ultima > ultimaFechaPronostico) {
            ultimaFechaPronostico = ultima;
        }

        console.log(
            "[" + column + "] filas en ventana:", points.length,
            "| con dato:", validos.length,
            "| vacías:", points.length - validos.length,
            "| último dato:", formatoFecha(ultima)
        );

        const x = points.map(p => p.x);
        const y = points.map(p => p.y);
        const lower = points.map(p => p.y === null ? null : Math.max(0, p.y * 0.80));
        const upper = points.map(p => p.y === null ? null : p.y * 1.20);

        totalForecast += validos.length;

        // Banda inferior
        traces.push({
            x, y: lower,
            type: "scatter", mode: "lines",
            line: { color: COLOR_TRANSPARENTE, width: 0.5 },
            connectgaps: false, showlegend: false, hoverinfo: "skip"
        });

        // Banda superior con relleno
        traces.push({
            x, y: upper,
            type: "scatter", mode: "lines",
            line: { color: COLOR_TRANSPARENTE, width: 0.5 },
            fill: "tonexty", fillcolor: COLOR_BANDA,
            connectgaps: false, showlegend: false, hoverinfo: "skip"
        });

        // Línea principal
        traces.push({
            x, y,
            type: "scatter", mode: "lines",
            name: "Caudal pronosticado",
            legendgroup: "pronosticado",
            showlegend: true,
            connectgaps: false,
            line: { color: COLOR_PRONOSTICO, width: 3, dash: "solid" },
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal pronosticado: %{y:.2f} m³/s<extra></extra>"
        });
    }

    columns.forEach(column => {
        if (forecastPairs[column] || column.startsWith("QD_")) {
            agregarPronostico(column);
        }
    });

    // Cobertura real del pronóstico
    const horasCubiertas = ultimaFechaPronostico
        ? Math.round((ultimaFechaPronostico - inicioPronostico) / MS_HORA)
        : 0;

    const pronosticoIncompleto =
        ultimaFechaPronostico && horasCubiertas < HORAS_PRONOSTICO - 1;

    // Se expone para que renderFloodImages pueda usarlo
    window.hydroCoverage = {
        inicio: inicioPronostico,
        ultimaFecha: ultimaFechaPronostico,
        horasCubiertas: horasCubiertas
    };

    // ========================================================
    // 5. LÍNEA DE INICIO + ZONA SIN PRONÓSTICO
    // ========================================================

    const shapes = [
        {
            type: "line",
            xref: "x", x0: inicioPronostico, x1: inicioPronostico,
            yref: "paper", y0: 0, y1: 1,
            line: { color: "#ffffff", width: 2, dash: "dash" }
        }
    ];

    const annotations = [
        {
            xref: "x", x: inicioPronostico,
            yref: "paper", y: 1,
            text: "INICIO PRONÓSTICO<br>" + formatoFecha(inicioPronostico),
            showarrow: false,
            xanchor: "left", yanchor: "bottom", xshift: 7,
            font: { color: "#ffffff", size: 10 },
            bgcolor: "rgba(30,41,59,0.95)",
            bordercolor: "#94a3b8", borderwidth: 1, borderpad: 4
        }
    ];

    // Sombreado gris donde NO hay pronóstico dentro de las 72 h
    if (pronosticoIncompleto) {

        shapes.push({
            type: "rect",
            xref: "x", x0: ultimaFechaPronostico, x1: finPronostico,
            yref: "paper", y0: 0, y1: 1,
            fillcolor: "rgba(148,163,184,0.08)",
            line: { width: 0 },
            layer: "below"
        });

        annotations.push({
            xref: "x", x: finPronostico,
            yref: "paper", y: 0.02,
            text: "Sin pronóstico disponible<br>después de " +
                  formatoFecha(ultimaFechaPronostico),
            showarrow: false,
            xanchor: "right", yanchor: "bottom",
            font: { color: "#fca5a5", size: 10 },
            bgcolor: "rgba(10,19,34,0.85)",
            borderpad: 3
        });
    }

    // ========================================================
    // 6. UMBRALES (SOLO ESTACIONES)
    // ========================================================

    if (esEstacion) {

        const umbrales = [
            { valor: 600,  nombre: "Umbral amarillo", color: "#facc15" },
            { valor: 800,  nombre: "Umbral naranja",  color: "#f97316" },
            { valor: 1000, nombre: "Umbral rojo",     color: "#ef4444" }
        ];

        umbrales.forEach(u => {

            shapes.push({
                type: "line",
                xref: "paper", x0: 0, x1: 1,
                yref: "y", y0: u.valor, y1: u.valor,
                line: { color: u.color, width: 2, dash: "solid" }
            });

            annotations.push({
                xref: "paper", x: 1, xanchor: "right",
                yref: "y", y: u.valor,
                text: u.nombre + " (" + u.valor + " m³/s)",
                showarrow: false,
                font: { color: u.color, size: 10 },
                bgcolor: "rgba(10,19,34,0.85)",
                borderpad: 3
            });
        });
    }

    // ========================================================
    // 7. EJES
    // ========================================================

    const ejeInicio = esEstacion ? inicioObservaciones : inicioPronostico;
    let ejeFin = finPronostico;

    if (esEstacion) {
        const colObs = esCaboInga ? "Q_CABOINGA" : "Q_TIGRE";
        const posteriores = records.filter(r =>
            r.date >= inicioPronostico && getNumber(r.row, colObs) !== null
        );
        if (posteriores.length) {
            const ultima = posteriores[posteriores.length - 1].date;
            if (ultima > ejeFin) ejeFin = ultima;
        }
    }

    const allValues = traces.flatMap(t =>
        (t.y || []).filter(v => v !== null && Number.isFinite(v))
    );
    const maxData = allValues.length ? Math.max(...allValues) : 0;
    const maxY = esEstacion ? Math.max(1100, maxData * 1.05) : undefined;

    // ========================================================
    // 8. SUBTÍTULO
    // ========================================================

    let textoCobertura = " · Pronóstico: " + HORAS_PRONOSTICO + " horas";
    if (pronosticoIncompleto) {
        textoCobertura =
            " · Pronóstico disponible: " + horasCubiertas +
            " h de " + HORAS_PRONOSTICO + " h";
    }

    subtitle.textContent =
        "Observados: " + totalObserved +
        " · Pronosticados: " + totalForecast +
        textoCobertura +
        " · Unidad: m³/s";

    if (!traces.length) {
        mostrarMensaje("No existen datos válidos para esta ubicación.");
        return;
    }

    // ========================================================
    // 9. GRAFICAR
    // ========================================================

    limpiarContenedor();   // <- elimina "Selecciona El Tigre, Cabo Inga..."

    Plotly.react(
        chart,
        traces,
        {
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "#a9bad0", size: 11 },
            margin: { l: 65, r: 25, t: 65, b: 60 },

            xaxis: {
                title: "Fecha y hora",
                gridcolor: "#26354b",
                tickformat: "%d/%m %H:%M",
                range: [ejeInicio, ejeFin]
            },

            yaxis: {
                title: "Caudal (m³/s)",
                gridcolor: "#26354b",
                rangemode: "tozero",
                ...(esEstacion ? { range: [0, maxY] } : {})
            },

            shapes,
            annotations,
            hovermode: "x unified",
            legend: { orientation: "h", y: 1.15 }
        },
        { responsive: true, displaylogo: false }
    );

    // ========================================================
    // 10. MAPAS DE INUNDACIÓN
    // ========================================================

    if (window.renderFloodImages) {
        window.renderFloodImages(item, rows);
    }
};


// ============================================================
// CONVERSIÓN DE FECHAS
// ============================================================

window.parseDate = function (value) {

    if (value instanceof Date) {
        return value;
    }

    if (value === null || value === undefined || String(value).trim() === "") {
        return null;
    }

    // Fechas seriales de Excel (hora local del navegador)
    if (typeof value === "number") {

        const d = XLSX.SSF.parse_date_code(value);
        if (!d) return null;

        return new Date(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S));
    }

    // Fechas de texto
    const text = String(value).trim();
    const date = new Date(text.includes("T") ? text : text.replace(" ", "T"));

    return Number.isNaN(date.getTime()) ? null : date;
};
