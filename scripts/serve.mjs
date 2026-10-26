import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { handleApply } from '../worker/index.mjs';

const root = resolve('dist');
const port = Number(process.env.PORT || 4321);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const counters = new Map();
const env = {
  ...process.env,
  APPLY_RATE_LIMITER: {
    async limit({ key }) {
      const now = Date.now();
      for (const [id, value] of counters) if (now - value.start > 60000) counters.delete(id);
      const counter = counters.get(key) || { start: now, count: 0 };
      counter.count++; counters.set(key, counter);
      return { success: counter.count <= 5 };
    },
  },
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/apply') {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      headers.set('cf-connecting-ip', incoming.socket.remoteAddress || 'local');
      const body = ['GET', 'HEAD'].includes(incoming.method) ? undefined : Readable.toWeb(incoming);
      const request = new Request(url, { method: incoming.method, headers, body, duplex: 'half' });
      const response = await handleApply(request, env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) { outgoing.writeHead(403); outgoing.end(); return; }
    try {
      const info = await stat(path);
      if (info.isDirectory()) path = resolve(path, 'index.html');
    } catch { path = resolve(path, 'index.html'); }
    let status = 200;
    let content;
    try { content = await readFile(path); } catch { status = 404; path = resolve(root, '404.html'); content = await readFile(path); }
    outgoing.writeHead(status, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    outgoing.end(incoming.method === 'HEAD' ? undefined : content);
  } catch { outgoing.writeHead(500); outgoing.end('Server error'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
