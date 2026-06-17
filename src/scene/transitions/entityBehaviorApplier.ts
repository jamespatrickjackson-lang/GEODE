// Single applier for the per-entity behavior pipeline (Phase 2 consolidation
// foundation). One place that, for migrated owners, decides + applies behavior;
// every non-migrated owner falls through to its existing path (override model).
//
// F0: inert skeleton. Both entries return false ("not handled") so the legacy
// scattered owners run unchanged. The pipeline is gated by the SceneManager
// runtime flag (`perEntityBehaviorActive`, default OFF, A/B-toggleable in DEV),
// so OFF == today's behavior byte-for-byte. F1+ migrate one owner at a time
// here, each behind the same flag and each proven parity-preserving first.

import type { SceneManager } from "../SceneManager";

/**
 * Per-frame pipeline entry (consulted from SceneManager.tickLayerTweens).
 * Returns true when the pipeline fully owns the frame for migrated owners and
 * the legacy per-frame tick should be skipped; false to fall through.
 *
 * F0: always false (no owner migrated yet).
 */
export function applyEntityBehaviorFrame(
  _host: SceneManager,
  _nowMs: number,
): boolean {
  return false;
}

/**
 * Transition-setup pipeline entry (consulted from
 * transitionEffectiveLayersForPage). Returns true when the pipeline fully owns
 * setup and the legacy setup should be skipped; false to fall through.
 *
 * F0: always false (no owner migrated yet).
 */
export function setupEntityBehaviorTransition(_host: SceneManager): boolean {
  return false;
}
