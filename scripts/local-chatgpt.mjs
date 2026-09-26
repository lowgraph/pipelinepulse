import { createServer } from 'node:http';
import next from 'next';
import { explanationHandler } from './local-chatgpt-adapter.mjs';

if (process.env.NODE_ENV === 'production') throw new Error('The ChatGPT launcher is for local development only.');
const port = Number(process.env.PIPELINE_LOCAL_PORT || 3002);
process.env.NEXT_PUBLIC_PRIVATE_EXPLANATIONS = '1';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
const app = next({ dev: true, hostname: '127.0.0.1', port,
  conf: { poweredByHeader: false, devIndicators: false, basePath: '', distDir: '.next/local-chatgpt' } });
await app.prepare();
const handle = app.getRequestHandler();
const explain = explanationHandler(port);
createServer((req, res) => {
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) {
    res.writeHead(403); res.end('Localhost only.'); return;
  }
  if (new URL(req.url, `http://127.0.0.1:${port}`).pathname === '/api/explain') void explain(req, res);
  else void handle(req, res);
}).listen(port, '127.0.0.1', () => console.log(`Pipeline Pulse + ChatGPT: http://127.0.0.1:${port}`));
