// ============================================================
 // HIDROGRAMAS - CUENCA DEL RIO TUMBES
 // - Cabo Inga observado: linea suavizada
 // - Pronostico: inicia en el ultimo dato observado
 // - Incertidumbre: +/- 20 %
 // - Umbrales: 600, 800 y 1000 m3/s
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

    // Correspondencia entre observado y pronosticado
    const forecastPairs = {
        "Q_TIGRE_P": "Q_TIGRE",
        "Q_CABOINGA_P": "Q_CABOINGA"
    };

    // --------------------------------------------------------
    // 1. SERIES OBSERVADAS
    // --------------------------------------------------------

    columns.forEach((column, i) => {

        if (forecastPairs[column]) return;

        const values = rows.map(r => {
            const value = r[column];

            if (
                value === null ||
                value === undefined ||
                String(value).trim() === ""
            ) return null;

            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        });

        const validIndices = values
            .map((v, index) => v !== null && dates[index] ? index : -1)
            .filter(index => index >= 0);

        if (!validIndices.length) return;

        totalValid += validIndices.length;

        const label = labels[i] || column;

        let mode = "lines";
        let color = "#42c8e8";
        let line = {
            color,
            width: 2.5
        };

        // Cabo Inga observado: línea suavizada
        if (column === "Q_CABOINGA") {
            mode = "lines";
            line = {
                color: "#42c8e8",
                width: 2.8,
                shape: "spline",
                smoothing: 1.15
            };
        }

        // El Tigre observado: línea normal con interrupciones
        if (column === "Q_TIGRE") {
            mode = "lines";
            line = {
                color: "#42c8e8",
                width: 2.5
            };
        }

        // Quebradas
        if (column.startsWith("QD_")) {
            line = {
                color: "#42c8e8",
                width: 2.5
            };
        }

        traces.push({
            x: dates,
            y: values,
            type: "scatter",
            mode,
            name: label,
            connectgaps: false,
            line,
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal observado: %{y:.2f} m³/s" +
                "<extra>" + label + "</extra>"
        });
    });

    // --------------------------------------------------------
    // 2. PRONOSTICOS Y BANDA DE INCERTIDUMBRE
    // --------------------------------------------------------

    columns.forEach((forecastColumn, i) => {

        const observedColumn = forecastPairs[forecastColumn];

        if (!observedColumn) return;

        // Buscar último dato observado válido
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

        if (lastObservedIndex < 0) {
            console.log(
                "No hay observaciones para iniciar el pronóstico:",
                observedColumn
            );
            return;
        }

        const lastObservedValue =
            Number(rows[lastObservedIndex][observedColumn]);

        const lastObservedDate = dates[lastObservedIndex];

        // Obtener únicamente pronósticos posteriores
        const forecastIndices = [];

        for (let j = lastObservedIndex + 1; j < rows.length; j++) {

            const value = rows[j][forecastColumn];

            if (!dates[j]) continue;

            if (
                value === null ||
                value === undefined ||
                String(value).trim() === ""
            ) {
                forecastIndices.push(j);
                continue;
            }

            if (Number.isFinite(Number(value))) {
                forecastIndices.push(j);
            } else {
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

        if (!validForecastIndices.length) {
            console.log("No hay pronóstico disponible:", forecastColumn);
            return;
        }

        totalValid += validForecastIndices.length;

        // El pronóstico comienza en el último dato observado
        const xForecast = [
            lastObservedDate,
            ...forecastIndices.map(j => dates[j])
        ];

        const yForecast = [
            lastObservedValue,
            ...forecastIndices.map(j => {
                const value = rows[j][forecastColumn];

                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === "" ||
                    !Number.isFinite(Number(value))
                ) return null;

                return Number(value);
            })
        ];

        // Banda de incertidumbre +/- 20 %
        const lower = [
            lastObservedValue,
            ...forecastIndices.map(j => {
                const value = rows[j][forecastColumn];

                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === "" ||
                    !Number.isFinite(Number(value))
                ) return null;

                return Math.max(0, Number(value) * 0.80);
            })
        ];

        const upper = [
            lastObservedValue,
            ...forecastIndices.map(j => {
                const value = rows[j][forecastColumn];

                if (
                    value === null ||
                    value === undefined ||
                    String(value).trim() === "" ||
                    !Number.isFinite(Number(value))
                ) return null;

                return Math.max(0, Number(value) * 1.20);
            })
        ];

        const forecastLabel =
            labels[i] || "Caudal pronosticado";

        const bandColor = "rgba(245,158,11,0.18)";

        // Límite inferior
        traces.push({
            x: xForecast,
            y: lower,
            type: "scatter",
            mode: "lines",
            name: "Límite inferior (-20 %)",
            line: {
                color: "rgba(245,158,11,0)",
                width: 0.5
            },
            connectgaps: false,
            hoverinfo: "skip",
            showlegend: true
        });

        // Límite superior y relleno de banda
        traces.push({
            x: xForecast,
            y: upper,
            type: "scatter",
            mode: "lines",
            name: "Banda de incertidumbre (±20 %)",
            line: {
                color: "rgba(245,158,11,0)",
                width: 0.5
            },
            fill: "tonexty",
            fillcolor: bandColor,
            connectgaps: false,
            hoverinfo: "skip",
            showlegend: true
        });

        // Línea central del pronóstico
        traces.push({
            x: xForecast,
            y: yForecast,
            type: "scatter",
            mode: "lines",
            name: forecastLabel,
            line: {
                color: "#f59e0b",
                width: 3,
                dash: "solid"
            },
            connectgaps: false,
            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Caudal pronosticado: %{y:.2f} m³/s" +
                "<extra>" + forecastLabel + "</extra>"
        });
    });

    // --------------------------------------------------------
    // 3. UMBRALES PARA EL TIGRE Y CABO INGA
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // 4. ESCALA VERTICAL
    // --------------------------------------------------------

    const allValues = traces.flatMap(t =>
        (t.y || []).filter(v => v !== null && Number.isFinite(v))
    );

    const maxData = allValues.length
        ? Math.max(...allValues)
        : 0;

    const maxY = esEstacion
        ? Math.max(1100, maxData * 1.05)
        : undefined;

    subtitle.textContent =
        "Registros válidos: " + totalValid + " · Unidad: m³/s";

    // --------------------------------------------------------
    // 5. GRAFICAR
    // --------------------------------------------------------

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
