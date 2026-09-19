export type FishingPhase =
  | 'ready'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'fighting'
  | 'caught'
  | 'escaped';
export type FishingState = {
  game: 'fishing';
  phase: FishingPhase;
  paused: boolean;
  distance: number;
  castDistance: number;
  tension: number;
  stamina: number;
  power: number;
  elapsed: number;
  phaseTime: number;
  rod: number;
  pulling: boolean;
  catches: number;
  totalWeight: number;
  fishName: string;
  weight: number;
  message: string;
  turns: number;
  time: number;
};
export const phaseText: Record<FishingPhase, string> = {
  ready: '캐스팅 준비',
  casting: '찌가 날아갑니다',
  waiting: '입질을 기다리세요',
  bite: '입질! 지금 챔질!',
  fighting: '줄을 감아 끌어올리세요',
  caught: '낚아 올렸습니다!',
  escaped: '물고기가 달아났습니다',
};
export class FishingModel {
  state: FishingState = {
    game: 'fishing',
    phase: 'ready',
    paused: false,
    distance: 0,
    castDistance: 0,
    tension: 0,
    stamina: 1,
    power: 0.5,
    elapsed: 0,
    phaseTime: 0,
    rod: 0.5,
    pulling: false,
    catches: 0,
    totalWeight: 0,
    fishName: '',
    weight: 0,
    message: '뒤로 준비한 뒤 앞으로 휘두르세요.',
    turns: 0,
    time: 0,
  };
  wait = 4;
  lastReel = 0;
  slack = 0;
  cooldown = 0;
  private random: () => number;
  constructor(random: () => number = Math.random) {
    this.random = random;
  }
  phase(phase: FishingPhase, message: string) {
    this.state.phase = phase;
    this.state.phaseTime = 0;
    this.state.message = message;
  }
  cast(power = 0.5) {
    if (
      this.state.paused ||
      !['ready', 'caught', 'escaped'].includes(this.state.phase)
    )
      return;
    const s = this.state;
    s.power = Math.max(0.15, Math.min(1, Number.isFinite(power) ? power : 0.5));
    s.distance = 0;
    s.castDistance = 12 + s.power * 24;
    s.tension = 0;
    s.stamina = 1;
    s.turns = 0;
    s.pulling = false;
    this.wait = 3 + this.random() * 4;
    s.fishName = ['무지개송어', '큰입배스', '황금잉어'][
      Math.min(2, Math.floor(this.random() * 3))
    ];
    s.weight =
      Math.round((0.5 + this.random() * 2 + s.power * 1.8) * 100) / 100;
    this.phase('casting', '낚싯줄이 풀리고 있습니다.');
  }
  hook() {
    if (this.state.paused) return;
    if (this.state.phase === 'bite') {
      this.state.tension = 0.36;
      this.lastReel = this.state.elapsed;
      this.slack = 0;
      this.phase('fighting', '걸렸습니다! 릴을 돌려 줄을 감으세요.');
    } else if (this.state.phase === 'waiting')
      this.state.message = '찌가 깊게 잠길 때까지 기다리세요.';
  }
  reel(turns = 0.25) {
    const s = this.state;
    if (s.paused || s.phase !== 'fighting' || !Number.isFinite(turns)) return;
    const n = Math.max(0, Math.min(turns, 1));
    s.turns += n;
    s.distance = Math.max(0, s.distance - n * (1.45 + (1 - s.stamina) * 0.8));
    s.tension = Math.min(1.1, s.tension + n * (s.pulling ? 0.22 : 0.13));
    s.stamina = Math.max(0, s.stamina - n * 0.018);
    this.lastReel = s.elapsed;
    if (s.tension >= 1)
      this.phase('escaped', '너무 세게 감아 줄이 끊어졌습니다.');
    else if (s.distance <= 0.8) {
      s.catches++;
      s.totalWeight = Math.round((s.totalWeight + s.weight) * 100) / 100;
      this.phase('caught', `${s.fishName} · ${s.weight.toFixed(2)} kg`);
    }
  }
  flick() {
    if (this.state.paused || this.state.elapsed < this.cooldown) return;
    this.cooldown = this.state.elapsed + 0.45;
    if (this.state.phase === 'bite') this.hook();
    else if (this.state.phase === 'fighting') this.reel(0.65);
  }
  pause() {
    this.state.paused = !this.state.paused;
  }
  tick(dt: number) {
    const s = this.state;
    if (s.paused) return;
    s.elapsed += dt;
    s.phaseTime += dt;
    if (s.phase === 'casting') {
      s.distance = s.castDistance * Math.min(1, s.phaseTime / 1.35);
      if (s.phaseTime >= 1.35)
        this.phase('waiting', '찌를 지켜보세요. 잠기면 폰을 위로 튕기세요.');
    } else if (s.phase === 'waiting' && s.phaseTime >= this.wait)
      this.phase('bite', '지금 폰을 위로 튕기거나 챔질 버튼을 누르세요!');
    else if (s.phase === 'bite' && s.phaseTime > 2.5)
      this.phase('escaped', '챔질 타이밍을 놓쳤습니다. 다시 던져보세요.');
    else if (s.phase === 'fighting') {
      s.pulling = Math.sin(s.phaseTime * 1.1) > 0.55;
      s.tension = Math.max(0.03, s.tension - dt * (s.pulling ? 0.035 : 0.1));
      s.stamina = Math.max(0, s.stamina - dt * 0.004);
      if (s.pulling) {
        s.distance = Math.min(
          s.castDistance + 8,
          s.distance + dt * (0.45 + s.stamina * 0.65),
        );
        s.tension = Math.min(1.1, s.tension + dt * 0.012);
      }
      if (s.tension < 0.09) this.slack += dt;
      else this.slack = 0;
      if (this.slack > 3.5)
        this.phase('escaped', '줄이 너무 느슨해져 물고기가 빠져나갔습니다.');
      else
        s.message =
          s.tension > 0.8
            ? '장력이 높습니다. 잠깐 릴을 멈추세요.'
            : s.pulling
              ? '물고기가 버팁니다. 천천히 감으세요.'
              : s.tension < 0.16
                ? '줄이 느슨합니다. 릴을 감으세요.'
                : '지금 릴을 감아 거리를 좁히세요.';
    }
  }
}
// Rotation about the phone's width axis. A deliberate backswing must precede release.
export class CastGesture {
  stage: 'idle' | 'back' | 'armed' = 'idle';
  travel = 0;
  forward = 0;
  started = 0;
  last = 0;
  cooldown = 0;
  reset() {
    this.stage = 'idle';
    this.travel = 0;
    this.forward = 0;
    this.started = 0;
    this.last = 0;
  }
  update(rate: number, now: number): { cast: number | null; stage: string } {
    if (!Number.isFinite(rate)) return { cast: null, stage: this.stage };
    const dt = this.last
      ? Math.max(0, Math.min(0.05, (now - this.last) / 1000))
      : 0.016;
    this.last = now;
    if (now < this.cooldown) return { cast: null, stage: 'idle' };
    if (this.stage !== 'idle' && now - this.started > 3500) {
      this.reset();
      this.last = now;
    }
    if (this.stage === 'idle' && rate > 30) {
      this.stage = 'back';
      this.started = now;
      this.travel = 0;
    }
    if (this.stage === 'back') {
      if (rate > 10) this.travel += rate * dt;
      if (this.travel >= 38) this.stage = 'armed';
      else if (rate < -70) {
        this.reset();
        this.last = now;
      }
    }
    if (this.stage === 'armed') {
      if (rate < -50) this.forward += -rate * dt;
      if (rate < -130 && this.forward > 15) {
        const power = Math.max(0.15, Math.min(1, (-rate - 80) / 350));
        this.reset();
        this.last = now;
        this.cooldown = now + 1600;
        return { cast: power, stage: 'idle' };
      }
    }
    return { cast: null, stage: this.stage };
  }
}
export function reelDelta(previous: number, current: number) {
  let delta = current - previous;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return Math.abs(delta) > 0.8 ? 0 : Math.max(0, delta) / (2 * Math.PI);
}
