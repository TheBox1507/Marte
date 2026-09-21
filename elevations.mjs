const DEM_ENDPOINT = 'https://tiles.arcgis.com/tiles/nzS0F0zdNLvs7nc8/arcgis/rest/services/Mars_MOLA_elevation/MapServer/identify';
const cache = new Map();

function cacheKey(lat, lon) {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function parseElevation(payload) {
  const r = payload?.results?.[0];
  const attrs = r?.attributes || {};
  const keys = ['Value', 'value', 'ELEVATION', 'elevation', 'Elevation', 'PIXELVALUE', 'Pixel Value'];
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
    mapExtent: `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`,
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

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const points = Array.isArray(body?.points) ? body.points : [];
  if (!points.length || points.length > 400) {
    return new Response(JSON.stringify({ error: 'Envía entre 1 y 400 puntos.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const out = new Array(points.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(8, points.length) }, async () => {
    while (next < points.length) {
      const i = next++;
      const p = points[i];
      try {
        const lat = Number(p.lat);
        const lon = Number(p.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Coordenada inválida');
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Coordenada fuera de rango');
        out[i] = { ...p, elevationM: await elevation(lat, lon) };
      } catch (err) {
        out[i] = { ...p, elevationM: null, error: err?.message || 'Error desconocido' };
      }
    }
  });

  await Promise.all(workers);

  return new Response(JSON.stringify({
    source: 'MOLA / ArcGIS public map service',
    points: out
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    }
  });
}
