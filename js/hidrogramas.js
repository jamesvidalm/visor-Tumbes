// ============================================================
// HIDROGRAMAS - VISOR DE CAUDALES TUMBES
// ============================================================

window.renderHydrograph = function (item, rows) {

    // --------------------------------------------------------
    // 1. ASEGURAR QUE EXISTAN LOS ELEMENTOS DEL HIDROGRAMA
    // --------------------------------------------------------

    let panel = document.querySelector(".hydro-panel");

    if (!panel) {
        panel = document.createElement("section");
        panel.className = "panel hydro-panel";
        document.querySelector("main")?.appendChild(panel);
    }

    let title = document.getElementById("hydro-title");

    if (!title) {
        title = document.createElement("h3");
        title.id = "hydro-title";
        panel.appendChild(title);
    }

    let info = document.getElementById("selection-info");

    if (!info) {
        info = document.createElement("div");
        info.id = "selection-info";
        panel.appendChild(info);
    }

    let chart = document.getElementById("hydro-chart");

    if (!chart) {
        chart = document.createElement("div");
        chart.id = "hydro-chart";
        chart.style.width = "100%";
        chart.style.minHeight = "400px";
        panel.appendChild(chart);
    }

    // --------------------------------------------------------
    // 2. IDENTIFICAR SERIES
    // --------------------------------------------------------

    rows = Array.isArray(rows) ? rows : [];

    const columns = item.columnas || [item.columna];
    const labels = item.etiquetas || columns;

    title.textContent = item.nombre || "Hidrograma";

    // --------------------------------------------------------
    // 3. CONSTRUIR SERIES SIN ELIMINAR LOS VALORES FALTANTES
    // --------------------------------------------------------

    const traces = [];

    columns.forEach((column, i) => {

        const values = rows.map(r => {
            const value = r[column];

            if (
                value === null ||
                value === undefined ||
                value === "" ||
                !Number.isFinite(Number(value))
            ) {
                return null;
            }

            return Number(value);
        });

        // No dibujar una serie que no tenga ningún dato válido
        const validCount = values.filter(v => v !== null).length;

        if (validCount === 0) return;

        const label = labels[i] || column;
        const name = String(item.nombre || "").toLowerCase();

        let mode = "lines";
        let line = {
            width: 2.5,
            color: ["#42c8e8", "#f59e0b", "#a78bfa"][i % 3]
        };
        let marker = undefined;

        // Cabo Inga observado: puntos aislados, sin línea
        if (
            name.includes("cabo inga") &&
            column === "Q_CABOINGA"
        ) {
            mode = "markers";
            marker = {
                size: 6,
                color: "#42c8e8"
            };
        }

        // El Tigre observado: línea continua solo entre
        // observaciones consecutivas, respetando los vacíos
        if (
            name.includes("el tigre") &&
            column === "Q_TIGRE"
        ) {
            mode = "lines";
            line = {
                color: "#42c8e8",
                width: 2.5
            };
        }

        // Pronóstico: línea discontinua
        if (
            column.includes("_P") ||
            label.toLowerCase().includes("pronostic")
        ) {
            mode = "lines";
            line = {
                color: "#f59e0b",
                width: 2.5,
                dash: "dash"
            };
        }

        const trace = {
            x: rows.map(r => window.parseDate(r.fecha)),
            y: values,
            type: "scatter",
            mode: mode,
            name: label,
            connectgaps: false,
            line: line,
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Q: %{y:.3f} m³/s" +
                "<extra>" + label + "</extra>"
        };

        if (marker) trace.marker = marker;

        traces.push(trace);
    });

    // --------------------------------------------------------
    // 4. INFORMACIÓN
    // --------------------------------------------------------

    const total = traces.reduce((n, t) => {
        return n + t.y.filter(v => v !== null).length;
    }, 0);

    info.textContent =
        "Variables: " +
        columns.join(" / ") +
        " · Registros válidos: " +
        total +
        " · Unidad: m³/s";

    // --------------------------------------------------------
    // 5. MOSTRAR GRÁFICO
    // --------------------------------------------------------

    if (traces.length === 0) {

        chart.innerHTML =
            '<div class="empty-state">' +
            'No existen datos válidos para esta ubicación.' +
            '</div>';

        return;
    }

    chart.innerHTML = "";

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
                t: 35,
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
                rangemode: "tozero"
            },

            hovermode: "x unified",

            legend: {
                orientation: "h",
                y: 1.12
            }
        },
        {
            responsive: true,
            displaylogo: false
        }
    );
};


// ============================================================
// CONVERSIÓN DE FECHAS
// ============================================================

window.parseDate = function (v) {

    if (v instanceof Date) return v;

    if (typeof v === "number") {

        const d = XLSX.SSF.parse_date_code(v);

        return d
            ? new Date(Date.UTC(
                d.y,
                d.m - 1,
                d.d,
                d.H,
                d.M,
                Math.floor(d.S)
            ))
            : null;
    }

    const s = String(v).trim().replace(" ", "T");
    const d = new Date(s);

    return isNaN(d.getTime()) ? null : d;
};
