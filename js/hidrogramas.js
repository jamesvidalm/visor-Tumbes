
// ============================================================
// HIDROGRAMAS - CUENCA DEL RIO TUMBES
//
// INICIO FIJO DEL PRONOSTICO:
// 05 NOVIEMBRE 2026 - 02:00 HORA PERU (UTC-5)
//
// ESTACIONES:
// - Observado: desde 48 horas antes y hasta donde exista dato.
// - Pronosticado: desde la hora de inicio hasta +72 horas.
//
// QUEBRADAS:
// - Solo caudal pronosticado desde el inicio hasta +72 horas.
//
// - Banda de incertidumbre +/- 20 %
// - Linea vertical de inicio de pronostico
// - Umbrales de estaciones: 600, 800 y 1000 m3/s
// ============================================================

window.renderHydrograph = function (item, rows) {

    const title = document.getElementById("hydro-title");
    const subtitle = document.getElementById("hydro-subtitle");
    const chart = document.getElementById("hydro-chart");

    if (!title || !subtitle || !chart) {
        console.error("No se encontraron los elementos del hidrograma.");
        return;
    }

    rows = Array.isArray(rows) ? rows : [];

    const nombre = String(item.nombre || item.id || "").trim();
    const nombreLower = nombre.toLowerCase();

    let columns = item.columnas || (item.columna ? [item.columna] : []);
    let labels = item.etiquetas || columns;

    // Recuperar columnas de estaciones si no vienen en item
    if (!columns.length && nombreLower.includes("cabo inga")) {
        columns = ["Q_CABOINGA", "Q_CABOINGA_P"];
        labels = ["Caudal observado", "Caudal pronosticado"];
    }

    if (!columns.length && nombreLower.includes("el tigre")) {
        columns = ["Q_TIGRE", "Q_TIGRE_P"];
        labels = ["Caudal observado", "Caudal pronosticado"];
    }

    title.textContent = nombre || "Hidrograma";

    if (!rows.length || !columns.length) {
        subtitle.textContent = "No hay datos disponibles.";
        chart.innerHTML = "No existen datos para esta ubicación.";
        return;
    }

    // ========================================================
    // 1. CONFIGURACION TEMPORAL
    // ========================================================

    // Hora local de Peru: UTC-5
    const inicioPronostico = new Date(
        "2026-11-05T08:00:00-05:00"
    );

    const horasAntes = 48;
    const horasPronostico = 72;

    const inicioObservaciones = new Date(
        inicioPronostico.getTime() - horasAntes * 3600000
    );

    const finPronostico = new Date(
        inicioPronostico.getTime() + horasPronostico * 3600000
    );

    const esCaboInga = nombreLower.includes("cabo inga");
    const esElTigre = nombreLower.includes("el tigre");
    const esEstacion = esCaboInga || esElTigre;

    // Colores
    const COLOR_OBSERVADO = "#38bdf8";
    const COLOR_PRONOSTICO = "#a78bfa";
    const COLOR_BANDA = "rgba(167,139,250,0.18)";

    // Correspondencia de pronostico y observado
    const forecastPairs = {
        "Q_TIGRE_P": "Q_TIGRE",
        "Q_CABOINGA_P": "Q_CABOINGA"
    };

    // ========================================================
    // 2. PREPARAR Y ORDENAR LOS REGISTROS
    // ========================================================

    function getNumber(row, column) {

        const value = row[column];

        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return null;
        }

        const n = Number(value);

        return Number.isFinite(n) ? n : null;
    }

    const records = rows.map(row => ({
        row: row,
        date: window.parseDate(row.fecha)
    }))
    .filter(r =>
        r.date instanceof Date &&
        !isNaN(r.date.getTime())
    )
    .sort((a, b) => a.date - b.date);

    if (!records.length) {
        subtitle.textContent = "No se encontraron fechas válidas.";
        chart.innerHTML = "Revisa la columna fecha del Excel.";
        return;
    }

    const traces = [];

    let totalObserved = 0;
    let totalForecast = 0;

    // ========================================================
    // 3. CAUDALES OBSERVADOS: EL TIGRE Y CABO INGA
    // ========================================================

    columns.forEach(column => {

        // No dibujar pronosticos como observaciones
        if (forecastPairs[column]) return;

        // Las quebradas no tienen caudal observado
        if (column.startsWith("QD_")) return;

        if (
            column !== "Q_TIGRE" &&
            column !== "Q_CABOINGA"
        ) return;

        // Ventana observada:
        // Desde 48 horas antes del inicio y hasta donde
        // existan datos, incluyendo observaciones posteriores.
        const observedRecords = records.filter(r =>
            r.date >= inicioObservaciones
        );

        if (column === "Q_CABOINGA") {

            // Cabo Inga: mediciones puntuales.
            // Se eliminan filas vacias para unir las mediciones
            // existentes mediante una linea suavizada.
            const points = observedRecords
                .map(r => ({
                    x: r.date,
                    y: getNumber(r.row, column)
                }))
                .filter(p => p.y !== null);

            if (!points.length) {
                console.log("Sin caudales observados de Cabo Inga.");
                return;
            }

            totalObserved += points.length;

            traces.push({
                x: points.map(p => p.x),
                y: points.map(p => p.y),

                type: "scatter",
                mode: "lines+markers",

                name: "Caudal observado",
                legendgroup: "observado",
                showlegend: true,

                line: {
                    color: COLOR_OBSERVADO,
                    width: 3,
                    shape: "spline",
                    smoothing: 1.1
                },

                marker: {
                    color: COLOR_OBSERVADO,
                    size: 6
                },

                hovertemplate:
                    "%{x|%d/%m/%Y %H:%M}" +
                    "<br>Caudal observado: %{y:.2f} m³/s" +
                    "<extra></extra>"
            });

            return;
        }

        // El Tigre:
        // Conservar null para que los vacios no se conecten.
        const x = [];
        const y = [];

        observedRecords.forEach(r => {
            x.push(r.date);
            y.push(getNumber(r.row, column));
        });

        const validCount = y.filter(v => v !== null).length;

        if (!validCount) {
            console.log("Sin caudales observados de El Tigre.");
            return;
        }

        totalObserved += validCount;

        traces.push({
            x,
            y,

            type: "scatter",
            mode: "lines",

            name: "Caudal observado",
            legendgroup: "observado",
            showlegend: true,

            connectgaps: false,

            line: {
                color: COLOR_OBSERVADO,
                width: 2.8
            },

            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal observado: %{y:.2f} m³/s" +
                "<extra></extra>"
        });
    });

    // ========================================================
    // 4. PRONOSTICO DE EL TIGRE Y CABO INGA
    // ========================================================

    columns.forEach(forecastColumn => {

        const observedColumn = forecastPairs[forecastColumn];

        if (!observedColumn) return;

        // Pronosticos solamente entre:
        // 05/11/2026 02:00 y 08/11/2026 02:00
        const forecastRecords = records.filter(r =>
            r.date >= inicioPronostico &&
            r.date <= finPronostico
        );

        const points = forecastRecords.map(r => ({
            x: r.date,
            y: getNumber(r.row, forecastColumn)
        }));

        if (!points.some(p => p.y !== null)) {
            console.log(
                "Sin datos de pronostico:",
                forecastColumn
            );
            return;
        }

        const x = points.map(p => p.x);
        const y = points.map(p => p.y);

        const lower = points.map(p =>
            p.y === null ? null : Math.max(0, p.y * 0.80)
        );

        const upper = points.map(p =>
            p.y === null ? null : p.y * 1.20
        );

        totalForecast += points.filter(p => p.y !== null).length;

        // Limite inferior: no aparece en la leyenda
        traces.push({
            x,
            y: lower,

            type: "scatter",
            mode: "lines",

            line: {
                color: "rgba(167,139,250,0)",
                width: 0.5
            },

            connectgaps: false,
            showlegend: false,
            hoverinfo: "skip"
        });

        // Limite superior y sombreado: no aparece en leyenda
        traces.push({
            x,
            y: upper,

            type: "scatter",
            mode: "lines",

            line: {
                color: "rgba(167,139,250,0)",
                width: 0.5
            },

            fill: "tonexty",
            fillcolor: COLOR_BANDA,

            connectgaps: false,
            showlegend: false,
            hoverinfo: "skip"
        });

        // Linea principal del pronostico
        traces.push({
            x,
            y,

            type: "scatter",
            mode: "lines",

            name: "Caudal pronosticado",
            legendgroup: "pronosticado",
            showlegend: true,

            connectgaps: false,

            line: {
                color: COLOR_PRONOSTICO,
                width: 3,
                dash: "solid"
            },

            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal pronosticado: %{y:.2f} m³/s" +
                "<extra></extra>"
        });
    });

    // ========================================================
    // 5. PRONOSTICOS DE LAS QUEBRADAS
    // QD_* SON EXCLUSIVAMENTE PRONOSTICADOS
    // ========================================================

    columns.forEach(column => {

        if (!column.startsWith("QD_")) return;

        const forecastRecords = records.filter(r =>
            r.date >= inicioPronostico &&
            r.date <= finPronostico
        );

        const points = forecastRecords.map(r => ({
            x: r.date,
            y: getNumber(r.row, column)
        }));

        if (!points.some(p => p.y !== null)) {
            console.log("Sin pronostico para quebrada:", column);
            return;
        }

        const x = points.map(p => p.x);
        const y = points.map(p => p.y);

        const lower = points.map(p =>
            p.y === null ? null : Math.max(0, p.y * 0.80)
        );

        const upper = points.map(p =>
            p.y === null ? null : p.y * 1.20
        );

        totalForecast += points.filter(p => p.y !== null).length;

        // Banda inferior
        traces.push({
            x,
            y: lower,

            type: "scatter",
            mode: "lines",

            line: {
                color: "rgba(167,139,250,0)",
                width: 0.5
            },

            connectgaps: false,
            showlegend: false,
            hoverinfo: "skip"
        });

        // Banda superior
        traces.push({
            x,
            y: upper,

            type: "scatter",
            mode: "lines",

            line: {
                color: "rgba(167,139,250,0)",
                width: 0.5
            },

            fill: "tonexty",
            fillcolor: COLOR_BANDA,

            connectgaps: false,
            showlegend: false,
            hoverinfo: "skip"
        });

        // Pronostico de quebrada
        traces.push({
            x,
            y,

            type: "scatter",
            mode: "lines",

            name: "Caudal pronosticado",
            legendgroup: "pronosticado",
            showlegend: true,

            connectgaps: false,

            line: {
                color: COLOR_PRONOSTICO,
                width: 3,
                dash: "solid"
            },

            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal pronosticado: %{y:.2f} m³/s" +
                "<extra></extra>"
        });
    });

    // ========================================================
    // 6. LINEA VERTICAL: INICIO DEL PRONOSTICO
    // ========================================================

    const shapes = [
        {
            type: "line",

            // Posicion temporal exacta
            xref: "x",
            x0: inicioPronostico,
            x1: inicioPronostico,

            // Toda la altura del grafico
            yref: "paper",
            y0: 0,
            y1: 1,

            line: {
                color: "#ffffff",
                width: 2,
                dash: "dash"
            }
        }
    ];

    const annotations = [
        {
            xref: "x",
            x: inicioPronostico,

            yref: "paper",
            y: 1,

            text: "INICIO PRONÓSTICO<br>05/11/2026 - 02:00",

            showarrow: false,

            xanchor: "left",
            yanchor: "bottom",

            xshift: 7,

            font: {
                color: "#ffffff",
                size: 10
            },

            bgcolor: "rgba(30,41,59,0.95)",
            bordercolor: "#94a3b8",
            borderwidth: 1,
            borderpad: 4
        }
    ];

    // ========================================================
    // 7. UMBRALES: SOLO EL TIGRE Y CABO INGA
    // ========================================================

    if (esEstacion) {

        const umbrales = [
            {
                valor: 600,
                nombre: "Umbral amarillo",
                color: "#facc15"
            },
            {
                valor: 800,
                nombre: "Umbral naranja",
                color: "#f97316"
            },
            {
                valor: 1000,
                nombre: "Umbral rojo",
                color: "#ef4444"
            }
        ];

        umbrales.forEach(u => {

            shapes.push({
                type: "line",
                xref: "paper",
                x0: 0,
                x1: 1,

                yref: "y",
                y0: u.valor,
                y1: u.valor,

                line: {
                    color: u.color,
                    width: 2,
                    dash: "solid"
                }
            });

            annotations.push({
                xref: "paper",
                x: 1,
                xanchor: "right",

                yref: "y",
                y: u.valor,

                text: u.nombre + " (" + u.valor + " m³/s)",

                showarrow: false,

                font: {
                    color: u.color,
                    size: 10
                },

                bgcolor: "rgba(10,19,34,0.85)",
                borderpad: 3
            });
        });
    }

    // ========================================================
    // 8. EXTENSION DEL EJE TEMPORAL
    // ========================================================

    // Estaciones: mostrar desde -48 h y también cualquier
    // observacion posterior que exista.
    // Quebradas: comenzar directamente en el inicio.
    let ejeInicio = esEstacion
        ? inicioObservaciones
        : inicioPronostico;

    let ejeFin = finPronostico;

    if (esEstacion) {

        const observacionesPosteriores = records.filter(r => {

            const value = esCaboInga
                ? getNumber(r.row, "Q_CABOINGA")
                : getNumber(r.row, "Q_TIGRE");

            return (
                r.date >= inicioPronostico &&
                value !== null
            );
        });

        if (observacionesPosteriores.length) {

            const ultimaObservacion =
                observacionesPosteriores[
                    observacionesPosteriores.length - 1
                ].date;

            if (ultimaObservacion > ejeFin) {
                ejeFin = ultimaObservacion;
            }
        }
    }

    // Escala vertical
    const allValues = traces.flatMap(t =>
        (t.y || []).filter(v =>
            v !== null && Number.isFinite(v)
        )
    );

    const maxData = allValues.length
        ? Math.max(...allValues)
        : 0;

    const maxY = esEstacion
        ? Math.max(1100, maxData * 1.05)
        : undefined;

    subtitle.textContent =
        "Observados: " + totalObserved +
        " · Pronosticados: " + totalForecast +
        " · Pronóstico: 72 horas · Unidad: m³/s";

    if (!traces.length) {
        chart.innerHTML = "No existen datos válidos para esta ubicación.";
        return;
    }

    // ========================================================
    // 9. GRAFICAR
    // ========================================================

    Plotly.react(
        chart,
        traces,
        {
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",

            font: {
                color: "#a9bad0",
                size: 11
            },

            margin: {
                l: 65,
                r: 25,
                t: 65,
                b: 60
            },

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

            legend: {
                orientation: "h",
                y: 1.15
            }
        },
        {
            responsive: true,
            displaylogo: false
        }
    );

    // ========================================================
    // 10. ACTUALIZAR LOS MAPAS DE INUNDACION
    // ========================================================

    if (window.renderFloodImages) {
        window.renderFloodImages(item, rows);
    }
};


// ============================================================
// CONVERSION DE FECHAS
// ============================================================

window.parseDate = function (value) {

    if (value instanceof Date) {
        return value;
    }

    // Fechas seriales de Excel:
    // Se interpretan como hora local del navegador (Peru).
    if (typeof value === "number") {

        const d = XLSX.SSF.parse_date_code(value);

        if (!d) return null;

        return new Date(
            d.y,
            d.m - 1,
            d.d,
            d.H,
            d.M,
            Math.floor(d.S)
        );
    }

    // Fechas de texto del Excel
    const text = String(value).trim();

    const date = new Date(
        text.includes("T") ? text : text.replace(" ", "T")
    );

    return Number.isNaN(date.getTime()) ? null : date;
};


