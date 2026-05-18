# Open Loops

Last populated: 2026-05-15

## Scope Refinement Unresolveds

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-SCOPE-001 | Confirm proposed NOW/NEXT/PARK/REJECT classifications before any implementation. | Unverified / needs human review | `docs/dev-context/Scope-Refinement.md` |
| OL-SCOPE-002 | Decide whether manifest/runtime contract work is documentation/audit only or a later code task. | Unverified / needs human review | `project.json`, `environment.json`, `src/pages/types.ts` |
| OL-SCOPE-003 | Decide whether bundle inspection is enough for current demo stability before deeper code splitting. | Unverified / needs human review | `vite.config.ts`, large TS/TSX modules |
| OL-SCOPE-004 | Keep "control-plane rails around the app" separate from "control-plane features inside the app." | Observed | `docs/dev-context/HOME.md`, user instruction |
| OL-SCOPE-005 | Review `Data-System-App-Refinement-Plan.md` before any implementation. | Unverified / needs human review | Plan is proposed only; updated time-pressure/demo goals are pending. |

## Documentation Contradictions

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-DOC-001 | Reconcile Woodjam-only alpha framing with current multi-project app framing. | Observed contradiction | `README.md`, `CLAUDE.md`, `docs/START-HERE.md` |
| OL-DOC-002 | Reconcile Utah FORGE "foundation/no real data" docs with active Phase 3 MT and seismic records. | Observed contradiction | `docs/00-purpose.md`, `docs/01-scope.md`, `docs/04-build-sequence.md`, `projects/utah-forge/project.json` |
| OL-DOC-003 | Reconcile Utah project-local "seismic not active" docs with active/default-visible seismic browser state. | Observed contradiction | Utah data READMEs vs `project.json`, `environment.json`, `CHANGELOG.md`, smoke test |
| OL-DOC-004 | Decide how `CHANGELOG.md`, `docs/START-HERE.md`, project-local handoffs, and `docs/dev-context` should relate. | Unverified / needs human review | Existing docs tree |
| OL-DOC-005 | Classify old handoff/session docs as active, historical, stale, or proposal. | Unverified / needs human review | `docs/handover-for-claude.md`, `docs/SESSION-CHANGES-2026-05-01.md` |

## Docs Needing Human Classification

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-DOC-006 | Classify root router docs as active, candidate stale, or historical. | Unverified / needs human review | `README.md`, `CLAUDE.md` |
| OL-DOC-007 | Classify canonical docs after Utah current-state reconciliation. | Unverified / needs human review | `docs/00-purpose.md`, `docs/01-scope.md`, `docs/02-architecture.md`, `docs/04-build-sequence.md` |
| OL-DOC-008 | Decide whether `docs/START-HERE.md` is the primary current orientation doc. | Unverified / needs human review | More current than older docs on Utah MT, but not fully reconciled. |
| OL-DOC-009 | Review project-local Utah docs for active vs candidate-stale claims. | Unverified / needs human review | `projects/utah-forge/AI_*`, `Utah_Forge_*`, Stage 2, data READMEs |
| OL-DOC-010 | Review Shahbazi data-reference docs for active intake guidance vs historical todo. | Unverified / needs human review | `projects/case-study-b/data_refs/shahbazi_gravel_pit/` |
| OL-DOC-011 | Review Woodjam content/data docs for current reference-project obligations. | Unverified / needs human review | `docs/woodjam/content-brief.md`, `docs/woodjam/data-manifest.md` |
| OL-DOC-012 | Review schema docs against current TypeScript/project manifests. | Unverified / needs human review | `docs/schemas/*.md`, `src/pages/types.ts`, `projects/*/project.json` |
| OL-DOC-013 | Classify Utah FORGE seismic docs as active instruction, superseded planning note, current status note, or historical note. | Observed contradiction / needs human review | See `Verification-Receipts/VER-2026-05-15-002-utah-forge-seismic-contradiction.md`; latest human context says seismic is needed and underway. |

## Candidate Docs To Move Later

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-MOVE-001 | Consider moving old handoff/session notes into a historical/archive area later. | Proposed only | `docs/handover-for-claude.md`, `docs/SESSION-CHANGES-2026-05-01.md` |
| OL-MOVE-002 | Consider archiving Utah planning chunk notes after reconciliation. | Proposed only | `projects/utah-forge/Gated Chunks.txt`, `projects/utah-forge/Rendering issues.txt` |
| OL-MOVE-003 | Consider a project-local handoff/archive convention for imported handoff docs. | Proposed only | `projects/utah-forge/data/Geovox_James_Handoff (1).md` |
| OL-MOVE-004 | Consider promoting reusable Shahbazi/Utah data-intake patterns into a shared docs guide later. | Proposed only | Shahbazi `INGEST_PIPELINE_BRIEF.md`, Utah `AI_FUTURE_DATA_INPUT_PLAYBOOK.md` |

## Docs Requiring Careful Preservation

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-PRESERVE-001 | Preserve decision logs and changelog before any doc moves. | Observed preservation need | `docs/03-decisions.md`, `CHANGELOG.md`, `projects/utah-forge/Utah_Forge_Decisions.md` |
| OL-PRESERVE-002 | Preserve source/data READMEs and metadata beside source data unless a migration plan exists. | Observed preservation need | Woodjam ARIS notes, Shahbazi raw/processed READMEs, Utah client_preprocessed READMEs |
| OL-PRESERVE-003 | Preserve verification receipts because git history is unavailable. | Observed preservation need | `docs/dev-context/Verification-Receipts/VER-2026-05-15-001-no-git-diff-available.md` |
| OL-PRESERVE-004 | Preserve schema docs until schema-vs-code review is complete. | Observed preservation need | `docs/schemas/*.md` |
| OL-PRESERVE-005 | Preserve dev-context registers/templates as control-plane records. | Observed preservation need | `docs/dev-context/` |

