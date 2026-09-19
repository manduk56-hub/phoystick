import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function rounded(
  w: number,
  h: number,
  d: number,
  r = Math.min(w, h, d) * 0.22,
) {
  return new RoundedBoxGeometry(w, h, d, 4, r);
}
const maps = new Map<string, T.DataTexture>();
export function grain(
  kind: 'skin' | 'fabric' | 'metal' | 'scales' | 'cork' = 'metal',
) {
  if (maps.has(kind)) return maps.get(kind)!;
  const size = 128,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const noise =
        (((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1) + 1) % 1;
      let v = 128 + (noise - 0.5) * 35;
      if (kind === 'fabric')
        v += 25 * Math.sin((x * Math.PI) / 2) * Math.sin((y * Math.PI) / 2);
      if (kind === 'metal') v = 128 + (noise - 0.5) * 13 + 9 * Math.sin(y * 2);
      if (kind === 'scales') {
        const row = Math.floor(y / 12),
          dx = ((x + (row % 2) * 8) % 16) - 8,
          dy = y % 12;
        v =
          115 +
          55 * Math.cos((Math.hypot(dx, dy - 3) / 10) * Math.PI) +
          (noise - 0.5) * 10;
      }
      if (kind === 'cork') v = 145 + (noise > 0.82 ? -65 : (noise - 0.5) * 30);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, v));
      data[i + 3] = 255;
    }
  const map = new T.DataTexture(data, size, size);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  maps.set(kind, map);
  return map;
}
export function finish(
  color: number,
  kind: 'skin' | 'fabric' | 'metal' | 'scales' | 'cork' = 'metal',
) {
  return new T.MeshPhysicalMaterial({
    color,
    roughness: kind === 'metal' ? 0.34 : kind === 'scales' ? 0.3 : 0.78,
    metalness: kind === 'metal' ? 0.65 : kind === 'scales' ? 0.18 : 0,
    bumpMap: grain(kind),
    bumpScale: kind === 'metal' ? 0.008 : 0.018,
    clearcoat: kind === 'scales' ? 0.7 : kind === 'metal' ? 0.3 : 0,
    clearcoatRoughness: 0.25,
  });
}
export function organic(w: number, h: number, d: number) {
  const g = new T.SphereGeometry(1, 28, 20);
  g.scale(w / 2, h / 2, d / 2);
  return g;
}
