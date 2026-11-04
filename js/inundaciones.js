window.FLOOD_MANIFEST = null;
window.loadFloodManifest = async function(){
  const r=await fetch(CONFIG.manifestInundaciones); if(!r.ok) throw new Error("No se pudo leer manifest.json");
  FLOOD_MANIFEST=await r.json();
};
window.renderFloodImages = function(item, rows){
  const grid=document.getElementById("flood-grid"), label=document.getElementById("scenario-label");
  if(!FLOOD_MANIFEST){grid.innerHTML='<div class="flood-error">No se cargó el manifest de inundaciones.</div>';return;}
  const values=rows.map(r=>Number(r[item.columna])).filter(Number.isFinite);
  const peak=values.length?Math.max(...values):null;
  // Busca imágenes del objetivo seleccionado; si no hay, intenta el grupo GENERAL.
  let candidates=FLOOD_MANIFEST.scenarios.filter(s=>norm(s.objetivo)===norm(item.nombre));
  if(!candidates.length) candidates=FLOOD_MANIFEST.scenarios.filter(s=>norm(s.objetivo)==="general");
  if(!candidates.length){grid.innerHTML='<div class="flood-error">No hay escenarios configurados para '+item.nombre+'. Añade este objetivo a manifest.json.</div>';label.textContent="SIN ESCENARIO";return;}
  let chosen=candidates[0];
  if(peak!==null) chosen=candidates.reduce((a,b)=>Math.abs(Number(b.caudal_referencia)-peak)<Math.abs(Number(a.caudal_referencia)-peak)?b:a);
  label.textContent=`${item.nombre} · Q máximo del periodo: ${peak===null?"—":peak.toFixed(2)+" m³/s"} · Escenario: ${chosen.caudal_referencia} m³/s`;
  const horizons=[12,24,36,48,60,72];
  grid.innerHTML=horizons.map(h=>{
    const src=chosen.imagenes[String(h)];
    if(!src)return `<div class="flood-card"><div class="flood-error">Falta PNG</div><h4>+${h} horas</h4></div>`;
    return `<article class="flood-card"><img loading="lazy" src="${src}" alt="Mancha de inundación ${item.nombre} +${h} h" onerror="this.outerHTML='<div class=&quot;flood-error&quot;>No se encontró el PNG</div>'"><h4>+${h} horas</h4><small>Q escenario: ${chosen.caudal_referencia} m³/s</small></article>`;
  }).join("");
};
window.norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
