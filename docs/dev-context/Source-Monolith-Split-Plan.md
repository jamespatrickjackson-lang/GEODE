# Source Monolith Split Plan

Status: R1 in flight (2 of 8 PRs landed); R2 not started.

## Progress As Of 2026-05-26

R1 — LayerPanel.tsx:
- Baseline: 14,326 lines.
- Step 1 — `layerControls/style/` shipped in commit `5d8b9af`.
  LayerPanel.tsx → 13,298 lines (−1,028). Nine components shipped as
  one file `StyleControls.tsx` (1,047 lines) rather than nine separate
  files; the per-file split in this plan is the long-term target, not
  a hard requirement.
- Step 2 — `layerControls/scalar/` shipped in commit `87e0eb8`.
  LayerPanel.tsx → 12,527 lines (−771). Includes the shared
  `scalarSourceRange.ts` for `SCALAR_SOURCE_MIN/MAX`, which are
  referenced from many sites outside the cluster.
- Steps 3–8 — pending. See per-step rows in the R1 table below.

R2 — SceneManager.ts:
- Untouched. Architectural choice still open (Option A is the
  recommended default; user confirmation required before any R2 code
  moves).

Cross-session handoff for the next agent:
[Agent-Handoff-2026-05-26.md](Agent-Handoff-2026-05-26.md).

## Context

Two source files dominate per-turn agent cost in this repo:

- `src/editor/LayerPanel.tsx` — 14,326 lines (~490 KB).
- `src/scene/SceneManager.ts` — ~12,500 lines (~424 KB).

The 2026-05-26 agent-slowness audit ranked splitting these as R1 and R2.
This plan defines the target module layout, extraction order, per-step
verification, and architectural decisions still open. Execution will land
across multiple PRs.

## Pre-Conditions For Every Extraction

Before each extraction PR:

1. Working tree clean except for the files in scope. User WIP is never
   restaged.
2. `npm run check:workspace` clean for the planned commit (single-category
   ideally, two with WARN allowed).
3. A baseline screenshot or recording exists for the affected editor
   panel(s) or scene subsystem(s).

After each extraction PR:

1. `npm run typecheck` (or `tsc -p .`) passes.
2. `npm run build` succeeds.
3. `npm run dev` boots cleanly; the affected editor panel renders and
   accepts edits identically to baseline.
4. Playwright suite under `tests/` passes; the transition opacity
   regression introduced in commit `e326e23` continues to pass.
5. Visual diff on at least one scene that exercises the extracted code
   (Utah FORGE for MT/seismic/resistivity; any project for generic
   editor controls).

---

## R1 — LayerPanel.tsx Extraction Plan

### Architecture Target

`LayerPanel.tsx` becomes a thin orchestrator (~1,500–2,500 lines). It
keeps the top-level component, the `renderLayer` driver, and the small
helpers that depend on editor context (`useEditor`, `usePageController`).
Self-contained sub-component functions extract to one file each under
new feature dirs.

Most sub-components are already prop-driven (verified by sampling
`SurfaceGradientControls` line 8552 and `ScalarRampControls` line 12138 —
both take props only, no `useEditor` or module-level state). That makes
extraction a literal cut/paste with import-list patching.

### Target Module Layout

```
src/editor/
  LayerPanel.tsx                       (orchestrator, ~2,000 lines)
  layerControls/
    mt/
      SurfaceGradientControls.tsx
      MtTopSurfaceControls.tsx
      IsobandControls.tsx
      MtVolumeControls.tsx
      MtThresholdSurfaceControls.tsx
      MtStationQcControls.tsx
      ResistivitySliceControls.tsx
    scalar/
      ScalarRampControls.tsx
      ScalarPointDrawReadout.tsx
      PointMarkerControls.tsx
    seismic/
      SeismicBrowserControls.tsx
      SeismicCapabilityLayerItem.tsx
      SeismicCapabilityLayerContainers.tsx
      SceneSectionPlanesContainer.tsx
    style/
      EzGammaStyleControls.tsx
      EzGammaTubeControls.tsx
      EzGammaSelectRow.tsx
      GeochemStyleControls.tsx
      HyperspectralStyleControls.tsx
      ImageryLidarStyleControls.tsx
      AreaOutlinesControls.tsx
      SurfaceGradientColorInput.tsx
      EnvTextRow.tsx
    workingArea/
      WorkingAreaFocusContainer.tsx
    page/
      PageEnvironmentOverridePanel.tsx
      PageRenderPresetOverrideRow.tsx
      PageBooleanOverrideRow.tsx
      PageMoodOverrideRow.tsx
    env/
      EnvShowLabelsRow.tsx
      EnvAffectedByFogRow.tsx
      EnvLabelKindRow.tsx
      EnvLabelPointerVisibleRow.tsx
      EnvLabelPointerSideRow.tsx
      EnvTreeVisibilityToggle.tsx
      PageShowLabelsRow.tsx
      PageAffectedByFogRow.tsx
      PageLabelKindRow.tsx
      PageLabelPointerVisibleRow.tsx
      PageLabelPointerSideRow.tsx
      PageTreeVisibilityToggle.tsx
      ToggleButton.tsx
    geology/
      GeologySubUnitsPanel.tsx
    overlays/
      SceneOverlaysReadOnly.tsx
      SceneOverlayRow.tsx
      AddSceneOverlayForm.tsx
    layout/
      LayerGroup.tsx
      LayerGroupFogControl.tsx
      DrillingAssayPanel.tsx
      AssayToggle.tsx
      AssayColorControl.tsx
      TopoDetailDistancePanel.tsx
      TopoDistanceSlider.tsx
```

