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
  tick(m, m.wait);
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
  tick(m, m.wait + 5);
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

test('bait, point and depth materially change the target species suitability', () => {
  const m = new FishingModel();
  const carpBefore = m.suitability(3);
  m.configure('spot', 1);
  m.configure('bait', 1);
  m.configure('rig', 1);
  assert.ok(m.suitability(3) > carpBefore * 5);
  m.configure('rig', 2);
  assert.equal(m.state.bait, 3);
  assert.equal(m.suitability(0), 0);
  assert.ok(m.suitability(5) > 0);
});

test('spinning needs a recent retrieve and the lure returns to shore', () => {
  const m = new FishingModel(() => 0.2);
  m.configure('rig', 2);
  m.cast();
  tick(m, 40);
  assert.equal(m.state.phase, 'waiting');
  for (let i = 0; i < 3; i++) m.reel(1);
  m.tick(0.02);
  assert.equal(m.state.phase, 'bite');
  m.recall();
  m.cast(0.15);
  tick(m, 1.4);
  for (let i = 0; i < 40 && m.state.phase === 'waiting'; i++) m.reel(1);
  assert.equal(m.state.phase, 'ready');
});

test('groundbait stays at its point and is charged once per application', () => {
  const m = new FishingModel();
  m.feed();
  assert.equal(m.state.silver, 35);
  assert.equal(m.state.groundbait, 180);
  m.configure('spot', 1);
  assert.equal(m.state.groundbait, 0);
  m.cast();
  const before = m.state.silver;
  m.feed();
  assert.equal(m.state.silver, before);
});

test('drag releases line on a strong run and worn line increases tension', () => {
  const weak = hooked(),
    strong = hooked();
  for (const m of [weak, strong]) {
    m.state.weight = 6;
    m.state.fishId = 3;
    m.state.phaseTime = 3;
  }
  weak.configure('drag', 0.1);
  strong.configure('drag', 1);
  for (let i = 0; i < 20; i++) {
    weak.tick(0.02);
    strong.tick(0.02);
  }
  assert.ok(weak.state.distance > strong.state.distance);
  const worn = hooked(),
    fresh = hooked();
  worn.state.condition = 0.1;
  worn.reel(0.5);
  fresh.reel(0.5);
  assert.ok(worn.state.tension > fresh.state.tension);
});

function landed() {
  const m = hooked();
  for (let i = 0; i < 1000 && m.state.phase === 'fighting'; i++) {
    if (m.state.tension < 0.65) m.reel(0.16);
    tick(m, 0.25);
  }
  assert.equal(m.state.phase, 'caught');
  return m;
}

test('sell, release, purchase and save preserve the fishing economy', () => {
  const m = landed();
  const value = m.state.keepnet[0].value;
  m.sell();
  assert.equal(m.state.silver, 40 + value);
  m.sell();
  assert.equal(m.state.silver, 40 + value);
  m.buy(2);
  assert.equal(m.state.gear, 0);
  m.state.silver = 500;
  m.buy(1);
  assert.equal(m.state.silver, 320);
  m.buy(1);
  assert.equal(m.state.silver, 320);
  m.configure('spot', 2);
  m.configure('rig', 2);
  const restored = new FishingModel();
  restored.restore(m.save());
  assert.equal(restored.state.silver, 320);
  assert.equal(restored.state.gear, 1);
  assert.equal(restored.state.rig, 2);
  assert.equal(restored.state.spot, 2);
  assert.equal(restored.state.journal.length, 1);
  const released = landed(),
    xp = released.state.xp;
  released.release();
  released.release();
  assert.equal(released.state.xp, xp + 5);
  assert.equal(released.state.keepnet.length, 0);
  assert.equal(released.state.journal[0].released, true);
});

test('invalid saves and nonfinite inputs never corrupt the session', () => {
  const m = new FishingModel(),
    before = JSON.stringify(m.state);
  m.restore('{broken');
  m.restore('{"version":1}');
  m.configure('spot', NaN);
  m.tick(Infinity);
  assert.equal(JSON.stringify(m.state), before);
});

test('leader material and hook size change presentation, strength and target size', () => {
  const rolls = () => {
    let i = 0;
    return () => [0, 0, 0.5][i++ % 3];
  };
  const small = new FishingModel(rolls()),
    large = new FishingModel(rolls());
  large.configure('hookSize', 2);
  assert.ok(large.suitability(0) < small.suitability(0));
  small.cast();
  large.cast();
  assert.equal(small.state.fishId, large.state.fishId);
  assert.ok(large.state.weight > small.state.weight);
  const a = new FishingModel(() => 0),
    b = new FishingModel(() => 0);
  b.configure('leader', 2);
  assert.ok(b.lineStrength > a.lineStrength);
  assert.ok(b.suitability(0) < a.suitability(0));
  b.configure('hookSize', 1);
  const restored = new FishingModel();
  restored.restore(b.save());
  assert.equal(restored.state.hookSize, 1);
  assert.equal(restored.state.leader, 2);
});

test('tackle locks during a cast and pause freezes every fishing control', () => {
  const m = hooked(),
    spot = m.state.spot;
  m.configure('spot', 2);
  assert.equal(m.state.spot, spot);
  m.pause();
  const before = JSON.stringify(m.state);
  m.configure('rod', 1);
  m.configure('drag', 0.1);
  m.recall();
  m.buy(1);
  m.feed();
  m.sell();
  m.repair();
  m.release();
  assert.equal(JSON.stringify(m.state), before);
});
