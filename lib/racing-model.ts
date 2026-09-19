export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export type DriveInput = { steer: number; throttle: number; brake: number };
export const idleInput = (): DriveInput => ({
  steer: 0,
  throttle: 0,
  brake: 0,
});
export const TRACK_LENGTH = 3000;
export const roadX = (z: number) =>
  24 * Math.sin(z / 180) + 14 * Math.sin(z / 83);
export const roadSlope = (z: number) =>
  (24 / 180) * Math.cos(z / 180) + (14 / 83) * Math.cos(z / 83);
export type RaceState = {
  game: 'racing';
  phase: 'ready' | 'countdown' | 'racing' | 'finished';
  paused: boolean;
  countdown: number;
  distance: number;
  speed: number;
  lateral: number;
  elapsed: number;
  collisions: number;
  offroad: boolean;
  hit: number;
  input: DriveInput;
};
export type Traffic = { z: number; lane: number; speed: number; color: number };
export class RacingModel {
  state: RaceState = {
    game: 'racing',
    phase: 'ready',
    paused: false,
    countdown: 3,
    distance: 0,
    speed: 0,
    lateral: 0,
    elapsed: 0,
    collisions: 0,
    offroad: false,
    hit: 0,
    input: idleInput(),
  };
  traffic: Traffic[] = [];
  constructor() {
    this.resetTraffic();
  }
  resetTraffic() {
    this.traffic = Array.from({ length: 26 }, (_, i) => ({
      z: 130 + i * 113,
      lane: [-3.1, 0, 3.1][i % 3],
      speed: i % 4 === 0 ? 12 : 18 + (i % 3) * 3,
      color: [0xffb743, 0xe6e9ed, 0x8966ff, 0x32ccbc][i % 4],
    }));
  }
  start() {
    this.state = {
      ...this.state,
      phase: 'countdown',
      paused: false,
      countdown: 3,
      distance: 0,
      speed: 0,
      lateral: 0,
      elapsed: 0,
      collisions: 0,
      offroad: false,
      hit: 0,
      input: idleInput(),
    };
    this.resetTraffic();
  }
  setInput(v: DriveInput) {
    this.state.input = {
      steer: clamp(Number.isFinite(v.steer) ? v.steer : 0, -1, 1),
      throttle: clamp(Number.isFinite(v.throttle) ? v.throttle : 0, 0, 1),
      brake: clamp(Number.isFinite(v.brake) ? v.brake : 0, 0, 1),
    };
  }
  tick(dt: number) {
    const s = this.state;
    dt = clamp(dt, 0, 0.05);
    if (s.paused || s.phase === 'ready' || s.phase === 'finished') return;
    if (s.phase === 'countdown') {
      s.countdown -= dt;
      if (s.countdown <= 0) s.phase = 'racing';
      return;
    }
    s.elapsed += dt;
    s.hit = Math.max(0, s.hit - dt);
    const { steer, throttle, brake } = s.input;
    s.offroad = Math.abs(s.lateral) > 4.75;
    s.speed = clamp(
      s.speed +
        (throttle * (brake > 0 ? 0 : 13) -
          brake * 30 -
          1.8 -
          s.speed * 0.035 -
          (s.offroad ? 14 : 0)) *
          dt,
      0,
      62,
    );
    const curve = (roadSlope(s.distance + 2) - roadSlope(s.distance)) / 2;
    s.lateral = clamp(
      s.lateral +
        (steer * (1.4 + s.speed * 0.14) - curve * s.speed * s.speed * 0.21) *
          dt *
          (s.speed > 0 ? 1 : 0),
      -8,
      8,
    );
    s.distance += s.speed * dt;
    for (const car of this.traffic) {
      car.z += car.speed * dt;
      if (
        Math.abs(car.z - s.distance) < 3.8 &&
        Math.abs(car.lane - s.lateral) < 1.65 &&
        s.hit <= 0
      ) {
        s.speed *= 0.43;
        s.collisions++;
        s.hit = 1.2;
      }
    }
    if (s.distance >= TRACK_LENGTH) {
      s.distance = TRACK_LENGTH;
      s.phase = 'finished';
      s.speed = 0;
      s.input = idleInput();
    }
  }
}

// Gravity in device coordinates, from the W3C Z-X'-Y'' orientation matrix.
// https://www.w3.org/TR/orientation-event/#worked-example
export function gravityFromOrientation(beta: number, gamma: number) {
  const b = (beta * Math.PI) / 180,
    g = (gamma * Math.PI) / 180;
  return {
    x: -Math.cos(b) * Math.sin(g),
    y: Math.sin(b),
    z: Math.cos(b) * Math.cos(g),
  };
}
export type Gravity = ReturnType<typeof gravityFromOrientation>;
export function wheelPose(v: Gravity, side: number) {
  return {
    roll: (-Math.atan2(side * v.y, -side * v.x) * 180) / Math.PI,
    pitch: (Math.atan2(v.z, Math.hypot(v.x, v.y)) * 180) / Math.PI,
  };
}
const deltaAngle = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const dead = (n: number, zone: number, max: number) =>
  Math.sign(n) * clamp((Math.abs(n) - zone) / (max - zone), 0, 1);
export class WheelControl {
  baseline: { roll: number; pitch: number } | null = null;
  side = 1;
  output = idleInput();
  calibrate(v: Gravity) {
    if (!Object.values(v).every(Number.isFinite) || Math.abs(v.x) < 0.45)
      return false;
    this.side = v.x < 0 ? 1 : -1;
    this.baseline = wheelPose(v, this.side);
    this.output = idleInput();
    return true;
  }
  reset() {
    this.baseline = null;
    this.output = idleInput();
  }
  update(v: Gravity, dt: number) {
    if (!this.baseline || !Object.values(v).every(Number.isFinite))
      return idleInput();
    const pose = wheelPose(v, this.side),
      roll = deltaAngle(pose.roll, this.baseline.roll),
      pitch = pose.pitch - this.baseline.pitch;
    const pedal = dead(pitch, 4, 25),
      target = {
        steer: dead(roll, 3, 35),
        throttle: Math.max(0, pedal),
        brake: Math.max(0, -pedal),
      };
    const k = 1 - Math.exp(-clamp(dt, 0.001, 0.1) / 0.085);
    this.output = {
      steer: this.output.steer + (target.steer - this.output.steer) * k,
      throttle:
        this.output.throttle + (target.throttle - this.output.throttle) * k,
      brake: this.output.brake + (target.brake - this.output.brake) * k,
    };
    // Brake takes priority even during a transition from acceleration.
    if (target.brake > 0) this.output.throttle = 0;
    return { ...this.output };
  }
}
