# Phase 2 Decisions — Locked (2026-06-17)

Phase 2 preflight (E). Recorded decisions for the resolver+applier
consolidation. Quarantine-local (not added to the canonical decision log until
replant).

1. **Group id scheme.** Group key = manifest **subsection id** (the lower-grain
   container); membership = the layer/product ids in that subsection's scope
   (from the manifest taxonomy table). Channels (`scene-section`, working-area)
   are keyed separately as cross-cutting modifiers, not groups.
   *Rationale:* the editor hierarchy is the human's grouping; the subsection
   grain matches one render-entity family = one fate-set; scope binds it to ids.

2. **Parity flag.** A **runtime-toggleable** debug flag (settable live, A/B on
   42911), not a compile-time const.
   *Rationale:* parity is judged by eye/oracle on the running app; a live toggle
   lets old vs new be compared in the same session.

3. **Single chokepoint.** Per-frame application = `tickLayerTweens`
   (`layerTweenRuntime.ts`); transition setup = `transitionEffectiveLayersForPage.ts`.
   Helpers and Section ISO roots keep their existing owners (DERIVED, follow host).
   *Rationale:* `tickLayerTweens` already runs every frame in all branches
   (including the no-section-tween active->inactive exit); setup already resolves
   per-layer source/target. These are the existing chokepoints to consolidate
   into, not new ones.

4. **Resolver inputs (carried from sparring; recorded for the foundation prompt).**
   - taxonomy = manifest (entity vs channel by scope width);
   - grouping prior = container hierarchy (subsection grain), imperfect;
   - behavior + bonds = page-state diff (effectiveStyle/effectiveVisibility per
     layer); what changed → verb, what changed together in a group → bonded;
   - **fade = branch zero**; prior-vs-diff conflict or undetermined → fade.

5. **Scope guards (carried).** Cloud excluded (special kitten); protected
   carve-outs per `CLIP-OWNERSHIP-CARVE-OUTS-20260617.md`; clip channel only for
   the consolidation; no page-id/index/title/order/pair logic.

Open (flagged, decide at foundation time, do not guess now):
- Whether the morph channel (scalar appearance) is migrated in the first
  consolidation increment or kept on its protected owner until later.
- Exact composition order when section AND working-area both clip one entity
  (multiplicative mask assumed; confirm against shader behavior).
