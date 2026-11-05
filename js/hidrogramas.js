
 // ============================================================
 // HIDROGRAMAS - CUENCA DEL RIO TUMBES
 // OBSERVADO + PRONOSTICADO + BANDA DE INCERTIDUMBRE
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

    const columns = item.columnas || (item.columna ? [item.columna] : []);
    const labels = item.etiquetas || columns;

    title.textContent = item.nombre || "Hidrograma";

    if (!columns.length || !rows.length) {
        subtitle.textContent = "No hay datos disponibles.";
        chart.innerHTML = "No existen datos para esta ubicación.";
        return;
    }

    const dates = rows.map(r => window.parseDate(r.fecha));

    const traces = [];
    let totalValid = 0;

    // Colores
    const COLOR_OBSERVADO = "#38bdf8";
    const COLOR_PRONOSTICO = "#a78bfa";
    const COLOR_BANDA = "rgba(167,139,250,0.18)";

    const forecastPairs = {
        "Q_TIGRE_P": "Q_TIGRE",
        "Q_CABOINGA_P": "Q_CABOINGA"
    };

    // ========================================================
    // 1. CAUDALES OBSERVADOS
    // ========================================================

    columns.forEach((column, i) => {

        if (forecastPairs[column]) return;

        const values = rows.map(r => {

            const value = r[column];

            if (
                value === null ||
                value === undefined ||
                String(value).trim() === ""
            ) {
                return null;
            }

            const n = Number(value);

            return Number.isFinite(n) ? n : null;
        });

        const validCount = values.filter(v => v !== null).length;

        if (validCount === 0) return;

        totalValid += validCount;

        const label = labels[i] || column;

        let line = {
            color: COLOR_OBSERVADO,
            width: 2.8
        };

        // Cabo Inga: unir observaciones con línea suavizada
        if (column === "Q_CABOINGA") {
            line = {
                color: COLOR_OBSERVADO,
                width: 3,
                shape: "spline",
                smoothing: 1.15
            };
        }

        // El Tigre: línea observada respetando datos faltantes
        if (column === "Q_TIGRE") {
            line = {
                color: COLOR_OBSERVADO,
                width: 2.8
            };
        }

        // Quebradas
        if (column.startsWith("QD_")) {
            line = {
                color: COLOR_OBSERVADO,
                width: 2.8
            };
        }

        traces.push({
            x: dates,
            y: values,
            type: "scatter",
            mode: "lines",
            name: "Caudal observado",
            legendgroup: "observado",
            showlegend: true,
            connectgaps: false,
            line: line,
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal observado: %{y:.2f} m³/s" +
                "<extra></extra>"
        });
    });

    // ========================================================
    // 2. CAUDALES PRONOSTICADOS Y BANDA +/- 20 %
    // ========================================================

    columns.forEach((forecastColumn) => {

        const observedColumn = forecastPairs[forecastColumn];

        if (!observedColumn) return;

        // Buscar última observación válida
        let lastObservedIndex = -1;

        for (let j = rows.length - 1; j >= 0; j--) {

            const value = rows[j][observedColumn];

            if (
                value !== null &&
                value !== undefined &&
                String(value).trim() !== "" &&
                Number.isFinite(Number(value)) &&
                dates[j]
            ) {
                lastObservedIndex = j;
                break;
            }
        }

        if (lastObservedIndex < 0) return;

        const lastObservedValue =
            Number(rows[lastObservedIndex][observedColumn]);

        const lastObservedDate =
            dates[lastObservedIndex];

        // Solo datos posteriores al último observado
        const forecastIndices = [];

        for (let j = lastObservedIndex + 1; j < rows.length; j++) {
            if (dates[j]) {
                forecastIndices.push(j);
            }
        }

        const validForecastIndices = forecastIndices.filter(j => {
            const value = rows[j][forecastColumn];

            return (
                value !== null &&
                value !== undefined &&
                String(value).trim() !== "" &&
                Number.isFinite(Number(value))
            );
        });

        if (!validForecastIndices.length) return;

        totalValid += validForecastIndices.length;

        // Eje temporal del pronóstico
        const xForecast = [
            lastObservedDate,
            ...forecastIndices.map(j => dates[j])
        ];

        // Pronóstico central
        const yForecast = [
            lastObservedValue,
            ...forecastIndices.map(j => {

                const value = rows[j][forecastColumn];

                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === "" ||
                    !Number.isFinite(Number(value))
                ) {
                    return null;
                }

                return Number(value);
            })
        ];

        // Límite inferior -20 %
        const lower = [
            lastObservedValue,
            ...forecastIndices.map(j => {

                const value = rows[j][forecastColumn];

                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === "" ||
                    !Number.isFinite(Number(value))
                ) {
                    return null;
                }

                return Math.max(0, Number(value) * 0.80);
            })
        ];

        // Límite superior +20 %
        const upper = [
            lastObservedValue,
            ...forecastIndices.map(j => {

                const value = rows[j][forecastColumn];

                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === "" ||
                    !Number.isFinite(Number(value))
                ) {
                    return null;
                }

                return Number(value) * 1.20;
            })
        ];

        // Banda inferior: oculta de la leyenda
        traces.push({
            x: xForecast,
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

        // Banda superior: relleno entre ambos límites
        // También oculta de la leyenda
        traces.push({
            x: xForecast,
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

        // Línea central del pronóstico
        traces.push({
            x: xForecast,
            y: yForecast,
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
    // 3. UMBRALES PARA EL TIGRE Y CABO INGA
    // ========================================================

    const nombre = String(item.nombre || "").toLowerCase();

    const esEstacion =
        nombre.includes("el tigre") ||
        nombre.includes("cabo inga");

    const shapes = [];
    const annotations = [];

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
                bgcolor: "rgba(10,19,34,0.8)",
                borderpad: 3
            });
        });
    }

    // ========================================================
    // 4. ESCALA VERTICAL
    // ========================================================

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
        "Registros válidos: " + totalValid +
        " · Unidad: m³/s";

    // ========================================================
    // 5. GRAFICAR
    // ========================================================

    if (!traces.length) {
        chart.innerHTML = "No existen datos disponibles.";
        return;
    }

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

    if (value instanceof Date) return value;

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

