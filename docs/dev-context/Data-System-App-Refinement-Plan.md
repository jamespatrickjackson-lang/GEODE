# Data / System / App Refinement Plan

Last populated: 2026-05-15

## Human Context

- External control-plane implementation is parked for now.
- Seismic is needed and underway.
- Updated time-pressure/demo goals will arrive later.
- Current work is structural refinement, not locked scope.
- Rendering beauty and high-quality client-data visualization must not be compromised.
- Bloat reduction means reducing structural confusion, not reducing rendering quality or turning rich datasets into thin visual products.

## Non-Negotiable Rendering Guardrail

Bloat reduction must not mean visual downgrade. Preserve:

- high-quality rendering
- spatial fidelity
- camera/page polish
- rich client-data visualization
- technical credibility
- provenance/status clarity
- necessary complexity where it improves understanding

Any performance, bundle, loader, data, or module-size recommendation is unsafe unless it preserves these qualities.

## Current Structural Diagnosis

| Area | Observed diagnosis | Risk |
| --- | --- | --- |
| Data structure | Project data already separates source/raw/client data from browser-ready processed output, but status language is uneven across READMEs, manifests, and docs. | Future agents may confuse source, QA, preview, high-fidelity, and placeholder artifacts. |
| App/runtime structure | App selects a project, fetches manifest/environment/pages, mounts scene, registers layers, and loads layer specs. Editor chrome is lazy-loaded, but layer loading appears broad at scene mount. | Heavy layers and project-specific behavior may be hard to reason about without an intentional loading/presentation policy. |
| Page/layer structure | `project.json` owns `pageOrder`; `environment.json` owns defaults/styles; pages own camera plus `visibilityOverrides` and `layerOverrides`. | Default, page, product, and opacity visibility can diverge, especially in Utah seismic. |
| Loader structure | `src/scene/layerLoaders.ts` mixes generic loaders, type-based loaders, and project/id-specific loaders. | Loader registry sprawl can obscure ownership and make project-specific behavior look generic. |
| Project-specific logic | Utah FORGE MT/seismic and Shahbazi-specific behavior appear in generic scene/editor modules. | Broad modules become harder to change safely without touching unrelated projects. |
| Docs/control context | `docs/dev-context` now captures current app-build state, dataset maps, code maps, and focused visual/build guidance. | It is a lightweight build context, not accepted scope or official DHF. |
| Seismic state | Utah seismic artifacts, scripts, source loader, scene/editor controls, tests, manifest, recipes, and generated products exist. Docs still contain older blocked/not-active statements. | Seismic must be preserved and clarified, not parked by assumption. |
| Full-density/high-complexity state | Utah MT full-density, scalar volume, threshold surfaces, slices, top surface, and seismic raymarch/section products exist. Shahbazi has rich processed previews and future full-resolution targets. | High-complexity data should be loaded and presented intentionally, not removed or blindly defaulted. |

## Planning Artifacts Present

