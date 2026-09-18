export type AimPoint = { x: number; y: number };
// Frame-rate independent smoothing: steady aim is damped; large moves catch up quickly.
export class AimStabilizer {
  private position: AimPoint | null = null;
  private output: AimPoint = { x: 0.5, y: 0.5 };
  private history: AimPoint[] = [];
  private last = 0;
  private heldUntil = 0;
  reset() {
    this.position = null;
    this.history = [];
    this.last = 0;
    this.heldUntil = 0;
  }
  hold(point: AimPoint, now: number, duration = 180) {
    this.position = { ...point };
    this.output = { ...point };
    this.history = [];
    this.last = now;
    this.heldUntil = now + duration;
  }
  update(point: AimPoint, now: number): AimPoint {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      return { ...this.output };
    if (now < this.heldUntil) {
      this.last = now;
      return { ...this.output };
    }
    this.history.push(point);
    if (this.history.length > 3) this.history.shift();
    const median = (axis: 'x' | 'y') =>
      this.history.map((p) => p[axis]).sort((a, b) => a - b)[
        Math.floor(this.history.length / 2)
      ];
    const target = { x: median('x'), y: median('y') };
    if (!this.position) {
      this.position = target;
      this.output = { ...target };
      this.last = now;
      return { ...target };
    }
    const dt = Math.max(0.001, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    const distance = Math.hypot(
      target.x - this.position.x,
      target.y - this.position.y,
    );
    const tau = 0.085 - 0.065 * Math.min(1, distance / 0.12);
    const alpha = 1 - Math.exp(-dt / tau);
    this.position.x += (target.x - this.position.x) * alpha;
    this.position.y += (target.y - this.position.y) * alpha;
    if (
      Math.hypot(
        this.position.x - this.output.x,
        this.position.y - this.output.y,
      ) > 0.0015
    )
      this.output = { ...this.position };
    return { ...this.output };
  }
}
