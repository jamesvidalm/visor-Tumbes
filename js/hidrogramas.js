
window.renderHydrograph = function(item, rows) {

    const columns = item.columnas || [item.columna];

    const labels = item.etiquetas || columns;

    const traces = [];

    let total = 0;

    columns.forEach((column, i) => {

        // Conservar todos los tiempos y respetar los valores faltantes.
        const dates = rows.map(r => parseDate(r.fecha));

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

        const validCount = values.filter(
            value => value !== null
        ).length;

        // Si no existen datos, no dibujar la serie.
        if (validCount === 0) {
            console.log("Sin datos disponibles:", column);
            return;
        }

        total += validCount;

        const isCaboIngaReal = (
            item.nombre === "Cabo Inga" &&
            column === "Q_CABOINGA"
        );

        const isObserved = (
            column === "Q_TIGRE" ||
            column === "Q_CABOINGA"
        );

        let mode = "lines";
        let lineStyle = {};

        // Cabo Inga: caudales reales representados solamente como puntos.
        if (isCaboIngaReal) {

            mode = "markers";

        }

        // Caudal real de El Tigre: línea continua solo entre datos disponibles.
        if (column === "Q_TIGRE") {

            mode = "lines";

            lineStyle = {
                color: "#42c8e8",
                width: 2.5
            };

        }

        // Caudales pronosticados: líneas diferenciadas.
        if (
            column === "Q_TIGRE_P" ||
            column === "Q_CABOINGA_P"
        ) {

            mode = "lines";

            lineStyle = {
                color: "#f59e0b",
                width: 2.5,
                dash: "dash"
            };

        }

        // Datos reales puntuales de Cabo Inga.
        if (isCaboIngaReal) {

            traces.push({

                x: dates,
                y: values,

                type: "scatter",
                mode: "markers",

                name: labels[i] || column,

                connectgaps: false,

                marker: {
                    color: "#42c8e8",
                    size: 7,
                    symbol: "circle"
                },

                hovertemplate:
                    "%{x|%d/%m/%Y %H:%M}" +
                    "<br>Q: %{y:.3f} m³/s" +
                    "<extra>" + (labels[i] || column) + "</extra>"

            });

            return;
        }

        // Resto de series.
        traces.push({

            x: dates,
            y: values,

            type: "scatter",
            mode: mode,

            name: labels[i] || column,

            connectgaps: false,

            line: lineStyle,

            marker: {
                size: 5,
                color: isObserved ? "#42c8e8" : "#f59e0b"
            },

            hovertemplate:
                "%{x|%d/%m/%Y %H:%M}" +
                "<br>Q: %{y:.3f} m³/s" +
                "<extra>" + (labels[i] || column) + "</extra>"

        });

    });


    document.getElementById("hydro-title").textContent =
        item.nombre;

    document.getElementById("selection-info").textContent =
        "Registros disponibles: " + total + " · Unidad: m³/s";


    // Si ninguna serie tiene datos, mostrar mensaje.
    if (traces.length === 0) {

        document.getElementById("hydro-chart").innerHTML =
            '<div class="empty-state">' +
            'No existen datos de caudal disponibles para esta ubicación.' +
            '</div>';

        return;

    }


    Plotly.newPlot(
        "hydro-chart",
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
                b: 55
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


// Convertir fechas de Excel.
window.parseDate = function(v) {

    if (v instanceof Date) {
        return v;
    }

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

    return isNaN(d) ? null : d;

};
