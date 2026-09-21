import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { fromUrl } from 'geotiff';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);

// Public, published USGS Astrogeology dataset for Jezero crater.
// 20 m/pixel CTX DEM, vertically localized to MOLA.
const CTX_DEM_URL = 'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif';
const CTX_BBOX = { minLon: 76.99, maxLon: 78.58, minLat: 17.58, maxLat: 19.29 };
const DEM_WIDTH = 192;
const DEM_HEIGHT = 192;
let demPromise = null;
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

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function cacheKey(p) { return `${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`; }

async function loadDem() {
  if (!demPromise) {
    demPromise = (async () => {
      const tiff = await fromUrl(CTX_DEM_URL);
      const image = await tiff.getImage();
      return image;
    })().catch(err => {
      demPromise = null;
      throw err;
    });
  }
  return demPromise;
}

function pixelFromLonLat(lon, lat, width, height) {
  const x = (lon - CTX_BBOX.minLon) / (CTX_BBOX.maxLon - CTX_BBOX.minLon) * (width - 1);
  const y = (CTX_BBOX.maxLat - lat) / (CTX_BBOX.maxLat - CTX_BBOX.minLat) * (height - 1);
  return { x, y };
}

async function sampleElevations(points) {
  const valid = points.map((p, i) => ({ i, lat: Number(p.lat), lon: Number(p.lon) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  for (const p of valid) {
    if (p.lon < CTX_BBOX.minLon || p.lon > CTX_BBOX.maxLon || p.lat < CTX_BBOX.minLat || p.lat > CTX_BBOX.maxLat) {
      throw new Error(`El punto ${p.i + 1} (${p.lat.toFixed(5)}° N, ${p.lon.toFixed(5)}° E) está fuera de la cobertura del DEM CTX de Jezero (${CTX_BBOX.minLat}–${CTX_BBOX.maxLat}° N, ${CTX_BBOX.minLon}–${CTX_BBOX.maxLon}° E).`);
    }
  }
  if (!valid.length) throw new Error('No hay coordenadas válidas.');

  const missing = [];
  const values = new Map();
  for (const p of valid) {
    const k = cacheKey(p);
    if (sampleCache.has(k)) values.set(k, sampleCache.get(k));
    else missing.push(p);
  }
  if (!missing.length) return points.map(p => ({ ...p, elevationM: values.get(cacheKey(p)) ?? null }));

  const image = await loadDem();
  const rasterWidth = image.getWidth();
  const rasterHeight = image.getHeight();

  // Get the exact published image bounds when the GeoTIFF exposes them.
  let bbox = CTX_BBOX;
  try {
    const b = image.getBoundingBox();
    if (Array.isArray(b) && b.length === 4 && b.every(Number.isFinite)) {
      bbox = { minLon: b[0], minLat: b[1], maxLon: b[2], maxLat: b[3] };
    }
  } catch (_) {}

  function pixel(lon, lat) {
    const x = (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon) * (rasterWidth - 1);
    const y = (bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat) * (rasterHeight - 1);
    return { x, y };
  }

  const pix = missing.map(p => ({ ...p, ...pixel(p.lon, p.lat) }));
  const pad = 2;
  const x0 = clamp(Math.floor(Math.min(...pix.map(p => p.x)) - pad), 0, rasterWidth - 1);
  const y0 = clamp(Math.floor(Math.min(...pix.map(p => p.y)) - pad), 0, rasterHeight - 1);
  const x1 = clamp(Math.ceil(Math.max(...pix.map(p => p.x)) + pad + 1), 1, rasterWidth);
  const y1 = clamp(Math.ceil(Math.max(...pix.map(p => p.y)) + pad + 1), 1, rasterHeight);

  // Read the needed part of the published DEM and resample it to a compact grid.
  const outW = Math.min(192, Math.max(32, x1 - x0));
  const outH = Math.min(192, Math.max(32, y1 - y0));
  const rasters = await image.readRasters({
    window: [x0, y0, x1, y1],
    width: outW,
    height: outH,
    samples: [0],
    interleave: true,
    resampleMethod: 'bilinear'
  });
  const data = rasters;

  for (const p of missing) {
    const q = pixel(p.lon, p.lat);
    const rx = clamp(((q.x - x0) / Math.max(1, (x1 - x0 - 1))) * (outW - 1), 0, outW - 1);
    const ry = clamp(((q.y - y0) / Math.max(1, (y1 - y0 - 1))) * (outH - 1), 0, outH - 1);
    const idx = Math.round(ry) * outW + Math.round(rx);
    const raw = Number(data[idx]);
    const elev = Number.isFinite(raw) ? raw : null;
    sampleCache.set(cacheKey(p), elev);
    values.set(cacheKey(p), elev);
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
    if (missing === out.length) return send(res, 502, { error: 'El DEM CTX no devolvió valores de elevación.' });
    return send(res, 200, {
      source: 'USGS Astrogeology / Mars 2020 Science Investigation CTX DEM Mosaic',
      resolutionM: 20,
      control: 'MOLA',
      coverage: CTX_BBOX,
      points: out
    });
  } catch (err) {
    return send(res, 502, { error: `No se pudo consultar el DEM de Jezero: ${err?.message || err}` });
  }
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
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, dem: 'CTX Jezero 20m / control MOLA', coverage: CTX_BBOX });
    if (url.pathname === '/api/elevations') return handleElevations(req, res);
    return serveStatic(req, res, url);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mars Explorer disponible en el puerto ${PORT}`));
