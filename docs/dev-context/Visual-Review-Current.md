# Visual Review Current

Status: active lightweight loop for visual alpha work

Last updated: 2026-05-20

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
- Current focus: topo graticule edge behavior.
- Accepted decisions:
  - The topo edge fade is the visual authority for map-frame behavior.
  - Interior grid lines trim to the inner edge-fade boundary.
  - Edge leaders and labels are visual references only.
  - Human visual judgment is the first acceptance filter for composition.
- Still wrong / under review:
  - Rounded-corner longitude/latitude labels can hang in the undefined-space corners.
  - Candidate fix: hide labels/leaders that require rounded-corner or arc placement, while keeping their interior grid lines.
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