## Project / Data Status Unknowns

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-DATA-001 | Confirm intended current Utah FORGE default-visible layer set. | Unverified / needs human review | Current `environment.json` disagrees with multiple prose docs |
| OL-DATA-002 | Confirm whether active Utah seismic browser state is accepted current demo state. | Unverified / needs human review | Active manifest/environment/test evidence contradicts project-local blocked notes |
| OL-DATA-003 | Confirm whether public terrain/roads/hydrography are accepted Utah demo context or transient working state. | Unverified / needs human review | `public_context/manifest.json`, `environment.json` |
| OL-DATA-004 | Confirm Shahbazi production path for orthomosaic, textured mesh/GLB, and full point-cloud stream. | Observed unresolved | `projects/case-study-b/project.json`, Shahbazi data refs |
| OL-DATA-005 | Confirm Woodjam current demo obligations after Utah/Shahbazi growth. | Unverified / needs human review | Woodjam remains reference, but README/CLAUDE emphasize it as primary deliverable |
| OL-DATA-006 | Decide Utah FORGE seismic browser status, default demo behavior, provenance/status language, and visual-quality bar. | Unverified / needs human review | Evidence exists on both sides: older blocked docs vs project config/environment/pages/source/tests; latest human context says seismic is needed and underway. |
| OL-DATA-008 | Define project-local data status README pattern without moving data or changing manifests. | Proposed only | Should clarify source/client/public data, processed artifacts, provenance/status, QA, full-density, demo-facing, and future/placeholder artifacts. |
| OL-DATA-009 | Define high-complexity load/presentation policy without deleting or downgrading data. | Proposed only | Utah MT full-density/volume/threshold/slices and seismic products need intentional presentation, not blind simplification. |
| OL-DATA-010 | Review `Layer-Artifact-Classification.md` layer roles and artifact-family classifications. | Unverified / needs human review | Classification is proposed only and did not change manifests, pages, visibility, prep, data, or source. |
| OL-DATA-011 | Decide load policy for layers marked `unclear / human review`. | Unverified / needs human review | Includes seismic, Utah full-density/default-load behavior, Utah scalar volume/slices/threshold surfaces, Shahbazi high-density preview, and Woodjam top-level data references. |
| OL-DATA-012 | Review the new Utah FORGE project-local data/layer status guide. | Unverified / needs human review | `projects/utah-forge/DATA_LAYER_STATUS.md` now exists as docs/status guidance only; it does not accept defaults or change runtime behavior. |
| OL-DATA-013 | Decide whether Utah `DATA_LAYER_STATUS.md` supersedes older Utah handoff/status docs for future AI starts. | Proposed only / needs human review | Older docs still contain seismic-blocked and default-visibility statements that contradict current manifests and latest human context. |
| OL-DATA-014 | Confirm whether the corrected `DATA_LAYER_STATUS.md` section split is the desired project-local status pattern. | Proposed only / needs human review | The file now separates source/client/public, processed/browser-ready, render-ready, QA/validation, provenance/status wrappers, MT, seismic, demo candidates, and unclear/future artifacts. |
| OL-DATA-015 | Review proposed runtime load classes for each project layer/artifact. | Proposed only / needs human review | `Project-Load-Class-Table.md` now maps Utah FORGE, Case Study B / Shahbazi, and Woodjam manifest layer IDs to proposed load classes using current default/page evidence. No runtime behavior is approved. |

