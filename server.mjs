import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);

// Global Mars elevation service exposed by a public ArcGIS ImageServer.
// MDEM200M is a global Mars elevation layer documented in ArcGIS' Mars sample.
// We use ImageServer/getSamples so the route engine receives actual raster values.
const MARS_ELEVATION_SERVICE = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer/getSamples';
const GLOBAL_BBOX = { minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 };
const sampleCache = new Map();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body, type='application/json; charset=utf-8') {
  cors(res);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function cacheKey(p) { return `${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`; }

function parseSampleValue(sample) {
  const raw = sample?.value ?? sample?.attributes?.Value ?? sample?.attributes?.value;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const first = String(raw).split(',')[0].trim();
  if (!first || /^nodata$/i.test(first)) return null;
  const v = Number(first);
  return Number.isFinite(v) ? v : null;
}

async function requestMdemSamples(points) {
  const geometry = {
    points: points.map(p => [Number(p.lon), Number(p.lat)]),
    spatialReference: { wkid: 4326 }
  };
  const params = new URLSearchParams({
    geometryType: 'esriGeometryMultipoint',
    geometry: JSON.stringify(geometry),
    interpolation: 'RSP_BilinearInterpolation',
    returnFirstValueOnly: 'true',
    f: 'json'
  });
  const response = await fetch(`${MARS_ELEVATION_SERVICE}?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`MDEM200M HTTP ${response.status}`);
  const json = await response.json();
  if (json?.error) throw new Error(json.error.message || 'MDEM200M devolvió un error.');
  if (!Array.isArray(json?.samples)) throw new Error('MDEM200M no devolvió muestras.');
  return json.samples;
}

async function sampleElevations(points) {
  const valid = points.map((p, i) => ({ i, lat: Number(p.lat), lon: Number(p.lon) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  for (const p of valid) {
    if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) {
      throw new Error(`Coordenada fuera del rango planetario: ${p.lat.toFixed(5)}°, ${p.lon.toFixed(5)}°.`);
    }
  }
  if (!valid.length) throw new Error('No hay coordenadas válidas.');

  const values = new Map();
  const missing = [];
  for (const p of valid) {
    const k = cacheKey(p);
    if (sampleCache.has(k)) values.set(k, sampleCache.get(k));
    else missing.push(p);
  }

  for (let offset = 0; offset < missing.length; offset += 250) {
    const chunk = missing.slice(offset, offset + 250);
    const samples = await requestMdemSamples(chunk);
    for (let j = 0; j < chunk.length; j++) {
      const byId = samples.find(s => Number(s?.locationId) === j + 1);
      const sample = byId || (samples.length === chunk.length ? samples[j] : null);
      const elev = parseSampleValue(sample);
      const k = cacheKey(chunk[j]);
      sampleCache.set(k, elev);
      values.set(k, elev);
    }
  }

  return points.map(p => ({ ...p, elevationM: values.get(cacheKey(p)) ?? null }));
}

async function handleElevations(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'JSON inválido' }); }
  const points = Array.isArray(body.points) ? body.points : [];
  if (!points.length || points.length > 400) return send(res, 400, { error: 'Envía entre 1 y 400 puntos.' });
  try {
    const out = await sampleElevations(points);
    const missing = out.filter(p => !Number.isFinite(p.elevationM)).length;
    if (missing === out.length) return send(res, 502, { error: 'El servicio MDEM200M no devolvió valores de elevación para los puntos solicitados.' });
    return send(res, 200, {
      source: 'NASA / ESA / USGS / Esri — MDEM200M',
      resolutionM: 200,
      coverage: GLOBAL_BBOX,
      points: out
    });
  } catch (err) {
    return send(res, 502, { error: `No se pudo consultar el DEM global de MOLA: ${err?.message || err}` });
  }
}

const WMTS_LAYERS = {
  thermal: 'https://trek.nasa.gov/tiles/Mars/EQ/TES_Thermal_Inertia/1.0.0/WMTSCapabilities.xml'
};
const wmtsCache = new Map();

function decodeXmlEntities(value='') {
  return value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

async function resolveWmtsTemplate(layerId) {
  if (wmtsCache.has(layerId)) return wmtsCache.get(layerId);
  const capabilitiesUrl = WMTS_LAYERS[layerId];
  if (!capabilitiesUrl) return null;
  try {
    const response = await fetch(capabilitiesUrl, { headers: { 'Accept': 'application/xml,text/xml,*/*' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const resourceMatch = xml.match(/<ResourceURL\b[^>]*?template=["']([^"']+)["'][^>]*>/i);
    if (resourceMatch?.[1]) {
      const template = decodeXmlEntities(resourceMatch[1])
        .replace(/\{TileMatrix\}/g, '{z}')
        .replace(/\{TileRow\}/g, '{y}')
        .replace(/\{TileCol\}/g, '{x}');
      const info = { template, source: 'NASA Mars Trek WMTS GetCapabilities' };
      wmtsCache.set(layerId, info);
      return info;
    }
  } catch (_) {}
  const fallbackTemplates = { thermal: 'https://trek.nasa.gov/tiles/Mars/EQ/TES_Thermal_Inertia/1.0.0/default/default028mm/{z}/{y}/{x}.png' };
  const info = fallbackTemplates[layerId] ? { template: fallbackTemplates[layerId], source: 'NASA Mars Trek REST template (fallback)' } : null;
  if (info) wmtsCache.set(layerId, info);
  return info;
}


const TILE_UPSTREAMS = {
  thermal: 'https://trek.nasa.gov/tiles/Mars/EQ/TES_Thermal_Inertia/1.0.0/default/default028mm/{z}/{y}/{x}.png'
};
async function handleTileProxy(req, res, url) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const layer = url.searchParams.get('layer') || '';
  const z = Number(url.searchParams.get('z'));
  const x = Number(url.searchParams.get('x'));
  const y = Number(url.searchParams.get('y'));
  if (!TILE_UPSTREAMS[layer] || !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 11 || x < 0 || y < 100000) {
    return send(res, 400, { error: 'Parámetros de tile inválidos.' });
  }
  const templateInfo = await resolveWmtsTemplate(layer);
  const template = templateInfo?.template || TILE_UPSTREAMS[layer];
  const upstream = template.replaceAll('{z}',String(z)).replaceAll('{x}',String(x)).replaceAll('{y}',String(y));
  try {
    const r = await fetch(upstream, { headers: { 'User-Agent': 'Mars-Explorer/1.0' } });
    if (!r.ok) {
      res.writeHead(r.status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      return res.end('Tile sin datos en este nivel/área.');
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': r.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'X-Mars-Source': upstream,
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(buf);
  } catch (err) {
    return send(res, 502, { error: `No se pudo consultar el tile NASA: ${err?.message || err}` });
  }
}

async function handleWmtsInfo(req, res, url) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const requested = (url.searchParams.get('layers') || 'thermal').split(',').map(s => s.trim()).filter(Boolean);
  const entries = await Promise.all(requested.map(async id => [id, await resolveWmtsTemplate(id)]));
  return send(res, 200, { layers: Object.fromEntries(entries) });
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
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, dem: 'MDEM200M global 200m / NASA-ESA-USGS-Esri', coverage: GLOBAL_BBOX });
    if (url.pathname === '/api/elevations') return handleElevations(req, res);
    if (url.pathname === '/api/wmts-info') return handleWmtsInfo(req, res, url);
    if (url.pathname === '/api/tile') return handleTileProxy(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mars Explorer disponible en el puerto ${PORT}`));
