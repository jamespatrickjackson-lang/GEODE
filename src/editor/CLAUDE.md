# src/editor — Agent Guardrails

The editor UI dir used to contain a very large `LayerPanel.tsx`
monolith. R1 split work reduced it below the target; several companion
panels remain large enough to read by range.

## File Size Map

Large — never `Read` in full; use `Grep` to locate the target, then `Read`
with `offset`+`limit`:

- `EnvironmentScenePanel.tsx` — ~3,800 lines. Environment, lighting, fog,
  background, sky/sun controls.
- `PagePanel.tsx` — ~2,400 lines. Page authoring, scene-section
  transitions, page controllers.
- `topoMap/TopoMapPanel.tsx` — ~2,100 lines. Topographic map authoring,
  gradient handles, draping.
- `EditorContext.tsx` — ~1,900 lines. Central editor state, dispatch,
  selection, persistence.
- `UtahForgeAddToProjectDrop.tsx` — ~1,700 lines. Utah FORGE asset
  drop-in flow.

R1 completed (use these as extraction-pattern references):

- `LayerPanel.tsx` — ~2,500 lines (down from 14,326; target met).
- `layerControls/style/StyleControls.tsx` — ~700 lines.
- `layerControls/scalar/ScalarControls.tsx` — barrel-only; scalar
  controls live in per-component files.
- `layerControls/mt/`, `env/`, `page/`, `overlays/`, `layout/`,
  `seismic/`, `workingArea/`, and `geology/` hold the extracted
  LayerPanel sub-controls. No new editor extraction file exceeds 800
  lines.
- `layerControls/labelKindOptions.ts`,
  `layerControls/scalarSourceRange.ts` — tiny shared constants used
  both inside and outside their clusters.

Smaller (safe to read whole):

- `EditorRoot.tsx`, `EditorChrome.tsx`, `OverlayPanel.tsx`,
  `SiteDetailsPanel.tsx`, `CollapsibleSection.tsx`,
  `InlineEditableTitle.tsx`, `DevModeInspector.tsx`, `styleControls.tsx`,
  `styles.ts`, `types.ts`, `save.ts`.

## Editing Discipline

- Before changing sidebar bars, groups, subsections, action controls, persisted
  controls, or editor-backed fields, read
  `../../docs/dev-context/editor-control-manifest.json` and
  `../../docs/dev-context/Editor-Control-Manifest-Policy.md`.
- Preserve existing manifest ids when moving controls. Add new ids before
  adding controls. Mark removals, renames, or hidden controls with manifest
  approval metadata.
- Locate the target with `Grep` (pattern + this dir), then `Read` only the
  relevant slice.
- `Edit` operations on the large files must include enough surrounding
  context to make `old_string` unique — duplicated sub-panel structure
  inside `LayerPanel.tsx` makes uniqueness easy to violate.
- Persistence flows through `save.ts` and the dev-only Vite plugin
  endpoint registered in `vite.config.ts`. Do not replace with a
  different storage mechanism without explicit user direction.
