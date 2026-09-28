import test from 'node:test';
import assert from 'node:assert/strict';
import { Link } from '../lib/link.ts';

test('racing keeps relaying controls and status when an open data channel stops delivering', async () => {
  const originalFetch = globalThis.fetch;
  const state = { input: null, status: null };
  globalThis.fetch = async (_url, options) => {
    const { action, data } = JSON.parse(options.body);
    if (action === 'input' || action === 'status') {
      state[action] = JSON.stringify(data);
      return Response.json({ ok: true });
    }
    if (action === 'read')
      return Response.json({
        version: 0,
        paired: true,
        offer: null,
        answer: null,
        ...state,
      });
    throw new Error(`Unexpected action: ${action}`);
  };

  const room = {
    code: '123456',
    token: 'test',
    version: 0,
    game: 'racing',
  };
  const host = new Link({ ...room }, 'host');
  const phone = new Link({ ...room }, 'phone');
  const silentChannel = { readyState: 'open', send() {}, close() {} };
  host.rtc = { close() {} };
  phone.rtc = { close() {} };
  host.channel = silentChannel;
  phone.channel = silentChannel;
  let drive = null;
  let speed = null;
  host.onInput = (packet) => {
    drive = packet.drive;
  };
  phone.onStatus = (packet) => {
    speed = packet.speed;
  };

  try {
    phone.send({
      x: 0,
      y: 0,
      drive: { steer: 0.5, throttle: 1, brake: 0 },
      events: [],
      time: 1,
    });
    host.send({ game: 'racing', phase: 'racing', speed: 35, time: 2 });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(check);
        reject(new Error('Relay did not deliver both packets'));
      }, 1000);
      const check = setInterval(() => {
        if (drive?.throttle === 1 && speed === 35) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 20);
    });
    assert.equal(drive.throttle, 1);
    assert.equal(speed, 35);
  } finally {
    host.close();
    phone.close();
    globalThis.fetch = originalFetch;
  }
});
