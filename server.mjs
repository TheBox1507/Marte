import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { buildMissionPdf } from './pdf-report.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);

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
