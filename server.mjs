import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { getEggCatalog, getEggBySlug } from './eggs/catalog.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.join(__dirname, 'web');

const PORT = Number(process.env.PORT || 3010);
const ENABLE_DOCKER_RUN = String(process.env.ENABLE_DOCKER_RUN || 'false').toLowerCase() === 'true';
const DEFAULT_DOCKER_IMAGE = process.env.DEFAULT_DOCKER_IMAGE || 'alpine:3.19';

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

function serveStatic(req, res) {
  let urlPath = new URL(req.url, 'http://localhost').pathname;
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const safePath = path.normalize(urlPath).replace(/^\\|^\//, '');
  const filePath = path.join(WEB_DIR, safePath);
  if (!filePath.startsWith(WEB_DIR)) return notFound(res);
  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const json = raw ? JSON.parse(raw) : {};
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function substituteStartup(startup, vars) {
  let cmd = String(startup || '');
  // ${KEY} style
  cmd = cmd.replace(/\$\{([A-Z0-9_]+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
  // {{KEY}} style
  cmd = cmd.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
  return cmd.trim();
}

function buildDockerRun(egg, vars) {
  const image = egg.docker_image || DEFAULT_DOCKER_IMAGE;
  const timestamp = Date.now();
  const name = `game-${egg.slug}-${timestamp}`.replace(/[^a-z0-9_.-]/gi, '-');
  const envArgs = [];
  for (const [k, v] of Object.entries(vars)) envArgs.push('-e', `${k}=${v}`);

  // Best-effort port mapping if SERVER_PORT present
  const port = vars.SERVER_PORT || vars.PORT || vars.GAME_PORT;
  const portArgs = port ? ['-p', `${port}:${port}/udp`, '-p', `${port}:${port}/tcp`] : [];

  const startupCmd = substituteStartup(egg.startup || 'echo "No startup provided"', vars) || 'sh -lc "echo No startup provided"';
  const finalCmd = ['sh', '-lc', startupCmd];

  const args = ['run', '-d', '--name', name, ...envArgs, ...portArgs, image, ...finalCmd];
  return { name, image, args, startupCmd };
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/eggs') {
    const eggs = getEggCatalog();
    return sendJson(res, 200, { eggs });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/eggs/')) {
    const slug = decodeURIComponent(pathname.split('/').pop() || '');
    const egg = getEggBySlug(slug);
    if (!egg) return sendJson(res, 404, { error: 'Egg not found' });
    return sendJson(res, 200, { egg });
  }

  if (req.method === 'POST' && pathname === '/api/launch') {
    try {
      const body = await readBody(req);
      const { slug, params = {} } = body || {};
      const egg = getEggBySlug(String(slug || ''));
      if (!egg) return sendJson(res, 400, { error: 'Unknown egg slug' });

      // Normalize variables: default + provided
      const vars = {};
      for (const v of egg.variables || []) {
        const key = v.key;
        if (!key) continue;
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          vars[key] = params[key];
        } else if (v.default !== undefined && v.default !== null) {
          vars[key] = v.default;
        }
      }

      const { name, image, args, startupCmd } = buildDockerRun(egg, vars);

      if (!ENABLE_DOCKER_RUN) {
        return sendJson(res, 202, {
          status: 'dry-run',
          message: 'Docker run simulated. Set ENABLE_DOCKER_RUN=true to actually start.',
          containerName: name,
          image,
          docker: ['docker', ...args],
          startupCmd,
          vars,
        });
      }

      const result = spawnSync('docker', args, { stdio: 'pipe', encoding: 'utf8' });
      if (result.error) {
        return sendJson(res, 500, { error: String(result.error), docker: ['docker', ...args] });
      }
      if (result.status !== 0) {
        return sendJson(res, 500, { error: 'Docker failed', code: result.status, stdout: result.stdout, stderr: result.stderr, docker: ['docker', ...args] });
      }
      const containerId = (result.stdout || '').trim();
      return sendJson(res, 201, { status: 'started', containerName: name, containerId, image });
    } catch (e) {
      return sendJson(res, 400, { error: String(e && e.message ? e.message : e) });
    }
  }

  return notFound(res);
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api/')) return handleApi(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[cs_stars] Server listening on http://localhost:${PORT}`);
});
