export type FishingPhase =
  | 'ready'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'fighting'
  | 'caught'
  | 'escaped';
export const phaseText: Record<FishingPhase, string> = {
  ready: '채비를 준비하세요',
  casting: '캐스팅',
  waiting: '찌를 지켜보세요',
  bite: '본입질 · 지금 챔질!',
  fighting: '물고기와 힘겨루기',
  caught: '포획 성공',
  escaped: '다시 도전하세요',
};
export const spots = [
  {
    name: '갈대 여울',
    depth: 2.4,
    distance: 24,
    description: '얕은 수초 지대 · 붕어와 로치',
    bottom: '진흙 · 수초',
  },
  {
    name: '자작나무 만',
    depth: 4.8,
    distance: 38,
    description: '완만한 모래 바닥 · 브림과 잉어',
    bottom: '모래 · 자갈',
  },
  {
    name: '북쪽 깊은 물',
    depth: 7.5,
    distance: 52,
    description: '차가운 수중 경사 · 송어와 농어',
    bottom: '암반 · 경사',
  },
];
export const baits = ['지렁이', '옥수수', '구더기', '스푼 루어'] as const;
export const rigs = ['찌낚시', '바닥낚시', '스피닝'] as const;
export const hooks = ['#12 · 소형', '#6 · 중형', '#1 · 대물'] as const;
export const leaders = [
  {
    name: '모노필라멘트',
    strength: 1,
    shock: 1,
    attraction: 1,
    detail: '균형 잡힌 강도와 탄성',
  },
  {
    name: '플루오로카본',
    strength: 0.9,
    shock: 1.05,
    attraction: 1.15,
    detail: '경계심 감소 · 매듭 강도 90%',
  },
  {
    name: '합사',
    strength: 1.2,
    shock: 1.3,
    attraction: 0.8,
    detail: '강도 120% · 충격과 경계심 증가',
  },
];
export const species = [
  {
    name: '붕어',
    latin: 'Carassius carassius',
    min: 0.15,
    max: 2.8,
    trophy: 1.8,
    depth: 1.7,
    spot: 0,
    bait: [1, 1.3, 1.1, 0],
    price: 12,
    force: 0.65,
    rig: 0,
  },
  {
    name: '로치',
    latin: 'Rutilus rutilus',
    min: 0.08,
    max: 1.5,
    trophy: 1,
    depth: 1,
    spot: 0,
    bait: [1, 0.4, 1.6, 0],
    price: 15,
    force: 0.55,
    rig: 0,
  },
  {
    name: '브림',
    latin: 'Abramis brama',
    min: 0.3,
    max: 5.5,
    trophy: 4,
    depth: 4,
    spot: 1,
    bait: [1.2, 0.8, 1.4, 0],
    price: 16,
    force: 0.8,
    rig: 1,
  },
  {
    name: '잉어',
    latin: 'Cyprinus carpio',
    min: 0.8,
    max: 12,
    trophy: 8,
    depth: 3.6,
    spot: 1,
    bait: [0.5, 1.8, 0.4, 0],
    price: 22,
    force: 1.1,
    rig: 1,
  },
  {
    name: '유럽농어',
    latin: 'Perca fluviatilis',
    min: 0.2,
    max: 3.2,
    trophy: 2,
    depth: 2.6,
    spot: 2,
    bait: [1.2, 0, 0.7, 1.5],
    price: 21,
    force: 1,
    rig: 2,
  },
  {
    name: '무지개송어',
    latin: 'Oncorhynchus mykiss',
    min: 0.5,
    max: 7,
    trophy: 5,
    depth: 3,
    spot: 2,
    bait: [0.8, 0, 0.6, 1.8],
    price: 30,
    force: 1.25,
    rig: 2,
  },
];
export const equipment = [
  {
    name: 'STARTER 300',
    rod: '3.0 m · 미디엄',
    line: 4,
    reel: 3,
    capacity: 80,
    cost: 0,
  },
  {
    name: 'RIVER PRO 360',
    rod: '3.6 m · 미디엄 헤비',
    line: 7,
    reel: 5.5,
    capacity: 120,
    cost: 180,
  },
  {
    name: 'DEEP WATER 390',
    rod: '3.9 m · 헤비',
    line: 12,
    reel: 9,
    capacity: 180,
    cost: 480,
  },
];
export type CatchRecord = {
  id: number;
  species: number;
  name: string;
  weight: number;
  length: number;
  trophy: boolean;
  value: number;
  spot: number;
  released: boolean;
};
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
  spot: number;
  bait: number;
  rig: number;
  hookSize: number;
  leader: number;
  depth: number;
  drag: number;
  speed: number;
  gear: number;
  owned: number[];
  silver: number;
  xp: number;
  condition: number;
  load: number;
  slipping: boolean;
  nibble: number;
  activity: number;
  hour: number;
  wind: number;
  temperature: number;
  weather: number;
  groundbait: number;
  fishId: number;
  length: number;
  trophy: boolean;
  journal: CatchRecord[];
  keepnet: CatchRecord[];
  revision: number;
};
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
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
    message: '지렁이 · 수심 1.5 m로 첫 캐스팅을 해보세요.',
    turns: 0,
    time: 0,
    spot: 0,
    bait: 0,
    rig: 0,
    hookSize: 0,
    leader: 0,
    depth: 1.5,
    drag: 0.55,
    speed: 0.5,
    gear: 0,
    owned: [0],
    silver: 40,
    xp: 0,
    condition: 1,
    load: 0,
    slipping: false,
    nibble: 0,
    activity: 1,
    hour: 6.5,
    wind: 1.8,
    temperature: 14,
    weather: 0,
    groundbait: 0,
    fishId: 0,
    length: 0,
    trophy: false,
    journal: [],
    keepnet: [],
    revision: 0,
  };
  wait = 4;
  slack = 0;
  cooldown = 0;
  lastReel = 0;
  private random: () => number;
  private retrieve = 0;
  private lastRetrieve = -10;
  constructor(random: () => number = Math.random) {
    this.random = random;
  }
  get idle() {
    return ['ready', 'caught', 'escaped'].includes(this.state.phase);
  }
  get lineStrength() {
    return (
      equipment[this.state.gear].line *
      leaders[this.state.leader].strength *
      (0.6 + this.state.condition * 0.4)
    );
  }
  phase(phase: FishingPhase, message: string) {
    Object.assign(this.state, { phase, phaseTime: 0, message });
  }
  suitability(id: number) {
    const s = this.state,
      f = species[id];
    const depth = s.rig === 1 ? spots[s.spot].depth : s.depth;
    const dawn = (s.hour >= 5 && s.hour <= 9) || (s.hour >= 17 && s.hour <= 21);
    return (
      f.bait[s.bait] *
      leaders[s.leader].attraction *
      (s.hookSize === 2 && f.max < 3.5 ? 0.25 : s.hookSize === 1 ? 0.85 : 1) *
      (s.spot === f.spot ? 2.2 : 0.35) *
      Math.max(0.12, 1 - Math.abs(depth - f.depth) / 6) *
      (s.rig === f.rig ? 1.4 : 0.65) *
      (dawn ? 1.2 : 0.75) *
      (s.weather === 1 ? 1.1 : 0.9)
    );
  }
  configure(key: string, value: number) {
    const s = this.state;
    if (!Number.isFinite(value) || s.paused) return;
    if (key === 'drag') {
      s.drag = clamp(value, 0.1, 1);
      s.revision++;
      return;
    }
    if (key === 'speed') {
      s.speed = clamp(value, 0.1, 1);
      s.revision++;
      return;
    }
    if (key === 'rod') {
      const next = clamp(value, 0, 1),
        lift = Math.max(0, next - s.rod);
      if (s.phase === 'fighting' && lift > 0) {
        s.tension += lift * 0.13 * leaders[s.leader].shock;
        s.distance = Math.max(0, s.distance - lift * (s.slipping ? 0.1 : 0.8));
        s.stamina = Math.max(0, s.stamina - lift * 0.008);
        if (s.tension >= 1)
          this.lose(
            '급하게 낚싯대를 들어 줄이 끊어졌습니다. 낮추며 천천히 감으세요.',
          );
      }
      s.rod = next;
      return;
    }
    if (!this.idle) {
      s.message = '채비를 바꾸려면 먼저 회수하세요.';
      return;
    }
    if (key === 'hookSize') s.hookSize = clamp(Math.round(value), 0, 2);
    if (key === 'leader') s.leader = clamp(Math.round(value), 0, 2);
    if (key === 'spot') {
      const next = clamp(Math.round(value), 0, 2);
      if (s.spot !== next) s.groundbait = 0;
      s.spot = next;
      s.depth = Math.min(s.depth, spots[s.spot].depth);
    }
    if (key === 'bait') {
      s.bait = clamp(Math.round(value), 0, 3);
      if (s.bait === 3) s.rig = 2;
      else if (s.rig === 2) s.rig = 0;
    }
    if (key === 'rig') {
      s.rig = clamp(Math.round(value), 0, 2);
      if (s.rig === 2) s.bait = 3;
      else if (s.bait === 3) s.bait = 0;
    }
    if (key === 'depth') s.depth = clamp(value, 0.3, spots[s.spot].depth);
    if (key === 'gear' && s.owned.includes(value)) s.gear = value;
    s.revision++;
  }
  cast(power = 0.5) {
    const s = this.state;
    if (s.paused || !this.idle) return;
    if (s.keepnet.length >= 20) {
      s.message =
        '살림망이 가득 찼습니다. 판매하거나 마지막 어획을 방생하세요.';
      return;
    }
    s.power = clamp(Number.isFinite(power) ? power : 0.5, 0.15, 1);
    s.castDistance = 8 + s.power * (spots[s.spot].distance + s.gear * 8);
    Object.assign(s, {
      distance: 0,
      tension: 0,
      load: 0,
      stamina: 1,
      turns: 0,
      pulling: false,
      slipping: false,
      nibble: 0,
      fishName: '',
      weight: 0,
    });
    this.slack = 0;
    this.retrieve = 0;
    this.lastRetrieve = -10;
    const weights = species.map((_, i) => this.suitability(i));
    const sum = weights.reduce((a, b) => a + b, 0);
    let choice = this.random() * sum;
    s.fishId = weights.findIndex((w) => (choice -= w) <= 0);
    if (s.fishId < 0) s.fishId = 0;
    s.activity = clamp(sum / 7, 0.15, 1);
    this.wait =
      ((8 + this.random() * 12) / (0.5 + s.activity)) *
      (s.groundbait > 0 ? 0.65 : 1);
    const f = species[s.fishId];
    s.weight =
      Math.round(
        (f.min +
          Math.pow(this.random(), 2.3 - s.hookSize * 0.55) * (f.max - f.min)) *
          100,
      ) / 100;
    s.length = Math.round(14 + Math.cbrt(s.weight) * 23);
    s.trophy = s.weight >= f.trophy;
    this.phase('casting', '낚싯줄이 풀립니다. 착수 후 입질을 기다리세요.');
  }
  hook() {
    const s = this.state;
    if (s.paused) return;
    if (s.phase === 'bite') {
      s.tension = 0.3;
      s.load = s.tension * this.lineStrength;
      this.lastReel = s.elapsed;
      this.slack = 0;
      this.phase('fighting', '걸렸습니다! 드랙을 조절하며 줄을 감으세요.');
    } else if (s.phase === 'waiting') {
      this.phase(
        'escaped',
        '예신에 너무 일찍 챔질했습니다. 찌가 깊이 잠길 때 챔질하세요.',
      );
    }
  }
  reel(turns = 0.25) {
    const s = this.state;
    if (s.paused || !Number.isFinite(turns)) return;
    const n = clamp(turns, 0, 1) * (0.45 + s.speed * 1.1);
    if (s.phase === 'waiting' && s.rig === 2) {
      this.retrieve += n;
      this.lastRetrieve = s.elapsed;
      s.turns += n;
      s.distance = Math.max(0, s.distance - n * 0.85);
      if (s.distance <= 1.4)
        this.phase(
          'ready',
          '루어를 회수했습니다. 다른 수심이나 속도로 다시 던져보세요.',
        );
      return;
    }
    if (s.phase !== 'fighting') return;
    s.turns += n;
    const f = species[s.fishId];
    s.tension +=
      n *
      leaders[s.leader].shock *
      (s.pulling ? 0.22 : 0.13) *
      (0.8 + ((s.weight * f.force) / this.lineStrength) * 0.3);
    s.distance = Math.max(
      0,
      s.distance - n * (1.3 + (1 - s.stamina)) * (s.slipping ? 0.15 : 1),
    );
    s.stamina = Math.max(0, s.stamina - (n * 0.025) / (0.8 + s.weight * 0.08));
    s.load = s.tension * this.lineStrength;
    this.lastReel = s.elapsed;
    if (s.tension >= 1)
      this.lose(
        '과도한 장력으로 줄이 끊어졌습니다. 드랙을 풀고 천천히 감으세요.',
      );
    else if (s.distance <= 1.4 && s.stamina < 0.25) this.land();
    else if (s.distance <= 1.4)
      s.message = '가까이 왔습니다. 지칠 때까지 장력을 유지하세요.';
  }
  private land() {
    const s = this.state,
      f = species[s.fishId];
    s.fishName = f.name;
    s.catches++;
    s.totalWeight = Math.round((s.totalWeight + s.weight) * 100) / 100;
    const record: CatchRecord = {
      id: s.catches,
      species: s.fishId,
      name: f.name,
      weight: s.weight,
      length: s.length,
      trophy: s.trophy,
      value: Math.max(2, Math.round(s.weight * f.price * (s.trophy ? 1.6 : 1))),
      spot: s.spot,
      released: false,
    };
    s.journal = [record, ...s.journal].slice(0, 60);
    s.keepnet = [...s.keepnet, record];
    s.xp += Math.round(12 + s.weight * 8);
    s.condition = Math.max(0.1, s.condition - 0.008 - s.weight * 0.002);
    s.revision++;
    this.phase(
      'caught',
      `${s.trophy ? '트로피! ' : ''}${f.name} · ${s.weight.toFixed(2)} kg · ${s.length} cm`,
    );
  }
  private lose(message: string) {
    this.state.condition = Math.max(0.1, this.state.condition - 0.02);
    this.state.revision++;
    this.phase('escaped', message);
  }
  flick() {
    if (this.state.paused || this.state.elapsed < this.cooldown) return;
    this.cooldown = this.state.elapsed + 0.5;
    if (this.state.phase === 'bite') this.hook();
    else if (this.state.phase === 'fighting') this.reel(0.5);
  }
  pause() {
    this.state.paused = !this.state.paused;
  }
  recall() {
    if (this.state.paused || this.idle) return;
    this.state.tension = 0;
    this.state.distance = 0;
    this.phase(
      'ready',
      '채비를 회수했습니다. 포인트와 미끼를 바꿀 수 있습니다.',
    );
  }
  feed() {
    const s = this.state;
    if (s.paused || !this.idle || s.silver < 5) return;
    s.silver -= 5;
    s.groundbait = 180;
    s.revision++;
    s.message = '밑밥을 투척했습니다. 3분 동안 입질 간격이 짧아집니다.';
  }
  sell() {
    const s = this.state;
    if (s.paused || !this.idle) return;
    const value = s.keepnet.reduce((n, f) => n + f.value, 0);
    s.silver += value;
    s.keepnet = [];
    s.revision++;
    s.message = `어획을 판매해 ${value} 실버를 받았습니다.`;
  }
  release() {
    const s = this.state;
    if (
      s.paused ||
      s.phase !== 'caught' ||
      !s.keepnet.some((f) => f.id === s.catches)
    )
      return;
    s.keepnet = s.keepnet.filter((f) => f.id !== s.catches);
    s.journal = s.journal.map((f) =>
      f.id === s.catches ? { ...f, released: true } : f,
    );
    s.xp += 5;
    s.revision++;
    s.message = '건강하게 방생했습니다. 경험치 +5';
  }
  buy(id: number) {
    const s = this.state,
      item = equipment[id];
    if (s.paused || !this.idle || !item) return;
    if (!s.owned.includes(id)) {
      if (s.silver < item.cost) {
        s.message = '실버가 부족합니다. 어획을 판매해 보세요.';
        return;
      }
      s.silver -= item.cost;
      s.owned = [...s.owned, id];
    }
    s.gear = id;
    s.revision++;
    s.message = `${item.name} 장착 완료`;
  }
  repair() {
    const s = this.state;
    if (s.paused || !this.idle || s.silver < 8) return;
    s.silver -= 8;
    s.condition = 1;
    s.revision++;
    s.message = '낚싯줄과 채비를 정비했습니다.';
  }
  save() {
    const s = this.state;
    return JSON.stringify({
      version: 1,
      silver: s.silver,
      xp: s.xp,
      catches: s.catches,
      totalWeight: s.totalWeight,
      condition: s.condition,
      owned: s.owned,
      gear: s.gear,
      journal: s.journal,
      keepnet: s.keepnet,
      settings: {
        hookSize: s.hookSize,
        leader: s.leader,
        spot: s.spot,
        bait: s.bait,
        rig: s.rig,
        depth: s.depth,
        drag: s.drag,
        speed: s.speed,
      },
    });
  }
  restore(raw: string) {
    try {
      const p = JSON.parse(raw);
      if (
        p.version !== 1 ||
        !['silver', 'xp', 'catches', 'totalWeight', 'condition', 'gear'].every(
          (k) => Number.isFinite(p[k]) && p[k] >= 0,
        ) ||
        !Array.isArray(p.owned) ||
        !p.owned.includes(0) ||
        p.owned.some((id: number) => !Number.isInteger(id) || !equipment[id]) ||
        !p.owned.includes(p.gear)
      )
        return;
      const valid = (f: CatchRecord) =>
        f &&
        Number.isInteger(f.id) &&
        Number.isInteger(f.species) &&
        species[f.species] &&
        Number.isFinite(f.weight) &&
        f.weight > 0 &&
        Number.isFinite(f.value) &&
        f.value >= 0 &&
        Number.isFinite(f.length) &&
        Number.isInteger(f.spot) &&
        spots[f.spot] &&
        typeof f.name === 'string' &&
        typeof f.released === 'boolean';
      if (
        !Array.isArray(p.journal) ||
        !Array.isArray(p.keepnet) ||
        !p.journal.every(valid) ||
        !p.keepnet.every(valid)
      )
        return;
      for (const k of [
        'silver',
        'xp',
        'catches',
        'totalWeight',
        'condition',
        'gear',
        'owned',
        'journal',
        'keepnet',
      ] as const)
        Object.assign(this.state, { [k]: p[k] });
      this.state.condition = clamp(p.condition, 0.1, 1);
      this.state.journal = p.journal.slice(0, 60);
      this.state.keepnet = p.keepnet.slice(0, 20);
      if (p.settings && typeof p.settings === 'object')
        for (const key of [
          'spot',
          'bait',
          'rig',
          'depth',
          'drag',
          'speed',
          'hookSize',
          'leader',
        ])
          this.configure(key, p.settings[key]);
    } catch {
      /* Invalid or old saves start a fresh session. */
    }
  }
  tick(dt: number) {
    const s = this.state;
    if (s.paused || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    s.elapsed += dt;
    s.phaseTime += dt;
    s.hour = (6.5 + s.elapsed / 60) % 24;
    s.weather = Math.floor(s.elapsed / 240) % 3;
    s.wind = 1.8 + Math.sin(s.elapsed / 60) * 1.2 + s.weather;
    s.temperature = 12 + Math.sin(((s.hour - 6) / 24) * Math.PI * 2) * 6;
    s.groundbait = Math.max(0, s.groundbait - dt);
    if (s.phase === 'casting') {
      s.distance = s.castDistance * Math.min(1, s.phaseTime / 1.35);
      if (s.phaseTime >= 1.35)
        this.phase(
          'waiting',
          s.rig === 2
            ? '릴을 감아 루어를 움직이세요. 멈춤과 감기를 번갈아 해보세요.'
            : '가벼운 예신 뒤 찌가 깊이 잠길 때 챔질하세요.',
        );
    } else if (s.phase === 'waiting') {
      const progress = s.phaseTime / this.wait;
      s.nibble =
        progress > 0.55 ? Math.max(0, Math.sin(s.phaseTime * 5)) * 0.7 : 0;
      if (
        s.phaseTime >= this.wait &&
        (s.rig !== 2 ||
          (this.retrieve >= 1.5 && s.elapsed - this.lastRetrieve < 2))
      ) {
        s.nibble = 1;
        this.phase(
          'bite',
          s.rig === 0
            ? '찌가 잠겼습니다! SPACE 또는 챔질 버튼'
            : s.rig === 1
              ? '초릿대가 크게 휘어집니다! 지금 챔질하세요.'
              : '루어를 물었습니다! 지금 챔질하세요.',
        );
      }
    } else if (s.phase === 'bite' && s.phaseTime > (s.rig === 1 ? 3.4 : 2.5))
      this.phase('escaped', '챔질 타이밍을 놓쳤습니다.');
    else if (s.phase === 'fighting') {
      const f = species[s.fishId],
        gear = equipment[s.gear];
      s.pulling =
        Math.sin(s.phaseTime * (0.75 + f.force * 0.3) + s.fishId) > 0.35 &&
        s.stamina > 0.12;
      const force =
        s.weight *
        f.force *
        (0.25 + s.stamina * 0.8) *
        (s.pulling ? 1.25 : 0.35);
      const brake = gear.reel * s.drag;
      s.slipping = s.pulling && force > brake;
      s.tension = Math.max(0.025, s.tension - dt * (s.pulling ? 0.025 : 0.085));
      if (s.pulling) {
        s.distance += dt * (s.slipping ? 0.7 + (force - brake) * 0.45 : 0.15);
        s.tension +=
          ((dt * Math.min(force, brake)) / this.lineStrength) *
          (0.14 + s.rod * 0.12);
      }
      if (s.slipping) s.tension = Math.max(0.08, s.tension - dt * 0.16);
      s.stamina = Math.max(
        0,
        s.stamina -
          (dt * (0.006 + s.tension * 0.022)) / (0.8 + s.weight * 0.08),
      );
      s.load = s.tension * this.lineStrength;
      if (s.tension < 0.09) this.slack += dt;
      else this.slack = 0;
      if (s.tension >= 1) this.lose('줄이 끊어졌습니다. 드랙을 낮추세요.');
      else if (s.distance >= gear.capacity)
        this.lose('스풀의 줄이 모두 풀렸습니다. 더 강한 채비가 필요합니다.');
      else if (this.slack > 4) this.lose('줄이 느슨해져 바늘이 빠졌습니다.');
      else if (s.distance <= 1.4 && s.stamina < 0.25) this.land();
      else
        s.message =
          s.tension > 0.8
            ? '장력 위험 · 감기를 멈추고 드랙을 낮추세요.'
            : s.slipping
              ? '드랙이 풀립니다 · 물고기가 지칠 때까지 천천히 감으세요.'
              : s.tension < 0.16
                ? '줄이 느슨합니다 · 릴을 감으세요.'
                : s.pulling
                  ? '물고기가 돌진합니다 · 천천히 감으세요.'
                  : s.distance < 2
                    ? '뜰채 거리 · 장력을 유지하며 지치게 하세요.'
                    : '지금 릴을 감아 거리를 좁히세요.';
    }
  }
}
