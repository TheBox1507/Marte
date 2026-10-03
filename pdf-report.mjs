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
function fmtDate(iso, locale='es-NI'){
  try { return new Date(iso).toLocaleString(locale, {dateStyle:'long', timeStyle:'short'}).replace(/,/g,''); }
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
  const slopePenalty=Math.min(1,Math.max(0,Number(m.maxSlopeDeg)/25))*35;
  const transitPenalty=Math.min(1,Math.max(0,(100-Number(m.minTransitability ?? 100))/100))*30;
  const uncertaintyPenalty=Math.min(1,Math.max(0,(100-Number(m.avgConfidence ?? 100))/100))*20;
  const roughnessPenalty=Math.min(1,Math.max(0,(Number(m.avgRoughnessDeg)||0)/10))*15;
  return Math.round(Math.min(100,slopePenalty+transitPenalty+uncertaintyPenalty+roughnessPenalty));
}
function pointStatus(pt){
  if(pt?.type==='base') return 'BASE';
  return pt?.required ? 'OBLIGATORIO' : 'OPCIONAL';
}
function safeNumber(v,digits=2){ return finite(v)?Number(v).toFixed(digits):'--'; }

function marsDistanceKm(a,b){
  if(!a||!b||!finite(a.lat)||!finite(a.lon)||!finite(b.lat)||!finite(b.lon)) return 0;
  const rad=Math.PI/180, R=3389.5;
  const p1=Number(a.lat)*rad,p2=Number(b.lat)*rad;
  let dlon=(Number(b.lon)-Number(a.lon))*rad;
  dlon=((dlon+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  const dlat=p2-p1;
  const h=Math.sin(dlat/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function terrainProfileFromLegs(legs=[]){
  const pts=[]; let km=0,prev=null;
  for(const leg of legs){
    for(let i=0;i<(leg.path||[]).length;i++){
      if(pts.length && i===0) continue;
      const node=leg.path[i];
      if(prev) km+=marsDistanceKm(prev,node);
      if(finite(node?.elevationM)) pts.push({km,elevationM:Number(node.elevationM)});
      prev=node;
    }
  }
  return pts;
}
function terrainSummary(selected){
  const profile=terrainProfileFromLegs(selected?.legs||[]);
  const elevations=profile.map(x=>x.elevationM).filter(Number.isFinite);
  const hardest=(selected?.legs||[]).map((leg,i)=>({leg,i,score:riskScoreForLeg(leg.metrics||{})}))
    .sort((a,b)=>(b.score??-1)-(a.score??-1))[0] || null;
  return {
    profile,
    startElevationM:elevations.length?elevations[0]:null,
    endElevationM:elevations.length?elevations[elevations.length-1]:null,
    minElevationM:elevations.length?Math.min(...elevations):null,
    maxElevationM:elevations.length?Math.max(...elevations):null,
    reliefM:elevations.length?Math.max(...elevations)-Math.min(...elevations):null,
    hardest
  };

}
function analyticsProfileFromLegs(legs=[]){
  const pts=[]; let km=0,prev=null;
  for(const leg of legs){
    for(let i=0;i<(leg.path||[]).length;i++){
      if(pts.length && i===0) continue;
      const node=leg.path[i];
      if(prev) km+=marsDistanceKm(prev,node);
      pts.push({
        km,
        elevationM:finite(node?.elevationM)?Number(node.elevationM):null,
        slope:finite(node?.signedSlopeDeg)?Number(node.signedSlopeDeg):null,
        transit:finite(node?.transitability)?Number(node.transitability):finite(node?.baseTransitability)?Number(node.baseTransitability):null,
        confidence:finite(node?.edgeConfidence)?Number(node.edgeConfidence):finite(node?.dataConfidence)?Number(node.dataConfidence):null,
        roughness:finite(node?.localRoughnessDeg)?Number(node.localRoughnessDeg):null
      });
      prev=node;
    }
  }
  return pts;
}
function weightedBins(points,key,classifier,labels){
  const sums=Object.fromEntries(labels.map(l=>[l,0])); let total=0;
  for(let i=1;i<points.length;i++){
    const d=Math.max(0,Number(points[i].km)-Number(points[i-1].km)); const v=Number(points[i][key]);
    if(!Number.isFinite(d)||!Number.isFinite(v)||d<=0) continue;
    const label=classifier(v); if(Object.hasOwn(sums,label)){sums[label]+=d;total+=d;}
  }
  return labels.map(label=>({label,value:total?sums[label]/total*100:0,km:sums[label]}));
}
function scienceProgress(selected){
  const out=[{km:0,value:0,label:'BASE'}]; let km=0,value=0;
  (selected?.legs||[]).forEach((leg,i)=>{
    km+=Number(leg.metrics?.distanceKm)||0;
    if(leg.to?.type!=='base') value+=Number(leg.to?.scienceValue)||0;
    out.push({km,value,label:leg.to?.type==='base'?'HOME':`S${String(i+1).padStart(2,'0')}`});
  });
  return out;
}
function operationalHealth(selected){
  const available=Number(selected?.availableHours); const duration=Number(selected?.duration); const margin=available-duration;
  const distance=Math.max(.001,Number(selected?.metrics?.distanceKm)||1); const uncertain=Number(selected?.metrics?.uncertainDistanceKm)||0;
  return [
    {label:'Cobertura científica',value:Math.max(0,Math.min(100,Number(selected?.scienceEfficiency)||0))},
    {label:'Transitabilidad media',value:Math.max(0,Math.min(100,Number(selected?.metrics?.avgTransitability)||0))},
    {label:'Confianza cartográfica',value:Math.max(0,Math.min(100,Number(selected?.metrics?.avgConfidence)||0))},
    {label:'Terreno / dificultad',value:Math.max(0,Math.min(100,100-(Number(selected?.score)||0)))},
    {label:'Reserva de retorno',value:margin>0&&available>0?Math.max(0,Math.min(100,margin/available*100)):0},
    {label:'Cobertura de terreno',value:Math.max(0,Math.min(100,100-uncertain/distance*100))}
  ];
}

const PDF_THEME_HEX={
  'nasa-classic':{body:'#0A1729',heading:'#0B3D91',accent:'#1769D2',title:'#FC3D21',muted:'#4D6B8A',light:'#E8F2FA',bar:'#071321'},
  'artemis-lunar':{body:'#151B22',heading:'#263B52',accent:'#5EA6FF',title:'#788B9E',muted:'#607080',light:'#EEF2F6',bar:'#0C1015'},
  'deep-space':{body:'#171026',heading:'#432B80',accent:'#7056D9',title:'#D14CFF',muted:'#6D5D8A',light:'#F1ECFA',bar:'#090713'},
  'mars-science':{body:'#24100C',heading:'#7D2A1C',accent:'#C4472F',title:'#F49B63',muted:'#7E584C',light:'#FAEEE9',bar:'#100807'},
  'aurora-teal':{body:'#092224',heading:'#0D5C63',accent:'#168E96',title:'#1E9E8B',muted:'#4F797B',light:'#E8F7F7',bar:'#041213'},
  'eva-contrast':{body:'#090909',heading:'#20262E',accent:'#454B52',title:'#B29F00',muted:'#555B61',light:'#F1F1F1',bar:'#000000'}
};
function pdfTheme(report){ return PDF_THEME_HEX[report?.software?.themeKey] || PDF_THEME_HEX['nasa-classic']; }
function hexRgbPdf(hex){
  const h=String(hex||'#000000').replace('#','').padEnd(6,'0').slice(0,6);
  const vals=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
  return vals.map(v=>(Math.round(v*1000)/1000).toString()).join(' ');
}

const PDF_EN_REPLACEMENTS = [
  ['Informe completo de planificación de travesía científica EVA en Marte - motor multicriterio V35','Complete Mars EVA scientific traverse planning report - multicriteria engine V35'],
  ['IDENTIFICACIÓN Y RESUMEN DE LA MISIÓN','MISSION IDENTIFICATION AND SUMMARY'],
  ['PARÁMETROS OPERACIONALES','OPERATIONAL PARAMETERS'],['TODOS LOS PUNTOS PLANIFICADOS','ALL PLANNED POINTS'],['SECUENCIA SELECCIONADA','SELECTED SEQUENCE'],['MÉTRICAS COMPLETAS DE LA RUTA SELECCIONADA','COMPLETE SELECTED ROUTE METRICS'],['LÍNEA BASE DE OBJETIVOS OBLIGATORIOS','REQUIRED-TARGET BASELINE'],['COMPARACIÓN DE LAS TRES ESTRATEGIAS','THREE-STRATEGY COMPARISON'],['DETALLE DE TRAMOS DE LA ESTRATEGIA SELECCIONADA','SELECTED-STRATEGY LEG DETAILS'],['OBJETIVOS OPCIONALES OMITIDOS','OMITTED OPTIONAL TARGETS'],['DATOS DE FUENTE Y CONFIGURACIÓN TÉCNICA','DATA SOURCES AND TECHNICAL CONFIGURATION'],['LIMITACIONES Y SEGURIDAD','LIMITATIONS AND SAFETY'],['APÉNDICE TÉCNICO - NODOS DE TODAS LAS RUTAS CALCULADAS','TECHNICAL APPENDIX - NODES FROM ALL CALCULATED ROUTES'],
  ['Identificador del informe','Report identifier'],['Generado','Generated'],['Versión del sistema','System version'],['Tema de interfaz','Interface theme'],['Idioma','Language'],['Nombre','Name'],['Código / ID','Code / ID'],['Tripulación','Crew'],['Notas del plan','Plan notes'],['Estrategia seleccionada','Selected strategy'],['Estado operacional del cálculo','Calculation operational status'],['Regreso a la base al finalizar','Return to base at end'],['Puntos planificados','Planned points'],['Obligatorios/base','Required/base'],['Opcionales','Optional'],['Puntos incluidos en la estrategia seleccionada','Points included in selected strategy'],['Objetivos opcionales omitidos','Omitted optional targets'],['Base de misión','Mission base'],['Último cálculo de la misión','Last mission calculation'],
  ['Velocidad nominal configurada','Configured nominal speed'],['Tiempo máximo EVA configurado','Configured maximum EVA time'],['Margen reservado para retorno','Reserved return margin'],['Pendiente máxima permitida (límite duro)','Maximum allowed slope (hard limit)'],['Transitabilidad mínima permitida (límite duro)','Minimum allowed traversability (hard limit)'],['Confianza cartográfica mínima permitida (límite duro)','Minimum cartographic confidence (hard limit)'],['Tiempo disponible para la misión después de la reserva','Mission time available after reserve'],['Tiempo mínimo de EVA necesario para conservar el margen configurado','Minimum EVA time needed to preserve configured margin'],['Tiempo total programado en objetivos','Total scheduled target time'],['Tiempo estimado de desplazamiento','Estimated travel time'],['Duración total estimada','Total estimated duration'],['Margen operacional restante','Remaining operational margin'],['Oxígeno, batería y control térmico: NO MODELADOS EN V35. JEZERO no inventa estimaciones de recursos que aún no forman parte del motor.','Oxygen, battery and thermal control: NOT MODELED IN V35. JEZERO does not invent resource estimates that are not yet part of the engine.'],
  ['Nombre','Name'],['Tipo','Type'],['Latitud','Latitude'],['Longitud','Longitude'],['Ciencia','Science'],['Parada','Stop'],['Requerido','Required'],['Categoría científica','Science category'],['Elevación del punto','Point elevation'],['no almacenada en el punto maestro','not stored in master point'],['Nota científica','Science note'],
  ['Estrategia','Strategy'],['Descripción','Description'],['Distancia total','Total distance'],['Duración estimada','Estimated duration'],['Dificultad multicriterio experimental','Experimental multicriteria difficulty'],['Pendiente máxima','Maximum slope'],['Pendiente media absoluta','Average absolute slope'],['Pendiente máxima de subida','Maximum uphill slope'],['pendiente máxima de bajada','maximum downhill slope'],['Transitabilidad media','Average traversability'],['mínima','minimum'],['Confianza cartográfica media','Average cartographic confidence'],['Rugosidad angular media estimada','Estimated average angular roughness'],['distancia con confianza <50%','distance with confidence <50%'],['distancia difícil','difficult distance'],['Valor científico incluido','Included science value'],['puntos de','points out of'],['potenciales','potential'],['cobertura científica','science coverage'],['Ascenso acumulado','Total ascent'],['Descenso acumulado','Total descent'],['Variación altimétrica acumulada','Total elevation variation'],['Segmentos evaluados','Evaluated segments'],['Tramos de misión','Mission legs'],['Tiempo disponible','Available time'],['Excede límite','Exceeds limit'],
  ['Duración si se visitan únicamente base/objetivos obligatorios','Duration if only base/required targets are visited'],['Tiempo programado en objetivos obligatorios','Scheduled time at required targets'],['Dificultad multicriterio','Multicriteria difficulty'],['valor científico obligatorio','required science value'],['Distancia','Distance'],['Pendiente media','Average slope'],['Secuencia','Sequence'],['No se recibió una línea base independiente para objetivos obligatorios.','No independent required-target baseline was received.'],
  ['Mín. EVA','Min. EVA'],['Dificultad','Difficulty'],['Estado','Status'],['FUERA','OUT'],['Descripción','Description'],['subida máx.','max uphill'],['bajada máx.','max downhill'],['transitabilidad','traversability'],['confianza','confidence'],['Ascenso','Ascent'],['descenso','descent'],['segmentos','segments'],['ciencia','science'],['Opcionales omitidos','Omitted optional targets'],['ninguno','none'],
  ['Tramo','Leg'],['Salida','Start'],['Llegada','Arrival'],['Origen','Origin'],['Destino','Destination'],['Duración','Duration'],['media','average'],['Transitabilidad media/mínima','Average/minimum traversability'],['confianza media/mínima','average/minimum confidence'],['separación de malla','grid spacing'],['Variación altimétrica','Elevation variation'],['Parada programada al llegar','Scheduled stop on arrival'],['Nodos almacenados de la trayectoria','Stored path nodes'],['No existen tramos calculados en la estrategia seleccionada.','No calculated legs exist for the selected strategy.'],
  ['No se omitieron objetivos opcionales en la estrategia seleccionada.','No optional targets were omitted in the selected strategy.'],['Modelo de elevación','Elevation model'],['Cartografía / procedencia','Cartography / provenance'],['Mapa/base visual','Map / visual basemap'],['Radio marciano usado para distancias','Martian radius used for distances'],['Motor: A* sobre corredor de búsqueda 2D adaptado al tramo. Estrategias: más directa, equilibrada y menor exposición.','Engine: A* over a 2D search corridor adapted to each leg. Strategies: most direct, balanced and lower exposure.'],['Modelo de duración: velocidad nominal ajustada por pendiente media más tiempos de permanencia en objetivos.','Duration model: nominal speed adjusted by average slope plus target dwell times.'],['Motor V35: A* multicriterio con pendiente direccional, transitabilidad, rugosidad local, incertidumbre/confianza cartográfica y límites duros configurables.','V35 engine: multicriteria A* with directional slope, traversability, local roughness, uncertainty/cartographic confidence and configurable hard limits.'],['Selección científica: los objetivos opcionales se priorizan por valor científico frente al costo incremental de distancia, tiempo, dificultad y confianza de la ruta.','Science selection: optional targets are prioritized by science value versus incremental distance, time, difficulty and route-confidence cost.'],['Modelo de dificultad: combina pendiente, transitabilidad mínima, confianza cartográfica y rugosidad angular. Los límites duros excluyen segmentos del grafo; no son simples penalizaciones.','Difficulty model: combines slope, minimum traversability, cartographic confidence and angular roughness. Hard limits exclude graph segments; they are not simple penalties.'],
  ['JEZERO V35 es una herramienta de planificación y simulación. Sus índices de transitabilidad, confianza y dificultad NO constituyen una certificación de seguridad para una EVA tripulada.','JEZERO V35 is a planning and simulation tool. Its traversability, confidence and difficulty indices DO NOT constitute a safety certification for crewed EVA.'],['La resolución y calidad de la ruta dependen de los datos de elevación disponibles. MDEM200M es apropiado para planificación regional, no para detectar obstáculos de escala humana como rocas pequeñas, zanjas o bordes locales.','Route resolution and quality depend on available elevation data. MDEM200M is appropriate for regional planning, not for detecting human-scale obstacles such as small rocks, trenches or local edges.'],['El motor V35 bloquea elevación desconocida y puede bloquear baja confianza según el umbral configurado. Aun así, la confianza calculada es una estimación de calidad del muestreo, no una validación de obstáculos a escala humana.','The V35 engine blocks unknown elevation and can block low confidence according to the configured threshold. Calculated confidence remains a sampling-quality estimate, not human-scale obstacle validation.'],['Oxígeno, batería, comunicaciones, temperatura, radiación, localización en tiempo real y esfuerzo metabólico aún no forman parte del cálculo operativo de V35.','Oxygen, battery, communications, temperature, radiation, real-time localization and metabolic effort are not yet part of the V35 operational calculation.'],
  ['Las siguientes tablas incluyen cada nodo de trayectoria enviado por el motor al informe: coordenadas y elevación cuando está disponible. Esto permite auditar la geometría utilizada en cada estrategia.','The following tables include every path node sent by the engine to the report: coordinates and elevation when available. This allows auditing the geometry used by each strategy.'],['Estrategia','Strategy'],['tramo(s)','leg(s)'],['Elev.','Elev.'],['Pend.','Slope'],['Trans.','Trav.'],['Conf.','Conf.'],['Sin nodos de trayectoria almacenados.','No stored path nodes.'],
  ['ANÁLISIS DEL TERRENO DE LA MISIÓN','MISSION TERRAIN ANALYSIS'],['PERFIL DE ELEVACIÓN DE LA RUTA','ROUTE ELEVATION PROFILE'],['Elevación inicial','Starting elevation'],['Elevación final','Ending elevation'],['Elevación mínima','Minimum elevation'],['Elevación máxima','Maximum elevation'],['Rango vertical','Vertical relief'],['Sector más exigente','Most demanding sector'],['Distancia con mayor incertidumbre','Distance with greater uncertainty'],['El perfil se construye con los nodos de elevación almacenados por el motor para la estrategia seleccionada.','The profile is built from elevation nodes stored by the engine for the selected strategy.'],
  ['Más directa','Most direct'],['Menor exposición','Lower exposure'],['Equilibrada','Balanced'],['Sin evaluación','Not evaluated'],['Bajo','Low'],['Moderado','Moderate'],['Muy alto','Very high'],['Alto','High'],['OBLIGATORIO','REQUIRED'],['OPCIONAL','OPTIONAL'],['Sí','Yes'],['No','No'],['FUERA DEL LÍMITE CONFIGURADO','OUTSIDE CONFIGURED LIMIT'],['DENTRO DE LOS PARÁMETROS CONFIGURADOS','WITHIN CONFIGURED PARAMETERS'],['Página','Page'],['JEZERO - informe completo de misión generado automáticamente','JEZERO - complete mission report generated automatically'],['No hay secuencia seleccionada disponible.','No selected sequence is available.'],['geologia','geology'],['muestra','sampling'],['imagen','imaging'],['instrumento','instrument'],['otro','other'],
  ['MAPA ESQUEMÁTICO DE LA MISIÓN','MISSION ROUTE SCHEMATIC'],['ANÁLISIS VISUAL Y OPERACIONAL','VISUAL AND OPERATIONAL ANALYSIS'],['PERFIL MULTICAPA DE LA RUTA','MULTI-LAYER ROUTE PROFILE'],['DISTRIBUCIÓN DE PENDIENTES','SLOPE DISTRIBUTION'],['DISTRIBUCIÓN DE TRANSITABILIDAD','TRAVERSABILITY DISTRIBUTION'],['PRESUPUESTO DE TIEMPO EVA','EVA TIME BUDGET'],['SCIENCE RETURN ACUMULADO','CUMULATIVE SCIENCE RETURN'],['MISSION HEALTH','MISSION HEALTH'],['Tránsito','Travel'],['Ciencia en objetivos','Science at targets'],['Reserva disponible','Available reserve'],['Exceso sobre límite','Overrun beyond limit']
];
function trPdfText(value,lang){
  let s=String(value??'');
  if(lang!=='en') return s;
  for(const [es,en] of PDF_EN_REPLACEMENTS) s=s.split(es).join(en);
  return s;
}

export function buildMissionPdf(report){
  const lang=report?.software?.reportLanguage==='en'?'en':'es';
  const locale=lang==='en'?'en-US':'es-NI';
  const pageW=612, pageH=792, margin=42, bodyX=margin, startY=748;
  const pages=[];
  let items=[];

  const add=(text='',opts={})=>{
    const indent=opts.indent||0;
    const size=opts.size||9;
    const max=opts.max||Math.max(45,91-indent);
    wrap(trPdfText(text,lang),max).forEach(line=>items.push({kind:'text',text:' '.repeat(indent)+line,size,bold:!!opts.bold,color:opts.color||'body'}));
  };
  const heading=(text,size=12)=>{ items.push({kind:'gap',h:5}); items.push({kind:'heading',text:trPdfText(text,lang),size,bold:true,color:'heading'}); items.push({kind:'gap',h:4}); };
  const subheading=(text)=>items.push({kind:'subheading',text:trPdfText(text,lang),size:9.5,bold:true,color:'sand'});
  const rule=()=>items.push({kind:'rule'});
  const tableRow=(cols,widths,{header=false}={})=>{
    let line='';
    cols.forEach((c,i)=>{ const w=widths[i]; line += trPdfText(String(c ?? ''),lang).slice(0,w).padEnd(w) + (i===cols.length-1?'':'  '); });
    items.push({kind:'text',text:line,bold:header,size:header?7.8:7.4,color:header?'sand':'body'});
  };
  const terrainProfile=(points)=>items.push({kind:'terrainProfile',points:Array.isArray(points)?points:[]});
  const missionProfile=(points)=>items.push({kind:'missionProfile',points:Array.isArray(points)?points:[]});
  const barFigure=(rows)=>items.push({kind:'barFigure',rows:Array.isArray(rows)?rows:[]});
  const evaBudgetFigure=(data)=>items.push({kind:'evaBudget',data:data||{}});
  const scienceFigure=(points,maxValue)=>items.push({kind:'scienceFigure',points:Array.isArray(points)?points:[],maxValue:Number(maxValue)||0});
  const healthFigure=(rows)=>items.push({kind:'healthFigure',rows:Array.isArray(rows)?rows:[]});
  const strategyFigure=(strategies,selectedMode)=>items.push({kind:'strategyFigure',strategies:Array.isArray(strategies)?strategies:[],selectedMode});
  const routeOverview=(legs,points)=>items.push({kind:'routeOverview',legs:Array.isArray(legs)?legs:[],points:Array.isArray(points)?points:[]});

  // Encabezado / identificación
  items.push({kind:'title',text:'JEZERO',size:22,bold:true,color:'copper'});
  add('Informe completo de planificación de travesía científica EVA en Marte - motor multicriterio V35',{size:10,bold:true});
  add(`Identificador del informe: ${report.reportId || '--'}`);
  add(`Generado: ${fmtDate(report.generatedAt,locale)}`);
  add(`Versión del sistema: ${report.software?.version || '--'} · Tema de interfaz: ${report.software?.interfaceTheme || '--'} · Idioma: ${lang==='en'?'English':'español'}`);
  rule();

  heading('1. IDENTIFICACIÓN Y RESUMEN DE LA MISIÓN');
  add(`Nombre: ${report.mission?.name || 'Misión EVA'}`);
  if(report.mission?.code) add(`Código / ID: ${report.mission.code}`);
  if(report.mission?.crew) add(`Tripulación: ${report.mission.crew}`);
  if(report.mission?.notes) add(`Notas del plan: ${report.mission.notes}`);
  add(`Estrategia seleccionada: ${strategyName(report.selectedMode)}`);
  add(`Estado operacional del cálculo: ${report.selected?.overBudget ? 'FUERA DEL LÍMITE CONFIGURADO' : 'DENTRO DE LOS PARÁMETROS CONFIGURADOS'}`);
  add(`Regreso a la base al finalizar: ${report.returnBase ? 'Sí' : 'No'}`);
  add(`Puntos planificados: ${report.points?.length ?? 0} · Obligatorios/base: ${report.mission?.requiredPoints ?? '--'} · Opcionales: ${report.mission?.optionalPoints ?? '--'}`);
  add(`Puntos incluidos en la estrategia seleccionada: ${report.selected?.includedPoints?.length ?? report.selected?.sequence?.length ?? 0}`);
  add(`Objetivos opcionales omitidos: ${report.selected?.omittedOptional?.length ?? 0}`);
  if(report.mission?.base) add(`Base de misión: ${report.mission.base.name || 'Base'} · ${coordText(report.mission.base)}`);
  if(report.mission?.calculationTimestamp) add(`Último cálculo de la misión: ${fmtDate(report.mission.calculationTimestamp,locale)}`);
  rule();

  heading('2. PARÁMETROS OPERACIONALES');
  const p=report.params||{};
  add(`Velocidad nominal configurada: ${finite(p.speed)?Number(p.speed).toFixed(2):'--'} km/h`);
  add(`Tiempo máximo EVA configurado: ${finite(p.evaTime)?Number(p.evaTime).toFixed(2):'--'} h`);
  add(`Margen reservado para retorno: ${finite(p.returnMargin)?Number(p.returnMargin).toFixed(0):'--'} %`);
  add(`Pendiente máxima permitida (límite duro): ${finite(p.maxSlopeLimit)?Number(p.maxSlopeLimit).toFixed(1):'--'}°`);
  add(`Transitabilidad mínima permitida (límite duro): ${finite(p.minTransitability)?Number(p.minTransitability).toFixed(0):'--'} / 100`);
  add(`Confianza cartográfica mínima permitida (límite duro): ${finite(p.minConfidence)?Number(p.minConfidence).toFixed(0):'--'} %`);
  add(`Tiempo disponible para la misión después de la reserva: ${fmtHours(report.selected?.availableHours)}`);
  add(`Tiempo mínimo de EVA necesario para conservar el margen configurado: ${fmtHours(minEvaHours(report.selected))}`);
  const dwellH=(Number(report.selected?.dwellMinutes)||0)/60;
  const travelH=(Number(report.selected?.duration)||0)-dwellH;
  add(`Tiempo total programado en objetivos: ${fmtHours(dwellH)} (${Number(report.selected?.dwellMinutes)||0} min)`);
  add(`Tiempo estimado de desplazamiento: ${fmtHours(travelH)}`);
  add(`Duración total estimada: ${fmtHours(report.selected?.duration)}`);
  add(`Margen operacional restante: ${fmtHours((Number(report.selected?.availableHours)||0)-(Number(report.selected?.duration)||0))}`);
  add('Oxígeno, batería y control térmico: NO MODELADOS EN V35. JEZERO no inventa estimaciones de recursos que aún no forman parte del motor.');
  rule();

  heading('3. TODOS LOS PUNTOS PLANIFICADOS');
  tableRow(['#','Nombre','Tipo','Latitud','Longitud','Ciencia','Parada'],[3,20,11,14,15,7,7],{header:true});
  (report.points||[]).forEach((pt,i)=>{
    tableRow([i+1,pt.name||`Punto ${i+1}`,pointStatus(pt),fmtLat(pt.lat),fmtLon(pt.lon),pt.type==='base'?'--':`${Math.round(Number(pt.scienceValue)||0)}`,`${Number(pt.dwellMin||0)}m`],[3,20,11,14,15,7,7]);
    add(`   Requerido: ${pt.required?'Sí':'No'} · Categoría científica: ${pt.scienceCategory || '--'} · Elevación del punto: ${finite(pt.elevationM)?fmtM(pt.elevationM):'no almacenada en el punto maestro'}`,{size:7.6});
    if(pt.scienceNotes) add(`   Nota científica: ${pt.scienceNotes}`,{size:7.4});
  });
  rule();

  heading('4. SECUENCIA SELECCIONADA');
  const selectedPoints=report.selected?.includedPoints || report.selected?.sequence || [];
  selectedPoints.forEach((pt,i)=>{
    add(`${i+1}. ${pt.name || `Punto ${i+1}`} · ${pointStatus(pt)} · ${coordText(pt)} · parada ${Number(pt.dwellMin||0)} min${pt.scienceCategory?` · ${pt.scienceCategory}`:''}`,{bold:i===0});
  });
  if(!selectedPoints.length) add('No hay secuencia seleccionada disponible.');
  subheading('MAPA ESQUEMÁTICO DE LA MISIÓN');
  add('Vista geométrica de la trayectoria seleccionada con base, objetivos y retorno. El fondo cartográfico interactivo permanece en JEZERO; este esquema conserva la geometría calculada dentro del informe.',{size:7.6});
  routeOverview(report.selected?.legs||[],selectedPoints);
  rule();

  heading('5. MÉTRICAS COMPLETAS DE LA RUTA SELECCIONADA');
  const sm=report.selected?.metrics||{};
  add(`Estrategia: ${strategyName(report.selectedMode)}`);
  if(report.selected?.strategyDescription) add(`Descripción: ${report.selected.strategyDescription}`);
  add(`Distancia total: ${fmtKm(sm.distanceKm)}`);
  add(`Duración estimada: ${fmtHours(report.selected?.duration)}`);
  add(`Dificultad multicriterio experimental: ${riskText(report.selected?.score)}`);
  add(`Pendiente máxima: ${fmtDeg(sm.maxSlopeDeg)}`);
  add(`Pendiente media absoluta: ${fmtDeg(sm.avgSlopeDeg)}`);
  add(`Pendiente máxima de subida: ${fmtDeg(sm.maxUphillSlopeDeg)} · pendiente máxima de bajada: ${fmtDeg(sm.maxDownhillSlopeDeg)}`);
  add(`Transitabilidad media: ${finite(sm.avgTransitability)?Number(sm.avgTransitability).toFixed(0):'--'} / 100 · mínima: ${finite(sm.minTransitability)?Number(sm.minTransitability).toFixed(0):'--'} / 100`);
  add(`Confianza cartográfica media: ${finite(sm.avgConfidence)?Number(sm.avgConfidence).toFixed(0):'--'} % · mínima: ${finite(sm.minConfidence)?Number(sm.minConfidence).toFixed(0):'--'} %`);
  add(`Rugosidad angular media estimada: ${fmtDeg(sm.avgRoughnessDeg)} · distancia con confianza <50%: ${fmtKm(sm.uncertainDistanceKm)} · distancia difícil: ${fmtKm(sm.difficultDistanceKm)}`);
  add(`Valor científico incluido: ${Math.round(Number(report.selected?.scienceValueTotal)||0)} puntos de ${Math.round(Number(report.selected?.scienceValuePotential)||0)} potenciales · cobertura científica: ${finite(report.selected?.scienceEfficiency)?Number(report.selected.scienceEfficiency).toFixed(0):'--'} %`);
  add(`Ascenso acumulado: ${fmtM(sm.gainM)}`);
  add(`Descenso acumulado: ${fmtM(sm.descentM)}`);
  add(`Variación altimétrica acumulada: ${fmtM(sm.elevationChangeM)}`);
  add(`Segmentos evaluados: ${sm.segments ?? '--'}`);
  add(`Tramos de misión: ${report.selected?.legs?.length ?? 0}`);
  add(`Tiempo disponible: ${fmtHours(report.selected?.availableHours)} · Excede límite: ${report.selected?.overBudget?'Sí':'No'}`);
  rule();

  heading('6. ANÁLISIS DEL TERRENO DE LA MISIÓN');
  const ts=terrainSummary(report.selected);
  add(`Elevación inicial: ${fmtM(ts.startElevationM)} · Elevación final: ${fmtM(ts.endElevationM)}`);
  add(`Elevación mínima: ${fmtM(ts.minElevationM)} · Elevación máxima: ${fmtM(ts.maxElevationM)} · Rango vertical: ${fmtM(ts.reliefM)}`);
  add(`Ascenso acumulado: ${fmtM(sm.gainM)} · Descenso acumulado: ${fmtM(sm.descentM)} · Variación altimétrica acumulada: ${fmtM(sm.elevationChangeM)}`);
  add(`Pendiente media: ${fmtDeg(sm.avgSlopeDeg)} · máxima subida: ${fmtDeg(sm.maxUphillSlopeDeg)} · máxima bajada: ${fmtDeg(sm.maxDownhillSlopeDeg)}`);
  add(`Transitabilidad media/mínima: ${finite(sm.avgTransitability)?Number(sm.avgTransitability).toFixed(0):'--'} / ${finite(sm.minTransitability)?Number(sm.minTransitability).toFixed(0):'--'} · Rugosidad angular media: ${fmtDeg(sm.avgRoughnessDeg)}`);
  add(`Confianza cartográfica media/mínima: ${finite(sm.avgConfidence)?Number(sm.avgConfidence).toFixed(0):'--'}% / ${finite(sm.minConfidence)?Number(sm.minConfidence).toFixed(0):'--'}% · Distancia con mayor incertidumbre: ${fmtKm(sm.uncertainDistanceKm)}`);
  if(ts.hardest){
    const hm=ts.hardest.leg.metrics||{};
    add(`Sector más exigente: Tramo ${ts.hardest.i+1} · ${ts.hardest.leg.from?.name||'Salida'} -> ${ts.hardest.leg.to?.name||'Llegada'} · dificultad ${riskText(ts.hardest.score)} · pendiente máx. ${fmtDeg(hm.maxSlopeDeg)} · transitabilidad mínima ${finite(hm.minTransitability)?Number(hm.minTransitability).toFixed(0):'--'}/100`,{bold:true});
  }
  subheading('PERFIL DE ELEVACIÓN DE LA RUTA');
  add('El perfil se construye con los nodos de elevación almacenados por el motor para la estrategia seleccionada.',{size:7.6});
  terrainProfile(ts.profile);
  tableRow(['Tramo','Dist.','Pend.máx','Subida','Bajada','Transit.','Conf.'],[18,10,10,9,9,9,8],{header:true});
  (report.selected?.legs||[]).forEach((leg,i)=>{
    const m=leg.metrics||{};
    tableRow([
      `${i+1} ${leg.from?.name||'Salida'}>${leg.to?.name||'Llegada'}`,
      fmtKm(m.distanceKm),fmtDeg(m.maxSlopeDeg),fmtM(m.gainM),fmtM(m.descentM),
      finite(m.avgTransitability)?Number(m.avgTransitability).toFixed(0):'--',
      finite(m.avgConfidence)?`${Number(m.avgConfidence).toFixed(0)}%`:'--'
    ],[18,10,10,9,9,9,8]);
  });
  rule();

  heading('7. ANÁLISIS VISUAL Y OPERACIONAL');
  const ap=analyticsProfileFromLegs(report.selected?.legs||[]);
  subheading('PERFIL MULTICAPA DE LA RUTA');
  add('Las bandas comparten el mismo eje de distancia para relacionar elevación, pendiente, transitabilidad y confianza cartográfica en cada sector.',{size:7.6});
  missionProfile(ap);
  subheading('DISTRIBUCIÓN DE PENDIENTES');
  barFigure(weightedBins(ap,'slope',v=>{v=Math.abs(v);return v<5?'0-5 deg':v<10?'5-10 deg':v<15?'10-15 deg':'>15 deg';},['0-5 deg','5-10 deg','10-15 deg','>15 deg']));
  subheading('DISTRIBUCIÓN DE TRANSITABILIDAD');
  barFigure(weightedBins(ap,'transit',v=>v>=80?'Segura':v>=60?'Moderada':v>=40?'Difícil':'Crítica',['Segura','Moderada','Difícil','Crítica']));
  subheading('PRESUPUESTO DE TIEMPO EVA');
  const availableV=Number(report.selected?.availableHours),durationV=Number(report.selected?.duration),dwellV=Math.max(0,(Number(report.selected?.dwellMinutes)||0)/60),travelV=Math.max(0,durationV-dwellV);
  evaBudgetFigure({travel:travelV,science:dwellV,reserve:Math.max(0,availableV-durationV),overrun:Math.max(0,durationV-availableV)});
  subheading('SCIENCE RETURN ACUMULADO');
  scienceFigure(scienceProgress(report.selected),Number(report.selected?.scienceValuePotential)||0);
  subheading('MISSION HEALTH');
  healthFigure(operationalHealth(report.selected));
  subheading('COMPARACIÓN VISUAL DE ESTRATEGIAS');
  strategyFigure(report.strategies||[],report.selectedMode);
  add('Los gráficos anteriores se derivan exclusivamente de las métricas calculadas por JEZERO. No incluyen oxígeno, batería, radiación ni otros recursos que todavía no formen parte del modelo.',{size:7.6});
  rule();

  heading('8. LÍNEA BASE DE OBJETIVOS OBLIGATORIOS');
  const rb=report.selected?.requiredBaseline;
  if(rb){
    add(`Duración si se visitan únicamente base/objetivos obligatorios: ${fmtHours(rb.duration)}`);
    add(`Tiempo programado en objetivos obligatorios: ${fmtHours((Number(rb.dwellMinutes)||0)/60)}`);
    add(`Dificultad multicriterio: ${riskText(rb.score)} · valor científico obligatorio: ${Math.round(Number(rb.scienceValueTotal)||0)} puntos`);
    add(`Distancia: ${fmtKm(rb.metrics?.distanceKm)} · Pendiente máxima: ${fmtDeg(rb.metrics?.maxSlopeDeg)} · Pendiente media: ${fmtDeg(rb.metrics?.avgSlopeDeg)}`);
    add(`Secuencia: ${(rb.sequence||[]).map(x=>x.name||'Punto').join(' -> ') || '--'}`);
  } else add('No se recibió una línea base independiente para objetivos obligatorios.');
  rule();

  heading('9. COMPARACIÓN DE LAS TRES ESTRATEGIAS');
  tableRow(['Estrategia','Distancia','Duración','Mín. EVA','Dificultad','Estado'],[18,13,13,13,17,11],{header:true});
  (report.strategies||[]).forEach(s=>{
    tableRow([strategyName(s.mode),fmtKm(s.metrics?.distanceKm),fmtHours(s.duration),fmtHours(minEvaHours(s)),riskText(s.score),s.overBudget?'FUERA':'OK'],[18,13,13,13,17,11]);
    add(`   Descripción: ${s.strategyDescription || '--'}`,{size:7.6});
    add(`   Secuencia: ${(s.includedPoints||s.sequence||[]).map(x=>x.type==='base'?'BASE':x.name||'Objetivo').join(' -> ') || '--'}`,{size:7.6});
    add(`   Pendiente máx.: ${fmtDeg(s.metrics?.maxSlopeDeg)} · subida máx.: ${fmtDeg(s.metrics?.maxUphillSlopeDeg)} · bajada máx.: ${fmtDeg(s.metrics?.maxDownhillSlopeDeg)} · transitabilidad: ${finite(s.metrics?.avgTransitability)?Number(s.metrics.avgTransitability).toFixed(0):'--'}/100 · confianza: ${finite(s.metrics?.avgConfidence)?Number(s.metrics.avgConfidence).toFixed(0):'--'}%`,{size:7.6});
    add(`   Ascenso: ${fmtM(s.metrics?.gainM)} · descenso: ${fmtM(s.metrics?.descentM)} · segmentos: ${s.metrics?.segments ?? '--'} · ciencia: ${Math.round(Number(s.scienceValueTotal)||0)}/${Math.round(Number(s.scienceValuePotential)||0)} puntos`,{size:7.6});
    add(`   Opcionales omitidos: ${s.omittedOptional?.length ? s.omittedOptional.map(x=>x.name||'Objetivo').join(', ') : 'ninguno'}`,{size:7.6});
  });
  rule();

  heading('10. DETALLE DE TRAMOS DE LA ESTRATEGIA SELECCIONADA');
  (report.selected?.legs||[]).forEach((leg,i)=>{
    const m=leg.metrics||{};
    subheading(`Tramo ${i+1}: ${leg.from?.name || 'Salida'} -> ${leg.to?.name || 'Llegada'}`);
    add(`Origen: ${coordText(leg.from)} · Destino: ${coordText(leg.to)}`);
    add(`Distancia: ${fmtKm(m.distanceKm)} · Duración: ${fmtHours(leg.durationHours)} · Dificultad: ${riskText(riskScoreForLeg(m))}`);
    add(`Pendiente máxima: ${fmtDeg(m.maxSlopeDeg)} · subida máx.: ${fmtDeg(m.maxUphillSlopeDeg)} · bajada máx.: ${fmtDeg(m.maxDownhillSlopeDeg)} · media: ${fmtDeg(m.avgSlopeDeg)}`);
    add(`Transitabilidad media/mínima: ${finite(m.avgTransitability)?Number(m.avgTransitability).toFixed(0):'--'} / ${finite(m.minTransitability)?Number(m.minTransitability).toFixed(0):'--'} · confianza media/mínima: ${finite(m.avgConfidence)?Number(m.avgConfidence).toFixed(0):'--'}% / ${finite(m.minConfidence)?Number(m.minConfidence).toFixed(0):'--'}% · separación de malla: ${finite(leg.gridSpacingKm)?fmtKm(leg.gridSpacingKm):'--'}`);
    add(`Ascenso: ${fmtM(m.gainM)} · Descenso: ${fmtM(m.descentM)} · Variación altimétrica: ${fmtM(m.elevationChangeM)} · Segmentos: ${m.segments ?? '--'}`);
    add(`Parada programada al llegar: ${Number(leg.to?.dwellMin||0)} min · Nodos almacenados de la trayectoria: ${leg.path?.length ?? 0}`);
  });
  if(!(report.selected?.legs||[]).length) add('No existen tramos calculados en la estrategia seleccionada.');
  rule();

  heading('11. OBJETIVOS OPCIONALES OMITIDOS');
  if(report.selected?.omittedOptional?.length){
    report.selected.omittedOptional.forEach((pt,i)=>add(`${i+1}. ${pt.name||'Objetivo'} · ${coordText(pt)} · ${Number(pt.dwellMin||0)} min programados`));
  } else add('No se omitieron objetivos opcionales en la estrategia seleccionada.');
  rule();

  heading('12. DATOS DE FUENTE Y CONFIGURACIÓN TÉCNICA');
  add(`Modelo de elevación: ${report.dataSources?.elevation || 'MDEM200M mediante ArcGIS ElevationLayer'}`);
  add(`Cartografía / procedencia: ${report.dataSources?.cartography || 'NASA / USGS / ESA / HRSC'}`);
  add(`Mapa/base visual: ${report.dataSources?.map || 'capas configuradas en JEZERO'}`);
  add(`Radio marciano usado para distancias: ${finite(report.dataSources?.marsRadiusKm)?Number(report.dataSources.marsRadiusKm).toFixed(1):'3389.5'} km`);
  add(`Motor: A* sobre corredor de búsqueda 2D adaptado al tramo. Estrategias: más directa, equilibrada y menor exposición.`);
  add(`Modelo de duración: velocidad nominal ajustada por pendiente media más tiempos de permanencia en objetivos.`);
  add(`Motor V35: A* multicriterio con pendiente direccional, transitabilidad, rugosidad local, incertidumbre/confianza cartográfica y límites duros configurables.`);
  add(`Selección científica: los objetivos opcionales se priorizan por valor científico frente al costo incremental de distancia, tiempo, dificultad y confianza de la ruta.`);
  add(`Modelo de dificultad: combina pendiente, transitabilidad mínima, confianza cartográfica y rugosidad angular. Los límites duros excluyen segmentos del grafo; no son simples penalizaciones.`);
  rule();

  heading('13. LIMITACIONES Y SEGURIDAD');
  add('JEZERO V35 es una herramienta de planificación y simulación. Sus índices de transitabilidad, confianza y dificultad NO constituyen una certificación de seguridad para una EVA tripulada.');
  add('La resolución y calidad de la ruta dependen de los datos de elevación disponibles. MDEM200M es apropiado para planificación regional, no para detectar obstáculos de escala humana como rocas pequeñas, zanjas o bordes locales.');
  add('El motor V35 bloquea elevación desconocida y puede bloquear baja confianza según el umbral configurado. Aun así, la confianza calculada es una estimación de calidad del muestreo, no una validación de obstáculos a escala humana.');
  add('Oxígeno, batería, comunicaciones, temperatura, radiación, localización en tiempo real y esfuerzo metabólico aún no forman parte del cálculo operativo de V35.');
  rule();

  // Apéndice exhaustivo: conserva todos los nodos calculados para las tres estrategias.
  heading('14. APÉNDICE TÉCNICO - NODOS DE TODAS LAS RUTAS CALCULADAS');
  add('Las siguientes tablas incluyen cada nodo de trayectoria enviado por el motor al informe: coordenadas y elevación cuando está disponible. Esto permite auditar la geometría utilizada en cada estrategia.');
  (report.strategies||[]).forEach((s,si)=>{
    subheading(`${14}.${si+1} Estrategia ${strategyName(s.mode)} · ${s.legs?.length ?? 0} tramo(s)`);
    (s.legs||[]).forEach((leg,li)=>{
      add(`Tramo ${li+1}: ${leg.from?.name||'Salida'} -> ${leg.to?.name||'Llegada'} · ${fmtKm(leg.metrics?.distanceKm)} · ${fmtHours(leg.durationHours)}`,{bold:true,size:8.2});
      tableRow(['N','Latitud','Longitud','Elev.','Pend.','Trans.','Conf.'],[4,14,14,9,8,8,8],{header:true});
      (leg.path||[]).forEach((node,ni)=>tableRow([node.index ?? ni+1,fmtLat(node.lat),fmtLon(node.lon),finite(node.elevationM)?fmtM(node.elevationM):'--',finite(node.signedSlopeDeg)?fmtDeg(node.signedSlopeDeg):'--',finite(node.transitability)?Number(node.transitability).toFixed(0):'--',finite(node.edgeConfidence??node.dataConfidence)?`${Number(node.edgeConfidence??node.dataConfidence).toFixed(0)}%`:'--'],[4,14,14,9,8,8,8]));
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
    if(item.kind==='terrainProfile') return 158;
    if(item.kind==='missionProfile') return 220;
    if(item.kind==='barFigure') return 112;
    if(item.kind==='evaBudget') return 105;
    if(item.kind==='scienceFigure') return 145;
    if(item.kind==='healthFigure') return 142;
    if(item.kind==='strategyFigure') return 160;
    if(item.kind==='routeOverview') return 188;
    if(item.kind==='gap') return item.h||5;
    return item.size>=10?15:item.size>=8.5?12:10.5;
  };
  const pushPage=()=>{ if(current.length){ pages.push(current); current=[]; used=0; } };
  for(let ii=0;ii<items.length;ii++){
    const item=items[ii],cost=costOf(item);
    const graphicKinds=['terrainProfile','missionProfile','barFigure','evaBudget','scienceFigure','healthFigure','strategyFigure','routeOverview'];
    let keepCost=cost, jj=ii+1, foundGraphic=false;
    if(item.kind==='subheading'){
      while(jj<items.length && jj<=ii+6){
        const k=items[jj]; keepCost+=costOf(k);
        if(graphicKinds.includes(k.kind)){foundGraphic=true;break;}
        if(!['text','gap'].includes(k.kind)) break;
        jj++;
      }
    }
    if(item.kind==='subheading' && foundGraphic && used+keepCost>704) pushPage();
    else if(used+cost>704) pushPage();
    current.push(item); used+=cost;
  }
  pushPage();

  const objects=[];
  const addObj=body=>{ objects.push(body); return objects.length; };
  const fontObj=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldObj=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const theme=pdfTheme(report);
  const colors={
    body:hexRgbPdf(theme.body),
    heading:hexRgbPdf(theme.heading),
    sand:hexRgbPdf(theme.accent),
    copper:hexRgbPdf(theme.title),
    muted:hexRgbPdf(theme.muted)
  };
  const themeLight=hexRgbPdf(theme.light), themeBar=hexRgbPdf(theme.bar);
  const pageObjs=[];

  for(let pi=0;pi<pages.length;pi++){
    const page=pages[pi];
    let y=startY;
    const content=['q'];
    // Franja superior del informe.
    content.push(`${colors.heading} rg 0 770 612 22 re f`);
    content.push(`${colors.copper} rg 0 766 612 4 re f`);
    content.push(`${themeBar} rg 0 0 612 20 re f`);
    for(const item of page){
      if(item.kind==='gap'){ y-=item.h||5; continue; }
      if(item.kind==='rule'){
        y-=3; content.push(`${colors.sand} RG 0.45 w ${bodyX} ${y} m ${pageW-margin} ${y} l S`); y-=8; continue;
      }
      if(item.kind==='terrainProfile'){
        const pts=(item.points||[]).filter(p=>finite(p.km)&&finite(p.elevationM));
        const boxX=bodyX, boxY=y-140, boxW=pageW-margin-bodyX, boxH=132;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);
        content.push(`${colors.muted} RG 0.5 w ${boxX+34} ${boxY+20} m ${boxX+34} ${boxY+boxH-18} l S`);
        content.push(`${colors.muted} RG 0.5 w ${boxX+34} ${boxY+20} m ${boxX+boxW-14} ${boxY+20} l S`);
        if(pts.length>1){
          const minE=Math.min(...pts.map(p=>Number(p.elevationM))), maxE=Math.max(...pts.map(p=>Number(p.elevationM)));
          const eSpan=Math.max(1,maxE-minE), maxKm=Math.max(.001,Number(pts[pts.length-1].km));
          const x0=boxX+34,y0=boxY+20,pw=boxW-50,ph=boxH-42;
          const xy=pts.map(p=>({x:x0+Number(p.km)/maxKm*pw,y:y0+(Number(p.elevationM)-minE)/eSpan*ph}));
          content.push(`${colors.copper} RG 1.7 w ${xy[0].x.toFixed(2)} ${xy[0].y.toFixed(2)} m`);
          for(let i=1;i<xy.length;i++) content.push(`${xy[i].x.toFixed(2)} ${xy[i].y.toFixed(2)} l`);
          content.push('S');
          content.push(`BT /F1 7 Tf ${colors.muted} rg ${boxX+4} ${boxY+boxH-16} Td (${esc(`${Math.round(maxE)} m`)}) Tj ET`);
          content.push(`BT /F1 7 Tf ${colors.muted} rg ${boxX+4} ${boxY+18} Td (${esc(`${Math.round(minE)} m`)}) Tj ET`);
          content.push(`BT /F1 7 Tf ${colors.muted} rg ${boxX+boxW-58} ${boxY+7} Td (${esc(`${maxKm.toFixed(2)} km`)}) Tj ET`);
        } else {
          content.push(`BT /F1 8 Tf ${colors.muted} rg ${boxX+18} ${boxY+60} Td (${esc(trPdfText('Sin datos suficientes para dibujar el perfil de elevación.',lang))}) Tj ET`);
        }
        y-=158; continue;
      }
      if(item.kind==='routeOverview'){
        const nodes=[]; for(const leg of item.legs||[]){for(let i=0;i<(leg.path||[]).length;i++){if(nodes.length&&i===0)continue;const q=leg.path[i];if(finite(q?.lat)&&finite(q?.lon))nodes.push({lat:Number(q.lat),lon:Number(q.lon)});}}
        const rawPoints=(item.points||[]).filter(q=>finite(q?.lat)&&finite(q?.lon));
        const points=[];
        for(const q of rawPoints){
          const same=points.find(x=>Math.abs(Number(x.lat)-Number(q.lat))<1e-7&&Math.abs(Number(x.lon)-Number(q.lon))<1e-7);
          if(same){ if(q.type==='base') same.homeReturn=true; continue; }
          points.push({...q});
        }
        const all=[...nodes,...points],boxX=bodyX,boxY=y-173,boxW=pageW-margin-bodyX,boxH=165;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);
        if(all.length>1){
          let minLat=Math.min(...all.map(q=>q.lat)),maxLat=Math.max(...all.map(q=>q.lat)),minLon=Math.min(...all.map(q=>q.lon)),maxLon=Math.max(...all.map(q=>q.lon));
          const latPad=Math.max(.005,(maxLat-minLat)*.12),lonPad=Math.max(.005,(maxLon-minLon)*.12);minLat-=latPad;maxLat+=latPad;minLon-=lonPad;maxLon+=lonPad;
          const L=boxX+28,R=boxX+boxW-18,B=boxY+23,T=boxY+boxH-18,x=q=>L+(q.lon-minLon)/Math.max(.0001,maxLon-minLon)*(R-L),yy=q=>B+(q.lat-minLat)/Math.max(.0001,maxLat-minLat)*(T-B);
          for(let g=0;g<=4;g++){const gx=L+(R-L)*g/4,gy=B+(T-B)*g/4;content.push(`${colors.muted} RG 0.25 w ${gx} ${B} m ${gx} ${T} l S ${L} ${gy} m ${R} ${gy} l S`);}
          if(nodes.length>1){content.push(`${colors.heading} RG 1.8 w ${x(nodes[0]).toFixed(2)} ${yy(nodes[0]).toFixed(2)} m`);for(let i=1;i<nodes.length;i++)content.push(`${x(nodes[i]).toFixed(2)} ${yy(nodes[i]).toFixed(2)} l`);content.push('S');}
          points.forEach((q,i)=>{const px=x(q),py=yy(q),isBase=q.type==='base';content.push(`${isBase?colors.copper:colors.sand} rg ${(px-3).toFixed(2)} ${(py-3).toFixed(2)} 6 6 re f`);const label=isBase?(q.homeReturn?'BASE/HOME':'BASE'):`S${String(i).padStart(2,'0')}`;content.push(`BT /F2 6.5 Tf ${colors.body} rg ${(px+5).toFixed(2)} ${(py+1).toFixed(2)} Td (${esc(label)}) Tj ET`);});
          content.push(`BT /F2 8 Tf ${colors.heading} rg ${R-8} ${T-4} Td (N) Tj ET ${colors.heading} RG 1 w ${R-5} ${T-8} m ${R-5} ${T-24} l S`);
          content.push(`BT /F1 6 Tf ${colors.muted} rg ${boxX+8} ${boxY+7} Td (${esc(`${minLat.toFixed(3)}..${maxLat.toFixed(3)} lat / ${minLon.toFixed(3)}..${maxLon.toFixed(3)} lon`)}) Tj ET`);
        } else content.push(`BT /F1 8 Tf ${colors.muted} rg ${boxX+18} ${boxY+76} Td (${esc(trPdfText('Sin geometría suficiente para dibujar la ruta.',lang))}) Tj ET`);
        y-=188; continue;
      }
      if(item.kind==='missionProfile'){
        const pts=(item.points||[]).filter(p=>finite(p.km));
        const boxX=bodyX,boxY=y-205,boxW=pageW-margin-bodyX,boxH=196,L=boxX+62,R=boxX+boxW-10,plotW=R-L;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);
        for(let g=0;g<=5;g++){const gx=L+plotW*g/5;content.push(`${colors.muted} RG 0.25 w ${gx.toFixed(2)} ${boxY+17} m ${gx.toFixed(2)} ${boxY+boxH-10} l S`);}
        if(pts.length>1){
          const maxKm=Math.max(.001,Number(pts[pts.length-1].km));
          const elev=pts.map(p=>Number(p.elevationM)).filter(Number.isFinite),minE=elev.length?Math.min(...elev):0,maxE=elev.length?Math.max(...elev):1;
          const maxSlope=Math.max(15,...pts.map(p=>Math.abs(Number(p.slope)||0)));
          const tracks=[
            {key:'elevationM',name:trPdfText('Elevación',lang),y0:boxY+131,h:45,min:minE,max:maxE,color:colors.copper},
            {key:'slope',name:trPdfText('Pendiente',lang),y0:boxY+91,h:28,min:-maxSlope,max:maxSlope,color:colors.sand},
            {key:'transit',name:trPdfText('Transitabilidad',lang),y0:boxY+52,h:26,min:0,max:100,color:colors.heading},
            {key:'confidence',name:trPdfText('Confianza',lang),y0:boxY+18,h:22,min:0,max:100,color:colors.muted}
          ];
          for(const t of tracks){
            content.push(`BT /F2 6.5 Tf ${colors.muted} rg ${boxX+7} ${t.y0+t.h/2} Td (${esc(t.name)}) Tj ET`);
            content.push(`${colors.muted} RG 0.35 w ${L} ${t.y0} m ${R} ${t.y0} l S`);
            const valid=pts.filter(p=>finite(p[t.key]));
            if(valid.length>1){
              const yy=v=>t.y0+(Number(v)-t.min)/Math.max(.001,t.max-t.min)*t.h;
              const first=valid[0]; content.push(`${t.color} RG 1.35 w ${(L+Number(first.km)/maxKm*plotW).toFixed(2)} ${yy(first[t.key]).toFixed(2)} m`);
              for(let i=1;i<valid.length;i++){const q=valid[i];content.push(`${(L+Number(q.km)/maxKm*plotW).toFixed(2)} ${yy(q[t.key]).toFixed(2)} l`);} content.push('S');
            }
          }
          for(let g=0;g<=5;g++){const gx=L+plotW*g/5;content.push(`BT /F1 6 Tf ${colors.muted} rg ${gx-8} ${boxY+5} Td (${esc(`${(maxKm*g/5).toFixed(1)} km`)}) Tj ET`);}
        } else content.push(`BT /F1 8 Tf ${colors.muted} rg ${boxX+18} ${boxY+90} Td (${esc(trPdfText('Sin datos suficientes para dibujar el perfil multicapa.',lang))}) Tj ET`);
        y-=220; continue;
      }
      if(item.kind==='barFigure'){
        const rows=item.rows||[],boxX=bodyX,boxY=y-96,boxW=pageW-margin-bodyX,boxH=88;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);
        const maxBar=boxW-155;
        rows.slice(0,6).forEach((r,i)=>{const yy=boxY+boxH-18-i*17,val=Math.max(0,Math.min(100,Number(r.value)||0));content.push(`BT /F2 7 Tf ${colors.body} rg ${boxX+10} ${yy} Td (${esc(trPdfText(r.label,lang))}) Tj ET`);content.push(`${colors.muted} RG 0.35 w ${boxX+104} ${yy-1} ${maxBar} 7 re S`);content.push(`${colors.sand} rg ${boxX+104} ${yy-1} ${(maxBar*val/100).toFixed(2)} 7 re f`);content.push(`BT /F2 7 Tf ${colors.body} rg ${boxX+112+maxBar} ${yy} Td (${esc(`${val.toFixed(0)}%`)}) Tj ET`);});
        y-=112; continue;
      }
      if(item.kind==='evaBudget'){
        const d=item.data||{},parts=[['Tránsito',Math.max(0,Number(d.travel)||0),colors.heading],['Ciencia en objetivos',Math.max(0,Number(d.science)||0),colors.copper],['Reserva disponible',Math.max(0,Number(d.reserve)||0),colors.sand],['Exceso sobre límite',Math.max(0,Number(d.overrun)||0),'0.8 0.18 0.12']].filter(x=>x[1]>0);
        const total=Math.max(.001,parts.reduce((a,x)=>a+x[1],0)),boxX=bodyX,boxY=y-90,boxW=pageW-margin-bodyX,barY=boxY+53,barX=boxX+10,barW=boxW-20;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} 82 re f`); let xx=barX;
        for(const [label,val,col] of parts){const w=barW*val/total;content.push(`${col} rg ${xx.toFixed(2)} ${barY} ${Math.max(1,w).toFixed(2)} 18 re f`);xx+=w;}
        parts.forEach(([label,val],i)=>{const col=i%2, row=Math.floor(i/2),tx=boxX+10+col*(boxW/2),ty=boxY+32-row*18;content.push(`BT /F2 7 Tf ${colors.body} rg ${tx} ${ty} Td (${esc(`${trPdfText(label,lang)}: ${fmtHours(val)}`)}) Tj ET`);});
        y-=105; continue;
      }
      if(item.kind==='scienceFigure'){
        const pts=item.points||[],boxX=bodyX,boxY=y-130,boxW=pageW-margin-bodyX,boxH=122,L=boxX+38,R=boxX+boxW-14,BY=boxY+22,TY=boxY+boxH-14;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);content.push(`${colors.muted} RG 0.4 w ${L} ${BY} m ${L} ${TY} l S ${L} ${BY} m ${R} ${BY} l S`);
        if(pts.length>1){const maxKm=Math.max(.001,Number(pts[pts.length-1].km)),maxV=Math.max(1,Number(item.maxValue)||Math.max(...pts.map(p=>Number(p.value)||0)));const x=p=>L+Number(p.km)/maxKm*(R-L),yy=p=>BY+Number(p.value)/maxV*(TY-BY);content.push(`${colors.copper} RG 1.6 w ${x(pts[0]).toFixed(2)} ${yy(pts[0]).toFixed(2)} m`);for(let i=1;i<pts.length;i++)content.push(`${x(pts[i]).toFixed(2)} ${yy(pts[i]).toFixed(2)} l`);content.push('S');pts.forEach(p=>{content.push(`${colors.sand} rg ${(x(p)-2.2).toFixed(2)} ${(yy(p)-2.2).toFixed(2)} 4.4 4.4 re f`);content.push(`BT /F1 6 Tf ${colors.muted} rg ${(x(p)-8).toFixed(2)} ${boxY+7} Td (${esc(p.label)}) Tj ET`);});content.push(`BT /F2 7 Tf ${colors.body} rg ${R-60} ${TY-3} Td (${esc(`${Math.round(Number(pts.at(-1).value)||0)} pts`)}) Tj ET`);} else content.push(`BT /F1 8 Tf ${colors.muted} rg ${boxX+18} ${boxY+55} Td (${esc(trPdfText('Sin datos suficientes.',lang))}) Tj ET`);
        y-=145; continue;
      }
      if(item.kind==='healthFigure'){
        const rows=item.rows||[],boxX=bodyX,boxY=y-126,boxW=pageW-margin-bodyX,boxH=118,trackX=boxX+145,trackW=boxW-195;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);
        rows.slice(0,6).forEach((r,i)=>{const yy=boxY+boxH-20-i*16,val=Math.max(0,Math.min(100,Number(r.value)||0));content.push(`BT /F2 6.8 Tf ${colors.body} rg ${boxX+10} ${yy} Td (${esc(trPdfText(r.label,lang))}) Tj ET`);content.push(`${colors.muted} RG 0.3 w ${trackX} ${yy-1} ${trackW} 7 re S`);content.push(`${colors.heading} rg ${trackX} ${yy-1} ${(trackW*val/100).toFixed(2)} 7 re f`);content.push(`BT /F2 7 Tf ${colors.body} rg ${trackX+trackW+8} ${yy} Td (${esc(`${Math.round(val)}`)}) Tj ET`);});
        y-=142; continue;
      }
      if(item.kind==='strategyFigure'){
        const ss=item.strategies||[],boxX=bodyX,boxY=y-145,boxW=pageW-margin-bodyX,boxH=137;
        content.push(`${themeLight} rg ${boxX} ${boxY} ${boxW} ${boxH} re f`);
        const cols=[boxX+118,boxX+235,boxX+352], names=ss.slice(0,3).map(s=>strategyName(s.mode));
        content.push(`BT /F2 7 Tf ${colors.muted} rg ${boxX+8} ${boxY+boxH-17} Td (${esc(trPdfText('Métrica',lang))}) Tj ET`);
        names.forEach((name,i)=>content.push(`BT /F2 7 Tf ${ss[i]?.mode===item.selectedMode?colors.copper:colors.body} rg ${cols[i]} ${boxY+boxH-17} Td (${esc(trPdfText(name,lang))}) Tj ET`));
        const metrics=[['Distancia',s=>fmtKm(s.metrics?.distanceKm)],['Duración',s=>fmtHours(s.duration)],['Ciencia',s=>`${Math.round(Number(s.scienceValueTotal)||0)} pts`],['Pend. máx.',s=>fmtDeg(s.metrics?.maxSlopeDeg)],['Transit.',s=>finite(s.metrics?.avgTransitability)?`${Math.round(s.metrics.avgTransitability)}/100`:'--'],['Confianza',s=>finite(s.metrics?.avgConfidence)?`${Math.round(s.metrics.avgConfidence)}%`:'--'],['Dificultad',s=>finite(s.score)?`${Math.round(s.score)}/100`:'--']];
        metrics.forEach((m,ri)=>{const yy=boxY+boxH-35-ri*14;content.push(`BT /F1 6.8 Tf ${colors.muted} rg ${boxX+8} ${yy} Td (${esc(trPdfText(m[0],lang))}) Tj ET`);ss.slice(0,3).forEach((st,i)=>content.push(`BT /F2 6.8 Tf ${st.mode===item.selectedMode?colors.copper:colors.body} rg ${cols[i]} ${yy} Td (${esc(m[1](st))}) Tj ET`));});
        y-=160; continue;
      }
      const size=item.size||9;
      const font=item.bold?'F2':'F1';
      const color=colors[item.color]||colors.body;
      if(item.kind==='heading'){
        content.push(`${themeLight} rg ${bodyX-5} ${y-4} ${pageW-margin-(bodyX-5)} 18 re f`);
      }
      content.push(`BT /${font} ${size} Tf ${color} rg ${bodyX} ${y} Td (${esc(item.text)}) Tj ET`);
      y-=costOf(item);
    }
    content.push(`BT /F1 7 Tf ${colors.muted} rg ${bodyX} 7 Td (${esc(trPdfText('JEZERO - informe completo de misión generado automáticamente',lang))}) Tj ET`);
    content.push(`BT /F1 7 Tf ${colors.muted} rg ${pageW-margin-78} 7 Td (${esc(lang==='en'?`Page ${pi+1} of ${pages.length}`:`Página ${pi+1} de ${pages.length}`)}) Tj ET`);
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