| Artifact | Status | Boundary |
| --- | --- | --- |
| `projects/utah-forge/DATA_LAYER_STATUS.md` | Observed present | Project-local status guidance only; not runtime behavior, not official DHF, and not accepted demo scope. |
| `docs/dev-context/Render-Quality-Checks.md` | Observed present | Proposed visual/computed-artifact quality checks; requires human review before becoming a verification gate. |
| `docs/dev-context/Runtime-Loading-Policy.md` | Observed present | Proposed loading policy design; no runtime loading, manifest, page, or visibility change approved. |
| `docs/dev-context/Project-Load-Class-Table.md` | Observed present | Proposed load-class review table using current manifest/default/page evidence; review input only, not runtime behavior. |
| `docs/dev-context/Artifact-Metadata-Wrapper-Spec.md` plus schema/templates | Observed present | First implementation slice: non-runtime metadata wrapper spec/schema/templates/examples/validator; no project data, prep, or runtime behavior changed. |
| `projects/utah-forge/artifact_metadata/` | Observed present | First real project-local wrappers for MT stations, MT slices, and Phase 3 seismic browser; all are `needs_review`, `reviewRequired=true`, and `accepted=false`. |
| `projects/utah-forge/artifact_metadata/WRAPPER_COVERAGE.md` | Observed present | Utah FORGE wrapper coverage and second-batch recommendation; proposed/review input only, not accepted scope. |
| Utah FORGE wrapper batch 2A | Observed present | Project-local wrappers now exist for MT full-density tiled data, MT scalar volume, and MT threshold surfaces; review input only, not accepted scope or runtime behavior. |
| Utah FORGE wrapper batch 2B | Observed present | Project-local wrappers now exist for seismic navigation/provenance, seismic recipes/presets, and MT top surface; review input only, not accepted scope or runtime behavior. |
| Old render evidence template | Purged from active context | The receipt-template flow was removed from active context. Capture fresh, focused visual/build evidence only when a current task needs it. |
| First Utah FORGE MT/seismic historical evidence | Purged from active context | Historical evidence was removed from reachable Git history; no runtime/app/project/data behavior changed and visual acceptance remains open. |
| Metadata validator hardening and project coverage reporting | Observed present | `tools/validate-artifact-metadata.mjs` now supports project-wide validation and duplicate-key detection; `tools/report-project-artifact-coverage.mjs` generates ignored all-project coverage reports under `test-results/project-artifact-coverage/`. |
| Dev-only runtime diagnostics and Utah open receipt | Observed present | `src/scene/layerDiagnostics.ts` exposes read-only dev diagnostics via `window.__GEOVOX_DIAGNOSTICS__`; `VER-2026-05-15-002-utah-forge-runtime-open-diagnostics.md` records a first app open, screenshot, and runtime snapshot as needs-review evidence. |
| Utah FORGE MT + seismic demo page | Observed present | `projects/utah-forge/pages/20_mt_seismic_integration_check.json` creates a bounded verification page for MT slices plus Phase 3 seismic browser. It is pending visual/human review and is not accepted final demo scope. |
| Utah FORGE demo walkthrough v0 | Observed present | `projects/utah-forge/pages/30_demo_site_context.json` through `35_demo_provenance_review.json` create a six-page page/overlay walkthrough with screenshot and diagnostics evidence. It is pending visual/human review and is not accepted demo scope. |
| `docs/dev-context/Loader-Project-Module-Audit.md` | Observed present | Read-only audit of future loader/project-module boundary; planning input only, with no loader registry, SceneManager refactor, runtime behavior, rendering, project config, page, data, or prep changes. |
| Loader Registry Slice 1 | Observed implemented | `src/scene/layerLoaderRegistry.ts` exists and `src/scene/layerLoaders.ts` uses it internally while preserving `loadLayerInto(spec, manager)` and keeping all handlers in place. Project-specific extraction, lazy loading, lifecycle/disposal, and SceneManager split remain future work. |
| Loader Registry Slice 1B | Observed implemented | Project-module sentinel extraction moved only `base-gui-reference-stage` and `utah-forge-reference-stage` handler definitions into project-module registration files. Heavy/data handlers, lazy loading, lifecycle/disposal, and SceneManager split remain future work. |
| Loader Registry Slice 1B visual/runtime regression receipt | Observed present | `VER-2026-05-16-004-loader-registry-slice-1b-visual-regression.md` records Base GUI and Utah FORGE open checks, screenshots, diagnostics, wrapper validation, coverage, and build result. It is verification evidence only and remains needs-review. |

These records are planning/control artifacts, not accepted final scope.

## Data Structure Target

Target project data should make artifact intent obvious without flattening complexity:

