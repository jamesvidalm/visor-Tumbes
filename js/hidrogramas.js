window.renderHydrograph = function(item, rows) {
  const columns = item.columnas || [item.columna];
  const labels = item.etiquetas || [item.nombre];
  const colors = ["#42c8e8", "#f59e0b", "#a78bfa"];
  const traces = columns.map((column,i)=>{
    const valid = rows.filter(r=>r.fecha!==null && r.fecha!==undefined && r[column]!==null && r[column]!=="");
    return {
      x: valid.map(r=>parseDate(r.fecha)),
      y: valid.map(r=>Number(r[column])),
      type:"scatter", mode:"lines",
      name:labels[i] || column,
      line:{color:colors[i % colors.length],width:2.5},
      hovertemplate:"%{x|%d/%m/%Y %H:%M}<br>Q: %{y:.3f} m³/s<extra>"+(labels[i]||column)+"</extra>"
    };
  });
  const total=traces.reduce((n,t)=>n+t.y.length,0);
  document.getElementById("hydro-title").textContent=item.nombre;
  document.getElementById("selection-info").textContent=
    `Variables: ${columns.join(" / ")} · Registros: ${total} · Unidad: m³/s`;
  if(!total){
    document.getElementById("hydro-chart").innerHTML=
      '<div class="empty-state">No hay datos válidos para esta selección. Revisa la columna del Excel.</div>';
    return;
  }
  Plotly.newPlot("hydro-chart",traces,{
    paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",
    font:{color:"#a9bad0",size:11},margin:{l:65,r:25,t:25,b:55},
    xaxis:{title:"Fecha y hora",gridcolor:"#26354b",tickformat:"%d/%m %H:%M"},
    yaxis:{title:"Caudal (m³/s)",gridcolor:"#26354b",rangemode:"tozero"},
    hovermode:"x unified",legend:{orientation:"h",y:1.12}
  },{responsive:true,displaylogo:false});
};
window.parseDate = function(v){
  if(v instanceof Date)return v;
  if(typeof v==="number"){
    const d=XLSX.SSF.parse_date_code(v);
    return d ? new Date(Date.UTC(d.y,d.m-1,d.d,d.H,d.M,Math.floor(d.S))) : v;
  }
  const s=String(v).trim().replace(" ","T");
  const d=new Date(s);
  return isNaN(d)?s:d;
};
