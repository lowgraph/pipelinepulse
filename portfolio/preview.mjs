import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./site', import.meta.url));

if (!fs.existsSync(root)) {
  console.warn(`[portfolio preview] Notice: '${root}' does not exist yet. Ensure external site files are placed in portfolio/site/ or set PORTFOLIO_BASE_URL.`);
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  let file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found. Ensure external portfolio files exist in portfolio/site/ or use PORTFOLIO_BASE_URL.');
  }
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  res.writeHead(200, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}).listen(3100, '127.0.0.1', () => console.log('Portfolio preview: http://127.0.0.1:3100'));

