const DATA_URL = 'data/mars-data.json';
const EARTH = 6371; // km
const MARTIAN_RADIUS = 3389.5; // km
const LANDING = { lat: 18.44463, lon: 77.45088, name: 'Lugar de aterrizaje de Perseverance' };

let D;
let map, markerLayer, routeLayer, molaLayer, roughnessLayer, dustLayer;
let origin = null, destination = null, currentRoute = null, selecting = false;

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function marsProjection(){
  return new ol.proj.Projection({ code:'MARS:EQUIRECTANGULAR', units:'degrees', extent:[-180,-90,180,90] });
}

function buildLayers(){
  const projection = ol.proj.get('MARS:EQUIRECTANGULAR');
  const resolutions = Array.from({length:8},(_,z)=>0.703125 / Math.pow(2,z));
  const tileGrid = new ol.tilegrid.TileGrid({ extent:[-180,-90,180,90], origin:[-180,90], resolutions, tileSize:256 });
  const nasa = id => new ol.source.XYZ({
    projection, tileGrid,
    crossOrigin:'anonymous',
    maxZoom:7,
    tileUrlFunction: tileCoord => {
      if(!tileCoord) return '';
      const z=tileCoord[0], x=tileCoord[1], y=tileCoord[2];
      if(x<0 || y<0) return '';
      return D.map[id].replace('{z}',z).replace('{x}',x).replace('{y}',y);
    }
  });
  molaLayer = new ol.layer.Tile({ source:nasa('globalTile'), opacity:1 });
  roughnessLayer = new ol.layer.Tile({ source:nasa('roughnessTile'), opacity:.34, visible:false });
  dustLayer = new ol.layer.Tile({ source:nasa('dustTile'), opacity:.25, visible:false });

  markerLayer = new ol.layer.Vector({ source:new ol.source.Vector(), style: feature => pointStyle(feature.get('kind')) });
  routeLayer = new ol.layer.Vector({ source:new ol.source.Vector() });
  routeLayer.setStyle(feature => routeStyle(feature.get('selected'),feature.get('kind')));

  return { projection, layers:[molaLayer,roughnessLayer,dustLayer,routeLayer,markerLayer] };
}

function pointStyle(kind){
  const color = kind==='origin' ? '#7bc29a' : kind==='destination' ? '#f0a260' : '#e9e5de';
  return new ol.style.Style({
    image:new ol.style.Circle({ radius:7, fill:new ol.style.Fill({color}), stroke:new ol.style.Stroke({color:'#ffffff',width:2}) }),
    text:new ol.style.Text({ text:kind==='origin'?'A':kind==='destination'?'B':'NASA', offsetY:-16, fill:new ol.style.Fill({color:'#fff'}), stroke:new ol.style.Stroke({color:'#0b0f13',width:3}), font:'bold 9px sans-serif' })
  });
}
function routeStyle(selected,kind){
  const color = selected ? '#f0a260' : kind==='risk' ? '#7bc29a' : '#b5a49a';
  return new ol.style.Style({ stroke:new ol.style.Stroke({color, width:selected?5:2, lineDash:selected?undefined:[6,8]}) });
}

function initMap(){
  const projection = marsProjection();
  ol.proj.addProjection(projection);
  const layers = buildLayers().layers;
  map = new ol.Map({ target:'map', layers, view:new ol.View({ projection, center:[LANDING.lon, LANDING.lat], zoom:4, resolutions:Array.from({length:8},(_,z)=>0.703125/Math.pow(2,z)) }), controls:[] });
  map.getView().fit([77.25,18.27,77.62,18.62],{size:map.getSize(),duration:0,padding:[70,20,35,20],maxZoom:5});
  map.on('pointermove', evt=>{ const c=evt.coordinate; if(c) $('coordReadout').textContent=`LAT ${c[1].toFixed(5)}° · LON ${c[0].toFixed(5)}°`; });
  map.on('singleclick', onMapClick);
  $('zoomIn').onclick=()=>map.getView().setZoom(Math.min(7,map.getView().getZoom()+.7));
  $('zoomOut').onclick=()=>map.getView().setZoom(Math.max(1,map.getView().getZoom()-.7));
  $('center').onclick=()=>centerLanding();
  centerLanding();
  addReferenceMarker();
}

