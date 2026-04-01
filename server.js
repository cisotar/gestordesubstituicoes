/**
 * Servidor HTTP mínimo — sem dependências externas.
 * Serve todos os arquivos da pasta atual com os MIME types corretos.
 *
 * Uso:
 *   node server.js          → http://localhost:3000
 *   PORT=8080 node server.js → http://localhost:8080
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  // Normaliza a URL e remove query strings
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // Impede path traversal (ex: /../../etc/passwd)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Proibido');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      return res.end(err.code === 'ENOENT' ? 'Arquivo não encontrado' : 'Erro interno');
    }

    const ext      = path.extname(filePath).toLowerCase();
    const mimeType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type':  mimeType,
      // Permite ES Modules com MIME type correto
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  🏫 GestãoEscolar rodando em → http://localhost:${PORT}\n`);
  console.log('  Ctrl+C para parar.\n');
});
