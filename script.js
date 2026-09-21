const DATA_URL = 'mars-data.json';
const MARTIAN_RADIUS = 3389.5;
const LANDING = { lat: 18.44463, lon: 77.45088, name: 'Lugar de referencia: Perseverance', type: 'reference', required: false, dwellMin: 0 };
const GLOBAL_BBOX = { minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 };
const HISTORY_KEY = 'mars-explorer-mission-history-v2';

let D;
let map, markerLayer, routeLayer, molaLayer, slopeLayer, roughnessLayer;
let missionPoints = [];
let selecting = false;
let currentMission = null;
let busy = false;
let lastCalculatedAt = null;
let activeLayerNames = new Set(['mola','route','points']);
let derivedRefreshToken = 0;
let lastDerivedExtentKey = '';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));


function buildLayers(){
  const projection = ol.proj.get('EPSG:4326');
  const globalExtent = [-180,-90,180,90];
  const resolutions = Array.from({length:13},(_,z)=>0.703125/Math.pow(2,z));
  const tileGrid = new ol.tilegrid.TileGrid({extent:globalExtent,origin:[-180,90],resolutions,tileSize:256});
  const xyz = (url,maxZoom=12) => new ol.layer.Tile({
    source:new ol.source.XYZ({projection,tileGrid,maxZoom,wrapX:true,crossOrigin:'anonymous',url,transition:0}),
    opacity:1,zIndex:1
  });

  // Base cartográfica global. El DEM numérico se consulta por backend solo
  // cuando el motor necesita elevación/pendiente/rugosidad.
  molaLayer = xyz(D.map.globalTile, 12);
  molaLayer.set('layerId','mola-global');
  molaLayer.setOpacity(1);

  slopeLayer = new ol.layer.Vector({source:new ol.source.Vector(),zIndex:4,visible:false});
  roughnessLayer = new ol.layer.Vector({source:new ol.source.Vector(),zIndex:5,visible:false});
  slopeLayer.set('layerId','slope-derived-mola');
  roughnessLayer.set('layerId','roughness-derived-mola');

  markerLayer = new ol.layer.Vector({
    source:new ol.source.Vector(),
    style: feature => pointStyle(feature.get('kind'), feature.get('label')),
    zIndex:10
  });
  routeLayer = new ol.layer.Vector({ source:new ol.source.Vector(), zIndex:11 });
  routeLayer.setStyle(feature => routeStyle(feature.get('selected'),feature.get('kind')));

  return { projection, layers:[molaLayer,slopeLayer,roughnessLayer,routeLayer,markerLayer] };
}
function setLayerStatus(name,text,cls='ready'){ const el=document.querySelector(`[data-layer-status="${name}"]`); if(el){el.textContent=text;el.className=`layerStatus ${cls}`;} }
function markLayerLoaded(name){ setLayerStatus(name,'ACTIVA','live'); }
function markLayerError(name){ setLayerStatus(name,'ERROR','error'); }
function markLayerLoading(name){ setLayerStatus(name,'CARGANDO…','loading'); }

async function prepareLayerSources(){
  setLayerStatus('mola','ACTIVA','live');
  setLayerStatus('slope','ACERCA PARA ANALIZAR','ready');
  setLayerStatus('roughness','ACERCA PARA ANALIZAR','ready');
  setLayerStatus('route','ACTIVA','live');
  setLayerStatus('points','ACTIVA','live');
}

function initMap(){
  const projection = ol.proj.get('EPSG:4326');
  const layers = buildLayers().layers;
  map = new ol.Map({ target:'map', layers, view:new ol.View({ projection, center:[0,0], zoom:1.5, resolutions:Array.from({length:13},(_,z)=>0.703125/Math.pow(2,z)) }), controls:[] });
  map.on('pointermove', evt=>{ const c=evt.coordinate; if(c) $('coordReadout').textContent=`LAT ${c[1].toFixed(5)}° · LON ${c[0].toFixed(5)}°`; });
  map.on('singleclick', onMapClick);
  map.on('moveend', ()=>{ if(slopeLayer?.getVisible()||roughnessLayer?.getVisible()) refreshDerivedLayers(false); });
  $('zoomIn').onclick=()=>map.getView().setZoom(Math.min(12,map.getView().getZoom()+.7));
  $('zoomOut').onclick=()=>map.getView().setZoom(Math.max(0,map.getView().getZoom()-.7));
  $('center').onclick=()=>centerGlobal();
  centerGlobal();
  drawPointMarkers();
}
function pointStyle(kind,label){
  const color = kind==='base' ? '#6dd1a6' : kind==='reference' ? '#9bb7d4' : kind==='optional' ? '#f2bb67' : '#ef7048';
  return new ol.style.Style({
    image:new ol.style.Circle({ radius:9, fill:new ol.style.Fill({color}), stroke:new ol.style.Stroke({color:'#fff7ed',width:2}) }),
    text:new ol.style.Text({ text:label||'P', offsetY:-19, fill:new ol.style.Fill({color:'#fff'}), stroke:new ol.style.Stroke({color:'#101010',width:4}), font:'800 11px Inter,Segoe UI,sans-serif' })
  });
}
function routeStyle(selected,kind){
  const color = selected ? '#ff8a58' : kind==='risk' ? '#63d0a0' : kind==='distance' ? '#f0e6d5' : '#f0bf68';
  return new ol.style.Style({ stroke:new ol.style.Stroke({color, width:selected?6:2.5, lineDash:selected?undefined:[9,8]}) });
}

