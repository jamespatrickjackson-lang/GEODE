# Intelligence Layer Current State

## Status

Canonical intake-review is a dormant capability for explicit Utah FORGE intake work.

This file is an orientation doc for future agents. It is not an acceptance record, not runtime code, not project truth, and not a reason to route normal software-build work through intake.

## Purpose

The intelligence layer appraises messy staged input and produces a canonical review state for the app when intake is explicitly requested. It does not own project truth, technical validation, or acceptance.

For normal runtime, editor, visualization, topo, seismic, MT, page, overlay, camera, render-quality, or artifact work, start from the requested subsystem and current project/source files. Do not read or follow intake drops, `BUILD_DIRECTIVE`, `LATEST_INTAKE_REVIEW`, `AI_REVIEW`, or switchboard files unless the human explicitly asks for intake, a drop, staged files, a directive, or route review.

## Intake Flow If Explicitly Resumed

```text
drop files
-> app stages raw files, intake_manifest.json, intake_context.md
-> run intake trailhead
-> runner appraises staged input
-> runner writes INTAKE_REVIEW.json/.md
-> runner updates LATEST_INTAKE_REVIEW.json
-> app reads latest review
-> human answers only if blocking questions are present
-> later route execution is separate
```

## GeoSee Architecture Context

GeoSee is a Vite + React + Three.js project-driven visualization app.

Utah FORGE pages are authored mostly as JSON and Markdown, not as new React screens.

Runtime shape:

- `projects/utah-forge/project.json` registers project metadata, layers, and `pageOrder`.
- `projects/utah-forge/environment.json` defines global/default layer styles, default visible layers, render preset, fog, lighting, and scene defaults.
- `projects/utah-forge/pages/*.json` defines page-local scene state: camera, transition, visible layers, layer overrides, hold duration, and optional dynamic camera settings.
- `projects/utah-forge/overlays/<page_id>/text.md` supplies page overlay text shown in the presentation UI.
- `src/scene/SceneManager.ts` applies runtime layer/style/camera state.
- `src/pages/PageController.tsx` controls presentation/page transition flow.

## UI Model

The app is a 3D presentation/editor experience.

A page is a saved scene state, not a web route. For page-building work, agents should configure existing layers, page-local cameras, transitions, and overlays. The existing UI handles page navigation, layer rendering, legends, transitions, and overlay display.

## App-Authoring Rule

For Utah FORGE app-integration tasks:

- Use exact layer IDs discovered in `project.json`; never invent layer IDs.
- Prefer page JSON and overlay Markdown over React UI work.
- Use existing page visibility conventions such as `visibleLayers` or `visibilityOverrides`.
- Use `layerOverrides` for page-local style changes.
- Copy camera and style schema from known-good current pages.
- Do not edit `environment.json` unless a global style is genuinely required and explicitly allowed.
- Do not add schema keys unless existing pages or TypeScript types already support them.
- Put `proposed / needs_review` status in overlay wording and receipts unless the page schema already has a supported status field.

Useful page examples to inspect before authoring:

- `12_untitled.json` for broad MT resistivity volume/full-density framing.
- `06_untitled.json` or `04_untitled.json` for seismic/resistivity combined states.
- `05_untitled.json` for threshold/focused MT state.
- `08_untitled.json` or `09_untitled.json` for simpler context states when present.

## Evidence Boundary

Rendered project datasets and processed artifacts can be spatial truth only when backed by project data or metadata.

PDFs, FigJam/Figma exports, screenshots, report figures, and handoff boards are visual/reference evidence unless explicitly converted into app artifacts with provenance.

Do not geolocate seismic panels, TEM panels, basement surfaces, or other geophysical products from screenshots alone.

## Utah FORGE Current Support

Layer IDs verified from current `project.json`:

| Product / support | Current layer or mechanism | Current status |
| --- | --- | --- |
| Terrain | `terrain` | usable now |
| Roads | `transport-roads` | usable now |
| Hydrography streams | `hydrography-streams` | usable now |
| Hydrography lakes | `hydrography-lakes` | usable now |
| Phase 3 working area | `utah-forge-phase3-working-area` | usable now |
| MT stations | `utah-forge-mt-stations` | usable now; labels and EDI variants remain partial/missing |
| MT preview point cloud | `utah-forge-mt-resistivity-preview` | usable now |
| MT full-density point cloud | `utah-forge-mt-resistivity-full-density` | usable now; use carefully with sane page-local opacity/controls |
| MT volume | `utah-forge-mt-resistivity-volume` | usable now for volume overview |
| MT authored slices | `utah-forge-mt-resistivity-slices` | usable now; arbitrary interactive depth/elevation generation remains partial/missing |
| MT threshold surfaces | `utah-forge-mt-resistivity-threshold-surfaces` | usable now; arbitrary marching-cubes threshold generation remains partial/missing |
| MT top surface | `utah-forge-mt-top-surface` | usable now |
| Phase 3 seismic browser | `utah-forge-phase3-seismic-browser` | usable now for registered seismic products |
| Reference stage | `utah-forge-reference-stage` | placeholder/context only |
| Scene section ISO controls | environment style key `utah-forge-scene-section-planes` | style/control support exists, but no matching project layer is registered in current `project.json` |

Likely missing or partial:

- TEM geographically anchored panel.
- TEM tabular inversion data versus figure texture status.
- Basement/top-of-granite gridded surface.
- True interactive depth-vs-elevation slice generation.
- Arbitrary vertical resistivity fence generation.
- Arbitrary marching-cubes threshold generation beyond existing authored threshold surfaces.
- Station labels and station EDI variant UI.
- MT survey footprint polygon.
- Interpreted seismic contact overlays.
- Canonical report/PDF/FigJam provenance selection.

## Canonical Active Files

Only active during explicit intake work:

- `intake_manifest.json`
- `intake_context.md`
- `INTAKE_REVIEW.json`
- `INTAKE_REVIEW.md`
- `LATEST_INTAKE_REVIEW.json`

## Optional Review Outputs

- `source_inventory.json/.md`
- `proposed_next_steps.md`
- `pdf_review/`
- `image_review/`
- `text_review/`
- `geojson_review/`
- `route_execution_log.json/.md`

## Conditional Human-Response Files

- `USER_CONTEXT_RESPONSE.json`
- `USER_CONTEXT_RESPONSE.md`

These exist only when the review asks blocking questions or a later route requires explicit human context.

Human answers are context confirmation and routing input. They are not acceptance.

## Compatibility Aliases

- `AI_REVIEW.json/.md`
- `LATEST_AI_REVIEW.json`
- `INTAKE_SWITCHBOARD.json/.md`

These are compatibility mirrors only.

When intake is explicitly resumed, the UI should prefer:

1. `LATEST_INTAKE_REVIEW.json`
2. drop-local `INTAKE_REVIEW.json`
3. compatibility `LATEST_AI_REVIEW.json` / `AI_REVIEW.json`
4. compatibility `INTAKE_SWITCHBOARD.json`

The runner should create/update canonical intake review first. Compatibility files may be mirrored during transition.

## Historical Trace Only

- `AGENT_TRAILHEAD.md`
- `BUILD_DIRECTIVE.md`
- `INTENT_BINDINGS.md`

These are not active authority.

Do not frame the current system around `BUILD_DIRECTIVE`, `AGENT_TRAILHEAD`, `INTAKE_SWITCHBOARD`, or `INTENT_BINDINGS`.

## Acceptance Rule

All intelligence-layer outputs remain:

- proposed
- `accepted: false`
- `reviewRequired: true`

until explicit human acceptance is recorded.

## Route Execution Boundary

First-pass review is separate from route execution.

Route handlers may be added later, but they must declare allowed reads/writes, protected areas, output status, verification requirements, and human confirmation requirements.

## Current Rough Edges

- Compatibility files may still be written if intake is resumed.
- The runner filename still says `intake-directive`.
- Prior active and archived intake test drops were purged from the active project surface.
- The old `sample/` folder contents were purged from the active project surface.
- Route execution remains separate from first-pass review.
- Drop lifecycle cleanup remains a future policy issue only if intake is resumed.
- Future hard gates/capability registry remain design work.

## Next Valid Move

Continue Utah FORGE software-build work from the requested runtime/editor/visualization subsystem. Resume intake only by explicit human request.
