# Render Quality Checks

## Purpose

This is a docs-only planning rail for future render-quality and computed-artifact-quality verification. It does not change runtime behavior, manifests, pages, source data, prep scripts, rendering, or computed artifacts.

## Principle

Bloat reduction means reducing structural confusion, not reducing rendering quality.

Computed complexity is not bloat. Cleanup must preserve technical accuracy and presentation quality for source-derived outputs, generated artifacts, high-fidelity layers, QA products, legends, and provenance/status wrappers.

## Evidence Used

| Evidence | Observed role |
| --- | --- |
| `docs/dev-context/Layer-Artifact-Classification.md` | Current layer/artifact risk classification for Utah FORGE, Shahbazi / Case Study B, and Woodjam. |
| `docs/dev-context/Computed-Artifact-Pipeline.md` | Raw-to-computed artifact pipeline map and protection rules. |
| `docs/dev-context/Data-System-App-Refinement-Plan.md` | Current proposed structure plan and render guardrails. |
| `docs/dev-context/Runtime-Loading-Policy.md` | Proposed loading policy that must be checked against render/computed-artifact quality before implementation. |
| `src/loaders/surfaceRenderPolicy.ts` | Observed named surface/photo depth policies, render order, opacity, polygon offset, material side, and depth behavior. |
| `src/scene/SceneManager.ts` | Observed scalar, seismic, volume, section, page/layer, camera, opacity, and transition behavior. |
| `src/scene/layerLoaders.ts` and selected `src/loaders/*` | Observed loader consumers for seismic, scalar volumes, tiled point clouds, mesh previews, contours/lines, terrain, and overlays. |
| Project `environment.json` and page JSON files | Observed default visibility, layer overrides, visibility overrides, camera state, and per-page presentation state. |

Sync note: this file was created before `Runtime-Loading-Policy.md`; the runtime policy now exists and cross-references these checks as a prerequisite for future loading changes.

Coverage note: `tools/report-project-artifact-coverage.mjs` now writes ignored reports under `test-results/project-artifact-coverage/`. This generated report does not replace visual/render verification, screenshots, build/typecheck evidence, provenance review, or human acceptance.

Runtime diagnostics note: `docs/dev-context/Runtime-Diagnostics.md` now documents a dev-only diagnostics hook. Diagnostics snapshots are structural/resource evidence and can show loaded/visible layer state, but they do not replace screenshot review, visual quality judgment, camera/page composition review, source/provenance review, or human acceptance.

## Non-Negotiables

- client-data richness preserved
- seismic preserved and refined
- high-fidelity artifacts preserved
- computed-artifact pipeline preserved
- spatial scale preserved
- camera/page aesthetics preserved
- material/depth behavior preserved
- color ramps/legends preserved
- provenance/status clarity preserved

## Risky Rendering Change Categories

These changes require human review before implementation:

| Category | Why risky |
| --- | --- |
| `renderOrder` | Can change whether surfaces, contours, overlays, seismic sections, point clouds, and labels read cleanly together. |
| `depthWrite` / `depthTest` | Can create false occlusion, z-fighting, see-through artifacts, or hidden high-value data. |
| `polygonOffset` | Can fix or break overlay/surface/contour separation; unsafe to tune casually. |
| Material `side` | Front/back/double-sided behavior can alter surfaces, slices, seismic sections, photo overlays, and volume boxes. |
| Transparency / opacity defaults | Can make rich data disappear, overstate precision, or clutter the scene. |
| Color ramp changes | Can alter perceived scalar/seismic meaning and client trust. |
| Scalar range changes | Can hide or exaggerate values in MT, volumes, slices, point clouds, contours, and heat maps. |
| Point size changes | Can turn high-density point/scalar data into haze, noise, or false sparsity. |
| Volume/raymarch sampling changes | Can reduce visible structure, make volumes blocky, or change perceived amplitude/scalar continuity. |
| Camera/page framing changes | Can damage presentation polish and spatial comprehension even when data is unchanged. |
| Default layer visibility/loading changes | Can silently change the story, performance profile, and perceived readiness of a project. |
| Seismic product filtering | Can hide active seismic work or select products without provenance/context review. |
| Full-density/QA layer loading | Can confuse client-facing layers with QA layers, or reduce credibility by omitting full-density products. |

## Risky Computed-Artifact Change Categories

These changes require human review before implementation:

| Category | Why risky |
| --- | --- |
| Isoline/isoband interval changes | Can change analytical meaning and support/confidence communication. |
| Contour simplification | Can damage contour fidelity, scale cues, and surface interpretation. |
| Heat-map interpolation changes | Can create false smoothness, false gaps, or shifted anomaly patterns. |
| Scalar transform changes | Can alter values through log, normalization, clipping, contrast, or threshold changes. |
| Threshold changes | Can change which regions are highlighted as meaningful surfaces or volumes. |
| Slice plane/elevation/depth changes | Can change the geological/geophysical story shown by slices and sections. |
| Seismic section/product filtering | Can alter evidence shown, product context, amplitude range, or survey meaning. |
| Gridding/interpolation method changes | Can alter surfaces, volumes, contours, slices, and heat maps. |
| Downsampling/tile strategy changes | Can reduce sampling quality, full-density credibility, and local detail. |
| CRS/origin/scene transform changes | Can break spatial fidelity and cross-layer alignment. |
| Masking/null handling changes | Can hide missing data or create false continuity. |
| Provenance wrapper changes | Can sever source-to-artifact traceability. |
| Stats/count output changes | Can make validation and acceptance impossible to compare across runs. |

