import * as T from 'three';
import { finish } from './surface.ts';

// All meshes share a longitudinal X axis, so fins and skin deform together.
export function createFish(id: number) {
  const group = new T.Group();
  const profiles = [
    [0xb79a53, 0.43, 0.23],
    [0x98b6b2, 0.3, 0.19],
    [0x9a9983, 0.51, 0.18],
    [0xb79962, 0.38, 0.28],
    [0x778e48, 0.32, 0.22],
    [0x869d98, 0.26, 0.22],
  ];
  const [color, height, width] = profiles[id] ?? profiles[0];
  const body = new T.SphereGeometry(1, 64, 32);
  const p = body.attributes.position;
  const colors = [];
  const back = new T.Color(color).multiplyScalar(0.48);
  const flank = new T.Color(color);
  const belly = new T.Color(0xe5dec5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const taper = 0.75 + 0.25 * x;
    p.setXYZ(i, x, y * height * taper, z * width * taper);
    const c =
      y > 0 ? flank.clone().lerp(back, y) : flank.clone().lerp(belly, -y);
    if (id === 4 && Math.sin(x * 23) > 0.45 && y > -0.45)
      c.multiplyScalar(0.55);
    if (id === 5) {
      c.lerp(new T.Color(0xcb8391), Math.exp(-y * y * 35) * 0.5);
      if (y > -0.25 && Math.sin(x * 97 + z * 153) * Math.cos(y * 79) > 0.72)
        c.multiplyScalar(0.3);
    }
    colors.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  body.computeVertexNormals();
  const skin = finish(0xffffff, 'scales');
  skin.vertexColors = true;
  group.add(new T.Mesh(body, skin));
  const finMaterial = new T.MeshPhysicalMaterial({
    color: id === 1 || id === 4 ? 0xc27743 : color,
    side: T.DoubleSide,
    transparent: true,
    opacity: 0.82,
    roughness: 0.4,
  });
  const fin = (points: number[][]) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(points.flat(), 3),
    );
    const indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    group.add(new T.Mesh(geometry, finMaterial));
    // Fine rays give the membrane a visible structure in the catch view.
    const rays = points.slice(1).flatMap((point) => [...points[0], ...point]);
    group.add(
      new T.LineSegments(
        new T.BufferGeometry().setAttribute(
          'position',
          new T.Float32BufferAttribute(rays, 3),
        ),
        new T.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }),
      ),
    );
  };
  fin([
    [-0.85, 0, 0],
    [-1.48, 0.36, 0],
    [-1.33, 0.08, 0],
    [-1.33, -0.08, 0],
    [-1.48, -0.36, 0],
  ]);
  fin([
    [0.15, height * 0.83, 0],
    [-0.12, height + 0.24, 0],
    [-0.55, height + 0.12, 0],
    [-0.67, height * 0.55, 0],
  ]);
  for (const side of [-1, 1]) {
    fin([
      [0.3, -0.08, side * width * 0.8],
      [-0.22, -0.3, side * (width + 0.25)],
      [-0.05, -0.13, side * width],
    ]);
    fin([
      [-0.25, -height * 0.8, 0],
      [-0.65, -height - 0.16, side * 0.12],
      [-0.7, -height * 0.65, 0],
    ]);
    const eye = new T.Mesh(
      new T.SphereGeometry(0.065, 16, 12),
      new T.MeshPhysicalMaterial({ color: 0xcdb56d, roughness: 0.18 }),
    );
    eye.position.set(0.72, 0.09, side * width * 0.67);
    group.add(eye);
    const pupil = new T.Mesh(
      new T.SphereGeometry(0.036, 12, 10),
      new T.MeshPhysicalMaterial({
        color: 0x071016,
        roughness: 0.08,
        clearcoat: 1,
      }),
    );
    pupil.position
      .copy(eye.position)
      .add(new T.Vector3(0.014, 0, side * 0.045));
    group.add(pupil);
    const gill = new T.EllipseCurve(0.45, 0, 0.085, height * 0.65, -1.3, 1.3);
    const curve = gill
      .getPoints(24)
      .map((v) => new T.Vector3(v.x, v.y, side * width * 0.87));
    group.add(
      new T.Line(
        new T.BufferGeometry().setFromPoints(curve),
        new T.LineBasicMaterial({ color: 0x504a3c }),
      ),
    );
  }
  const mouth = new T.Mesh(
    new T.TorusGeometry(0.065, 0.016, 8, 20),
    finish(color, 'skin'),
  );
  mouth.rotation.y = Math.PI / 2;
  mouth.position.x = 0.98;
  group.add(mouth);
  return group;
}

export class RodSpring {
  bend = 0;
  velocity = 0;
  update(target: number, dt: number, gear: number) {
    // Substeps keep the damped spring stable during slow rendering frames.
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity +=
        ((target - this.bend) * (95 + gear * 30) - this.velocity * 13) * h;
      this.bend += this.velocity * h;
    }
    return this.bend;
  }
}