## Computed Artifact Pipeline Open Loops

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-COMP-001 | Review computed artifacts for complete provenance/status evidence before calling them technically accurate. | Unverified / needs human review | `Computed-Artifact-Pipeline.md` requires source, script/tool, CRS/transform, units, parameters, stats/counts, provenance/status, limitations, and review requirement. |
| OL-COMP-002 | Identify artifacts with unclear computation parameters. | Unverified / needs human review | Utah threshold surfaces, MT slices, seismic products, Shahbazi tie-point isolines/isobands, contours, and photo overlays have varying evidence depth. |
| OL-COMP-003 | Clarify render/load role for computed artifacts. | Unverified / needs human review | Some artifacts are default visuals, some are page-level, QA-only, optional advanced, or future placeholders. |
| OL-COMP-004 | Preserve raw-to-computed pipelines during cleanup. | Observed human boundary | Do not damage prep scripts or artifact families for isolines, isobands, contours, heat maps, slices, volumes, threshold surfaces, seismic products, meshes, point-cloud tiles, legends, and provenance wrappers. |
| OL-COMP-005 | Reconcile artifact complexity with performance/load concerns without reducing fidelity. | Proposed only | Complexity is not bloat; unmanaged ownership/eager loading/unclear provenance are the bloat risks. |
| OL-COMP-006 | Add metadata wrappers for pipelines that do not yet have complete source/script/parameter/output/status linkage. | Proposed only / needs human review | `Computed-Artifact-Pipeline.md` maps wrappers needed across Woodjam top-level data, selected Utah public context/default policies, Shahbazi future targets, and placeholder interpretation layers. |
| OL-COMP-007 | Classify scripts whose output roles are unclear or mixed between QA, presentation, and runtime manifests. | Unverified / needs human review | Seismic recipe generation can update manifest/project metadata when run; Woodjam fetch scripts and placeholder interpretation layers need role clarity. |
| OL-COMP-008 | Identify computed artifacts with missing parameters or incomplete provenance before technical-accuracy claims. | Unverified / needs human review | Priority examples: Woodjam top-level data families, Utah seismic default/preset acceptance, Shahbazi production targets, and any manifest-only placeholder layer. |
| OL-COMP-009 | Define high-risk cleanup areas before touching data or prep scripts. | Observed risk / needs human review | High-risk areas include Utah MT intake/full-density/volume/slices/seismic, Shahbazi TLS/surface/photo/tie-point chains, and Woodjam top-level data ownership. |
| OL-COMP-010 | Decide whether a unified processing manifest or per-artifact metadata wrapper should be the first implementation follow-up. | Proposed only | Candidate improvements are listed in `Computed-Artifact-Pipeline.md`; no implementation approved here. |
| OL-COMP-011 | Define Utah computed artifact acceptance/verification criteria. | Unverified / needs human review | MT full-density, scalar volumes, threshold surfaces, top surface, slices, station response QC, and seismic products remain unaccepted until review criteria are set. |
| OL-COMP-012 | Define render-quality verification requirements for Utah high-fidelity artifacts. | Proposed only / needs human review | Protect color ramps, scalar ranges, legends, opacity/material/depth behavior, camera/page polish, and provenance/status clarity. |
| OL-COMP-013 | Define per-artifact metadata wrapper expectations for Utah FORGE. | Proposed only / needs human review | Each artifact family may need explicit source, script/tool, CRS/transform, units, parameters, stats/counts, provenance/status, limitations, render/load role, and review requirement before acceptance. |
| OL-COMP-014 | Review the mandatory computed-artifact verification checklist before runtime or data cleanup. | Proposed only / needs human review | `Render-Quality-Checks.md` requires source inputs, script/tool, CRS/transform, units, scalar transform, parameters, stats/counts, bounds, provenance/status, render-ready path, visual rendering, and limitations. |
| OL-COMP-015 | Define computed-artifact load policy without orphaning support files. | Proposed only / needs human review | `Runtime-Loading-Policy.md` requires preserving raw -> computed -> render-ready trace, support manifests, legends, masks, stats, bounds, units, QA path, and high-fidelity optional path. |
| OL-COMP-016 | Human review of artifact metadata wrapper schema fields. | Proposed only / needs human review | `Artifact-Metadata-Wrapper-Spec.md` and `schemas/artifact-metadata.schema.json` define the first schema/template draft; field names, enums, and required status need review before project-local wrapper adoption. |
| OL-COMP-017 | Human review of project-local artifact wrapper placement. | Proposed only / needs human review | First Utah FORGE wrappers now live under `projects/utah-forge/artifact_metadata/`; confirm whether this is the desired long-term placement or whether generated-output-adjacent wrappers should also exist later. |
| OL-COMP-018 | Decide which additional Utah FORGE artifacts get wrappers next. | Proposed only / needs human review | Wrappers now cover MT stations, MT slices, seismic browser, MT full-density tiles, MT scalar volume, MT threshold surfaces, seismic navigation/provenance, seismic recipes/presets, and MT top surface. Candidate next wrappers include legends, station response QC, public context, and additional provenance/status wrappers. |
| OL-COMP-019 | Decide whether prep scripts should emit wrappers later. | Proposed only / needs human review | Future prep-script wrapper emission could improve traceability, but no prep scripts were changed or run in this pass. |
| OL-COMP-020 | Human review of the first three Utah FORGE artifact wrappers. | Proposed only / needs human review | Review `utah-forge-mt-stations.metadata.json`, `utah-forge-mt-resistivity-slices.metadata.json`, and `utah-forge-phase3-seismic-browser.metadata.json` before any acceptance or runtime use. |
| OL-COMP-021 | Human review of MT full-density wrapper and load role. | Proposed only / needs human review | `utah-forge-mt-full-density.metadata.json` now exists, but high-fidelity/default-load behavior, scalar/color/point-size receipt, and client-facing role remain unaccepted. |
| OL-COMP-022 | Human review of Utah FORGE wrapper coverage table. | Proposed only / needs human review | `projects/utah-forge/artifact_metadata/WRAPPER_COVERAGE.md` maps wrapped, unwrapped, next-batch, later, and human-review artifact families. |
| OL-COMP-023 | Human review of wrapper batches 2A and 2B. | Proposed only / needs human review | Batch 2A and 2B wrappers exist, but all remain `needs_review`, `reviewRequired=true`, and `accepted=false`. |
| OL-COMP-024 | Human review of client-demo relevance per artifact. | Proposed only / needs human review | Coverage assigns high/medium/low/QA/unclear relevance as planning input only; do not treat as demo scope lock. |
| OL-COMP-025 | Human review of visual receipt requirements per high-priority artifact. | Proposed only / needs human review | High-priority artifacts need visual/render receipts before client-facing acceptance, especially full-density MT, scalar volume, thresholds, seismic products, and recipes. |
| OL-COMP-026 | Human review of Utah FORGE wrapper batch 2A. | Proposed only / needs human review | Review `utah-forge-mt-full-density.metadata.json`, `utah-forge-mt-scalar-volume.metadata.json`, and `utah-forge-mt-threshold-surfaces.metadata.json`; all remain `needs_review` and `accepted=false`. |
| OL-COMP-027 | Define visual receipt requirements for MT full-density, scalar volume, and threshold surfaces. | Proposed only / needs human review | Required before client-facing acceptance because point density, raymarch sampling, transfer functions, masks, thresholds, colors, opacity/material/depth behavior, and camera/page framing can change meaning and beauty. |
| OL-COMP-028 | Decide load/default policy for MT full-density, scalar volume, and threshold surfaces. | Proposed only / needs human review | Wrappers record proposed load classes only; they do not authorize runtime loading, lazy loading, default visibility, page, or manifest changes. |
| OL-COMP-029 | Decide whether threshold surfaces are client-facing, technical-credibility only, optional advanced, or mixed. | Proposed only / needs human review | Threshold values and caveats can imply false precision or interpretation if not reviewed. |
| OL-COMP-030 | Decide whether MT scalar volume is optional advanced, high-fidelity client-facing, QA/technical, or mixed. | Proposed only / needs human review | Volume transfer, mask behavior, opacity, sampling, and product choice remain review items. |
| OL-COMP-031 | Human review of Utah FORGE wrapper batch 2B. | Proposed only / needs human review | Review `utah-forge-seismic-navigation-provenance.metadata.json`, `utah-forge-seismic-recipes-presets.metadata.json`, and `utah-forge-mt-top-surface.metadata.json`; all remain `needs_review` and `accepted=false`. |
| OL-COMP-032 | Human review of seismic navigation/provenance wrapper. | Proposed only / needs human review | Navigation/source/provenance support protects seismic placement and disclosure but does not accept interpretation or demo behavior. |
| OL-COMP-033 | Human review of seismic recipe/preset wrapper. | Proposed only / needs human review | Recipes/presets can change product choice, amplitude window, colormap, opacity, camera/page behavior, and MT co-render style. |
| OL-COMP-034 | Human review of MT top surface role and caveats. | Proposed only / needs human review | Top surface is preview-derived and approximate; it must not be treated as measured terrain, geology, wells, faults, seismic, or accepted interpretation. |
| OL-COMP-035 | Human review of the first screenshot-backed render/computed-artifact verification receipt. | Proposed only / needs human review | `VER-2026-05-15-003-utah-forge-mt-seismic-demo-page.md` now has screenshot and diagnostics evidence; result remains `needs review`. |
| OL-COMP-036 | Keep runtime loading changes blocked pending wrapper and verification review. | Proposed only / needs human review | Wrapper `loadClass` values are review inputs only; they do not authorize runtime loading, lazy loading, default visibility, page, manifest, or disposal changes. |
| OL-COMP-037 | Human review of first Utah FORGE MT/seismic verification receipt. | Proposed only / needs human review | `VER-2026-05-15-001-utah-forge-mt-slices-seismic-browser.md` exists, but result remains `needs review`; no artifact or visual state is accepted. |
| OL-COMP-038 | Review focused screenshot/render evidence for MT slices and seismic browser. | Proposed only / needs human review | Screenshot captured at `Verification-Receipts/screenshots/utah-forge-mt-seismic-integration-page-2026-05-15.png`; visual quality and co-render suitability remain human-review work. |
| OL-COMP-039 | Decide whether Page 05 seismic opacity of `0` is intentional for the demo path. | Proposed only / needs human review | Page 05 makes the seismic browser visible but overrides opacity to `0`; this does not prove client-facing seismic visual readiness. |
| OL-COMP-040 | Human review of generated project-artifact coverage report. | Proposed only / needs human review | `docs/dev-context/Generated-Reports/project-artifact-coverage.md` and `.json` now report project layer/wrapper/default/page evidence; the report is review input only. |
| OL-COMP-041 | Decide priority wrappers for layers without wrappers. | Proposed only / needs human review | Generated coverage reports Utah FORGE context/preview/working-area/reference layers, all Case Study B layers, all Woodjam layers, and Base GUI reference layer as unwrapped. |
| OL-COMP-042 | Review wrappers without matching observed layer IDs whenever coverage reports them. | Proposed only / needs human review | Current generated report shows none, but the check now exists and should remain part of wrapper hygiene. |
| OL-COMP-043 | Confirm the first actual runtime implementation candidate after coverage review. | Proposed only / needs human review | Project-wide reporting accelerates review, but it does not authorize lazy loading, disposal, visibility, page, material, scalar range, seismic product, or render changes. |
| OL-COMP-044 | Keep visual screenshot/render capture on the critical path before runtime cleanup. | Proposed only / needs human review | Coverage reporting does not replace the Utah FORGE MT/seismic visual receipt gap or future Shahbazi/Woodjam render checks. |
| OL-COMP-045 | Human review of first Utah FORGE runtime diagnostics/open receipt. | Proposed only / needs human review | `VER-2026-05-15-002-utah-forge-runtime-open-diagnostics.md` includes screenshot and runtime snapshot evidence, but result remains `needs review` and does not accept seismic/MT/demo readiness. |
| OL-COMP-046 | Human review of the dedicated Utah FORGE MT + seismic demo page. | Proposed only / needs human review | `projects/utah-forge/pages/20_mt_seismic_integration_check.json` is page/config verification work only; decide whether it becomes part of the client demo path. |
| OL-COMP-047 | Review MT/seismic co-render quality from the new page. | Proposed only / needs human review | Diagnostics show MT slices and seismic visible together, but visual balance, camera polish, opacity, legends, and disclosure require human review. |
| OL-COMP-048 | Human review of Utah FORGE demo walkthrough v0. | Proposed only / needs human review | Pages `30_demo_site_context` through `35_demo_provenance_review` now exist with screenshots for MT slices, seismic, and MT + seismic integration; decide whether this sequence becomes the client-demo path. |
| OL-COMP-049 | Review MT full-density support on the demo MT slices and integration pages. | Proposed only / needs human review | Demo pages use full-density as subdued support on the MT slices page and visible support on the integration page; decide whether this improves credibility without visual clutter. |

