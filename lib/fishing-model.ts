export {
  FishingModel,
  phaseText,
  spots,
  baits,
  rigs,
  species,
  equipment,
  hooks,
  leaders,
} from './fishing-simulation.ts';
export type {
  FishingState,
  FishingPhase,
  CatchRecord,
} from './fishing-simulation.ts';
// Rotation about the phone's width axis. A deliberate backswing must precede release.
export class CastGesture {
  stage: 'idle' | 'back' | 'armed' = 'idle';
  travel = 0;
  forward = 0;
  started = 0;
  last = 0;
  cooldown = 0;
  reset() {
    this.stage = 'idle';
    this.travel = 0;
    this.forward = 0;
    this.started = 0;
    this.last = 0;
  }
  update(rate: number, now: number): { cast: number | null; stage: string } {
    if (!Number.isFinite(rate)) return { cast: null, stage: this.stage };
    const dt = this.last
      ? Math.max(0, Math.min(0.05, (now - this.last) / 1000))
      : 0.016;
    this.last = now;
    if (now < this.cooldown) return { cast: null, stage: 'idle' };
    if (this.stage !== 'idle' && now - this.started > 3500) {
      this.reset();
      this.last = now;
    }
    if (this.stage === 'idle' && rate > 30) {
      this.stage = 'back';
      this.started = now;
      this.travel = 0;
    }
    if (this.stage === 'back') {
      if (rate > 10) this.travel += rate * dt;
      if (this.travel >= 38) this.stage = 'armed';
      else if (rate < -70) {
        this.reset();
        this.last = now;
      }
    }
    if (this.stage === 'armed') {
      if (rate < -50) this.forward += -rate * dt;
      if (rate < -130 && this.forward > 15) {
        const power = Math.max(0.15, Math.min(1, (-rate - 80) / 350));
        this.reset();
        this.last = now;
        this.cooldown = now + 1600;
        return { cast: power, stage: 'idle' };
      }
    }
    return { cast: null, stage: this.stage };
  }
}
export function reelDelta(previous: number, current: number) {
  let delta = current - previous;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return Math.abs(delta) > 0.8 ? 0 : Math.max(0, delta) / (2 * Math.PI);
}
