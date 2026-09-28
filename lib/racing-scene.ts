import { buildCircuit } from './racing-circuit.ts';
import { trackCar } from './object-design.ts';
import * as T from 'three';
import {
  cinematicLight,
  scannedMaterial,
  assetNotice,
  gameModel,
  fitModel,
  disposeModel,
} from './graphics-assets.ts';
import { Cockpit } from './racing-cockpit.ts';

import {
  RacingModel,
  localTrack,
  trackHeading,
  TRACK_LENGTH,
  trackPoint,
  type RaceState,
} from './racing-model.ts';

const car = trackCar;
export class RacingScene {
  model = new RacingModel();
  circuit = buildCircuit();
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, 1, 0.1, 2000);
  renderer: T.WebGLRenderer;
  cockpit: Cockpit;
  traffic: T.Group[] = [];
  finish = new T.Group();
  disposed = false;
  releaseLook: () => void;
  notice: ReturnType<typeof assetNotice>;
  player = car(0xffbc24);
  cameraMode: 'chase' | 'far' | 'hood' | 'cockpit' | 'overview' = 'chase';
  cameraTarget = new T.Vector3();
  raceFog = new T.Fog(0xaebcc4, 250, 1100);
  cycleCamera() {
    const modes = ['chase', 'far', 'hood', 'cockpit', 'overview'] as const;
    this.cameraMode = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
    return this.cameraMode;
  }
  async loadExterior(target: T.Group, color?: number) {
    const asset = await gameModel('car');
    if (this.disposed) { disposeModel(asset.scene); return; }
    asset.scene.rotation.y = Math.PI;
    asset.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(material instanceof T.MeshStandardMaterial)) continue;
        if (color !== undefined && /^Paint 1 /.test(material.name))
          material.color.setHex(color);
        material.envMapIntensity = 1.1;
        if (material.name === 'Brakelight') {
          material.emissive.setHex(0xff2318);
          material.emissiveIntensity = 0.7;
        }
      }
    });
    const detailed = fitModel(asset.scene, 4.5, 'z');
    for (const child of [...target.children]) {
      target.remove(child);
      disposeModel(child);
    }
    target.add(detailed);
    target.userData.detailed = true;
  }
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

    this.camera.add(this.cockpit);
    this.scene.add(this.camera);
    this.scene.add(this.player);
    this.camera.position.set(-0.3, 1.35, 0.25);
    this.scene.fog = this.raceFog;
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
      const angle = i / 15 * Math.PI * 2;
      mountain.position.set(Math.cos(angle) * 850, 15, Math.sin(angle) * 850);
      this.circuit.add(mountain);
    }
    this.scene.add(this.circuit);
    this.traffic = this.model.traffic.map((c) => {
      const m = car(c.color);
      this.scene.add(m);
      return m;
    });
    void Promise.all([
      this.cockpit.loadDetailed(),
      this.loadExterior(this.player),
      ...this.traffic.map((vehicle, i) =>
        this.loadExterior(vehicle, this.model.traffic[i].color)),
    ]).then(() => { if (!this.disposed) this.notice.done(); })
      .catch(() => { if (!this.disposed) this.notice.fail(); });
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
    const startPoint = trackPoint(0);
    this.finish.position.set(startPoint.x, 0, -startPoint.z);
    this.finish.rotation.y = -trackHeading(0);
    this.circuit.add(this.finish);
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
    const s = this.model.state;
    const origin = trackPoint(s.distance), heading = trackHeading(s.distance);
    this.circuit.rotation.y = heading;
    this.circuit.position.set(-origin.x*Math.cos(heading)+origin.z*Math.sin(heading), 0, origin.x*Math.sin(heading)+origin.z*Math.cos(heading));
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
        if (o instanceof T.Mesh) {
          for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
            if (material instanceof T.MeshStandardMaterial && material.name === 'Brakelight')
              material.emissiveIntensity = c.speed < (m.userData.previousSpeed ?? c.speed) - 0.01 ? 3.5 : 0.7;
          }
        }
      });
      m.userData.previousSpeed = c.speed;
    }
    const inside = this.cameraMode === 'cockpit';
    const chase = this.cameraMode === 'chase' || this.cameraMode === 'far';
    this.cockpit.visible = inside;
    this.player.visible = chase;
    this.player.position.set(s.lateral, 0.04, 0);
    this.player.rotation.set(0, -this.model.steering * 0.10, -this.model.steering * s.speed * 0.0005);
    this.player.traverse((o) => {
      if (o.name === 'wheel') o.rotation.x -= s.speed * dt / 0.36;
      if (o.name === 'brake' && o instanceof T.Mesh)
        (o.material as T.MeshStandardMaterial).emissiveIntensity = s.input.brake > 0 ? 4 : 1;
    });
    const far = this.cameraMode === 'far';
    const speedRatio = Math.min(1, s.speed / 65);
    const desired = new T.Vector3(
      s.lateral - (chase ? this.model.steering * 0.45 : inside ? 0.3 : 0),
      chase ? (far ? 3.8 : 2.65) : inside ? 1.35 : 1.05,
      chase ? (far ? 10.5 : 7.0) + speedRatio * 1.2 : inside ? 0.25 : -1.65,
    );
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
    this.camera.up.set(0,1,0);
    const look = localTrack(s.distance + (chase ? 22 : 45), s.distance, s.lateral);
    this.cameraTarget.set(look.x, chase ? 0.95 : 1.2, look.z);
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov = chase ? 56 + speedRatio * 9 : 68;
    if (this.cameraMode === 'overview') {
      this.player.visible = true;
      this.camera.position.set(this.circuit.position.x, 930, this.circuit.position.z + 0.01);
      this.camera.up.set(-Math.sin(heading),0,-Math.cos(heading));
      this.camera.lookAt(this.circuit.position.x, 0, this.circuit.position.z);
      this.camera.fov = 58;
    }
    this.scene.fog = this.cameraMode === 'overview' ? null : this.raceFog;
    this.cockpit.update(s.speed, this.model.steering, this.camera.aspect);
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
