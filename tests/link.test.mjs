import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
async function call(action, body = {}) {
  const response = await fetch(base + '/api/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ action, ...body }),
  });
  return { status: response.status, data: await response.json() };
}
const host = await call('create');
assert.equal(host.status, 200, JSON.stringify(host.data));
assert.match(host.data.code, /^\d{6}$/);
const phone = await call('join', { code: host.data.code });
assert.equal(phone.status, 200);
assert.equal((await call('join', { code: host.data.code })).status, 409);
assert.equal(
  (await call('read', { code: host.data.code, token: 'invalid' })).status,
  403,
);
assert.equal(
  (await call('offer', { ...phone.data, data: { sdp: 'bad' } })).status,
  400,
);
await call('offer', { ...host.data, data: { type: 'offer', sdp: 'test' } });
assert.equal(
  JSON.parse((await call('read', phone.data)).data.offer).sdp,
  'test',
);
await call('input', {
  ...phone.data,
  data: {
    x: 0.3,
    y: 0.4,
    events: [{ id: 1, action: 'fire', x: 0.3, y: 0.4 }],
    time: Date.now(),
  },
});
assert.equal(
  JSON.parse((await call('read', host.data)).data.input).events[0].action,
  'fire',
);
await call('status', { ...host.data, data: { health: 80, ammo: 5 } });
assert.equal(
  JSON.parse((await call('read', phone.data)).data.status).health,
  80,
);
console.log(
  'PASS: create, pair, duplicate protection, token authorization, role permissions, signaling, control relay and HUD sync',
);
