import assert from 'node:assert/strict';
import worker from './lan-signaling-worker.mjs';

async function request(path, options = {}) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }));
  const text = await response.text();
  return {
    response,
    json: text ? JSON.parse(text) : null,
  };
}

{
  const { response, json } = await request('/api');
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.codeDigits, 4);
  assert.equal(json.expiresMs, 900000);
  assert.equal(json.endpoints.health, 'https://example.test/api/health');
}

{
  const { response, json } = await request('/api/');
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.service, 'lan-transfer-signaling');
}

{
  const { response, json } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(json, {
    ok: true,
    codeDigits: 4,
    expiresMs: 900000,
  });
}

{
  const { response } = await request('/api/offers', {
    method: 'OPTIONS',
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
}

const offer = { type: 'offer', sdp: 'v=0' };
const created = await request('/api/offers', {
  method: 'POST',
  body: { offer },
});
assert.equal(created.response.status, 200);
assert.match(created.json.code, /^\d{4}$/);

const fetchedOffer = await request(`/api/offers/${created.json.code}`);
assert.equal(fetchedOffer.response.status, 200);
assert.deepEqual(fetchedOffer.json.offer, offer);

const pendingAnswer = await request(`/api/answers/${created.json.code}`);
assert.equal(pendingAnswer.response.status, 200);
assert.deepEqual(pendingAnswer.json, { ready: false });

const answer = { type: 'answer', sdp: 'v=1' };
const postedAnswer = await request(`/api/answers/${created.json.code}`, {
  method: 'POST',
  body: { answer },
});
assert.equal(postedAnswer.response.status, 200);
assert.deepEqual(postedAnswer.json, { ok: true });

const fetchedAnswer = await request(`/api/answers/${created.json.code}`);
assert.equal(fetchedAnswer.response.status, 200);
assert.deepEqual(fetchedAnswer.json, { ready: true, answer });

{
  const { response, json } = await request('/api/missing');
  assert.equal(response.status, 404);
  assert.deepEqual(json, { error: 'Not found' });
}

console.log('LAN signaling worker tests passed');