function centerGlobal(){ map.getView().animate({center:[0,0],zoom:1.5,duration:350}); }
function normalizeLon(lon){ let x=((lon+180)%360+360)%360-180; return Math.abs(x)===180?180:x; }
function clampLat(lat){ return clamp(lat,-89.5,89.5); }

function onMapClick(evt){
  if(!selecting) return;
  const [lon,lat]=evt.coordinate;
  if(!Number.isFinite(lon)||!Number.isFinite(lat)) return;
  const index=missionPoints.length;
  const safeLon=normalizeLon(lon); const safeLat=clampLat(lat);
  const point = index===0
    ? {lat:safeLat,lon:safeLon,name:'Base de misión',type:'base',required:true,dwellMin:0}
    : {lat:safeLat,lon:safeLon,name:`Objetivo ${index}`,type:'science',required:true,dwellMin:15};
  missionPoints.push(point);
  currentMission=null;
  drawPointMarkers(); renderMissionList(); updatePlanningUI();
}
function drawPointMarkers(){
  if(!markerLayer) return;
  const source=markerLayer.getSource(); source.clear();
  missionPoints.forEach((p,i)=>source.addFeature(new ol.Feature({geometry:new ol.geom.Point([p.lon,p.lat]),kind:p.type==='base'?'base':p.required?'science':'optional',label:p.type==='base'?'B':String(i)})));
  if(!missionPoints.length) source.addFeature(new ol.Feature({geometry:new ol.geom.Point([LANDING.lon,LANDING.lat]),kind:'reference',label:'P'}));
}

function extentKey(ext){ return ext.map(v=>Number(v).toFixed(3)).join(',')+`|${map.getView().getZoom().toFixed(2)}`; }
function rgbaForSlope(v){
  if(!Number.isFinite(v)) return 'rgba(0,0,0,0)';
  const t=clamp(v/18,0,1); const r=Math.round(70+185*t), g=Math.round(210-145*t), b=Math.round(170-110*t);
  return `rgba(${r},${g},${b},0.42)`;
}
function rgbaForRough(v){
  if(!Number.isFinite(v)) return 'rgba(0,0,0,0)';
  const t=clamp(v/220,0,1); const r=Math.round(45+205*t), g=Math.round(190-120*t), b=Math.round(220-170*t);
  return `rgba(${r},${g},${b},0.40)`;
}
function makeGridSamples(ext,cols=15,rows=15){
  const [minX,minY,maxX,maxY]=ext;
  const points=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) points.push({lat:minY+(maxY-minY)*r/(rows-1),lon:minX+(maxX-minX)*c/(cols-1)});
  return {points,cols,rows,dx:(maxX-minX)/(cols-1),dy:(maxY-minY)/(rows-1),ext};
}
async function refreshDerivedLayers(force=true){
  if(!map || (!slopeLayer.getVisible() && !roughnessLayer.getVisible())) return;
  const zoom=map.getView().getZoom();
  // A escala planetaria no tiene sentido dibujar una malla analítica densa.
  // Esperamos a un zoom regional para solicitar el DEM y evitamos falsas alarmas.
  if(zoom < 2.2){
    ['slope','roughness'].forEach(n=>{
      const layer=n==='slope'?slopeLayer:roughnessLayer;
      if(layer.getVisible()) setLayerStatus(n,'ACERCA PARA ANALIZAR','ready');
    });
    return;
  }
  const ext=map.getView().calculateExtent(map.getSize());
  const [minX,minY,maxX,maxY]=ext;
  const clipped=[clamp(minX,-179.8),clamp(minY,-89.8),clamp(maxX,179.8),clamp(maxY,89.8)];
  const keyExt=extentKey(clipped);
  if(!force && keyExt===lastDerivedExtentKey) return;
  lastDerivedExtentKey=keyExt;
  const token=++derivedRefreshToken;
  if(slopeLayer.getVisible()) markLayerLoading('slope');
  if(roughnessLayer.getVisible()) markLayerLoading('roughness');
  try{
    await window.marsElevationReady;
    const samples=makeGridSamples(clipped,9,9);
    const grid=await window.queryMarsElevations(samples.points);
    if(token!==derivedRefreshToken) return;
    const get=(r,c)=>grid[r*samples.cols+c];
    const slopeFeatures=[], roughFeatures=[];
    for(let r=0;r<samples.rows-1;r++) for(let c=0;c<samples.cols-1;c++){
      const p00=get(r,c),p10=get(r,c+1),p01=get(r+1,c),p11=get(r+1,c+1);
      const vals=[p00?.elevationM,p10?.elevationM,p01?.elevationM,p11?.elevationM].map(Number).filter(Number.isFinite);
      if(vals.length<3) continue;
      const dxKm=Math.max(.001,haversine(p00,p10));
      const dyKm=Math.max(.001,haversine(p00,p01));
      const sx=Math.atan2(Math.abs((Number(p10.elevationM)-Number(p00.elevationM))/1000),dxKm)*180/Math.PI;
      const sy=Math.atan2(Math.abs((Number(p01.elevationM)-Number(p00.elevationM))/1000),dyKm)*180/Math.PI;
      const slope=Math.max(sx,sy);
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const rough=Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length);
      const x0=p00.lon,y0=p00.lat,x1=p11.lon,y1=p11.lat;
      const polygon=new ol.geom.Polygon([[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]]);
      if(slopeLayer.getVisible()) slopeFeatures.push(new ol.Feature({geometry:polygon,slope}));
      if(roughnessLayer.getVisible()) roughFeatures.push(new ol.Feature({geometry:polygon,roughness:rough}));
    }
    slopeLayer.getSource().clear();
    roughnessLayer.getSource().clear();
    slopeFeatures.forEach(f=>f.setStyle(new ol.style.Style({fill:new ol.style.Fill({color:rgbaForSlope(f.get('slope'))}),stroke:new ol.style.Stroke({color:'rgba(255,255,255,.08)',width:1})})));
    roughFeatures.forEach(f=>f.setStyle(new ol.style.Style({fill:new ol.style.Fill({color:rgbaForRough(f.get('roughness'))}),stroke:new ol.style.Stroke({color:'rgba(255,255,255,.08)',width:1})})));
    slopeLayer.getSource().addFeatures(slopeFeatures);
    roughnessLayer.getSource().addFeatures(roughFeatures);
    if(slopeLayer.getVisible()) setLayerStatus('slope',slopeFeatures.length?'ACTIVA':'SIN COBERTURA','live');
    if(roughnessLayer.getVisible()) setLayerStatus('roughness',roughFeatures.length?'ACTIVA':'SIN COBERTURA','live');
  }catch(err){
    if(token!==derivedRefreshToken) return;
    if(slopeLayer.getVisible()) setLayerStatus('slope','NO DISPONIBLE EN ESTA VISTA','ready');
    if(roughnessLayer.getVisible()) setLayerStatus('roughness','NO DISPONIBLE EN ESTA VISTA','ready');
    console.error('Derived layer error',err);
  }
}

