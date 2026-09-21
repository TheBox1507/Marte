const DATA_URL = 'data/mars-data.json';
const MARTIAN_RADIUS = 3389.5; // km
const LANDING = { lat: 18.44463, lon: 77.45088, name: 'Base / aterrizaje de Perseverance', type: 'base', required: true, dwellMin: 0 };
const CTX_BBOX = { minLon: 76.99, maxLon: 78.58, minLat: 17.58, maxLat: 19.29 };

let D;
let map, markerLayer, routeLayer, molaLayer, roughnessLayer, dustLayer;
let missionPoints = [];
let selecting = false;
let currentMission = null;

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));

function marsProjection(){
  return new ol.proj.Projection({ code:'MARS:EQUIRECTANGULAR', units:'degrees', extent:[-180,-90,180,90] });
}

function buildLayers(){
  const projection = ol.proj.get('MARS:EQUIRECTANGULAR');
  const resolutions = Array.from({length:8},(_,z)=>0.703125 / Math.pow(2,z));
  const tileGrid = new ol.tilegrid.TileGrid({ extent:[-180,-90,180,90], origin:[-180,90], resolutions, tileSize:256 });
  const nasa = id => new ol.source.XYZ({
    projection, tileGrid, crossOrigin:'anonymous', maxZoom:7,
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
  markerLayer = new ol.layer.Vector({ source:new ol.source.Vector(), style: feature => pointStyle(feature.get('kind'), feature.get('label')) });
  routeLayer = new ol.layer.Vector({ source:new ol.source.Vector() });
  routeLayer.setStyle(feature => routeStyle(feature.get('selected'),feature.get('kind')));
  return { projection, layers:[molaLayer,roughnessLayer,dustLayer,routeLayer,markerLayer] };
}

function pointStyle(kind,label){
  const color = kind==='base' ? '#7bc29a' : kind==='optional' ? '#e7b56a' : '#f0a260';
  return new ol.style.Style({
    image:new ol.style.Circle({ radius:7, fill:new ol.style.Fill({color}), stroke:new ol.style.Stroke({color:'#ffffff',width:2}) }),
    text:new ol.style.Text({ text:label||'P', offsetY:-16, fill:new ol.style.Fill({color:'#fff'}), stroke:new ol.style.Stroke({color:'#0b0f13',width:3}), font:'bold 9px sans-serif' })
  });
}
function routeStyle(selected,kind){
  const color = selected ? '#f0a260' : kind==='risk' ? '#7bc29a' : kind==='distance' ? '#b5a49a' : '#e7b56a';
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
  drawPointMarkers();
}

function centerLanding(){ map.getView().animate({center:[LANDING.lon,LANDING.lat],zoom:5,duration:350}); }

function inCtx(p){ return p.lon>=CTX_BBOX.minLon&&p.lon<=CTX_BBOX.maxLon&&p.lat>=CTX_BBOX.minLat&&p.lat<=CTX_BBOX.maxLat; }

function onMapClick(evt){
  if(!selecting) return;
  const [lon,lat]=evt.coordinate;
  const point={lat,lon,name:`Objetivo ${missionPoints.length}`,type:'science',required:true,dwellMin:15};
  if(!inCtx(point)){ showToast('Selecciona el punto dentro de la cobertura CTX de Jezero.'); return; }
  missionPoints.push(point);
  drawPointMarkers();
  renderMissionList();
  updatePlanningUI();
}

function drawPointMarkers(){
  if(!markerLayer) return;
  const source=markerLayer.getSource(); source.clear();
  missionPoints.forEach((p,i)=> source.addFeature(new ol.Feature({geometry:new ol.geom.Point([p.lon,p.lat]),kind:p.type==='base'?'base':p.required?'science':'optional',label:i===0?'B':String(i)})));
  if(!missionPoints.length) source.addFeature(new ol.Feature({geometry:new ol.geom.Point([LANDING.lon,LANDING.lat]),kind:'base',label:'B'}));
}

function haversine(a,b){
  const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*MARTIAN_RADIUS*Math.asin(Math.sqrt(h));
}
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
  while(open.length){
    open.sort((a,b)=>(f.get(key(a))??Infinity)-(f.get(key(b))??Infinity));
    const cur=open.shift();
    if(key(cur)===key(goal)){const path=[];let n=cur;while(n){path.push(n);n=came.get(key(n));}return path.reverse();}
    for(const nb of neighbors(cur,grid)){
      const tentative=(g.get(key(cur))??Infinity)+edgeCost(cur,nb,mode);
      if(tentative<(g.get(key(nb))??Infinity)){
        came.set(key(nb),cur);g.set(key(nb),tentative);f.set(key(nb),tentative+heuristic(nb,goal,mode));
        if(!open.some(n=>key(n)===key(nb)))open.push(nb);
      }
    }
  }
  return null;
}
const key=n=>`${n.r}:${n.c}`;
function forceEndpoints(path,a,b){ if(!path||path.length<2)return path; return [{...a,elevationM:a.elevationM},...path.slice(1,-1),{...b,elevationM:b.elevationM}]; }

function buildGrid(a,b,rows=13,cols=13){
  if(!inCtx(a)||!inCtx(b)) throw new Error('Todos los puntos de la misión deben estar dentro de la cobertura CTX de Jezero.');
  const latMin=Math.min(a.lat,b.lat),latMax=Math.max(a.lat,b.lat),lonMin=Math.min(a.lon,b.lon),lonMax=Math.max(a.lon,b.lon);
  const latPad=Math.max(0.012,(latMax-latMin)*.45),lonPad=Math.max(0.012,(lonMax-lonMin)*.45);
  const minLat=Math.max(CTX_BBOX.minLat,latMin-latPad),maxLat=Math.min(CTX_BBOX.maxLat,latMax+latPad),minLon=Math.max(CTX_BBOX.minLon,lonMin-lonPad),maxLon=Math.min(CTX_BBOX.maxLon,lonMax+lonPad);
  const nodes=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) nodes.push({r,c,lat:minLat+(maxLat-minLat)*(r/(rows-1)),lon:minLon+(maxLon-minLon)*(c/(cols-1))});
  return {nodes,rows,cols};
}

