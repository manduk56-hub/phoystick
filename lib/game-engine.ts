import type { PerspectiveCamera, WebGLRenderer } from 'three';

/** Shared browser game runtime. Gameplay advances at a stable rate while drawing follows the display. */
export class GameEngine {
  static readonly step = 1 / 60;
  static readonly maxFrame = 0.1;
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private stopped = false;
  private resize: ResizeObserver;
  private update: (dt: number) => void;
  private draw: (dt: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    update: (dt: number) => void,
    draw: (dt: number) => void,
  ) {
    this.update = update;
    this.draw = draw;
    this.resize = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    this.resize.observe(canvas);
    this.frame = requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    if (this.stopped) return;
    // A suspended tab must not replay seconds of input after it becomes visible.
    const elapsed = this.last
      ? Math.min(Math.max((now - this.last) / 1000, 0), GameEngine.maxFrame)
      : 0;
    this.last = now;
    this.accumulator += elapsed;
    while (this.accumulator >= GameEngine.step) {
      this.update(GameEngine.step);
      this.accumulator -= GameEngine.step;
    }
    this.draw(elapsed);
    this.frame = requestAnimationFrame(this.loop);
  };

  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
  }
}
