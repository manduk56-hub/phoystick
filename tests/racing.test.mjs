import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RacingModel,
  WheelControl,
  gravityFromOrientation,
  TRACK_LENGTH,
} from '../lib/racing-model.ts';
const pose = (roll, pitch, side = 1) => {
  const r = (roll * Math.PI) / 180,
    p = (pitch * Math.PI) / 180;
  return {
    x: -side * Math.cos(p) * Math.cos(r),
    y: -side * Math.cos(p) * Math.sin(r),
    z: Math.sin(p),
  };
};
const settle = (w, g) => {
  let out;
  for (let i = 0; i < 60; i++) out = w.update(g, 0.02);
  return out;
};
test('both landscape grips steer in the same direction and separate steering from pedals', () => {
  for (const side of [1, -1]) {
    const w = new WheelControl();
    assert.equal(w.calibrate(pose(0, 20, side)), true);
    let v = settle(w, pose(25, 20, side));
    assert.ok(v.steer > 0.6);
    assert.equal(v.throttle, 0);
    assert.equal(v.brake, 0);
    v = settle(w, pose(-25, 20, side));
    assert.ok(v.steer < -0.6);
  }
});
test('forward pitch accelerates, backward pitch brakes; 25 degree saturation and dead zones', () => {
  const w = new WheelControl();
  w.calibrate(pose(0, 20));
  let v = settle(w, pose(2, 23));
  assert.equal(v.steer, 0);
  assert.equal(v.throttle, 0);
  v = settle(w, pose(0, 45));
  assert.ok(v.throttle > 0.999);
  assert.equal(v.brake, 0);
  v = settle(w, pose(0, 65));
  assert.ok(v.throttle <= 1 && v.throttle > 0.999);
  v = w.update(pose(0, -5), 0.02);
  assert.equal(v.throttle, 0);
  v = settle(w, pose(0, -5));
  assert.ok(v.brake > 0.999);
});
test('orientation conversion supports native portrait coordinates without angle discontinuity', () => {
  const g = gravityFromOrientation(0, 70);
  assert.ok(g.x < -0.9 && g.z > 0.3);
  const w = new WheelControl();
  assert.ok(w.calibrate(g));
  assert.equal(w.calibrate(gravityFromOrientation(90, 0)), false);
  assert.equal(w.calibrate({ x: NaN, y: 0, z: 0 }), false);
  w.reset();
  assert.deepEqual(w.update(g, 0.02), { steer: 0, throttle: 0, brake: 0 });
});
const tick = (m, t) => {
  for (let i = 0; i < t / 0.02; i++) m.tick(0.02);
};
test('countdown, acceleration, braking, pause and finish work end to end', () => {
  const m = new RacingModel();
  m.start();
  tick(m, 3.1);
  assert.equal(m.state.phase, 'racing');
  m.setInput({ steer: 0, throttle: 1, brake: 0 });
  tick(m, 2);
  assert.ok(m.state.speed > 15);
  const speed = m.state.speed;
  m.setInput({ steer: 0, throttle: 1, brake: 1 });
  tick(m, 0.5);
  assert.ok(m.state.speed < speed);
  m.state.paused = true;
  const d = m.state.distance;
  tick(m, 1);
  assert.equal(m.state.distance, d);
  m.state.paused = false;
  m.state.distance = TRACK_LENGTH - 0.1;
  m.state.speed = 20;
  tick(m, 0.02);
  assert.equal(m.state.phase, 'finished');
  assert.equal(m.state.distance, TRACK_LENGTH);
});
test('collisions slow the car once per impact; off-road applies drag; malformed input is bounded', () => {
  const m = new RacingModel();
  m.start();
  m.state.phase = 'racing';
  m.state.speed = 50;
  m.traffic = [{ z: 0, lane: 0, speed: 0, color: 0 }];
  m.tick(0.02);
  assert.equal(m.state.collisions, 1);
  assert.ok(m.state.speed < 25);
  m.tick(0.02);
  assert.equal(m.state.collisions, 1);
  m.traffic = [];
  m.state.lateral = 7;
  m.state.speed = 20;
  m.setInput({ steer: NaN, throttle: 5, brake: -1 });
  assert.deepEqual(m.state.input, { steer: 0, throttle: 1, brake: 0 });
  tick(m, 0.2);
  assert.ok(m.state.offroad);
  assert.ok(m.state.speed < 20);
});