| Class | Meaning | Desired handling |
| --- | --- | --- |
| Source/client/public data | Original, client-preprocessed, public, or raw input material. | Preserve near project data; never treat as disposable preview output. |
| Processed/browser-ready data | Derived assets intended for runtime loading. | Keep under `processed` / `geosee_processed` with stable manifests and provenance. |
| Manifests | Runtime or artifact contracts such as project/layer/product manifests. | Make status, source path, artifact class, and intended use explicit. |
| Provenance/status metadata | Records explaining source, derivation, caveats, dates, and confidence. | Keep adjacent to artifacts; surface key status in docs and UI where useful. |
| QA/validation artifacts | Data used to check alignment, fidelity, processing, or confidence. | Preserve separately from demo visuals; label as QA/validation. |
| Full-density/high-fidelity artifacts | Rich or heavy data needed for fidelity, credibility, or client understanding. | Preserve and classify; decide intentional load/presentation policy. |
| Demo/page-facing artifacts | Curated artifacts used directly in pages or client walkthroughs. | Link to page/layer intent without implying they replace source or full-density data. |
| Future/placeholder artifacts | Planned or synthetic placeholders. | Keep clearly marked as placeholder/future and avoid silent promotion. |

## App / System Target

| Boundary | Target responsibility |
| --- | --- |
| Core runtime | Project loading, scene mount, environment/page composition, and stable layer lifecycle contracts. |
| Project modules | Project-specific constants, presets, status assumptions, and specialized behavior kept outside generic runtime where possible. |
| Layer loaders | Type- or artifact-specific loaders with clear ownership, data contract expectations, and disposal/resource notes. |
| Scene orchestration | Camera, environment, visibility, transitions, render policy application, and layer lifecycle coordination. |
| Editor | Authoring controls, overrides, save/dirtiness state, and explicit project/page/layer editing modes. |
| Presenter | Lightweight playback/presentation surface that can use curated page state without carrying full editor affordances. |
| Page system | Clear inheritance from environment defaults plus page deltas, including visibility, style, overlays, camera, and high-complexity layer intent. |
| Render policies | Named policies that preserve fidelity, beauty, spatial relationship, and technical credibility. |
| Verification/render checks | Checks that detect blank/weak rendering, wrong scale, broken cameras, missing provenance/status, and accidental quality downgrades. |

## Seismic Policy For Now

Because seismic is needed and underway:

- Do not park seismic by default.
- Do not hide, downgrade, delete, or simplify seismic by assumption.
- Classify seismic status honestly across source, processed output, manifest, page, editor, test, and docs.
- Preserve active seismic work, including source inventory, navigation, provenance, browser products, recipes, scripts, loader, editor controls, scene logic, and tests.
- Require human review for default demo behavior.
- Require provenance/status clarity for client-facing seismic.
- Avoid half-wired or visually weak client-facing seismic unless intentionally accepted.
- Reconcile older blocked/not-active docs as documentation status questions, not as an instruction to remove current seismic work.

## Full-Density / High-Complexity Policy

- Do not delete or downgrade high-complexity data.
- Do not default-load blindly.
- Do not treat full-density or high-fidelity artifacts as bloat merely because they are heavy.
- Classify intentional use:
  - client-facing high-fidelity
  - technical credibility
  - QA/validation
  - optional advanced
  - too risky / unclear
- Load and present complexity intentionally.
- Prefer status/provenance/load-policy clarity over reducing dataset richness.

## Computed Artifact Pipeline Guardrail

Observed: `Computed-Artifact-Pipeline.md` now explicitly protects the raw-data-to-computed-artifact path. Isolines, isobands, contours, heat maps, scalar slices, scalar volumes, threshold surfaces, seismic products, point-cloud tiles, mesh/surface previews, photo overlays, legends, color ramps, statistics, and manifests are core GeoVox capabilities.

Proposed only: Future cleanup should reduce unmanaged ownership, unclear provenance, stale docs, unclear load policy, and lifecycle ambiguity. It should not reduce sampling quality, scalar fidelity, CRS correctness, contour fidelity, color-ramp quality, legend clarity, or visual beauty.

## Render / Computed-Artifact Checks Prerequisite

Observed: `Render-Quality-Checks.md` now defines proposed minimum visual and computed-artifact verification checks.

