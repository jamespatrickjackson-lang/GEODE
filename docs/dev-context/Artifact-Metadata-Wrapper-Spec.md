# Artifact Metadata Wrapper Spec

Last populated: 2026-05-15

## Purpose

This spec defines lightweight metadata wrappers for GeoVox source, intermediate, computed analytical, render-ready, QA/validation, presentation, and provenance/status artifacts.

This does not change runtime behavior.

This does not replace provenance files that already exist.

This does not replace official DHF/control records.

This is a schema/template layer for future artifact status, review, and load-policy decisions.

## Why This Exists

GeoVox must preserve raw-data-to-computed-artifact traceability. Computed complexity is not bloat. Cleanup should target structural confusion, not high-fidelity data, render richness, spatial fidelity, scalar fidelity, contour quality, seismic products, MT products, point-cloud tiles, mesh previews, legends, or provenance clarity.

Runtime loading changes are unsafe until artifacts have clear identity, role, provenance, review status, and load-policy intent. Metadata wrappers give future humans and agents a small, structured place to record what an artifact is, where it came from, how it was produced, what CRS/units/parameters it uses, what limitations apply, and whether human review is required.

## Artifact Families

| Family | Meaning |
| --- | --- |
| `raw_source` | Original client, public, raw, or preserved upstream data. |
| `intermediate_processing` | Inventories, parsed records, staging outputs, CRS transforms, source statistics, or processing support state. |
| `computed_analytical` | Derived analytical outputs such as slices, contours, thresholds, volumes, heat maps, seismic products, or interpretation aids. |
| `render_ready` | Browser/app-consumable outputs such as mesh previews, tiled point clouds, volume buffers, GeoJSON, image textures, or manifests. |
| `qa_validation` | Artifacts used to verify alignment, source correspondence, quality, confidence, counts, bounds, or review boundaries. |
| `presentation` | Page/demo-facing artifacts, display recipes, overlays, labels, legends, and camera-support products. |
| `provenance_status_wrapper` | Metadata, status, manifest, source inventory, stats, caveat, receipt, or review wrapper. |
| `generated_dev_output` | Generated output that may be temporary or dev-only, but must not be deleted without review. |
| `future_placeholder` | Planned, placeholder, scaffold, or future artifact. |
| `unknown` | Artifact family not yet classified. |

## Artifact Types

| Type | Meaning |
| --- | --- |
| `seismic_product` | Seismic sections, raymarch volumes, product manifests, recipes, navigation, or display products. |
| `mt_resistivity` | Magnetotelluric resistivity data, grids, stations, tiles, volumes, surfaces, slices, legends, or manifests. |
| `scalar_volume` | 3D scalar grid or volume product. |
| `scalar_slice` | Horizontal, vertical, or oblique scalar slice. |
| `threshold_surface` | Iso-value or threshold-derived surface. |
| `top_surface` | Ground cap, top surface, or preview-derived top mesh. |
| `isoline` | Equal-value or equal-support line product. |
| `isoband` | Filled band between scalar/support ranges. |
| `contour` | Contour line product from mesh, grid, terrain, or scalar data. |
| `heat_map` | Raster/grid intensity, anomaly, support, or grade display. |
| `point_cloud_tile` | Tiled or sampled point-cloud artifact. |
| `mesh_surface` | Mesh, surface preview, glTF, or triangulated surface output. |
| `photo_texture_overlay` | Orthomosaic, projected image, texture, or photo overlay. |
| `station_marker` | Station, marker, control point, camera position, or sample marker. |
| `well_path` | Well, drillhole, path, trace, or collar/path artifact. |
| `terrain` | Terrain or elevation surface. |
| `vector_context` | Roads, water, boundaries, property context, areas, or line/polygon overlays. |
| `legend_color_ramp` | Color ramp, legend, scalar range, threshold, or display-window record. |
| `stats_manifest` | Counts, bounds, stats, manifest, index, or status record. |
| `other` | Known artifact that does not fit another type. |

## Required Metadata Fields

