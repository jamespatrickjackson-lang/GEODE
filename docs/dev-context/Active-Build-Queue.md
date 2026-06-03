# Active Build Queue

Status: active software-build queue, not historical backlog

This file lists current software-build issues that help shape the alpha. It intentionally excludes staged-intake lifecycle work unless the human explicitly resumes it.

## Now

- Keep Utah FORGE visual/topo/geophysics work moving from current source and project files, not staged-intake traces.
- Treat Phase 3 MT, seismic browser, product pages, topo surface controls, graticule controls, working-area focus, legends, overlays, and transitions as active build surfaces.
- Treat Topo Environment controls as active Topo surface work: Scene atmosphere,
  Clouds, Sun, and Fog now live under `Topo > Environment`.
- Keep the current visible Utah FORGE one-puff test cloud available unless a
  replacement QA fixture proves single-cloud visibility, save/reload, page
  override, and transition behavior.
- Preserve rendering quality. Bloat reduction means reducing structural confusion, not weakening visual fidelity or data richness.
- Continue aligning editor sections to real tool/workflow boundaries. Top-level containers are peers; nested containers should represent actual hierarchy, not spacing fixes.
- Keep Page Manager, Visual Studio, UI, Public Topo Map, project data, and overlay tools structurally separate unless a new global tool contract says otherwise.

## Current Build Friction

- `LayerPanel.tsx` is too large for repeated feature work. Extract active editor control islands only when they are touched.
- `SceneManager.ts` is too large for repeated visual/runtime work. Extract active terrain/graticule/focus/seismic/scalar helpers only when touched.
- `TopoMapPanel.tsx` now owns surface, environment, cloud, sun, fog, graticule,
  and title-block controls. Avoid expanding it with large inline control blocks;
  route reusable layer-style controls through focused components such as
  `AtmosphereVolumeControls`.
- Prior visual audit artifacts were purged from active context. Capture fresh focused evidence when visual QA is needed.
- Editor sidebar styling is mid-iteration. Prefer shared tokens in `src/editor/styles.ts` for pill shape, spacing, contrast, and internal outlines.

## Current Verification Defaults

- For static page/project wiring: `npm run check:pages`.
- For active context-drag markers: `npm run check:agent-drag`.
- For project layer file wiring: `npm run check:runtime-assets`.
- For Utah runtime/derived product integrity: `npm run check:utah-runtime`.
- For MT source-count and product fidelity: `npm run check:mt-resistivity`.
- For Utah presentation snapshot drift: `npm run check:utah-snapshot`.
- For Utah FORGE metadata changes: `npm run check:artifacts`.
- For project artifact coverage changes: `npm run check:coverage`.
- For code/runtime/editor changes: `npm run build`.
- For visual composition changes: capture a focused visual state first and ask for human judgment before slow Playwright.
- For browser/render/editor behavior: targeted Utah browser scripts.
- For broad regression only: full `npm run test:utah-forge`.

## Visual Review Active Loop

- Use `docs/dev-context/Visual-Review-Current.md` for the current visual contract when a visual issue spans multiple turns.
- Use `docs/dev-context/Topo-Environment-Clouds-Cinematics-Thread-Update-2026-06-03.md`
  for the current accepted cloud/sun/cinematics thread receipt and render-stack
  trace.
- Save the latest focused review screenshot at `docs/dev-context/Visual-Review/current.png` when a screenshot is needed.
- Prefer human visual acceptance before expensive browser automation.
- Keep automated checks as final guardrails after the visual direction is right.

## Parked Unless Explicitly Asked

- Staged-intake drops and route execution artifacts.
- External control-plane implementation.
- New generalized project intake.
- Broad documentation reconciliation unless explicitly requested.
