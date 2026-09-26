// Leave browser shortcuts and interactive UI to the browser.
export function isGameShortcut(event: KeyboardEvent) {
  return (
    !event.defaultPrevented &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !(
      event.target instanceof Element &&
      event.target.closest(
        'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="dialog"], [data-game-menu]',
      )
    )
  );
}

export function normalizedPoint(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  const unit = (v: number) =>
    Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
  return {
    x: unit((x - rect.left) / Math.max(1, rect.width)),
    y: unit((y - rect.top) / Math.max(1, rect.height)),
  };
}

export function smoothControl(
  current: number,
  target: number,
  dt: number,
  rate = 12,
) {
  return (
    current +
    (target - current) * (1 - Math.exp(-rate * Math.max(0, Math.min(0.05, dt))))
  );
}
