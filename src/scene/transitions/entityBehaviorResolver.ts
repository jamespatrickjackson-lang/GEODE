// Per-entity behavior resolver (Phase 2). Pure, dependency-free, unit-testable.
// F1 scope: the opacity verb only. Given the source/target effective opacity for
// one entity, decide fade vs constant. This reproduces the legacy generic
// opacity-tween decision exactly (parity step); later increments add the other
// verbs and group-level common-fate.

export interface OpacityFadeInputs {
  fromOpacity: number;
  toOpacity: number;
}

export type OpacityFadeKind = "fade" | "constant";

export interface OpacityFadeDecision {
  kind: OpacityFadeKind;
  from: number;
  to: number;
}

const OPACITY_EPSILON = 0.001;

/**
 * Resolve the opacity verb for one entity. "constant" when source and target
 * opacity are within epsilon (no fade needed); "fade" otherwise, carrying the
 * source->target endpoints. Matches the legacy threshold
 * (`Math.abs(fromOpacity - toOpacity) < 0.001`) so the applier reproduces the
 * legacy generic fade exactly.
 */
export function resolveOpacityFade({
  fromOpacity,
  toOpacity,
}: OpacityFadeInputs): OpacityFadeDecision {
  if (Math.abs(fromOpacity - toOpacity) < OPACITY_EPSILON) {
    return { kind: "constant", from: fromOpacity, to: toOpacity };
  }
  return { kind: "fade", from: fromOpacity, to: toOpacity };
}
