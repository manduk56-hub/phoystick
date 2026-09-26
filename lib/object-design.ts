import * as T from 'three';
import { rounded, finish } from './surface.ts';

function part(
  root: T.Object3D,
  geometry: T.BufferGeometry,
  material: T.Material,
  x = 0,
  y = 0,
  z = 0,
  name = '',
) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}
const metal = (color: number) => finish(color, 'metal');
const glow = (color: number) =>
  new T.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2,
    roughness: 0.25,
  });

// Segmented shells keep highlights and silhouettes readable from gameplay cameras.
export function sentinel() {
  const root = new T.Group();
  part(root, rounded(0.72, 0.72, 0.42, 0.09), metal(0x34444c), 0, 1.25);
  part(root, rounded(0.5, 0.32, 0.09), metal(0xc6d2ce), 0, 1.38, 0.25);
  part(
    root,
    new T.TorusGeometry(0.105, 0.028, 12, 32),
    metal(0x263238),
    0,
    1.28,
    0.31,
  );
  part(
    root,
    new T.SphereGeometry(0.075, 24, 16),
    glow(0xefb85c),
    0,
    1.28,
    0.32,
    'reactor',
  );
  part(
    root,
    rounded(0.46, 0.39, 0.4, 0.065),
    metal(0xa8b5b5),
    0,
    1.91,
    0,
    'Yeti_Head',
  ).userData.head = true;
  part(
    root,
    rounded(0.37, 0.095, 0.05, 0.018),
    glow(0xffb95c),
    0,
    1.95,
    0.218,
    'visor',
  ).userData.head = true;
  part(
    root,
    new T.CylinderGeometry(0.09, 0.1, 0.2, 24),
    metal(0x18262e),
    0,
    1.65,
  );
  part(root, rounded(0.42, 0.2, 0.31), metal(0x1b2932), 0, 0.78);
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.name = side < 0 ? 'Yeti_LeftLeg' : 'Yeti_RightLeg';
    leg.position.set(side * 0.22, 0.75, 0);
    root.add(leg);
    part(leg, rounded(0.22, 0.34, 0.24, 0.04), metal(0x697e83), 0, -0.17);
    part(leg, new T.SphereGeometry(0.115, 24, 16), metal(0x162329), 0, -0.37);
    part(leg, rounded(0.19, 0.28, 0.21), metal(0xb2c0bd), 0, -0.55);
    part(leg, rounded(0.26, 0.12, 0.4), metal(0x263640), 0, -0.71, 0.07);
    part(
      root,
      new T.SphereGeometry(0.19, 24, 16),
      metal(0xb2c0bd),
      side * 0.48,
      1.5,
    );
    const arm = part(
      root,
      rounded(0.22, 0.58, 0.25),
      metal(0x556e77),
      side * 0.51,
      1.14,
      0.1,
    );
    arm.rotation.x = -0.35;
    part(
      root,
      rounded(0.24, 0.19, 0.26),
      metal(0x192b34),
      side * 0.51,
      0.86,
      0.21,
    );
  }
  return root;
}

export function riverFish() {
  const root = new T.Group();
  // A lathed profile gives the body a real taper, belly and narrow tail peduncle.
  const profile = [
    [0, -1.05],
    [0.12, -0.9],
    [0.28, -0.6],
    [0.36, -0.2],
    [0.32, 0.3],
    [0.19, 0.7],
    [0.07, 1.0],
  ].map(([r, z]) => new T.Vector2(r, z));
  const body = new T.LatheGeometry(profile, 48);
  body.rotateX(Math.PI / 2);
  body.scale(0.65, 1, 1);
  part(root, body, finish(0x7caaa0, 'scales'));
  function fin(
    points: number[],
    x: number,
    y: number,
    z: number,
    rotation = 0,
  ) {
    const shape = new T.Shape();
    shape.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2)
      shape.lineTo(points[i], points[i + 1]);
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      steps: 1,
    });
    const m = part(root, g, finish(0x436e68, 'scales'), x, y, z);
    m.rotation.y = rotation;
  }
  fin([0, 0, -0.34, 0.38, -0.26, 0, -0.34, -0.38], 0, 0, -1, Math.PI / 2);
  fin([0, 0, 0.45, 0, 0.3, 0.32, 0.1, 0.23], 0, 0.25, -0.25, Math.PI / 2);
  for (const side of [-1, 1]) {
    part(
      root,
      new T.SphereGeometry(0.061, 24, 16),
      metal(0xd8cf9d),
      side * 0.15,
      0.09,
      0.78,
    );
    part(
      root,
      new T.SphereGeometry(0.038, 24, 16),
      new T.MeshPhysicalMaterial({
        color: 0x07191e,
        roughness: 0.08,
        clearcoat: 1,
      }),
      side * 0.19,
      0.09,
      0.79,
    );
    fin([0, 0, 0.3, -0.12, 0.12, -0.23], side * 0.17, -0.1, 0.4, side * 0.8);
  }
  return root;
}

export function trackCar(color: number) {
  const root = new T.Group();
  const paint = new T.MeshPhysicalMaterial({
    color,
    metalness: 0.55,
    roughness: 0.23,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  part(root, rounded(1.72, 0.36, 3.65, 0.12), paint, 0, 0.58);
  part(root, rounded(1.5, 0.16, 1.12, 0.06), paint, 0, 0.82, -1.14).rotation.x =
    -0.07;
  const glass = new T.MeshPhysicalMaterial({
    color: 0x172e39,
    metalness: 0.35,
    roughness: 0.1,
    clearcoat: 1,
  });
  part(root, rounded(1.34, 0.58, 1.65, 0.2), glass, 0, 1.04, 0.12);
  part(root, rounded(1.22, 0.06, 1.03, 0.025), paint, 0, 1.34, 0.19);
  for (const side of [-1, 1]) {
    part(root, rounded(0.12, 0.12, 2.9), metal(0x16232a), side * 0.82, 0.4);
    part(root, rounded(0.18, 0.12, 0.28), paint, side * 0.86, 1.01, -0.42);
    for (const z of [-1.13, 1.16]) {
      const wheel = new T.Group();
      wheel.name = 'wheel';
      wheel.position.set(side * 0.87, 0.37, z);
      root.add(wheel);
      const tire = part(
        wheel,
        new T.CylinderGeometry(0.36, 0.36, 0.23, 40),
        new T.MeshStandardMaterial({ color: 0x11191d, roughness: 0.94 }),
      );
      tire.rotation.z = Math.PI / 2;
      const rim = part(
        wheel,
        new T.CylinderGeometry(0.25, 0.25, 0.245, 32),
        metal(0x89999e),
      );
      rim.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const spoke = part(
          wheel,
          rounded(0.255, 0.045, 0.4, 0.01),
          metal(0x26353e),
        );
        spoke.rotation.x = (i * Math.PI) / 5;
      }
    }
    part(
      root,
      rounded(0.48, 0.07, 0.05),
      glow(0xc9efff),
      side * 0.54,
      0.73,
      -1.84,
    );
    part(
      root,
      rounded(0.49, 0.065, 0.05),
      glow(0xed5d53),
      side * 0.54,
      0.73,
      1.84,
      'brake',
    );
  }
  part(root, rounded(1.35, 0.12, 0.065), metal(0x18272f), 0, 0.51, -1.85);
  part(root, rounded(1.8, 0.055, 0.34), metal(0x25353d), 0, 1.02, 1.55);
  return root;
}