## App / System Structure Open Loops

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-SYS-001 | Map core runtime, project modules, loader ownership, scene orchestration, editor, presenter, and page system boundaries. | Proposed only | Based on read-only audit and `Data-System-App-Refinement-Plan.md`; no code changes approved. |
| OL-SYS-002 | Clarify page/layer visibility inheritance across environment defaults, page overrides, product visibility, opacity, and scene overlays. | Unverified / needs human review | `environment.json`, page JSON, and `src/pages/effective.ts` show inheritance/delta model; Utah seismic visibility remains nuanced. |
| OL-SYS-004 | Decide whether project-specific logic should be isolated into project modules after structure is mapped. | Proposed only | `layerLoaders.ts`, `SceneManager.ts`, and editor modules include Utah/Shahbazi-specific behavior. |
| OL-SYS-005 | Decide later whether presenter/editor boundary needs a lightweight presenter route. | Proposed only | Do not implement until page/demo goals and render guardrails are clearer. |
| OL-SYS-006 | Review the proposed page/layer loading contract before schema or runtime changes. | Proposed only / needs human review | `Runtime-Loading-Policy.md` proposes possible fields such as `requiredLayers`, `preloadLayers`, `optionalLayers`, `qaLayers`, `computedArtifactLayers`, and `futureLayers`, but recommends reusing existing visibility/page overrides first if safer. |
| OL-SYS-007 | Decide what visibility means versus loaded/allocated lifecycle. | Proposed only / needs human review | Current observed behavior applies visibility after manifest layers begin loading; future policy needs a reviewed loading/allocation boundary. |
| OL-SYS-008 | Review `Project-Load-Class-Table.md` before any runtime loading, lazy loading, page, manifest, or visibility change. | Proposed only / needs human review | The table is review input only. It intentionally preserves seismic, high-fidelity data, computed artifacts, and rendering quality while identifying structural load-policy questions. |
| OL-SYS-009 | Review dev-only runtime diagnostics output before load-policy implementation. | Proposed only / needs human review | `docs/dev-context/Generated-Reports/runtime-diagnostics-utah-forge.json` captured registered/loaded/visible layer state and resource counts for a first Utah open; diagnostics do not authorize behavior changes. |
| OL-SYS-010 | Human review of loader/project-module boundary audit. | Proposed only / needs human review | `Loader-Project-Module-Audit.md` maps current project loading, layer dispatch, generic loader candidates, project-specific cases, risks, and future touch map without implementing a refactor. |
| OL-SYS-011 | Human review of Loader Registry Slice 1 shell. | Observed implemented / needs human review | `src/scene/layerLoaderRegistry.ts` exists and `src/scene/layerLoaders.ts` uses it internally, but this should be reviewed as a behavior-preserving shell before any handler extraction. |
| OL-SYS-012 | Verify generic versus project-specific loader cases. | Proposed only / needs human review | Public context layers, seismic browser, scalar volume, point-cloud tiles, photo overlays, reference stages, and no-op editor layers include ambiguous ownership. |
| OL-SYS-013 | Define future visual regression checks for loader boundary refactor. | Proposed only / needs human review | A future implementation should compare Utah FORGE MT/seismic, Shahbazi surface/photo/contours, Woodjam reference layers, and Base GUI behavior before and after refactor. |
| OL-SYS-014 | Human review of Loader Registry Slice 1B reference-stage extraction. | Observed implemented / needs human review | Slice 1B moved only `base-gui-reference-stage` and `utah-forge-reference-stage` handler definitions into project-module registration files; review before heavier extraction. |
| OL-SYS-015 | Future Utah/Shahbazi/Woodjam project-module extraction remains open. | Proposed only / needs human review | No Utah FORGE, Shahbazi, Woodjam, public-context, seismic, MT, scalar, volume, terrain, or reference-stage handlers were moved in Slice 1. |
| OL-SYS-016 | Future lifecycle/disposal contract remains open. | Proposed only / needs human review | Loader registry shell does not implement lazy loading, lifecycle, allocation boundaries, or disposal behavior. |
| OL-SYS-017 | Review Slice 1B visual/runtime regression receipt. | Observed receipt created / needs human review | `VER-2026-05-16-004-loader-registry-slice-1b-visual-regression.md` records Base GUI and Utah FORGE open checks, screenshots, diagnostics, wrapper validation, coverage, and build result. Human review is still required; build success alone does not prove render equivalence. |
| OL-SYS-018 | Future Utah FORGE heavy handler extraction remains open. | Proposed only / needs human review | Utah FORGE seismic, MT, scalar volume, full-density, threshold, top-surface, and public/context handlers remain in `layerLoaders.ts`. |
| OL-SYS-019 | Future Shahbazi handler extraction remains open. | Proposed only / needs human review | Shahbazi surface/photo/contour/point/camera handlers remain in `layerLoaders.ts` and require visual regression checks before extraction. |
| OL-SYS-020 | Future Woodjam handler extraction remains open. | Proposed only / needs human review | Woodjam drillhole/assay/technical/context handlers remain in `layerLoaders.ts` and require regression checks before extraction. |
| OL-SYS-021 | Decide whether future loader-registry verification needs automated screenshot comparison. | Proposed only / needs human review | Slice 1B captured screenshots and diagnostics but did not perform automated before/after image comparison. |
| OL-SYS-022 | Human review of Intake Test 1 audit. | Proposed only / needs human review | `docs/dev-context/Intake-Test-1-Audit.md` recommends a Utah FORGE-only dev intake test that stages small dropped files under `projects/utah-forge/intake_staging/drops/<dropId>/` without processing, wiring, or acceptance. |
| OL-SYS-023 | Decide whether existing `/api/write-batch` base64 transport is acceptable for small intake-test files. | Proposed only / needs human review | Existing `authorWritePlugin` can write UTF-8 and base64 files under `projects/`, but large client/geophysical files may need streaming/multipart and explicit size limits. |
| OL-SYS-024 | Define intake test file limits and allowlist. | Proposed only / needs human review | Need max file size, max total drop size, max file count, allowed/blocked extensions, filename sanitization, and partial-failure behavior before implementation. |
| OL-SYS-025 | Decide final Add to Project UI location. | Proposed only / needs human review | Audit recommends the loaded editor project shell/header in `src/editor/EditorRoot.tsx`, Utah FORGE-only for Test 1, instead of the global project landing card. |
| OL-SYS-026 | Human review of Utah FORGE Add to Project intake UI. | Observed implemented / needs human review | Test 1 adds dev-only Utah FORGE editor-header and home-row access to the staging modal; it stages files only and does not process, accept, or update project config. |
| OL-SYS-027 | Review Test 1 file-size/count limits. | Proposed only / needs human review | Current client-side limits are 10 files, 25 MB per file, and 75 MB total. These are intentionally small and may need revision. |
| OL-SYS-028 | Review binary/base64 upload limits. | Proposed only / needs human review | The existing `/api/write-batch` endpoint supports base64 writes, but large archives/geophysical files likely need a future streaming or multipart endpoint. |
| OL-SYS-029 | Review first directive-driven source inventory pass. | Observed implemented for smoke-test drop / needs human review | Latest staged test drop `2026-05-16_01-32-03_1r8mdw` now has `source_inventory.json`, `source_inventory.md`, and `proposed_next_steps.md`; this is proposed-only inventory, not processing, project wiring, or acceptance. |
| OL-SYS-030 | Future AI librarian/switchboard intake design remains pending updated directives. | Proposed only / needs human review | Test 1 is a bounded Utah FORGE staging UI, not Processware, SRI, generalized New Project intake, or an agent workflow. |
| OL-SYS-031 | Future New Project generalization remains parked. | Conceptual only / not active scope | Utah FORGE Test 1 does not create a reusable project wizard, drop-file intake framework, breadcrumb system, or accepted product scope. |
| OL-SYS-032 | Human review of Utah FORGE build-directive rail. | Observed implemented / needs human review | `projects/utah-forge/BUILD_DIRECTIVE.md` and drop-local directives route Codex toward source inventory only; review wording and boundaries before relying on it for real source drops. |
| OL-SYS-033 | Future generalized build directive for other projects remains open. | Proposed only / needs human review | Current directive rail is Utah FORGE-only and should not be generalized to Woodjam, Shahbazi, or Base GUI without a separate reviewed prompt. |
| OL-SYS-034 | Future automation/API call from a Done button remains parked. | Proposed only / needs human review | The build-directive rail is file-based and manual; it does not trigger autonomous agents, API calls, processing, or acceptance. |
| OL-SYS-035 | Decide policy for future staged-drop inventories. | Proposed only / needs human review | The first smoke-test inventory pass proves the file-rail handoff; future real drops still need review rules for content inspection, archive/ignore handling, and when processing may be explicitly authorized. |
| OL-SYS-041 | Run first real source-file intake test. | Proposed only / needs human review | The smoke-test drop is now marked `ignored_test`; a future Add to Project drop with actual source candidates should verify latest-active-drop routing and source inventory behavior. |
| OL-SYS-042 | Review intake drop status conventions. | Proposed only / needs human review | Current statuses are `staged_unprocessed`, `inventoried_proposed`, `ignored_test`, `archived`, `superseded`, and `ready_for_processing_review`; confirm naming before relying on them for real project intake. |
| OL-SYS-043 | Future real API trigger remains parked. | Conceptual / not active scope | The current trigger is the manual command `read build directive`; no API call, agent event, or autonomous processing was implemented. |
| OL-SYS-044 | Directive-driven intake review page test is pending. | Proposed only / needs human review | Project/drop directive conflict was resolved with narrow project-level permission for `source_inventory_plus_review_page`, but no review page has been created yet. |
| OL-SYS-045 | Review default directive mode for future drops. | Proposed only / needs human review | Future drops now generate `source_inventory_plus_review_page`; confirm this is the desired default before using it on real source candidates. |
| OL-SYS-046 | Human review of narrow review-page permission. | Proposed only / needs human review | Confirm that allowing only `pages/intake_<dropId>.json`, `overlays/intake_<dropId>/text.md`, and one `pageOrder` entry is the right boundary for proposed intake review pages. |
| OL-SYS-047 | Human review of latest intake review page remains open. | Observed implemented / needs human review | Drop `2026-05-16_02-12-44_uxm6dg` is `review_page_created`; decide whether to keep it active, mark `ignored_test`, archive, reject, supersede, or approve for processing review. |
| OL-SYS-048 | Future UI action for archive/supersede remains open. | Proposed only / needs human review | Lifecycle statuses are file-based only; no editor UI exists yet for archiving, superseding, rejecting, or approving processing review. |
| OL-SYS-049 | Human review of real-drive intake thumbnail/metadata remains open. | Observed proposed preview / needs human review | Drop `2026-05-16_02-12-44_uxm6dg` now has a drop-local 320 px thumbnail and safe image metadata. Decide what the JPEG depicts, whether it is relevant to Utah FORGE, and whether deeper metadata/provenance/processing review is authorized. |
| OL-SYS-050 | Human review of PDF/handoff intake review page remains open. | Observed proposed review / needs human review | Drop `2026-05-16_02-45-23_1kbq3z` now has Markdown/PDF inventory, PDF text extraction, first-page previews, a proposed page update plan, and an intake review page. Decide canonical PDF, source-verification needs, and whether any demo-page update pass should be authorized. |
| OL-SYS-036 | Human review of home-row Add to Project intake audit. | Proposed only / needs human review | `Home-Add-To-Project-Intake-Audit.md` recommends a Utah FORGE-only right-side home-row affordance as a sibling to the existing row button to avoid nested-button and bubbling problems. |
| OL-SYS-037 | Decide whether the Utah FORGE intake modal can remain under `src/editor/` during home-row reuse. | Proposed only / needs human review | Audit recommends keeping `UtahForgeAddToProjectDrop` in place for Test 1 because it has no `EditorProvider` dependency and moving it would add churn. |
| OL-SYS-038 | Human review of home-row Add to Project implementation. | Observed implemented / needs human review | Utah FORGE now has a right-side home-row Add to Project affordance; review placement, event behavior, and visual fit before broader use. |
| OL-SYS-039 | Review `Commit Intake` wording. | Proposed only / needs human review | The modal now separates preflight selection from write action; confirm `Commit Intake` clearly means staging only, not processing or acceptance. |
| OL-SYS-040 | Future home-row intake generalization to other projects remains parked. | Proposed only / needs human review | Woodjam, Shahbazi, Base GUI, and Add New Project do not expose active intake in Test 1. |

