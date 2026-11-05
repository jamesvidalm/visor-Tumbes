
 // ============================================================
 // VISOR HIDROLOGICO - CUENCA DEL RIO TUMBES
 //
 // EL TIGRE:
 //   Q_TIGRE       = Observado
 //   Q_TIGRE_P     = Pronosticado
 //
 // CABO INGA:
 //   Q_CABOINGA    = Observado (puntos unidos con spline)
 //   Q_CABOINGA_P  = Pronosticado
 //
 // QUEBRADAS:
 //   QD_*          = Pronosticado
 //
 // PRONOSTICO:
 //   Banda de incertidumbre +/- 20 %
 //
 // UMBRALES:
 //   Amarillo 600 | Naranja 800 | Rojo 1000 m3/s
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

    // Fallback para las estaciones, por si app.js entrega
    // un objeto de selección sin columnas.
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

    // --------------------------------------------------------
    // CONFIGURACION
    // --------------------------------------------------------

    const COLOR_OBSERVADO = "#38bdf8";
    const COLOR_PRONOSTICO = "#a78bfa";
    const COLOR_BANDA = "rgba(167,139,250,0.18)";

    const esCaboInga = nombreLower.includes("cabo inga");
    const esElTigre = nombreLower.includes("el tigre");

    const esEstacion = esCaboInga || esElTigre;

    const forecastPairs = {
        "Q_TIGRE_P": "Q_TIGRE",
        "Q_CABOINGA_P": "Q_CABOINGA"
    };

    // --------------------------------------------------------
    // PREPARAR REGISTROS Y ORDENAR POR FECHA
    // --------------------------------------------------------

    const records = rows.map(r => ({
        row: r,
        date: window.parseDate(r.fecha)
    }))
    .filter(r => r.date instanceof Date && !isNaN(r.date.getTime()))
    .sort((a, b) => a.date - b.date);

    if (!records.length) {
        subtitle.textContent = "No se encontraron fechas válidas.";
        chart.innerHTML = "Revisa la columna fecha del Excel.";
        return;
    }

    const traces = [];
    let totalObserved = 0;
    let totalForecast = 0;

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

    // --------------------------------------------------------
    // 1. CAUDAL OBSERVADO
    // --------------------------------------------------------

    columns.forEach((column, i) => {

        if (forecastPairs[column]) return;

        if (column.startsWith("QD_")) return;

        const points = records
            .map(r => ({
                x: r.date,
                y: getNumber(r.row, column)
            }))
            .filter(p => p.y !== null);

        if (!points.length) {
            console.log("Sin datos observados:", column);
            return;
        }

        totalObserved += points.length;

        // CABO INGA:
        // Se eliminan las filas vacías antes de graficar.
        // Así se unen todos los puntos observados disponibles,
        // aunque existan horas o días sin mediciones.
        if (column === "Q_CABOINGA") {

            traces.push({
                x: points.map(p => p.x),
                y: points.map(p => p.y),

                type: "scatter",
                mode: "lines+markers",

                name: "Caudal observado",
                legendgroup: "observado",
                showlegend: true,

                connectgaps: false,

                line: {
                    color: COLOR_OBSERVADO,
                    width: 3,
                    shape: "spline",
                    smoothing: 1.1
                },

                marker: {
                    color: COLOR_OBSERVADO,
                    size: 6,
                    symbol: "circle"
                },

                hovertemplate:
                    "%{x|%d/%m/%Y %H:%M}" +
                    "<br>Caudal observado: %{y:.2f} m³/s" +
                    "<extra></extra>"
            });

            console.log(
                "Cabo Inga: observaciones graficadas =",
                points.length
            );

            return;
        }

        // EL TIGRE:
        // Mantener las fechas y los null para respetar vacíos.
        if (column === "Q_TIGRE") {

            const x = records.map(r => r.date);
            const y = records.map(r => getNumber(r.row, column));

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

            return;
        }

        // Otras series observadas, si existieran
        traces.push({
            x: points.map(p => p.x),
            y: points.map(p => p.y),

            type: "scatter",
            mode: "lines",

            name: "Caudal observado",
            legendgroup: "observado",
            showlegend: true,

            connectgaps: false,

            line: {
                color: COLOR_OBSERVADO,
                width: 2.8
            }
        });
    });

    // --------------------------------------------------------
    // 2. PRONOSTICO DE EL TIGRE Y CABO INGA
    // --------------------------------------------------------

    columns.forEach(forecastColumn => {

        const observedColumn = forecastPairs[forecastColumn];

        if (!observedColumn) return;

        // Último caudal observado disponible
        let lastObserved = null;

        for (let j = records.length - 1; j >= 0; j--) {

            const value = getNumber(records[j].row, observedColumn);

            if (value !== null) {
                lastObserved = {
                    date: records[j].date,
                    value: value
                };
                break;
            }
        }

        if (!lastObserved) {
            console.log(
                "No hay observado para iniciar pronóstico:",
                observedColumn
            );
            return;
        }

        // Pronósticos estrictamente posteriores al último observado
        const forecastPoints = records
            .filter(r => r.date > lastObserved.date)
            .map(r => ({
                x: r.date,
                y: getNumber(r.row, forecastColumn)
            }));

        if (!forecastPoints.some(p => p.y !== null)) {
            console.log("No hay pronóstico válido:", forecastColumn);
            return;
        }

        const xForecast = [
            lastObserved.date,
            ...forecastPoints.map(p => p.x)
        ];

        const yForecast = [
            lastObserved.value,
            ...forecastPoints.map(p => p.y)
        ];

        const lower = [
            lastObserved.value,
            ...forecastPoints.map(p =>
                p.y === null ? null : Math.max(0, p.y * 0.80)
            )
        ];

        const upper = [
            lastObserved.value,
            ...forecastPoints.map(p =>
                p.y === null ? null : p.y * 1.20
            )
        ];

        totalForecast += forecastPoints.filter(p => p.y !== null).length;

        // Límite inferior: oculto en la leyenda
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

        // Límite superior: relleno de incertidumbre
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

    // --------------------------------------------------------
    // 3. CAUDALES PRONOSTICADOS DE LAS QUEBRADAS
    // --------------------------------------------------------

    columns.forEach(column => {

        if (!column.startsWith("QD_")) return;

        const points = records.map(r => ({
            x: r.date,
            y: getNumber(r.row, column)
        }));

        if (!points.some(p => p.y !== null)) {
            console.log("Sin pronóstico para quebrada:", column);
            return;
        }

        totalForecast += points.filter(p => p.y !== null).length;

        traces.push({
            x: points.map(p => p.x),
            y: points.map(p => p.y),

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

    // --------------------------------------------------------
    // 4. UMBRALES PARA EL TIGRE Y CABO INGA
    // --------------------------------------------------------

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

                bgcolor: "rgba(10,19,34,0.85)",
                borderpad: 3
            });
        });
    }

    // --------------------------------------------------------
    // 5. ESCALA DEL GRAFICO
    // --------------------------------------------------------

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
        " · Unidad: m³/s";

    if (!traces.length) {
        chart.innerHTML = "No existen datos válidos para esta ubicación.";
        return;
    }

    // --------------------------------------------------------
    // 6. GRAFICAR
    // --------------------------------------------------------

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
// CONVERSION DE FECHAS DEL EXCEL
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