function haversine(a,b){
  const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=shortestLonDelta(a.lon,b.lon)*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*MARTIAN_RADIUS*Math.asin(Math.sqrt(h));
}
function pathMetrics(path){
  let d=0,gain=0,descent=0,change=0,maxSlope=0,sumSlope=0,count=0;
  for(let i=1;i<path.length;i++){
    const dist=haversine(path[i-1],path[i]); const e1=path[i-1].elevationM,e2=path[i].elevationM;
    d+=dist;
    if(Number.isFinite(e1)&&Number.isFinite(e2)&&dist>0){
      const rise=e2-e1;
      if(rise>0) gain+=rise; else descent+=Math.abs(rise);
      change+=Math.abs(rise);
      const slope=Math.atan2(Math.abs(rise)/1000,dist)*180/Math.PI;
      maxSlope=Math.max(maxSlope,slope); sumSlope+=slope; count++; path[i].slopeDeg=slope;
    }
  }
  return {
    distanceKm:d,
    gainM:gain,
    descentM:descent,
    elevationChangeM:change,
    maxSlopeDeg:count?maxSlope:null,
    avgSlopeDeg:count?sumSlope/count:null,
    segments:count
  };
}
function nearestNode(grid,p){ return grid.nodes.reduce((best,n)=>!best||haversine(n,p)<haversine(best,p)?n:best,null); }
function neighbors(node,grid){
  const out=[]; for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){const r=node.r+dr,c=node.c+dc;if(r>=0&&r<grid.rows&&c>=0&&c<grid.cols) out.push(grid.nodes[r*grid.cols+c]);} return out;
}
function heuristic(n,goal,mode,params){
  const d=haversine(n,goal);
  if(mode==='distance') return d;
  return mode==='risk' ? d*1.03 : d*1.01;
}
function edgeCost(a,b,mode,params){
  const d=haversine(a,b);
  const speed=Math.max(.1,params.speed);
  const travelHours=d/speed;
  const elevReady=Number.isFinite(a.elevationM)&&Number.isFinite(b.elevationM)&&d>0;
  const rise=elevReady?(b.elevationM-a.elevationM):0;
  const slope=elevReady?Math.atan2(Math.abs(rise)/1000,Math.max(d,.001))*180/Math.PI:0;
  const slopeNorm=Math.min(1.5,slope/15);
  if(mode==='distance') return d;
  if(mode==='risk') {
    const slopePenalty=d*(1 + Math.pow(slope/6,2)*2.6);
    const ascentPenalty=Math.max(0,rise)/1000*0.35;
    return slopePenalty + travelHours*0.22 + ascentPenalty;
  }
  return d*(1 + Math.pow(slopeNorm,1.35)*0.95) + travelHours*0.04 + Math.max(0,rise)/1000*0.12;
}
function aStar(grid,start,goal,mode,params){
  const open=[start], came=new Map(), g=new Map([[key(start),0]]), f=new Map([[key(start),heuristic(start,goal,mode,params)]]);
  while(open.length){
    open.sort((a,b)=>(f.get(key(a))??Infinity)-(f.get(key(b))??Infinity));
    const cur=open.shift();
    if(key(cur)===key(goal)){
      const path=[]; let n=cur; while(n){path.push(n);n=came.get(key(n));} return path.reverse();
    }
    for(const nb of neighbors(cur,grid)){
      const tentative=(g.get(key(cur))??Infinity)+edgeCost(cur,nb,mode,params);
      if(tentative<(g.get(key(nb))??Infinity)){
        came.set(key(nb),cur);g.set(key(nb),tentative);f.set(key(nb),tentative+heuristic(nb,goal,mode,params));
        if(!open.some(n=>key(n)===key(nb)))open.push(nb);
      }
    }
  }
  return null;
}
const key=n=>`${n.r}:${n.c}`;
function forceEndpoints(path,a,b){ if(!path||path.length<2)return path; return [{...a,elevationM:a.elevationM},...path.slice(1,-1),{...b,elevationM:b.elevationM}]; }
function shortestLonDelta(a,b){ return ((b-a+540)%360)-180; }
function interpolateLon(a,b,t){ return normalizeLon(a + shortestLonDelta(a,b)*t); }
function buildGrid(a,b,rows=17,cols=17){
  const latMin=clamp(Math.min(a.lat,b.lat)-Math.max(.08,Math.abs(b.lat-a.lat)*.35),-89.5,89.5);
  const latMax=clamp(Math.max(a.lat,b.lat)+Math.max(.08,Math.abs(b.lat-a.lat)*.35),-89.5,89.5);
  const nodes=[];
  for(let r=0;r<rows;r++){
    const lat=latMin+(latMax-latMin)*(r/(rows-1));
    for(let c=0;c<cols;c++){
      const t=c/(cols-1);
      nodes.push({r,c,lat,lon:interpolateLon(a.lon,b.lon,t)});
    }
  }
  return {nodes,rows,cols};
}
async function getElevations(points){
  if(!window.marsElevationReady || !window.queryMarsElevations){
    throw new Error('La fuente global de elevación todavía está cargando. Espera unos segundos y vuelve a calcular.');
  }
  await window.marsElevationReady;
  const out=await window.queryMarsElevations(points);
  if(!Array.isArray(out)) throw new Error('La fuente global de elevación no devolvió puntos.');
  const valid=out.filter(p=>Number.isFinite(Number(p.elevationM))).length;
  if(valid===0) throw new Error('El DEM global no devolvió elevaciones válidas para la misión.');
  return out;
}

