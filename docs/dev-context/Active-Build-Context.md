# Active Build Context

Status: active orientation for software-build work

## Current Mode

GeoSee is in software-build mode. Start from the requested runtime/editor/visualization subsystem and current source files.

Do not route normal work through staged-intake records or old review-route artifacts. The Add to Project UI is retained as an explicit, dormant surface only.

Large raw/source inputs are archived outside the active repo at
`C:\GeoSee\GeoSee_Archive`. When current provenance, prep scripts, or generated
metadata mention old repo-relative source paths, resolve them through
`docs/archive-map.md` and `docs/archive-manifest.json` instead of assuming the
source bytes should be restored to Git.

## Current App Shape

GeoSee is a Vite + React + TypeScript + Three.js internal authoring and presentation app.

Utah FORGE is project/config driven:

- `projects/utah-forge/project.json` registers layers and `pageOrder`.
- `projects/utah-forge/environment.json` holds default scene/layer style state.
- `projects/utah-forge/pages/*.json` holds page-local camera, visibility, transition, and layer override state.
- `projects/utah-forge/overlays/<page_id>/text.md` holds overlay copy.
- `src/scene/SceneManager.ts` applies scene, layer, style, material, transition, and runtime visual state.
- `src/editor/LayerPanel.tsx` owns most editor controls.
- `src/pages/PageController.tsx` owns page navigation and camera/page transitions.

## Current Utah FORGE Reality

Treat current project/source files as the authority over older prose.

Current Utah FORGE work includes active Phase 3 MT, seismic browser products, public topo/terrain controls, graticule/topo controls, working-area focus work, product pages, overlays, legends, and visual QA.

## Good Rails

Use these because they directly protect software work:

- `npm run check:pages` for project/page/overlay wiring
- `npm run check:agent-drag` for active no-function context markers
- `npm run check:artifacts` for Utah FORGE artifact metadata
- `npm run check:coverage` for project artifact coverage
- `npm run build`
- targeted Playwright checks in `tests/utah-forge-smoke.spec.ts` after the visual direction is settled
- notes or screenshots tied to the current change

Verification tiers:

- Static wiring/docs/data cleanup: `npm run check:pages`, `npm run check:agent-drag`, and `git diff --check`.
- Artifact metadata/data changes: `npm run check:artifacts` and `npm run check:coverage`.
- Code/runtime compile risk: `npm run build`.
- Browser/render/editor behavior: targeted Playwright by test name.
- Full `npm run test:utah-forge`: broad regression only, not default iteration.

## Visual Review Loop

For visual composition work, use the human eye before broad automated checks.

Preferred loop:

- make a narrow patch
- capture one focused screenshot or viewport state
- ask for direct human judgment
- iterate from that judgment
- run build and targeted checks after the visual direction is right

Use `docs/dev-context/Visual-Review-Current.md` as the current lightweight visual contract when a visual issue spans more than one turn.

Save the latest review screenshot, when needed, at:

`docs/dev-context/Visual-Review/current.png`

Avoid full or slow Playwright smoke runs during design iteration. Use Playwright for quick scene-state probes, targeted tests, and final guardrails.

## Local Dev Server Rule

Agents should not run `Launch GeoSee.bat`. It is a human-facing launcher and it force-kills any process listening on port `5173`, which may interrupt the user's live app session.

For agent-run checks, prefer a scoped dev server command such as `npm run dev -- --host 127.0.0.1 --port <free-port>` and report the URL. If port `5173` is already in use, assume it may belong to the user unless the user explicitly asks to restart it.

## Avoidable Drag

Avoid these unless explicitly relevant:

- broad intake history
- old receipt archives
- generated report folders
- old review-route rails
- historical open-loop rows as active scope
- root docs that predate current Utah FORGE MT/seismic/topo work
- reading visual audit screenshots unless the current task is visual QA
- full `npm run test:utah-forge` during iteration; use targeted tests or
  browser probes instead

## Large Code Surface Warning

`src/editor/LayerPanel.tsx` and `src/scene/SceneManager.ts` are very large mixed-concern files. Patch them in small targeted chunks. Reopen exact regions before edits and prefer extracting active feature islands over adding more unrelated code to the same large sections.