## Seismic Status Questions

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-SEIS-001 | Reconcile older blocked/not-active Utah seismic docs with current human context that seismic is needed and underway. | Unverified / needs human review | Do not park, hide, delete, or downgrade seismic by assumption. |
| OL-SEIS-002 | Decide intended default demo behavior for seismic while preserving active seismic work. | Unverified / needs human review | Requires review of layer default visibility, product visibility, page overrides, opacity, presets, provenance, and visual quality. |
| OL-SEIS-003 | Clarify seismic provenance/status language for client-facing use. | Proposed only | Seismic source inventory, navigation, browser manifest, demo recipes, products, scripts, controls, and tests should be preserved. |
| OL-SEIS-004 | Classify seismic 3D raymarch products and 2D section products by readiness and intended presentation role. | Unverified / needs human review | `Layer-Artifact-Classification.md` records 34 seismic products, 4 raymarch-capable products, 30 section-only products, and 66 total sections. |
| OL-SEIS-005 | Review seismic product/default/preset choice for the new MT + seismic page. | Proposed only / needs human review | The page keeps the current environment product visible page-locally; project metadata default product and environment product differ and still need reconciliation. |

## Rendering Quality Risks

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-RENDER-001 | Guard against treating rendering richness or dataset complexity as bloat. | Observed human boundary | Bloat reduction means structural clarity, not visual downgrade. |
| OL-RENDER-003 | Avoid optimizations that simplify seismic, MT, full-density, Shahbazi, or Woodjam visuals without explicit acceptance. | Observed human boundary | Do not simplify rendering or reduce client-data complexity. |
| OL-RENDER-005 | Review the proposed mandatory visual check scenes before using them as a verification gate. | Proposed only / needs human review | `Render-Quality-Checks.md` proposes Utah MT slices/stations, Utah seismic, MT+seismic co-render, scalar volume/full-density, threshold/top surfaces, contour/isoband/heat-map layers, Shahbazi surfaces/contours, Shahbazi point/photo overlay, and Woodjam regression scenes. |
| OL-RENDER-006 | Decide which rendering changes require explicit human approval. | Proposed only / needs human review | Risky categories include render order, depth test/write, polygon offset, material side, opacity, color ramps, scalar ranges, point size, volume/raymarch sampling, camera/page framing, default visibility/loading, seismic filtering, and full-density/QA loading. |
| OL-RENDER-007 | Review the new MT + seismic screenshot for client-demo visual quality. | Proposed only / needs human review | Screenshot exists, but no human acceptance has been recorded for beauty, readability, spatial relationship, legend clarity, or technical credibility. |
| OL-RENDER-008 | Review demo walkthrough v0 screenshots for client-demo quality. | Proposed only / needs human review | Screenshots exist for MT slices, Phase 3 seismic, and MT + seismic integration; review camera polish, overlay readability, page manager visibility, legend clarity, seismic visibility, and multi-method spatial relationship. |
| OL-RENDER-009 | Point-cloud visual regression remains unresolved. | Observed / needs human review | `Regression-Investigation-PointCloud-2026-05-16.md` and `VER-2026-05-17-006-utah-forge-pointcloud-regression-state-capture.md` captured default, filtered, faint, and candidate-good full-density states. Human must identify the exact bad page/state. |
| OL-RENDER-010 | Restore pageOrder or page-local full-density overrides only after review. | Proposed only / needs human review | Current strongest candidates are `02_untitled` selected with opacity `0`, `08_untitled` opacity `0.05`, and scalar-filtered pages with narrow focus/noise/edge overrides. Do not change rendering code to compensate for page-state problems. |
| OL-RENDER-011 | Loader rollback is lower priority unless page-state fixes fail. | Proposed only / needs human review | Current dispatch still routes `utah-forge-mt-resistivity-full-density` through `pointcloud-preview-tiles`; diagnostics show stable point counts across captured states. |
| OL-RENDER-012 | Review Utah FORGE visual baseline restore. | Observed implemented / needs human review | `VER-2026-05-17-008-utah-forge-visual-baseline-restore.md` restored the environment `cinematic-dark` preset and default terrain/roads visibility, then captured restored startup and point-cloud screenshots. |
| OL-RENDER-013 | Keep intake work paused until visual baseline is confirmed. | Observed human boundary | Intake pages and drops remain present, but intake processing and Add to Project work should stay paused until the Utah FORGE baseline screenshots are reviewed. |
| OL-RENDER-014 | Defer loader rollback unless the visual baseline restore fails human review. | Proposed only / needs human review | The restore used environment/page state only; runtime loading still reports full-density through `pointcloud-preview-tiles` with stable point counts. |

