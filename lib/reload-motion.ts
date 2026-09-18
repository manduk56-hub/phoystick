// Shared timeline for the first-person weapon and the phone's side view.
export const RELOAD_SECONDS = [0, 0.85, 1.05, 0.9];
export const RELOAD_NAMES = [
  '',
  '탄창 분리 중',
  '새 탄창 삽입 중',
  '슬라이드 후퇴 · 전진',
];
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
export function reloadPose(stage: number, phase = 0, progress = 0) {
  const p = Math.max(0, Math.min(1, progress));
  let drop = stage === 1 ? 1 : 0,
    pull = 0,
    tilt = stage ? 1 : 0,
    hand = stage === 1 ? 1 : 0;
  if (phase === 1) {
    tilt = smooth(p / 0.28);
    drop = smooth((p - 0.2) / 0.7);
    hand = smooth(p / 0.18);
  }
  if (phase === 2) {
    tilt = 1;
    drop = 1 - smooth((p - 0.12) / 0.7);
    hand = 1 - smooth((p - 0.84) / 0.16);
  }
  if (phase === 3) {
    tilt = 1 - smooth((p - 0.7) / 0.3);
    pull = smooth((p - 0.18) / 0.28) * (1 - smooth((p - 0.58) / 0.12));
    hand = smooth(p / 0.16) * (1 - smooth((p - 0.72) / 0.28));
  }
  return { drop, pull, tilt, hand, rack: phase === 3 };
}
