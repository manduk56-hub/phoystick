import * as T from 'three';
import { Cockpit } from './racing-cockpit.ts';
import { rounded, finish, organic } from './surface.ts';
import {
  RacingModel,
  roadX,
  roadSlope,
  TRACK_LENGTH,
  type RaceState,
} from './racing-model.ts';

function car(color: number) {
  const group = new T.Group();
  const box = (
    w: number,
    h: number,
    d: number,
    c: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new T.Mesh(
      rounded(w, h, d),
      new T.MeshPhysicalMaterial({
        color: c,
        roughness: 0.25,
        metalness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
      }),
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  box(1.65, 0.45, 3.6, color, 0, 0.65, 0);
  const canopy = new T.Mesh(
    organic(1.46, 1.08, 2.05),
    new T.MeshPhysicalMaterial({
      color: 0x203b4c,
      metalness: 0.55,
      roughness: 0.12,
      clearcoat: 1,
    }),
  );
  canopy.position.set(0, 0.95, 0.08);
  group.add(canopy);
  const roof = new T.Mesh(organic(1.3, 0.16, 1.4), finish(color));
  roof.position.set(0, 1.4, 0.1);
  group.add(roof);
  box(1.75, 0.12, 0.3, 0x10151f, 0, 1.08, 1.6);
  for (const x of [-0.87, 0.87])
    for (const z of [-1.12, 1.12]) {
      const wheel = new T.Mesh(
        new T.CylinderGeometry(0.36, 0.36, 0.24, 40),
        new T.MeshStandardMaterial({ color: 0x12141b }),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.38, z);
      group.add(wheel);
      const rim = new T.Mesh(
        new T.CylinderGeometry(0.23, 0.23, 0.255, 32),
        finish(0xb4c4d0),
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(wheel.position);
      group.add(rim);
      const cap = new T.Mesh(
        new T.CylinderGeometry(0.075, 0.075, 0.27, 24),
        finish(0x303c47),
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.copy(wheel.position);
      group.add(cap);
    }
  for (const x of [-0.58, 0.58]) {
    box(0.35, 0.1, 0.05, 0xff3b48, x, 0.76, 1.82);
    box(0.4, 0.1, 0.05, 0xffefca, x, 0.75, -1.82);
  }
  box(0.1, 0.025, 2.8, 0xedf8ff, -0.25, 0.89, 0);
  box(0.1, 0.025, 2.8, 0xedf8ff, 0.25, 0.89, 0);
  return group;
}
export class RacingScene {
  model = new RacingModel();
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, 1, 0.1, 650);
  renderer: T.WebGLRenderer;
  cockpit: Cockpit;
  traffic: T.Group[] = [];
  strips: { mesh: T.Mesh; left: number; right: number; height: number }[] = [];
  scenery: T.Group[] = [];
  finish = new T.Group();
  frame = 0;
  last = 0;
  emit = 0;
  resize: ResizeObserver;
  constructor(
    canvas: HTMLCanvasElement,
    public onState: (state: RaceState) => void,
  ) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setClearColor(0xc99591);
    this.cockpit = new Cockpit();
    this.camera.add(this.cockpit);
    this.scene.add(this.camera);
    this.camera.position.set(-0.3, 1.35, 0.25);
    this.scene.fog = new T.Fog(0xc99591, 100, 440);
    this.scene.add(new T.HemisphereLight(0xb5e0ff, 0xb36350, 2.7));
    const sun = new T.DirectionalLight(0xffe3ad, 3);
    sun.position.set(-40, 65, -110);
    this.scene.add(sun);
    const ground = new T.Mesh(
      new T.PlaneGeometry(1800, 1800),
      new T.MeshStandardMaterial({ color: 0x987367, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    this.scene.add(ground);
    const sunDisc = new T.Mesh(
      new T.SphereGeometry(24, 32, 16),
      new T.MeshBasicMaterial({ color: 0xffd7a1, fog: false }),
    );
    sunDisc.position.set(-145, 100, -440);
    this.scene.add(sunDisc);
    for (let i = 0; i < 15; i++) {
      const mountain = new T.Mesh(
        organic(100 + (i % 3) * 35, 100 + (i % 4) * 40, 95),
        new T.MeshStandardMaterial({
          color: i % 2 ? 0x82687e : 0x997c8b,
          flatShading: false,
          fog: false,
        }),
      );
      mountain.position.set(-500 + i * 75, 15, -360 - (i % 3) * 60);
      this.scene.add(mountain);
    }
    const strip = (
      left: number,
      right: number,
      color: number,
      height = 0.015,
    ) => {
      const g = new T.BufferGeometry();
      g.setAttribute(
        'position',
        new T.BufferAttribute(new Float32Array(120 * 18), 3),
      );
      const m = new T.Mesh(
        g,
        new T.MeshBasicMaterial({ color, side: T.DoubleSide }),
      );
      m.frustumCulled = false;
      this.scene.add(m);
      this.strips.push({ mesh: m, left, right, height });
    };
    strip(-6.3, 6.3, 0xbeb2ae);
    strip(-5.3, 5.3, 0x303946, 0.025);
    strip(-5.25, -5.07, 0xf8ecd5, 0.032);
    strip(5.07, 5.25, 0xf8ecd5, 0.032);
    strip(-1.8, -1.68, 0xb5afb0, 0.034);
    strip(1.68, 1.8, 0xb5afb0, 0.034);
    for (let i = 0; i < 48; i++) {
      const g = new T.Group();
      const pole = new T.Mesh(
        new T.CylinderGeometry(0.055, 0.065, 1.1, 5),
        new T.MeshBasicMaterial({ color: 0xe4ded2 }),
      );
      pole.position.y = 0.55;
      g.add(pole);
      const reflector = new T.Mesh(
        new T.BoxGeometry(0.18, 0.2, 0.12),
        new T.MeshBasicMaterial({ color: 0xff7052 }),
      );
      reflector.position.y = 0.96;
      g.add(reflector);
      this.scenery.push(g);
      this.scene.add(g);
    }
    for (let i = 0; i < 32; i++) {
      const g = new T.Group();
      const rock = new T.Mesh(
        new T.DodecahedronGeometry(1.5 + (i % 4), 2),
        new T.MeshStandardMaterial({
          color: i % 2 ? 0x9a6f61 : 0xb2876c,
          flatShading: false,
        }),
      );
      rock.scale.y = 1.5 + (i % 3);
      rock.position.y = 1;
      g.add(rock);
      this.scenery.push(g);
      this.scene.add(g);
    }
    this.traffic = this.model.traffic.map((c) => {
      const m = car(c.color);
      this.scene.add(m);
      return m;
    });
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 2; j++) {
        const q = new T.Mesh(
          new T.BoxGeometry(0.9, 0.5, 0.16),
          new T.MeshBasicMaterial({ color: (i + j) % 2 ? 0x15212b : 0xf3eee6 }),
        );
        q.position.set(-4.95 + i * 0.9, 4.7 + j * 0.5, 0);
        this.finish.add(q);
      }
    for (const x of [-5.7, 5.7]) {
      const p = new T.Mesh(
        new T.BoxGeometry(0.16, 5.4, 0.16),
        new T.MeshBasicMaterial({ color: 0xf3eee6 }),
      );
      p.position.set(x, 2.7, 0);
      this.finish.add(p);
    }
    this.scene.add(this.finish);
    this.resize = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(canvas);
    this.frame = requestAnimationFrame(this.loop);
  }
  loop = (now: number) => {
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0.016;
    this.last = now;
    this.model.tick(dt);
    const s = this.model.state,
      origin = roadX(s.distance),
      step = 4,
      start = Math.floor(s.distance / step) * step - 12;
    for (const strip of this.strips) {
      const pos = strip.mesh.geometry.attributes.position as T.BufferAttribute;
      const a = pos.array as Float32Array;
      for (let i = 0; i < 120; i++) {
        const z0 = start + i * step,
          z1 = z0 + step,
          x0 = roadX(z0) - origin,
          x1 = roadX(z1) - origin,
          y = strip.height;
        const v = [
          x0 + strip.left,
          y,
          s.distance - z0,
          x0 + strip.right,
          y,
          s.distance - z0,
          x1 + strip.left,
          y,
          s.distance - z1,
          x1 + strip.left,
          y,
          s.distance - z1,
          x0 + strip.right,
          y,
          s.distance - z0,
          x1 + strip.right,
          y,
          s.distance - z1,
        ];
        if (strip.left > -2 && strip.right < 2 && Math.floor(z0 / 8) % 2 === 0)
          v.fill(0);
        a.set(v, i * 18);
      }
      pos.needsUpdate = true;
    }
    for (let i = 0; i < this.traffic.length; i++) {
      const c = this.model.traffic[i],
        m = this.traffic[i],
        z = c.z - s.distance;
      m.visible = z > -18 && z < 450;
      m.position.set(roadX(c.z) - origin + c.lane, 0, -z);
      m.rotation.y = -roadSlope(c.z);
    }
    this.scenery.forEach((m, i) => {
      const spacing = i < 48 ? 18 : 31,
        z =
          Math.floor(s.distance / spacing) * spacing +
          Math.floor((i < 48 ? i : i - 48) / 2) * spacing;
      const side = i % 2 ? 1 : -1,
        offset = i < 48 ? 5.85 : 13 + (i % 7) * 2;
      m.position.set(roadX(z) - origin + offset * side, 0, s.distance - z);
    });
    this.finish.position.set(
      roadX(TRACK_LENGTH) - origin,
      0,
      s.distance - TRACK_LENGTH,
    );
    this.finish.visible = TRACK_LENGTH - s.distance < 450;
    this.camera.position.set(s.lateral - 0.3, 1.35, 0.25);
    this.camera.lookAt(
      s.lateral - 0.3 + roadSlope(s.distance) * 35 + s.input.steer * 1.1,
      1.2,
      -35,
    );
    this.camera.fov = 68;
    this.cockpit.update(s.speed, s.input.steer, this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    this.emit += dt;
    if (this.emit > 0.08) {
      this.onState({ ...s, input: { ...s.input } });
      this.emit = 0;
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      }
    });
    this.renderer.dispose();
    this.cockpit.texture.dispose();
  }
}
