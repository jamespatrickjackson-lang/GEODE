# Active Build Queue

Status: active software-build queue, not historical backlog

This file lists current software-build issues that help shape the alpha. It intentionally excludes staged-intake lifecycle work unless the human explicitly resumes it.

## Now

- Keep Utah FORGE visual/topo/geophysics work moving from current source and project files, not staged-intake traces.
- Treat Phase 3 MT, seismic browser, product pages, topo surface controls, graticule controls, working-area focus, legends, overlays, and transitions as active build surfaces.
- Preserve rendering quality. Bloat reduction means reducing structural confusion, not weakening visual fidelity or data richness.

## Current Build Friction

- `LayerPanel.tsx` is too large for repeated feature work. Extract active editor control islands only when they are touched.
- `SceneManager.ts` is too large for repeated visual/runtime work. Extract active terrain/graticule/focus/seismic/scalar helpers only when touched.
- Prior visual audit artifacts were purged from active context. Capture fresh focused evidence when visual QA is needed.

## Current Verification Defaults

- For static page/project wiring: `npm run check:pages`.
- For active context-drag markers: `npm run check:agent-drag`.
- For Utah FORGE metadata changes: `npm run check:artifacts`.
- For project artifact coverage changes: `npm run check:coverage`.
- For code/runtime/editor changes: `npm run build`.
- For visual composition changes: capture a focused visual state first and ask for human judgment before slow Playwright.
- For browser/render/editor behavior: targeted Playwright from `tests/utah-forge-smoke.spec.ts`.
- For broad regression only: full `npm run test:utah-forge`.

## Visual Review Active Loop

- Use `docs/dev-context/Visual-Review-Current.md` for the current visual contract when a visual issue spans multiple turns.
- Save the latest focused review screenshot at `docs/dev-context/Visual-Review/current.png` when a screenshot is needed.
- Prefer human visual acceptance before expensive browser automation.
- Keep automated checks as final guardrails after the visual direction is right.

## Parked Unless Explicitly Asked

- Staged-intake drops and route execution artifacts.
- External control-plane implementation.
- New generalized project intake.
- Broad documentation reconciliation unless explicitly requested.
