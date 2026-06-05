# Runtime Loading Policy

## Purpose

This is a docs-only design pass for future runtime loading policy. It does not change source code, prep scripts, project manifests, page JSON, visibility, rendering, generated artifacts, or computed-artifact pipelines.

Observed after Slice 1: `src/scene/layerLoaderRegistry.ts` now exists as a registry shell used internally by `src/scene/layerLoaders.ts`. This does not implement runtime lazy loading, load-policy behavior, lifecycle/disposal, visibility changes, project-module extraction, or page/schema changes.

Observed after Slice 1B: only placeholder/reference-stage handler definitions were extracted into project-module registration files. This still does not implement runtime lazy loading, load-policy behavior, lifecycle/disposal, default visibility changes, project config/page changes, or render/material changes.

## Render / computed-artifact quality prerequisite

Runtime loading policy must be reviewed against `docs/dev-context/Render-Quality-Checks.md` before implementation. A future loading change is not safe merely because it reduces allocation or startup work; it must preserve render quality, computed-artifact fidelity, seismic and MT co-rendering quality, high-fidelity optional paths, QA/validation access, and source/provenance clarity.

## Current observed behavior

DEC-094 adds the staff Page Archive contract. Current source splits editor page
loading from presenter navigation: editor state loads active `pageOrder` plus
staff `archivedPageOrder` pages, while presenter navigation, audience playback,
and built output remain `pageOrder` only.

| Area | Observed behavior | Evidence |
| --- | --- | --- |
| Project selection | The app starts on a landing/project chooser unless a `?project=` query param is present. Opening a project calls `loadProject(projectSlug)`. | `src/App.tsx` |
| Project metadata load | Current source: `loadProject` fetches `project.json` and `environment.json` with `cache: "no-store"`, then fetches each page named in `manifest.pageOrder` and `manifest.archivedPageOrder`. Archived pages load for editor authoring only and do not join presenter navigation. | `src/pages/loadPages.ts` |
| Page source of truth | Current source: `pageOrder` plus `archivedPageOrder` are the loaded editor page lists; the loader does not enumerate the folder. Active presentation order remains `pageOrder`. Missing pages warn and are skipped. | `src/pages/loadPages.ts` |
| Scene mount | After project metadata resolves, the app dynamically imports `./scene` and calls `mountScene(container, project.manifest.layers, overlays)`. | `src/App.tsx`, `src/scene.ts` |
| Layer registration | `mountScene` registers every manifest layer ID with `SceneManager`. | `src/scene.ts` |
| Layer loading | `mountScene` then calls `loadLayerInto(spec, manager)` for every manifest layer. `loadLayerInto` skips only disabled specs, then finds a matching loader and starts loading. | `src/scene.ts`, `src/scene/layerLoaders.ts` |
| Async layer completion | When a layer object resolves, it is added to the registered group and `manager.reapplyCurrentPageState()` is called. | `src/scene/layerLoaders.ts` |
| Visibility composition | Effective visibility starts from `environment.defaultVisibleLayers`, then applies page `visibilityOverrides`. | `src/pages/effective.ts` |
| Style composition | Effective style shallow-merges `environment.layerStyles[layerId]` with page `layerOverrides[layerId]`. | `src/pages/effective.ts` |
| Page application | `PageController` applies first-page visibility, styles, page scene, overlays, and camera. Page transitions fade layer visibility/style state rather than changing what has been allocated. | `src/pages/PageController.tsx` |
| Product-aware transitions | Page transitions must preserve product/object identity inside visible layers. MT scalar-volume source opacity, section ISO overlays, threshold boundaries, and seismic section/volume source opacity are render entities, not generic layer opacity. | `src/scene/SceneManager.ts`, `tests/utah-forge/mt-rendering.spec.ts` |
| Scene overlays | Scene overlays load eagerly from `environment.sceneOverlays`; per-page activation controls opacity/visibility. | `src/scene.ts`, `src/pages/effective.ts` |
| Project scale | Observed layer/page counts: Utah FORGE 22 layers / 99 active pages / 1 staff archived page, Case Study B 28 layers / 6 pages, Woodjam 21 layers / 4 pages, Base GUI 2 layers / 1 page. | Project manifests/environments |

