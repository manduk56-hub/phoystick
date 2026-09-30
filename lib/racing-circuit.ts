import * as T from 'three';
import { TRACK_SAMPLES, trackPosition, trackHeading } from './racing-model.ts';
import { scannedMaterial } from './graphics-assets.ts';

// All geometry is fixed in circuit space (x, -z). The scene rotates this one
// group around the driver; no road segments or landmarks are recycled.
export function buildCircuit() {
  const root = new T.Group();
  root.name = 'permanent-circuit';
  const ribbon = (left: number, right: number, height: number, material: T.Material, alternating = false, start = 0, end = 2400) => {
    const vertices: number[] = [], uv: number[] = [];
    for (let i = 0; i < TRACK_SAMPLES.length - 1; i++) {
      if (alternating && i % 2 === 0) continue;
      const d0 = TRACK_SAMPLES[i].distance, d1 = TRACK_SAMPLES[i+1].distance;
      if(d0 < start || d1 > end) continue;
      const a = trackPosition(d0, left), b = trackPosition(d0, right);
      const c = trackPosition(d1, left), d = trackPosition(d1, right);
      for (const p of [a, b, c, c, b, d]) vertices.push(p.x, height, -p.z);
      uv.push(0,d0/8,2,d0/8,0,d1/8,0,d1/8,2,d0/8,2,d1/8);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    material.side = T.DoubleSide;
    const mesh = new T.Mesh(geometry, material);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const flat = (color: number) => new T.MeshStandardMaterial({color, roughness: 0.95});
  ribbon(-16,16,0.005,flat(0xc0b298));
  const road = ribbon(-5.3,5.3,0.025,scannedMaterial('asphalt_02'));
  road.name = 'circuit-road';
  ribbon(-6.1,-5.3,0.035,flat(0xeeeeea));
  ribbon(5.3,6.1,0.035,flat(0xeeeeea));
  ribbon(-6.1,-5.3,0.04,flat(0xe43c44),true);
  ribbon(5.3,6.1,0.04,flat(0xe43c44),true);
  ribbon(-5.2,-5.05,0.045,flat(0xffffff));
  ribbon(5.05,5.2,0.045,flat(0xffffff));

  const box = (parent: T.Object3D, w: number,h: number,d: number,color: number,x=0,y=0,z=0) => {
    const m = new T.Mesh(new T.BoxGeometry(w,h,d),flat(color));
    m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const landmark = (distance: number,lateral: number) => {
    const g = new T.Group(), p = trackPosition(distance,lateral);
    g.position.set(p.x,0,-p.z); g.rotation.y = -trackHeading(distance);
    root.add(g); return g;
  };
  // Continuous fixed barriers around both sides of the whole lap.
  for (let i=0; i<600; i++) for (const side of [-1,1]) {
    const a = trackPosition(TRACK_SAMPLES[i].distance,side*17);
    const b = trackPosition(TRACK_SAMPLES[i+1].distance,side*17);
    const wall = box(root,0.35,0.85,Math.hypot(b.x-a.x,b.z-a.z)+0.08,
      Math.floor(i/5)%2 ? 0xf1f0ea : 0x344956,(a.x+b.x)/2,0.43,-(a.z+b.z)/2);
    wall.rotation.y = Math.atan2(-(b.x-a.x),b.z-a.z);
  }
  // Pit lane and garages alongside the start straight; fixed grid and line.
  ribbon(-12.15,-7.85,0.05,flat(0x555a60),false,8,120);
  ribbon(-12.15,-12,0.06,flat(0xffffff),false,8,120);
  ribbon(-8,-7.85,0.06,flat(0xffffff),false,8,120);
  for (let i=0;i<8;i++) {
    const garage = landmark(15+i*13,-24);
    box(garage,9,4.5,12,0xc1c8cb,0,2.25);
    box(garage,0.1,2.8,9,0x273744,4.55,1.4);
    box(garage,11,0.3,13,0xf0f1ee,0,4.65);
  }
  const tower = landmark(120,-29);
  box(tower,10,13,10,0xe3e6e3,0,6.5);
  box(tower,11,3,11,0x314c60,0,12);
  for (const distance of [30,75,120,660,1120,1740]) {
    const stand = landmark(distance,27);
    for (let row=0;row<6;row++) box(stand,1.4,0.7,32,row%2?0xe9eae7:0x294e70,row*1.4,row*0.7+0.35);
    box(stand,11,0.25,34,0xe6e9e9,3.5,6);
    for (const z of [-15,15]) box(stand,0.2,6,0.2,0x53616b,3.5,3,z);
  }
  const line = landmark(0,0);
  for (let x=0;x<12;x++) for(let z=0;z<2;z++)
    box(line,0.88,0.025,0.55,(x+z)%2?0xffffff:0x17212a,-4.85+x*0.88,0.07,z*0.55);
  for(let i=0;i<8;i++) {
    const grid = landmark(-8-Math.floor(i/2)*9,i%2?2.5:-2.5);
    box(grid,1.8,0.02,0.12,0xffffff,0,0.06);
  }
  const start = trackPosition(0);
  root.userData.start = start;

  // The fixed barriers and buildings used to submit over a thousand draw calls.
  // Bake their transforms into a handful of instanced batches by color.
  root.updateMatrixWorld(true);
  const boxes = new Map<number, T.Matrix4[]>();
  const originals: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[] = [];
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) ||
        !(object.geometry instanceof T.BoxGeometry) ||
        !(object.material instanceof T.MeshStandardMaterial)) return;
    const { width, height, depth } = object.geometry.parameters;
    const matrix = object.matrixWorld.clone().multiply(
      new T.Matrix4().makeScale(width, height, depth),
    );
    const color = object.material.color.getHex();
    const batch = boxes.get(color) ?? [];
    batch.push(matrix);
    boxes.set(color, batch);
    originals.push(object as T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>);
  });
  for (const mesh of originals) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  for (const [color, transforms] of boxes) {
    const batch = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1), flat(color), transforms.length,
    );
    transforms.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingSphere();
    batch.castShadow = batch.receiveShadow = true;
    root.add(batch);
  }
  return root;
}
