import * as T from 'three';
import { BARRIERS, ROUTE_LENGTH, SECTORS, canStand, sectorAt } from './campaign.ts';
import {
  gameModel,
  fitModel,
  disposeModel,
  cinematicLight,
  scannedMaterial,
  assetNotice,
} from './graphics-assets.ts';
import { rounded, finish, organic } from './surface.ts';
import { RELOAD_SECONDS, reloadPose } from './reload-motion.ts';
export type HUD = {
  health: number;
  ammo: number;
  chamber: boolean;
  reload: number;
  score: number;
  kills: number;
  wave: number;
  state: string;
  hit: string;
  distance?: number;
  objective?: string;
  extraction?: number;
  autoMove?: boolean;
  reloadMotion?: number;
  reloadProgress?: number;
};
type Enemy = {
  group: T.Group;
  head: T.Mesh;
  parts: T.Mesh[];
  hp: number;
  speed: number;
  phase: number;
  attack?: number;
  mixer?: T.AnimationMixer;
  headBone?: T.Object3D;
  gait?: T.Object3D[];
};
export class Game {
  canvas: HTMLCanvasElement;
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, 1, 0.1, 150);
  enemies: Enemy[] = [];
  ray = new T.Raycaster();
  aim = { x: 0.5, y: 0.5 };
  hud: HUD = {
    health: 100,
    ammo: 11,
    chamber: true,
    reload: 0,
    score: 0,
    kills: 0,
    wave: 1,
    state: 'ready',
    hit: '',
  };
  notify: (h: HUD) => void;
  frame = 0;
  last = 0;
  spawn = 0;
  flash = 0;
  damage = 0;
  slide: T.Mesh;
  mag: T.Mesh;
  gun = new T.Group();
  supportHand = new T.Group();
  light: T.PointLight;
  lastShot = 0;
  audio: AudioContext | null = null;
  resize: ResizeObserver;
  disposed = false;
  elapsed = 0;
  emitTime = 0;
  headshots = 0;
  keys = new Set<string>();
  checkpoints = new Set<number>();
  cover: T.Mesh[] = [];
  extraction = 0;
  releaseLook: () => void = () => {};
  modelNotice?: ReturnType<typeof assetNotice>;
  casings: { mesh: T.Mesh; velocity: T.Vector3; life: number }[] = [];
  onShot: (hit: boolean) => void = () => {};
  constructor(canvas: HTMLCanvasElement, notify: (h: HUD) => void) {
    this.canvas = canvas;
    this.notify = notify;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setClearColor(0x102129, 1);
    this.releaseLook = cinematicLight(this.renderer, this.scene, 1.05);
    this.modelNotice = assetNotice(canvas, '몬스터 모델');
    gameModel('yeti')
      .then((m) => {
        disposeModel(m.scene);
        this.modelNotice?.done();
      })
      .catch(() => this.modelNotice?.fail());
    this.scene.fog = new T.FogExp2(0x102129, 0.012);
    this.camera.position.set(0, 1.7, 7);
    this.camera.lookAt(0, 1.5, -20);
    this.scene.add(new T.HemisphereLight(0xa5d9e8, 0x19212a, 2));
    const key = new T.DirectionalLight(0xc3e4dd, 3);
    key.position.set(-4, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -15,
      right: 15,
      top: 15,
      bottom: -15,
      near: 0.5,
      far: 65,
    });
    key.shadow.bias = -0.0003;
    this.scene.add(key);
    const rim = new T.DirectionalLight(0xffe0a3, 2.4);
    rim.position.set(2, 5, -25);
    this.scene.add(rim);
    const orange = new T.PointLight(0xff9455, 40, 28);
    orange.position.set(6, 3, -9);
    this.scene.add(orange);
    const floor = new T.Mesh(
      new T.PlaneGeometry(100, 320),
      scannedMaterial('concrete_floor_02', 18),
    );
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -120;
    this.scene.add(floor);
    const grid = new T.GridHelper(100, 40, 0x567367, 0x273b3f);
    grid.position.y = 0.015;
    grid.position.z = -25;
    grid.visible = false;
    this.scene.add(grid);
    for (const side of [-1, 1])
      for (let z = 10; z > -260; z -= 10) {
        const pillar = this.box(0.5, 6, 0.6, 0x26383e);
        pillar.position.set(side * 8, 3, z);
        this.scene.add(pillar);
        const lamp = this.box(0.07, 1.6, 0.1, 0xccebb7);
        (lamp.material as T.MeshStandardMaterial).emissive.setHex(0x92b955);
        lamp.position.set(side * 7.7, 3.5, z + 0.4);
        this.scene.add(lamp);
      }
    this.buildRoute();
    this.slide = this.box(0.17, 0.14, 0.55, 0x596269);
    this.slide.position.set(0, 0.09, -0.12);
    this.gun.add(this.slide);
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const groove = this.box(0.006, 0.105, 0.007, 0x222b30);
        groove.position.set(side * 0.086, 0, 0.08 - i * 0.019);
        this.slide.add(groove);
      }
    const port = this.box(0.067, 0.008, 0.105, 0x101619);
    port.position.set(0.04, 0.073, -0.015);
    this.slide.add(port);
    const barrel = new T.Mesh(
      new T.CylinderGeometry(0.032, 0.032, 0.45, 32, 1, true),
      new T.MeshStandardMaterial({
        color: 0x303840,
        metalness: 0.9,
        roughness: 0.25,
        side: T.DoubleSide,
      }),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.066, -0.19);
    this.gun.add(barrel);
    const guard = new T.Mesh(
      new T.TorusGeometry(0.072, 0.012, 12, 32, Math.PI * 1.7),
      finish(0x273039),
    );
    guard.rotation.y = Math.PI / 2;
    guard.position.set(0, -0.075, -0.07);
    this.gun.add(guard);
    const trigger = this.box(0.025, 0.08, 0.018, 0x899196);
    trigger.rotation.x = 0.3;
    trigger.position.set(0, -0.055, -0.046);
    this.gun.add(trigger);
    const frame = this.box(0.16, 0.09, 0.5, 0x272e31);
    frame.position.z = -0.08;
    this.gun.add(frame);
    const grip = this.box(0.14, 0.3, 0.15, 0x151b1d);
    grip.rotation.x = -0.18;
    grip.position.set(0, -0.16, 0.08);
    this.gun.add(grip);
    this.mag = this.box(0.115, 0.23, 0.12, 0x697474);
    this.mag.position.set(0, -0.2, 0.075);
    this.gun.add(this.mag);
    const sight = this.box(0.045, 0.04, 0.055, 0xd9fd62);
    sight.position.set(0, 0.18, -0.35);
    this.gun.add(sight);
    const palm = this.box(0.17, 0.13, 0.17, 0x596269);
    this.supportHand.add(palm);
    const wrist = this.box(0.13, 0.27, 0.13, 0x29383f);
    wrist.position.y = -0.15;
    this.supportHand.add(wrist);
    for (let i = 0; i < 3; i++) {
      const finger = this.box(0.04, 0.05, 0.15, 0x85918b);
      finger.position.set(-0.07 + i * 0.055, 0.07, -0.035);
      this.supportHand.add(finger);
    }
    this.gun.add(this.supportHand);
    this.gun.position.set(0.29, -0.3, -0.8);
    this.camera.add(this.gun);
    this.scene.add(this.camera);
    this.light = new T.PointLight(0xffce6a, 0, 9);
    this.light.position.set(0.3, -0.2, -1.3);
    this.camera.add(this.light);
    this.resize = new ResizeObserver(() => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (w && h) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
    });
    this.resize.observe(canvas);
    this.frame = requestAnimationFrame((t) => this.tick(t));
    this.emit();
  }
  box(w: number, h: number, d: number, c: number) {
    return new T.Mesh(rounded(w, h, d), finish(c, 'metal'));
  }
  buildRoute() {
    const place = (w: number, h: number, d: number, color: number, x: number, z: number, y = h / 2) => {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({color, roughness:0.92, metalness:0.05}));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };
    for (let z = 4; z > -245; z -= 12) {
      const sector = sectorAt(7 - z);
      for (const side of [-1, 1]) {
        place(2, 0.3, 12, 0x454d4d, side * 8, z);
        place(8, sector === 2 ? 7 : 9 + (Math.abs(z) % 3), 10, [0x354951, 0x4b4540, 0x27353a, 0x344c49][sector], side * 13, z);
        if (sector !== 2) for (let row = 0; row < 2; row++) {
          const window = place(0.05, 1.2, 2, 0x8c9e8a, side * 8.96, z, 3 + row * 2.5);
          (window.material as T.MeshStandardMaterial).emissive.setHex(0x31452f);
        }
      }
      place(0.15, 0.02, 4, 0xbcb084, 0, z, 0.025);
      if (sector === 2) place(19, 0.5, 12, 0x26353a, 0, z, 7);
    }
    for (const b of BARRIERS) this.cover.push(place(b.width, 1.1, b.depth, 0x806442, b.x, b.z));
    for (const distance of [60, 120, 180, 240]) {
      const z = 7 - distance;
      for (const side of [-1, 1]) place(0.35, 4.5, 0.35, 0xa8c66c, side * 7, z);
      place(14, 0.45, 0.4, 0xa8c66c, 0, z, 4.5);
      place(13, 0.025, 3, distance === 240 ? 0x658d40 : 0x345c58, 0, z + 1.5, 0.03);
    }
  }
  advanceCampaign(dt: number) {
    if (this.hud.state !== 'playing') return;
    let forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const sideways = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    if (!forward && this.hud.autoMove) forward = 1;
    const speed = (this.keys.has('ShiftLeft') ? 5 : 3.4) * dt / Math.max(1, Math.hypot(forward, sideways));
    const p = this.camera.position;
    const x = p.x + sideways * speed;
    const z = Math.max(7 - ROUTE_LENGTH, Math.min(7, p.z - forward * speed));
    if (canStand(x, p.z)) p.x = x;
    if (canStand(p.x, z)) p.z = z;
    const distance = Math.max(0, 7 - p.z);
    this.hud.distance = distance;
    const sector = sectorAt(distance);
    this.hud.wave = sector + 1;
    for (const checkpoint of [60, 120, 180]) {
      if (distance >= checkpoint && !this.checkpoints.has(checkpoint)) {
        this.checkpoints.add(checkpoint);
        this.hud.health = Math.min(100, this.hud.health + 25);
        this.hud.hit = '보급 지점 통과 · 체력 +25';
      }
    }
    const atExit = distance >= ROUTE_LENGTH - 3;
    const threatened = this.enemies.some(e => e.group.position.distanceTo(p) < 6);
    this.extraction = atExit && !threatened ? Math.min(8, this.extraction + dt) : 0;
    this.hud.extraction = this.extraction;
    this.hud.objective = atExit ? (threatened ? '주변 좀비를 제거해 구조 구역 확보' : `구조 대기 · ${Math.ceil(8 - this.extraction)}초`) : `${SECTORS[sector]} · ${Math.ceil((sector + 1) * 60 - distance)}m 앞 ${sector === 3 ? '탈출' : '보급'} 지점`;
    if (this.extraction >= 8) {
      this.hud.state = 'won';
      this.hud.score += 1000;
      this.hud.autoMove = false;
      this.keys.clear();
      this.emit();
    }
  }
  emit() {
    this.notify({ ...this.hud });
  }
  start() {
    for (const e of this.enemies) this.remove(e);
    this.enemies = [];
    this.hud = {
      health: 100,
      ammo: 11,
      chamber: true,
      reload: 0,
      score: 0,
      kills: 0,
      wave: 1,
      state: 'playing',
      hit: '',
    };
    this.camera.position.set(0, 1.7, 7);
    this.keys.clear();
    this.checkpoints.clear();
    this.extraction = 0;
    this.hud.distance = 0;
    this.hud.extraction = 0;
    this.hud.autoMove = false;
    this.hud.objective = '격리 지구 · 60m 앞 보급 지점';
    this.spawn = 0.4;
    this.elapsed = 0;
    this.emit();
    this.sound(300, 0.12, 'sine');
  }
  pause() {
    if (this.hud.state === 'playing') this.hud.state = 'paused';
    else if (this.hud.state === 'paused') this.hud.state = 'playing';
    this.emit();
  }
  setAim(x: number, y: number) {
    this.aim = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }
  action(a: string, x = this.aim.x, y = this.aim.y) {
    if (a === 'start') {
      this.start();
      return;
    }
    if (a === 'pause') {
      this.pause();
      return;
    }
    if (this.hud.state !== 'playing') return;
    if (a === 'advance') {
      this.hud.autoMove = !this.hud.autoMove;
      this.emit();
      return;
    }
    if (a === 'fire') {
      this.fire(x, y);
      return;
    }
    if (a === 'reload') {
      this.reload();
      return;
    }
  }
  reload() {
    if (this.hud.reloadMotion || this.hud.state !== 'playing') return;
    this.hud.reloadMotion = this.hud.reload + 1;
    this.hud.reloadProgress = 0;
    this.sound(260, 0.06, 'triangle');
    this.emit();
  }
  advanceReload(dt: number) {
    const phase = this.hud.reloadMotion;
    if (!phase || this.hud.state !== 'playing') return;
    const before = this.hud.reloadProgress || 0;
    this.hud.reloadProgress = Math.min(1, before + dt / RELOAD_SECONDS[phase]);
    if (this.hud.reloadProgress < 1) {
      if (Math.floor(before * 12) !== Math.floor(this.hud.reloadProgress * 12))
        this.emit();
      return;
    }
    if (this.hud.reload === 0) {
      this.hud.reload = 1;
      this.hud.ammo = 0;
    } else if (this.hud.reload === 1) {
      this.hud.ammo = 12;
      this.hud.reload = 2;
    } else {
      if (!this.hud.chamber && this.hud.ammo > 0) {
        this.hud.ammo--;
        this.hud.chamber = true;
      }
      this.hud.reload = 0;
    }
    this.hud.reloadMotion = 0;
    this.hud.reloadProgress = 0;
    this.sound(150 + this.hud.reload * 130, 0.06, 'triangle');
    this.emit();
  }
  fire(x: number, y: number) {
    const now = performance.now();
    if (now - this.lastShot < 190) return;
    this.lastShot = now;
    if (this.hud.reload || this.hud.reloadMotion || !this.hud.chamber) {
      this.sound(100, 0.04, 'square');
      this.hud.hit = this.hud.reload
        ? '장전을 완료하세요'
        : '탄창 교체 후 슬라이드를 당기세요';
      this.emit();
      return;
    }
    this.hud.chamber = false;
    if (this.hud.ammo > 0) {
      this.hud.ammo--;
      this.hud.chamber = true;
    }
    this.flash = 0.1;
    const shell = new T.Mesh(
      new T.CylinderGeometry(0.016, 0.016, 0.06, 6),
      new T.MeshStandardMaterial({
        color: 0xd7b36a,
        metalness: 0.8,
        roughness: 0.25,
      }),
    );
    shell.position.set(0.35, -0.18, -0.8);
    this.camera.add(shell);
    this.casings.push({
      mesh: shell,
      velocity: new T.Vector3(1.1, 1, -0.1),
      life: 1,
    });
    this.sound(80, 0.13, 'sawtooth');
    this.ray.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), this.camera);
    this.scene.updateMatrixWorld(true);
    const hits = this.ray.intersectObjects(
      this.enemies.flatMap((e) => e.parts),
      false,
    );
    const coverHit = this.ray.intersectObjects(this.cover || [], false)[0];
    if (coverHit && hits[0] && coverHit.distance < hits[0].distance) hits.length = 0;
    let hit = false;
    if (hits[0]) {
      const e = this.enemies.find((v) =>
        v.parts.includes(hits[0].object as T.Mesh),
      );
      if (e) {
        hit = true;
        const head =
          hits[0].object === e.head ||
          hits[0].object.userData?.head === true ||
          (!!e.headBone &&
            hits[0].point.distanceTo(
              e.headBone.getWorldPosition(new T.Vector3()),
            ) < 0.43);
        e.hp -= head ? 3 : 1;
        this.hud.hit = head ? 'HEADSHOT +150' : 'HIT';
        if (e.hp <= 0) {
          this.hud.score += head ? 150 : 100;
          this.hud.kills++;
          this.remove(e);
          this.enemies = this.enemies.filter((v) => v !== e);
        }
      }
    } else this.hud.hit = '';
    this.onShot(hit);
    this.emit();
  }
  spawnEnemy() {
    const group = new T.Group(),
      parts: T.Mesh[] = [];
    const add = (
      w: number,
      h: number,
      d: number,
      c: number,
      x: number,
      y: number,
      z = 0,
    ) => {
      const m = new T.Mesh(
        organic(w, h, d),
        finish(c, c === 0xc4d796 ? 'skin' : 'fabric'),
      );
      m.position.set(x, y, z);
      m.userData.head = y > 1.6;
      group.add(m);
      parts.push(m);
      return m;
    };
    const skin = 0xc4d796,
      cloth = 0xc0824b;
    add(0.65, 0.78, 0.35, cloth, 0, 1.1);
    const head = add(0.4, 0.46, 0.39, skin, 0, 1.74);
    add(0.2, 0.62, 0.23, skin, -0.44, 1.18, 0.27).rotation.x = -0.9;
    add(0.2, 0.62, 0.23, skin, 0.44, 1.18, 0.27).rotation.x = -0.9;
    add(0.23, 0.75, 0.25, 0x817b64, -0.19, 0.39);
    add(0.23, 0.75, 0.25, 0x817b64, 0.19, 0.39);
    for (const x of [-0.1, 0.1]) {
      const eye = add(0.06, 0.045, 0.025, 0xe8f4ad, x, 1.79, 0.21);
      (eye.material as T.MeshStandardMaterial).emissive.setHex(0xff704d);
    }
    add(0.15, 0.16, 0.12, skin, 0, 1.69, 0.18);
    add(0.09, 0.1, 0.085, skin, 0, 1.78, 0.2);
    add(0.2, 0.035, 0.03, 0x514b3b, 0, 1.65, 0.2);
    for (const x of [-0.23, 0.23]) add(0.095, 0.14, 0.1, skin, x, 1.76);
    for (const x of [-0.44, 0.44]) add(0.22, 0.2, 0.19, skin, x, 0.99, 0.52);
    for (const part of parts) {
      const material = part.material as T.MeshStandardMaterial;
      material.emissive.setHex(0x614926);
      material.emissiveIntensity = 0.3;
      material.metalness = 0;
      material.roughness = 0.9;
    }
    group.position.set((Math.random() - 0.5) * 12, 0, Math.max(-248, this.camera.position.z - 20 - Math.random() * 14));
    for (const b of BARRIERS) if (Math.abs(group.position.x - b.x) < 2 && Math.abs(group.position.z - b.z) < 2) group.position.x = 0;
    this.scene.add(group);
    const enemy: Enemy = {
      group,
      head,
      parts,
      hp: 2 + Math.floor((this.hud.wave - 1) / 3),
      speed: 1.25 + this.hud.wave * 0.23 + Math.random() * 0.5,
      phase: Math.random() * 7,
    };
    this.enemies.push(enemy);
    void this.upgradeEnemy(enemy);
  }
  async upgradeEnemy(e: Enemy) {
    try {
      const asset = await gameModel('yeti');
      if (this.disposed || !this.enemies.includes(e)) {
        disposeModel(asset.scene);
        return;
      }
      e.group.children.slice().forEach((child) => {
        e.group.remove(child);
        disposeModel(child);
      });
      const model = fitModel(asset.scene, 2.6);
      e.group.add(model);
      e.parts = [];
      asset.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          e.parts.push(o);
          const mat = o.material as T.MeshStandardMaterial;
          mat.envMapIntensity = 0.7;
        }
      });
      e.headBone = asset.scene.getObjectByName('Yeti_Head');
      e.gait = ['Yeti_LeftLeg', 'Yeti_RightLeg']
        .map((n) => asset.scene.getObjectByName(n))
        .filter(Boolean) as T.Object3D[];
      e.mixer = new T.AnimationMixer(asset.scene);
      for (const clip of asset.animations) e.mixer.clipAction(clip).play();
      e.mixer.setTime(e.phase);
    } catch {
      /* Keep the working fallback if an asset cannot be loaded. */
    }
  }
  remove(e: Enemy) {
    e.mixer?.stopAllAction();
    e.group.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    });
    this.scene.remove(e.group);
    e.group.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
  }
  sound(freq: number, duration: number, type: OscillatorType) {
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const o = this.audio.createOscillator(),
        g = this.audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, this.audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        30,
        this.audio.currentTime + duration,
      );
      g.gain.setValueAtTime(0.15, this.audio.currentTime);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        this.audio.currentTime + duration,
      );
      o.connect(g);
      g.connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + duration);
    } catch {}
  }
  tick(t: number) {
    if (this.disposed) return;
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    this.elapsed += dt;
    if (this.hud.state === 'playing') {
      this.advanceReload(dt);
      this.advanceCampaign(dt);
      this.spawn -= dt;
      if (this.hud.state === 'playing' && this.enemies.length < 12 && this.spawn <= 0) {
        this.spawnEnemy();
        this.spawn = Math.max(1.8, 3.7 - this.hud.wave * 0.35);
      }
      for (const e of this.enemies) {
        if (this.hud.state !== 'playing') break;
        const direction = this.camera.position.clone().sub(e.group.position);
        direction.y = 0;
        const distance = direction.length();
        direction.normalize();
        const step = Math.min(e.speed * dt, Math.max(0, distance - 1.1));
        const nextX = e.group.position.x + direction.x * step;
        const nextZ = e.group.position.z + direction.z * step;
        const blocked = BARRIERS.some(b => Math.abs(nextX - b.x) < b.width / 2 + 0.35 && Math.abs(nextZ - b.z) < b.depth / 2 + 0.35);
        if (blocked) e.group.position.x += (e.group.position.x > 0 ? -1 : 1) * e.speed * dt;
        else { e.group.position.x = nextX; e.group.position.z = nextZ; }
        e.group.rotation.y = Math.atan2(direction.x, direction.z);
        e.group.rotation.z = Math.sin(t * 0.003 + e.phase) * 0.04;
        e.group.position.y = Math.abs(Math.sin(t * 0.004 + e.phase)) * 0.045;
        if (e.mixer) {
          e.mixer.update(dt);
          e.gait?.forEach((bone, i) =>
            bone.rotateZ(Math.sin(t * 0.005 + e.phase + i * Math.PI) * 0.22),
          );
        } else {
          e.parts[4].rotation.x = Math.sin(t * 0.005 + e.phase) * 0.25;
          e.parts[5].rotation.x = -Math.sin(t * 0.005 + e.phase) * 0.25;
        }
        e.attack = Math.max(0, (e.attack || 0) - dt);
        if (distance < 1.6 && !e.attack) {
          e.attack = 1.2;
          this.hud.health = Math.max(0, this.hud.health - 10);
          this.damage = 0.4;
          this.sound(50, 0.25, 'sawtooth');
          if (!this.hud.health) this.hud.state = 'over';
          this.emit();
        }
      }
      this.emitTime += dt;
      if (this.emitTime >= 0.1) { this.emitTime = 0; this.emit(); }
    }
    for (const c of this.casings) {
      c.life -= dt;
      c.velocity.y -= dt * 3;
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.z += dt * 12;
      if (c.life <= 0) {
        this.camera.remove(c.mesh);
        c.mesh.geometry.dispose();
        (c.mesh.material as T.Material).dispose();
        this.casings = this.casings.filter((v) => v !== c);
      }
    }
    this.flash = Math.max(0, this.flash - dt);
    this.damage = Math.max(0, this.damage - dt);
    const pose = reloadPose(
      this.hud.reload,
      this.hud.reloadMotion,
      this.hud.reloadProgress,
    );
    const locked = !this.hud.chamber && this.hud.reloadMotion !== 3;
    this.slide.position.z =
      -0.12 + Math.max(pose.pull * 0.16, this.flash > 0 || locked ? 0.08 : 0);
    this.mag.position.set(
      -pose.drop * 0.09,
      -0.2 - pose.drop * 0.43,
      0.075 + pose.drop * 0.08,
    );
    this.mag.rotation.z = pose.drop * -0.22;
    this.mag.visible = true;
    this.gun.rotation.set(
      this.flash * 1.7 + pose.tilt * 0.12,
      pose.tilt * -0.95,
      pose.tilt * -0.26,
    );
    this.gun.position.set(
      0.29 - pose.tilt * 0.22 + (this.aim.x - 0.5) * 0.14,
      -0.3 + pose.tilt * 0.1,
      -0.8 + pose.tilt * 0.16,
    );
    this.supportHand.visible = pose.hand > 0;
    this.supportHand.position.set(
      pose.rack ? -0.13 : -0.1,
      pose.rack ? 0.14 : -0.29 - pose.drop * 0.43,
      pose.rack ? -0.06 + pose.pull * 0.16 : 0.09,
    );
    this.supportHand.scale.setScalar(pose.hand);
    this.light.intensity = this.flash * 140;
    this.canvas.style.filter = this.damage
      ? 'sepia(.6) saturate(2) hue-rotate(320deg)'
      : '';
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame((v) => this.tick(v));
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    this.releaseLook();
    this.modelNotice?.dispose();
    this.renderer.dispose();
    void this.audio?.close();
  }
}
