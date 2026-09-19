import * as T from 'three';
import { gameModel, disposeModel } from './graphics-assets.ts';
import { rounded, finish } from './surface.ts';

export class Cockpit extends T.Group {
  wheel = new T.Group();
  pillars: T.Mesh[] = [];
  display: HTMLCanvasElement;
  texture: T.CanvasTexture;
  lastSpeed = -1;
  disposed = false;
  screen!: T.Mesh;
  async loadDetailed() {
    const asset = await gameModel('car');
    if (this.disposed) {
      disposeModel(asset.scene);
      return;
    }
    for (const child of [...this.children]) {
      if (child !== this.screen) {
        this.remove(child);
        disposeModel(child);
      }
    }
    this.pillars = [];
    const body = asset.scene;
    body.rotation.y = Math.PI;
    body.position.set(0, -0.96, 0.35);
    this.add(body);
    body.traverse((o) => {
      if (/BodyRoofPanel|InteriorSeats|InteriorRear|InteriorCage/.test(o.name))
        o.visible = false;
      if (o instanceof T.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof T.MeshStandardMaterial) {
            m.envMapIntensity = 1.1;
            m.fog = false;
            if (m.name === 'Glass') {
              m.transparent = true;
              m.opacity = 0.07;
              m.depthWrite = false;
              if (m instanceof T.MeshPhysicalMaterial) m.transmission = 0;
            }
          }
        }
      }
    });
    body.updateMatrixWorld(true);
    const parts: T.Object3D[] = [];
    body.traverse((o) => {
      if (/^InteriorSteeringWheel|^InteriorSteeringEmblem/.test(o.name))
        parts.push(o);
    });
    this.wheel = new T.Group();
    this.wheel.position.set(0, -0.306, -0.585);
    this.add(this.wheel);
    this.updateMatrixWorld(true);
    parts.forEach((o) => this.wheel.attach(o));
    this.screen.scale.set(0.39, 0.39, 1);
    this.screen.position.set(0, -0.193, -0.873);
  }
  constructor() {
    super();
    const panel = (
      w: number,
      h: number,
      d: number,
      color: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new T.Mesh(rounded(w, h, d), finish(color, 'fabric'));
      m.position.set(x, y, z);
      this.add(m);
      return m;
    };
    panel(4.6, 0.62, 0.75, 0x18212b, 0, -0.92, -1.65);
    panel(4.5, 0.055, 0.05, 0x536574, 0, -0.64, -1.25);
    panel(1.08, 0.34, 0.19, 0x111923, -0.27, -0.6, -1.4);
    for (const x of [-0.96, 0.72, 1.08]) {
      panel(0.23, 0.105, 0.045, 0x080e14, x, -0.73, -1.22);
      for (let i = 0; i < 4; i++)
        panel(0.2, 0.008, 0.025, 0x56606a, x, -0.77 + i * 0.025, -1.19);
    }
    for (const x of [-1, 1]) {
      const p = panel(0.11, 2.5, 0.15, 0x242d38, x * 1.55, 0.15, -1.6);
      p.rotation.z = x * 0.21;
      this.pillars.push(p);
    }
    panel(4.5, 0.19, 0.22, 0x212a34, 0, 1.02, -1.6);
    const leather = finish(0x151d24, 'fabric');
    const ring = new T.Mesh(new T.TorusGeometry(0.285, 0.037, 16, 64), leather);
    this.wheel.add(ring);
    for (const a of [0, Math.PI, Math.PI * 1.5]) {
      const spoke = new T.Mesh(rounded(0.055, 0.24, 0.035), finish(0x58616a));
      spoke.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0);
      spoke.rotation.z = a - Math.PI / 2;
      this.wheel.add(spoke);
    }
    const hub = new T.Mesh(
      rounded(0.19, 0.15, 0.07),
      finish(0x212c37, 'fabric'),
    );
    hub.position.z = 0.025;
    this.wheel.add(hub);
    const stripe = new T.Mesh(rounded(0.026, 0.045, 0.044), finish(0xff835c));
    stripe.position.y = 0.282;
    this.wheel.add(stripe);
    this.wheel.position.set(-0.25, -0.48, -0.93);
    this.add(this.wheel);
    this.display = document.createElement('canvas');
    this.display.width = 512;
    this.display.height = 128;
    this.texture = new T.CanvasTexture(this.display);
    this.texture.colorSpace = T.SRGBColorSpace;
    const screen = new T.Mesh(
      new T.PlaneGeometry(0.85, 0.21),
      new T.MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    screen.position.set(-0.27, -0.56, -1.295);
    this.screen = screen;
    this.add(screen);
    this.traverse((o) => {
      if (o instanceof T.Mesh) {
        (o.material as T.Material & { fog: boolean }).fog = false;
      }
    });
    this.update(0, 0, 1.7);
  }
  update(speed: number, steer: number, aspect: number) {
    this.wheel.rotation.z = -steer * 1.4;
    const edge = Math.max(0.62, Math.min(1.8, aspect * 0.94));
    this.pillars.forEach((p, i) => (p.position.x = (i ? 1 : -1) * edge));
    const value = Math.round(speed * 3.6);
    if (value === this.lastSpeed) return;
    this.lastSpeed = value;
    const c = this.display.getContext('2d')!;
    c.fillStyle = '#0b1420';
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#82d4ed';
    c.font = '16px Arial';
    c.fillText('APEX  /  DRIVE', 18, 26);
    c.fillStyle = '#effbff';
    c.font = 'bold 66px monospace';
    c.fillText(String(value).padStart(3, '0'), 180, 85);
    c.font = '15px Arial';
    c.fillText('KM/H', 330, 84);
    c.fillStyle = '#ff986e';
    c.fillRect(18, 106, Math.max(3, (value / 224) * 476), 5);
    this.texture.needsUpdate = true;
  }
}
