const DATA_URL = 'mars-data.json';
const MARTIAN_RADIUS = 3389.5;
const DEM_RESOLUTION_KM = 0.2;
const LANDING = { lat: 18.44463, lon: 77.45088, name: 'Lugar de referencia: Perseverance', type: 'reference', required: false, dwellMin: 0 };
const GLOBAL_BBOX = { minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 };
const HISTORY_KEY = 'mars-explorer-mission-history-v2';
const SETTINGS_KEY = 'jezero-settings-v29';
const DEFAULTS_KEY = 'jezero-operational-defaults-v29';

let D;
let map, markerLayer, routeLayer, molaLayer, slopeLayer, roughnessLayer, landingLayer, knownLayer;
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
const uiLang = () => window.JEZERO_I18N?.getLanguage?.() || 'es';
const ui = (es,en) => uiLang()==='en' ? en : es;
const themeInfo = () => window.JEZERO_THEMES?.getThemeInfo?.(uiLang()) || {key:'nasa-classic',label:ui('NASA Clásico','NASA Classic'),colors:{success:'#54d6a5',accent2:'#55c8ff',accent:'#fc3d21',text:'#ffffff',bg:'#020611',primary2:'#1769d2'}};
const themeColors = () => window.JEZERO_THEMES?.getColors?.() || themeInfo().colors;

window.addEventListener('jezero:themechange',()=>{
  markerLayer?.changed?.(); routeLayer?.changed?.(); knownLayer?.changed?.(); landingLayer?.changed?.(); renderTerrainProfile(selectedMission?.());
  if(typeof updateSettingsSummary==='function') updateSettingsSummary();
});


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

  knownLayer = new ol.layer.Vector({
    source:new ol.source.Vector(),
    style: feature => knownLocationStyle(feature),
    zIndex:7
  });
  knownLayer.set('layerId','known-locations');
  landingLayer = new ol.layer.Vector({
    source:new ol.source.Vector(),
    style: feature => landingSiteStyle(feature),
    zIndex:8
  });
  landingLayer.set('layerId','landing-sites');
  markerLayer = new ol.layer.Vector({
    source:new ol.source.Vector(),
    style: feature => pointStyle(feature.get('kind'), feature.get('label')),
    zIndex:10
  });
  routeLayer = new ol.layer.Vector({ source:new ol.source.Vector(), zIndex:11 });
  routeLayer.setStyle(feature => routeStyle(feature.get('selected'),feature.get('kind')));

  return { projection, layers:[molaLayer,slopeLayer,roughnessLayer,knownLayer,landingLayer,routeLayer,markerLayer] };
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
  map.on('pointermove', evt=>{ const c=evt.coordinate; if(c) $('coordReadout').textContent=`${formatLat(c[1])} · ${formatLon(c[0])}`; });
  map.on('singleclick', onMapClick);
  map.on('moveend', ()=>{ updateMapScale(); if(slopeLayer?.getVisible()||roughnessLayer?.getVisible()) refreshDerivedLayers(false); });
  $('zoomIn').onclick=()=>map.getView().setZoom(Math.min(12,map.getView().getZoom()+.7));
  $('zoomOut').onclick=()=>map.getView().setZoom(Math.max(0,map.getView().getZoom()-.7));
  $('center').onclick=()=>centerGlobal();
  centerGlobal();
  updateMapScale();
  drawPointMarkers();
  populateReferenceLayers();
}
function hexAlpha(hex,alpha='33'){
  const value=String(hex||'').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? `${value}${alpha}` : value;
}
function pointStyle(kind,label){
  const c=themeColors();
  const color = kind==='base' ? c.success : kind==='reference' ? c.primary2 : kind==='optional' ? c.accent2 : c.accent;
  const stroke=new ol.style.Stroke({color:c.text||'#ffffff',width:2});
  let image;
  if(kind==='base'){
    image=new ol.style.RegularShape({points:4,radius:10,angle:Math.PI/4,fill:new ol.style.Fill({color}),stroke});
  } else if(kind==='science'){
    image=new ol.style.RegularShape({points:6,radius:10,angle:Math.PI/6,fill:new ol.style.Fill({color}),stroke});
  } else if(kind==='optional'){
    image=new ol.style.RegularShape({points:4,radius:9,angle:0,fill:new ol.style.Fill({color}),stroke});
  } else {
    image=new ol.style.Circle({radius:8,fill:new ol.style.Fill({color}),stroke});
  }
  return new ol.style.Style({
    image,
    text:new ol.style.Text({ text:label||'P', offsetY:-20, fill:new ol.style.Fill({color:c.text||'#ffffff'}), stroke:new ol.style.Stroke({color:c.bg||'#101010',width:4}), font:'800 11px "DM Mono",Consolas,monospace' })
  });
}
function routeStyle(selected,kind){
  const c=themeColors();
  const color = selected ? c.accent : kind==='risk' ? c.success : kind==='distance' ? c.text : c.accent2;
  if(selected){
    return [
      new ol.style.Style({stroke:new ol.style.Stroke({color:hexAlpha(c.accent2||c.primary2,'2b'),width:18,lineCap:'round',lineJoin:'round'})}),
      new ol.style.Style({stroke:new ol.style.Stroke({color:hexAlpha(c.bg||'#020611','b8'),width:9,lineCap:'round',lineJoin:'round'})}),
      new ol.style.Style({stroke:new ol.style.Stroke({color,width:4.8,lineCap:'round',lineJoin:'round'})})
    ];
  }
  return new ol.style.Style({ stroke:new ol.style.Stroke({color, width:2.2, lineDash:[9,8]}) });
}

