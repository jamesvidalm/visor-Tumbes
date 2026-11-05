window.renderHydrograph = function(item, rows) {
  const cols = item.columnas || [item.columna];
  const labels = item.etiquetas || [item.nombre];
  const colors = ["#42c8e8", "#f59e0b"];
  const traces = cols.map((col,i)=>({
    x: rows.map(r=>toDate(r.fecha)),
    y: rows.map(r=>Number(r[col])),
    type:"scatter", mode:"lines", name:labels[i] || col,
    line:{color:colors[i % colors.length],width:2.5},
    hovertemplate:"%{x|%d/%m/%Y %H:%M}<br>%{y:.4f} m³/s<extra>"+(labels[i]||col)+"</extra>"
  }));
  document.getElementById("hydro-title").textContent = item.nombre;
  document.getElementById("hydro-subtitle").textContent =
    `Variables: ${cols.join(" / ")} · ${rows.length} registros · Unidad: m³/s`;
  Plotly.newPlot("hydro-chart", traces, {
    paper_bgcolor:"rgba(0,0,0,0)", plot_bgcolor:"rgba(0,0,0,0)",
    font:{color:"#a9bad0",size:11}, margin:{l:65,r:25,t:15,b:55},
    xaxis:{title:"Fecha y hora",gridcolor:"#26354b",tickformat:"%d/%m %H:%M"},
    yaxis:{title:"Caudal (m³/s)",gridcolor:"#26354b",rangemode:"tozero"},
    hovermode:"x unified", legend:{orientation:"h",y:1.12}
  }, {responsive:true,displaylogo:false});
};
function toDate(v){ if(v instanceof Date)return v; if(typeof v==="number")return XLSX.SSF.parse_date_code(v); return new Date(String(v).replace(" ","T")); }
