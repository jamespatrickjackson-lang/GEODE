# Utah FORGE Next Stage Gates

Updated: 2026-05-12

This file breaks the next Utah FORGE work into chunks with clear deliverables, agent acceptance criteria, and user-side review points.

The agent/dev owns technical correctness. The user review should focus on story, visual read, and whether the demo communicates well.

## Gate A - Current Baseline Verification

Purpose:

Confirm the current Phase 3 MT layers still load after docs and handoff updates.

Agent acceptance criteria:

- Utah FORGE opens from the landing page or `?project=utah-forge`
- `utah-forge-mt-stations` is visible and toggles
- `utah-forge-mt-resistivity-full-density` is visible and toggles
- `utah-forge-mt-resistivity-slices` remains available and toggles
- value legend appears when enabled
- `project.json` and `environment.json` parse
- no active preview file path is missing

User-side check:

- Confirm the scene is visible.
- Confirm the full-density view reads as a geophysical model, not visual noise.
- Flag only visual/story issues; do not take on coordinate verification.

## Gate A2 - Stage 2 Full-Density MT Renderer

Purpose:

Upgrade the Phase 3 MT resistivity visualization from sampled QA preview to full-density tiled scalar rendering.

Deliverables:

- full-density manifest, stats, provenance, and binary tile outputs
- scalar-aware tiled point-cloud loader
- `utah-forge-mt-resistivity-full-density` project layer
- inferred `utah-forge-mt-top-surface` topology-aid layer
- default visibility set to stations plus full-density MT plus the preview-derived ground cap

Agent acceptance criteria:

- emitted point count is 1,094,624
- masked zero/non-positive row count is 316
- no crop or vertical exaggeration is applied
- preview-derived ground cap is labeled as an approximate visual ground-layer aid, not terrain or geology
- scalar ramp, point size, opacity, and legend controls affect the full-density layer
- QA preview and authored slices remain available but not default visible
- no seismic files are processed or wired

User-side check:

- Confirm the full-density view reads as an upgraded MT model visualization.
- Flag performance, color, density, or readability issues.

## Gate B - Phase 3 MT Page Story

Purpose:

Turn the current data layers into a guided presentation.

Status:

Deferred until the Stage 2 full-density renderer is stable.

Deliverables:

- revised page list
- overlay markdown for each page
- camera pose for each page
- page-level visibility/slice presets if needed

Agent acceptance criteria:

- pages can be navigated without opening editor panels
- each page has a clear title/subtitle
- overlay text states measured vs source-derived status
- no future layer is shown as active data
- no crop or vertical exaggeration is implied

User-side check:

- Run the pages like a client demo.
- Tell the agent where the story loses clarity or impact.

## Gate C - Visual Tuning Pass

Purpose:

Make the Phase 3 MT full-density renderer and optional slices look intentional and demo-worthy.

Deliverables:

- tuned scalar ramp defaults
- tuned display min/max/midpoint/contrast
- tuned station marker radius/lift
- tuned full-density point size and opacity
- tuned slice visibility presets
- tuned legend visibility and placement if needed

Agent acceptance criteria:

- editor controls still work
- layer styles persist through project save
- default view is visually legible
- log Ohm-m value meaning is visible or documented
- no data values are silently transformed beyond documented style mapping

User-side check:

- Judge color/readability.
- Decide whether the visual language feels right for a Geovox client-facing demo.

## Gate D - Phase 3 MT Interpretation Context

Purpose:

Add useful explanatory context without overclaiming.

Deliverables:

- short provenance/readme overlay or sidebar copy
- simple explanation of station network and inversion model
- optional notes about value scale
- optional known-caveat note about vertical extent

Agent acceptance criteria:

- language is technically honest
- source-derived model is not called measured
- user-facing copy is not overloaded with raw processing details
- source/provenance is still traceable in docs

User-side check:

- Tell the agent whether the copy sounds usable for your audience.

## Gate E - Decide Next Data Family

Purpose:

Choose the next dataset only after Phase 3 MT presentation is stable.

User boundary:

Seismic is blocked until the user explicitly says to start.

Options:

- Phase 3 seismic analysis
- Southwestern/regional MT
- wells/faults/infrastructure
- terrain/context surface
- runtime volume/slice controller

Agent acceptance criteria before starting:

- user explicitly chooses the next family
- source folder is identified
- source inventory plan is written
- CRS/provenance requirements are understood

User-side check:

- Choose what supports the next meeting/demo best.

## Gate F - Future Data Intake

Purpose:

Repeat the data pipeline safely for the chosen new dataset.

Deliverables:

- source placement under `client_preprocessed/`
- inventory under `geosee_processed/.../intake/`
- CRS/origin doc
- first proof output
- provenance
- project/environment layer wiring
- editor controls

Agent acceptance criteria:

- no source/client files are moved into `geosee_processed/`
- no active layer points at unsorted source
- all coordinate assumptions are documented
- build passes after code changes

User-side check:

- Confirm the visual endpoint supports the project story.

## Current Recommended Path

The next best path is:

```text
Gate A -> Stage 2 full-density renderer verification -> Gate C
```

Hold Gate B story work and Gate E future data work until the Stage 2 full-density MT renderer is stable. Do not start seismic until the user explicitly says to start.
