import test from 'node:test';
import assert from 'node:assert/strict';
import { AimStabilizer } from '../lib/aim-stabilizer.ts';
test('small alternating jitter is suppressed without drift', () => {
  const f = new AimStabilizer();
  f.update({ x: 0.5, y: 0.5 }, 0);
  let max = 0;
  for (let i = 1; i < 180; i++) {
    const p = f.update(
      { x: 0.5 + (i % 2 ? 0.006 : -0.006), y: 0.5 + (i % 2 ? 0.006 : -0.006) },
      i * 16,
    );
    max = Math.max(max, Math.abs(p.x - 0.5));
  }
  assert.ok(max < 0.0025);
});
test('large intentional movement reaches target promptly', () => {
  const f = new AimStabilizer();
  f.update({ x: 0.2, y: 0.5 }, 0);
  let p;
  for (let i = 1; i <= 12; i++) p = f.update({ x: 0.8, y: 0.5 }, i * 16);
  assert.ok(p.x > 0.77);
});
test('single spike is rejected and shot holds pre-flick position', () => {
  const f = new AimStabilizer();
  for (let i = 0; i < 8; i++) f.update({ x: 0.5, y: 0.5 }, i * 16);
  const spike = f.update({ x: 0.9, y: 0.1 }, 128);
  assert.ok(Math.abs(spike.x - 0.5) < 0.001);
  f.hold({ x: 0.3, y: 0.4 }, 150);
  assert.deepEqual(f.update({ x: 0.9, y: 0.1 }, 200), { x: 0.3, y: 0.4 });
  f.reset();
  assert.deepEqual(f.update({ x: 0.7, y: 0.8 }, 500), { x: 0.7, y: 0.8 });
});