The template includes these fields so future wrappers can preserve both deterministic source state and review status. The JSON schema marks the fields required at the wrapper level; values may remain empty, null, or `unknown` when evidence is incomplete.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Schema version used by the wrapper. |
| `artifactId` | Stable wrapper-local artifact identifier. |
| `project` | Project slug or project name. |
| `dataset` | Dataset or data family name. |
| `artifactFamily` | One artifact family from this spec. |
| `artifactType` | One artifact type from this spec. |
| `renderRole` | Proposed render role. |
| `loadClass` | Proposed runtime/load-policy class. |
| `sourceType` | Whether the artifact is source, client, public, processed, generated, future, mixed, or unknown. |
| `epistemicStatus` | Whether the wrapper claim is observed, transformed, derived, approximate, inferred, proposed, accepted, rejected, superseded, or unknown. |
| `authority` | Basis for the wrapper, such as repo evidence, human review, generated output, or example template. |
| `status` | Review/status state for the wrapper. |
| `reviewRequired` | Boolean. Defaults to true for templates/examples. |
| `accepted` | Boolean. Must remain false unless explicitly accepted by a human. |
| `paths` | Source, artifact, manifest, and provenance paths. |
| `inputs` | Input files, folders, products, or source records. |
| `producedBy` | Script/tool/generation timestamp when known. |
| `crs` | Source CRS, scene CRS/coordinate basis, and transform path. |
| `units` | Horizontal, vertical, and scalar units. |
| `scalar` | Scalar transform, range, thresholds, and color/legend linkage. |
| `processing` | Method, parameters, downsampling, masking, gridding, contouring, or interpolation notes. |
| `stats` | Counts, bounds, ranges, dimensions, or output statistics. |
| `render` | Color ramp, legend, material/depth/opacity/camera/check notes. |
| `provenance` | Provenance file path and notes. |
| `limitations` | Known caveats and limitations. |
| `relatedLayers` | Project layer IDs that consume or represent the artifact. |
| `relatedPages` | Page IDs that use or display the artifact. |
| `notes` | Human-readable notes and evidence caveats. |

## Render Roles

| Role | Meaning |
| --- | --- |
| `default_visual` | Intended to be visible in default project/page state. |
| `high_fidelity_client_facing` | Rich client-facing artifact used for beauty, credibility, or understanding. |
| `technical_credibility` | Artifact used to explain source quality, method, or technical basis. |
| `qa_validation` | Artifact used for validation or review, not necessarily polished presentation. |
| `optional_advanced` | Advanced layer/product available intentionally, usually by page or toggle. |
| `future_placeholder` | Future/planned placeholder role. |
| `unclear_needs_review` | Role is not yet safe to assume. |

## Load Classes

| Class | Meaning |
| --- | --- |
| `startup_critical` | Required immediately for app/project shell or first meaningful scene setup. |
| `first_page_required` | Required for the first page to render correctly. |
| `page_required` | Required for one or more specific pages. |
| `preload_near_page` | Useful to preload near a page transition. |
| `toggle_on_demand` | Should load only when intentionally toggled or requested. |
| `high_fidelity_client_facing` | Rich artifact that may be heavy but valuable for client-facing quality. |
| `technical_credibility` | Technical support layer/artifact that should remain available. |
| `qa_validation` | QA/review artifact. |
| `computed_artifact_support` | Support artifact required to preserve raw-to-computed traceability or render meaning. |
| `future_placeholder` | Planned/future layer or artifact. |
| `generated_dev_output` | Candidate generated/dev output requiring review before cleanup. |
| `blocked_unknown` | Blocked, contradictory, or unclear. |
| `needs_human_review` | Human review required before load behavior is changed. |

## Epistemic Status

| Status | Meaning |
| --- | --- |
| `observed` | Directly observed in local files. |
| `transformed` | Produced by a known transformation. |
| `derived` | Derived from source or intermediate state. |
| `approximate` | Approximate product, fallback, preview, or estimated transform. |
| `inferred` | Interpretation based on evidence, not deterministic source. |
| `proposed` | Proposal or planning classification. |
| `accepted` | Accepted by explicit human review. |
| `rejected` | Rejected by explicit human review. |
| `superseded` | Replaced by a newer accepted or reviewed state. |
| `unknown` | Not yet known. |

AI or Codex may write proposed/needs-review metadata, but must not mark `accepted=true` unless explicitly approved by a human.

