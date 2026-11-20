const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/db');
const cfg = require('./lib/config');
const api = require('./lib/api');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const sessions = new Map();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function serveFile(res, file) {
  const full = path.resolve(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(full).pipe(res);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    const sid = cookies(req).sid;
    const body = req.method === 'POST' ? await readBody(req) : {};
    const r = api.route(req.method, p, url.searchParams, body, { user: sessions.get(sid) || null });
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': r.contentType || 'application/json' };
    if (r.login) {
      const id = crypto.randomBytes(16).toString('hex');
      sessions.set(id, r.login);
      headers['Set-Cookie'] = 'sid=' + id + '; HttpOnly; Path=/; SameSite=Lax';
    }
    if (r.logout) {
      sessions.delete(sid);
      headers['Set-Cookie'] = 'sid=; Path=/; Max-Age=0';
    }
    res.writeHead(r.status, headers);
    return res.end(r.text !== undefined ? r.text : JSON.stringify(r.json));
  }

  if (p === '/') { res.writeHead(302, { Location: '/ops' }); return res.end(); }
  if (p === '/ops') return serveFile(res, 'ops.html');
  if (/^\/od\/[\w-]+$/.test(p)) return serveFile(res, 'od.html');
  return serveFile(res, p.replace(/^\//, ''));
}

http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); res.writeHead(500); res.end('Something went wrong.'); });
}).listen(PORT, HOST, () => {
  const db = store.get();
  const base = 'http://localhost:' + PORT;
  console.log('\nOD approvals demo is running\n');
  console.log('  Internal ops (work email login): ' + base + '/ops');
  console.log('  Allowed email domains: ' + cfg.ALLOWED_DOMAINS.join(', ') + '\n');
  console.log('  OD dashboards (no login, private links):');
  db.ods.forEach((o) => console.log('    ' + o.name.padEnd(16) + base + '/od/' + o.token));
  console.log('');
});
