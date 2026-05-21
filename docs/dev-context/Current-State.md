# Current State

> Orientation note, 2026-05-20:
> For current software-build work, start with `docs/dev-context/Active-Build-Context.md` and `docs/dev-context/Active-Build-Queue.md`. This file remains a state ledger and contradiction record, not the shortest active task orientation.

Last populated: 2026-05-15

## Authority

- Observed: This file is a docs/dev-context population record, not accepted scope, not app runtime, and not official DHF.
- Observed: Deterministic state lives in source files, project manifests, generated data artifacts, tests, and explicit human acceptance records.
- Observed: Existing docs contain contradictions. This pass records them instead of choosing a silent winner.

## Current Human Priority

- Observed: Current priority is GeoVox data/system/app structural refinement before further implementation.
- Observed: Current operating mode is software-build mode. Normal work should start from the requested subsystem and current source/project files, not from Utah FORGE intake directives or staged drops.
- Observed: Intake remains a dormant Add to Project capability. It should only steer agent work when the human explicitly asks for intake, staged files, a drop, a directive, a review route, or Add to Project behavior.
- Observed: Processware/SRI implementation is parked for now and should not be implemented in the app during this refinement step.
- Observed: Seismic is needed and underway; do not assume seismic should be parked, hidden, removed, or downgraded.
- Observed: Rendering beauty and high-quality client-data visualization are non-negotiable.
- Observed: Bloat reduction means reducing structural confusion, not simplifying visuals, weakening rendering, or reducing rich datasets to thin visual products.
- Observed: Computed artifact generation is explicitly protected; isolines, isobands, contours, heat maps, scalar slices, scalar volumes, threshold surfaces, seismic products, meshes, point-cloud tiles, legends, and provenance/status wrappers are core GeoVox capabilities.
- Observed: Updated time-pressure/demo goals will arrive later; scope remains under refinement and is not locked.
- Observed: `Data-System-App-Refinement-Plan.md` records the current proposed structural refinement plan.
- Observed: `Conceptual-Frame-Geovox-Lab-Processware-Breadcrumbs.md` now exists as context only, not active scope, not official DHF, and not an accepted product requirement.

## Intelligence Layer Current State

- Observed: `docs/dev-context/Intelligence-Layer-Current-State.md` is now the active orientation doc for the Utah FORGE intelligence layer.
- Observed: The canonical intake-review model remains available only for explicit intake work: `intake_manifest.json` / `intake_context.md` -> `INTAKE_REVIEW.json/.md` -> `LATEST_INTAKE_REVIEW.json` -> optional `USER_CONTEXT_RESPONSE.json/.md` -> later separate route execution.
- Observed: Intake test artifacts and active intake page surfaces have been purged from the Utah FORGE active project surface so they do not distract normal software-build work.
- Observed: `AI_REVIEW`, `LATEST_AI_REVIEW`, and `INTAKE_SWITCHBOARD` are compatibility aliases only.
- Observed: `AGENT_TRAILHEAD`, `BUILD_DIRECTIVE`, and `INTENT_BINDINGS` are historical trace only, not active authority.
- Observed: Pre-canonical planning docs were archived under `docs/dev-context/Archive/intake-intelligence-precanonical-2026-05-20/`.
- Unverified / needs human review: This current model is not accepted product scope until a human records acceptance in `Acceptance-Register.md`.

## What Is Real Now

| Claim | Status | Evidence |
| --- | --- | --- |
| GeoSee is currently a Vite + React + TypeScript + Three.js app. | Observed | `package.json`, `src/App.tsx`, `docs/02-architecture.md` |
| The app is multi-project, with folders for Woodjam, Shahbazi / Case Study B, Utah FORGE, and Base GUI. | Observed | `projects/`, `src/projects/projectCatalogRuntime.ts`, `docs/START-HERE.md` |
| Authoring uses project manifests, environment JSON, page JSON, overlays, and project-local data. | Observed | `projects/*/project.json`, `projects/*/environment.json`, `projects/*/pages/`, `projects/*/overlays/` |
| Local authoring writes are implemented through a dev-only Vite plugin; static builds copy runtime data/projects. | Observed | `vite.config.ts`, `plugins/vite-plugin-author-write.ts` referenced by `CLAUDE.md` |
| Editor chrome is lazy-loaded after project selection. | Observed | `src/App.tsx`, `docs/02-architecture.md`, `CHANGELOG.md` |
| Layer loading is centralized through `src/scene/layerLoaders.ts`, with `previewFiles` preferred over legacy `files`. | Observed | `src/scene/layerLoaders.ts`, `src/pages/types.ts` |
| Woodjam remains a real/reference project with public terrain, drilling, geochem, geology, hydrography, roads, and related layers. | Observed | `projects/woodjam/project.json`, `docs/woodjam/` |
| Shahbazi Gravel Pit / Case Study B has source-derived preview layers plus placeholder/future targets. | Observed | `projects/case-study-b/project.json`, `projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md` |
| Utah FORGE manifests now include Phase 3 MT, public context, scalar volume/threshold/top-surface records, and a Phase 3 seismic browser record. | Observed | `projects/utah-forge/project.json`, `projects/utah-forge/environment.json` |
| A broad Utah FORGE smoke test exists and exercises public context, seismic browser, MT full-density, MT volume, threshold surfaces, scene sectioning, and legend behavior. | Observed | `tests/utah-forge-smoke.spec.ts`, `package.json` |
| A layer/artifact/computed-artifact classification matrix now exists for Utah FORGE, Case Study B / Shahbazi, and Woodjam. | Observed | `docs/dev-context/Layer-Artifact-Classification.md` |
| A computed-artifact pipeline guardrail now exists and explicitly protects raw-to-derived analytical/render-ready output generation. | Observed | `docs/dev-context/Computed-Artifact-Pipeline.md` |
| Utah FORGE now has a project-local data/layer status guide. | Observed | `projects/utah-forge/DATA_LAYER_STATUS.md`; covers source/client/public, processed/browser-ready, render-ready, QA/validation, provenance/status wrappers, MT, seismic, demo candidates, and unclear/future artifacts; docs/status only, no runtime behavior change |