## Visual Check Scenes

Planned visual checks for future implementation or verification prompts:

| Check scene | Layers / artifacts | What must be preserved |
| --- | --- | --- |
| Utah FORGE MT stations + resistivity slices | MT station markers, MT slices, legend/status | Station alignment, slice color ramp, scalar units, camera framing, and readable legend/status. |
| Utah FORGE seismic section/browser product | Seismic browser section or raymarch product | Product selection, navigation placement, amplitude range, colormap, opacity, legend/status, and disclosure. |
| Utah FORGE MT + seismic co-render | MT full-density/slices/volume plus seismic product | Spatial relationship, depth behavior, opacity balance, camera polish, and multi-method credibility. |
| Scalar volume or full-density technical layer | Utah MT scalar volume or full-density point/scalar tiles | Sample density, scalar range, transfer function, point size, volume sampling, and performance disclosure. |
| Threshold surface or top surface | Utah threshold surfaces or MT top surface | Material/depth behavior, caveats, threshold meaning, surface opacity, and color clarity. |
| Isoline/isoband/contour/heat-map layer if available | Shahbazi tie-point isolines/isobands, Shahbazi contours, Woodjam scalar/geochem/gamma layers, future heat maps | Interval/range fidelity, line clarity, fill opacity, interpolation caveats, and legend/status. |
| Shahbazi surface + contours | TLS surface preview, outer surface, split contours | Surface/photo depth policy, contour fidelity, material quality, and preview caveats. |
| Shahbazi point cloud/surface/photo overlay if available | TLS tiled preview, surface previews, photo overlay | Projection alignment, texture clarity, opacity/material behavior, and source/provenance labels. |
| Woodjam reference project open/regression | Woodjam terrain, drilling, assays, geochem, geology, context layers | Baseline app/project regression, camera/page flow, layer styles, legends/status, and source/path stability. |

## Computed Artifact Verification Checks

Each artifact family should be checked for:

- source inputs exist
- script/tool identified
- CRS/transform recorded
- units recorded
- scalar transform recorded
- parameters recorded
- output counts/stats recorded
- bounds recorded
- provenance/status exists
- render-ready artifact path exists
- visual rendering checked
- limitations recorded

Do not call an artifact technically accurate unless the evidence covers source, CRS/transform, units, parameters, stats/counts, provenance/status, and limitations. Do not call an artifact client-ready unless the rendering quality and presentation context are checked too.

## Focused Evidence Format

A render/computed-artifact evidence note should capture only what the current task needs:

First Utah FORGE MT/seismic historical evidence was purged from active context and removed from reachable Git history.

This first receipt is not acceptance. It records metadata/path/build evidence and explicitly leaves visual rendering, screenshot evidence, and MT/seismic co-render quality as `needs review`.

Focused Utah FORGE MT/seismic demo page evidence should be recaptured when needed.

Historical screenshot/runtime evidence was purged from active context and removed from reachable Git history. It is not current acceptance.

Utah FORGE demo walkthrough v0 historical evidence was purged from active context.

Fresh screenshot/runtime evidence should be captured for current MT slices, seismic, and MT + seismic integration decisions. Do not rely on purged historical receipts for current acceptance.

| Field | Expected content |
| --- | --- |
| project | Project ID/name. |
| page | Page ID/title, or note if no page state was used. |
| layers visible | Layer IDs and any product/subproduct IDs. |
| artifact IDs | Manifest/product/tile/mesh/slice/section IDs where available. |
| input/source IDs | Source paths, source inventory IDs, or source register links. |
| processing script if applicable | Prep/build script or external tool name. |
| camera/page state | Camera position/target/FOV or page JSON reference. |
| screenshots if available | Screenshot paths or a note that no visual capture was taken. |
| build result | Build/test result if run; otherwise explicitly `not run`. |
| visual pass/fail | Pass/fail/needs review, with notes. |
| accuracy metadata pass/fail | Pass/fail/needs review against source/script/CRS/units/parameters/stats/provenance. |
| rendering concerns | Depth, opacity, camera, color, material, label, legend, or composition concerns. |
| spatial/provenance concerns | CRS, origin, alignment, bounds, source, status, or limitation concerns. |
| human review status | Accepted, rejected, superseded, proposed, or needs review. |

## Do-Not-Regress List

Observed high-risk areas:

- surface/photo depth policy
- seismic raymarch/section display
- scalar color/legend display
- contour/isoband/heat-map fidelity
- layer opacity/visibility page overrides
- editor/presenter camera/page flow
- MT/seismic co-rendering
- full-density point/scalar sampling and tile integrity
- scalar volume masks, sampling, thresholds, and transfer functions
- terrain/context spatial anchoring
- source/provenance/status visibility for client-facing artifacts

## Human Review Needed

- Which visual check scenes are mandatory before runtime cleanup?
- Which artifacts need screenshots, build verification, or both?
- Which artifacts need a per-artifact metadata wrapper before client-facing acceptance?
- What minimum visual standard applies to seismic, MT full-density, volumes, slices, thresholds, contours, and photo overlays?
- Which QA layers are hidden, page-scoped, or shown for technical credibility?
- Which changes can be reviewed by Codex only, and which require explicit human acceptance?
