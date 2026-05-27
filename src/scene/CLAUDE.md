# src/scene — Agent Guardrails

Three.js scene runtime. R2 split work reduced `SceneManager.ts` below
the target and moved scene subsystems into focused helper modules.

## File Size Map

Large — prefer `Grep` and read by line range:

- `SceneManager.ts` — ~2,550 lines (down from ~12,000; target met).
  Still central orchestration for scene lifecycle and public runtime API.
- `terrainMaterial.ts` — ~1,550 lines. Terrain shader material, draping,
  edge fade.

Smaller (safe to read whole):

- `section/sceneSectionController.ts` — ~1,180 lines; largest extracted
  scene helper and still below the 1,200-line cap.
- `handles/sceneHandleControllers.ts`, `isoOverlays/volumeCutIsoOverlays.ts`,
  `terrain/terrainStyleController.ts`, `workingArea/workingAreaFocusController.ts`,
  and `transitions/layerTweenRuntime.ts` — R2 extracted helpers.
- `heightSampler.ts` — terrain height lookup.
- `postprocessing.ts` — post-effect chain.
- `disposeObjectTree.ts` — Three.js cleanup helper.
- `layerDiagnostics.ts` — runtime diagnostics for layers.
- `layerLoaderRegistry.ts` — loader registration.
- `layerLoaders.ts` — per-layer-kind loaders.
- `scalarFocus.ts` — scalar focus / working-area clip helpers.

## Editing Discipline

- Layer registration, opacity, and transition logic in `SceneManager.ts`
  is product-aware (see commits `15d3c66`, `bb29e23`, `e326e23` for
  contract context). Read the relevant region before editing transition
  or opacity behaviour.
- The transition opacity regression test must continue to pass after any
  change touching opacity, transitions, or product opacity base.
- Three.js disposal: route through `disposeObjectTree.ts`; do not invent
  ad-hoc dispose loops.
- Loaders register through `layerLoaderRegistry.ts`; adding a new layer
  kind goes there, not inline in `SceneManager.ts`.