function gridSizeForDistanceKm(distanceKm){
  if(distanceKm>5000) return 11;
  if(distanceKm>2500) return 13;
  if(distanceKm>800) return 15;
  return 17;
}
async function calculateLeg(a,b,mode,params){
  const gridSize=gridSizeForDistanceKm(haversine(a,b));
  const grid=buildGrid(a,b,gridSize,gridSize);
  const samples=grid.nodes.map(n=>({lat:n.lat,lon:n.lon}));
  samples.push({lat:a.lat,lon:a.lon},{lat:b.lat,lon:b.lon});
  const elevated=await getElevations(samples);
  const mapByCoord=new Map(elevated.map(p=>[`${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`,p.elevationM]));
  for(const n of grid.nodes) n.elevationM=mapByCoord.get(`${n.lat.toFixed(5)},${n.lon.toFixed(5)}`);
  const aElev=elevated[elevated.length-2]?.elevationM,bElev=elevated[elevated.length-1]?.elevationM;
  const aa={...a,elevationM:aElev},bb={...b,elevationM:bElev};
  if(!Number.isFinite(aa.elevationM)||!Number.isFinite(bb.elevationM)) throw new Error('No se recibió elevación para uno de los puntos de la misión.');
  const s=nearestNode(grid,aa),g=nearestNode(grid,bb); const path0=aStar(grid,s,g,mode,params);
  if(!path0) throw new Error(`No se encontró trayectoria para el tramo ${a.name} → ${b.name}.`);
  const path=forceEndpoints(path0,aa,bb);
  const metrics=pathMetrics(path);
  return {from:a,to:b,path,metrics,durationHours:estimateDuration(metrics,params)};
}
function riskScore(m){
  if(!m || !Number.isFinite(m.maxSlopeDeg)) return null;
  const slopePenalty=clamp(m.maxSlopeDeg/25,0,1)*70;
  const terrainPenalty=clamp((m.elevationChangeM||0)/1000,0,1)*20;
  const avgPenalty=clamp((m.avgSlopeDeg||0)/18,0,1)*10;
  return Math.round(clamp(slopePenalty+terrainPenalty+avgPenalty,0,100));
}
function riskLabel(score){ if(score<30)return 'Bajo'; if(score<55)return 'Moderado'; if(score<75)return 'Alto'; return 'Muy alto'; }
function normalizeParams(){
  const speed=Math.max(.1,Number($('speed').value)||1.2);
  const evaTime=Math.max(.5,Number($('evaTime').value)||8);
  const returnMargin=clamp(Number($('returnMargin').value)||25,0,80);
  return {speed,evaTime,returnMargin};
}
function availableMissionHours(params){ return params.evaTime*(1-params.returnMargin/100); }
function estimateDuration(metrics,params){
  const speed=Math.max(.1,params.speed);
  const slopeFactor=1+clamp((metrics.avgSlopeDeg||0)/30,0,.8);
  return metrics.distanceKm/speed*slopeFactor;
}
function formatHours(h){ if(!Number.isFinite(h))return '—'; const sign=h<0?'−':''; const value=Math.abs(h); const hrs=Math.floor(value),mins=Math.round((value-hrs)*60); return `${sign}${hrs} h ${String(mins).padStart(2,'0')} min`; }
function formatSignedMargin(h){ return h>=0 ? formatHours(h) : `EXCEDE ${formatHours(-h)}`; }

