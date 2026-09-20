export const ROUTE_LENGTH = 240;
export const SECTORS = ['격리 지구', '폐쇄 도로', '철도 터널', '구조 지점'];
export const sectorAt = (distance: number) => Math.min(3, Math.floor(Math.max(0, distance) / 60));
export type Barrier = { x: number; z: number; width: number; depth: number };
export const BARRIERS: Barrier[] = Array.from({ length: 10 }, (_, i) => ({
  x: i % 2 ? 3.5 : -3.5, z: -16 - i * 21, width: 3, depth: 2.5,
}));
export function canStand(x: number, z: number) {
  return Math.abs(x) <= 6.5 && z <= 7 && z >= 7 - ROUTE_LENGTH &&
    !BARRIERS.some(b => Math.abs(x - b.x) < b.width / 2 + 0.4 && Math.abs(z - b.z) < b.depth / 2 + 0.4);
}
