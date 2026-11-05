// ============================================================
// HIDROGRAMAS - CUENCA DEL RIO TUMBES
// Umbrales para El Tigre y Cabo Inga
// ============================================================

window.renderHydrograph = function (item, rows) {

    const title = document.getElementById("hydro-title");
    const subtitle = document.getElementById("hydro-subtitle");
    const chart = document.getElementById("hydro-chart");

    if (!title || !subtitle || !chart) {
        console.error("No se encontraron los elementos del hidrograma en index.html");
        return;
    }

    rows = Array.isArray(rows) ? rows : [];

    const columns = item.columnas || (item.columna ? [item.columna] : []);
    const labels = item.etiquetas || columns;

    title.textContent = item.nombre || "Hidrograma";

    if (columns.length === 0 || rows.length === 0) {
        subtitle.textContent = "No hay datos disponibles.";
        chart.innerHTML = "No existen datos para esta ubicación.";
        return;
    }

    // --------------------------------------------------------
    // FECHAS
    // --------------------------------------------------------

    const dates = rows.map(r => window.parseDate(r.fecha));

    const traces = [];
    let totalValid = 0;

    // --------------------------------------------------------
    // SERIES DE CAUDAL
    // --------------------------------------------------------

    columns.forEach((column, i) => {

        const values = rows.map(r => {
            const value = r[column];

            if (
                value === null ||
                value === undefined ||
                String(value).trim() === ""
            ) {
                return null;
            }

            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        });

        const validCount = values.filter(v => v !== null).length;

        if (validCount === 0) return;

        totalValid += validCount;

        const label = labels[i] || column;

        let mode = "lines";
        let color = "#42c8e8";
        let width = 2.5;
        let dash = "solid";
        let marker = { color: color, size: 5 };

        // Cabo Inga observado: puntos aislados
        if (column === "Q_CABOINGA") {
            mode = "markers";
            color = "#42c8e8";
            marker = {
                color: color,
                size: 7,
                symbol: "circle"
            };
        }

        // El Tigre observado: línea con interrupciones
        if (column === "Q_TIGRE") {
            mode = "lines";
            color = "#42c8e8";
            width = 2.5;
        }

        // Pronóstico: línea continua
        if (
            column === "Q_TIGRE_P" ||
            column === "Q_CABOINGA_P"
        ) {
            mode = "lines";
            color = "#f59e0b";
            width = 2.5;
            dash = "solid";
            marker = {
                color: color,
                size: 4
            };
        }

        // Series de quebradas
        if (column.startsWith("QD_")) {
            mode = "lines";
            color = "#42c8e8";
            width = 2.5;
        }

        traces.push({
            x: dates,
            y: values,
            type: "scatter",
            mode: mode,
            name: label,
            connectgaps: false,
            line: {
                color: color,
                width: width,
                dash: dash
            },
            marker: marker,
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal: %{y:.3f} m³/s" +
                "<extra>" + label + "</extra>"
        });
    });

    subtitle.textContent =
        "Registros válidos: " + totalValid + " · Unidad: m³/s";

    if (traces.length === 0) {
        chart.innerHTML = "No existen datos de caudal disponibles.";
        return;
    }

    // --------------------------------------------------------
    // UMBRALES: SOLO EL TIGRE Y CABO INGA
    // --------------------------------------------------------

    const nombre = String(item.nombre || "").toLowerCase();

    const esEstacion =
        nombre.includes("el tigre") ||
        nombre.includes("cabo inga");

    const shapes = [];
    const annotations = [];

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

    if (esEstacion) {

        umbrales.forEach(u => {

            // Línea horizontal
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

            // Etiqueta del umbral
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
                bgcolor: "rgba(10,19,34,0.75)",
                borderpad: 3
            });
        });
    }

    // --------------------------------------------------------
    // ESCALA VERTICAL
    // --------------------------------------------------------

    const allValues = traces.flatMap(t =>
        t.y.filter(v => v !== null)
    );

    const maxData = allValues.length
        ? Math.max(...allValues)
        : 0;

    const maxY = esEstacion
        ? Math.max(1100, maxData * 1.05)
        : undefined;

    // --------------------------------------------------------
    // GRAFICAR
    // --------------------------------------------------------

    Plotly.newPlot(
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
                t: 45,
                b: 60
            },

            xaxis: {
                title: "Fecha y hora",
                gridcolor: "#26354b",
                tickformat: "%d/%m %H:%M"
            },

            yaxis: {
                title: "Caudal (m³/s)",
                gridcolor: "#26354b",
                rangemode: "tozero",
                ...(esEstacion ? { range: [0, maxY] } : {})
            },

            shapes: shapes,
            annotations: annotations,

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
};


// ============================================================
// CONVERTIR FECHAS DEL EXCEL
// ============================================================

window.parseDate = function (value) {

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "number") {

        const d = XLSX.SSF.parse_date_code(value);

        if (!d) return null;

        return new Date(Date.UTC(
            d.y,
            d.m - 1,
            d.d,
            d.H,
            d.M,
            Math.floor(d.S)
        ));
    }

    const date = new Date(
        String(value).trim().replace(" ", "T")
    );

    return Number.isNaN(date.getTime()) ? null : date;
};
