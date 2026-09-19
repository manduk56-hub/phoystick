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
const fishHost = await call('create', { game: 'fishing' });
assert.equal((await call('join', { code: fishHost.data.code })).status, 400);
const fishPhone = await call('join', {
  code: fishHost.data.code,
  game: 'fishing',
});
assert.equal(fishPhone.status, 200);
await call('input', {
  ...fishPhone.data,
  data: {
    x: 0.5,
    y: 0.5,
    events: [{ id: 1, action: 'cast', value: 0.75 }],
    time: Date.now(),
  },
});
assert.equal(
  JSON.parse((await call('read', fishHost.data)).data.input).events[0].value,
  0.75,
);
console.log('PASS: fishing pairing, cross-game rejection and casting relay');
const raceHost = await call('create', { game: 'racing' });
assert.equal(raceHost.status, 200);
assert.equal(
  (await call('join', { code: raceHost.data.code, game: 'fishing' })).status,
  400,
);
assert.equal((await call('join', { code: raceHost.data.code })).status, 400);
const racePhone = await call('join', {
  code: raceHost.data.code,
  game: 'racing',
});
assert.equal(racePhone.status, 200);
await call('input', {
  ...racePhone.data,
  data: {
    drive: { steer: -0.5, throttle: 0.75, brake: 0 },
    events: [],
    time: Date.now(),
  },
});
assert.equal(
  JSON.parse((await call('read', raceHost.data)).data.input).drive.throttle,
  0.75,
);
await call('status', {
  ...raceHost.data,
  data: { game: 'racing', phase: 'racing', speed: 35, time: Date.now() },
});
assert.equal(
  JSON.parse((await call('read', racePhone.data)).data.status).speed,
  35,
);
console.log(
  'PASS: racing pairing, game isolation, steering/pedal relay and speed sync',
);
