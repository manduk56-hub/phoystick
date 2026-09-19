import test from 'node:test';
import assert from 'node:assert/strict';
import { FishingModel, CastGesture, reelDelta } from '../lib/fishing-model.ts';
const tick = (m, seconds) => {
  for (let t = 0; t < seconds; t += 0.02) m.tick(0.02);
};
function hooked() {
  const m = new FishingModel(() => 0.2);
  m.cast(0.5);
  tick(m, 1.4);
  tick(m, 4);
  assert.equal(m.state.phase, 'bite');
  m.hook();
  return m;
}
test('cast, wait, bite, hook and controlled reeling can land a fish', () => {
  const m = hooked();
  for (let i = 0; i < 1000 && m.state.phase === 'fighting'; i++) {
    if (m.state.tension < 0.65) m.reel(0.16);
    tick(m, 0.25);
  }
  assert.equal(m.state.phase, 'caught');
  assert.equal(m.state.catches, 1);
  assert.ok(m.state.totalWeight > 0);
});
test('missing bite, reeling too fast and leaving slack each lose fish', () => {
  const m = new FishingModel(() => 0);
  m.cast(0.5);
  tick(m, 8);
  assert.equal(m.state.phase, 'escaped');
  const fast = hooked();
  for (let i = 0; i < 8; i++) fast.reel(1);
  assert.equal(fast.state.phase, 'escaped');
  const slack = hooked();
  tick(slack, 30);
  assert.equal(slack.state.phase, 'escaped');
});
test('pause blocks action and freezes progress', () => {
  const m = hooked();
  m.pause();
  const before = JSON.stringify(m.state);
  m.reel(1);
  m.flick();
  tick(m, 10);
  assert.equal(JSON.stringify(m.state), before);
});
test('forward motion alone does not cast; backswing then forward casts only once', () => {
  const g = new CastGesture();
  for (let i = 1; i < 20; i++) assert.equal(g.update(-250, i * 16).cast, null);
  let now = 400;
  for (let i = 0; i < 15; i++) {
    g.update(220, now);
    now += 16;
  }
  assert.equal(g.stage, 'armed');
  let result;
  for (let i = 0; i < 5; i++) {
    const r = g.update(-300, now);
    now += 16;
    if (r.cast !== null) result = r.cast;
  }
  assert.ok(result > 0);
  assert.equal(g.update(-300, now).cast, null);
});
test('reel clockwise wrapping is continuous and reverse/jumps ignored', () => {
  assert.ok(reelDelta(3.12, -3.12) > 0);
  assert.equal(reelDelta(0.3, 0.1), 0);
  assert.equal(reelDelta(0, 2), 0);
});
