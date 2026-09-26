import * as T from 'three';
import {
  gameModel,
  disposeModel,
  fitModel,
  cinematicLight,
  assetNotice,
} from './graphics-assets.ts';
import { rounded, finish, organic } from './surface.ts';
import { FishingModel, type FishingState } from './fishing-model.ts';
export class FishingScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(54, 1, 0.1, 200);
  model = new FishingModel();
  bobber = new T.Group();
  lure = new T.Mesh(
    new T.SphereGeometry(0.1, 12, 8),
    new T.MeshStandardMaterial({
      color: 0xd8d3a5,
      metalness: 0.85,
      roughness: 0.18,
    }),
  );
  sun = new T.DirectionalLight(0xffe1ac, 3);
  rain: T.Points;
  rod = new T.Group();
  line: T.Line;
  water: T.Mesh;
  fish = new T.Group();
  rings: T.Mesh[] = [];
  rodSegments: T.Mesh[] = [];
  guides: T.Mesh[] = [];
  reel: T.Group;
  resize: ResizeObserver;
  frame = 0;
  last = 0;
  time = 0;
  onState: (s: FishingState) => void;
  emit = 0;
  audio: AudioContext | null = null;
  lastPhase = 'ready';
  reeling = false;
  disposed = false;
  releaseLook: () => void = () => {};
  notice?: ReturnType<typeof assetNotice>;
  fishVertices: { mesh: T.Mesh; base: Float32Array }[] = [];
  constructor(canvas: HTMLCanvasElement, onState: (s: FishingState) => void) {
    this.onState = onState;
    this.renderer = new T.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setClearColor(0, 0);
    this.releaseLook = cinematicLight(this.renderer, this.scene, 1.1);
    this.notice = assetNotice(canvas, '물고기 모델');
    void this.loadFish();
    this.camera.position.set(0, 3.4, 8);
    this.camera.lookAt(0, 1.1, -16);
    this.scene.add(new T.HemisphereLight(0xe2f5e8, 0x2c5155, 2.6));
    const sun = this.sun;
    sun.position.set(-12, 20, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -18;
    sun.shadow.camera.right = sun.shadow.camera.top = 18;
    sun.shadow.normalBias = 0.035;
    sun.shadow.camera.far = 80;
    this.scene.add(sun);
    const rainGeometry = new T.BufferGeometry();
    const rainPositions = new Float32Array(450 * 3);
    for (let i = 0; i < 450; i++) {
      rainPositions[i * 3] = Math.random() * 60 - 30;
      rainPositions[i * 3 + 1] = Math.random() * 18;
      rainPositions[i * 3 + 2] = 6 - Math.random() * 55;
    }
    rainGeometry.setAttribute(
      'position',
      new T.BufferAttribute(rainPositions, 3),
    );
    this.rain = new T.Points(
      rainGeometry,
      new T.PointsMaterial({
        color: 0xc0d4dc,
        size: 0.075,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.scene.add(this.rain);
    this.lure.scale.set(0.5, 0.3, 2.5);
    this.scene.add(this.lure);
    this.scene.fog = new T.FogExp2(0x729c9e, 0.008);
    const geometry = new T.PlaneGeometry(180, 180, 65, 65);
    geometry.rotateX(-Math.PI / 2);
    this.water = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        color: 0x27616c,
        metalness: 0.5,
        roughness: 0.28,
        transparent: true,
        opacity: 0.83,
      }),
    );
    this.water.position.z = -35;
    this.scene.add(this.water);
    const top = new T.Mesh(
      new T.SphereGeometry(0.12, 14, 10),
      new T.MeshStandardMaterial({ color: 0xff7849, emissive: 0x662210 }),
    );
    top.scale.y = 1.8;
    top.position.y = 0.12;
    this.bobber.add(top);
    const bottom = new T.Mesh(
      new T.SphereGeometry(0.12, 14, 10),
      new T.MeshStandardMaterial({ color: 0xf8efe1 }),
    );
    bottom.scale.y = 1.4;
    bottom.position.y = -0.08;
    this.bobber.add(bottom);
    const antenna = new T.Mesh(
      new T.CylinderGeometry(0.013, 0.013, 0.65, 6),
      new T.MeshStandardMaterial({ color: 0xffe498 }),
    );
    antenna.position.y = 0.42;
    this.bobber.add(antenna);
    this.bobber.position.set(0, 0.3, -10);
    this.scene.add(this.bobber);
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(
        new T.RingGeometry(0.55, 0.58, 60),
        new T.MeshBasicMaterial({
          color: 0xd6f4e7,
          transparent: true,
          opacity: 0.4,
          side: T.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.rings.push(ring);
      this.scene.add(ring);
    }
    for (let i = 0; i < 12; i++) {
      const segment = new T.Mesh(
        new T.CylinderGeometry(
          0.024 - i * 0.0013,
          0.026 - i * 0.0013,
          0.33,
          24,
        ),
        finish(i < 3 ? 0x96724b : 0x263f43, i < 3 ? 'cork' : 'metal'),
      );
      segment.position.y = i * 0.31;
      this.rod.add(segment);
      this.rodSegments.push(segment);
    }
    this.reel = new T.Group();
    const spool = new T.Mesh(
      new T.CylinderGeometry(0.14, 0.14, 0.18, 32),
      new T.MeshStandardMaterial({
        color: 0xd0b787,
        metalness: 0.8,
        roughness: 0.3,
      }),
    );
    spool.rotation.z = Math.PI / 2;
    this.reel.add(spool);
    const handle = new T.Mesh(
      rounded(0.05, 0.24, 0.05),
      new T.MeshStandardMaterial({ color: 0x142b32 }),
    );
    handle.position.y = 0.12;
    this.reel.add(handle);
    this.reel.position.set(0.18, 0.45, 0);
    this.rod.add(this.reel);
    this.rod.position.set(1.15, 1.9, 5.2);
    this.rod.rotation.set(-0.7, 0, -0.3);
    for (let i = 3; i < 12; i++) {
      const guide = new T.Mesh(
        new T.TorusGeometry(0.036 - i * 0.0015, 0.004, 8, 24),
        finish(0xa4b8bd),
      );
      guide.position.set(0, i * 0.31, -0.025);
      this.rod.add(guide);
      this.guides.push(guide);
    }
    const grip = new T.Mesh(
      new T.CylinderGeometry(0.044, 0.047, 0.68, 32),
      finish(0x96724b, 'cork'),
    );
    grip.position.y = 0.12;
    this.rod.add(grip);
    const bail = new T.Mesh(
      new T.TorusGeometry(0.155, 0.009, 8, 40, Math.PI * 1.65),
      finish(0xdbe5de),
    );
    bail.rotation.y = Math.PI / 2;
    this.reel.add(bail);
    this.scene.add(this.rod);
    this.line = new T.Line(
      new T.BufferGeometry().setAttribute(
        'position',
        new T.BufferAttribute(new Float32Array(31 * 3), 3),
      ),
      new T.LineBasicMaterial({
        color: 0xf8edce,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(this.line);
    const body = new T.Mesh(
      new T.SphereGeometry(0.55, 40, 28),
      finish(0x86b6a1, 'scales'),
    );
    body.scale.set(1.9, 0.7, 0.45);
    this.fish.add(body);
    const tail = new T.Mesh(
      organic(0.7, 0.8, 0.15),
      new T.MeshStandardMaterial({ color: 0x50847c, side: T.DoubleSide }),
    );
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -1.12;
    tail.scale.z = 0.2;
    this.fish.add(tail);
    const eye = new T.Mesh(
      new T.SphereGeometry(0.07, 10, 8),
      new T.MeshBasicMaterial({ color: 0x071b20 }),
    );
    eye.position.set(0.68, 0.15, 0.24);
    this.fish.add(eye);
    const otherEye = eye.clone();
    otherEye.position.z = -0.24;
    this.fish.add(otherEye);
    for (const z of [-0.16, 0.16]) {
      const fin = new T.Mesh(
        organic(0.48, 0.12, 0.42),
        finish(0x4b8075, 'scales'),
      );
      fin.position.set(-0.05, -0.17, z);
      fin.rotation.x = z > 0 ? 0.5 : -0.5;
      this.fish.add(fin);
    }
    const dorsal = new T.Mesh(
      organic(0.8, 0.3, 0.075),
      finish(0x557f71, 'scales'),
    );
    dorsal.position.set(-0.15, 0.36, 0);
    this.fish.add(dorsal);
    this.scene.add(this.fish);
    this.resize = new ResizeObserver(() => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(canvas);
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  async loadFish() {
    try {
      const a = await gameModel('fish');
      if (this.disposed) {
        disposeModel(a.scene);
        return;
      }
      this.fish.children.slice().forEach((c) => {
        this.fish.remove(c);
        disposeModel(c);
      });
      const fitted = fitModel(a.scene, 2.2, 'z');
      fitted.rotation.y = Math.PI / 2;
      this.fish.add(fitted);
      a.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          this.fishVertices.push({
            mesh: o,
            base: new Float32Array(o.geometry.attributes.position.array),
          });
          const mat = o.material as T.MeshStandardMaterial;
          mat.roughness = 0.32;
          mat.envMapIntensity = 1.2;
        }
      });
      this.notice?.done();
    } catch {
      this.notice?.fail();
    }
  }
  sound(freq: number, duration = 0.15) {
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const o = this.audio.createOscillator(),
        g = this.audio.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, this.audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        freq * 0.5,
        this.audio.currentTime + duration,
      );
      g.gain.setValueAtTime(0.13, this.audio.currentTime);
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
  action(action: string, value = 0.5) {
    if (action === 'hold') {
      this.reeling = false;
      if (!this.model.state.paused) this.model.pause();
      this.onState({ ...this.model.state });
      return;
    }
    if (action === 'reelStart') this.reeling = true;
    if (action === 'reelStop' || action === 'pause' || action === 'recall')
      this.reeling = false;
    if (action === 'cast') {
      this.model.cast(value);
      this.sound(260);
    }
    if (action === 'hook') this.model.hook();
    if (action === 'reel') this.model.reel(value);
    if (action === 'flick') this.model.flick();
    if (action === 'pause') this.model.pause();
    if (
      [
        'spot',
        'bait',
        'rig',
        'depth',
        'drag',
        'speed',
        'rod',
        'gear',
        'hookSize',
        'leader',
      ].includes(action)
    )
      this.model.configure(action, value);
    if (action === 'recall') this.model.recall();
    if (action === 'feed') this.model.feed();
    if (action === 'sell') this.model.sell();
    if (action === 'release') this.model.release();
    if (action === 'buy') this.model.buy(value);
    if (action === 'repair') this.model.repair();
    this.onState({ ...this.model.state });
  }
  tick(t: number) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (!this.model.state.paused) this.time += dt;
    this.model.tick(dt);
    if (this.reeling) this.model.reel(dt * 0.85);
    const s = this.model.state;
    const daylight = Math.max(0.15, Math.sin(((s.hour - 5) / 14) * Math.PI));
    this.sun.intensity =
      (s.weather === 2 ? 0.7 : s.weather === 1 ? 1.4 : 3) * daylight;
    this.renderer.toneMappingExposure = 0.6 + daylight * 0.5;
    this.rain.visible = s.weather === 2;
    if (this.rain.visible && !s.paused) {
      const drops = this.rain.geometry.attributes.position;
      for (let i = 0; i < drops.count; i++) {
        drops.setY(i, drops.getY(i) < 0 ? 18 : drops.getY(i) - dt * 13);
        drops.setX(
          i,
          drops.getX(i) > 30 ? -30 : drops.getX(i) + dt * s.wind * 0.4,
        );
      }
      drops.needsUpdate = true;
    }
    if (s.phase !== this.lastPhase) {
      if (s.phase === 'bite') this.sound(1100, 0.3);
      if (s.phase === 'caught') this.sound(880, 0.5);
      if (s.phase === 'escaped') this.sound(130, 0.4);
      if (s.phase === 'waiting') this.sound(180, 0.25);
      this.lastPhase = s.phase;
    }
    const attrs = this.water.geometry.attributes.position;
    for (let i = 0; i < attrs.count; i++) {
      const x = attrs.getX(i),
        z = attrs.getZ(i);
      attrs.setY(
        i,
        Math.sin(x * 0.17 + this.time * 0.65) * 0.055 +
          Math.cos(z * 0.22 + this.time) * 0.045,
      );
    }
    attrs.needsUpdate = true;
    const cast = Math.min(1, s.phaseTime / 1.35);
    this.bobber.position.set(
      (s.spot - 1) * 4 +
        Math.sin(this.time * 0.6) *
          (s.phase === 'fighting' ? 1.8 : 0.08 + s.wind * 0.025),
      s.phase === 'casting'
        ? Math.sin(cast * Math.PI) * 5 + 0.15
        : s.phase === 'bite'
          ? -0.22 + Math.sin(this.time * 13) * 0.13
          : 0.14 + Math.sin(this.time * 2.8) * 0.055 - s.nibble * 0.25,
      3 - s.distance,
    );
    const inWater = !['ready', 'caught', 'escaped'].includes(s.phase);
    this.bobber.visible = inWater && (s.rig === 0 || s.phase === 'casting');
    this.lure.visible = inWater && s.rig === 2 && s.phase !== 'casting';
    this.lure.position.copy(this.bobber.position);
    this.lure.position.y = -0.15;
    this.lure.rotation.y = this.time * (1 + s.speed * 5);
    (this.water.material as T.MeshStandardMaterial).color.setHex(
      s.weather === 2 ? 0x244f59 : s.weather === 1 ? 0x386b70 : 0x27616c,
    );
    this.bobber.scale.setScalar(
      s.phase === 'casting' ? 1 : Math.max(1, s.distance / 14),
    );
    this.rod.rotation.x =
      s.phase === 'casting'
        ? -1.4 + Math.sin(cast * Math.PI) * 1.4
        : -1 + (s.rod - 0.5) * 0.65;
    this.rod.rotation.z =
      0.25 + Math.sin(this.time * 2) * (s.phase === 'fighting' ? 0.055 : 0.006);
    const biteBend =
      s.rig === 1 && ['waiting', 'bite'].includes(s.phase)
        ? s.nibble * 0.45
        : 0;
    for (let i = 0; i < this.rodSegments.length; i++) {
      const segment = this.rodSegments[i];
      segment.position.z = -Math.pow(i / 11, 2) * (s.tension + biteBend) * 0.65;
      segment.rotation.x = (-i / 11) * (s.tension + biteBend) * 0.4;
    }
    this.guides.forEach((guide, index) => {
      const fraction = (index + 3) / 11;
      guide.position.z =
        -0.025 - fraction * fraction * (s.tension + biteBend) * 0.65;
      guide.rotation.x = -fraction * (s.tension + biteBend) * 0.4;
    });
    this.reel.rotation.x = -s.turns * Math.PI * 2;
    this.rod.updateMatrixWorld(true);
    const tip = new T.Vector3(0, 3.6, -s.tension * 0.65).applyMatrix4(
      this.rod.matrixWorld,
    );
    const linePositions = this.line.geometry.attributes.position;
    for (let i = 0; i <= 30; i++) {
      const f = i / 30;
      const p = tip.clone().lerp(this.bobber.position, f);
      p.y -=
        Math.sin(f * Math.PI) *
        (s.phase === 'casting' ? 0.5 : Math.max(0.1, 1 - s.tension) * 1.2);
      linePositions.setXYZ(i, p.x, p.y, p.z);
    }
    linePositions.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
    this.line.visible = inWater;
    this.rings.forEach((r, i) => {
      const p = (this.time * 0.6 + i / 3) % 1;
      r.position.set(this.bobber.position.x, 0.06, this.bobber.position.z);
      r.scale.setScalar(0.5 + p * 4);
      (r.material as T.MeshBasicMaterial).opacity = (1 - p) * 0.35;
      r.visible = this.bobber.visible && s.phase !== 'casting';
    });
    this.fish.visible =
      s.phase === 'caught' || (s.phase === 'fighting' && s.distance < 6);
    if (s.phase === 'caught') {
      this.fish.position.set(0, 2.4, 2);
      this.fish.rotation.set(
        0,
        Math.sin(this.time) * 0.3,
        Math.sin(this.time * 5) * 0.09,
      );
      const size = Math.min(1.7, 0.65 + Math.cbrt(s.weight) * 0.3);
      this.fish.scale.set(
        size,
        size * ([0, 2, 3].includes(s.fishId) ? 1.2 : 0.85),
        size,
      );
    } else {
      this.fish.position.copy(this.bobber.position);
      this.fish.position.y = -0.15;
      this.fish.scale.setScalar(0.8);
      this.fish.rotation.set(
        0,
        Math.sin(this.time) * 0.5,
        Math.sin(this.time * 8) * 0.2,
      );
    }
    for (const { mesh, base } of this.fishVertices) {
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const z = base[i * 3 + 2];
        p.setX(
          i,
          base[i * 3] +
            Math.sin(z * 12 + this.time * 9) *
              0.018 *
              Math.pow(Math.abs(z) / 0.33, 1.7),
        );
      }
      p.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    this.water.geometry.computeVertexNormals();
    this.emit += dt;
    if (this.emit > 0.1) {
      this.emit = 0;
      this.onState({ ...s });
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame((v) => this.tick(v));
  }
  dispose() {
    this.disposed = true;
    this.releaseLook();
    this.notice?.dispose();
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    this.renderer.dispose();
    void this.audio?.close();
  }
}
