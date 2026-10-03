import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrieveArticle, articleURL } from './article-service.mjs';
import { validateCoordinates, devicePlace, retrieveSearch, validateSearch } from './search-service.mjs';

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml' };
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(data));
}
export function makeServer(search = retrieveSearch, article = retrieveArticle, locate = devicePlace) {
  return createServer(async (request, response) => {
    const host = request.headers.host || '';
    const origin = request.headers.origin;
    // Loopback-only retrieval; article requests also reject private network targets.
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (origin && !/^http:\/\/(127\.0\.0\.1|localhost):(4173|5173)$/.test(origin))) return json(response, 403, { error: 'Only the local NhomeAI origin is permitted.' });
    let path;
    try { path = new URL(request.url, `http://${host}`).pathname; } catch { return json(response, 400, { error: 'Invalid URL.' }); }
    if (path === '/api/search' || path === '/api/article' || path === '/api/location') {
      if (request.method !== 'POST') return json(response, 405, { error: 'Use POST for search.' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') return json(response, 415, { error: 'Search requires JSON.' });
      const controller = new AbortController();
      response.on('close', () => { if (!response.writableEnded) controller.abort(); });
      try {
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 4096) { json(response, 413, { error: 'Search request is too large.' }); return; }
          chunks.push(chunk);
        }
        let input;
        try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); input = path === '/api/article' ? articleURL(body.url).href : path === '/api/location' ? validateCoordinates(body.coordinates) : validateSearch(body); if (path === '/api/location' && !input) throw new Error('Missing coordinates'); }
        catch { return json(response, 400, { error: 'Invalid search query, date, time zone or mode.' }); }
        const result = path === '/api/location' ? {place:await locate(input,controller.signal)} : await (path === '/api/article' ? article : search)(input, controller.signal);
        if (!controller.signal.aborted) json(response, 200, result);
      } catch (error) {
        if (!controller.signal.aborted && !response.destroyed) json(response, 503, { error: error instanceof Error ? error.message : 'Free search is unavailable.' });
      }
      return;
    }
    if (path.startsWith('/api/')) return json(response, 404, { error: 'Unknown local API.' });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed.' });
    try {
      const file = resolve(ROOT, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`);
      if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return json(response, 403, { error: 'Invalid asset path.' });
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { json(response, 404, { error: 'Build asset not found. Run the production build first.' }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = makeServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('NhomeAI local-first: http://127.0.0.1:4173 (AI stays local; search uses free public web results and news RSS)'));
}
