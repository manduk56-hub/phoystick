export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export type DriveInput = { steer: number; throttle: number; brake: number };
export const idleInput = (): DriveInput => ({
  steer: 0,
  throttle: 0,
  brake: 0,
});
export const TRACK_LENGTH = 2400;
export const TOTAL_LAPS = 3;
export const RACE_DISTANCE = TRACK_LENGTH * TOTAL_LAPS;
// Sample by arc length so the closed circuit uses uniform metre coordinates.
const raw = Array.from({ length: 2049 }, (_, i) => {
  const t = (i / 2048) * Math.PI * 2;
  return { x: 270 * Math.cos(t) + 65 * Math.cos(3 * t), z: 390 * Math.sin(t) };
});
const lengths = [0];
for (let i = 1; i < raw.length; i++)
  lengths.push(
    lengths[i - 1] +
      Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z),
  );
const scale = TRACK_LENGTH / lengths[lengths.length - 1];
export function trackPoint(distance: number) {
  const d = (((distance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH) / scale;
  let lo = 0,
    hi = lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (lengths[mid] <= d) lo = mid;
    else hi = mid;
  }
  const f = (d - lengths[lo]) / (lengths[hi] - lengths[lo]);
  return {
    x: (raw[lo].x + (raw[hi].x - raw[lo].x) * f) * scale,
    z: (raw[lo].z + (raw[hi].z - raw[lo].z) * f) * scale,
  };
}
export function trackHeading(d: number) {
  const a = trackPoint(d - 1),
    b = trackPoint(d + 1);
  return Math.atan2(b.x - a.x, b.z - a.z);
}
export function trackCurve(d: number) {
  const a = trackHeading(d - 5),
    b = trackHeading(d + 5);
  return Math.atan2(Math.sin(b - a), Math.cos(b - a)) / 10;
}
export function localTrack(d: number, origin: number, lateral = 0) {
  const p = trackPoint(d),
    o = trackPoint(origin),
    h = trackHeading(origin),
    ph = trackHeading(d);
  const x = p.x + Math.cos(ph) * lateral - o.x,
    z = p.z - Math.sin(ph) * lateral - o.z;
  return {
    x: x * Math.cos(h) - z * Math.sin(h),
    z: -(x * Math.sin(h) + z * Math.cos(h)),
  };
}
export type Standing = {
  name: string;
  distance: number;
  player: boolean;
  time: number | null;
};
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
  lap: number;
  lapTime: number;
  lastLap: number | null;
  bestLap: number | null;
  lapTimes: number[];
  position: number;
  standings: Standing[];
  gear: number;
  rpm: number;
  cornerSpeed: number;
  lapValid: boolean;
  lastLapValid: boolean;
};
export type Traffic = {
  z: number;
  lane: number;
  speed: number;
  color: number;
  name?: string;
  finishTime?: number;
  skill?: number;
};
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
    lap: 1,
    lapTime: 0,
    lastLap: null,
    bestLap: null,
    lapTimes: [],
    position: 8,
    standings: [],
    gear: 1,
    rpm: 900,
    cornerSpeed: 250,
    lapValid: true,
    lastLapValid: true,
  };
  lapStarted = 0;
  traffic: Traffic[] = [];
  constructor() {
    this.resetTraffic();
    this.updateStandings();
  }
  resetTraffic() {
    this.traffic = Array.from({ length: 7 }, (_, i) => ({
      name: [
        'J. PARK',
        'M. ROSSI',
        'A. WEBER',
        'L. SILVA',
        'Y. KIM',
        'R. EVANS',
        'S. MARTIN',
      ][i],
      z: 14 + Math.floor((6 - i) / 2) * 11,
      lane: i % 2 ? -2 : 2,
      speed: 0,
      skill: 0.86 + i * 0.016,
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
      lap: 1,
      lapTime: 0,
      lastLap: null,
      bestLap: null,
      lapTimes: [],
      position: 8,
      standings: [],
      gear: 1,
      rpm: 900,
      cornerSpeed: 250,
      lapValid: true,
      lastLapValid: true,
    };
    this.lapStarted = 0;
    this.resetTraffic();
    this.updateStandings();
  }
  updateStandings() {
    const s = this.state;
    s.standings = [
      {
        name: 'YOU',
        distance: s.distance,
        player: true,
        time: s.phase === 'finished' ? s.elapsed : null,
      },
      ...this.traffic.map((c, i) => ({
        name: c.name || `DRIVER ${i + 1}`,
        distance: c.z,
        player: false,
        time: c.finishTime ?? null,
      })),
    ].sort((a, b) =>
      a.time !== null && b.time !== null
        ? a.time - b.time
        : a.time !== null
          ? -1
          : b.time !== null
            ? 1
            : b.distance - a.distance,
    );
    s.position = s.standings.findIndex((c) => c.player) + 1;
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
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    if (s.paused || s.phase === 'ready' || s.phase === 'finished') return;
    if (s.phase === 'countdown') {
      s.countdown -= dt;
      if (s.countdown <= 0) s.phase = 'racing';
      return;
    }
    const before = s.distance;
    s.elapsed += dt;
    s.hit = Math.max(0, s.hit - dt);
    const { steer, throttle, brake } = s.input;
    s.offroad = Math.abs(s.lateral) > 5.2;
    if (s.offroad) s.lapValid = false;
    s.cornerSpeed = Math.round(
      Math.min(
        70,
        Math.sqrt(8 / Math.max(Math.abs(trackCurve(s.distance + 65)), 0.0001)),
      ) * 3.6,
    );
    s.speed = clamp(
      s.speed +
        (throttle * (brake > 0 ? 0 : 13) -
          brake * 30 -
          1.8 -
          s.speed * s.speed * 0.0015 -
          (s.offroad ? 17 : 0)) *
          dt,
      0,
      72,
    );
    const curve = trackCurve(s.distance);
    const slip = Math.max(0, Math.abs(curve) * s.speed * s.speed - 9);
    s.lateral = clamp(
      s.lateral +
        (steer * (1.4 + s.speed * 0.14) - Math.sign(curve) * slip * 0.24) *
          dt *
          (s.speed > 0 ? 1 : 0),
      -8,
      8,
    );
    s.distance += s.speed * dt;
    for (const [i, car] of this.traffic.entries()) {
      if (car.finishTime !== undefined) continue;
      const target =
        Math.min(
          66,
          Math.sqrt(8 / Math.max(Math.abs(trackCurve(car.z + 65)), 0.0001)),
        ) * (car.skill ?? 0.9);
      car.speed = clamp(
        car.speed + clamp(target - car.speed, -28, 10) * dt,
        0,
        70,
      );
      let lane = Math.sin(car.z / 190 + i) * 1.1;
      const gap = s.distance - car.z;
      if (gap > 0 && gap < 22) lane = s.lateral > 0 ? -2.6 : 2.6;
      car.lane += clamp(lane - car.lane, -1.5, 1.5) * dt;
      for (const other of this.traffic)
        if (
          other !== car &&
          other.z - car.z > 0 &&
          other.z - car.z < 9 &&
          Math.abs(other.lane - car.lane) < 1.8
        )
          car.speed = Math.min(car.speed, other.speed);
      const previous = car.z;
      car.z += car.speed * dt;
      if (car.z >= RACE_DISTANCE) {
        car.finishTime =
          s.elapsed -
          dt +
          (RACE_DISTANCE - previous) / Math.max(car.speed, 0.001);
        car.z = RACE_DISTANCE;
      }
      const separation =
        ((((car.z - s.distance + TRACK_LENGTH / 2) % TRACK_LENGTH) +
          TRACK_LENGTH) %
          TRACK_LENGTH) -
        TRACK_LENGTH / 2;
      if (
        Math.abs(separation) < 3.8 &&
        Math.abs(car.lane - s.lateral) < 1.65 &&
        s.hit <= 0
      ) {
        s.speed *= 0.43;
        car.speed *= 0.75;
        s.collisions++;
        s.hit = 1.2;
      }
    }
    const boundary = (s.lapTimes.length + 1) * TRACK_LENGTH;
    if (s.distance >= boundary) {
      const crossing =
        s.elapsed -
        dt +
        dt *
          clamp(
            (boundary - before) / Math.max(s.distance - before, 0.001),
            0,
            1,
          );
      const lap = crossing - this.lapStarted;
      s.lastLap = lap;
      s.lapTimes = [...s.lapTimes, lap];
      s.lastLapValid = s.lapValid;
      if (s.lapValid)
        s.bestLap = s.bestLap === null ? lap : Math.min(s.bestLap, lap);
      this.lapStarted = crossing;
      s.lapValid = true;
      s.lap = Math.min(TOTAL_LAPS, s.lapTimes.length + 1);
      if (s.distance >= RACE_DISTANCE) {
        s.elapsed = crossing;
        s.distance = RACE_DISTANCE;
        s.phase = 'finished';
        s.speed = 0;
        s.input = idleInput();
      }
    }
    s.lapTime = s.elapsed - this.lapStarted;
    s.gear = Math.min(6, Math.floor(s.speed / 12) + 1);
    s.rpm = Math.round(1000 + ((s.speed % 12) / 12) * 6500);
    this.updateStandings();
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
