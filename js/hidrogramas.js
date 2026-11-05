// ============================================================
// HIDROGRAMAS - CUENCA DEL RIO TUMBES
// Compatible con los elementos existentes de index.html
// ============================================================

window.renderHydrograph = function (item, rows) {

    const title = document.getElementById("hydro-title");
    const subtitle = document.getElementById("hydro-subtitle");
    const chart = document.getElementById("hydro-chart");

    // Verificar elementos HTML
    if (!title || !subtitle || !chart) {
        console.error("No se encontraron hydro-title, hydro-subtitle o hydro-chart en index.html");
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

    // Fechas
    const dates = rows.map(r => window.parseDate(r.fecha));

    const traces = [];
    let totalValid = 0;

    columns.forEach((column, i) => {

        // Mantener los valores faltantes como null
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

        // No dibujar series sin datos
        if (validCount === 0) {
            console.log("Sin datos para:", column);
            return;
        }

        totalValid += validCount;

        const label = labels[i] || column;

        // Configuración visual
        let mode = "lines";
        let line = {
            color: "#42c8e8",
            width: 2.5
        };

        let marker = {
            color: "#42c8e8",
            size: 5
        };

        // Cabo Inga observado: puntos aislados
        if (column === "Q_CABOINGA") {
            mode = "markers";
            marker = {
                color: "#42c8e8",
                size: 7,
                symbol: "circle"
            };
        }

        // El Tigre observado: línea con interrupciones
        if (column === "Q_TIGRE") {
            mode = "lines";
            line = {
                color: "#42c8e8",
                width: 2.5
            };
        }

        // Pronósticos: líneas discontinuas
        if (
            column === "Q_TIGRE_P" ||
            column === "Q_CABOINGA_P"
        ) {
            mode = "lines";
            line = {
                color: "#f59e0b",
                width: 2.5,
                dash: "dash"
            };
            marker = {
                color: "#f59e0b",
                size: 4
            };
        }

        // Quebradas: líneas
        if (column.startsWith("QD_")) {
            mode = "lines";
            line = {
                color: "#42c8e8",
                width: 2.5
            };
        }

        traces.push({
            x: dates,
            y: values,
            type: "scatter",
            mode: mode,
            name: label,
            connectgaps: false,
            line: line,
            marker: marker,
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal: %{y:.3f} m³/s" +
                "<extra>" + label + "</extra>"
        });
    });

    subtitle.textContent =
        "Registros válidos: " + totalValid +
        " · Unidad: m³/s";

    // Ninguna serie disponible
    if (traces.length === 0) {
        chart.innerHTML =
            '<div class="empty">' +
            'No existen datos de caudal disponibles para esta ubicación.' +
            '</div>';
        return;
    }

    // Dibujar hidrograma
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
