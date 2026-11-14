# Scene runtime — shared agent instructions

Scope: `src/scene/`. These provider-neutral rules preserve the established scene-runtime guardrails.

## Architecture and bounded reads

- The Three.js R2 extraction moved scene responsibilities into focused helpers. `SceneManager.ts` and `section/sceneSectionController.ts` have since grown beyond their original post-split targets. Both require scoped, symbol-first inspection rather than whole-file reads. `terrainMaterial.ts` is also large; inspect only relevant shader/material ranges.
- `SceneManager.ts` owns scene lifecycle and the public runtime-facing orchestration. `section/sceneSectionController.ts` handles scene-section apply, helpers and opacity. The original R2 notes recorded a post-split ~2,550-line target for `SceneManager.ts` and a **stated 1,200-line cap** for `sceneSectionController.ts`. The latter is already reported as exceeded. **Do not silently reclassify or relax the stated cap**; its current application is held for review. Neither number is a current source measurement.
- Relevant extracted helpers: `handles/sceneHandleControllers.ts`, `isoOverlays/volumeCutIsoOverlays.ts`, `terrain/terrainStyleController.ts`, `workingArea/workingAreaFocusController.ts`, `transitions/layerTweenRuntime.ts`.
- Other source-navigation anchors: `heightSampler.ts` for terrain height, `postprocessing.ts` for effects, `disposeObjectTree.ts` for Three.js cleanup, `layerDiagnostics.ts` for diagnostics, `layerLoaderRegistry.ts` for registration, `layerLoaders.ts` for per-kind loaders, and `scalarFocus.ts` for focus and clipping. Confirm current file sizes and implementations rather than trusting historical counts.

## Required editing discipline

- Layer registration, opacity and transition handling in `SceneManager.ts` is product-aware. Inspect the precise affected code and its contract before changing behavior. Historical implementation context is recorded in commits `15d3c66`, `bb29e23` and `e326e23`.
- **Adapter boundary:** Product-aware MT, seismic and other renderer adapters may define representation identity, readiness, compatibility, supported channels, masks, scientific visibility and material/source opacity constraints. The common transition policy consumes those normalized facts and must not branch on project names, product names, page IDs, page pairs or editor labels. Specialization at the adapter is not permission to invent competing top-level transition/visibility policies. Preserve existing validated behavior; this clarification does not authorize runtime refactoring.
- **Keep the transition-opacity regression test passing** after any change affecting product base opacity, page transitions or visual opacity. Read `docs/dev-context/Transition-Runtime-Operating-Spec.md`, `docs/dev-context/Transition-Continuity-Contract.md`, and transition guardrails for broader changes.
- Route Three.js object/geometry/material cleanup through `disposeObjectTree.ts`; do not introduce independent ad-hoc disposal loops.
- Register additional layer types through `layerLoaderRegistry.ts`; do not add inline registration inside `SceneManager.ts`.
- Preserve product-owned shader opacity and derived ISO overlay opacity when composing page/layer transitions. A generic fade must not reveal scientifically hidden products or make section-derived visuals flash.
- Fix generic runtime behavior rather than matching a particular project deck, page ID, page title or page pair. Preserve the distinction between synthetic app-behavior evidence and human visual acceptance.

Historical source (immutable Git baseline): [`src/scene/CLAUDE.md` at 29d9c4c, lines 1–45](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/scene/CLAUDE.md#L1-L45). This reference remains valid if the current `CLAUDE.md` later becomes a provider-specific router. Migration status belongs in [the migration plan](../../docs/dev-context/Agent-Instruction-Consolidation-Plan.md).