Observed conclusion: current runtime behavior appears manifest-eager at scene mount. Visibility and page overrides control presentation state, but they do not appear to be a loading/allocation boundary.

## Project Load-Class Review Table

Observed: `docs/dev-context/Project-Load-Class-Table.md` now records a docs-only proposed load-class review for existing Utah FORGE, Case Study B / Shahbazi, and Woodjam layer IDs using current manifest, environment, and page evidence.

This table is review input only. It does not approve runtime lazy loading, manifest schema changes, page JSON changes, visibility changes, render-style changes, seismic changes, full-density changes, or computed-artifact changes.

## Artifact Metadata Wrapper Note

Observed: `docs/dev-context/Artifact-Metadata-Wrapper-Spec.md` and `docs/dev-context/schemas/artifact-metadata.schema.json` now define proposed artifact wrapper fields, including `loadClass`.

Before runtime loading changes, load-policy/load-class metadata should be reviewed with artifact identity, provenance, render role, limitations, and human acceptance status. The wrapper spec does not change the proposed runtime policy and does not approve lazy loading or disposal behavior.

Observed: the first Utah FORGE wrappers under `projects/utah-forge/artifact_metadata/` include `loadClass` values. These values are proposed review inputs only. Runtime loading must not change until wrappers, load classes, render-quality risks, computed-artifact risks, and human acceptance status are reviewed.

Observed: `projects/utah-forge/artifact_metadata/WRAPPER_COVERAGE.md` now identifies wrapper gaps and recommended second-batch priorities. Runtime loading implementation should wait until wrapper coverage and second-batch priorities are reviewed; coverage does not approve lazy loading, default visibility changes, or disposal behavior.

Observed: Utah FORGE batch 2A wrappers now add proposed `loadClass` values for MT full-density tiled data, MT scalar volume, and MT threshold surfaces. Those values are review inputs only and do not authorize runtime loading changes. Runtime loading must not change until batch 2A wrappers, load/default policy, visual receipt requirements, and acceptance status are reviewed.

Observed: Utah FORGE batch 2B wrappers now add proposed `loadClass` values for seismic navigation/provenance support, seismic recipes/presets, and MT top surface. All wrapper `loadClass` values are review inputs only and do not authorize runtime loading, lazy loading, default visibility, page, manifest, or disposal changes.

Observed: `tools/report-project-artifact-coverage.mjs` now provides ignored generated review reports under `test-results/project-artifact-coverage/` across Utah FORGE, Case Study B / Shahbazi, Woodjam, and Base GUI. Review a fresh report before any runtime loading implementation; generated coverage can expose unwrapped default-visible layers, wrappers without matching layer IDs, and project-specific layer risks, but it does not authorize runtime loading, visibility, page, manifest, render, material, scalar-range, or disposal changes.

Observed: `docs/dev-context/Runtime-Diagnostics.md` now documents a dev-only diagnostics hook exposed as `window.__GEOVOX_DIAGNOSTICS__` in Vite dev mode. Use diagnostics snapshots before implementing load-policy changes to see registered/loaded/visible layer state and approximate resource counts. Diagnostics are read-only evidence only; they do not authorize lazy loading, disposal, visibility, render, material, scalar, color-ramp, seismic, MT, page, or manifest changes.

Observed: `projects/utah-forge/pages/20_mt_seismic_integration_check.json` provides a page-level MT + seismic verification target. Capture fresh screenshot and diagnostics evidence before using it to guide load-policy implementation.

Observed: the Utah FORGE demo walkthrough v0 pages now provide page-level review targets for site context, MT acquisition, MT slices, Phase 3 seismic, MT + seismic integration, and provenance/review caveats. These pages and their screenshots/diagnostics are evidence for human review only. They do not authorize runtime loading, lazy loading, disposal, default visibility, page schema, manifest, material, scalar range, color ramp, seismic product, MT product, or global render changes.

## Problem

