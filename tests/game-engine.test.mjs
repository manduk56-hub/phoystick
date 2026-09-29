import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../lib/game-engine.ts';

test('shared engine advances at a fixed rate, bounds background gaps and cleans up', () => {
  const oldRAF = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  const oldResize = globalThis.ResizeObserver;
  const scheduled = new Map();
  let nextId = 0;
  let resize;
  let disconnected = false;
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    scheduled.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => scheduled.delete(id);
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  try {
    const steps = [];
    const draws = [];
    const sizes = [];
    const camera = { aspect: 0, updateProjectionMatrix() { sizes.push('camera'); } };
    const engine = new GameEngine(
      { getBoundingClientRect: () => ({ width: 800, height: 400 }) },
      { setSize: (w, h) => sizes.push([w, h]) }, camera,
      (dt) => steps.push(dt), (dt) => draws.push(dt),
    );
    resize();
    assert.equal(camera.aspect, 2);
    assert.deepEqual(sizes, [[800, 400], 'camera']);
    const frame = (time) => {
      const [id, callback] = scheduled.entries().next().value;
      scheduled.delete(id);
      callback(time);
    };
    frame(1000);
    frame(1010);
    frame(1020);
    assert.equal(steps.length, 1);
    frame(1200);
    assert.equal(steps.length, 7, 'long frames are bounded to six simulation steps');
    assert.equal(draws.length, 4);
    assert.ok(steps.every((dt) => dt === 1 / 60));
    engine.dispose();
    assert.equal(scheduled.size, 0);
    assert.equal(disconnected, true);
  } finally {
    globalThis.requestAnimationFrame = oldRAF;
    globalThis.cancelAnimationFrame = oldCancel;
    globalThis.ResizeObserver = oldResize;
  }
});
