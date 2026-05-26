# src/editor — Agent Guardrails

The editor UI dir contains two very large monolithic React panels and a
handful of smaller companion files. Reading these files in full is
expensive.

## File Size Map

Large — never `Read` in full; use `Grep` to locate the target, then `Read`
with `offset`+`limit`:

- `LayerPanel.tsx` — ~14,300 lines. Per-layer panel rendering, layer
  ordering, opacity controls, terrain/MT/resistivity/hydrography sub-panels
  inline.
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

Smaller (safe to read whole):

- `EditorRoot.tsx`, `EditorChrome.tsx`, `OverlayPanel.tsx`,
  `SiteDetailsPanel.tsx`, `CollapsibleSection.tsx`,
  `InlineEditableTitle.tsx`, `DevModeInspector.tsx`, `styleControls.tsx`,
  `styles.ts`, `types.ts`, `save.ts`.

## Editing Discipline

- Locate the target with `Grep` (pattern + this dir), then `Read` only the
  relevant slice.
- `Edit` operations on the large files must include enough surrounding
  context to make `old_string` unique — duplicated sub-panel structure
  inside `LayerPanel.tsx` makes uniqueness easy to violate.
- Persistence flows through `save.ts` and the dev-only Vite plugin
  endpoint registered in `vite.config.ts`. Do not replace with a
  different storage mechanism without explicit user direction.