## Future Time-Pressure Context Pending

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-TIME-001 | Updated time-pressure/demo goals are pending and may reprioritize structural work. | Unverified / needs human review | Current plan is structural refinement before demo-specific scope locks. |

## Utah FORGE Intake Review-Page Test

| ID | Loop | Status | Source | Next human decision needed |
| --- | --- | --- | --- | --- |
| OL-INTAKE-001 | Canonical PDF is unknown. | open | `source_inventory.json`, `pdf_review/pdf_index.json`, `proposed_next_steps.md` | Choose one canonical PDF export, decide none is canonical, or keep all as review references. |
| OL-INTAKE-002 | Whether the Markdown handoff updates current Utah FORGE demo pages is unresolved. | open | `proposed_page_update_plan.md`, `source_inventory.md` | Decide whether the handoff should drive a bounded page-update proposal. |
| OL-INTAKE-003 | Source report links and licensing claims are unverified. | open | `source_inventory.json`, `source_inventory.md`, `proposed_next_steps.md` | Decide whether to verify source/report links and licensing before page work. |
| OL-INTAKE-004 | PDF previews may remain review references or later become app-readable preview assets. | open | `proposed_page_update_plan.md`, `pdf_review/pdf_index.md` | Decide whether PDF previews stay drop-local or get copied to app-readable paths in a later approved pass. |
| OL-INTAKE-005 | Drop lifecycle disposition is unresolved. | open | `proposed_next_steps.md`, `intake_manifest.json` | Decide whether the drop remains active, is archived, superseded, rejected, or approved for a bounded page-update proposal. |
| OL-INTAKE-006 | Proposed page update is not accepted work. | open | `proposed_page_update_plan.md`, `BUILD_DIRECTIVE.md` | Decide whether any proposed page update should become accepted work. |