### Extraction Order

Cheapest, lowest-risk extractions first. Each row is one PR.

| # | Group | Source lines (current) | Est. moved lines | Risk |
|---|---|---|---|---|
| 1 | `layerControls/style/` (all 9 components) | 13261–13965 + 13219 | ~720 | low — pure prop-driven style rows |
| 2 | `layerControls/scalar/` | 12084–12799 | ~715 | low — prop-driven |
| 3 | `layerControls/mt/` (surface gradient + MT controls) | 8552–9752 + 12904–13030 | ~1,400 | low–medium — large but self-contained |
| 4 | `env/` + `page/` rows | 4534–5683 (with gaps) + 5259–5683 | ~600 | low — small toggle rows |
| 5 | `overlays/` (scene overlays + add form) | 4971–5258 + 14390–14600 | ~440 | low |
| 6 | `layout/` group + drilling assay + topo distance | 3665–4533 + 3845–3966 | ~900 | medium — used by `renderLayer` orchestrator |
| 7 | `layerControls/seismic/` | 6503, 6913, 7471, 10315 | ~3,000 | medium — touches scene-section coupling |
| 8 | `workingArea/` + `geology/` | 6677, 14268 | ~900 | medium — depends on scene state shape |

### Per-PR Verification

For each extraction PR:

1. Confirm the new file imports only what the moved code referenced
   (`EditableStyle`, helper utilities from `styles.ts`, `styleControls.tsx`,
   typed unions from `types.ts`).
2. Re-export site in `LayerPanel.tsx`: keep an import of the new module so
   the orchestrator continues to render it inline as before.
3. `tsc -p .` clean.
4. Vite dev boot; toggle through every page/layer the moved control
   appears in.
5. Playwright transition opacity regression passes.

### Acceptance For R1

- `LayerPanel.tsx` is ≤ 2,500 lines.
- No single new file exceeds 800 lines.
- No regression in Vite build, Playwright suite, or visual baseline.

---

## R2 — SceneManager.ts Extraction Plan

### Open Architectural Decision

`SceneManager.ts` is a single class (`export class SceneManager`, line
2913) with module-level helpers above it (lines 1–2912 are types,
constants, helpers, shader patches). The class body holds the dominant
mass.

Three viable approaches:

**Option A — Helper classes composed by SceneManager.** SceneManager
constructs a `LightingManager`, `LayerOpacityController`,
`SceneSectionController`, `WorkingAreaFocusController`, etc., and
delegates method calls. Each helper owns its own state and exposes a
focused public API. Recommended trade-off: refactor cost is one-time,
ergonomic loss is minimal, future edits land in small files.

**Option B — Free-standing functions with state passed in.** Methods
become module functions taking `SceneManager` (or its state slices) as
the first argument. Cheap to extract mechanically; loses encapsulation;
type signatures get noisy.

**Option C — Class hierarchy.** Avoid — TypeScript inheritance and
`private` member access across files is brittle for a god class with
shared state.

This plan assumes **Option A**. Final go/no-go on Option A is the first
gate before any R2 code moves.

### Target Module Layout (under Option A)

