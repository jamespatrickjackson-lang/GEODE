# Editor — shared agent instructions

Scope: `src/editor/`. Preserve the established editing, control-manifest, authoring and verification discipline. These instructions are provider-neutral.

## Source map and large-file safety

- The editor's R1 extraction reduced the former `LayerPanel.tsx` monolith and distributed controls across focused modules. Preserve the extraction pattern; **no new editor extraction file exceeds 800 lines**. This is the original rule, with no added discretionary exception.
- Large or historically growing files include `EnvironmentScenePanel.tsx` (environment, lighting, fog, sky/sun), `PagePanel.tsx` (page and cinematic authoring), `topoMap/TopoMapPanel.tsx` (topography, draping, gradients), `EditorContext.tsx` (selection, state, dispatch, persistence), `LayerPanel.tsx`, and `UtahForgeAddToProjectDrop.tsx` (asset drop-in). **Never read those large files in full**: first search symbols, then inspect bounded ranges.
- R1 extraction references include `layerControls/style/StyleControls.tsx`, `layerControls/scalar/ScalarControls.tsx` (barrel; scalar controls are in separate files), and `layerControls/mt/`, `env/`, `page/`, `overlays/`, `layout/`, `seismic/`, `workingArea/`, `geology/`. Shared constants include `layerControls/labelKindOptions.ts` and `layerControls/scalarSourceRange.ts`.
- Historically smaller files include `EditorRoot.tsx`, `EditorChrome.tsx`, `OverlayPanel.tsx`, `SiteDetailsPanel.tsx`, `CollapsibleSection.tsx`, `InlineEditableTitle.tsx`, `styleControls.tsx`, `styles.ts`, `types.ts` and `save.ts`. Verify size before whole-file reads; do not depend on old line-count estimates.
- Dev Mode Inspector (the `d` key) has a thin `DevModeInspector.tsx` entry and `devMode/` modules: `constants.ts`, `types.ts`, `util.ts`, `text.ts`, `boxModel.ts`, `inspect.ts`, `styles.ts`, `controls.tsx`, `textControls.tsx`, `labelLayout.ts` (pure label-collision packing), and `containerOutlines.tsx` (clickable non-stacking labels). Pure functions in `inspect`, `boxModel`, `labelLayout`, `util`, `text` can be tested without React. `DevModeInspector.tsx` is **not** in the manifest `protectedSourceFiles` list.

## Protected editor controls

- Before changing sidebar bars, groups, subsections, commands, controls, page actions, or editor-backed persisted fields, read `docs/dev-context/editor-control-manifest.json` and `docs/dev-context/Editor-Control-Manifest-Policy.md`.
- Preserve existing manifest IDs when moving controls between groups or source files. Register IDs for new controls before adding them. Removal, rename, hide and restructure actions require the manifest's applicable approval metadata and checks; do not bypass its reorder rules.
- In large component files, search for the exact intended panel and use sufficiently distinctive context in replacements or patches. Repeated sub-panel structures can make an insufficiently scoped edit modify the wrong control.
- User-facing scene, render, layer, page and environment variables must be exposed through the appropriate editor surface unless properly classified and justified as internal-only. A feature is not complete until runtime application, editor access, saving, reloading and human-visible verification are addressed. Read `docs/06-editor-exposure-rules.md`.
- For quick legends and render-preset authoring, read `docs/dev-context/UI-Visual-Standards.md`; use shared helper geometry and preserve both project-level and selected-page preset access rather than introducing page-specific workarounds.

## Persistence and transition safety

- Editor authoring writes flow through `save.ts` and the development-only Vite plugin endpoint registered in `vite.config.ts`; retain the existing storage mechanism unless the owner explicitly directs otherwise.
- Before modifying page transitions, editor/save transition gating, section/ISO controls, opacity or page navigation, read `docs/dev-context/Transition-Runtime-Operating-Spec.md` and its required companion documents.
- Fix reusable state-resolution or runtime behavior, not the observed Utah FORGE page ID, title or page pair. Use synthetic fixtures for general behavior tests; treat human visual acceptance as a separate gate.

Historical source (immutable Git baseline): [`src/editor/CLAUDE.md` at 29d9c4c, lines 1–70](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L1-L70). This reference remains valid if the current `CLAUDE.md` later becomes a provider-specific router. Migration status belongs in [the migration plan](../../docs/dev-context/Agent-Instruction-Consolidation-Plan.md).