Structural/runtime bloat risk is not the presence of high-quality data. The risk is unclear ownership, load intent, and lifecycle:

- all manifest layers may load regardless of page/demo need
- visibility is not the same as loaded/allocated
- high-fidelity data should be intentional, not blindly loaded
- computed artifacts should be intentionally consumed, not orphaned or over-eagerly loaded
- render quality must be preserved
- QA/validation artifacts should remain available without being confused with client-facing default visuals
- future/placeholder layers should not consume runtime attention or imply acceptance
- seismic is needed and underway, but seismic product/default behavior still needs intentional page/load policy

## Non-goals

- no visual downgrade
- no seismic parking
- no full-density deletion
- no computed-artifact simplification
- no broad refactor
- no external control-plane implementation
- no manifest/page/schema change in this pass
- no SceneManager split in this pass
- no layerLoader refactor in this pass
- no editor/presenter split in this pass

## Layer/artifact load classes

These classes are proposed only and require human review before implementation.

| Load class | Meaning | Example candidates / notes |
| --- | --- | --- |
| startup critical | Needed immediately for app/project shell, first meaningful render, or safe scene setup. | Core terrain/context only if accepted as first-page context; not every default-visible layer automatically qualifies. |
| first-page required | Needed for the first visible page to render correctly. | Layers visible on page 1 after `defaultVisibleLayers` plus page overrides. |
| page-required | Needed to render an authored presentation state correctly. | Utah MT slices on slice pages, threshold surfaces on threshold pages, Shahbazi photo overlay on photo pages. |
| page-preload | Likely needed soon after current page; prefetch while preserving first-frame quality. | Next-page heavy layers after first-page render is stable. |
| toggle-on-demand | Not required by page story but useful through explicit controls. | Optional advanced volumes, QA previews, support layers. |
| high-fidelity client-facing | Rich/heavy data used for beauty, credibility, or client understanding. | Utah MT full-density, scalar volumes, seismic raymarch-capable products, Shahbazi TLS/photo/surface products. |
| technical credibility / QA | Source-validation or review layer; may be shown intentionally but should not be accidental default. | MT stations, station response QC, object-point QA, camera/frustum QA, source inventories. |
| computed-artifact support | Manifests, stats, legends, masks, provenance, slices/threshold support products needed by render artifacts or review. | Do not orphan or delete just because they are not directly visible. |
| future/placeholder | Declared future target, scaffold, or procedural placeholder. | Base GUI reference, Utah reference stage, planned wells/faults/future Shahbazi outputs. |
| generated junk/dev output | Candidate temporary/dev-only output. | Must be proven junk by human review before deletion; do not assume numerous generated artifacts are junk. |
| blocked/unknown | Status contradictory, unsupported, or unclear. | Requires review, not automatic rollback. |

## Proposed page/layer contract

Do not implement this contract yet. It is a design target for review.

| Proposed field | Purpose | Notes |
| --- | --- | --- |
| `requiredLayers` | Layers that must be loaded for a page to be correct. | Could be derived initially from effective visibility instead of adding schema fields. |
| `preloadLayers` | Layers likely needed soon after a page transition. | Useful for heavy next-page artifacts after first render. |
| `optionalLayers` | Layers available through user toggles or advanced controls. | Should not block first-page render. |
| `qaLayers` | Review/provenance/validation layers. | Available for credibility and verification, not accidental visual clutter. |
| `computedArtifactLayers` | Render-ready outputs derived from source data. | Preserve inputs/scripts/provenance and load intentionally. |
| `futureLayers` | Placeholder/planned layers. | Keep clearly out of runtime hot path unless explicitly selected. |

Recommended safer starting point: reuse existing `environment.defaultVisibleLayers`, page `visibilityOverrides`, and page `layerOverrides` as the first policy input, plus docs/dev-context classifications. Add schema fields only after human review confirms the field names, semantics, and migration path.

## Migration approach