function sequenceWithReturn(points, returnBase){
  if(!returnBase || points.length<2) return points.map(p=>({...p}));
  const base=points.find((p,i)=>i===0 || p.type==='base') || points[0];
  const last=points[points.length-1];
  const out=points.map(p=>({...p}));
  if(last.lat!==base.lat || last.lon!==base.lon) out.push({...base,name:'Regreso a base',type:'base',required:true,dwellMin:0});
  return out;
}

function createLegCache(){ const cache=new Map(); return { cache, key:(a,b,mode,params)=>`${mode}|${a.lat.toFixed(5)},${a.lon.toFixed(5)}>${b.lat.toFixed(5)},${b.lon.toFixed(5)}|${params.speed.toFixed(2)}` }; }
async function getCachedLeg(a,b,mode,params,legCache){
  const k=legCache.key(a,b,mode,params); if(legCache.cache.has(k)) return legCache.cache.get(k);
  const promise=calculateLeg(a,b,mode,params); legCache.cache.set(k,promise); return promise;
}

async function evaluateSequence(seq,mode,params,legCache){
  const legs=[];
  for(let i=1;i<seq.length;i++) legs.push(await getCachedLeg(seq[i-1],seq[i],mode,params,legCache));
  return aggregateMission(legs,mode,params,seq);
}
async function chooseSequence(mode,basePoints,returnBase,params,legCache){
  const available=availableMissionHours(params);
  const requiredPoints=basePoints.filter((p,i)=>i===0 || p.required);
  const requiredSeq=sequenceWithReturn(requiredPoints,returnBase);
  const requiredMission=await evaluateSequence(requiredSeq,mode,params,legCache);
  let includedOptional=[];
  let currentSeq=requiredSeq;
  const optionalIndices=basePoints.map((p,i)=>({p,i})).filter(x=>x.i>0&&!x.p.required);
  const orderedCandidates=optionalIndices.sort((a,b)=>a.i-b.i);
  const includedCandidates=[];
  const candidateSequence = ()=>{
    const set=new Set(includedCandidates.map(x=>x.i));
    const seq=[basePoints[0]];
    for(let i=1;i<basePoints.length;i++) if(basePoints[i].required || set.has(i)) seq.push(basePoints[i]);
    return sequenceWithReturn(seq,returnBase);
  };
  for(const candidate of orderedCandidates){
    includedCandidates.push(candidate);
    const trialSeq=candidateSequence();
    const trialMission=await evaluateSequence(trialSeq,mode,params,legCache);
    const strategyAllows = mode==='distance' ? true : mode==='balanced' ? (trialMission.score===null || trialMission.score<=78) : (trialMission.score===null || trialMission.score<=62);
    if(trialMission.duration<=available && strategyAllows){
      includedOptional.push(candidate.p);
      currentSeq=trialSeq;
    }else{
      includedCandidates.pop();
    }
  }
  const finalMission = await evaluateSequence(currentSeq,mode,params,legCache);
  const includedSet=new Set(currentSeq.map(p=>`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`));
  const omittedOptional=basePoints.filter((p,i)=>i>0&&!p.required&&!includedSet.has(`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`));
  finalMission.omittedOptional=omittedOptional;
  finalMission.includedPoints=currentSeq;
  finalMission.requiredBaseline=requiredMission;
  finalMission.availableHours=available;
  finalMission.overBudget=finalMission.duration>available;
  finalMission.params={...params};
  finalMission.strategyDescription=mode==='distance'?'Prioriza la menor distancia y usa el tiempo como restricción operacional.':mode==='risk'?'Penaliza fuertemente las pendientes y prioriza una menor exposición topográfica.':'Equilibra distancia, pendiente y tiempo de desplazamiento.';
  return finalMission;
}

function aggregateMission(legs,mode,params,sequence){
  const metrics={distanceKm:0,gainM:0,descentM:0,elevationChangeM:0,maxSlopeDeg:null,avgSlopeDeg:null,segments:0}; let weightedSlope=0,weightedDistance=0;
  legs.forEach(leg=>{
    metrics.distanceKm+=leg.metrics.distanceKm;
    metrics.gainM+=leg.metrics.gainM;
    if(Number.isFinite(leg.metrics.maxSlopeDeg)) metrics.maxSlopeDeg=metrics.maxSlopeDeg===null?leg.metrics.maxSlopeDeg:Math.max(metrics.maxSlopeDeg,leg.metrics.maxSlopeDeg);
    metrics.descentM+=leg.metrics.descentM;
    metrics.elevationChangeM+=leg.metrics.elevationChangeM;
    metrics.segments+=leg.metrics.segments;
    if(Number.isFinite(leg.metrics.avgSlopeDeg)){weightedSlope+=leg.metrics.avgSlopeDeg*leg.metrics.distanceKm;weightedDistance+=leg.metrics.distanceKm;}
  });
  metrics.avgSlopeDeg=weightedDistance?weightedSlope/weightedDistance:null;
  const dwellMinutes=sequence.reduce((s,p)=>s+(Number(p.dwellMin)||0),0);
  const duration=estimateDuration(metrics,params)+dwellMinutes/60;
  const scores=legs.map(x=>riskScore(x.metrics)).filter(Number.isFinite);
  const score=scores.length?Math.max(...scores):null;
  return {mode,legs,metrics,dwellMinutes,duration,score,sequence};
}

