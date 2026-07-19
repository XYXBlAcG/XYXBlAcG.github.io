#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { randomInt } from 'node:crypto';

const root = process.cwd();
const port = Number(process.argv[2] || 5181);
const host = process.argv[3] || '0.0.0.0';
const sessionTtlMs = 15 * 60 * 1000;
const maxJsonBytes = 2 * 1024 * 1024;
const sessions = new Map();
const localApiBase = '/work/lan-transfer/api';

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(body);
}

function sendNoContent(response) {
  response.writeHead(204, {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  response.end();
}

function cleanupSessions() {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.createdAt > sessionTtlMs) {
      sessions.delete(code);
    }
  }
}

function createCode() {
  cleanupSessions();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = String(randomInt(1000, 10000));
    if (!sessions.has(code)) return code;
  }
  throw new Error('短码池暂时已满，请稍后重试');
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxJsonBytes) {
        reject(new Error('请求内容过大'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON 格式不正确'));
      }
    });
    request.on('error', reject);
  });
}

function getLanInterfaces() {
  const entries = [];
  for (const [name, values] of Object.entries(networkInterfaces())) {
    for (const value of values || []) {
      if (value.family !== 'IPv4' || value.internal) continue;
      entries.push({
        name,
        address: value.address,
        url: `http://${value.address}:${port}/work/lan-transfer/`,
      });
    }
  }
  return entries;
}

async function handleApi(request, response, url) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    sendNoContent(response);
    return true;
  }

  if (
    (url.pathname === localApiBase || url.pathname === `${localApiBase}/`)
    && request.method === 'GET'
  ) {
    sendJson(response, 200, {
      ok: true,
      service: 'lan-transfer-signaling',
      codeDigits: 4,
      expiresMs: sessionTtlMs,
      endpoints: {
        health: `${localApiBase}/health`,
        network: `${localApiBase}/network`,
        offers: `${localApiBase}/offers`,
        offer: `${localApiBase}/offers/:code`,
        answers: `${localApiBase}/answers/:code`,
      },
    });
    return true;
  }

  if (url.pathname === `${localApiBase}/health` && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      codeDigits: 4,
      expiresMs: sessionTtlMs,
    });
    return true;
  }

  if (url.pathname === `${localApiBase}/network` && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      host,
      port,
      interfaces: getLanInterfaces(),
    });
    return true;
  }

  if (url.pathname === `${localApiBase}/offers` && request.method === 'POST') {
    const body = await readJson(request);
    if (!body.offer) {
      sendJson(response, 400, { error: '缺少 offer' });
      return true;
    }

    const code = createCode();
    sessions.set(code, {
      offer: body.offer,
      answer: null,
      createdAt: Date.now(),
    });
    sendJson(response, 200, {
      code,
      expiresAt: Date.now() + sessionTtlMs,
      url: `http://${request.headers.host}/work/lan-transfer/?mode=receive&code=${code}`,
    });
    return true;
  }

  const offerMatch = url.pathname.match(/^\/work\/lan-transfer\/api\/offers\/(\d{2,4})$/);
  if (offerMatch && request.method === 'GET') {
    cleanupSessions();
    const session = sessions.get(offerMatch[1]);
    if (!session) {
      sendJson(response, 404, { error: '发起码不存在或已过期' });
      return true;
    }
    sendJson(response, 200, { offer: session.offer });
    return true;
  }

  const answerMatch = url.pathname.match(/^\/work\/lan-transfer\/api\/answers\/(\d{2,4})$/);
  if (answerMatch && request.method === 'POST') {
    cleanupSessions();
    const session = sessions.get(answerMatch[1]);
    if (!session) {
      sendJson(response, 404, { error: '发起码不存在或已过期' });
      return true;
    }
    const body = await readJson(request);
    if (!body.answer) {
      sendJson(response, 400, { error: '缺少 answer' });
      return true;
    }
    session.answer = body.answer;
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (answerMatch && request.method === 'GET') {
    cleanupSessions();
    const session = sessions.get(answerMatch[1]);
    if (!session) {
      sendJson(response, 404, { error: '发起码不存在或已过期' });
      return true;
    }
    sendJson(response, 200, session.answer
      ? { ready: true, answer: session.answer }
      : { ready: false });
    return true;
  }

  return false;
}

async function serveStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  let filePath = path.resolve(root, `.${relativePath}`);

  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(extension) || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    try {
      const notFound = await readFile(path.join(root, '404.html'));
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(notFound);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  try {
    if (url.pathname === localApiBase || url.pathname.startsWith(`${localApiBase}/`)) {
      const handled = await handleApi(request, response, url);
      if (handled) return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 500, { error: error.message || '服务器错误' });
  }
});

server.listen(port, host, () => {
  const urls = getLanInterfaces().map((entry) => entry.url);
  console.log(`LAN transfer server running at http://127.0.0.1:${port}/work/lan-transfer/`);
  urls.forEach((url) => console.log(`LAN URL: ${url}`));
});