function centerLanding(){ map.getView().animate({center:[LANDING.lon,LANDING.lat],zoom:5,duration:350}); }
function addReferenceMarker(){
  markerLayer.getSource().clear();
  markerLayer.getSource().addFeature(new ol.Feature({geometry:new ol.geom.Point([LANDING.lon,LANDING.lat]),kind:'origin'}));
}

function onMapClick(evt){
  if(!selecting) return;
  const [lon,lat]=evt.coordinate;
  const point={lat,lon};
  if(!origin){ origin={...point,name:'Origen A'}; selecting=true; $('selectionHint').textContent='Origen A fijado. Selecciona ahora el destino B.'; }
  else if(!destination){ destination={...point,name:'Destino B'}; selecting=false; $('selectionHint').textContent='A y B seleccionados. Pulsa “Calcular rutas”.'; $('calculate').disabled=false; }
  else { destination={...point,name:'Destino B'}; $('selectionHint').textContent='Destino actualizado. Pulsa “Calcular rutas”.'; }
  drawPointMarkers();
}

function drawPointMarkers(){
  markerLayer.getSource().clear();
  if(origin) markerLayer.getSource().addFeature(new ol.Feature({geometry:new ol.geom.Point([origin.lon,origin.lat]),kind:'origin'}));
  if(destination) markerLayer.getSource().addFeature(new ol.Feature({geometry:new ol.geom.Point([destination.lon,destination.lat]),kind:'destination'}));
  if(!origin) addReferenceMarker();
}

function haversine(a,b){
  const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*MARTIAN_RADIUS*Math.asin(Math.sqrt(h));
}

function interpolate(a,b,t){ return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t}; }
function pathDistance(path){ let d=0; for(let i=1;i<path.length;i++) d+=haversine(path[i-1],path[i]); return d; }
function pathMetrics(path){
  let d=0,gain=0,maxSlope=0,sumSlope=0,count=0;
  for(let i=1;i<path.length;i++){
    const dist=haversine(path[i-1],path[i]); const e1=path[i-1].elevationM,e2=path[i].elevationM;
    d+=dist;
    if(Number.isFinite(e1)&&Number.isFinite(e2)&&dist>0){
      const rise=e2-e1; if(rise>0) gain+=rise;
      const slope=Math.atan2(Math.abs(rise)/1000,dist)*180/Math.PI;
      maxSlope=Math.max(maxSlope,slope); sumSlope+=slope; count++;
      path[i].slopeDeg=slope;
    }
  }
  return {distanceKm:d,gainM:gain,maxSlopeDeg:maxSlope,avgSlopeDeg:count?sumSlope/count:null,segments:count};
}

function buildGrid(a,b,rows=13,cols=13){
  const latMin=Math.min(a.lat,b.lat),latMax=Math.max(a.lat,b.lat),lonMin=Math.min(a.lon,b.lon),lonMax=Math.max(a.lon,b.lon);
  const latPad=Math.max(0.018,(latMax-latMin)*.55),lonPad=Math.max(0.018,(lonMax-lonMin)*.55);
  const minLat=latMin-latPad,maxLat=latMax+latPad,minLon=lonMin-lonPad,maxLon=lonMax+lonPad;
  const nodes=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) nodes.push({r,c,lat:minLat+(maxLat-minLat)*(r/(rows-1)),lon:minLon+(maxLon-minLon)*(c/(cols-1))});
  return {nodes,rows,cols};
}