Proposed only: Before runtime cleanup, loader cleanup, page/layer visibility changes, project-specific logic isolation, data moves, artifact regeneration, or performance optimization, review the applicable render/computed-artifact checks. Cleanup is unsafe if it changes render order, depth behavior, opacity, material side, color ramps, scalar ranges, point size, raymarch sampling, camera/page framing, default visibility/loading, seismic product selection, full-density loading, CRS/origin transforms, gridding/interpolation, masks, thresholds, contours, slices, stats, or provenance without preserving technical accuracy and presentation quality.

## Runtime Loading Policy Design

Observed: `Runtime-Loading-Policy.md` now records the current project-load/scene-mount/page-visibility behavior and proposes staged load classes for review.

Proposed only: Future loading cleanup should start with classification and use existing environment/page visibility evidence before adding schema fields or runtime lazy loading. Broad SceneManager splits, layerLoader refactors, editor/presenter separation, and project-specific loader isolation remain parked until load classes, render-quality checks, and computed-artifact guardrails are reviewed.

## Project Load-Class Table

Observed: `Project-Load-Class-Table.md` now maps existing Utah FORGE, Case Study B / Shahbazi, and Woodjam manifest layer IDs to proposed load classes using current default visibility and page-reference evidence.

Proposed only: The table is a planning input for human review. It should not be treated as approval to change layer loading, default visibility, pages, runtime allocation, seismic behavior, high-fidelity data, or computed artifacts.

## Loader / Project Module Boundary Audit

Observed: `Loader-Project-Module-Audit.md` now maps project selection, `loadProject`, `mountScene`, `SceneManager`, `loadLayerInto`, current ordered loader dispatch, generic loader candidates, and project-specific loader candidates.

Boundary: This is completed planning input only. It does not implement a loader registry, move loader code, change `SceneManager`, change pages/manifests/environment files, alter runtime loading, change visibility, change rendering/material/depth behavior, or change computed artifacts. Human review is still needed before deciding whether the first implementation slice should create a registry with generic handlers only.

## Loader Registry Shell

Observed: Loader Registry Slice 1 now creates the registry shell and routes current loader dispatch through it while preserving the public `loadLayerInto(spec, manager)` call shape.

Boundary: this slice is behavior-preserving architecture scaffolding only. Handlers remain in `layerLoaders.ts`; no Base GUI, Utah FORGE, Shahbazi, Woodjam, public-context, seismic, MT, scalar, volume, terrain, or reference-stage handler was moved. Project-specific extraction, broad SceneManager split, lifecycle/disposal, and runtime lazy loading remain future work requiring human review and visual/runtime regression checks.

## Project-Module Sentinel Extraction

Observed: Loader Registry Slice 1B now extracts only the Base GUI and Utah FORGE reference-stage placeholder handlers into project-module registration files.

Boundary: this is a low-risk sentinel extraction only. No real data loaders or heavy project-specific handlers were moved. Utah FORGE seismic/MT/scalar/volume/threshold/full-density, Shahbazi, Woodjam, public-context, terrain, generic, lazy-loading, lifecycle/disposal, and load-policy work remain future review items.

## Loader Registry Slice 1B Visual Regression

Observed: the Slice 1B visual/runtime regression receipt now exists for Base GUI and Utah FORGE.

Boundary: the check captured screenshots and runtime diagnostics and confirmed wrapper validation, coverage reporting, and build success. It does not accept visual equivalence, change loader behavior, change project/page/data/config files, or approve heavier project-module extraction.

## Artifact Metadata Wrapper Schema

Observed: `Artifact-Metadata-Wrapper-Spec.md`, `schemas/artifact-metadata.schema.json`, template/example JSON files, and `tools/validate-artifact-metadata.mjs` now exist as the first implementation slice after planning.

Boundary: This is non-runtime metadata scaffolding only. It does not create project-local wrappers, modify artifacts, run prep scripts, change project manifests/pages, change loading behavior, or mark any artifact accepted.

## First Utah FORGE Artifact Wrappers

Observed: `projects/utah-forge/artifact_metadata/` now contains a project-local index and three first wrappers: MT station markers, MT resistivity slices, and Phase 3 seismic browser.

