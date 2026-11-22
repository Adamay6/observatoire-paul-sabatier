import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.OBSERVATOIRE_PORT || 4173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    const wanted = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const filename = resolve(dist, wanted);
    const localPath = relative(dist, filename);
    if (localPath === '..' || localPath.startsWith(`..${sep}`) || isAbsolute(localPath) || !mime[extname(filename)]) {
      response.writeHead(404).end('Introuvable');
      return;
    }
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': `${mime[extname(filename)]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404).end('Introuvable');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Observatoire disponible sur http://127.0.0.1:${server.address().port}/`));