function nearestNode(grid,p){ return grid.nodes.reduce((best,n)=>!best||haversine(n,p)<haversine(best,p)?n:best,null); }
function neighbors(node,grid){
  const out=[]; for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){const r=node.r+dr,c=node.c+dc;if(r>=0&&r<grid.rows&&c>=0&&c<grid.cols) out.push(grid.nodes[r*grid.cols+c]);} return out;
}
function heuristic(n,goal,mode){ const d=haversine(n,goal); return mode==='distance'?d:d*(mode==='risk'?1.55:1.22); }
function edgeCost(a,b,mode){
  const d=haversine(a,b); if(!Number.isFinite(a.elevationM)||!Number.isFinite(b.elevationM)) return d*5;
  const slope=Math.atan2(Math.abs(a.elevationM-b.elevationM)/1000,Math.max(d,.001))*180/Math.PI;
  if(mode==='distance') return d*(1+Math.min(slope,30)*.012);
  if(mode==='risk') return d*(1+Math.pow(slope/8,2));
  return d*(1+Math.pow(slope/10,1.45)*.55);
}
function aStar(grid,start,goal,mode){
  const open=[start], came=new Map(), g=new Map([[key(start),0]]), f=new Map([[key(start),heuristic(start,goal,mode)]]);
  while(open.length){ open.sort((a,b)=>(f.get(key(a))??Infinity)-(f.get(key(b))??Infinity)); const cur=open.shift(); if(key(cur)===key(goal)){const path=[];let n=cur;while(n){path.push(n);n=came.get(key(n));}return path.reverse();}
    for(const nb of neighbors(cur,grid)){const tentative=(g.get(key(cur))??Infinity)+edgeCost(cur,nb,mode);if(tentative<(g.get(key(nb))??Infinity)){came.set(key(nb),cur);g.set(key(nb),tentative);f.set(key(nb),tentative+heuristic(nb,goal,mode));if(!open.some(n=>key(n)===key(nb)))open.push(nb);}}
  }
  return null;
}
const key=n=>`${n.r}:${n.c}`;
function forceEndpoints(path,a,b){
  if(!path||path.length<2)return path; return [{...a,elevationM:a.elevationM},...path.slice(1,-1),{...b,elevationM:b.elevationM}];
}

