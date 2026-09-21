import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const DEM_ENDPOINT = 'https://tiles.arcgis.com/tiles/nzS0F0zdNLvs7nc8/arcgis/rest/services/Mars_MOLA_elevation/MapServer/identify';
const cache = new Map();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body, type='application/json; charset=utf-8') {
  cors(res);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function cacheKey(lat, lon) { return `${lat.toFixed(5)},${lon.toFixed(5)}`; }

function parseElevation(payload) {
  const r = payload?.results?.[0];
  const attrs = r?.attributes || {};
  const keys = ['Value','value','ELEVATION','elevation','Elevation','PIXELVALUE','Pixel Value'];
  for (const k of keys) {
    const v = Number(attrs[k] ?? r?.value);
    if (Number.isFinite(v)) return v;
  }
  if (Array.isArray(payload?.value)) {
    const v = Number(payload.value[0]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

async function elevation(lat, lon) {
  const key = cacheKey(lat, lon);
  if (cache.has(key)) return cache.get(key);
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '104905',
    layers: 'all:0',
    tolerance: '1',
    mapExtent: `${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}`,
    imageDisplay: '800,600,96',
    returnGeometry: 'false'
  });
  const response = await fetch(`${DEM_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error(`MOLA service HTTP ${response.status}`);
  const json = await response.json();
  const value = parseElevation(json);
  cache.set(key, value);
  return value;
}

async function handleElevations(req, res, url) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'JSON inválido' }); }
  const points = Array.isArray(body.points) ? body.points : [];
  if (!points.length || points.length > 400) return send(res, 400, { error: 'Envía entre 1 y 400 puntos.' });
  const out = new Array(points.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(8, points.length) }, async () => {
    while (next < points.length) {
      const i = next++;
      const p = points[i];
      try {
        const lat = Number(p.lat); const lon = Number(p.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Coordenada inválida');
        out[i] = { ...p, elevationM: await elevation(lat, lon) };
      } catch (err) {
        out[i] = { ...p, elevationM: null, error: err.message };
      }
    }
  });
  await Promise.all(workers);
  send(res, 200, { source: 'MOLA / ArcGIS public map service', points: out });
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
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, dem: 'MOLA / ArcGIS' });
    if (url.pathname === '/api/elevations' || url.pathname === '/.netlify/functions/elevations') return handleElevations(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mars Explorer disponible en el puerto ${PORT}`));