| Stage | Proposed action | Boundary |
| --- | --- | --- |
| Stage 1: classify only | Use `Layer-Artifact-Classification.md`, `DATA_LAYER_STATUS.md`, and this policy to assign proposed load classes. | Docs/status only; no runtime or manifest changes. |
| Stage 2: use existing visibility/page overrides better | Review current defaults/pages and decide which layers are first-page/page-required/toggle/QA/future. | No automatic visibility changes; human review required. |
| Stage 3: add metadata/load policy fields if schema supports | Add reviewed metadata such as load class, artifact role, QA role, and provenance pointer. | Only after schema and backward compatibility review. |
| Stage 4: minimal runtime lazy/on-demand loading | Defer non-required heavy layers while preserving first-page/page-required visual quality. | Must pass render-quality checks and not degrade seismic/full-density/computed artifacts. |
| Stage 5: disposal/memory contract | Define when hidden/on-demand layers are retained, unloaded, or disposed. | Must preserve page transitions, toggles, and QA review path. |
| Stage 6: project-specific loader/module isolation | Move project-specific loading behavior into owned modules. | Only after load policy and tests/receipts are clear. |
| Stage 7: broader SceneManager/editor separation later | Split broader responsibilities after policy and verification stabilize. | Parked; do not couple to first loading cleanup. |

## Render-quality guardrails

Any loading change must preserve:

- material/depth/render policy
- color ramps
- camera/page composition
- spatial scale
- provenance/legend/status
- seismic/MT co-rendering quality
- computed artifact fidelity
- opacity and visibility transitions
- product-owned opacity during transitions; layer fades must not reveal hidden
  scalar-volume, seismic, or section-source products
- scalar/raymarch transfer behavior
- point size and high-density readability

Use `Render-Quality-Checks.md` before changing loading behavior.

## Computed-artifact guardrails

Any loading change must preserve:

- raw -> computed -> render-ready trace
- artifact inputs/scripts/provenance
- contour/heat/slice/threshold/scalar/seismic product fidelity
- QA/validation path
- high-fidelity optional path
- manifests, legends, masks, stats, bounds, and units
- source/client/public data references

Loading policy must not orphan generated outputs, break support files, or make computed artifacts look disposable because they are numerous or heavy.

## Seismic policy

Seismic is needed and underway.

- Classify seismic products intentionally.
- Do not auto-hide or park seismic.
- Avoid loading all seismic products blindly if they are not needed on a page.
- Do not degrade available seismic quality.
- Preserve source inventory, navigation, manifest, products, recipes, loader support, controls, provenance, and visual quality.
- Human review is required for default demo product, raymarch versus section behavior, colormap, amplitude window, opacity, navigation visibility, and disclosure language.

## Full-density/high-complexity policy

- Keep high-complexity artifacts.
- Load intentionally.
- Use as client-facing, technical credibility, QA, or optional advanced depending on human decision.
- Do not delete, downsample, hide, or simplify high-fidelity data as a proxy for bloat reduction.
- Full-density and high-complexity products should have explicit load/presentation roles before performance cleanup.

## First safe implementation candidate

Proposed first candidate, not implemented: a docs/config-neutral load-class review table for each current project using existing manifest layer IDs and current page/default visibility evidence.

Smallest later code/config candidate, only after human review: add optional, non-breaking load-policy metadata to layer/page records or a project-local status wrapper, then teach runtime to delay only layers that are explicitly classified as non-required and visually safe to defer. The first runtime change should not alter default visibility, render styles, computed artifacts, or seismic/full-density quality.

## Human review questions

- Which load classes should be mandatory for Utah FORGE, Shahbazi, Woodjam, and Base GUI?
- Should first implementation reuse effective visibility only, or add explicit page fields such as `requiredLayers` and `preloadLayers`?
- Which layers are safe to defer without changing perceived demo quality?
- Which layers must remain loaded for transitions, camera/page flow, and co-rendering?
- Which QA layers should be toggle-on-demand versus page-required technical credibility?
- How should seismic products be classified by page need, default demo behavior, and advanced mode?
- How should full-density MT, scalar volumes, threshold surfaces, slices, and top surface be classified?
- What disposal/memory behavior is acceptable for hidden heavy layers?