function knownLocationStyle(feature){
  const c=themeColors();
  const color = feature.get('category')==='Cráter / antiguo lago' ? c.primary2 : c.accent2;
  return new ol.style.Style({
    image:new ol.style.RegularShape({points:4,radius:8,angle:Math.PI/4,fill:new ol.style.Fill({color}),stroke:new ol.style.Stroke({color:c.text||'#ffffff',width:1.5})}),
    text:new ol.style.Text({text:feature.get('label')||'',offsetY:-15,fill:new ol.style.Fill({color:c.text||'#ffffff'}),stroke:new ol.style.Stroke({color:c.bg||'#020611',width:3}),font:'800 9px Inter,Segoe UI,sans-serif'})
  });
}
function landingSiteStyle(feature){
  const c=themeColors();
  return new ol.style.Style({
    image:new ol.style.Circle({radius:7,fill:new ol.style.Fill({color:c.accent}),stroke:new ol.style.Stroke({color:c.text||'#ffffff',width:2.5})}),
    text:new ol.style.Text({text:feature.get('label')||'',offsetY:-14,fill:new ol.style.Fill({color:c.text||'#ffffff'}),stroke:new ol.style.Stroke({color:c.bg||'#020611',width:3}),font:'900 9px Inter,Segoe UI,sans-serif'})
  });
}
function populateReferenceLayers(){
  if(!D) return;
  const ks=knownLayer.getSource(); ks.clear();
  (D.knownLocations||[]).forEach(x=>ks.addFeature(new ol.Feature({
    geometry:new ol.geom.Point([x.lon,x.lat]), refKind:'known', refId:x.id, label:x.name,
    name:x.name, category:x.category, lat:x.lat, lon:x.lon, description:x.description, source:x.source, sourceUrl:x.sourceUrl
  })));
  const ls=landingLayer.getSource(); ls.clear();
  (D.landingSites||[]).forEach(x=>ls.addFeature(new ol.Feature({
    geometry:new ol.geom.Point([x.lon,x.lat]), refKind:'landing', refId:x.id, label:x.name,
    name:x.name, mission:x.mission, lat:x.lat, lon:x.lon, site:x.site, date:x.date, description:x.description, source:x.source, sourceUrl:x.sourceUrl
  })));
  const select=$('landingSiteSelect');
  if(select){ select.innerHTML='<option value="">Selecciona un sitio de aterrizaje…</option>'+(D.landingSites||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)} · ${escapeHtml(x.site)}</option>`).join(''); }
}
function focusReference(refKind,refId){
  const layer=refKind==='landing'?landingLayer:knownLayer; const f=layer?.getSource().getFeatures().find(x=>x.get('refId')===refId); if(!f) return;
  map.getView().animate({center:f.getGeometry().getCoordinates(),zoom:Math.max(map.getView().getZoom(),2.8),duration:450}); showReferencePopup(f);
}
function showReferencePopup(feature){
  const box=$('mapInfo'); if(!box) return;
  const kind=feature.get('refKind');
  $('mapInfoKind').textContent=kind==='landing'?'SITIO DE ATERRIZAJE':'UBICACIÓN CONOCIDA';
  $('mapInfoTitle').textContent=feature.get('name');
  $('mapInfoMeta').textContent=kind==='landing'?`${feature.get('mission')} · ${feature.get('site')} · ${feature.get('date')}`:`${feature.get('category')} · punto de referencia`;
  $('mapInfoCoords').textContent=`${formatLat(feature.get('lat'))} · ${formatLon(feature.get('lon'))}`;
  $('mapInfoDescription').textContent=feature.get('description')||'';
  $('mapInfoSource').textContent=`Fuente: ${feature.get('source')}`;
  $('mapInfoSource').href=feature.get('sourceUrl')||'#';
  $('mapInfoUseBase').style.display=kind==='landing'?'inline-flex':'none';
  $('mapInfoAdd').style.display=kind==='landing'?'inline-flex':'inline-flex';
  $('mapInfoAdd').textContent=kind==='landing'?'Agregar este sitio a la misión':'Agregar ubicación a la misión';
  $('mapInfo').dataset.refKind=kind; $('mapInfo').dataset.refId=feature.get('refId');
  box.classList.remove('hide');
}
function closeReferencePopup(){ $('mapInfo')?.classList.add('hide'); }
function addReferenceToMission(feature){
  const point={lat:Number(feature.get('lat')),lon:Number(feature.get('lon')),name:feature.get('name'),type:'science',required:false,dwellMin:15,scienceValue:60};
  missionPoints.push(point); currentMission=null; selecting=true; drawPointMarkers();renderMissionList();updatePlanningUI();showToast(`${feature.get('name')} se añadió como objetivo opcional.`);closeReferencePopup();
}
function setBaseFromLanding(feature){
  const base={lat:Number(feature.get('lat')),lon:Number(feature.get('lon')),name:`Base · ${feature.get('name')}`,type:'base',required:true,dwellMin:0,scienceValue:0,baseSourceId:feature.get('refId')};
  const others=missionPoints.length && missionPoints[0].type==='base' ? missionPoints.slice(1) : missionPoints.filter(p=>p.type!=='base');
  missionPoints=[base,...others]; currentMission=null; selecting=true; routeLayer.getSource().clear(); drawPointMarkers();renderMissionList();resetMetrics();updatePlanningUI();
  map.getView().animate({center:[base.lon,base.lat],zoom:Math.max(map.getView().getZoom(),3),duration:450});
  $('statusText').textContent=`BASE FIJADA · ${feature.get('name')} · agrega los siguientes puntos`;
  showToast(`${feature.get('name')} quedó establecida como BASE (P0).`); closeReferencePopup();
}

function centerGlobal(){ map.getView().animate({center:[0,0],zoom:1.5,duration:350}); }
function normalizeLon(lon){ let x=((lon+180)%360+360)%360-180; return Math.abs(x)===180?180:x; }
function clampLat(lat){ return clamp(lat,-89.5,89.5); }
function formatLat(lat){ const n=Number(lat); return `${Math.abs(n).toFixed(4)}° ${n<0?'S':'N'}`; }
function formatLon(lon){ const n=normalizeLon(Number(lon)); return `${Math.abs(n).toFixed(4)}° ${n<0?'W':'E'}`; }
function updateMapScale(){
  if(!map || !$('scale')) return;
  const size=map.getSize();
  const resolution=map.getView().getResolution();
  const center=map.getView().getCenter()||[0,0];
  const lat=clamp(Number(center[1])||0,-89,89);
  const widthDeg=Math.min(360,Math.abs((Number(resolution)||0)*(size?.[0]||0)));
  const kmPerDegLon=(Math.PI*MARTIAN_RADIUS/180)*Math.max(.08,Math.cos(lat*Math.PI/180));
  const width=widthDeg*kmPerDegLon;
  $('scale').textContent=Number.isFinite(width) ? `VISTA ~${width>=1000?Math.round(width/100)*100:Math.max(1,Math.round(width))} km` : '—';
}

function onMapClick(evt){
  const hit=map.forEachFeatureAtPixel(evt.pixel,feature=>feature.get('refKind')?feature:null,{hitTolerance:8});
  if(hit){ showReferencePopup(hit); return; }
  if(!selecting) return;
  const [lon,lat]=evt.coordinate;
  if(!Number.isFinite(lon)||!Number.isFinite(lat)) return;
  const index=missionPoints.length;
  const safeLon=normalizeLon(lon); const safeLat=clampLat(lat);
  const point = index===0
    ? {lat:safeLat,lon:safeLon,name:'Base de misión',type:'base',required:true,dwellMin:0,scienceValue:0}
    : {lat:safeLat,lon:safeLon,name:`Objetivo ${index}`,type:'science',required:true,dwellMin:15,scienceValue:70};
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
function pathMetrics(path,params){
  let d=0,gain=0,descent=0,change=0,maxSlope=0,sumSlope=0,count=0;
  let maxUphill=0,maxDownhill=0,uphillWeighted=0,downhillWeighted=0;
  let transitWeighted=0,confidenceWeighted=0,roughWeighted=0,metricDistance=0;
  let minTransitability=100,minConfidence=100,uncertainDistance=0,difficultDistance=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    const dist=haversine(a,b); const e1=a.elevationM,e2=b.elevationM;
    d+=dist;
    const analysis=analyzeEdge(a,b,params);
    if(Number.isFinite(e1)&&Number.isFinite(e2)&&dist>0){
      const rise=e2-e1;
      if(rise>0) gain+=rise; else descent+=Math.abs(rise);
      change+=Math.abs(rise);
      const slope=Math.abs(analysis.signedSlopeDeg);
      maxSlope=Math.max(maxSlope,slope); sumSlope+=slope; count++; path[i].slopeDeg=slope; path[i].signedSlopeDeg=analysis.signedSlopeDeg; path[i].transitability=analysis.transitability; path[i].edgeConfidence=analysis.confidence;
      if(analysis.signedSlopeDeg>=0){ maxUphill=Math.max(maxUphill,analysis.signedSlopeDeg); uphillWeighted+=analysis.signedSlopeDeg*dist; }
      else { const down=Math.abs(analysis.signedSlopeDeg); maxDownhill=Math.max(maxDownhill,down); downhillWeighted+=down*dist; }
    }
    if(Number.isFinite(analysis.transitability)){
      transitWeighted+=analysis.transitability*dist;
      minTransitability=Math.min(minTransitability,analysis.transitability);
      if(analysis.transitability<50) difficultDistance+=dist;
    }
    if(Number.isFinite(analysis.confidence)){
      confidenceWeighted+=analysis.confidence*dist;
      minConfidence=Math.min(minConfidence,analysis.confidence);
      if(analysis.confidence<50) uncertainDistance+=dist;
    }
    if(Number.isFinite(analysis.roughnessDeg)) roughWeighted+=analysis.roughnessDeg*dist;
    metricDistance+=dist;
  }
  return {
    distanceKm:d,
    gainM:gain,
    descentM:descent,
    elevationChangeM:change,
    maxSlopeDeg:count?maxSlope:null,
    avgSlopeDeg:count?sumSlope/count:null,
    maxUphillSlopeDeg:count?maxUphill:null,
    maxDownhillSlopeDeg:count?maxDownhill:null,
    avgUphillSlopeDeg:metricDistance?uphillWeighted/metricDistance:null,
    avgDownhillSlopeDeg:metricDistance?downhillWeighted/metricDistance:null,
    avgTransitability:metricDistance?transitWeighted/metricDistance:null,
    minTransitability:metricDistance?minTransitability:null,
    avgConfidence:metricDistance?confidenceWeighted/metricDistance:null,
    minConfidence:metricDistance?minConfidence:null,
    avgRoughnessDeg:metricDistance?roughWeighted/metricDistance:null,
    uncertainDistanceKm:uncertainDistance,
    difficultDistanceKm:difficultDistance,
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
  return mode==='risk' ? d*1.02 : d*1.01;
}
function analyzeEdge(a,b,params){
  const d=haversine(a,b);
  const elevReady=Number.isFinite(a.elevationM)&&Number.isFinite(b.elevationM)&&d>0;
  if(!elevReady) return {distanceKm:d,signedSlopeDeg:null,roughnessDeg:null,confidence:0,transitability:0,blocked:true,reasons:['elevación desconocida']};
  const rise=b.elevationM-a.elevationM;
  const signedSlopeDeg=Math.atan2(rise/1000,Math.max(d,.001))*180/Math.PI;
  const absSlope=Math.abs(signedSlopeDeg);
  const roughnessDeg=[a.localRoughnessDeg,b.localRoughnessDeg].filter(Number.isFinite).reduce((x,y,_,arr)=>x+y/arr.length,0);
  const confVals=[a.dataConfidence,b.dataConfidence].filter(Number.isFinite);
  const confidence=confVals.length?Math.min(...confVals):0;
  const baseVals=[a.baseTransitability,b.baseTransitability].filter(Number.isFinite);
  const baseTransitability=baseVals.length?baseVals.reduce((x,y)=>x+y,0)/baseVals.length:50;
  const directionalPenalty=signedSlopeDeg>=0 ? absSlope*.75 : absSlope*.45;
  const transitability=clamp(baseTransitability-directionalPenalty,0,100);
  const reasons=[];
  if(absSlope>params.maxSlopeLimit) reasons.push(`pendiente ${absSlope.toFixed(1)}° > ${params.maxSlopeLimit.toFixed(1)}°`);
  if(transitability<params.minTransitability) reasons.push(`transitabilidad ${transitability.toFixed(0)} < ${params.minTransitability.toFixed(0)}`);
  if(confidence<params.minConfidence) reasons.push(`confianza ${confidence.toFixed(0)}% < ${params.minConfidence.toFixed(0)}%`);
  return {distanceKm:d,riseM:rise,signedSlopeDeg,absSlopeDeg:absSlope,roughnessDeg,confidence,transitability,blocked:reasons.length>0,reasons};
}
function edgeCost(a,b,mode,params){
  const x=analyzeEdge(a,b,params);
  if(x.blocked || !Number.isFinite(x.distanceKm)) return Infinity;
  const d=x.distanceKm;
  const speed=Math.max(.1,params.speed);
  const travelHours=d/speed;
  const uphill=Math.max(0,x.signedSlopeDeg||0),downhill=Math.max(0,-(x.signedSlopeDeg||0));
  const directionalSlopeNorm=clamp((uphill*1.25+downhill*.85)/18,0,2);
  const transitPenalty=clamp((100-x.transitability)/100,0,1);
  const uncertaintyPenalty=clamp((100-x.confidence)/100,0,1);
  const roughPenalty=clamp((x.roughnessDeg||0)/12,0,1.5);
  if(mode==='distance') return d*(1+transitPenalty*.10+uncertaintyPenalty*.08);
  if(mode==='risk') return d*(1+directionalSlopeNorm*1.55+transitPenalty*1.8+uncertaintyPenalty*1.25+roughPenalty*.75)+travelHours*.18;
  return d*(1+directionalSlopeNorm*.75+transitPenalty*.8+uncertaintyPenalty*.55+roughPenalty*.35)+travelHours*.06;
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
      const edge=edgeCost(cur,nb,mode,params);
      if(!Number.isFinite(edge)) continue;
      const tentative=(g.get(key(cur))??Infinity)+edge;
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
  // V26: corredor 2D orientado al tramo. La versión anterior variaba la latitud
  // por fila, pero reutilizaba la misma longitud por columna; en tramos casi N/S
  // las columnas podían colapsar y A* no tenía espacio real para rodear terreno.
  const directKm=Math.max(.001,haversine(a,b));
  const kmPerDegLat=Math.PI*MARTIAN_RADIUS/180;
  const midLat=(a.lat+b.lat)/2;
  const kmPerDegLon=Math.max(kmPerDegLat*.08,kmPerDegLat*Math.cos(midLat*Math.PI/180));
  const eastKm=shortestLonDelta(a.lon,b.lon)*kmPerDegLon;
  const northKm=(b.lat-a.lat)*kmPerDegLat;
  const norm=Math.max(.001,Math.hypot(eastKm,northKm));
  const perpEast=-northKm/norm;
  const perpNorth=eastKm/norm;
  const corridorHalfWidthKm=clamp(directKm*.35,4,120);
  const nodes=[];

  for(let r=0;r<rows;r++){
    const lateral=((r/(rows-1))-.5)*2*corridorHalfWidthKm;
    for(let c=0;c<cols;c++){
      const t=c/(cols-1);
      const centerLat=a.lat+(b.lat-a.lat)*t;
      const centerLon=interpolateLon(a.lon,b.lon,t);
      const offsetNorth=perpNorth*lateral;
      const offsetEast=perpEast*lateral;
      const lat=clamp(centerLat+offsetNorth/kmPerDegLat,-89.5,89.5);
      const localKmPerDegLon=Math.max(kmPerDegLat*.08,kmPerDegLat*Math.cos(lat*Math.PI/180));
      const lon=normalizeLon(centerLon+offsetEast/localKmPerDegLon);
      nodes.push({r,c,lat,lon});
    }
  }
  return {nodes,rows,cols,corridorHalfWidthKm};
}
function stddev(values){
  if(!values.length) return 0;
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  return Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);
}
function annotateGridTerrain(grid){
  const spacings=[];
  for(const n of grid.nodes){
    if(n.c+1<grid.cols) spacings.push(haversine(n,grid.nodes[n.r*grid.cols+n.c+1]));
    if(n.r+1<grid.rows) spacings.push(haversine(n,grid.nodes[(n.r+1)*grid.cols+n.c]));
  }
  const sorted=spacings.filter(Number.isFinite).sort((a,b)=>a-b);
  const medianSpacingKm=sorted.length?sorted[Math.floor(sorted.length/2)]:DEM_RESOLUTION_KM;
  const densityFactor=clamp((DEM_RESOLUTION_KM*3)/Math.max(DEM_RESOLUTION_KM,medianSpacingKm),0,1);
  for(const node of grid.nodes){
    const allNeighbors=neighbors(node,grid);
    const validNeighbors=allNeighbors.filter(x=>Number.isFinite(x.elevationM));
    const ownValid=Number.isFinite(node.elevationM);
    const slopes=[];
    const elevations=ownValid?[node.elevationM]:[];
    if(ownValid){
      for(const nb of validNeighbors){
        const dist=haversine(node,nb);
        if(dist>0){
          slopes.push(Math.atan2(Math.abs(nb.elevationM-node.elevationM)/1000,dist)*180/Math.PI);
          elevations.push(nb.elevationM);
        }
      }
    }
    const completeness=ownValid?(1+validNeighbors.length)/(1+allNeighbors.length):0;
    const confidence=ownValid?clamp(100*completeness*(.35+.65*densityFactor),0,100):0;
    const maxLocalSlopeDeg=slopes.length?Math.max(...slopes):null;
    const localRoughnessDeg=slopes.length?stddev(slopes):null;
    const localRoughnessM=elevations.length>1?stddev(elevations):null;
    const baseTransitability=ownValid?clamp(100-(maxLocalSlopeDeg||0)*2.35-(localRoughnessDeg||0)*2.0-(100-confidence)*.22,0,100):0;
    Object.assign(node,{dataConfidence:confidence,maxLocalSlopeDeg,localRoughnessDeg,localRoughnessM,baseTransitability});
  }
  grid.medianSpacingKm=medianSpacingKm;
  grid.densityFactor=densityFactor;
  return grid;
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
  annotateGridTerrain(grid);
  const aElev=elevated[elevated.length-2]?.elevationM,bElev=elevated[elevated.length-1]?.elevationM;
  const aa={...a,elevationM:aElev},bb={...b,elevationM:bElev};
  if(!Number.isFinite(aa.elevationM)||!Number.isFinite(bb.elevationM)) throw new Error('No se recibió elevación para uno de los puntos de la misión.');
  const s=nearestNode(grid,aa),g=nearestNode(grid,bb);
  const path0=aStar(grid,s,g,mode,params);
  if(!path0) throw new Error(`No existe una trayectoria que cumpla los límites duros entre ${a.name} y ${b.name}. Revisa pendiente máxima, transitabilidad mínima o confianza cartográfica.`);
  const startPoint={...aa,dataConfidence:s.dataConfidence,baseTransitability:s.baseTransitability,localRoughnessDeg:s.localRoughnessDeg,localRoughnessM:s.localRoughnessM};
  const endPoint={...bb,dataConfidence:g.dataConfidence,baseTransitability:g.baseTransitability,localRoughnessDeg:g.localRoughnessDeg,localRoughnessM:g.localRoughnessM};
  const path=forceEndpoints(path0,startPoint,endPoint);
  const metrics=pathMetrics(path,params);
  return {from:a,to:b,path,metrics,durationHours:estimateDuration(metrics,params),gridSpacingKm:grid.medianSpacingKm};
}
function riskScore(m){
  if(!m || !Number.isFinite(m.maxSlopeDeg)) return null;
  const slopePenalty=clamp(m.maxSlopeDeg/25,0,1)*35;
  const transitPenalty=clamp((100-(m.minTransitability??100))/100,0,1)*30;
  const uncertaintyPenalty=clamp((100-(m.avgConfidence??100))/100,0,1)*20;
  const roughnessPenalty=clamp((m.avgRoughnessDeg||0)/10,0,1)*15;
  return Math.round(clamp(slopePenalty+transitPenalty+uncertaintyPenalty+roughnessPenalty,0,100));
}
function riskLabel(score){ if(score<30)return 'Bajo'; if(score<55)return 'Moderado'; if(score<75)return 'Alto'; return 'Muy alto'; }
function normalizeParams(){
  const speed=Math.max(.1,Number($('speed').value)||1.2);
  const evaTime=Math.max(.5,Number($('evaTime').value)||8);
  const returnMargin=clamp(Number($('returnMargin').value)||25,0,80);
  const maxSlopeLimit=clamp(Number($('maxSlopeLimit')?.value)||25,1,45);
  const minTransitability=clamp(Number($('minTransitability')?.value)||25,0,100);
  const minConfidence=clamp(Number($('minConfidence')?.value)||20,0,100);
  return {speed,evaTime,returnMargin,maxSlopeLimit,minTransitability,minConfidence};
}
function availableMissionHours(params){ return params.evaTime*(1-params.returnMargin/100); }
function estimateDuration(metrics,params){
  const speed=Math.max(.1,params.speed);
  const uphillFactor=1+clamp((metrics.avgUphillSlopeDeg||0)/20,0,.7)*.55;
  const downhillFactor=1+clamp((metrics.avgDownhillSlopeDeg||0)/20,0,.7)*.28;
  const terrainFactor=1+clamp((100-(metrics.avgTransitability??100))/100,0,1)*.35;
  const uncertaintyFactor=1+clamp((100-(metrics.avgConfidence??100))/100,0,1)*.12;
  return metrics.distanceKm/speed*uphillFactor*downhillFactor*terrainFactor*uncertaintyFactor;
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

function createLegCache(){ const cache=new Map(); return { cache, key:(a,b,mode,params)=>`${mode}|${a.lat.toFixed(5)},${a.lon.toFixed(5)}>${b.lat.toFixed(5)},${b.lon.toFixed(5)}|${params.speed.toFixed(2)}|${params.maxSlopeLimit.toFixed(1)}|${params.minTransitability.toFixed(0)}|${params.minConfidence.toFixed(0)}` }; }
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
  let includedCandidates=[];
  let scienceDecisions=[];
  let currentSeq=requiredSeq;
  let currentMission=requiredMission;
  let remaining=basePoints.map((p,i)=>({p,i})).filter(x=>x.i>0&&!x.p.required);
  const candidateSequence = (extra=null)=>{
    const set=new Set(includedCandidates.map(x=>x.i));
    if(extra) set.add(extra.i);
    const seq=[basePoints[0]];
    for(let i=1;i<basePoints.length;i++) if(basePoints[i].required || set.has(i)) seq.push(basePoints[i]);
    return sequenceWithReturn(seq,returnBase);
  };
  const isFeasible = trial => {
    const strategyAllows = mode==='distance' ? true : mode==='balanced' ? (trial.score===null || trial.score<=78) : (trial.score===null || trial.score<=62);
    return trial.duration<=available && strategyAllows;
  };
  const utilityFor = (candidate,trial) => {
    const science=clamp(Number(candidate.p.scienceValue ?? 50),0,100);
    const deltaDuration=Math.max(.02,trial.duration-currentMission.duration);
    const deltaDistance=Math.max(.01,trial.metrics.distanceKm-currentMission.metrics.distanceKm);
    const deltaRisk=Math.max(0,(trial.score??0)-(currentMission.score??0));
    const confidence=Math.max(10,trial.metrics.avgConfidence??50);
    if(mode==='distance') return science/(1+deltaDistance*12+deltaDuration*3+deltaRisk*.15) * (confidence/100);
    if(mode==='risk') return science/(1+deltaDuration*6+deltaRisk*2.2+deltaDistance*2.5) * (confidence/100);
    return science/(1+deltaDuration*5+deltaDistance*5+deltaRisk*.8) * (confidence/100);
  };
  while(remaining.length){
    let best=null;
    for(const candidate of remaining){
      const trialSeq=candidateSequence(candidate);
      const trialMission=await evaluateSequence(trialSeq,mode,params,legCache);
      if(!isFeasible(trialMission)) continue;
      const utility=utilityFor(candidate,trialMission);
      if(!best || utility>best.utility) best={candidate,trialSeq,trialMission,utility};
    }
    if(!best) break;
    const before=currentMission;
    includedCandidates.push(best.candidate);
    scienceDecisions.push({
      pointIndex:best.candidate.i,
      name:best.candidate.p.name,
      included:true,
      utility:best.utility,
      deltaDistanceKm:Math.max(0,best.trialMission.metrics.distanceKm-before.metrics.distanceKm),
      deltaDurationHours:Math.max(0,best.trialMission.duration-before.duration),
      deltaDifficulty:Math.max(0,(best.trialMission.score??0)-(before.score??0)),
      confidence:Number(best.trialMission.metrics.avgConfidence??0),
      scienceValue:clamp(Number(best.candidate.p.scienceValue??50),0,100)
    });
    currentSeq=best.trialSeq;
    currentMission=best.trialMission;
    remaining=remaining.filter(x=>x.i!==best.candidate.i);
  }
  const finalMission = currentMission;
  const includedSet=new Set(currentSeq.map(p=>`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`));
  const omittedOptional=basePoints.filter((p,i)=>i>0&&!p.required&&!includedSet.has(`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`));
  for(const item of remaining){
    scienceDecisions.push({
      pointIndex:item.i,name:item.p.name,included:false,utility:0,
      deltaDistanceKm:null,deltaDurationHours:null,deltaDifficulty:null,
      confidence:null,scienceValue:clamp(Number(item.p.scienceValue??50),0,100)
    });
  }
  finalMission.omittedOptional=omittedOptional;
  finalMission.scienceDecisions=scienceDecisions;
  finalMission.includedPoints=currentSeq;
  finalMission.requiredBaseline=requiredMission;
  finalMission.availableHours=available;
  finalMission.overBudget=finalMission.duration>available;
  finalMission.params={...params};
  finalMission.scienceValuePotential=basePoints.filter((p,i)=>i>0&&p.type!=='base').reduce((sum,p)=>sum+clamp(Number(p.scienceValue??50),0,100),0);
  finalMission.scienceEfficiency=finalMission.scienceValuePotential?clamp(finalMission.scienceValueTotal/finalMission.scienceValuePotential*100,0,100):0;
  finalMission.strategyDescription=mode==='distance'
    ?'Minimiza distancia dentro de límites duros; los opcionales se seleccionan por valor científico frente al desvío adicional.'
    :mode==='risk'
      ?'Prioriza transitabilidad, confianza cartográfica y menor exposición; los opcionales deben justificar su costo científico-operacional.'
      :'Equilibra distancia, pendiente direccional, transitabilidad, incertidumbre, tiempo y valor científico.';
  return finalMission;
}

function aggregateMission(legs,mode,params,sequence){
  const metrics={distanceKm:0,gainM:0,descentM:0,elevationChangeM:0,maxSlopeDeg:null,avgSlopeDeg:null,maxUphillSlopeDeg:null,maxDownhillSlopeDeg:null,avgUphillSlopeDeg:null,avgDownhillSlopeDeg:null,avgTransitability:null,minTransitability:null,avgConfidence:null,minConfidence:null,avgRoughnessDeg:null,uncertainDistanceKm:0,difficultDistanceKm:0,segments:0};
  let weightedSlope=0,weightedDistance=0,weightedUp=0,weightedDown=0,weightedTransit=0,weightedConfidence=0,weightedRough=0;
  legs.forEach(leg=>{
    const lm=leg.metrics,dist=lm.distanceKm||0;
    metrics.distanceKm+=dist; metrics.gainM+=lm.gainM; metrics.descentM+=lm.descentM; metrics.elevationChangeM+=lm.elevationChangeM; metrics.segments+=lm.segments;
    metrics.uncertainDistanceKm+=lm.uncertainDistanceKm||0; metrics.difficultDistanceKm+=lm.difficultDistanceKm||0;
    if(Number.isFinite(lm.maxSlopeDeg)) metrics.maxSlopeDeg=metrics.maxSlopeDeg===null?lm.maxSlopeDeg:Math.max(metrics.maxSlopeDeg,lm.maxSlopeDeg);
    if(Number.isFinite(lm.maxUphillSlopeDeg)) metrics.maxUphillSlopeDeg=metrics.maxUphillSlopeDeg===null?lm.maxUphillSlopeDeg:Math.max(metrics.maxUphillSlopeDeg,lm.maxUphillSlopeDeg);
    if(Number.isFinite(lm.maxDownhillSlopeDeg)) metrics.maxDownhillSlopeDeg=metrics.maxDownhillSlopeDeg===null?lm.maxDownhillSlopeDeg:Math.max(metrics.maxDownhillSlopeDeg,lm.maxDownhillSlopeDeg);
    if(Number.isFinite(lm.minTransitability)) metrics.minTransitability=metrics.minTransitability===null?lm.minTransitability:Math.min(metrics.minTransitability,lm.minTransitability);
    if(Number.isFinite(lm.minConfidence)) metrics.minConfidence=metrics.minConfidence===null?lm.minConfidence:Math.min(metrics.minConfidence,lm.minConfidence);
    if(dist>0){
      if(Number.isFinite(lm.avgSlopeDeg)) weightedSlope+=lm.avgSlopeDeg*dist;
      if(Number.isFinite(lm.avgUphillSlopeDeg)) weightedUp+=lm.avgUphillSlopeDeg*dist;
      if(Number.isFinite(lm.avgDownhillSlopeDeg)) weightedDown+=lm.avgDownhillSlopeDeg*dist;
      if(Number.isFinite(lm.avgTransitability)) weightedTransit+=lm.avgTransitability*dist;
      if(Number.isFinite(lm.avgConfidence)) weightedConfidence+=lm.avgConfidence*dist;
      if(Number.isFinite(lm.avgRoughnessDeg)) weightedRough+=lm.avgRoughnessDeg*dist;
      weightedDistance+=dist;
    }
  });
  metrics.avgSlopeDeg=weightedDistance?weightedSlope/weightedDistance:null;
  metrics.avgUphillSlopeDeg=weightedDistance?weightedUp/weightedDistance:null;
  metrics.avgDownhillSlopeDeg=weightedDistance?weightedDown/weightedDistance:null;
  metrics.avgTransitability=weightedDistance?weightedTransit/weightedDistance:null;
  metrics.avgConfidence=weightedDistance?weightedConfidence/weightedDistance:null;
  metrics.avgRoughnessDeg=weightedDistance?weightedRough/weightedDistance:null;
  const dwellMinutes=sequence.reduce((s,p)=>s+(Number(p.dwellMin)||0),0);
  const duration=estimateDuration(metrics,params)+dwellMinutes/60;
  const scores=legs.map(x=>riskScore(x.metrics)).filter(Number.isFinite);
  const score=scores.length?Math.max(...scores):null;
  const uniqueScience=new Map();
  sequence.forEach(p=>{ if(p.type!=='base'){ const k=`${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`; if(!uniqueScience.has(k)) uniqueScience.set(k,clamp(Number(p.scienceValue??50),0,100)); } });
  const scienceValueTotal=[...uniqueScience.values()].reduce((a,b)=>a+b,0);
  return {mode,legs,metrics,dwellMinutes,duration,score,sequence,scienceValueTotal,scienceTargetsIncluded:uniqueScience.size};
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

function selectedMission(){
  const mode=document.querySelector('input[name="mode"]:checked')?.value||'balanced';
  return currentMission?.[mode]||null;
}
function missionPathNodes(mission){
  const out=[];
  (mission?.legs||[]).forEach((leg,li)=>{
    (leg.path||[]).forEach((node,ni)=>{
      if(li>0 && ni===0) return;
      out.push(node);
    });
  });
  return out;
}
function profileSeries(mission){
  const nodes=missionPathNodes(mission);
  const series=[];
  let km=0,prev=null;
  for(const node of nodes){
    if(prev) km+=haversine(prev,node);
    if(Number.isFinite(Number(node.elevationM))) series.push({km,elevationM:Number(node.elevationM)});
    prev=node;
  }
  return series;
}
function renderTerrainProfile(mission){
  const host=$('terrainProfileMini'); if(!host) return;
  const pts=profileSeries(mission);
  if(pts.length<2){host.innerHTML=`<span>${ui('Calcula una misión para generar el perfil.','Calculate a mission to generate the profile.')}</span>`;return;}
  const minE=Math.min(...pts.map(x=>x.elevationM)),maxE=Math.max(...pts.map(x=>x.elevationM));
  const span=Math.max(1,maxE-minE),maxKm=Math.max(.001,pts.at(-1).km);
  const W=520,H=150,padX=30,padY=18,plotW=W-padX*2,plotH=H-padY*2;
  const coords=pts.map(p=>`${(padX+p.km/maxKm*plotW).toFixed(1)},${(padY+(maxE-p.elevationM)/span*plotH).toFixed(1)}`).join(' ');
  const fill=`${padX},${H-padY} ${coords} ${W-padX},${H-padY}`;
  const c=themeColors();
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ui('Perfil de elevación de la ruta','Route elevation profile')}">
    <defs><linearGradient id="jezeroProfileFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.accent2}" stop-opacity=".42"/><stop offset="1" stop-color="${c.accent2}" stop-opacity=".04"/></linearGradient></defs>
    <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${H-padY}" class="profileAxis"/>
    <line x1="${padX}" y1="${H-padY}" x2="${W-padX}" y2="${H-padY}" class="profileAxis"/>
    <polygon points="${fill}" fill="url(#jezeroProfileFill)"/>
    <polyline points="${coords}" fill="none" stroke="${c.accent}" stroke-width="3" vector-effect="non-scaling-stroke"/>
    <text x="${padX}" y="12">${Math.round(maxE)} m</text>
    <text x="${padX}" y="${H-3}">${Math.round(minE)} m</text>
    <text x="${W-padX}" y="${H-3}" text-anchor="end">${maxKm.toFixed(2)} km</text>
  </svg>`;
}
function renderMissionTimeline(mission){
  const host=$('missionTimeline'); if(!host) return;
  const seq=mission?.includedPoints||mission?.sequence||missionPoints;
  if(!seq?.length){host.innerHTML='<div class="timelineEmpty">BASE → OBJETIVOS → REGRESO</div>';return;}
  host.innerHTML=seq.map((p,i)=>{
    const base=p.type==='base'||i===0;
    const cls=base?'base':p.required?'required':'optional';
    const code=base?(i===seq.length-1&&i>0?'HOME':'BASE'):`S${String(i).padStart(2,'0')}`;
    return `<div class="timelineNode ${cls}"><span>${code}</span><b>${escapeHtml(p.name||code)}</b></div>${i<seq.length-1?'<i class="timelineLink"></i>':''}`;
  }).join('');
}
function updateMissionHud(mission){
  const m=mission?.metrics||{};
  const available=mission?.availableHours ?? (mission?.params?availableMissionHours(mission.params):null);
  const margin=Number.isFinite(available)&&Number.isFinite(mission?.duration)?available-mission.duration:null;
  if($('hudPlan')) $('hudPlan').textContent=mission?ui('RUTA ACTIVA','ACTIVE ROUTE'):ui('SIN RUTA','NO ROUTE');
  if($('hudScience')) $('hudScience').textContent=mission&&Number.isFinite(mission.scienceEfficiency)?`${Math.round(mission.scienceEfficiency)}%`:'—';
  if($('hudTransit')) $('hudTransit').textContent=Number.isFinite(m.avgTransitability)?`${Math.round(m.avgTransitability)}/100`:'—';
  if($('hudReturn')) $('hudReturn').textContent=Number.isFinite(margin)?formatSignedMargin(margin):'—';
}
function updateHeaderStatus(){
  const meta=getMissionSettings?.()||{};
  if($('headerMissionCode')) $('headerMissionCode').textContent=meta.missionCode||meta.missionName||ui('SIN ID','NO ID');
  if($('headerTargetCount')) $('headerTargetCount').textContent=String(scienceTargets().length);
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
  $('riskNumber').textContent=Number.isFinite(score)?score:'—'; $('riskLabel').textContent=Number.isFinite(score)?riskLabel(score):'Sin evaluación'; $('riskBar').style.width=`${Number.isFinite(score)?score:0}%`; $('avgSlope').textContent=Number.isFinite(m.avgSlopeDeg)?`${m.avgSlopeDeg.toFixed(1)}°`:'—'; $('segments').textContent=m.segments; $('legsCount').textContent=mission.legs.length; $('dwellTotal').textContent=`${Number.isFinite(mission.dwellMinutes)?mission.dwellMinutes:0} min`; $('missionMargin').textContent=formatSignedMargin(margin); if($('avgTransitability'))$('avgTransitability').textContent=Number.isFinite(m.avgTransitability)?`${m.avgTransitability.toFixed(0)}/100`:'—'; if($('minTransitabilityMetric'))$('minTransitabilityMetric').textContent=Number.isFinite(m.minTransitability)?`${m.minTransitability.toFixed(0)}/100`:'—'; if($('avgConfidence'))$('avgConfidence').textContent=Number.isFinite(m.avgConfidence)?`${m.avgConfidence.toFixed(0)}%`:'—'; if($('minConfidenceMetric'))$('minConfidenceMetric').textContent=Number.isFinite(m.minConfidence)?`${m.minConfidence.toFixed(0)}%`:'—'; if($('scienceValueTotal'))$('scienceValueTotal').textContent=Number.isFinite(mission.scienceValueTotal)?`${Math.round(mission.scienceValueTotal)} pts`:'—';
  $('calcParams').textContent=`${mission.params.speed.toFixed(1)} km/h · EVA ${mission.params.evaTime.toFixed(1)} h · margen ${mission.params.returnMargin}% · pendiente ≤${mission.params.maxSlopeLimit.toFixed(0)}° · transit. ≥${mission.params.minTransitability.toFixed(0)} · confianza ≥${mission.params.minConfidence.toFixed(0)}%`; 
  updateScienceSummary(mission);
  renderMissionTimeline(mission);
  renderTerrainProfile(mission);
  updateMissionHud(mission);
  updateHeaderStatus();
  $('recalculate').disabled=false; $('saveMission').disabled=false;
  if($('lastCalculated')) $('lastCalculated').textContent=lastCalculatedAt?`Último cálculo: ${lastCalculatedAt.toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}`:'Último cálculo: —';
}

function renderMissionList(){
  const list=$('waypointList'); list.innerHTML='';
  missionPoints.forEach((p,i)=>{
    const row=document.createElement('div'); row.className='waypoint'; const title=p.type==='base'?'BASE':`P${i}`;
    row.innerHTML=`<div class="wpIndex">${title}</div><div class="wpMain"><input class="wpName" value="${escapeHtml(p.name)}" aria-label="Nombre del punto ${i+1}"><div class="wpMeta"><span>${formatLat(p.lat)} · ${formatLon(p.lon)}</span><button class="tag ${p.required?'required':'optional'}" data-action="toggleRequired" data-i="${i}">${p.required?'OBLIGATORIO':'OPCIONAL'}</button>${p.type==='base'?'':`<label class="scienceValueEdit">CIENCIA <input class="wpScienceValue" data-i="${i}" type="number" min="0" max="100" step="1" value="${clamp(Number(p.scienceValue??50),0,100)}"></label>`}</div></div><div class="wpActions"><button title="Subir" data-action="up" data-i="${i}" ${i<=1?'disabled':''}>↑</button><button title="Bajar" data-action="down" data-i="${i}" ${i===missionPoints.length-1?'disabled':''}>↓</button><button title="Eliminar" data-action="delete" data-i="${i}" ${i===0?'disabled':''}>×</button></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.wpName').forEach((input,i)=>input.onchange=()=>{missionPoints[i].name=input.value.trim()||`Objetivo ${i}`; currentMission=null; updatePlanningUI();});
  list.querySelectorAll('.wpScienceValue').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.i);missionPoints[i].scienceValue=clamp(Number(input.value)||0,0,100);currentMission=null;updatePlanningUI();});
  list.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>handleWaypointAction(btn.dataset.action,Number(btn.dataset.i)));
  renderScienceEditor();
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
  renderScienceEditor();
  const active=currentMission?.[document.querySelector('input[name="mode"]:checked')?.value||'balanced']||null;
  updateScienceSummary(active);
  renderMissionTimeline(active);
  updateMissionHud(active);
  updateHeaderStatus();
  updateSettingsSummary();
}
function newMission(){ missionPoints=[];currentMission=null;selecting=true;routeLayer.getSource().clear();drawPointMarkers();renderMissionList();resetMetrics();updatePlanningUI(); }
function setLanding(){
  const base={lat:LANDING.lat,lon:LANDING.lon,name:'Base: Perseverance',type:'base',required:true,dwellMin:0,scienceValue:0};
  // Perseverance queda automáticamente como P0/base de la misión.
  // Si ya hay objetivos, se conservan desde el segundo elemento en adelante.
  missionPoints = missionPoints.length ? [base, ...missionPoints.slice(1)] : [base];
  currentMission=null;
  routeLayer.getSource().clear();
  selecting=true;
  drawPointMarkers();
  renderMissionList();
  resetMetrics();
  updatePlanningUI();
  $('statusText').textContent='BASE DE PERSEVERANCE FIJADA · agrega los siguientes puntos en el mapa';
  map.getView().animate({center:[LANDING.lon,LANDING.lat],zoom:6,duration:450});
  showToast('Perseverance se marcó automáticamente como el punto BASE (P0).');
}
function resetMetrics(){
  ['distance','duration','maxSlope','gain','avgSlope','segments','riskNumber','legsCount','dwellTotal','missionMargin','avgTransitability','minTransitabilityMetric','avgConfidence','minConfidenceMetric','scienceValueTotal'].forEach(id=>{if($(id))$(id).textContent='—';});
  if($('routeName'))$('routeName').textContent=ui('Esperando misión','Waiting for mission');
  if($('routeStatus')){$('routeStatus').textContent=ui('SIN RUTA','NO ROUTE');$('routeStatus').className='pill';}
  if($('riskLabel'))$('riskLabel').textContent=ui('Sin evaluación','Not evaluated');
  if($('riskBar'))$('riskBar').style.width='0%';
  if($('calcParams'))$('calcParams').textContent='—';
  if($('lastCalculated'))$('lastCalculated').textContent=ui('Último cálculo: —','Last calculation: —');
  if($('recalculate'))$('recalculate').disabled=true;
  if($('saveMission'))$('saveMission').disabled=true;
  renderTerrainProfile(null); renderMissionTimeline(null); updateMissionHud(null); updateHeaderStatus();
}
function clearMission(){missionPoints=[];currentMission=null;selecting=false;routeLayer.getSource().clear();drawPointMarkers();renderMissionList();resetMetrics();updatePlanningUI();}
function setBusy(b,msg){busy=b;$('calculate').disabled=b||missionPoints.length<2;$('recalculate').disabled=b||!currentMission;$('saveMission').disabled=b||!currentMission;if(msg)$('statusText').textContent=msg;else $('statusText').textContent='DATOS CARTOGRÁFICOS · NASA / USGS';}

function getHistory(){ try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch{return[];} }
function setHistory(items){localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,12))); updateSettingsSummary();}

function pdfPointPayload(p){
  if(!p) return null;
  return {
    lat:Number(p.lat),
    lon:Number(p.lon),
    name:p.name,
    type:p.type,
    required:Boolean(p.required),
    dwellMin:Number(p.dwellMin)||0,
    scienceValue:clamp(Number(p.scienceValue ?? (p.type==='base'?0:50)),0,100),
    scienceCategory:p.scienceCategory||'',
    scienceNotes:p.scienceNotes||'',
    elevationM:Number.isFinite(Number(p.elevationM))?Number(p.elevationM):null
  };
}

function pdfLegPayload(leg){
  if(!leg) return null;
  return {
    from:pdfPointPayload(leg.from),
    to:pdfPointPayload(leg.to),
    durationHours:Number(leg.durationHours),
    gridSpacingKm:Number.isFinite(Number(leg.gridSpacingKm))?Number(leg.gridSpacingKm):null,
    metrics:{...(leg.metrics||{})},
    path:(leg.path||[]).map((p,index)=>({
      index:index+1,
      lat:Number(p.lat),
      lon:Number(p.lon),
      elevationM:Number.isFinite(Number(p.elevationM))?Number(p.elevationM):null,
      signedSlopeDeg:Number.isFinite(Number(p.signedSlopeDeg))?Number(p.signedSlopeDeg):null,
      dataConfidence:Number.isFinite(Number(p.dataConfidence))?Number(p.dataConfidence):null,
      baseTransitability:Number.isFinite(Number(p.baseTransitability))?Number(p.baseTransitability):null,
      localRoughnessDeg:Number.isFinite(Number(p.localRoughnessDeg))?Number(p.localRoughnessDeg):null,
      transitability:Number.isFinite(Number(p.transitability))?Number(p.transitability):null,
      edgeConfidence:Number.isFinite(Number(p.edgeConfidence))?Number(p.edgeConfidence):null
    }))
  };
}

function pdfStrategyPayload(m){
  if(!m) return null;
  return {
    mode:m.mode,
    strategyDescription:m.strategyDescription||'',
    duration:Number(m.duration),
    score:Number.isFinite(Number(m.score))?Number(m.score):null,
    overBudget:Boolean(m.overBudget),
    availableHours:Number(m.availableHours),
    dwellMinutes:Number(m.dwellMinutes)||0,
    scienceValueTotal:Number(m.scienceValueTotal)||0,
    scienceValuePotential:Number(m.scienceValuePotential)||0,
    scienceEfficiency:Number(m.scienceEfficiency)||0,
    params:{...(m.params||{})},
    metrics:{...(m.metrics||{})},
    sequence:(m.sequence||[]).map(pdfPointPayload).filter(Boolean),
    includedPoints:(m.includedPoints||m.sequence||[]).map(pdfPointPayload).filter(Boolean),
    omittedOptional:(m.omittedOptional||[]).map(pdfPointPayload).filter(Boolean),
    scienceDecisions:(m.scienceDecisions||[]).map(x=>({...x})),
    requiredBaseline:m.requiredBaseline?{
      duration:Number(m.requiredBaseline.duration),
      dwellMinutes:Number(m.requiredBaseline.dwellMinutes)||0,
      score:Number.isFinite(Number(m.requiredBaseline.score))?Number(m.requiredBaseline.score):null,
      scienceValueTotal:Number(m.requiredBaseline.scienceValueTotal)||0,
      metrics:{...(m.requiredBaseline.metrics||{})},
      sequence:(m.requiredBaseline.sequence||[]).map(pdfPointPayload).filter(Boolean)
    }:null,
    legs:(m.legs||[]).map(pdfLegPayload).filter(Boolean)
  };
}

async function exportMissionPdf(mode){
  const selected=currentMission?.[mode];
  if(!selected) return false;
  const now=new Date();
  const points=missionPoints.map(pdfPointPayload).filter(Boolean);
  const params=normalizeParams();
  const report={
    fileName:`jezero-mision-${now.toISOString().slice(0,19).replace(/[T:]/g,'-')}`,
    reportId:`JEZERO-${now.toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}`,
    generatedAt:now.toISOString(),
    selectedMode:mode,
    returnBase:$('returnBase').checked,
    params,
    mission:{
      name:getMissionSettings().missionName || ui(`Misión EVA · ${points.length} punto(s)`,`EVA Mission · ${points.length} point(s)`),
      code:getMissionSettings().missionCode || '',
      crew:getMissionSettings().crew || '',
      notes:getMissionSettings().notes || '',
      totalPoints:points.length,
      requiredPoints:points.filter((p,i)=>i===0||p.required).length,
      optionalPoints:points.filter((p,i)=>i>0&&!p.required).length,
      base:points.find(p=>p.type==='base')||points[0]||null,
      selectedStrategy:mode,
      calculationTimestamp:lastCalculatedAt?.toISOString?.()||null
    },
    dataSources:{
      elevation:'MDEM200M mediante ArcGIS ElevationLayer',
      cartography:'NASA / USGS / ESA / HRSC',
      map:'NASA Mars Trek / capas configuradas en JEZERO',
      marsRadiusKm:MARTIAN_RADIUS
    },
    software:{
      name:'JEZERO',
      version:'V32',
      interfaceTheme:themeInfo().label,
      themeKey:themeInfo().key,
      reportLanguage:uiLang()
    },
    points,
    selected:pdfStrategyPayload(selected),
    strategies:['distance','balanced','risk'].map(k=>pdfStrategyPayload(currentMission[k])).filter(Boolean)
  };
  const res=await fetch('/api/mission-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
  if(!res.ok) throw new Error(ui(`No se pudo generar el PDF (${res.status}).`,`PDF generation failed (${res.status}).`));
  const blob=await res.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=report.fileName+'.pdf'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  return true;
}

function saveHistoryEntry(mode){
  const items=getHistory(),now=new Date(),selected=currentMission?.[mode];
  const fingerprint=JSON.stringify({mode,returnBase:$('returnBase').checked,speed:Number($('speed').value),eva:Number($('evaTime').value),margin:Number($('returnMargin').value),maxSlope:Number($('maxSlopeLimit')?.value),minTransit:Number($('minTransitability')?.value),minConfidence:Number($('minConfidence')?.value),points:missionPoints.map(p=>[p.lat,p.lon,p.name,p.required,p.dwellMin,p.scienceValue,p.scienceCategory,p.scienceNotes])});
  const existing=items.find(x=>x.fingerprint===fingerprint);
  const meta=getMissionSettings(); const entry={id:existing?.id||`m-${Date.now()}`,date:now.toISOString(),name:meta.missionName||ui(`Misión ${now.toLocaleDateString('es-NI')} · ${missionPoints.length} puntos`,`Mission ${now.toLocaleDateString('en-US')} · ${missionPoints.length} points`),missionMeta:meta,mode,points:missionPoints.map(p=>({...p})),returnBase:$('returnBase').checked,speed:Number($('speed').value),evaTime:Number($('evaTime').value),returnMargin:Number($('returnMargin').value),maxSlopeLimit:Number($('maxSlopeLimit')?.value)||25,minTransitability:Number($('minTransitability')?.value)||25,minConfidence:Number($('minConfidence')?.value)||20,metrics:selected?.metrics||null,duration:selected?.duration||null,score:selected?.score??null,includedPoints:selected?.includedPoints||[],omittedOptional:selected?.omittedOptional||[],fingerprint};
  const filtered=items.filter(x=>x.id!==entry.id); filtered.unshift(entry); setHistory(filtered);renderHistory();
}
function renderHistory(){
  const box=$('historyList'); if(!box)return; const items=getHistory();
  if(!items.length){box.innerHTML=`<div class="historyEmpty">${ui('Aún no hay misiones guardadas.','No saved missions yet.')}</div>`;return;}
  const locale=uiLang()==='en'?'en-US':'es-NI';
  box.innerHTML=items.map(item=>`<div class="historyItem"><div><strong>${escapeHtml(item.name)}</strong><small>${new Date(item.date).toLocaleString(locale,{dateStyle:'short',timeStyle:'short'})} · ${item.points.length} ${ui('puntos','points')} · ${item.mode==='risk'?ui('Menor exposición','Lower exposure'):item.mode==='distance'?ui('Más directa','Most direct'):ui('Equilibrada','Balanced')}</small></div><div class="historyActions"><button data-load="${item.id}" title="${ui('Cargar','Load')}">${ui('Abrir','Open')}</button><button data-delete="${item.id}" title="${ui('Eliminar','Delete')}">×</button></div></div>`).join('');
  box.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>loadHistory(b.dataset.load)); box.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteHistory(b.dataset.delete));
}
function loadHistory(id){
  const item=getHistory().find(x=>x.id===id); if(!item)return;
  missionPoints=item.points.map(p=>({...p})); $('returnBase').checked=item.returnBase!==false; $('speed').value=item.speed ?? 1.2; $('evaTime').value=item.evaTime ?? 8; $('returnMargin').value=item.returnMargin ?? 25; if($('maxSlopeLimit'))$('maxSlopeLimit').value=item.maxSlopeLimit ?? 25; if($('minTransitability'))$('minTransitability').value=item.minTransitability ?? 25; if($('minConfidence'))$('minConfidence').value=item.minConfidence ?? 20;
  if(item.missionMeta) setMissionSettings(item.missionMeta);
  const radio=document.querySelector(`input[name="mode"][value="${item.mode}"]`);if(radio)radio.checked=true;
  currentMission=null;selecting=false;drawPointMarkers();renderMissionList();updatePlanningUI();centerGlobal();showToast('Misión cargada con sus parámetros originales. Pulsa “Calcular misión” o “Recalcular” para obtener el nuevo resultado.');
}
function deleteHistory(id){setHistory(getHistory().filter(x=>x.id!==id));renderHistory();}



function getMissionSettings(){
  try{
    const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
    return {
      missionName:String(saved.missionName||'').trim(),
      missionCode:String(saved.missionCode||'').trim(),
      crew:String(saved.crew||'').trim(),
      notes:String(saved.notes||'').trim()
    };
  }catch{return {missionName:'',missionCode:'',crew:'',notes:''};}
}
function setMissionSettings(values={}){
  const current=getMissionSettings();
  const next={...current,...values};
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));
  if($('missionNameSetting')) $('missionNameSetting').value=next.missionName||'';
  if($('missionCodeSetting')) $('missionCodeSetting').value=next.missionCode||'';
  if($('crewSetting')) $('crewSetting').value=next.crew||'';
  if($('missionNotesSetting')) $('missionNotesSetting').value=next.notes||'';
  updateSettingsSummary();
}
function readOperationalDefaults(){
  return {
    speed:Number($('speed')?.value)||1.2,
    evaTime:Number($('evaTime')?.value)||8,
    returnMargin:Number($('returnMargin')?.value)||25,
    maxSlopeLimit:Number($('maxSlopeLimit')?.value)||25,
    minTransitability:Number($('minTransitability')?.value)||25,
    minConfidence:Number($('minConfidence')?.value)||20
  };
}
function getSavedDefaults(){ try{return JSON.parse(localStorage.getItem(DEFAULTS_KEY)||'null');}catch{return null;} }
function applyDefaults(values,{notify=true}={}){
  if(!values) return false;
  const mapIds={speed:'speed',evaTime:'evaTime',returnMargin:'returnMargin',maxSlopeLimit:'maxSlopeLimit',minTransitability:'minTransitability',minConfidence:'minConfidence'};
  Object.entries(mapIds).forEach(([k,id])=>{ if($(id) && Number.isFinite(Number(values[k]))) $(id).value=Number(values[k]); });
  currentMission=null; routeLayer?.getSource()?.clear(); resetMetrics(); updatePlanningUI();
  if(notify) showToast(ui('Parámetros predeterminados aplicados al Planificador.','Default parameters applied to Mission Planner.'));
  return true;
}
function updateSettingsSummary(){
  const meta=getMissionSettings(), defs=getSavedDefaults(), hist=getHistory();
  if($('settingsMissionSummary')) $('settingsMissionSummary').textContent=meta.missionName || meta.missionCode || ui('Sin nombre definido','No name defined');
  if($('settingsDefaultsSummary')) $('settingsDefaultsSummary').textContent=defs ? `${defs.speed} km/h · EVA ${defs.evaTime} h · ${ui('margen','margin')} ${defs.returnMargin}%` : ui('Valores de fábrica','Factory values');
  if($('settingsHistorySummary')) $('settingsHistorySummary').textContent=`${hist.length} ${hist.length===1?ui('misión','mission'):ui('misiones','missions')}`;
  if($('settingsLanguageSummary')) $('settingsLanguageSummary').textContent=uiLang()==='en'?'English':'Español';
  if($('settingsThemeSummary')) $('settingsThemeSummary').textContent=themeInfo().label;
  updateHeaderStatus();
  if($('defaultsStatus')) $('defaultsStatus').textContent=defs ? `${ui('Guardados','Saved')}: ${defs.speed} km/h · EVA ${defs.evaTime} h · ${ui('pendiente','slope')} ≤ ${defs.maxSlopeLimit}° · ${ui('transitabilidad','traversability')} ≥ ${defs.minTransitability} · ${ui('confianza','confidence')} ≥ ${defs.minConfidence}%` : ui('Usando valores de fábrica hasta que guardes un perfil.','Using factory values until you save a profile.');
}
function initializeSettings(){
  const meta=getMissionSettings();
  if($('missionNameSetting')) $('missionNameSetting').value=meta.missionName;
  if($('missionCodeSetting')) $('missionCodeSetting').value=meta.missionCode;
  if($('crewSetting')) $('crewSetting').value=meta.crew;
  if($('missionNotesSetting')) $('missionNotesSetting').value=meta.notes;
  if($('languageSetting')){
    $('languageSetting').value=uiLang();
    $('languageSetting').addEventListener('change',()=>window.JEZERO_I18N?.setLanguage?.($('languageSetting').value));
  }
  window.addEventListener('jezero:languagechange',ev=>{
    if($('languageSetting')) $('languageSetting').value=ev.detail?.language||uiLang();
    updateSettingsSummary();
    renderHistory();
    renderScienceEditor();
  });
  const defs=getSavedDefaults(); if(defs) applyDefaults(defs,{notify:false});
  ['missionNameSetting','missionCodeSetting','crewSetting','missionNotesSetting'].forEach(id=>$(id)?.addEventListener('input',()=>{
    setMissionSettings({missionName:$('missionNameSetting')?.value||'',missionCode:$('missionCodeSetting')?.value||'',crew:$('crewSetting')?.value||'',notes:$('missionNotesSetting')?.value||''});
  }));
  $('saveDefaultsBtn')?.addEventListener('click',()=>{
    const defs=readOperationalDefaults(); localStorage.setItem(DEFAULTS_KEY,JSON.stringify(defs)); updateSettingsSummary(); showToast(ui('Parámetros actuales guardados como predeterminados.','Current parameters saved as defaults.'));
  });
  $('restoreDefaultsBtn')?.addEventListener('click',()=>{
    const defs=getSavedDefaults(); if(!defs) return showToast(ui('Aún no has guardado parámetros predeterminados.','You have not saved default parameters yet.')); applyDefaults(defs);
  });
  $('exportMissionJson')?.addEventListener('click',exportMissionJson);
  $('importMissionJson')?.addEventListener('click',()=>$('importMissionFile')?.click());
  $('importMissionFile')?.addEventListener('change',importMissionJsonFile);
  $('clearHistoryBtn')?.addEventListener('click',()=>{
    if(!getHistory().length) return showToast(ui('El historial ya está vacío.','History is already empty.'));
    if(!window.confirm('¿Borrar todo el historial local de misiones?')) return;
    setHistory([]); renderHistory(); updateSettingsSummary(); showToast(ui('Historial local borrado.','Local history cleared.'));
  });
  updateSettingsSummary();
}
function exportMissionJson(){
  const mode=document.querySelector('input[name="mode"]:checked')?.value||'balanced';
  const payload={format:'JEZERO-MISSION',version:32,exportedAt:new Date().toISOString(),missionMeta:getMissionSettings(),interface:{language:uiLang(),theme:themeInfo().key},points:missionPoints,returnBase:$('returnBase')?.checked!==false,mode,params:readOperationalDefaults()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
  const code=(payload.missionMeta.missionCode||'mision').replace(/[^a-z0-9_-]+/gi,'-'); a.href=url; a.download=`jezero-${code}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1200);
  showToast(ui('Misión exportada a JSON.','Mission exported to JSON.'));
}
async function importMissionJsonFile(ev){
  const file=ev.target.files?.[0]; if(!file) return;
  try{
    const data=JSON.parse(await file.text());
    if(data.format!=='JEZERO-MISSION'||!Array.isArray(data.points)) throw new Error(ui('El archivo no es una misión JEZERO válida.','The file is not a valid JEZERO mission.'));
    missionPoints=data.points.map((p,i)=>({
      lat:Number(p.lat),lon:Number(p.lon),name:String(p.name||`Punto ${i}`),type:p.type==='base'?'base':'science',required:i===0||p.type==='base'?true:Boolean(p.required),dwellMin:Math.max(0,Number(p.dwellMin)||0),scienceValue:clamp(Number(p.scienceValue??50),0,100),scienceCategory:String(p.scienceCategory||'geologia'),scienceNotes:String(p.scienceNotes||'')
    })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    if(data.missionMeta) setMissionSettings(data.missionMeta);
    if(data.interface?.theme) window.JEZERO_THEMES?.setTheme?.(data.interface.theme);
    if(data.interface?.language) window.JEZERO_I18N?.setLanguage?.(data.interface.language);
    if(data.params) applyDefaults(data.params,{notify:false});
    if($('returnBase')) $('returnBase').checked=data.returnBase!==false;
    const radio=document.querySelector(`input[name="mode"][value="${data.mode}"]`); if(radio) radio.checked=true;
    currentMission=null; selecting=false; routeLayer?.getSource()?.clear(); drawPointMarkers(); renderMissionList(); resetMetrics(); updatePlanningUI(); centerGlobal();
    showToast(ui(`Misión importada: ${missionPoints.length} punto(s). Recalcula para actualizar resultados.`,`Mission imported: ${missionPoints.length} point(s). Recalculate to update results.`));
  }catch(err){showToast(err.message||ui('No se pudo importar la misión.','The mission could not be imported.'));}
  finally{ev.target.value='';}
}

function scienceTargets(){return missionPoints.map((p,i)=>({p,i})).filter(x=>x.i>0&&x.p.type!=='base');}
function updateScienceSummary(mission=null){
  const targets=scienceTargets(); const potential=targets.reduce((sum,{p})=>sum+clamp(Number(p.scienceValue??50),0,100),0);
  const included=Number.isFinite(Number(mission?.scienceValueTotal))?Number(mission.scienceValueTotal):null;
  const efficiency=potential>0&&included!==null?clamp(included/potential*100,0,100):null;
  [['scienceTargetCount',targets.length],['scienceTargetCountDetail',targets.length],['scienceValuePotential',`${Math.round(potential)} pts`],['scienceValuePotentialDetail',`${Math.round(potential)} pts`],['scienceEfficiency',efficiency===null?'—':`${Math.round(efficiency)}%`],['scienceEfficiencyDetail',efficiency===null?'—':`${Math.round(efficiency)}%`]].forEach(([id,val])=>{if($(id))$(id).textContent=String(val);});
}
function invalidateScienceChange(){
  currentMission=null; routeLayer?.getSource()?.clear(); resetMetrics(); updatePlanningUI();
  $('statusText').textContent='CAMBIOS CIENTÍFICOS PENDIENTES · recalcula la misión';
}
function renderScienceEditor(){
  const box=$('scienceObjectivesList'), empty=$('scienceEmpty'), recalc=$('scienceRecalculate'); if(!box) return;
  const targets=scienceTargets(); box.innerHTML=''; if(empty) empty.classList.toggle('hide',targets.length>0); if(recalc) recalc.disabled=busy||missionPoints.length<2;
  targets.forEach(({p,i})=>{
    const el=document.createElement('article'); el.className='scienceObjectiveCard';
    const category=p.scienceCategory||'geologia';
    const active=selectedMission();
    const decision=active?.scienceDecisions?.find(d=>d.pointIndex===i);
    const cost=decision?.included
      ? `${ui('INCLUIDO','INCLUDED')} · +${Number(decision.deltaDistanceKm||0).toFixed(2)} km · +${Math.round(Number(decision.deltaDurationHours||0)*60)} min`
      : decision ? ui('OMITIDO POR RESTRICCIONES / UTILIDAD','OMITTED BY CONSTRAINTS / UTILITY') : ui('PENDIENTE DE CÁLCULO','PENDING CALCULATION');
    el.innerHTML=`<div class="scienceObjectiveHead"><div><small>OBJETIVO P${i}</small><b>${escapeHtml(p.name)}</b><span>${formatLat(p.lat)} · ${formatLon(p.lon)}</span></div><label class="scienceRequired"><input type="checkbox" data-science-required="${i}" ${p.required?'checked':''}> Obligatorio</label></div><div class="scienceMissionCost ${decision?.included?'included':decision?'omitted':''}">${cost}</div><div class="scienceObjectiveGrid"><label>Valor científico<input type="number" min="0" max="100" step="1" data-science-value="${i}" value="${clamp(Number(p.scienceValue??50),0,100)}"></label><label>Tiempo de trabajo<input type="number" min="0" max="1440" step="1" data-science-dwell="${i}" value="${Math.max(0,Number(p.dwellMin)||0)}"></label></div><label class="scienceCategoryField">Categoría<select data-science-category="${i}"><option value="geologia" ${category==='geologia'?'selected':''}>Geología</option><option value="muestra" ${category==='muestra'?'selected':''}>Muestreo</option><option value="imagen" ${category==='imagen'?'selected':''}>Imagen / documentación</option><option value="instrumento" ${category==='instrumento'?'selected':''}>Instrumento</option><option value="otro" ${category==='otro'?'selected':''}>Otro</option></select></label><label class="scienceNotesField">Notas<input data-science-notes="${i}" maxlength="180" value="${escapeHtml(p.scienceNotes||'')}" placeholder="Qué se busca observar o registrar"></label>`;
    box.appendChild(el);
  });
  box.querySelectorAll('[data-science-value]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.scienceValue);missionPoints[i].scienceValue=clamp(Number(input.value)||0,0,100);invalidateScienceChange();});
  box.querySelectorAll('[data-science-dwell]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.scienceDwell);missionPoints[i].dwellMin=Math.max(0,Math.min(1440,Number(input.value)||0));invalidateScienceChange();});
  box.querySelectorAll('[data-science-required]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.scienceRequired);missionPoints[i].required=input.checked;invalidateScienceChange();});
  box.querySelectorAll('[data-science-category]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.scienceCategory);missionPoints[i].scienceCategory=input.value;updateScienceSummary(currentMission?.[document.querySelector('input[name="mode"]:checked')?.value||'balanced']||null);});
  box.querySelectorAll('[data-science-notes]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.scienceNotes);missionPoints[i].scienceNotes=input.value.trim();});
  updateScienceSummary(currentMission?.[document.querySelector('input[name="mode"]:checked')?.value||'balanced']||null);
}


function resetCoordinateForm(){
  if($('coordinateForm')) $('coordinateForm').reset();
  if($('coordTypeInput')) $('coordTypeInput').value='science';
  if($('coordRequiredInput')) $('coordRequiredInput').value='optional';
  if($('coordDwellInput')) $('coordDwellInput').value='15';
  if($('coordScienceValueInput')) $('coordScienceValueInput').value='70';
  if($('coordinateError')){ $('coordinateError').textContent=''; $('coordinateError').classList.add('hide'); }
}
function parseCoordinateValue(value){
  const n=Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
function addPointFromCoordinates(){
  const lat=parseCoordinateValue($('coordLatInput')?.value);
  const lon=parseCoordinateValue($('coordLonInput')?.value);
  const nameInput=String($('coordNameInput')?.value||'').trim();
  const type=$('coordTypeInput')?.value==='base'?'base':'science';
  const required=$('coordRequiredInput')?.value==='required';
  const dwellRaw=Number($('coordDwellInput')?.value);
  const dwellMin=Number.isFinite(dwellRaw)?Math.max(0,Math.min(1440,Math.round(dwellRaw))):15;
  const scienceRaw=Number($('coordScienceValueInput')?.value);
  const scienceValue=Number.isFinite(scienceRaw)?clamp(Math.round(scienceRaw),0,100):70;
  const err=$('coordinateError');
  const fail=msg=>{ if(err){err.textContent=msg;err.classList.remove('hide');} showToast(msg); };

  if(!Number.isFinite(lat)||lat < -90 || lat > 90) return fail('La latitud debe estar entre −90° y 90°.');
  if(!Number.isFinite(lon)||lon < -180 || lon > 180) return fail('La longitud debe estar entre −180° y 180°.');

  const point={
    lat, lon,
    name:nameInput || (type==='base'?'Base de misión':`Objetivo ${Math.max(1,missionPoints.length)}`),
    type,
    required:type==='base' ? true : required,
    dwellMin:type==='base' ? 0 : dwellMin,
    scienceValue:type==='base' ? 0 : scienceValue
  };

  if(type==='base'){
    const others=missionPoints.filter(p=>p.type!=='base');
    missionPoints=[point,...others];
    selecting=true;
    $('statusText').textContent='BASE DE COORDENADAS FIJADA · agrega los siguientes puntos';
    map.getView().animate({center:[lon,lat],zoom:Math.max(map.getView().getZoom(),3),duration:450});
    showToast(`${point.name} quedó establecida como BASE (P0).`);
  }else{
    missionPoints.push(point);
    selecting=true;
    $('statusText').textContent=`PUNTO AÑADIDO · ${point.name}`;
    map.getView().animate({center:[lon,lat],duration:350});
    showToast(`${point.name} se añadió a la misión.`);
  }

  currentMission=null;
  routeLayer.getSource().clear();
  drawPointMarkers();
  renderMissionList();
  resetMetrics();
  updatePlanningUI();
  resetCoordinateForm();
}

$('coordinateForm')?.addEventListener('submit',e=>{ e.preventDefault(); addPointFromCoordinates(); });
$('coordTypeInput')?.addEventListener('change',e=>{
  const base=e.target.value==='base';
  if($('coordRequiredInput')) $('coordRequiredInput').value=base?'required':'optional';
  if($('coordDwellInput')) $('coordDwellInput').value=base?'0':'15';
  if($('coordScienceValueInput')) $('coordScienceValueInput').value=base?'0':'70';
});

$('mapInfoClose')?.addEventListener('click',closeReferencePopup);
$('mapInfoUseBase')?.addEventListener('click',()=>{
  const f=(document.querySelector(`[data-ref-layer]`) ? null : null);
  const kind=$('mapInfo')?.dataset.refKind, id=$('mapInfo')?.dataset.refId;
  const layer=kind==='landing'?landingLayer:knownLayer; const feature=layer?.getSource().getFeatures().find(x=>x.get('refId')===id);
  if(feature && kind==='landing') setBaseFromLanding(feature);
});
$('mapInfoAdd')?.addEventListener('click',()=>{
  const kind=$('mapInfo')?.dataset.refKind, id=$('mapInfo')?.dataset.refId;
  const layer=kind==='landing'?landingLayer:knownLayer; const feature=layer?.getSource().getFeatures().find(x=>x.get('refId')===id);
  if(feature) addReferenceToMission(feature);
});
$('landingSiteSelect')?.addEventListener('change',e=>{if(e.target.value)focusReference('landing',e.target.value);});
$('useSelectedLanding')?.addEventListener('click',()=>{
  const id=$('landingSiteSelect')?.value;
  if(!id){showToast(ui('Selecciona primero un sitio de aterrizaje.','Select a landing site first.'));return;}
  const f=landingLayer.getSource().getFeatures().find(x=>x.get('refId')===id); if(f) setBaseFromLanding(f);
});
$('planMode').onclick=newMission;
$('calculate').onclick=()=>calculateMission();
$('clearRoute').onclick=clearMission;
$('recalculate').onclick=()=>calculateMission({saveHistory:true});
$('scienceRecalculate')?.addEventListener('click',()=>calculateMission({saveHistory:false}));
$('saveMission').onclick=async()=>{
  if(!currentMission||busy)return;
  const mode=document.querySelector('input[name="mode"]:checked').value;
  try{
    saveHistoryEntry(mode);
    setBusy(true,'Guardando misión y generando informe PDF…');
    await exportMissionPdf(mode);
    setBusy(false,'MISIÓN GUARDADA · INFORME PDF DESCARGADO · NASA / USGS');
    showToast(ui('Misión guardada en el historial y PDF generado.','Mission saved to history and PDF generated.'));
  }catch(err){
    setBusy(false,'DATOS CARTOGRÁFICOS · NASA / USGS');
    showToast(err.message||ui('No se pudo generar el PDF.','The PDF could not be generated.'));
  }
};
$('addBase').onclick=()=>{if(!missionPoints.length){showToast(ui('Crea al menos un punto para fijarlo como base.','Create at least one point before setting a base.'));return;}missionPoints[0]={...missionPoints[0],name:'Base de misión',type:'base',required:true,dwellMin:0,scienceValue:0};currentMission=null;drawPointMarkers();renderMissionList();updatePlanningUI();};
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
  if(layer==='known'){
    knownLayer.setVisible(visible);
    setLayerStatus('known',visible?'ACTIVA':'OCULTA',visible?'live':'ready');
  }
  if(layer==='landing'){
    landingLayer.setVisible(visible);
    setLayerStatus('landing',visible?'ACTIVA':'OCULTA',visible?'live':'ready');
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
['speed','evaTime','returnMargin','maxSlopeLimit','minTransitability','minConfidence'].forEach(id=>$(id).addEventListener('input',()=>{if(currentMission){$('recalculate').disabled=false;$('statusText').textContent='CAMBIOS PENDIENTES · pulsa recalcular';}}));
function showToast(msg){$('toast').textContent=msg;$('toast').classList.remove('hide');clearTimeout(showToast.t);showToast.t=setTimeout(()=>$('toast').classList.add('hide'),5000);}

const toggleMapLegend=$('toggleMapLegend');
const mapLegend=$('mapLegend');
toggleMapLegend?.addEventListener('click',()=>{
  const collapsed=mapLegend?.classList.toggle('is-collapsed');
  if(toggleMapLegend){ toggleMapLegend.textContent=collapsed?'＋':'−'; toggleMapLegend.setAttribute('aria-expanded',String(!collapsed)); }
});


window.addEventListener('jezero:modulechange',()=>{
  requestAnimationFrame(()=>{ map?.updateSize(); updateMapScale(); });
});

(async()=>{try{D=await fetch(DATA_URL).then(r=>r.json());await prepareLayerSources();initMap();initializeSettings();setLayerStatus('mola','ACTIVA','live');setLayerStatus('route','ACTIVA','live');setLayerStatus('points','ACTIVA','live');renderMissionList();renderHistory();updatePlanningUI();populateReferenceLayers();setLayerStatus('known','ACTIVA','live');setLayerStatus('landing','ACTIVA','live');$('statusText').textContent='DATOS CARTOGRÁFICOS · NASA / USGS';}catch(e){showToast(ui('No se pudo cargar la configuración.','Configuration could not be loaded.'));console.error(e);}})();
