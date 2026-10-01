import { Buffer } from 'node:buffer';

// PDF sin dependencias externas. Helvetica + WinAnsi permite conservar tildes y ñ.
const esc = value => String(value ?? '')
  .replace(/[–—]/g, '-')
  .replace(/→/g, '->')
  .replace(/≤/g, '<=')
  .replace(/≥/g, '>=')
  .replace(/€/g, 'EUR')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function wrap(text, max = 91) {
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

const finite = v => Number.isFinite(Number(v));
const n = (v, fallback = null) => finite(v) ? Number(v) : fallback;
function fmtKm(v){ return finite(v) ? `${Number(v).toFixed(2)} km` : '--'; }
function fmtM(v){ return finite(v) ? `${Math.round(Number(v))} m` : '--'; }
function fmtDeg(v){ return finite(v) ? `${Number(v).toFixed(1)}°` : '--'; }
function fmtHours(v){
  const h = Number(v);
  if (!Number.isFinite(h)) return '--';
  const sign = h < 0 ? '-' : '';
  const mins = Math.max(0, Math.round(Math.abs(h) * 60));
  return `${sign}${Math.floor(mins/60)} h ${String(mins%60).padStart(2,'0')} min`;
}
function fmtDate(iso){
  try { return new Date(iso).toLocaleString('es-NI', {dateStyle:'long', timeStyle:'short'}).replace(/,/g,''); }
  catch { return iso || '--'; }
}
function fmtLat(v){
  if(!finite(v)) return '--';
  const x=Number(v); return `${Math.abs(x).toFixed(5)}° ${x<0?'S':'N'}`;
}
function fmtLon(v){
  if(!finite(v)) return '--';
  const x=Number(v); return `${Math.abs(x).toFixed(5)}° ${x<0?'O':'E'}`;
}
function coordText(p){ return p ? `${fmtLat(p.lat)} · ${fmtLon(p.lon)}` : '--'; }
function strategyName(mode){ return mode==='distance'?'Más directa':mode==='risk'?'Menor exposición':'Equilibrada'; }
function riskText(score){
  const value=Number(score); if(!Number.isFinite(value)) return 'Sin evaluación';
  const label=value<30?'Bajo':value<55?'Moderado':value<75?'Alto':'Muy alto';
  return `${label} (${Math.round(value)}/100)`;
}
function minEvaHours(mission){
  const margin = Number(mission?.params?.returnMargin ?? 25) / 100;
  const duration = Number(mission?.duration);
  if (!Number.isFinite(duration)) return null;
  return duration / Math.max(0.2, 1 - margin);
}
function riskScoreForLeg(m){
  if(!m || !finite(m.maxSlopeDeg)) return null;
  const slopePenalty=Math.min(1,Math.max(0,Number(m.maxSlopeDeg)/25))*70;
  const terrainPenalty=Math.min(1,Math.max(0,(Number(m.elevationChangeM)||0)/1000))*20;
  const avgPenalty=Math.min(1,Math.max(0,(Number(m.avgSlopeDeg)||0)/18))*10;
  return Math.round(Math.min(100,slopePenalty+terrainPenalty+avgPenalty));
}
function pointStatus(pt){
  if(pt?.type==='base') return 'BASE';
  return pt?.required ? 'OBLIGATORIO' : 'OPCIONAL';
}
function safeNumber(v,digits=2){ return finite(v)?Number(v).toFixed(digits):'--'; }

export function buildMissionPdf(report){
  const pageW=612, pageH=792, margin=42, bodyX=margin, startY=748;
  const pages=[];
  let items=[];

  const add=(text='',opts={})=>{
    const indent=opts.indent||0;
    const size=opts.size||9;
    const max=opts.max||Math.max(45,91-indent);
    wrap(text,max).forEach(line=>items.push({kind:'text',text:' '.repeat(indent)+line,size,bold:!!opts.bold,color:opts.color||'body'}));
  };
  const heading=(text,size=12)=>{ items.push({kind:'gap',h:5}); items.push({kind:'heading',text,size,bold:true,color:'heading'}); items.push({kind:'gap',h:4}); };
  const subheading=(text)=>items.push({kind:'subheading',text,size:9.5,bold:true,color:'sand'});
  const rule=()=>items.push({kind:'rule'});
  const tableRow=(cols,widths,{header=false}={})=>{
    let line='';
    cols.forEach((c,i)=>{ const w=widths[i]; line += String(c ?? '').slice(0,w).padEnd(w) + (i===cols.length-1?'':'  '); });
    items.push({kind:'text',text:line,bold:header,size:header?7.8:7.4,color:header?'sand':'body'});
  };

  // Encabezado / identificación
  items.push({kind:'title',text:'JEZERO',size:22,bold:true,color:'copper'});
  add('Informe completo de planificación de travesía científica EVA en Marte',{size:10,bold:true});
  add(`Identificador del informe: ${report.reportId || '--'}`);
  add(`Generado: ${fmtDate(report.generatedAt)}`);
  add(`Versión del sistema: ${report.software?.version || '--'} · Tema: ${report.software?.interfaceTheme || 'Jezero Sand'} · Idioma: español`);
  rule();

  heading('1. IDENTIFICACIÓN Y RESUMEN DE LA MISIÓN');
  add(`Nombre: ${report.mission?.name || 'Misión EVA'}`);
  add(`Estrategia seleccionada: ${strategyName(report.selectedMode)}`);
  add(`Estado operacional del cálculo: ${report.selected?.overBudget ? 'FUERA DEL LÍMITE CONFIGURADO' : 'DENTRO DE LOS PARÁMETROS CONFIGURADOS'}`);
  add(`Regreso a la base al finalizar: ${report.returnBase ? 'Sí' : 'No'}`);
  add(`Puntos planificados: ${report.points?.length ?? 0} · Obligatorios/base: ${report.mission?.requiredPoints ?? '--'} · Opcionales: ${report.mission?.optionalPoints ?? '--'}`);
  add(`Puntos incluidos en la estrategia seleccionada: ${report.selected?.includedPoints?.length ?? report.selected?.sequence?.length ?? 0}`);
  add(`Objetivos opcionales omitidos: ${report.selected?.omittedOptional?.length ?? 0}`);
  if(report.mission?.base) add(`Base de misión: ${report.mission.base.name || 'Base'} · ${coordText(report.mission.base)}`);
  if(report.mission?.calculationTimestamp) add(`Último cálculo de la misión: ${fmtDate(report.mission.calculationTimestamp)}`);
  rule();

  heading('2. PARÁMETROS OPERACIONALES');
  const p=report.params||{};
  add(`Velocidad nominal configurada: ${finite(p.speed)?Number(p.speed).toFixed(2):'--'} km/h`);
  add(`Tiempo máximo EVA configurado: ${finite(p.evaTime)?Number(p.evaTime).toFixed(2):'--'} h`);
  add(`Margen reservado para retorno: ${finite(p.returnMargin)?Number(p.returnMargin).toFixed(0):'--'} %`);
  add(`Tiempo disponible para la misión después de la reserva: ${fmtHours(report.selected?.availableHours)}`);
  add(`Tiempo mínimo de EVA necesario para conservar el margen configurado: ${fmtHours(minEvaHours(report.selected))}`);
  const dwellH=(Number(report.selected?.dwellMinutes)||0)/60;
  const travelH=(Number(report.selected?.duration)||0)-dwellH;
  add(`Tiempo total programado en objetivos: ${fmtHours(dwellH)} (${Number(report.selected?.dwellMinutes)||0} min)`);
  add(`Tiempo estimado de desplazamiento: ${fmtHours(travelH)}`);
  add(`Duración total estimada: ${fmtHours(report.selected?.duration)}`);
  add(`Margen operacional restante: ${fmtHours((Number(report.selected?.availableHours)||0)-(Number(report.selected?.duration)||0))}`);
  add('Oxígeno, batería y control térmico: NO MODELADOS EN V27. JEZERO no inventa estimaciones de recursos que aún no forman parte del motor.');
  rule();

  heading('3. TODOS LOS PUNTOS PLANIFICADOS');
  tableRow(['#','Nombre','Tipo','Latitud','Longitud','Parada'],[3,25,12,15,16,8],{header:true});
  (report.points||[]).forEach((pt,i)=>{
    tableRow([i+1,pt.name||`Punto ${i+1}`,pointStatus(pt),fmtLat(pt.lat),fmtLon(pt.lon),`${Number(pt.dwellMin||0)} min`],[3,25,12,15,16,8]);
    add(`   Requerido: ${pt.required?'Sí':'No'} · Elevación del punto: ${finite(pt.elevationM)?fmtM(pt.elevationM):'no almacenada en el punto maestro'}`,{size:7.6});
  });
  rule();

  heading('4. SECUENCIA SELECCIONADA');
  const selectedPoints=report.selected?.includedPoints || report.selected?.sequence || [];
  selectedPoints.forEach((pt,i)=>{
    add(`${i+1}. ${pt.name || `Punto ${i+1}`} · ${pointStatus(pt)} · ${coordText(pt)} · parada ${Number(pt.dwellMin||0)} min`,{bold:i===0});
  });
  if(!selectedPoints.length) add('No hay secuencia seleccionada disponible.');
  rule();

  heading('5. MÉTRICAS COMPLETAS DE LA RUTA SELECCIONADA');
  const sm=report.selected?.metrics||{};
  add(`Estrategia: ${strategyName(report.selectedMode)}`);
  if(report.selected?.strategyDescription) add(`Descripción: ${report.selected.strategyDescription}`);
  add(`Distancia total: ${fmtKm(sm.distanceKm)}`);
  add(`Duración estimada: ${fmtHours(report.selected?.duration)}`);
  add(`Dificultad topográfica experimental: ${riskText(report.selected?.score)}`);
  add(`Pendiente máxima: ${fmtDeg(sm.maxSlopeDeg)}`);
  add(`Pendiente media: ${fmtDeg(sm.avgSlopeDeg)}`);
  add(`Ascenso acumulado: ${fmtM(sm.gainM)}`);
  add(`Descenso acumulado: ${fmtM(sm.descentM)}`);
  add(`Variación altimétrica acumulada: ${fmtM(sm.elevationChangeM)}`);
  add(`Segmentos evaluados: ${sm.segments ?? '--'}`);
  add(`Tramos de misión: ${report.selected?.legs?.length ?? 0}`);
  add(`Tiempo disponible: ${fmtHours(report.selected?.availableHours)} · Excede límite: ${report.selected?.overBudget?'Sí':'No'}`);
  rule();

  heading('6. LÍNEA BASE DE OBJETIVOS OBLIGATORIOS');
  const rb=report.selected?.requiredBaseline;
  if(rb){
    add(`Duración si se visitan únicamente base/objetivos obligatorios: ${fmtHours(rb.duration)}`);
    add(`Tiempo programado en objetivos obligatorios: ${fmtHours((Number(rb.dwellMinutes)||0)/60)}`);
    add(`Dificultad topográfica: ${riskText(rb.score)}`);
    add(`Distancia: ${fmtKm(rb.metrics?.distanceKm)} · Pendiente máxima: ${fmtDeg(rb.metrics?.maxSlopeDeg)} · Pendiente media: ${fmtDeg(rb.metrics?.avgSlopeDeg)}`);
    add(`Secuencia: ${(rb.sequence||[]).map(x=>x.name||'Punto').join(' -> ') || '--'}`);
  } else add('No se recibió una línea base independiente para objetivos obligatorios.');
  rule();

  heading('7. COMPARACIÓN DE LAS TRES ESTRATEGIAS');
  tableRow(['Estrategia','Distancia','Duración','Mín. EVA','Dificultad','Estado'],[18,13,13,13,17,11],{header:true});
  (report.strategies||[]).forEach(s=>{
    tableRow([strategyName(s.mode),fmtKm(s.metrics?.distanceKm),fmtHours(s.duration),fmtHours(minEvaHours(s)),riskText(s.score),s.overBudget?'FUERA':'OK'],[18,13,13,13,17,11]);
    add(`   Descripción: ${s.strategyDescription || '--'}`,{size:7.6});
    add(`   Secuencia: ${(s.includedPoints||s.sequence||[]).map(x=>x.type==='base'?'BASE':x.name||'Objetivo').join(' -> ') || '--'}`,{size:7.6});
    add(`   Pendiente máx.: ${fmtDeg(s.metrics?.maxSlopeDeg)} · media: ${fmtDeg(s.metrics?.avgSlopeDeg)} · ascenso: ${fmtM(s.metrics?.gainM)} · descenso: ${fmtM(s.metrics?.descentM)} · segmentos: ${s.metrics?.segments ?? '--'}`,{size:7.6});
    add(`   Opcionales omitidos: ${s.omittedOptional?.length ? s.omittedOptional.map(x=>x.name||'Objetivo').join(', ') : 'ninguno'}`,{size:7.6});
  });
  rule();

  heading('8. DETALLE DE TRAMOS DE LA ESTRATEGIA SELECCIONADA');
  (report.selected?.legs||[]).forEach((leg,i)=>{
    const m=leg.metrics||{};
    subheading(`Tramo ${i+1}: ${leg.from?.name || 'Salida'} -> ${leg.to?.name || 'Llegada'}`);
    add(`Origen: ${coordText(leg.from)} · Destino: ${coordText(leg.to)}`);
    add(`Distancia: ${fmtKm(m.distanceKm)} · Duración: ${fmtHours(leg.durationHours)} · Dificultad: ${riskText(riskScoreForLeg(m))}`);
    add(`Pendiente máxima: ${fmtDeg(m.maxSlopeDeg)} · Pendiente media: ${fmtDeg(m.avgSlopeDeg)}`);
    add(`Ascenso: ${fmtM(m.gainM)} · Descenso: ${fmtM(m.descentM)} · Variación altimétrica: ${fmtM(m.elevationChangeM)} · Segmentos: ${m.segments ?? '--'}`);
    add(`Parada programada al llegar: ${Number(leg.to?.dwellMin||0)} min · Nodos almacenados de la trayectoria: ${leg.path?.length ?? 0}`);
  });
  if(!(report.selected?.legs||[]).length) add('No existen tramos calculados en la estrategia seleccionada.');
  rule();

  heading('9. OBJETIVOS OPCIONALES OMITIDOS');
  if(report.selected?.omittedOptional?.length){
    report.selected.omittedOptional.forEach((pt,i)=>add(`${i+1}. ${pt.name||'Objetivo'} · ${coordText(pt)} · ${Number(pt.dwellMin||0)} min programados`));
  } else add('No se omitieron objetivos opcionales en la estrategia seleccionada.');
  rule();

  heading('10. DATOS DE FUENTE Y CONFIGURACIÓN TÉCNICA');
  add(`Modelo de elevación: ${report.dataSources?.elevation || 'MDEM200M mediante ArcGIS ElevationLayer'}`);
  add(`Cartografía / procedencia: ${report.dataSources?.cartography || 'NASA / USGS / ESA / HRSC'}`);
  add(`Mapa/base visual: ${report.dataSources?.map || 'capas configuradas en JEZERO'}`);
  add(`Radio marciano usado para distancias: ${finite(report.dataSources?.marsRadiusKm)?Number(report.dataSources.marsRadiusKm).toFixed(1):'3389.5'} km`);
  add(`Motor: A* sobre corredor de búsqueda 2D adaptado al tramo. Estrategias: más directa, equilibrada y menor exposición.`);
  add(`Modelo de duración: velocidad nominal ajustada por pendiente media más tiempos de permanencia en objetivos.`);
  add(`Modelo de dificultad: combinación experimental de pendiente máxima, pendiente media y cambio de elevación.`);
  rule();

  heading('11. LIMITACIONES Y SEGURIDAD');
  add('JEZERO V27 es una herramienta de planificación y simulación. El índice de dificultad topográfica NO constituye una certificación de seguridad para una EVA tripulada.');
  add('La resolución y calidad de la ruta dependen de los datos de elevación disponibles. MDEM200M es apropiado para planificación regional, no para detectar obstáculos de escala humana como rocas pequeñas, zanjas o bordes locales.');
  add('Los estados futuros de peligros deberán distinguir SEGURO, NO SEGURO y DESCONOCIDO. Un área sin datos no debe interpretarse automáticamente como segura.');
  add('Oxígeno, batería, comunicaciones, temperatura, radiación, localización en tiempo real y esfuerzo metabólico aún no forman parte del cálculo operativo de V27.');
  rule();

  // Apéndice exhaustivo: conserva todos los nodos calculados para las tres estrategias.
  heading('12. APÉNDICE TÉCNICO - NODOS DE TODAS LAS RUTAS CALCULADAS');
  add('Las siguientes tablas incluyen cada nodo de trayectoria enviado por el motor al informe: coordenadas y elevación cuando está disponible. Esto permite auditar la geometría utilizada en cada estrategia.');
  (report.strategies||[]).forEach((s,si)=>{
    subheading(`${12}.${si+1} Estrategia ${strategyName(s.mode)} · ${s.legs?.length ?? 0} tramo(s)`);
    (s.legs||[]).forEach((leg,li)=>{
      add(`Tramo ${li+1}: ${leg.from?.name||'Salida'} -> ${leg.to?.name||'Llegada'} · ${fmtKm(leg.metrics?.distanceKm)} · ${fmtHours(leg.durationHours)}`,{bold:true,size:8.2});
      tableRow(['Nodo','Latitud','Longitud','Elevación'],[8,18,18,16],{header:true});
      (leg.path||[]).forEach((node,ni)=>tableRow([node.index ?? ni+1,fmtLat(node.lat),fmtLon(node.lon),finite(node.elevationM)?fmtM(node.elevationM):'--'],[8,18,18,16]));
      if(!(leg.path||[]).length) add('   Sin nodos de trayectoria almacenados.',{size:7.6});
    });
  });

  // Paginación aproximada.
  let current=[]; let used=0;
  const costOf=item=>{
    if(item.kind==='title') return 30;
    if(item.kind==='heading') return item.size>=14?23:19;
    if(item.kind==='subheading') return 15;
    if(item.kind==='rule') return 10;
    if(item.kind==='gap') return item.h||5;
    return item.size>=10?15:item.size>=8.5?12:10.5;
  };
  const pushPage=()=>{ if(current.length){ pages.push(current); current=[]; used=0; } };
  for(const item of items){
    const cost=costOf(item);
    if(used+cost>704) pushPage();
    current.push(item); used+=cost;
  }
  pushPage();

  const objects=[];
  const addObj=body=>{ objects.push(body); return objects.length; };
  const fontObj=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldObj=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const colors={
    body:'0.12 0.10 0.08',
    heading:'0.36 0.20 0.12',
    sand:'0.55 0.36 0.20',
    copper:'0.65 0.29 0.16',
    muted:'0.38 0.34 0.30'
  };
  const pageObjs=[];

  for(let pi=0;pi<pages.length;pi++){
    const page=pages[pi];
    let y=startY;
    const content=['q'];
    // Franja superior Jezero Sand.
    content.push('0.83 0.65 0.45 rg 0 770 612 22 re f');
    content.push('0.07 0.06 0.05 rg 0 0 612 20 re f');
    for(const item of page){
      if(item.kind==='gap'){ y-=item.h||5; continue; }
      if(item.kind==='rule'){
        y-=3; content.push(`0.70 0.58 0.46 RG 0.45 w ${bodyX} ${y} m ${pageW-margin} ${y} l S`); y-=8; continue;
      }
      const size=item.size||9;
      const font=item.bold?'F2':'F1';
      const color=colors[item.color]||colors.body;
      if(item.kind==='heading'){
        content.push(`0.96 0.90 0.82 rg ${bodyX-5} ${y-4} ${pageW-margin-(bodyX-5)} 18 re f`);
      }
      content.push(`BT /${font} ${size} Tf ${color} rg ${bodyX} ${y} Td (${esc(item.text)}) Tj ET`);
      y-=costOf(item);
    }
    content.push(`BT /F1 7 Tf 0.72 0.65 0.58 rg ${bodyX} 7 Td (${esc('JEZERO - informe completo de misión generado automáticamente')}) Tj ET`);
    content.push(`BT /F1 7 Tf 0.72 0.65 0.58 rg ${pageW-margin-78} 7 Td (${esc(`Página ${pi+1} de ${pages.length}`)}) Tj ET`);
    content.push('Q');
    const stream=content.join('\n');
    const streamObj=addObj(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`);
    pageObjs.push({streamObj});
  }

  const pagesKids=[];
  for(const p of pageObjs){
    const pageObj=addObj(`<< /Type /Page /Parent PAGES /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${fontBoldObj} 0 R >> >> /Contents ${p.streamObj} 0 R >>`);
    pagesKids.push(pageObj);
  }
  const pagesObj=addObj(`<< /Type /Pages /Count ${pagesKids.length} /Kids [${pagesKids.map(v=>`${v} 0 R`).join(' ')}] >>`);
  for(const objNo of pagesKids) objects[objNo-1]=objects[objNo-1].replace('/Parent PAGES',`/Parent ${pagesObj} 0 R`);
  const infoObj=addObj(`<< /Title (${esc('JEZERO - Informe completo de misión')}) /Author (${esc('JEZERO')}) /Subject (${esc('Planificación de travesía científica EVA en Marte')}) >>`);
  const catalogObj=addObj(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf='%PDF-1.4\n';
  const offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets[i+1]=Buffer.byteLength(pdf,'latin1');
    pdf += `${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'latin1');
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++) pdf += `${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length+1} /Root ${catalogObj} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'latin1');
}
