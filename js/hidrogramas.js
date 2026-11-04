window.renderHydrograph = function(item, rows) {
  const x=[], y=[];
  rows.forEach(r=>{const v=Number(r[item.columna]); if(r.fecha!==undefined && r.fecha!=="" && Number.isFinite(v)) {x.push(parseDate(r.fecha));y.push(v);}});
  document.getElementById("hydro-title").textContent = item.nombre;
  document.getElementById("selection-info").textContent = `Variable: ${item.columna} · Registros disponibles: ${y.length} · Unidad: m³/s`;
  if(!y.length){document.getElementById("hydro-chart").innerHTML='<div class="empty-state">No se encontraron valores para esta columna. Revisa el encabezado del Excel y la configuración.</div>';return;}
  Plotly.newPlot("hydro-chart",[{x,y,type:"scatter",mode:"lines",name:item.nombre,line:{color:"#42c8e8",width:2.5},fill:"tozeroy",fillcolor:"rgba(66,200,232,.08)",hovertemplate:"%{x|%d/%m/%Y %H:%M}<br>Q: %{y:.3f} m³/s<extra></extra>"}],{
    paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",font:{color:"#a9bad0",size:11},
    margin:{l:65,r:25,t:15,b:55},xaxis:{title:"Fecha y hora",gridcolor:"#26354b",tickformat:"%d/%m %H:%M"},yaxis:{title:"Caudal (m³/s)",gridcolor:"#26354b",rangemode:"tozero"},
    hovermode:"x unified"
  },{responsive:true,displaylogo:false});
};
window.parseDate = function(v){
  if(v instanceof Date) return v;
  if(typeof v==="number" && window.XLSX) return XLSX.SSF.parse_date_code(v) ? new Date(Date.UTC(1899,11,30)+v*86400000) : v;
  const s=String(v).trim().replace(" ","T");
  const d=new Date(s); return isNaN(d)?s:d;
};
