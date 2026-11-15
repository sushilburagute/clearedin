import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture = readFileSync(
  new URL('./fixtures/feed.html', import.meta.url),
  'utf8',
);
const frame =
  '<!doctype html><title>Rejected subframe</title><body>Subframe fixture</body>';
export function startFixtureServer() {
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1:8765').pathname;
    if (!['/feed/', '/feed/frame', '/feed/unsupported'].includes(path)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(path === '/feed/' ? fixture : frame);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(8765, '127.0.0.1', () => resolve(server));
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await startFixtureServer();
  console.log('Synthetic fixtures: http://127.0.0.1:8765/feed/');
}