```
src/scene/
  SceneManager.ts                      (orchestrator, ~2,500–3,500 lines)
  shaders/                             (existing module-level helpers
                                        lines 1–2912 extracted)
    workingAreaFocusShader.ts
    pointDistanceLightShader.ts
    mtSurfaceMaskShader.ts
    layerFogShader.ts
    colormaps.ts
    scalarSectionIsoOverlay.ts
    sceneSectionMaterial.ts
  lighting/
    LightingManager.ts                 (sun, lighting handles, studio sources)
  camera/
    OrbitCenterController.ts
    PageCameraMarkers.ts
  section/
    SceneSectionController.ts          (planes, window, clipping, helpers,
                                        labels, axis, bounds, interpolation)
  workingArea/
    WorkingAreaFocusController.ts
  terrain/
    TerrainCompositeController.ts      (composite style, lift, fog, lakes)
  transitions/
    LayerOpacityController.ts          (target/base/shader opacity,
                                        render-state capture, transition
                                        snapshots, frame tween tick)
  styles/
    surfaceGradientStyle.ts
    mtTopSurfaceStyle.ts
    scalarPreviewStyle.ts
    pointMarkerStyle.ts
    resistivitySliceStyle.ts
    scalarVolumeStyle.ts
    mtThresholdSurfaceStyle.ts
    seismicBrowserStyle.ts
    contourDisplayStyle.ts
    ezGammaStyle.ts
    demoBoreholeStyle.ts
    geochemStyle.ts
    hyperspectralStyle.ts
    imageryLidarAoiStyle.ts
    drillingAssayDisplay.ts
    topoDetailDistanceDisplay.ts
    streamLakeOcclusion.ts
    siteSurfaceGuide.ts
  isoOverlays/
    scalarSectionIsoTargets.ts
    mtVolumeCutIso.ts
    seismicVolumeCutIso.ts
    mtSurfaceBoundaries.ts
  outlines/
    AreaOutlineController.ts
  overlays/
    SceneOverlaysController.ts
```

### Extraction Order

Each row is one PR. Extract shader and pure-helper modules first; they
have no state coupling to the class.

| # | Group | Approach | Risk |
|---|---|---|---|
| 1 | `shaders/` (module-level helpers, lines 1–2912) | move out as plain functions | low — no class state |
| 2 | `styles/` style applicators (one PR per 3–5 style applicators) | extract as module functions called by SceneManager methods that pass `this`-state explicitly | low–medium |
| 3 | `isoOverlays/` | module functions | low |
| 4 | `outlines/AreaOutlineController.ts` | helper class | medium |
| 5 | `overlays/SceneOverlaysController.ts` | helper class | medium |
| 6 | `camera/` (OrbitCenter + PageCameraMarkers) | helper classes | medium |
| 7 | `lighting/LightingManager.ts` | helper class | medium |
| 8 | `terrain/TerrainCompositeController.ts` | helper class | medium |
| 9 | `workingArea/WorkingAreaFocusController.ts` | helper class | medium |
| 10 | `section/SceneSectionController.ts` | helper class | medium-high — interpolation + transition coupling |
| 11 | `transitions/LayerOpacityController.ts` | helper class | high — touches product-aware transition contract; opacity regression `e326e23` must pass |

### Per-PR Verification

For each R2 PR:

1. `tsc -p .` clean. Class-method visibility (`private`) is the main
   compile hazard during extraction; expose minimal public APIs on each
   new helper class.
2. `npm run build` clean.
3. `npm run dev`; load Utah FORGE, Woodjam, Case Study B, and Base GUI
   scenes; verify camera, lighting, layer opacity, transitions, scene
   sections, and working-area focus all behave identically.
4. Playwright suite; the transition opacity regression must pass.
5. Visual diff on at least one scene that exercises the changed
   subsystem.

### Acceptance For R2

- `SceneManager.ts` is ≤ 3,500 lines.
- No single new file exceeds 1,200 lines.
- Frame loop, transitions, and editing UX identical to pre-split
  baseline.

---

## Cross-Cutting Notes

- After every PR, update `[src/editor/CLAUDE.md](../../src/editor/CLAUDE.md)`
  and `[src/scene/CLAUDE.md](../../src/scene/CLAUDE.md)` to remove or
  shrink the line-count warnings for files that have been split, and to
  add new files to the directory map.
- Update `[../../memory](../../memory)` `project-monoliths.md` (in the
  user's `.claude` memory dir) after each successful split.
- Do not bundle agent-context guardrail updates with code extractions in
  the same commit — they fall into different `check:workspace` policy
  categories.