## Conceptual Frame / Parked Future Concepts

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-CONCEPT-001 | Breadcrumbing concept remains parked. | Conceptual only / not active scope | `Conceptual-Frame-Geovox-Lab-Processware-Breadcrumbs.md` records breadcrumbs as future small local context road signs; do not create them unless explicitly instructed. |
| OL-CONCEPT-002 | New Project / generalized drop-file intake concept remains parked. | Conceptual only / not active scope | Future generalized intake may involve AI classification, registers, review queues, accepted project patches, project wizards, and agent workflows. The current Utah FORGE Test 1 is only a bounded dev staging UI and does not activate the broader concept. |
| OL-CONCEPT-003 | Processware/SRI implementation remains parked. | Conceptual only / not active scope | The conceptual frame records Processware and SRI as orientation, not an app feature or implementation directive. |
| OL-CONCEPT-004 | Phase 3 DMT / updated directives are pending. | Unverified / needs human review | Future directives may define intake/breadcrumb/process scope later; current docs do not authorize implementation. |
| OL-CONCEPT-005 | Current app/data-flow foundation remains active priority. | Observed current boundary | Active work remains loader/project-module boundary, data/artifact wrapper discipline, diagnostics, verification rails, and render/computed-artifact protection unless a human explicitly changes scope. |

