# Clip-Ownership Carve-Outs (2026-06-17)

Phase 2 preflight (D). Contracts the resolver+applier consolidation must NOT
alter. Locked by `tests/tools/clip-ownership-carveouts-source.test.mjs` (passes
on the current baseline; fails only if the consolidation removes them).

1. **MT full-density scalar path (protected).** `SCALAR_TRANSITION_STYLE_FIELDS`,
   `scalarInclusionFilterActive`, `scalarFullDensityAllValidMode`, scalar range
   interpolation, scalar legend target authority, scalar edge/isoline generation,
   point density/opacity correctness. The morph channel for the volume may be
   migrated later, but these declarations stay.
2. **The full-density point cloud (special kitten).** `THREE.PointsMaterial`,
   never clip-owned by the registry. Scene-section soft mask only touches
   `ShaderMaterial` (`material instanceof THREE.ShaderMaterial`), so the cloud is
   not soft-section-clipped; keep it that way. Handled SEPARATELY from the
   consolidation; a user-held saved known-good ("perfect") version is its restore
   point. Carving it out removes its special cases (PointsMaterial, protected
   scalar fields, default section-target membership) from the general path — the
   resolver/applier never branch for it. Protection = this carve-out guard +
   the saved restore point; no regression baseline captured here.
3. **Section ISO derived-root ownership (DEC-169/171).**
   `beginSectionIsoOverlayTransition`, `sectionIsoOverlayTransitionRoot`; ISO
   roots follow their host and crossfade/exit per their existing owner.
4. **Helper no-bleed (DEC-100 / TRD-012).** Section masks, helpers, frame
   controls, ground traces, axes, cones must not bleed into inactive targets.
5. **Per-frame move-follow (DEC-164/170).** `sceneSectionFramePartition`;
   surviving frames move, only changed frames dissolve. No global section snap.

The consolidation owns the CLIP channel and the per-entity behavior verbs; it
does not touch the above. Anything ambiguous against these falls to the fade
floor rather than risking a carve-out.