async function calculateMission({saveHistory=true}={}){
  if(missionPoints.length<2||busy)return;
  const params=normalizeParams();
  setBusy(true,'Calculando misión: estrategia + terreno + restricciones operacionales…');
  try{
    const basePoints=missionPoints.map(p=>({...p}));
    const modes=['distance','balanced','risk'];
    const legCache=createLegCache();
    const mission={};
    for(const mode of modes){
      setBusy(true,`Evaluando estrategia: ${mode==='distance'?'más directa':mode==='risk'?'menor exposición':'equilibrada'}…`);
      mission[mode]=await chooseSequence(mode,basePoints,$('returnBase').checked,params,legCache);
    }
    currentMission=mission;
    lastCalculatedAt=new Date();
    const selectedMode=document.querySelector('input[name="mode"]:checked').value;
    renderMission(mission[selectedMode]); drawMissionRoutes(mission,selectedMode); updatePlanningUI();
    if(saveHistory) saveHistoryEntry(selectedMode);
    setBusy(false,`MISIÓN CALCULADA · ${lastCalculatedAt.toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'})} · NASA / USGS`);
  }catch(err){ setBusy(false); showToast(err.message); }
}
function drawMissionRoutes(mission,selectedMode){
  const source=routeLayer.getSource(); source.clear();
  ['distance','balanced','risk'].forEach(mode=>mission[mode]?.legs.forEach((leg,index)=>{
    source.addFeature(new ol.Feature({geometry:new ol.geom.LineString(leg.path.map(p=>[p.lon,p.lat])),selected:mode===selectedMode,kind:mode,leg:index+1}));
  }));
}
function renderMission(mission){
  const m=mission.metrics,score=mission.score,available=mission.availableHours ?? availableMissionHours(mission.params||normalizeParams()),margin=available-mission.duration;
  const included=mission.includedPoints?.length ?? mission.sequence?.length ?? mission.legs.length+1;
  const omitted=mission.omittedOptional?.length||0;
  const selectedLabel=mission.mode==='distance'?'Misión más directa':mission.mode==='risk'?'Misión de menor exposición':'Misión equilibrada';
  $('routeName').textContent=selectedLabel;
  $('routeStatus').textContent=mission.overBudget?'FUERA DE LÍMITE':Number.isFinite(score)?`${riskLabel(score).toUpperCase()} · ${score}/100`:'SIN EVALUACIÓN';
  $('routeStatus').className=`pill ${mission.overBudget?'warning':''}`;
  $('routeDescription').textContent=`${included} punto(s) incluidos · ${mission.legs.length} tramo(s) · ${omitted?`${omitted} opcional(es) omitido(s) por restricciones`: 'sin opcionales omitidos'} · ${mission.strategyDescription}`;
  $('distance').textContent=Number.isFinite(m.distanceKm)?`${m.distanceKm.toFixed(2)} km`:'—';
  $('duration').textContent=formatHours(mission.duration);
  $('maxSlope').textContent=Number.isFinite(m.maxSlopeDeg)?`${m.maxSlopeDeg.toFixed(1)}°`:'—';
  $('gain').textContent=Number.isFinite(m.elevationChangeM)?`${Math.round(m.elevationChangeM)} m`:'—';
  $('riskNumber').textContent=Number.isFinite(score)?score:'—'; $('riskLabel').textContent=Number.isFinite(score)?riskLabel(score):'Sin evaluación'; $('riskBar').style.width=`${Number.isFinite(score)?score:0}%`; $('avgSlope').textContent=Number.isFinite(m.avgSlopeDeg)?`${m.avgSlopeDeg.toFixed(1)}°`:'—'; $('segments').textContent=m.segments; $('legsCount').textContent=mission.legs.length; $('dwellTotal').textContent=`${Number.isFinite(mission.dwellMinutes)?mission.dwellMinutes:0} min`; $('missionMargin').textContent=formatSignedMargin(margin);
  $('calcParams').textContent=`${mission.params.speed.toFixed(1)} km/h · EVA ${mission.params.evaTime.toFixed(1)} h · margen ${mission.params.returnMargin}%`;
  $('recalculate').disabled=false; $('saveMission').disabled=false;
  if($('lastCalculated')) $('lastCalculated').textContent=lastCalculatedAt?`Último cálculo: ${lastCalculatedAt.toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}`:'Último cálculo: —';
}