## Placeholder / Future / Parked

| Item | Status | Evidence |
| --- | --- | --- |
| Base GUI Template is a blank/default editing context, not real project data. | Observed | `projects/base-gui/project.json` |
| `utah-forge-reference-stage` and `base-gui-reference-stage` are procedural placeholders. | Observed | `projects/utah-forge/project.json`, `projects/base-gui/project.json` |
| Shahbazi orthomosaic, textured mesh/GLB, and full point-cloud stream remain future targets. | Observed | `projects/case-study-b/project.json`, `docs/01-scope.md` |
| Export/publish, MP4, still-pack, provenance PDF, project wizard, transactional save, and production auth remain unresolved product work. | Observed | `docs/01-scope.md`, `docs/04-build-sequence.md`, `docs/handover-for-claude.md` |
| Persistent multi-audience authoring is not implemented; Shahbazi Audience Lens is runtime-only. | Observed | `docs/02-architecture.md`, `src/audience/` |
| SRI / Processware / DHF-style rails are external documentation/control-plane concepts here, not app modules. | Observed | `docs/dev-context/HOME.md`, user instruction for this pass |
| GeoVox lab / Processware / SRI / breadcrumb conceptual frame is recorded for future-agent orientation only. | Observed | `docs/dev-context/Conceptual-Frame-Geovox-Lab-Processware-Breadcrumbs.md` |

## Appears Contradictory

| Contradiction | Status | Evidence |
| --- | --- | --- |
| README/CLAUDE frame the deliverable as Woodjam-focused alpha and README says app shell is TBD; newer docs/code show React multi-project app. | Observed | `README.md`, `CLAUDE.md`, `docs/START-HERE.md`, `package.json` |
| Several root docs say Utah FORGE is a foundation project with no real ingested technical data; newer project files and START-HERE say Phase 3 MT is active. | Observed | `docs/00-purpose.md`, `docs/01-scope.md`, `docs/04-build-sequence.md`, `docs/START-HERE.md`, `projects/utah-forge/project.json` |
| Utah project-local docs say seismic is not active or is blocked; `project.json`, `environment.json`, CHANGELOG, and the smoke test show an active/default-visible seismic browser. | Observed | `projects/utah-forge/data/README.md`, `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/README.md`, `projects/utah-forge/project.json`, `projects/utah-forge/environment.json`, `CHANGELOG.md`, `tests/utah-forge-smoke.spec.ts` |
| Some Utah docs say default visible layers are MT stations, full-density, and top surface; current `environment.json` defaults public context, full-density MT, and seismic browser, but not stations/top surface. | Observed | `projects/utah-forge/AI_NEXT_AGENT_START_HERE.md`, `projects/utah-forge/Stage 2 - Phase 3 MT resistivity.md`, `projects/utah-forge/environment.json` |
| START-HERE says Utah authored MT slices are the default presentation layer; current `environment.json` does not include slices in `defaultVisibleLayers`. | Observed | `docs/START-HERE.md`, `projects/utah-forge/environment.json` |

## Utah FORGE Seismic Receipt