Boundary: These wrappers are real project-local metadata records, but still not accepted final scope. They do not change runtime behavior, manifests, pages, visibility, rendering, prep scripts, generated artifacts, or computed outputs.

## Utah FORGE Wrapper Coverage

Observed: `projects/utah-forge/artifact_metadata/WRAPPER_COVERAGE.md` now maps first-wrapper coverage, missing wrapper candidates, and a recommended second wrapper batch.

Boundary: Wrapper coverage is planning/review input only. It does not create the second batch, change runtime loading, change project configuration, change pages, or mark artifacts accepted.

## Utah FORGE Wrapper Batch 2A

Observed: project-local wrappers now exist for MT full-density tiled data, MT scalar volume, and MT threshold surfaces.

Boundary: Batch 2A wrappers are proposed/review input only. They do not change runtime behavior, project manifests, pages, visibility, rendering, prep scripts, generated artifacts, computed outputs, load policy, or acceptance state.

## Utah FORGE Wrapper Batch 2B

Observed: project-local wrappers now exist for seismic navigation/inventory/provenance, seismic recipes/presets/export layouts, and MT top surface / ground cap.

Observed: the old reusable evidence template has been removed from active context. Use fresh, focused artifact visual/technical evidence only when the current task needs it.

Boundary: Batch 2B wrappers and the old evidence-template note are proposed/review input only. They do not change runtime behavior, project manifests, pages, visibility, rendering, prep scripts, generated artifacts, computed outputs, load policy, or acceptance state.

## First Utah FORGE MT / Seismic Historical Evidence

Observed: historical MT/seismic verification evidence existed before the purge and was removed from reachable Git history; active work should capture fresh evidence when needed.

Boundary: This historical evidence does not accept artifacts or demo readiness. It records metadata/path/build evidence and leaves screenshot/open visual verification, co-render readiness, seismic default product, page visibility, and human acceptance open.

## Metadata Validation And Project Coverage Tooling

Observed: `tools/validate-artifact-metadata.mjs` now supports `--project projects/utah-forge`, validates index-listed wrappers plus any discovered `*.metadata.json` files, reports missing/unlisted wrapper files, and detects duplicate JSON keys before parsing.

Observed: `tools/report-project-artifact-coverage.mjs` now generates ignored coverage reports under `test-results/project-artifact-coverage/` from read-only project manifests, environment defaults, pages, and artifact metadata folders.

Boundary: This tooling is implementation support only. It does not change runtime behavior, manifests, pages, visibility, rendering, prep scripts, data artifacts, generated outputs, wrapper acceptance, or final scope.

## Dev-Only Runtime Diagnostics

Observed: a dev-only diagnostics hook now exists through `src/scene/layerDiagnostics.ts` and is installed from `src/App.tsx` only when `import.meta.env.DEV` is true.

Observed: historical runtime-open diagnostics evidence existed before the purge and was removed from reachable Git history. Fresh runtime evidence should be captured for current decisions.

Boundary: Diagnostics are read-only implementation support. They do not change loading, visibility, rendering, materials, camera/page state, scalar ranges, color ramps, seismic products, MT products, computed artifacts, prep scripts, project manifests, page JSON, or data artifacts.

## Utah FORGE MT + Seismic Demo Page

Observed: `projects/utah-forge/pages/20_mt_seismic_integration_check.json` now exists and is listed in `projects/utah-forge/project.json` page order. It shows MT resistivity slices and the Phase 3 seismic browser together with public/context layers.

Boundary: This is a page/config verification slice, not a loader, data, computed-artifact, material, global render, or runtime-loading change. `VER-2026-05-15-003-utah-forge-mt-seismic-demo-page.md` and its screenshot/diagnostics remain `needs review`.

## Utah FORGE Demo Walkthrough V0

Observed: `projects/utah-forge/pages/30_demo_site_context.json` through `35_demo_provenance_review.json` now form a six-page demo walkthrough sequence for site context, MT acquisition, MT resistivity slices, Phase 3 seismic, MT + seismic integration, and provenance/review caveats.

