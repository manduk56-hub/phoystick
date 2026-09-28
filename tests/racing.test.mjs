import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RacingModel,
  WheelControl,
  gravityFromOrientation,
  TRACK_LENGTH,
  RACE_DISTANCE,
  trackPoint,
  localTrack,
  trackPosition,
  trackHeading,
  trackMapPoint,
  TRACK_SAMPLES,
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
test('steering eases into turns, reverses smoothly and resets on restart', () => {
  const m = new RacingModel();
  m.state.phase = 'racing';
  m.state.speed = 30;
  m.traffic = [];
  m.setInput({ steer: 1, throttle: 0, brake: 0 });
  m.tick(1 / 60);
  assert.ok(m.steering > 0 && m.steering < 0.25);
  for (let i = 0; i < 30; i++) m.tick(1 / 60);
  assert.ok(m.steering > 0.99);
  m.setInput({ steer: -1, throttle: 0, brake: 0 });
  m.tick(1 / 60);
  assert.ok(m.steering > 0, 'reversing does not snap to the opposite direction');
  for (let i = 0; i < 30; i++) m.tick(1 / 60);
  assert.ok(m.steering < -0.99);
  m.setInput({ steer: 0, throttle: 0, brake: 0 });
  for (let i = 0; i < 30; i++) m.tick(1 / 60);
  assert.ok(Math.abs(m.steering) < 0.01, 'release settles promptly');
  m.start();
  assert.equal(m.steering, 0);
});

test('steering response is consistent at 30, 60 and 120 frames per second', () => {
  const results = [30, 60, 120].map((fps) => {
    const m = new RacingModel();
    m.state.phase = 'racing';
    m.traffic = [];
    m.setInput({ steer: 1, throttle: 0, brake: 0 });
    for (let i = 0; i < fps / 2; i++) m.tick(1 / fps);
    return m.steering;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-12);
});
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
test('whole circuit, driving coordinates and minimap use the same fixed geometry', () => {
  assert.equal(TRACK_SAMPLES.length,601);
  for (const originDistance of [0,400,800,1200,1600,2399]) {
    const origin = trackPoint(originDistance), h = trackHeading(originDistance);
    for(const sample of TRACK_SAMPLES) {
      assert.deepEqual({x:sample.x,z:sample.z},trackPoint(sample.distance));
      for(const lateral of [-5.3,0,5.3]) {
        const p = trackPosition(sample.distance,lateral);
        // Three.js group transform of a fixed vertex (x, 0, -z).
        const actual = {x:(p.x-origin.x)*Math.cos(h)-(p.z-origin.z)*Math.sin(h),
          z:-(p.x-origin.x)*Math.sin(h)-(p.z-origin.z)*Math.cos(h)};
        const expected = localTrack(sample.distance,originDistance,lateral);
        assert.ok(Math.hypot(actual.x-expected.x,actual.z-expected.z)<1e-9);
        const map = trackMapPoint(sample.distance,lateral);
        assert.ok(map.x>10 && map.x<190 && map.y>10 && map.y<190);
      }
    }
  }
  const a = trackPoint(0), b = trackPoint(50), ma = trackMapPoint(0), mb = trackMapPoint(50);
  assert.ok(Math.abs((mb.x-ma.x)/(b.x-a.x)+(mb.y-ma.y)/(b.z-a.z))<1e-8);
  assert.deepEqual(trackMapPoint(0),trackMapPoint(TRACK_LENGTH));
});
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
  m.state.lapTimes = [60, 60];
  m.lapStarted = 120;
  m.state.elapsed = 179;
  m.state.distance = RACE_DISTANCE - 0.1;
  m.state.speed = 20;
  tick(m, 0.02);
  assert.equal(m.state.phase, 'finished');
  assert.equal(m.state.distance, RACE_DISTANCE);
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

test('closed circuit is continuous at the line and local forward direction is correct', () => {
  assert.deepEqual(trackPoint(0), trackPoint(TRACK_LENGTH));
  const a = trackPoint(TRACK_LENGTH - 0.1),
    b = trackPoint(0.1);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.21);
  assert.ok(localTrack(10, 0).z < -9);
});
test('a stopped car can accelerate and steer back onto the circuit from either shoulder', () => {
  for (const side of [-1, 1]) for (const throttle of [0.35, 1]) {
    const m = new RacingModel();
    m.state.phase = 'racing';
    m.traffic = [];
    m.state.lateral = side * 8;
    m.state.speed = 0;
    m.setInput({ throttle, brake: 0, steer: -side });
    tick(m, 0.5);
    assert.ok(m.state.speed > 0, 'accelerates from zero on grass');
    tick(m, 3);
    assert.ok(Math.abs(m.state.lateral) < 5.2, 'returns to the road');
    assert.ok(m.state.distance > 0);
    assert.equal(m.state.offroad, false);
    assert.equal(m.state.lapValid, false, 'off-road lap remains invalid');
  }
});
test('off-road recovery does not move an idle or braking car', () => {
  const m = new RacingModel();
  m.state.phase = 'racing';
  m.traffic = [];
  m.state.lateral = 8;
  m.setInput({ throttle: 0, brake: 0, steer: -1 });
  tick(m, 1);
  assert.equal(m.state.speed, 0);
  assert.equal(m.state.lateral, 8);
  m.setInput({ throttle: 1, brake: 1, steer: -1 });
  tick(m, 1);
  assert.equal(m.state.speed, 0);
  assert.equal(m.state.distance, 0);
});
test('lap timing interpolates line crossing, invalid laps are excluded, restart clears standings', () => {
  const m = new RacingModel();
  m.start();
  m.state.phase = 'racing';
  m.traffic = [];
  m.state.distance = TRACK_LENGTH - 0.2;
  m.state.speed = 20;
  m.state.elapsed = 60;
  m.tick(0.02);
  assert.equal(m.state.lap, 2);
  assert.equal(m.state.lapTimes.length, 1);
  assert.ok(m.state.bestLap > 60 && m.state.bestLap < 60.02);
  const best = m.state.bestLap;
  m.state.lapValid = false;
  m.state.distance = 2 * TRACK_LENGTH - 0.2;
  m.state.elapsed = 119;
  m.tick(0.02);
  assert.equal(m.state.bestLap, best);
  assert.equal(m.state.lastLapValid, false);
  m.start();
  assert.equal(m.state.position, 8);
  assert.equal(m.state.bestLap, null);
  assert.equal(m.state.lapTimes.length, 0);
});
test('rank uses race progress and finish times, AI brakes for bends and stops at the line', () => {
  const m = new RacingModel();
  m.start();
  m.state.phase = 'racing';
  m.state.distance = 100;
  m.updateStandings();
  assert.equal(m.state.position, 1);
  const c = m.traffic[0];
  c.z = RACE_DISTANCE - 0.1;
  c.speed = 30;
  m.tick(0.02);
  assert.ok(c.finishTime !== undefined);
  assert.equal(c.z, RACE_DISTANCE);
  const d = c.z;
  m.tick(0.02);
  assert.equal(c.z, d);
  assert.equal(m.state.position, 2);
});
