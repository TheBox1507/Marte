import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { buildMissionPdf } from './pdf-report.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);

const NOMENCLATURE_ENDPOINT = 'https://planetarynames.wr.usgs.gov/nomenclature/SearchResults';
const nomenclatureCache = new Map();

function decodeXml(text='') {
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/\s+/g, ' ').trim();
}
function xmlTag(block, tag) {
  const match = String(block).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}
function normalize360(lon) {
  let x = Number(lon);
  if (!Number.isFinite(x)) return 0;
  x = ((x % 360) + 360) % 360;
  return x;
}
function minDiameterForZoom(zoom) {
  const z = Number(zoom || 0);
  if (z < 2.8) return '150';
  if (z < 3.5) return '50';
  if (z < 4.5) return '15';
  if (z < 5.5) return '5';
  return '';
}
function parseNomenclatureXml(xml) {
  const features = [];
  const blocks = String(xml).match(/<feature\b[\s\S]*?<\/feature>/gi) || [];
  for (const block of blocks) {
    const approval = block.match(/<approvalstatus\b[^>]*\bid=["']?(\d+)["']?[^>]*>/i);
    if (approval && approval[1] !== '5') continue;
    const lat = Number(xmlTag(block, 'centerlatitude'));
    const lon360 = Number(xmlTag(block, 'centerlongitude'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon360)) continue;
    const lon = lon360 > 180 ? lon360 - 360 : lon360;
    const id = xmlTag(block, 'id');
    const name = xmlTag(block, 'name') || xmlTag(block, 'cleanName');
    if (!name) continue;
    const featureType = xmlTag(block, 'featuretype');
    const diameterKm = Number(xmlTag(block, 'diameter')) || 0;
    const origin = xmlTag(block, 'origin');
    const additional = xmlTag(block, 'additionalInfo') || xmlTag(block, 'additionalinfo');
    features.push({
      id, name, featureType, lat, lon, diameterKm,
      description: [origin, additional].filter(Boolean).join(' · '),
      sourceUrl: id ? `https://planetarynames.wr.usgs.gov/Feature/${encodeURIComponent(id)}` : 'https://planetarynames.wr.usgs.gov/Page/MARS/target'
    });
  }
  return features;
}
async function fetchMarsNomenclature({west,east,south,north,zoom}) {
  const minDiameter = minDiameterForZoom(zoom);
  const cacheKey = [west,east,south,north,minDiameter].map(v=>Number.isFinite(Number(v))?Number(v).toFixed(2):String(v)).join('|');
  const cached = nomenclatureCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 15 * 60_000) return {...cached.data, cached:true};
  const body = new URLSearchParams({
    additionalInfoColumn:'true', approvalDateColumn:'true', approvalStatusColumn:'true', centerLatLonColumn:'true', cleanFeatureNameColumn:'true',
    contEthColumn:'true', coordSystemColumn:'true', diameterColumn:'true', featureIDColumn:'true', featureNameColumn:'true', featureTypeCodeColumn:'true',
    featureTypeColumn:'true', lastUpdatedColumn:'true', latLonColumn:'true', originColumn:'true', quadColumn:'true', referenceColumn:'true', targetColumn:'true',
    is_0_360:'true', is_planetographic:'false', is_positive_east:'true', displayType:'XML', sort_asc:'true', sort_column:'name', approvalStatus:'',
    beginDate:'', continent:'', endDate:'', ethnicity:'', feature:'', featureType:'', minFeatureDiameter:minDiameter, maxFeatureDiameter:'', reference:'', system:'',
    target:'MARS', easternLongitude:String(normalize360(east)), westernLongitude:String(normalize360(west)), northernLatitude:String(north), southernLatitude:String(south)
  });
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), 9000);
  try {
    const response = await fetch(NOMENCLATURE_ENDPOINT, {
      method:'POST', headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'JEZERO-EVA-Mission-System/34'}, body, signal:controller.signal
    });
    if (!response.ok) throw new Error(`USGS nomenclature HTTP ${response.status}`);
    const xml = await response.text();
    const features = parseNomenclatureXml(xml);
    const data = {ok:true, source:'USGS Gazetteer / IAU', minDiameterKm:minDiameter?Number(minDiameter):0, features};
    nomenclatureCache.set(cacheKey,{at:Date.now(),data});
    if (nomenclatureCache.size > 80) nomenclatureCache.delete(nomenclatureCache.keys().next().value);
    return data;
  } finally { clearTimeout(timer); }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
}
function send(res, status, body, type='application/json; charset=utf-8') {
  cors(res);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) return send(res, 403, { error: 'Acceso denegado' });
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error('not file');
    const ext = path.extname(file).toLowerCase();
    const types = {
      '.html':'text/html; charset=utf-8',
      '.js':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8',
      '.json':'application/json; charset=utf-8',
      '.png':'image/png',
      '.ico':'image/x-icon',
      '.md':'text/markdown; charset=utf-8'
    };
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

async function readJson(req, maxBytes = 2_000_000) {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Solicitud demasiado grande.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('JSON de mision invalido.')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/mars-nomenclature' && req.method === 'GET') {
      const west = Math.max(-180, Math.min(180, Number(url.searchParams.get('west'))));
      const east = Math.max(-180, Math.min(180, Number(url.searchParams.get('east'))));
      const south = Math.max(-90, Math.min(90, Number(url.searchParams.get('south'))));
      const north = Math.max(-90, Math.min(90, Number(url.searchParams.get('north'))));
      const zoom = Number(url.searchParams.get('zoom') || 3);
      if (![west,east,south,north].every(Number.isFinite) || south > north) return send(res, 400, {error:'Rango cartográfico inválido.'});
      try {
        const data = await fetchMarsNomenclature({west,east,south,north,zoom});
        return send(res, 200, data);
      } catch (err) {
        return send(res, 502, {ok:false,error:'No se pudo consultar la nomenclatura USGS en este momento.',detail:err.message});
      }
    }
    if (url.pathname === '/api/health') {
      return send(res, 200, {
        ok: true,
        elevation: 'ArcGIS ElevationLayer · MDEM200M',
        note: 'La elevación se consulta en el navegador mediante queryElevation.'
      });
    }
    if (url.pathname === '/api/mission-pdf' && req.method === 'POST') {
      const report = await readJson(req);
      const pdf = buildMissionPdf(report);
      cors(res);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${String(report.fileName || 'mars-explorer-mision').replace(/[^a-zA-Z0-9._-]/g,'_')}.pdf"`,
        'Cache-Control': 'no-store',
        'Content-Length': pdf.length
      });
      return res.end(pdf);
    }
    return serveStatic(req, res, url);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mars Explorer disponible en el puerto ${PORT}`));
