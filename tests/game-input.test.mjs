import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedPoint, smoothControl } from '../lib/game-input.ts';

test('touch aim stays bounded when captured fingers leave the pad', () => {
  const bounds = { left: 20, top: 10, width: 200, height: 100 };
  assert.deepEqual(normalizedPoint(-50, 500, bounds), { x: 0, y: 1 });
  assert.deepEqual(normalizedPoint(120, 60, bounds), { x: 0.5, y: 0.5 });
  const invalid = normalizedPoint(NaN, Infinity, {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  assert.ok(Number.isFinite(invalid.x) && Number.isFinite(invalid.y));
});

test('steering ramps without overshoot and settles consistently at different update rates', () => {
  const first = smoothControl(0, 1, 0.05);
  assert.ok(first > 0.3 && first < 0.6);
  const simulate = (dt) => {
    let value = 0;
    for (let i = 0; i < Math.round(0.5 / dt); i++)
      value = smoothControl(value, 1, dt);
    return value;
  };
  assert.ok(Math.abs(simulate(0.05) - simulate(0.01)) < 0.000001);
  assert.ok(simulate(0.05) > 0.99);
  assert.ok(smoothControl(1, -1, 0.05) > -1);
});
