const API_PREFIX = '/api';
const CODE_DIGITS = 4;
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSION_COUNT = 9000;

const sessions = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function healthPayload() {
  return {
    ok: true,
    codeDigits: CODE_DIGITS,
    expiresMs: SESSION_TTL_MS,
  };
}

function rootPayload(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  return {
    ...healthPayload(),
    service: 'lan-transfer-signaling',
    endpoints: {
      root: `${origin}${API_PREFIX}`,
      health: `${origin}${API_PREFIX}/health`,
      network: `${origin}${API_PREFIX}/network`,
      offers: `${origin}${API_PREFIX}/offers`,
      offer: `${origin}${API_PREFIX}/offers/:code`,
      answers: `${origin}${API_PREFIX}/answers/:code`,
    },
  };
}

function normalizePath(pathname) {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === API_PREFIX) return '/';
  if (trimmed.startsWith(`${API_PREFIX}/`)) {
    return trimmed.slice(API_PREFIX.length) || '/';
  }
  return trimmed;
}

function isExpired(session, now = Date.now()) {
  return now - session.createdAt > SESSION_TTL_MS;
}

function cleanupSessions(now = Date.now()) {
  for (const [code, session] of sessions) {
    if (isExpired(session, now)) {
      sessions.delete(code);
    }
  }
}

function randomCode() {
  const max = 10 ** CODE_DIGITS;
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return String(values[0] % max).padStart(CODE_DIGITS, '0');
  }
  return String(Math.floor(Math.random() * max)).padStart(CODE_DIGITS, '0');
}

function createCode() {
  cleanupSessions();
  if (sessions.size >= MAX_SESSION_COUNT) {
    throw new Error('Code pool is full. Try again later.');
  }

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const code = randomCode();
    if (!sessions.has(code)) return code;
  }

  for (let index = 0; index < 10 ** CODE_DIGITS; index += 1) {
    const code = String(index).padStart(CODE_DIGITS, '0');
    if (!sessions.has(code)) return code;
  }

  throw new Error('Code pool is full. Try again later.');
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getSession(code) {
  cleanupSessions();
  const session = sessions.get(code);
  if (!session || isExpired(session)) {
    sessions.delete(code);
    return null;
  }
  return session;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  if (request.method === 'OPTIONS') {
    return noContent();
  }

  if (request.method === 'GET' && path === '/') {
    return json(rootPayload(request));
  }

  if (request.method === 'GET' && path === '/health') {
    return json(healthPayload());
  }

  if (request.method === 'GET' && path === '/network') {
    return json({
      ok: true,
      host: url.host,
      protocol: url.protocol.replace(':', ''),
      colo: request.cf?.colo || '',
      interfaces: [],
    });
  }

  if (request.method === 'POST' && path === '/offers') {
    const body = await readJson(request);
    if (!body.offer) {
      return json({ error: 'Missing offer' }, 400);
    }

    const code = createCode();
    sessions.set(code, {
      offer: body.offer,
      answer: null,
      createdAt: Date.now(),
    });

    return json({
      code,
      expiresAt: Date.now() + SESSION_TTL_MS,
      url: `${url.origin}${API_PREFIX}/offers/${code}`,
    });
  }

  const offerMatch = path.match(/^\/offers\/(\d{2,4})$/);
  if (request.method === 'GET' && offerMatch) {
    const session = getSession(offerMatch[1]);
    if (!session) {
      return json({ error: 'Code not found or expired' }, 404);
    }
    return json({ offer: session.offer });
  }

  const answerMatch = path.match(/^\/answers\/(\d{2,4})$/);
  if (request.method === 'POST' && answerMatch) {
    const session = getSession(answerMatch[1]);
    if (!session) {
      return json({ error: 'Code not found or expired' }, 404);
    }

    const body = await readJson(request);
    if (!body.answer) {
      return json({ error: 'Missing answer' }, 400);
    }

    session.answer = body.answer;
    return json({ ok: true });
  }

  if (request.method === 'GET' && answerMatch) {
    const session = getSession(answerMatch[1]);
    if (!session) {
      return json({ error: 'Code not found or expired' }, 404);
    }
    return json(session.answer
      ? { ready: true, answer: session.answer }
      : { ready: false });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  fetch(request) {
    return handleRequest(request).catch((error) => {
      return json({ error: error.message || 'Server error' }, 500);
    });
  },
};