Boundary: This is a bounded project page/overlay implementation only. It does not change loaders, data artifacts, prep scripts, global environment defaults, global render policy, runtime loading behavior, scalar ranges, color ramps, seismic products, MT products, or acceptance state. `VER-2026-05-15-004-utah-forge-demo-walkthrough-v0.md` remains `needs review`.

## Layer / Artifact Classification Pass Completed

Observed: `Layer-Artifact-Classification.md` now classifies current Utah FORGE, Case Study B / Shahbazi, and Woodjam layers plus selected artifact families. The classification records seismic as needed and underway, treats full-density/high-complexity products as potentially valuable, and keeps load/default/demo policy as human-review work.

## NOW / NEXT / PARK

These classifications are proposed only, not locked.

### NOW

Structural clarity steps that reduce risk without compromising rendering:

| Candidate | Proposed outcome |
| --- | --- |
| Data/status manifest refinement | Document artifact classes and status fields before changing runtime contracts. |
| Project-local data status README | Clarify source, processed, QA, full-density, demo-facing, future, and placeholder data per project. |
| Seismic status/provenance clarity | Reconcile old blocked docs with current human context that seismic is needed and underway. |
| Page/layer visibility clarity | Map environment defaults, page overrides, product visibility, opacity, and intended demo/page behavior. |
| Render-quality preservation checks | Define checks that protect beauty, scale, spatial relationship, cameras, richness, and provenance. |
| App architecture map only | Map ownership boundaries for runtime, loaders, SceneManager, editor, presenter, project modules. |
| Artifact metadata wrapper review | Review schema/template fields before creating project-local wrappers or teaching prep scripts to emit them. |

### NEXT

Small app/system changes that may help once structure is clear:

| Candidate | Boundary |
| --- | --- |
| Project-specific loader isolation | Move only after ownership and tests are clear; preserve rendering behavior. |
| Page/layer visibility cleanup | Make inheritance/overrides easier to inspect; do not change default visibility without review. |
| Presenter/editor boundary | Consider a lighter presenter route after page and demo goals are clearer. |
| Loader disposal/resource contract | Define and then implement minimal lifecycle fixes for heavy layers. |
| High-complexity load policy | Introduce intentional loading only after data classes and demo behavior are reviewed. |
| SceneManager responsibility map to slices | Plan before splitting; do not split broad rendering behavior blindly. |

### PARK

| Candidate | Reason parked |
| --- | --- |
| Broad refactors | Too risky before structural map and rendering-quality checks exist. |
| External control-plane app integration | Explicitly parked until structure is clarified. |
| Full automation | Could distract from client-quality rendering and current structure. |
| Project creation wizard | Useful later, not the immediate structural refinement. |
| Major export pipeline | Useful later, but not before current data/page/render structure is clarified. |
| Any change that could degrade demo visuals | Unsafe unless it preserves rendering guardrails and is explicitly reviewed. |

## First Implementation Candidates

Possible next prompts, not executed here:

1. Data/status manifest refinement.
2. Project-local data status README.
3. Page/layer visibility clarity.
4. Render-quality preservation checks.
5. Seismic status/provenance clarity.
6. App architecture map only.
7. Later minimal runtime changes.

## Human Review Questions

- Which Utah seismic docs should be superseded, preserved as historical, or rewritten as current status notes?
- What is the intended default demo behavior for Utah seismic, MT full-density, MT volume, slices, threshold surfaces, and public context?
- Which layers are client-facing high-fidelity, technical credibility, QA/validation, optional advanced, or too risky/unclear?
- What visual quality checks are mandatory before any bloat-reduction or performance work?
- Should high-complexity data load eagerly, on page demand, or through explicit advanced controls?
- Which project-specific behavior belongs in project modules versus generic runtime/editor modules?
- What is the minimum presenter/editor separation needed before the client demo path?
- What updated time-pressure/demo goals should override or prioritize this plan later?
- Which docs/dev-context proposals should be accepted, rejected, or kept as working notes?
