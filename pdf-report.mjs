import { Buffer } from 'node:buffer';

const esc = value => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ñ/gi, m => m === 'ñ' ? 'n' : 'N')
  .replace(/€/g, 'EUR')
  .replace(/[^\x20-\x7E]/g, ' ')
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function wrap(text, max = 92) {
  const words = String(text ?? '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!word) continue;
    if ((line + (line ? ' ' : '') + word).length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line += (line ? ' ' : '') + word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function fmtKm(v){ return Number.isFinite(Number(v)) ? `${Number(v).toFixed(2)} km` : '--'; }
function fmtM(v){ return Number.isFinite(Number(v)) ? `${Math.round(Number(v))} m` : '--'; }
function fmtDeg(v){ return Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)} deg` : '--'; }
function fmtHours(v){
  const h = Number(v);
  if (!Number.isFinite(h)) return '--';
  const mins = Math.max(0, Math.round(h * 60));
  return `${Math.floor(mins/60)} h ${String(mins%60).padStart(2,'0')} min`;
}
function fmtDate(iso){
  try { return new Date(iso).toLocaleString('es-NI', {dateStyle:'long', timeStyle:'short'}).replace(/,/g,''); }
  catch { return iso || '--'; }
}
function strategyName(mode){ return mode==='distance'?'Mas directa':mode==='risk'?'Menor exposicion':'Equilibrada'; }
function riskText(score){
  const n=Number(score); if(!Number.isFinite(n)) return 'Sin evaluacion';
  const label=n<30?'Bajo':n<55?'Moderado':n<75?'Alto':'Muy alto';
  return `${label} (${n}/100)`;
}
function minEvaHours(mission){
  const margin = Number(mission?.params?.returnMargin ?? 25) / 100;
  const duration = Number(mission?.duration);
  if (!Number.isFinite(duration)) return null;
  return duration / Math.max(0.2, 1 - margin);
}

export function buildMissionPdf(report){
  const pageW=612, pageH=792, margin=44, bodyX=margin, startY=748, lineH=13;
  const pages=[];
  let lines=[];
  const add=(text='',indent=0)=>{ wrap(text, 92-indent).forEach((l,i)=>lines.push({t:' '.repeat(indent)+l, bold:false, size:9})); };
  const heading=(text,size=12)=>{ lines.push({gap:5}); lines.push({t:text,bold:true,size}); lines.push({gap:3}); };
  const rule=()=>lines.push({rule:true});
  const tableRow=(cols,widths)=>{
    let line='';
    cols.forEach((c,i)=>{ const w=widths[i]; line += String(c ?? '').slice(0,w).padEnd(w) + (i===cols.length-1?'':'  '); });
    lines.push({t:line,bold:false,size:8.3});
  };

  heading('MARS EXPLORER',20);
  add('Informe de planificacion de travesia cientifica en Marte');
  add(`Generado: ${fmtDate(report.generatedAt)}`);
  rule();

  heading('RESUMEN DE LA MISION',12);
  add(`Estrategia seleccionada: ${strategyName(report.selectedMode)}`);
  add(`Estado: ${report.selected?.overBudget ? 'FUERA DE LIMITE OPERACIONAL' : 'DENTRO DE LOS PARAMETROS INTRODUCIDOS'}`);
  add(`Puntos planificados: ${report.points?.length ?? 0}`);
  add(`Puntos incluidos en la estrategia seleccionada: ${report.selected?.includedPoints?.length ?? report.selected?.sequence?.length ?? 0}`);
  add(`Opcionales omitidos: ${report.selected?.omittedOptional?.length ?? 0}`);
  add(`Regreso a base: ${report.returnBase ? 'SI' : 'NO'}`);
  rule();

  heading('PARAMETROS OPERACIONALES',12);
  const p=report.params||{};
  add(`Velocidad nominal: ${Number(p.speed).toFixed(1)} km/h`);
  add(`Tiempo maximo de EVA: ${Number(p.evaTime).toFixed(1)} h`);
  add(`Margen reservado para retorno: ${Number(p.returnMargin).toFixed(0)} %`);
  add(`Tiempo disponible para la mision: ${fmtHours(report.selected?.availableHours)}`);
  add(`Tiempo minimo de EVA necesario para conservar el margen: ${fmtHours(minEvaHours(report.selected))}`);
  add(`Tiempo total planificado en objetivos: ${fmtHours((Number(report.selected?.dwellMinutes)||0)/60)}`);
  add(`Tiempo de desplazamiento estimado: ${fmtHours((Number(report.selected?.duration)||0) - (Number(report.selected?.dwellMinutes)||0)/60)}`);
  add(`Margen restante: ${fmtHours((Number(report.selected?.availableHours)||0) - (Number(report.selected?.duration)||0))}`);
  rule();

  heading('SECUENCIA DE VISITA',12);
  const points=report.selected?.includedPoints || report.points || [];
  const travelHours = Number(report.selected?.duration||0) - Number(report.selected?.dwellMinutes||0)/60;
  const availableMinutes = Math.max(0, Number(report.selected?.availableHours||0)*60 - Math.max(0, travelHours*60));
  points.forEach((pt,i)=>{
    const status = pt.type==='base' ? 'BASE' : pt.required ? 'OBLIGATORIO' : 'OPCIONAL';
    add(`${i+1}. ${pt.name || `Punto ${i+1}`} - ${status}`);
    add(`   Coordenadas: ${Number(pt.lat).toFixed(5)} N, ${Number(pt.lon).toFixed(5)} E`);
    if (pt.type!=='base') {
      add(`   Parada programada: ${Number(pt.dwellMin||0)} min`);
      const otherDwell = points.filter((x,j)=>j!==i && x.type!=='base').reduce((s,x)=>s+Number(x.dwellMin||0),0);
      const maxExtra = Math.max(0, Math.floor(availableMinutes - otherDwell - Number(pt.dwellMin||0)));
      add(`   Tiempo adicional teorico disponible para esta parada: ${maxExtra} min`);
    }
  });
  rule();

  heading('COMPARACION DE ALTERNATIVAS',12);
  tableRow(['Estrategia','Distancia','Duracion','Min. EVA','Riesgo','Estado'],[17,13,13,13,15,17]);
  report.strategies?.forEach(s=>{
    tableRow([
      strategyName(s.mode),fmtKm(s.metrics?.distanceKm),fmtHours(s.duration),fmtHours(minEvaHours(s)),riskText(s.score),s.overBudget?'FUERA':'OK'
    ],[17,13,13,13,15,17]);
    const seq=(s.includedPoints||[]).map(p=>p.type==='base'?'BASE':`${p.name||'Objetivo'} (${p.required?'OBL':'OPC'}, ${Number(p.dwellMin||0)} min)`).join(' -> ');
    add(`   Secuencia: ${seq || '--'}`);
    if(s.omittedOptional?.length) add(`   Opcionales omitidos: ${s.omittedOptional.map(p=>p.name||'Objetivo').join(', ')}`);
  });
  rule();

  heading(`DETALLE DE RUTA - ${strategyName(report.selectedMode)}`,12);
  add(`Distancia total: ${fmtKm(report.selected?.metrics?.distanceKm)}`);
  add(`Duracion estimada: ${fmtHours(report.selected?.duration)}`);
  add(`Riesgo topografico: ${riskText(report.selected?.score)}`);
  add(`Pendiente maxima: ${fmtDeg(report.selected?.metrics?.maxSlopeDeg)}`);
  add(`Pendiente media: ${fmtDeg(report.selected?.metrics?.avgSlopeDeg)}`);
  add(`Desnivel acumulado: ${fmtM(report.selected?.metrics?.elevationChangeM)}`);
  add(`Segmentos evaluados: ${report.selected?.metrics?.segments ?? '--'}`);
  rule();

  heading('TRAMOS DE LA RUTA',12);
  report.selected?.legs?.forEach((leg,i)=>{
    const m=leg.metrics||{};
    add(`Tramo ${i+1}: ${leg.from?.name || 'Punto de salida'} -> ${leg.to?.name || 'Punto de llegada'}`);
    add(`   Distancia: ${fmtKm(m.distanceKm)} | Duracion: ${fmtHours(leg.durationHours)} | Riesgo: ${riskText(riskScoreForLeg(m))}`);
    add(`   Pendiente maxima: ${fmtDeg(m.maxSlopeDeg)} | Desnivel: ${fmtM(m.elevationChangeM)} | Segmentos: ${m.segments ?? '--'}`);
    add(`   Parada en destino: ${Number(leg.to?.dwellMin||0)} min`);
  });
  rule();

  heading('PUNTOS OPCIONALES OMITIDOS',12);
  if (report.selected?.omittedOptional?.length) {
    report.selected.omittedOptional.forEach((pt,i)=>add(`${i+1}. ${pt.name||'Objetivo'} - ${Number(pt.dwellMin||0)} min programados`));
  } else add('No se omitieron objetivos opcionales en esta estrategia.');
  rule();

  heading('FUENTES Y LIMITACIONES',12);
  add('Elevacion global: MDEM200M mediante ArcGIS ElevationLayer.');
  add('El indice de riesgo es un modelo experimental de comparacion topografica dentro de esta aplicacion; no es una certificacion de seguridad para una EVA tripulada.');
  add('Las duraciones dependen de los parametros operacionales introducidos por el usuario.');
  add('Las rutas se generan por tramos y la estrategia seleccionada modifica el coste de busqueda del recorrido.');

  function flushPage(){
    if(!lines.length) return;
    pages.push(lines); lines=[];
  }
  // Paginate conservatively by approximate line count; content is plain text.
  const all=lines.slice(); lines=[];
  let current=[]; let used=0;
  const pushPage=()=>{ if(current.length){pages.push(current);current=[];used=0;} };
  for(const item of all){
    const cost=item.rule?8:(item.size>=18?24:item.size>=12?16:13);
    if(used+cost>710){pushPage();}
    current.push(item); used+=cost;
  }
  pushPage();

  // Minimal PDF writer using standard Helvetica and Latin-safe ASCII text.
  const objects=[];
  const addObj=body=>{ objects.push(body); return objects.length; };
  const fontObj=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageObjs=[];
  for(const page of pages){
    let y=startY;
    const content=[];
    content.push('q');
    for(const item of page){
      if(item.gap){ y-=item.gap; continue; }
      if(item.rule){
        y-=3;
        content.push(`0.35 w ${bodyX} ${y} m ${pageW-margin} ${y} l S`);
        y-=8;
        continue;
      }
      const size=item.size||9;
      const font = item.bold?'F2':'F1';
      content.push(`BT /${font} ${size} Tf 0 0 0 rg ${bodyX} ${y} Td (${esc(item.t)}) Tj ET`);
      y -= size>=18?24:size>=12?16:13;
    }
    content.push(`BT /F1 7 Tf 0.35 0.35 0.35 rg ${bodyX} 26 Td (${esc('Mars Explorer - informe generado automaticamente')}) Tj ET`);
    content.push(`BT /F1 7 Tf 0.35 0.35 0.35 rg ${pageW-margin-80} 26 Td (${esc(`Pagina ${pages.indexOf(page)+1} de ${pages.length}`)}) Tj ET`);
    content.push('Q');
    const stream=content.join('\n');
    const streamObj=addObj(`<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}\nendstream`);
    pageObjs.push({streamObj});
  }
  const fontBoldObj=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  // Build pages after known resources.
  const pagesKids=[];
  for(const p of pageObjs){
    const pageObj=addObj(`<< /Type /Page /Parent PAGES /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${fontBoldObj} 0 R >> >> /Contents ${p.streamObj} 0 R >>`);
    pagesKids.push(pageObj);
  }
  const kids=pagesKids.map(n=>`${n} 0 R`).join(' ');
  const pagesObj=addObj(`<< /Type /Pages /Count ${pagesKids.length} /Kids [${kids}] >>`);
  // Patch parent references in page objects.
  for(const n of pagesKids){
    objects[n-1]=objects[n-1].replace('PARENT_PLACEHOLDER','').replace('/Parent PAGES','/Parent ' + pagesObj + ' 0 R');
  }
  const infoObj=addObj(`<< /Title (${esc('Mars Explorer - Informe de mision')}) /Author (${esc('Mars Explorer')}) /Subject (${esc('Planificacion de travesia cientifica en Marte')}) >>`);
  const catalogObj=addObj(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf='%PDF-1.4\n';
  const offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets[i+1]=Buffer.byteLength(pdf,'binary');
    pdf += `${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'binary');
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++) pdf += `${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length+1} /Root ${catalogObj} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'binary');
}

function riskScoreForLeg(m){
  if(!m || !Number.isFinite(Number(m.maxSlopeDeg))) return null;
  const slopePenalty=Math.min(1,Math.max(0,Number(m.maxSlopeDeg)/25))*70;
  const terrainPenalty=Math.min(1,Math.max(0,(Number(m.elevationChangeM)||0)/1000))*20;
  const avgPenalty=Math.min(1,Math.max(0,(Number(m.avgSlopeDeg)||0)/18))*10;
  return Math.round(Math.min(100,slopePenalty+terrainPenalty+avgPenalty));
}
