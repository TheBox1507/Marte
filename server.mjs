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

async function requestMdemSamples(points){
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
  const url = `${MARS_ELEVATION_SERVICE}?${params}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mars-Explorer/1.5' },
    signal: AbortSignal.timeout(25000)
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

  // El endpoint de ArcGIS recibe la geometría como query string. Mantener los
  // lotes pequeños evita 414 URI Too Long y hace que las rutas globales sigan
  // siendo viables. Se procesan con concurrencia limitada para no saturar el servicio.
  const chunkSize = 12;
  const chunks = [];
  for (let offset = 0; offset < missing.length; offset += chunkSize) {
    chunks.push(missing.slice(offset, offset + chunkSize));
  }

  async function processChunk(chunk) {
    try {
      return await requestMdemSamples(chunk);
    } catch (err) {
      // Si aun así el proveedor devuelve 414, divide otra vez automáticamente.
      if (String(err?.message || '').includes('414') && chunk.length > 1) {
        const mid = Math.ceil(chunk.length / 2);
        const a = await processChunk(chunk.slice(0, mid));
        const b = await processChunk(chunk.slice(mid));
        return [...a, ...b];
      }
      throw err;
    }
  }

  for (let offset = 0; offset < chunks.length; offset += 4) {
    const group = chunks.slice(offset, offset + 4);
    const results = await Promise.all(group.map(processChunk));
    group.forEach((chunk, gi) => {
      const samples = results[gi] || [];
      const byId = new Map();
      samples.forEach((sample, idx) => {
        const id = Number(sample?.locationId);
        if (Number.isFinite(id)) byId.set(id, sample);
        else if (!byId.has(idx + 1)) byId.set(idx + 1, sample);
      });
      chunk.forEach((point, j) => {
        const sample = byId.get(j + 1) || byId.get(j) || (samples.length === chunk.length ? samples[j] : null);
        const elev = parseSampleValue(sample);
        const k = cacheKey(point);
        sampleCache.set(k, elev);
        values.set(k, elev);
      });
    });
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
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, dem: 'MDEM200M global / NASA-ESA-USGS-Esri', coverage: GLOBAL_BBOX, batching: true });
    if (url.pathname === '/api/elevations') return handleElevations(req, res);
    return serveStatic(req, res, url);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mars Explorer disponible en el puerto ${PORT}`));
