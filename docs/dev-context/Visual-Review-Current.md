# Visual Review Current

Status: active lightweight loop for visual alpha work

## Purpose

Use this file only when a visual issue needs human judgment before expensive automated tests. Keep it short and current.

The operating loop is:

```text
narrow patch
-> capture one focused screenshot or viewport state
-> human visual judgment
-> iterate from that judgment
-> run build / targeted checks after the visual direction is right
```

## Current Visual Contract

- Goal: make Utah FORGE visual/topo/editor changes converge by direct human review before slow smoke tests.
- Current focus: editor sidebar structure, global settings/toolset containers, Page Manager spacing, lightweight viewport legends, and next-pass legend panel behavior.
- Accepted decisions:
  - Top-level editor containers are peers when they represent real workflows or tools.
  - Container shape, fill, spacing, and contrast should come from shared editor tokens.
  - Page Manager keeps compact page-list spacing; full-panel end padding belongs to the scroll extent.
  - Viewport legends should be lightweight overlays unless a specific tool requires a card/backplate.
  - Viewport legend edge anchoring, stack spacing, circular toggle rows, overlay text-color mapping, slider variables, and MT ramp handle sizes are captured in `docs/dev-context/UI-Visual-Standards.md`.
  - Topo graticules are depth-tested reference lines, not through-scene overlays.
  - Public topo surface colour defaults now use the named `Utah` material preset:
    khaki desert lows, muted sage/tree middle elevations, and warm snow/rock
    high peaks.
  - Section ISO overlay opacity is composed from authored opacity, transition opacity, and threshold-surface attenuation.
  - Compatible section-frame page changes slide/interpolate; incompatible helper states crossfade by outgoing snapshot plus incoming fade.
  - Human visual judgment is the first acceptance filter for composition.
- Still wrong / under review:
  - Final sidebar polish and toolset grouping remain iterative.
  - Legend panel behavior has a first implementation pass: sequenced per-container left slide, row gap closure after exit, row opening before entry, and MT resistivity fixed at the bottom. It remains under human visual review.
  - Zoom-out camera far-plane clipping is being handled before the oblique longitude/latitude grid line artifact. The grid line issue remains held until clipping is verified visually.
- Do not revisit unless asked:
  - Intake directives or intake drops for normal software-build work.
  - Full broad Utah FORGE smoke runs during visual iteration.
  - Killing or restarting the user's `5173` app session.

## Screenshot Path

Use this path for the latest focused screenshot when a visual judgment is needed:

`docs/dev-context/Visual-Review/current.png`

If multiple references are needed, use concise names in the same folder, for example:

- `docs/dev-context/Visual-Review/current-before.png`
- `docs/dev-context/Visual-Review/current-after.png`

## Agent Rules

- Prefer the user's running app on `5173` for human review.
- If an agent needs a dev server, use a separate free port such as `5174`.
- Do not run `Launch GeoSee.bat`.
- Do not kill port `5173` unless the user explicitly asks.
- Before running Playwright for a visual issue, capture or present a visual state for human review unless the issue is purely structural.
- Keep Playwright to quick scene-state probes or targeted tests after the visual direction is approved.

## Verification Defaults

After the visual direction is accepted, use:

- `npm run build`
- `node tools/validate-artifact-metadata.mjs --project projects/utah-forge`
- `node tools/report-project-artifact-coverage.mjs`
- one targeted Utah FORGE Playwright test or a cheaper scene-state probe only when needed
