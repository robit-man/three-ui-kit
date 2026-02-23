/**
 * Easing functions for UI animations.
 */

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Spring-like smoothdamp (simple approximation). */
export function springDamp(current: number, target: number, velocity: number, dt: number, hz: number): [number, number] {
  const omega = hz * 2 * Math.PI;
  const exp_ = Math.exp(-omega * dt);
  const delta = current - target;
  const newVel = (velocity + omega * delta) * exp_;
  const newVal = target + (delta + (velocity + omega * delta) * dt) * exp_;
  return [newVal, newVel];
}
