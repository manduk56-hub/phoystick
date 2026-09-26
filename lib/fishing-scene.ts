import * as T from 'three';
import { disposeModel, cinematicLight } from './graphics-assets.ts';
import { rounded, finish } from './surface.ts';
import { createFish, RodSpring } from './fishing-detail.ts';
import { lakeBackdrop, reflectiveLake } from './fishing-environment.ts';
import { FishingModel, type FishingState } from './fishing-model.ts';
export class FishingScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(54, 1, 0.1, 600);
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
  water: ReturnType<typeof reflectiveLake>;
  landscapeTexture: T.Texture;
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
  spring = new RodSpring();
  fishSpecies = -1;
  cameraTarget = new T.Vector3(0, 1.1, -16);
  reelHandle = new T.Group();
  splashTime = -10;
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
    this.scene.background = new T.Color(0xb4c8cc);
    this.landscapeTexture = new T.TextureLoader().load(
      '/assets/lake.png',
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        this.scene.add(lakeBackdrop(texture));
      },
    );

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
    this.water = reflectiveLake();
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
    this.reelHandle.add(handle);
    const knob = new T.Mesh(
      new T.SphereGeometry(0.045, 16, 12),
      finish(0x142b32),
    );
    knob.position.set(0, 0.24, 0);
    this.reelHandle.add(knob);
    this.reelHandle.position.x = 0.13;
    this.reel.add(this.reelHandle);
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
        new T.BufferAttribute(new Float32Array(41 * 3), 3),
      ),
      new T.LineBasicMaterial({
        color: 0xf8edce,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(this.line);
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
  selectFish(id: number) {
    if (id === this.fishSpecies) return;
    this.fishVertices = [];
    this.fish.children.slice().forEach((child) => {
      this.fish.remove(child);
      disposeModel(child);
    });
    this.fish.add(createFish(id));
    this.fish.traverse((object) => {
      if (object instanceof T.Mesh || object instanceof T.Line) {
        object.updateMatrix();
        object.geometry.applyMatrix4(object.matrix);
        object.position.set(0, 0, 0);
        object.rotation.set(0, 0, 0);
        object.scale.set(1, 1, 1);
        this.fishVertices.push({
          mesh: object as T.Mesh,
          base: new Float32Array(object.geometry.attributes.position.array),
        });
        object.geometry.computeBoundingSphere();
        if (object.geometry.boundingSphere)
          object.geometry.boundingSphere.radius += 0.3;
      }
    });
    this.fishSpecies = id;
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
      if (s.phase === 'waiting') {
        this.sound(180, 0.25);
        this.splashTime = this.time;
      }
      this.lastPhase = s.phase;
    }
    const waterMaterial = this.water.material as T.ShaderMaterial;
    waterMaterial.uniforms.time.value = this.time;
    waterMaterial.uniforms.wind.value = s.wind;
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
    (waterMaterial.uniforms.color.value as T.Color).setHex(
      s.weather === 2 ? 0x244f59 : s.weather === 1 ? 0x386b70 : 0x235961,
    );
    this.bobber.scale.setScalar(1);
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
    const castLoad =
      s.phase === 'casting' ? Math.sin(cast * Math.PI * 2) * 0.65 : 0;
    const bend = this.spring.update(
      s.tension * (1 - s.gear * 0.15) + biteBend + castLoad,
      s.paused ? 0 : dt,
      s.gear,
    );
    const rodPoint = (fraction: number) =>
      new T.Vector3(
        0,
        fraction * 3.72 - bend * bend * Math.pow(fraction, 5) * 0.14,
        -Math.pow(fraction, 3) * bend * 0.95,
      );
    for (let i = 0; i < this.rodSegments.length; i++) {
      const segment = this.rodSegments[i];
      const start = rodPoint(Math.max(0, (i - 0.5) / 12));
      const end = rodPoint((i + 0.5) / 12);
      segment.position.copy(start).lerp(end, 0.5);
      segment.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        end.clone().sub(start).normalize(),
      );
      segment.scale.y = start.distanceTo(end) / 0.33;
    }
    this.guides.forEach((guide, index) => {
      const fraction = (index + 3) / 12;
      guide.position.copy(rodPoint(fraction));
      guide.position.z -= 0.032;
      guide.rotation.x = -Math.atan(
        (3 * fraction * fraction * bend * 0.95) / 3.72,
      );
    });
    this.reelHandle.rotation.x = -s.turns * Math.PI * 2;
    this.rod.updateMatrixWorld(true);
    const tip = rodPoint(11.5 / 12).applyMatrix4(this.rod.matrixWorld);
    const linePositions = this.line.geometry.attributes.position;
    const spoolPoint = new T.Vector3(0.18, 0.45, 0).applyMatrix4(
      this.rod.matrixWorld,
    );
    linePositions.setXYZ(0, spoolPoint.x, spoolPoint.y, spoolPoint.z);
    this.guides.forEach((guide, i) => {
      const point = guide.position.clone().applyMatrix4(this.rod.matrixWorld);
      linePositions.setXYZ(i + 1, point.x, point.y, point.z);
    });
    for (let i = 0; i <= 30; i++) {
      const f = i / 30;
      const p = tip.clone().lerp(this.bobber.position, f);
      p.y -=
        Math.sin(f * Math.PI) *
        (s.phase === 'casting' ? 0.5 : Math.max(0.1, 1 - s.tension) * 1.2);
      linePositions.setXYZ(i + 10, p.x, p.y, p.z);
    }
    linePositions.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
    this.line.visible = inWater;
    this.rings.forEach((r, i) => {
      const p = (this.time * 0.6 + i / 3) % 1;
      r.position.set(this.bobber.position.x, 0.06, this.bobber.position.z);
      r.scale.setScalar(0.5 + p * 4);
      (r.material as T.MeshBasicMaterial).opacity = (1 - p) * 0.35;
      const splash = this.time - this.splashTime;
      if (splash < 2) {
        r.scale.setScalar(0.2 + splash * (2 + i * 0.4));
        (r.material as T.MeshBasicMaterial).opacity =
          Math.max(0, 1 - splash / 2) * 0.6;
      }
      r.visible =
        inWater && s.phase !== 'casting' && (this.bobber.visible || splash < 2);
    });
    this.selectFish(s.fishId);
    this.fish.visible =
      s.phase === 'caught' || (s.phase === 'fighting' && s.distance < 9);
    const size = Math.max(0.25, s.length / 245);
    this.fish.scale.setScalar(size);
    if (s.phase === 'caught') {
      this.fish.position.set(0, 2.4, 3.1);
      this.fish.scale.setScalar(Math.min(1.25, 0.7 + size));
      this.fish.rotation.set(0, Math.sin(this.time * 0.4) * 0.25, 0);
    } else {
      this.fish.position.copy(this.bobber.position);
      // Exhausted fish surface near the bank, above the opaque reflective lake.
      this.fish.position.y = -0.04 - s.stamina * 0.1;
      const lateral =
        Math.sin(this.time * (s.pulling ? 2.4 : 1.1)) * (0.2 + s.stamina * 0.8);
      this.fish.position.x += lateral;
      this.fish.rotation.set(
        0,
        Math.atan2(s.pulling ? 1 : -1, lateral * 2),
        Math.sin(this.time * 3) * 0.06,
      );
    }
    const swimRate =
      s.phase === 'caught' ? 2.2 : s.pulling ? 12 : 5 + s.stamina * 3;
    const amplitude = s.phase === 'caught' ? 0.025 : s.pulling ? 0.16 : 0.07;
    if (this.fish.visible)
      for (const { mesh, base } of this.fishVertices) {
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const x = base[i * 3];
          const tailWeight = Math.pow(
            T.MathUtils.clamp((0.65 - x) / 2.1, 0, 1),
            1.8,
          );
          positions.setZ(
            i,
            base[i * 3 + 2] +
              Math.sin(this.time * swimRate + x * 3.8) * amplitude * tailWeight,
          );
        }
        positions.needsUpdate = true;
        if (mesh instanceof T.Mesh) mesh.geometry.computeVertexNormals();
      }
    // Follow the cast with gaze while keeping the angler on the bank.
    const focus =
      s.phase === 'caught'
        ? this.fish.position.clone()
        : inWater
          ? this.bobber.position.clone()
          : new T.Vector3(0, 1.1, -16);
    if (inWater && s.phase !== 'casting') focus.y = 0.12;
    const cameraBlend = s.paused
      ? 0
      : 1 - Math.exp(-dt * (s.phase === 'casting' ? 5 : 2.8));
    this.cameraTarget.lerp(focus, cameraBlend);
    this.camera.lookAt(this.cameraTarget);
    const desiredFov =
      s.phase === 'waiting' || s.phase === 'bite'
        ? T.MathUtils.clamp(58 - s.distance * 0.8, 26, 48)
        : s.phase === 'caught'
          ? 46
          : 54;
    this.camera.fov = T.MathUtils.lerp(
      this.camera.fov,
      desiredFov,
      cameraBlend,
    );
    this.camera.updateProjectionMatrix();
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
    this.water.dispose();
    this.landscapeTexture.dispose();
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
