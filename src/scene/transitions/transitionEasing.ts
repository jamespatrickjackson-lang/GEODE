import type { EasingName } from "../../pages/types";

// Dependency-free easing helpers shared by the transition runtime and the pure
// execution-plan module. Kept free of THREE and scene imports so the execution
// plan can be unit-transpiled in isolation.

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function easeProgress(t: number, easing: EasingName): number {
  const x = clamp01(t);
  switch (easing) {
    case "linear":
      return x;
    case "easeInOutSine":
      return -(Math.cos(Math.PI * x) - 1) / 2;
    case "easeOutQuart":
      return 1 - Math.pow(1 - x, 4);
    case "easeOutCubic":
      return 1 - Math.pow(1 - x, 3);
    case "easeInOutCubic":
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}