async function getElevations(points){
  const response=await fetch('/api/elevations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points})});
  let json=null; try{ json=await response.json(); }catch{}
  if(!response.ok) throw new Error(json?.error || `Servicio de elevación: ${response.status}`);
  if(!Array.isArray(json?.points)) throw new Error('El servicio de elevación no devolvió puntos.');
  return json.points;
}

async function calculateLeg(a,b,mode){
  const grid=buildGrid(a,b,13,13);
  const samples=grid.nodes.map(n=>({lat:n.lat,lon:n.lon}));
  samples.push({lat:a.lat,lon:a.lon},{lat:b.lat,lon:b.lon});
  const elevated=await getElevations(samples);
  const mapByCoord=new Map(elevated.map(p=>[`${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`,p.elevationM]));
  for(const n of grid.nodes) n.elevationM=mapByCoord.get(`${n.lat.toFixed(5)},${n.lon.toFixed(5)}`);
  const aElev=elevated[elevated.length-2]?.elevationM,bElev=elevated[elevated.length-1]?.elevationM;
  const aa={...a,elevationM:aElev},bb={...b,elevationM:bElev};
  if(!Number.isFinite(aa.elevationM)||!Number.isFinite(bb.elevationM)) throw new Error('No se recibió elevación para uno de los puntos de la misión.');
  const s=nearestNode(grid,aa),g=nearestNode(grid,bb); let path=aStar(grid,s,g,mode);
  if(!path) throw new Error(`No se encontró trayectoria para el tramo ${a.name} → ${b.name}.`);
  path=forceEndpoints(path,aa,bb);
  return {from:a,to:b,path,metrics:pathMetrics(path)};
}

function riskScore(m){
  const slope=Number.isFinite(m.maxSlopeDeg)?m.maxSlopeDeg:30;
  const gainPenalty=clamp(m.gainM/600,0,1)*25;
  return Math.round(clamp((slope/25)*70+gainPenalty,0,100));
}
function riskLabel(score){ if(score<30)return 'Bajo'; if(score<55)return 'Moderado'; if(score<75)return 'Alto'; return 'Muy alto'; }
function estimateDuration(metrics){
  const speed=Math.max(.1,Number($('speed').value)||1.2);
  const slopeFactor=1+clamp((metrics.avgSlopeDeg||0)/30,0,.8);
  return metrics.distanceKm/speed*slopeFactor;
}
function formatHours(h){ if(!Number.isFinite(h)) return '—'; const hrs=Math.floor(h), mins=Math.round((h-hrs)*60); return `${hrs} h ${String(mins).padStart(2,'0')} min`; }

function aggregateMission(legs,mode,includeReturn){
  const selected=legs.map(x=>x[mode]);
  const metrics={distanceKm:0,gainM:0,maxSlopeDeg:0,avgSlopeDeg:null,segments:0};
  let weightedSlope=0,weightedDistance=0;
  selected.forEach(leg=>{metrics.distanceKm+=leg.metrics.distanceKm;metrics.gainM+=leg.metrics.gainM;metrics.maxSlopeDeg=Math.max(metrics.maxSlopeDeg,leg.metrics.maxSlopeDeg);metrics.segments+=leg.metrics.segments;if(Number.isFinite(leg.metrics.avgSlopeDeg)){weightedSlope+=leg.metrics.avgSlopeDeg*leg.metrics.distanceKm;weightedDistance+=leg.metrics.distanceKm;}});
  metrics.avgSlopeDeg=weightedDistance?weightedSlope/weightedDistance:null;
  const dwellMinutes=missionPoints.reduce((s,p)=>s+(Number(p.dwellMin)||0),0);
  const duration=estimateDuration(metrics)+dwellMinutes/60;
  const score=Math.max(...selected.map(x=>riskScore(x.metrics)),0);
  return {mode,legs:selected,metrics,dwellMinutes,duration,score,includeReturn};
}

async function calculateMission(){
  if(missionPoints.length<2) return;
  setBusy(true,'Consultando DEM CTX de Jezero para todos los tramos…');
  try{
    let points=[...missionPoints];
    if($('returnBase').checked && points.length>1 && points[points.length-1]!==points[0]) points=[...points,{...points[0],name:'Regreso a base',type:'base',dwellMin:0}];
    const modes=['distance','balanced','risk'];
    const legsByMode={distance:[],balanced:[],risk:[]};
    for(let i=1;i<points.length;i++){
      const legResults=await Promise.all(modes.map(mode=>calculateLeg(points[i-1],points[i],mode)));
      modes.forEach((mode,j)=>legsByMode[mode].push(legResults[j]));
      setBusy(true,`Calculando tramo ${i} de ${points.length-1}…`);
    }
    const mission={};
    modes.forEach(mode=>mission[mode]=aggregateMission(legsByMode,mode,$('returnBase').checked));
    currentMission=mission;
    renderMission(mission[document.querySelector('input[name="mode"]:checked').value]||mission.balanced);
    drawMissionRoutes(mission,document.querySelector('input[name="mode"]:checked').value);
    setBusy(false);
  }catch(err){ setBusy(false); showToast(err.message); }
}

function drawMissionRoutes(mission,selectedMode){
  const source=routeLayer.getSource(); source.clear();
  ['distance','balanced','risk'].forEach(mode=>{
    const m=mission[mode];
    m.legs.forEach((leg,index)=>{
      const coords=leg.path.map(p=>[p.lon,p.lat]);
      source.addFeature(new ol.Feature({geometry:new ol.geom.LineString(coords),selected:mode===selectedMode,kind:mode,leg:index+1}));
    });
  });
}

function renderMission(mission){
  const m=mission.metrics,score=mission.score,maxTime=Number($('evaTime').value)||8,margin=Number($('returnMargin').value)||25;
  const available=maxTime*(1-margin/100);
  $('routeName').textContent=mission.mode==='distance'?'Misión más directa':mission.mode==='risk'?'Misión de menor exposición':'Misión equilibrada';
  $('routeStatus').textContent=`${riskLabel(score).toUpperCase()} · ${score}/100`;
  $('routeDescription').textContent=`${mission.legs.length} tramo(s) · ${missionPoints.length} puntos planificados${mission.includeReturn?' · regreso a base incluido':''}. La ruta se calcula tramo por tramo sobre el DEM CTX de Jezero.`;
  $('distance').textContent=`${m.distanceKm.toFixed(2)} km`;
  $('duration').textContent=formatHours(mission.duration);
  $('maxSlope').textContent=Number.isFinite(m.maxSlopeDeg)?`${m.maxSlopeDeg.toFixed(1)}°`:'—';
  $('gain').textContent=Number.isFinite(m.gainM)?`${Math.round(m.gainM)} m`:'—';
  $('riskNumber').textContent=score;
  $('riskLabel').textContent=riskLabel(score);
  $('riskBar').style.width=`${score}%`;
  $('avgSlope').textContent=Number.isFinite(m.avgSlopeDeg)?`${m.avgSlopeDeg.toFixed(1)}°`:'—';
  $('segments').textContent=m.segments;
  $('legsCount').textContent=mission.legs.length;
  $('dwellTotal').textContent=`${mission.dwellMinutes} min`;
  $('missionMargin').textContent=formatHours(Math.max(0,available-mission.duration));
  $('routeDescription').title=`Tiempo operativo disponible con margen: ${formatHours(available)}`;
  $('recalculate').disabled=false;
}

function renderMissionList(){
  const list=$('waypointList');
  list.innerHTML='';
  missionPoints.forEach((p,i)=>{
    const row=document.createElement('div'); row.className='waypoint';
    const title=i===0?'BASE':`P${i}`;
    row.innerHTML=`<div class="wpIndex">${title}</div><div class="wpMain"><input class="wpName" value="${escapeHtml(p.name)}" aria-label="Nombre del punto ${i+1}"><div class="wpMeta"><span>${p.lat.toFixed(4)}° N · ${p.lon.toFixed(4)}° E</span><button class="tag ${p.required?'required':'optional'}" data-action="toggleRequired" data-i="${i}">${p.required?'OBLIGATORIO':'OPCIONAL'}</button></div></div><div class="wpActions"><button data-action="up" data-i="${i}" ${i===0?'disabled':''}>↑</button><button data-action="down" data-i="${i}" ${i===missionPoints.length-1?'disabled':''}>↓</button><button data-action="delete" data-i="${i}" ${i===0?'disabled':''}>×</button></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.wpName').forEach((input,i)=>input.onchange=()=>{missionPoints[i].name=input.value.trim()||`Objetivo ${i}`;});
  list.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>handleWaypointAction(btn.dataset.action,Number(btn.dataset.i)));
}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function handleWaypointAction(action,i){
  if(action==='toggleRequired' && i>0) missionPoints[i].required=!missionPoints[i].required;
  if(action==='up' && i>1){[missionPoints[i-1],missionPoints[i]]=[missionPoints[i],missionPoints[i-1]];}
  if(action==='down' && i>0 && i<missionPoints.length-1){[missionPoints[i+1],missionPoints[i]]=[missionPoints[i],missionPoints[i+1]];}
  if(action==='delete' && i>0) missionPoints.splice(i,1);
  drawPointMarkers(); renderMissionList(); updatePlanningUI();
}
function updatePlanningUI(){
  $('pointCount').textContent=missionPoints.length;
  $('calculate').disabled=missionPoints.length<2;
  $('selectionHint').textContent=selecting?`Modo misión activo · toca el mapa para agregar el punto ${missionPoints.length}.`:(missionPoints.length?`${missionPoints.length} puntos planificados · puedes agregar más o calcular la misión.`:'Activa “Nueva misión” y toca el mapa para agregar puntos.');
}
function startSelection(){ selecting=true; updatePlanningUI(); }
function newMission(){ missionPoints=[]; currentMission=null; selecting=true; routeLayer.getSource().clear(); drawPointMarkers(); renderMissionList(); resetMetrics(); updatePlanningUI(); }
function setLanding(){ if(!missionPoints.length) missionPoints=[{...LANDING}]; else if(missionPoints[0].type!=='base') missionPoints.unshift({...LANDING}); selecting=true; drawPointMarkers(); renderMissionList(); updatePlanningUI(); centerLanding(); }
function resetMetrics(){ ['routeName','distance','duration','maxSlope','gain','avgSlope','segments','riskNumber','legsCount','dwellTotal','missionMargin'].forEach(id=>$(id).textContent=id==='routeName'?'Esperando misión':'—'); $('routeStatus').textContent='SIN RUTA';$('riskLabel').textContent='Sin evaluación';$('riskBar').style.width='0%'; }
function clearMission(){ missionPoints=[]; currentMission=null; selecting=false; routeLayer.getSource().clear(); drawPointMarkers(); renderMissionList(); resetMetrics(); updatePlanningUI(); }
function setBusy(b,msg){ $('calculate').disabled=b||missionPoints.length<2; $('recalculate').disabled=b||!currentMission; if(msg) $('statusText').textContent=msg; else $('statusText').textContent='MAPA REAL · NASA MARS TREK · DEM CTX / MOLA'; }

$('setOrigin').onclick=setLanding;
$('planMode').onclick=newMission;
$('calculate').onclick=calculateMission;
$('clearRoute').onclick=clearMission;
$('recalculate').onclick=()=>{ if(currentMission) renderMission(currentMission[document.querySelector('input[name="mode"]:checked').value]); };
$('addBase').onclick=()=>setLanding();
document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{ const layer=el.dataset.layer; if(layer==='mola')molaLayer.setVisible(el.checked); if(layer==='roughness')roughnessLayer.setVisible(el.checked); if(layer==='dust')dustLayer.setVisible(el.checked); if(layer==='route')routeLayer.setVisible(el.checked); if(layer==='points')markerLayer.setVisible(el.checked); });
document.querySelectorAll('input[name="mode"]').forEach(el=>el.onchange=()=>{ if(currentMission){ const mode=el.value; renderMission(currentMission[mode]); drawMissionRoutes(currentMission,mode); } });
function showToast(msg){$('toast').textContent=msg;$('toast').classList.remove('hide');setTimeout(()=>$('toast').classList.add('hide'),5000);}

(async()=>{ try{D=await fetch(DATA_URL).then(r=>r.json());initMap();renderMissionList();updatePlanningUI();$('statusText').textContent='MAPA REAL · NASA MARS TREK · DEM CTX / MOLA'; }catch(e){showToast('No se pudo cargar la configuración.');console.error(e);} })();