## Accuracy Metadata

Before an artifact can be treated as technically reliable, record or review:

- source inputs
- processing script/tool
- CRS/source coordinate basis
- scene transform/origin
- units
- scalar transform
- parameters
- interpolation, gridding, downsampling, and masking if applicable
- output counts, stats, and bounds
- provenance/status
- limitations

If this evidence is incomplete, keep `status` as `needs_review` and `accepted` as `false`.

## Beauty / Render Metadata

Before an artifact can be treated as client-facing, record or review:

- color ramp / legend
- opacity/material/depth behavior
- camera/page context
- label/status/provenance visibility
- spatial relationship to other layers
- screenshot/visual check if available
- known render limitations

Rendering beauty and technical accuracy both matter. A technically traceable artifact can still be unacceptable if it renders poorly, loses scale, weakens camera/page composition, or obscures provenance.

## Placement Guidance

Future placement options, not executed here:

- project-local wrappers may later live under `projects/<project>/artifact_metadata/`
- generated-output-adjacent wrappers may later live beside generated artifacts
- project-wide manifest summaries may later point to wrapper files
- prep scripts may later emit or refresh wrappers alongside generated outputs

For now, this implementation only creates schema, templates, examples, and validator support under `docs/dev-context` and `tools`.

## Validator And Coverage Tooling

Observed: `tools/validate-artifact-metadata.mjs` now supports project-wide wrapper validation with:

- explicit file validation, as before
- default template/example validation when no arguments are provided
- `--project projects/utah-forge` validation against `artifact_metadata/index.json`
- detection of wrapper files listed in the index but missing on disk
- detection of wrapper files present on disk but missing from the index
- duplicate JSON key detection before `JSON.parse`, so repeated keys such as `visualCheckReceipt` are treated as validation failures

Observed: `tools/report-project-artifact-coverage.mjs` now generates ignored read-only project coverage reports under `test-results/project-artifact-coverage/`. The report is review input only and does not change wrapper acceptance, runtime behavior, project manifests, pages, visibility, rendering, prep scripts, data artifacts, or generated outputs.

## First Project-Local Utah FORGE Wrappers

Observed: the first project-local Utah FORGE wrappers now exist under `projects/utah-forge/artifact_metadata/` for:

- `utah-forge-mt-stations`
- `utah-forge-mt-resistivity-slices`
- `utah-forge-phase3-seismic-browser`

These wrappers are not accepted state. They do not change runtime behavior, project manifests, page JSON, visibility, rendering, loader behavior, prep scripts, data artifacts, generated outputs, or official DHF/control records.

Observed: Utah FORGE wrapper coverage now exists at `projects/utah-forge/artifact_metadata/WRAPPER_COVERAGE.md`. The coverage file is review guidance only; it does not create additional wrappers, mark wrappers accepted, or change runtime behavior.

Observed: Utah FORGE batch 2A wrappers now exist under `projects/utah-forge/artifact_metadata/` for MT full-density tiled data, MT scalar volume, and MT threshold surfaces. These wrappers are review inputs only. They are `needs_review`, `reviewRequired=true`, and `accepted=false`; they do not authorize runtime loading changes, visibility changes, render changes, prep changes, data moves, or client-facing acceptance.

Observed: Utah FORGE batch 2B wrappers now exist under `projects/utah-forge/artifact_metadata/` for seismic navigation/inventory/provenance, seismic recipes/presets/export layouts, and MT top surface / ground cap. These wrappers are review inputs only. They are `needs_review`, `reviewRequired=true`, and `accepted=false`; they do not authorize runtime loading changes, visibility changes, render changes, prep changes, data moves, or client-facing acceptance.

## Do-Not-Do Rules

- Do not move source data.
- Do not rename generated outputs.
- Do not delete QA artifacts.
- Do not downsample or compress further without recording parameters and visual/technical impact.
- Do not change scalar ranges or color ramps without preserving legend/provenance.
- Do not treat generated artifacts as junk merely because they are numerous.
- Do not mark AI interpretation as accepted state.
- Do not use wrappers as approval to change runtime behavior, visibility, rendering, loaders, pages, manifests, or prep scripts.
