import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequestOrigin } from '../lib/request-origin.ts';
const preview = 'https://unfortunately-illinois-downtown-ways.trycloudflare.com';
test('same-origin and configured HTTPS tunnel can access the local API', () => {
  for (const origin of ['http://localhost:3000', preview]) {
    assert.equal(allowedRequestOrigin(new Request('http://localhost:3000/api/link', { headers: { origin } })), true);
  }
});
test('the HTTPS origin forwarded by the private reverse proxy is accepted', () => {
  assert.equal(
    allowedRequestOrigin(
      new Request('http://games.115.68.208.145.sslip.io/api/link', {
        headers: {
          origin: 'https://games.115.68.208.145.sslip.io',
          'x-forwarded-proto': 'https',
        },
      }),
    ),
    true,
  );
});
test('unrelated origins and spoofed forwarded headers remain blocked', () => {
  for (const origin of ['https://other.trycloudflare.com', preview + '.evil.test', 'null', 'https://evil.test']) {
    assert.equal(allowedRequestOrigin(new Request('http://localhost:3000/api/link', { headers: { origin, 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https' } })), false);
  }
  assert.equal(allowedRequestOrigin(new Request('https://production.example/api/link', { headers: { origin: preview } })), false);
});
