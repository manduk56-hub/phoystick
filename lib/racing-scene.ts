import { trackCar } from './object-design.ts';
import * as T from 'three';
import {
  cinematicLight,
  scannedMaterial,
  assetNotice,
} from './graphics-assets.ts';
import { Cockpit } from './racing-cockpit.ts';

import {
  RacingModel,
  localTrack,
  trackHeading,
  TRACK_LENGTH,
  type RaceState,
} from './racing-model.ts';

const car = trackCar;
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
  disposed = false;
  releaseLook: () => void;
  notice: ReturnType<typeof assetNotice>;
  detailedTraffic: T.Group[] = [];
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
    this.renderer.setClearColor(0xaebcc4);
    this.releaseLook = cinematicLight(this.renderer, this.scene, 0.85, true);
    this.notice = assetNotice(canvas, '차량 모델');
    this.cockpit = new Cockpit();
    void this.cockpit
      .loadDetailed()
      .then(() => this.notice.done())
      .catch(() => this.notice.fail());

    this.camera.add(this.cockpit);
    this.scene.add(this.camera);
    this.camera.position.set(-0.3, 1.35, 0.25);
    this.scene.fog = new T.Fog(0xaebcc4, 100, 440);
    this.scene.add(new T.HemisphereLight(0xb5e0ff, 0x776b55, 1.5));
    const sun = new T.DirectionalLight(0xffe3ad, 3);
    sun.position.set(-40, 65, -110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0004;
    sun.target.position.set(0, 0, -25);
    this.scene.add(sun.target);
    this.scene.add(sun);
    const ground = new T.Mesh(
      new T.PlaneGeometry(1800, 1800),
      new T.MeshStandardMaterial({ color: 0x567848, roughness: 1 }),
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    this.scene.add(ground);
    const sunDisc = new T.Mesh(
      new T.SphereGeometry(24, 32, 16),
      new T.MeshBasicMaterial({ color: 0xffd7a1, fog: false }),
    );
    sunDisc.position.set(-145, 100, -440);
    sunDisc.visible = false;
    this.scene.add(sunDisc);
    for (let i = 0; i < 15; i++) {
      const terrain = new T.IcosahedronGeometry(1, 4);
      const vertices = terrain.attributes.position;
      for (let k = 0; k < vertices.count; k++) {
        const x = vertices.getX(k),
          y = vertices.getY(k),
          z = vertices.getZ(k),
          r =
            1 +
            0.1 * Math.sin(x * 17 + y * 11) * Math.cos(z * 13) +
            0.07 * Math.sin(z * 29 + x * 19);
        vertices.setXYZ(k, x * r, y * r, z * r);
      }
      terrain.computeVertexNormals();
      const mountain = new T.Mesh(
        terrain,
        scannedMaterial('rock_boulder_dry', 8),
      );
      mountain.scale.set(75 + (i % 3) * 25, 60 + (i % 4) * 30, 65);
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
        left === -5.3
          ? scannedMaterial('asphalt_02')
          : new T.MeshBasicMaterial({ color, side: T.DoubleSide }),
      );
      g.setAttribute(
        'uv',
        new T.BufferAttribute(new Float32Array(120 * 12), 2),
      );
      g.setAttribute(
        'normal',
        new T.BufferAttribute(
          Float32Array.from({ length: 120 * 18 }, (_, i) =>
            i % 3 === 1 ? 1 : 0,
          ),
          3,
        ),
      );
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.scene.add(m);
      this.strips.push({ mesh: m, left, right, height });
    };
    strip(-6.3, 6.3, 0xbeb2ae);
    strip(-5.3, 5.3, 0x303946, 0.025);
    strip(-5.25, -5.07, 0xf8ecd5, 0.032);
    strip(5.07, 5.25, 0xf8ecd5, 0.032);
    strip(-5.95, -5.3, 0xd82f3b, 0.04);
    strip(5.3, 5.95, 0xd82f3b, 0.04);
    for (let i = 0; i < 48; i++) {
      const g = new T.Group();
      const barrier = new T.Mesh(
        new T.BoxGeometry(0.3, 0.75, 18),
        new T.MeshStandardMaterial({
          color: i % 4 < 2 ? 0xe7e9e8 : 0xd63443,
          roughness: 0.7,
        }),
      );
      barrier.position.y = 0.4;
      g.add(barrier);
      if (i % 6 === 0) {
        const fence = new T.Mesh(
          new T.BoxGeometry(0.08, 1.5, 18),
          new T.MeshStandardMaterial({ color: 0x819199, wireframe: true }),
        );
        fence.position.y = 1.5;
        g.add(fence);
      }
      this.scenery.push(g);
      this.scene.add(g);
    }
    for (let i = 0; i < 32; i++) {
      const g = new T.Group();
      for (let row = 0; row < 4; row++) {
        const seats = new T.Mesh(
          new T.BoxGeometry(10, 0.7, 1.3),
          new T.MeshStandardMaterial({ color: row % 2 ? 0xc4ccd3 : 0x3d536b }),
        );
        seats.position.set(0, row * 0.7, row * 1.3);
        g.add(seats);
      }
      const roof = new T.Mesh(
        new T.BoxGeometry(11, 0.18, 7),
        new T.MeshStandardMaterial({ color: 0xe8edef }),
      );
      roof.position.set(0, 4.8, 2);
      g.add(roof);
      for (const x of [-4.8, 4.8]) {
        const pole = new T.Mesh(
          new T.BoxGeometry(0.15, 4.8, 0.15),
          new T.MeshStandardMaterial({ color: 0x4d5663 }),
        );
        pole.position.set(x, 2.4, 2);
        g.add(pole);
      }
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
      step = 4,
      start = Math.floor(s.distance / step) * step - 12;
    for (const strip of this.strips) {
      const pos = strip.mesh.geometry.attributes.position as T.BufferAttribute;
      const a = pos.array as Float32Array;
      for (let i = 0; i < 120; i++) {
        const z0 = start + i * step,
          z1 = z0 + step,
          y = strip.height;
        const l0 = localTrack(z0, s.distance, strip.left),
          r0 = localTrack(z0, s.distance, strip.right),
          l1 = localTrack(z1, s.distance, strip.left),
          r1 = localTrack(z1, s.distance, strip.right);
        const v = [
          l0.x,
          y,
          l0.z,
          r0.x,
          y,
          r0.z,
          l1.x,
          y,
          l1.z,
          l1.x,
          y,
          l1.z,
          r0.x,
          y,
          r0.z,
          r1.x,
          y,
          r1.z,
        ];
        if (
          (strip.left === -5.95 || strip.left === 5.3) &&
          Math.floor(z0 / 4) % 2 === 0
        )
          v.fill(0);
        a.set(v, i * 18);
        (strip.mesh.geometry.attributes.uv.array as Float32Array).set(
          [0, z0 / 8, 2, z0 / 8, 0, z1 / 8, 0, z1 / 8, 2, z0 / 8, 2, z1 / 8],
          i * 12,
        );
      }
      pos.needsUpdate = true;
      strip.mesh.geometry.attributes.uv.needsUpdate = true;
    }
    let detailIndex = 0;
    this.detailedTraffic.forEach((m) => (m.visible = false));
    for (let i = 0; i < this.traffic.length; i++) {
      const c = this.model.traffic[i],
        m = this.traffic[i],
        z =
          ((((c.z - s.distance + TRACK_LENGTH / 2) % TRACK_LENGTH) +
            TRACK_LENGTH) %
            TRACK_LENGTH) -
          TRACK_LENGTH / 2;
      m.visible = z > -18 && z < 450;
      if (c.finishTime !== undefined) {
        m.visible = false;
        continue;
      }
      const p = localTrack(c.z, s.distance, c.lane);
      m.position.set(p.x, 0, p.z);
      m.rotation.y = -(trackHeading(c.z) - trackHeading(s.distance));
      m.traverse((o) => {
        if (o.name === 'wheel') o.rotation.x -= (c.speed * dt) / 0.36;
        if (o.name === 'brake' && o instanceof T.Mesh)
          (o.material as T.MeshStandardMaterial).emissiveIntensity =
            c.speed < (m.userData.previousSpeed ?? c.speed) - 0.01 ? 3.5 : 1;
      });
      m.userData.previousSpeed = c.speed;
      if (z > -18 && z < 150 && detailIndex < this.detailedTraffic.length) {
        const real = this.detailedTraffic[detailIndex++];
        real.visible = true;
        real.position.copy(m.position);
        real.rotation.copy(m.rotation);
        m.visible = false;
      }
    }
    this.scenery.forEach((m, i) => {
      const spacing = i < 48 ? 18 : 31,
        z =
          Math.floor(s.distance / spacing) * spacing +
          Math.floor((i < 48 ? i : i - 48) / 2) * spacing;
      const side = i % 2 ? 1 : -1,
        offset = i < 48 ? 8.5 : 22 + (i % 3) * 12;
      const p = localTrack(z, s.distance, offset * side);
      m.position.set(p.x, 0, p.z);
      m.rotation.y = -(trackHeading(z) - trackHeading(s.distance));
    });
    const finishDistance =
      Math.ceil((s.distance + 0.01) / TRACK_LENGTH) * TRACK_LENGTH;
    const f = localTrack(finishDistance, s.distance);
    this.finish.position.set(f.x, 0, f.z);
    this.finish.rotation.y = -(
      trackHeading(finishDistance) - trackHeading(s.distance)
    );
    this.finish.visible = finishDistance - s.distance < 450 || s.distance < 8;
    if (s.distance < 8) {
      const startLine = localTrack(0, s.distance);
      this.finish.position.set(startLine.x, 0, startLine.z);
    }
    this.camera.position.set(s.lateral - 0.3, 1.35, 0.25);
    const look = localTrack(s.distance + 45, s.distance, s.lateral - 0.3);
    this.camera.lookAt(look.x + s.input.steer * 0.5, 1.2, look.z);
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
    this.disposed = true;
    this.cockpit.disposed = true;
    this.releaseLook();
    this.notice.dispose();
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