function renderMissionList(){
  const list=$('waypointList'); list.innerHTML='';
  missionPoints.forEach((p,i)=>{
    const row=document.createElement('div'); row.className='waypoint'; const title=p.type==='base'?'BASE':`P${i}`;
    row.innerHTML=`<div class="wpIndex">${title}</div><div class="wpMain"><input class="wpName" value="${escapeHtml(p.name)}" aria-label="Nombre del punto ${i+1}"><div class="wpMeta"><span>${p.lat.toFixed(4)}° N · ${p.lon.toFixed(4)}° E</span><button class="tag ${p.required?'required':'optional'}" data-action="toggleRequired" data-i="${i}">${p.required?'OBLIGATORIO':'OPCIONAL'}</button></div></div><div class="wpActions"><button title="Subir" data-action="up" data-i="${i}" ${i<=1?'disabled':''}>↑</button><button title="Bajar" data-action="down" data-i="${i}" ${i===missionPoints.length-1?'disabled':''}>↓</button><button title="Eliminar" data-action="delete" data-i="${i}" ${i===0?'disabled':''}>×</button></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.wpName').forEach((input,i)=>input.onchange=()=>{missionPoints[i].name=input.value.trim()||`Objetivo ${i}`; currentMission=null; updatePlanningUI();});
  list.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>handleWaypointAction(btn.dataset.action,Number(btn.dataset.i)));
}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function handleWaypointAction(action,i){
  if(action==='toggleRequired'&&i>0)missionPoints[i].required=!missionPoints[i].required;
  if(action==='up'&&i>1)[missionPoints[i-1],missionPoints[i]]=[missionPoints[i],missionPoints[i-1]];
  if(action==='down'&&i>0&&i<missionPoints.length-1)[missionPoints[i+1],missionPoints[i]]=[missionPoints[i],missionPoints[i+1]];
  if(action==='delete'&&i>0)missionPoints.splice(i,1);
  currentMission=null; drawPointMarkers(); renderMissionList(); updatePlanningUI();
}
function updatePlanningUI(){
  $('pointCount').textContent=missionPoints.length; $('calculate').disabled=busy||missionPoints.length<2; $('saveMission').disabled=busy||!currentMission;
  $('selectionHint').textContent=selecting?`Modo misión activo · toca el mapa para agregar el punto ${missionPoints.length+1}.`:(missionPoints.length?`${missionPoints.length} puntos planificados · puedes agregar más o calcular la misión.`:'Activa “Nueva misión” y toca el mapa para agregar puntos.');
}
function newMission(){ missionPoints=[];currentMission=null;selecting=true;routeLayer.getSource().clear();drawPointMarkers();renderMissionList();resetMetrics();updatePlanningUI(); }
function setLanding(){
  const base={lat:LANDING.lat,lon:LANDING.lon,name:'Base: Perseverance',type:'base',required:true,dwellMin:0};
  if(!missionPoints.length) missionPoints=[base];
  else missionPoints[0]={...missionPoints[0],...base};
  selecting=true; drawPointMarkers();renderMissionList();updatePlanningUI();
  map.getView().animate({center:[LANDING.lon,LANDING.lat],zoom:6,duration:450});
}
function resetMetrics(){ ['distance','duration','maxSlope','gain','avgSlope','segments','riskNumber','legsCount','dwellTotal','missionMargin'].forEach(id=>$(id).textContent='—'); $('routeName').textContent='Esperando misión';$('routeStatus').textContent='SIN RUTA';$('routeStatus').className='pill';$('riskLabel').textContent='Sin evaluación';$('riskBar').style.width='0%';if($('calcParams'))$('calcParams').textContent='—';if($('lastCalculated'))$('lastCalculated').textContent='Último cálculo: —';$('recalculate').disabled=true;$('saveMission').disabled=true;}
function clearMission(){missionPoints=[];currentMission=null;selecting=false;routeLayer.getSource().clear();drawPointMarkers();renderMissionList();resetMetrics();updatePlanningUI();}
function setBusy(b,msg){busy=b;$('calculate').disabled=b||missionPoints.length<2;$('recalculate').disabled=b||!currentMission;$('saveMission').disabled=b||!currentMission;if(msg)$('statusText').textContent=msg;else $('statusText').textContent='DATOS CARTOGRÁFICOS · NASA / USGS';}

function getHistory(){ try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch{return[];} }
function setHistory(items){localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,12)));}
function saveHistoryEntry(mode){
  const items=getHistory(),now=new Date(),selected=currentMission?.[mode];
  const fingerprint=JSON.stringify({mode,returnBase:$('returnBase').checked,speed:Number($('speed').value),eva:Number($('evaTime').value),margin:Number($('returnMargin').value),points:missionPoints.map(p=>[p.lat,p.lon,p.name,p.required,p.dwellMin])});
  const existing=items.find(x=>x.fingerprint===fingerprint);
  const entry={id:existing?.id||`m-${Date.now()}`,date:now.toISOString(),name:`Misión ${now.toLocaleDateString('es-NI')} · ${missionPoints.length} puntos`,mode,points:missionPoints.map(p=>({...p})),returnBase:$('returnBase').checked,speed:Number($('speed').value),evaTime:Number($('evaTime').value),returnMargin:Number($('returnMargin').value),metrics:selected?.metrics||null,duration:selected?.duration||null,score:selected?.score??null,includedPoints:selected?.includedPoints||[],omittedOptional:selected?.omittedOptional||[],fingerprint};
  const filtered=items.filter(x=>x.id!==entry.id); filtered.unshift(entry); setHistory(filtered);renderHistory();
}
function renderHistory(){
  const box=$('historyList'); if(!box)return; const items=getHistory();
  if(!items.length){box.innerHTML='<div class="historyEmpty">Aún no hay misiones guardadas.</div>';return;}
  box.innerHTML=items.map(item=>`<div class="historyItem"><div><strong>${escapeHtml(item.name)}</strong><small>${new Date(item.date).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})} · ${item.points.length} puntos · ${item.mode==='risk'?'Menor exposición':item.mode==='distance'?'Más directa':'Equilibrada'}</small></div><div class="historyActions"><button data-load="${item.id}" title="Cargar">Abrir</button><button data-delete="${item.id}" title="Eliminar">×</button></div></div>`).join('');
  box.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>loadHistory(b.dataset.load)); box.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteHistory(b.dataset.delete));
}
function loadHistory(id){
  const item=getHistory().find(x=>x.id===id); if(!item)return;
  missionPoints=item.points.map(p=>({...p})); $('returnBase').checked=item.returnBase!==false; $('speed').value=item.speed ?? 1.2; $('evaTime').value=item.evaTime ?? 8; $('returnMargin').value=item.returnMargin ?? 25;
  const radio=document.querySelector(`input[name="mode"][value="${item.mode}"]`);if(radio)radio.checked=true;
  currentMission=null;selecting=false;drawPointMarkers();renderMissionList();updatePlanningUI();centerGlobal();showToast('Misión cargada con sus parámetros originales. Pulsa “Calcular misión” o “Recalcular” para obtener el nuevo resultado.');
}
function deleteHistory(id){setHistory(getHistory().filter(x=>x.id!==id));renderHistory();}

$('setOrigin').onclick=setLanding;
$('planMode').onclick=newMission;
$('calculate').onclick=()=>calculateMission();
$('clearRoute').onclick=clearMission;
$('recalculate').onclick=()=>calculateMission({saveHistory:true});
$('saveMission').onclick=()=>{if(currentMission){saveHistoryEntry(document.querySelector('input[name="mode"]:checked').value);showToast('Misión guardada en el historial.');}};
$('addBase').onclick=()=>{if(!missionPoints.length){showToast('Crea al menos un punto para fijarlo como base.');return;}missionPoints[0]={...missionPoints[0],name:'Base de misión',type:'base',required:true,dwellMin:0};currentMission=null;drawPointMarkers();renderMissionList();updatePlanningUI();};
document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{
  const layer=el.dataset.layer, visible=el.checked;
  activeLayerNames[visible?'add':'delete'](layer);
  if(layer==='mola'){
    molaLayer.setVisible(visible);
    setLayerStatus('mola',visible?'ACTIVA':'OCULTA',visible?'live':'ready');
  }
  if(layer==='slope'){
    slopeLayer.setVisible(visible);
    slopeLayer.getSource().clear();
    if(visible){
      setLayerStatus('slope',map.getView().getZoom()>=2.2?'CARGANDO…':'ACERCA PARA ANALIZAR',map.getView().getZoom()>=2.2?'loading':'ready');
      refreshDerivedLayers(true);
    } else setLayerStatus('slope','OCULTA','ready');
  }
  if(layer==='roughness'){
    roughnessLayer.setVisible(visible);
    roughnessLayer.getSource().clear();
    if(visible){
      setLayerStatus('roughness',map.getView().getZoom()>=2.2?'CARGANDO…':'ACERCA PARA ANALIZAR',map.getView().getZoom()>=2.2?'loading':'ready');
      refreshDerivedLayers(true);
    } else setLayerStatus('roughness','OCULTA','ready');
  }
  if(layer==='route'){
    routeLayer.setVisible(visible);
    setLayerStatus('route',visible?'ACTIVA':'OCULTA',visible?'live':'ready');
  }
  if(layer==='points'){
    markerLayer.setVisible(visible);
    setLayerStatus('points',visible?'ACTIVA':'OCULTA',visible?'live':'ready');
  }
});
document.querySelectorAll('input[name="mode"]').forEach(el=>el.onchange=()=>{if(currentMission){const mode=el.value;renderMission(currentMission[mode]);drawMissionRoutes(currentMission,mode);}});
$('returnBase').onchange=()=>{currentMission=null;updatePlanningUI();};
['speed','evaTime','returnMargin'].forEach(id=>$(id).addEventListener('input',()=>{if(currentMission){$('recalculate').disabled=false;$('statusText').textContent='CAMBIOS PENDIENTES · pulsa recalcular';}}));
function showToast(msg){$('toast').textContent=msg;$('toast').classList.remove('hide');clearTimeout(showToast.t);showToast.t=setTimeout(()=>$('toast').classList.add('hide'),5000);}

(async()=>{try{D=await fetch(DATA_URL).then(r=>r.json());await prepareLayerSources();initMap();setLayerStatus('mola','ACTIVA','live');setLayerStatus('route','ACTIVA','live');setLayerStatus('points','ACTIVA','live');renderMissionList();renderHistory();updatePlanningUI();$('statusText').textContent='DATOS CARTOGRÁFICOS · NASA / USGS';}catch(e){showToast('No se pudo cargar la configuración.');console.error(e);}})();
