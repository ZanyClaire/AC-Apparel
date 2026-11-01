/* Minimal static server for local preview: node server.js [port]
 *
 * Deliberately small, but it is still a network listener, so it:
 *   - binds to loopback only,
 *   - answers GET and HEAD and nothing else,
 *   - refuses any path that resolves outside the project directory,
 *   - refuses dotfiles and dot-directories (.git, .env, .github),
 *   - answers a malformed percent-escape with 400 instead of throwing.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = fs.realpathSync(__dirname);
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const METHODS = new Set(['GET', 'HEAD']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8'
};

/**
 * Returns { filePath } when the request is servable, or { status, reason } when
 * it must be refused. The URL parser already collapses plain `..` segments, so
 * what reaches here is either a normal path or an encoded escape attempt.
 */
function resolveRequestPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { status: 400, reason: 'malformed percent-encoding' };
  }

  if (decoded.includes('\0')) return { status: 400, reason: 'null byte in path' };

  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(ROOT, relative);

  // path.relative is what makes this correct: a plain startsWith would accept a
  // sibling directory whose name merely begins with the project's.
  const rel = path.relative(ROOT, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { status: 403, reason: 'path leaves the project directory' };
  }

  // Never serve dotfiles or anything inside a dot-directory.
  if (rel.split(path.sep).some((segment) => segment.startsWith('.'))) {
    return { status: 403, reason: 'dotfile' };
  }

  return { filePath: resolved };
}

function send(res, status, body, extraHeaders = {}) {
  const isHead = res.req.method === 'HEAD';
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-cache',
    ...extraHeaders
  });
  res.end(isHead ? undefined : body);
}

const server = http.createServer((req, res) => {
  if (!METHODS.has(req.method)) {
    send(res, 405, '<p>Method not allowed.</p>', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    send(res, 400, '<p>Bad request.</p>');
    return;
  }

  const target = resolveRequestPath(pathname);
  if (target.status) {
    send(res, target.status, target.status === 400 ? '<p>Bad request.</p>' : '<p>Forbidden.</p>');
    return;
  }
  let filePath = target.filePath;

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 404, '<p>404 — not found. <a href="/">Return home</a></p>');
        return;
      }
      send(res, 200, data, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Aethel & Code storefront: http://localhost:${PORT}`);
});