- Observed: `Verification-Receipts/VER-2026-05-15-002-utah-forge-seismic-contradiction.md` records evidence on both sides of the Utah FORGE seismic contradiction.
- Observed: Blocked/not-active evidence appears in Utah project docs and data READMEs.
- Observed: Active/default-visible/implemented evidence appears in `project.json`, `environment.json`, one page config, generated seismic browser manifests, prep scripts, source loader/editor/scene code, and the Utah smoke test.
- Observed: The contradiction was documented only; no source, prep, project, environment, default-visibility, generated-data, or test changes were made.
- Observed: Latest human context says seismic is needed and underway.
- Observed: The current classification pass changed no runtime, project config, page, prep, source, visibility, generated data, or rendering behavior.
- Observed: `projects/utah-forge/DATA_LAYER_STATUS.md` records seismic as needed/underway, separates processed/render-ready/QA/provenance roles, and preserves the raw-to-computed artifact guardrail without changing runtime behavior.
- Unverified / needs human review: Final demo loading/visibility policy for seismic remains pending human review.
- Unverified / needs human review: How older blocked/not-active seismic docs should be superseded, preserved, or rewritten.
- Unverified / needs human review: What the intended default demo behavior should be for seismic without parking, hiding, or downgrading active work by assumption.

## Control-Rail Closeout

- Observed: `Change-Receipts/CHG-2026-05-15-001-dev-context-control-rail.md` closes the docs/dev-context scope-refinement/control-plane setup pass as documented work.
- Observed: The pass created or updated lab-book/control records for current state, open loops, scope refinement, code/data/doc maps, source/inference/acceptance registers, verification receipts, and change receipts.
- Observed: The closeout receipt records that no app implementation, source/prep/project/manifest/config change, SRI app integration, data pipeline change, doc move, or scope lock was intended.
- Observed: This docs/control pass is complete as documentation setup.
- Unverified / needs human review: The pass is not accepted shared state until a human reviews and records acceptance, rejection, or supersession in `Acceptance-Register.md`.

## Documentation Inventory Risk

- Observed: Active truth appears scattered across root docs, canonical `docs/` files, `CHANGELOG.md`, project-local Utah/Shahbazi/Woodjam docs, generated data READMEs, and `docs/dev-context/`.
- Observed: `docs/Doc-Register.md` now inventories root docs, canonical docs, dev-context records, project-local handoffs, data intake docs, and selected source README/metadata notes.
- Observed: Highest-risk contradictions currently involve Utah FORGE foundation/no-real-data wording, active Phase 3 MT state, seismic active/blocked wording, and default-visible layer state.
- Observed: Root README/CLAUDE should not be relied on as complete current-state authority until classified because they retain Woodjam-first/TBD-shell framing.
- Observed: Utah project-local AI handoffs, data READMEs, stage docs, and decisions should not be relied on alone until human review resolves seismic and default-visibility contradictions.
- Observed: Old session/handoff docs should be treated as preservation records or candidate archive material, not active truth, until classified.
- Unverified / needs human review: Which docs should become primary current-state sources after reconciliation.

## Unsafe To Assume

- Observed: No single existing doc is safe as the complete current authority until contradictions are reviewed.
- Observed: Utah FORGE active data status cannot be inferred from old root docs alone.
- Observed: Default-visible layer intent cannot be inferred from prose docs alone because the manifest/environment disagree with several notes.
- Observed: Older Utah seismic intent cannot be inferred from runtime/config evidence alone because multiple Utah docs record explicit "do not start/process/wire seismic" instructions, but latest human context says seismic is needed and underway.
- Observed: Utah seismic runtime visibility cannot be inferred from `defaultVisibleLayers` alone because the inspected environment style includes the seismic layer in defaults while setting seismic product visibility entries to false.
- Observed: Version-control/diff verification unresolved; `git diff -- docs/dev-context` could not run because `C:\GeoSee_Dev` is not currently a git repository.
- Observed: No-git state weakens receipt reliability; filesystem modified-time checks are weaker than real git diff/status verification.
- Unverified / needs human review: Whether the active Utah FORGE seismic browser was explicitly approved after earlier "do not start seismic" notes.
- Unverified / needs human review: Whether current Utah public topo/default-visible choices are desired demo state or transient work state.
- Unverified / needs human review: Which existing docs should be active, historical, stale, or proposal.
- Unverified / needs human review: Human review is needed before initializing git or changing repo source-control structure.

## Next Valid Move

Observed next valid move: create a bounded Data/System/App Refinement Plan review, then choose one structural documentation or audit prompt such as data/status manifest refinement, project-local data status README, page/layer visibility clarity, render-quality preservation checks, seismic status/provenance clarity, or app architecture map only. Do not refactor `src/`, move docs, initialize git, change source-control structure, simplify rendering, park seismic by assumption, or turn candidate architecture ideas into committed scope from this pass.

## Utah FORGE Intake Test State

Last updated: 2026-05-20

Status: quarantined / not active build context.

The prior Utah FORGE intake tests are over. Active test drops, archived test drops, sample intake vocabulary, latest intake pointers, intake review pages, and intake overlays have been removed from the active project surface.

The Add to Project UI remains available as a dormant capability. It is not the problem. The operating rule is that agents should not read or follow intake drops, `BUILD_DIRECTIVE`, `LATEST_INTAKE_REVIEW`, `AI_REVIEW`, or switchboard files during normal software-build work unless the human explicitly asks for intake work.

No intake artifact is accepted project truth. If intake is resumed later, treat it as a new explicit task with fresh staged evidence.