## Control-Plane Decisions Needing Human Review

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-CTRL-001 | Decide what promotes an entry from inference/proposal to accepted state. | Unverified / needs human review | `Acceptance-Register.md` skeleton |
| OL-CTRL-002 | Decide whether source/inference/acceptance registers get populated only by explicit review or during every docs pass. | Unverified / needs human review | Existing register templates |
| OL-CTRL-003 | Decide what verification receipts are required for docs-only, manifest-only, and code changes. | Unverified / needs human review | `Verification-Receipts/TEMPLATE.md` |
| OL-CTRL-004 | Decide whether DHF links remain lightweight references or become a formal DHF bridge later. | Unverified / needs human review | `DHF-Links/TEMPLATE.md`, user instruction |
| OL-CTRL-005 | Version-control/diff verification unresolved. | Observed unresolved | `git diff -- docs/dev-context` failed because `C:\GeoSee_Dev` is not currently a git repository; see `Verification-Receipts/VER-2026-05-15-001-no-git-diff-available.md` |
| OL-CTRL-006 | No-git state weakens receipt reliability. | Observed risk | Filesystem modified-time checks are weaker than real git diff/status verification. |
| OL-CTRL-007 | Human review needed before initializing git or changing repo source-control structure. | Unverified / needs human review | Do not initialize git, connect remotes, or alter source-control structure without explicit approval. |
| OL-CTRL-008 | Source Register starter rows need human review for authority level and naming. | Unverified / needs human review | `Source-Register.md` rows are observed records, not accepted state. |
| OL-CTRL-009 | Inference Register starter rows need human disposition: accept, reject, supersede, or keep proposed. | Unverified / needs human review | `Inference-Register.md` rows are proposals only. |
| OL-CTRL-010 | Acceptance Register has no accepted items from this pass. | Observed unresolved | `Acceptance-Register.md` intentionally avoids accepted rows without explicit human approval. |
| OL-CTRL-011 | Decide whether "docs/dev-context is lab book, not official DHF" should be explicitly accepted. | Unverified / needs human review | Currently proposed/recorded in docs, but not human-promoted in `Acceptance-Register.md`. |
| OL-CTRL-012 | Docs/dev-context control-rail setup pass is documented complete but unaccepted pending human review. | Observed complete / needs human review | See `Change-Receipts/CHG-2026-05-15-001-dev-context-control-rail.md`; record any accept/reject/supersede decisions in `Acceptance-Register.md`. |

## App Architecture Decisions Not To Implement Yet

| ID | Loop | Status | Evidence / note |
| --- | --- | --- | --- |
| OL-ARCH-001 | Project-specific loader isolation. | Proposed only | `src/scene/layerLoaders.ts` has generic and project-specific cases; `Loader-Project-Module-Audit.md` records the first boundary map but does not approve implementation. |
| OL-ARCH-002 | SceneManager split. | Proposed only | `src/scene/SceneManager.ts` is large and broad |
| OL-ARCH-003 | Editor module split. | Proposed only | `LayerPanel.tsx`, `EnvironmentScenePanel.tsx`, `PagePanel.tsx` are large |
| OL-ARCH-004 | Lightweight presenter route. | Proposed only | Presenter behavior is currently embedded in loaded app/editor chrome |
| OL-ARCH-005 | Page-level lazy loading. | Proposed only | Editor chrome lazy-load exists; page-level lazy loading is not established as accepted work |
| OL-ARCH-006 | Layer disposal/memory contract. | Proposed only | `disposeObjectTree.ts` exists; no accepted broader contract recorded here |