async function getElevations(points){
  const response=await fetch('/api/elevations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points})});
  if(!response.ok) throw new Error(`Servicio MOLA: ${response.status}`);
  const json=await response.json(); return json.points;
}

async function calculateRoutes(){
  if(!origin||!destination) return;
  setBusy(true,'Consultando elevación MOLA…');
  try{
    const grid=buildGrid(origin,destination,13,13);
    const samples=grid.nodes.map(n=>({lat:n.lat,lon:n.lon}));
    samples.push({lat:origin.lat,lon:origin.lon}, {lat:destination.lat,lon:destination.lon});
    const elevated=await getElevations(samples);
    const mapByCoord=new Map(elevated.map(p=>[`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`,p.elevationM]));
    for(const n of grid.nodes) n.elevationM=mapByCoord.get(`${n.lat.toFixed(5)},${n.lon.toFixed(5)}`);
    origin.elevationM=elevated[elevated.length-2]?.elevationM;
    destination.elevationM=elevated[elevated.length-1]?.elevationM;
    if(!grid.nodes.some(n=>Number.isFinite(n.elevationM))) throw new Error('No se recibieron valores de elevación de MOLA.');

    const modes=['distance','balanced','risk'];
    const routes=[];
    for(const mode of modes){ const s=nearestNode(grid,origin),g=nearestNode(grid,destination); let path=aStar(grid,s,g,mode); if(path){path=forceEndpoints(path,origin,destination); routes.push({mode,path,metrics:pathMetrics(path)});} }
    if(!routes.length) throw new Error('No se pudo construir una ruta sobre la malla analizada.');
    currentRoute=chooseDisplayed(routes);
    drawRoutes(routes,currentRoute.mode);
    renderRoute(currentRoute);
    setBusy(false);
  }catch(err){
    setBusy(false); showToast(err.message+' Comprueba la conexión con el servicio de elevación.');
  }
}

function chooseDisplayed(routes){ const mode=document.querySelector('input[name="mode"]:checked').value; return routes.find(r=>r.mode===mode)||routes[1]||routes[0]; }
function drawRoutes(routes,selectedMode){
  const source=routeLayer.getSource();source.clear();
  routes.forEach(r=>{ const coords=r.path.map(p=>[p.lon,p.lat]); const f=new ol.Feature({geometry:new ol.geom.LineString(coords),selected:r.mode===selectedMode,kind:r.mode}); source.addFeature(f); });
}

function riskScore(m){
  const slope=Number.isFinite(m.maxSlopeDeg)?m.maxSlopeDeg:30;
  const gainPenalty=clamp(m.gainM/600,0,1)*25;
  return Math.round(clamp((slope/25)*70+gainPenalty,0,100));
}
function riskLabel(score){ if(score<30)return 'Bajo'; if(score<55)return 'Moderado'; if(score<75)return 'Alto'; return 'Muy alto'; }
function estimateDuration(metrics){
  const speed=Math.max(.1,Number($('speed').value)||1.2);
  const slopeFactor=1+clamp((metrics.avgSlopeDeg||0)/30,.0,.8);
  const terrainHours=metrics.distanceKm/speed*slopeFactor;
  return terrainHours;
}
function formatHours(h){ if(!Number.isFinite(h)) return '—'; const hrs=Math.floor(h), mins=Math.round((h-hrs)*60); return `${hrs} h ${String(mins).padStart(2,'0')} min`; }
function renderRoute(route){
  const m=route.metrics,score=riskScore(m),duration=estimateDuration(m),maxTime=Number($('evaTime').value)||8,margin=Number($('returnMargin').value)||25;
  $('routeName').textContent=route.mode==='distance'?'Ruta más directa':route.mode==='risk'?'Ruta de menor exposición':'Ruta equilibrada';
  $('routeStatus').textContent=`${riskLabel(score).toUpperCase()} · ${score}/100`;
  $('routeDescription').textContent=`A → B calculada sobre una malla local y evaluada con elevaciones muestreadas del modelo MOLA. ${duration<=maxTime*(1-margin/100)?'Cumple el margen operacional configurado.':'Supera el tiempo disponible con el margen configurado.'}`;
  $('distance').textContent=`${m.distanceKm.toFixed(2)} km`;
  $('duration').textContent=formatHours(duration);
  $('maxSlope').textContent=Number.isFinite(m.maxSlopeDeg)?`${m.maxSlopeDeg.toFixed(1)}°`:'—';
  $('gain').textContent=Number.isFinite(m.gainM)?`${Math.round(m.gainM)} m`:'—';
  $('riskNumber').textContent=score;
  $('riskLabel').textContent=riskLabel(score);
  $('riskBar').style.width=`${score}%`;
  $('avgSlope').textContent=Number.isFinite(m.avgSlopeDeg)?`${m.avgSlopeDeg.toFixed(1)}°`:'—';
  $('segments').textContent=m.segments;
  $('recalculate').disabled=false;
}
function setBusy(b,msg){ $('calculate').disabled=b||!origin||!destination; $('recalculate').disabled=b||!currentRoute; if(msg){ $('statusText').textContent=msg; } else $('statusText').textContent='DATOS CARTOGRÁFICOS · NASA / USGS'; }

function resetSelection(){ origin=null;destination=null;currentRoute=null;selecting=false;routeLayer.getSource().clear();drawPointMarkers();$('selectionHint').textContent='Selecciona el origen y el destino sobre el mapa';$('calculate').disabled=true;$('recalculate').disabled=true;['routeName','distance','duration','maxSlope','gain','avgSlope','segments','riskNumber'].forEach(id=>$(id).textContent=id==='routeName'?'Esperando selección':'—');$('routeStatus').textContent='SIN RUTA';$('riskLabel').textContent='Sin evaluación';$('riskBar').style.width='0%';}
function startSelection(){ selecting=true; $('selectionHint').textContent=origin?'Origen A fijado. Selecciona destino B.':'Selecciona el origen A en el mapa.'; }

$('setOrigin').onclick=()=>{ origin={...LANDING,name:'Lugar de aterrizaje'}; destination=null; selecting=true; drawPointMarkers(); $('selectionHint').textContent='Origen A fijado en el aterrizaje de Perseverance. Selecciona destino B.'; $('calculate').disabled=true; centerLanding(); };
$('planMode').onclick=startSelection;
$('calculate').onclick=calculateRoutes;
$('clearRoute').onclick=resetSelection;
$('recalculate').onclick=()=>{ if(currentRoute) renderRoute(currentRoute); };
document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{ const layer=el.dataset.layer; if(layer==='mola')molaLayer.setVisible(el.checked); if(layer==='roughness')roughnessLayer.setVisible(el.checked); if(layer==='dust')dustLayer.setVisible(el.checked); if(layer==='route')routeLayer.setVisible(el.checked); if(layer==='points')markerLayer.setVisible(el.checked); });
$('sourcesBtn').onclick=()=>$('modal').classList.remove('hide');$('closeModal').onclick=()=>$('modal').classList.add('hide');$('modal').onclick=e=>{if(e.target.id==='modal')$('modal').classList.add('hide')};

function showToast(msg){$('toast').textContent=msg;$('toast').classList.remove('hide');setTimeout(()=>$('toast').classList.add('hide'),4500);}

(async()=>{ try{D=await fetch(DATA_URL).then(r=>r.json());initMap();$('statusText').textContent='MAPA REAL · NASA MARS TREK · MOLA'; }catch(e){showToast('No se pudo cargar la configuración.');console.error(e);} })();
