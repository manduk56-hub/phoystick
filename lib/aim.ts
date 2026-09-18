export type Angle = { yaw: number; pitch: number };
export const CALIBRATION_TARGETS = [
  { name: '중앙', x: 0.5, y: 0.5 },
  { name: '왼쪽 위 모서리', x: 0.04, y: 0.04 },
  { name: '오른쪽 위 모서리', x: 0.96, y: 0.04 },
  { name: '오른쪽 아래 모서리', x: 0.96, y: 0.96 },
  { name: '왼쪽 아래 모서리', x: 0.04, y: 0.96 },
];
const wrap = (n: number) => ((n + 540) % 360) - 180;
function relative(a: Angle, c: Angle) {
  return { x: wrap(a.yaw - c.yaw), y: a.pitch - c.pitch };
}
function cross(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.y - a.y * b.x;
}
export function validCalibration(points: Angle[]) {
  if (
    points.length !== 5 ||
    points.some((p) => !Number.isFinite(p.yaw) || !Number.isFinite(p.pitch))
  )
    return false;
  const corners = points.slice(1).map((p) => relative(p, points[0]));
  const turns = corners.map((a, i) => cross(a, corners[(i + 1) % 4]));
  // A convex, consistently ordered screen boundary must enclose the centre.
  return turns.every((v) => v > 4) || turns.every((v) => v < -4);
}
export function mapAim(a: Angle, points: Angle[]) {
  if (!validCalibration(points)) return { x: 0.5, y: 0.5 };
  const p = relative(a, points[0]);
  let best = { penalty: Infinity, x: 0.5, y: 0.5 };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const u = relative(points[i + 1], points[0]),
      v = relative(points[j + 1], points[0]);
    const det = cross(u, v),
      s = cross(p, v) / det,
      t = cross(u, p) / det;
    const penalty = Math.max(0, -s) + Math.max(0, -t) + Math.max(0, s + t - 1);
    const A = CALIBRATION_TARGETS[i + 1],
      B = CALIBRATION_TARGETS[j + 1];
    if (penalty < best.penalty)
      best = {
        penalty,
        x: 0.5 + s * (A.x - 0.5) + t * (B.x - 0.5),
        y: 0.5 + s * (A.y - 0.5) + t * (B.y - 0.5),
      };
  }
  return {
    x: Math.max(0, Math.min(1, best.x)),
    y: Math.max(0, Math.min(1, best.y)),
  };
}
