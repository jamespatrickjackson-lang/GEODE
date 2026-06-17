// Per-entity clip ownership resolver.
//
// Architectural move (this branch): scene-section and working-area clipping are
// being moved from a scene-global apply to per-entity ownership. Today one
// authored section style plus one global source->target mask transition is
// applied to every targeted entity, so the clip channel has no notion of "this
// entity is leaving" - an entity that is clipped in the source and absent in the
// target is still driven toward the target's (inactive / no-clip) state and
// reveals previously-hidden exterior geometry before opacity finishes fading.
//
// This module owns the per-entity clip *behavior* decision. It is intentionally
// pure and dependency-free (no THREE, no `this`, no imports) so it can be
// unit-tested in isolation and reused by the apply path, which consumes the
// decision to choose each entity's mask source/target endpoints and whether the
// clip is pinned (held) or interpolated.
//
// Governing invariant: no transition frame may reveal geometry that neither
// endpoint shows. "Absent in target" is not "unclipped in target" - an absent
// entity has no target clip to move toward, so its clip holds at source while
// opacity owns the exit. The only case allowed to reveal intermediate geometry
// is a persisting entity whose own clip moves, and only within the swept clip
// that both endpoints authorize.

export type EntityClipBehavior =
  // No clip participation on either endpoint: the clip channel has no work and
  // another owner (opacity / visibility) handles any presence change.
  | "inert"
  // Absent in source, present (clipped) in target: apply the target clip from
  // frame 0 (no unclipped flash) while opacity fades in.
  | "enter"
  // Present (clipped) in source, absent in target: hold the source clip for the
  // whole transition so exterior never appears, while opacity fades to zero.
  | "exit-hold"
  // Present in both: interpolate the entity's own clip source -> target (move).
  | "move";

// Which page's clip state feeds an end of the per-entity mask transition.
export type ClipEndpoint = "source" | "target";

export interface EntityClipInputs {
  entityId: string;
  // Entity visible (effective opacity > 0) on the source page.
  presentSource: boolean;
  // Entity visible on the target page.
  presentTarget: boolean;
  // Entity participates in a clip (scene-section or working-area focus) on the
  // source page.
  clippedSource: boolean;
  // Entity participates in a clip on the target page.
  clippedTarget: boolean;
}

export interface EntityClipDecision {
  entityId: string;
  behavior: EntityClipBehavior;
  // Mask transition endpoints, per entity. exit-hold pins both ends to the
  // source clip; enter pins both ends to the target clip; move runs source ->
  // target as authored. inert is reported as source -> target but ignored.
  maskFrom: ClipEndpoint;
  maskTo: ClipEndpoint;
  // True when the clip must not loosen during the transition (exit-hold and
  // enter both pin to a single endpoint). move interpolates and is not pinned.
  pinned: boolean;
}

function decision(
  entityId: string,
  behavior: EntityClipBehavior,
  maskFrom: ClipEndpoint,
  maskTo: ClipEndpoint,
  pinned: boolean,
): EntityClipDecision {
  return { entityId, behavior, maskFrom, maskTo, pinned };
}

/**
 * Resolve the clip-channel behavior for a single entity across a transition,
 * from the entity's own presence and clip participation on each endpoint.
 *
 * Presence drives the behavior; clip participation gates whether there is any
 * clip to hold or apply. The decision is independent of page identity, indexes,
 * titles, order, or source/target page pairs.
 */
export function resolveEntityClipDecision(
  inputs: EntityClipInputs,
): EntityClipDecision {
  const {
    entityId,
    presentSource,
    presentTarget,
    clippedSource,
    clippedTarget,
  } = inputs;

  // Nothing clipped on either endpoint: clip channel is inert regardless of
  // presence; opacity / visibility owns any change.
  if (!clippedSource && !clippedTarget) {
    return decision(entityId, "inert", "source", "target", false);
  }

  // Persisting entity: interpolate its own clip (move). This is the only case
  // permitted to reveal intermediate geometry, bounded by the endpoints' clips.
  if (presentSource && presentTarget) {
    return decision(entityId, "move", "source", "target", false);
  }

  // Leaving entity (absent in target). No target clip to move toward: hold the
  // source clip so exterior never appears; opacity owns the exit. If the source
  // was not clipped, there is nothing to hold and the channel is inert.
  if (presentSource && !presentTarget) {
    return clippedSource
      ? decision(entityId, "exit-hold", "source", "source", true)
      : decision(entityId, "inert", "source", "target", false);
  }

  // Entering entity (absent in source, present in target). Apply the target clip
  // from frame 0 so nothing flashes in unclipped; opacity fades in. If the
  // target is not clipped, there is nothing to apply and the channel is inert.
  if (!presentSource && presentTarget) {
    return clippedTarget
      ? decision(entityId, "enter", "target", "target", true)
      : decision(entityId, "inert", "source", "target", false);
  }

  // Absent on both endpoints.
  return decision(entityId, "inert", "source", "target", false);
}
