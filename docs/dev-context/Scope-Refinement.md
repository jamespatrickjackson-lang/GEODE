# Scope Refinement

Last populated: 2026-05-15

## Current Rule

Candidate scope is proposed, not locked. This file classifies inputs for review and must not be read as implementation approval. Current priority is structural refinement of GeoVox data, system, and app shape before updated time-pressure/demo goals arrive.

## Structural Refinement Guardrail

- Observed: Bloat reduction means reducing structural confusion, not reducing rendering quality or data richness.
- Observed: Seismic is needed and underway; do not park, hide, delete, or downgrade seismic by assumption.
- Observed: High-quality rendering, spatial fidelity, camera/page polish, rich client-data visualization, technical credibility, and provenance/status clarity are non-negotiable.
- Observed: Processware/SRI implementation is parked for now.
- Observed: `Data-System-App-Refinement-Plan.md` is proposed planning, not implementation approval or locked scope.

## Classification Model

| Class | Meaning | Posture |
| --- | --- | --- |
| NOW | Candidate work that directly supports current demo/control-plane stability | Prepare bounded prompt or docs/audit task |
| NEXT | Likely useful after current-state and control rails stabilize | Keep as backlog candidate |
| PARK | Good idea, but not useful for this pass | Revisit only after trigger |
| REJECT / DO NOT DO NOW | Would create premature platform, SRI, DHF, backend, or app bloat | Do not carry into current work |

## NOW

| Candidate | Status | Evidence / reason | Boundary |
| --- | --- | --- | --- |
| Utah FORGE current-state reconciliation | Observed | Utah docs, manifests, environment defaults, CHANGELOG, and smoke test contradict each other on MT/seismic/default state. | Docs/register reconciliation only in this pass. |
| Data/status manifest refinement | Proposed only | Read-only audit found source, processed, QA, full-density, demo-facing, future, and placeholder artifacts need clearer classification. | Docs/audit only; no manifest changes in this pass. |
| Project-local data status README pattern | Proposed only | Utah/Shahbazi/Woodjam data roles differ and status language is uneven. | Plan status language; do not move or rewrite project data yet. |
| Page/layer visibility clarity | Proposed only | Environment defaults, page overrides, product visibility, opacity, and overlays can diverge. | Map behavior; do not change visibility. |
| Runtime loading policy design | Proposed only | Current scene mount appears to register and start loading every non-disabled manifest layer; visibility is not the same as loaded/allocated. | Design/classify only; do not implement lazy loading or change manifests/pages. |
| Render-quality preservation checks | Proposed only | Human context requires beauty, fidelity, richness, scale, credibility, and provenance/status clarity. | Define checks only; do not simplify rendering. |
| Seismic status/provenance clarity | Observed | Seismic is needed and underway, while older docs contain blocked/not-active language. | Clarify status/provenance; do not park or hide seismic by assumption. |
| Manifest-driven data runtime | Observed | `project.json`, `environment.json`, `previewFiles`, `futureTargets`, and support manifests are already the runtime contract surface. | Audit/document current contract; do not redesign runtime now. |
| App architecture map only | Proposed only | Read-only audit identified large modules and project-specific behavior in generic areas. | Map boundaries only; no code refactor now. |
| Layer disposal/memory contract | Observed | `disposeObjectTree.ts` exists and `SceneManager.ts` manages many heavy layer/overlay states. | Define/audit expectations only; no memory refactor now. |
| SRI source/inference/acceptance registers | Observed | `Source-Register.md`, `Inference-Register.md`, and `Acceptance-Register.md` exist as dev-context skeletons. | Keep external docs rail; do not build SRI into app. |
| DHF/change-log/context-doc centralization | Observed | Existing docs and project handoffs disagree; `docs/dev-context` is intended as control-plane trace rail. | Classify and link; do not move docs or create official DHF. |

## NEXT

| Candidate | Status | Evidence / reason | Boundary |
| --- | --- | --- | --- |
| Project-specific loader isolation | Observed | `src/scene/layerLoaders.ts` mixes generic loaders with Utah FORGE, Shahbazi, and scaffold cases. | Do after current-state map and accepted ownership plan. |
| SceneManager split | Observed | `src/scene/SceneManager.ts` is about 8,886 lines and owns environment, visibility, scalar, seismic, sectioning, transitions, helpers, and overlays. | No split without tests and accepted slice boundaries. |
| Editor module split | Observed | `LayerPanel.tsx` is about 12,913 lines; `EnvironmentScenePanel.tsx` is about 3,763 lines. | Do after stable control map and focused component ownership. |
| Lightweight presenter route | Observed | Presenter/preview behavior exists, but the app loads editor/presenter chrome together after project selection. | Consider after demo defaults and docs are reconciled. |
| Page-level lazy loading | Unverified / needs human review | Editor chrome lazy-loading is observed; page-level lazy behavior is not accepted in files inspected. | Performance candidate only; no implementation now. |
| High-complexity load policy | Proposed only | Full-density MT, scalar volume, threshold surfaces, slices, seismic raymarch/sections, and Shahbazi previews should be intentional. | Do not delete or downgrade high-complexity data. |
| Runtime load metadata fields | Proposed only | `Runtime-Loading-Policy.md` proposes `requiredLayers`, `preloadLayers`, `optionalLayers`, `qaLayers`, `computedArtifactLayers`, and `futureLayers` as possible future contract fields. | Review schema/compatibility first; prefer existing visibility/page overrides until accepted. |

## PARK

| Candidate | Status | Reason parked |
| --- | --- | --- |
| Persistent multi-audience authoring | Observed as not implemented | Shahbazi Audience Lens is runtime-only; persistence would alter data model and authoring complexity. |
| Export/publish/MP4/still-pack/provenance PDF | Observed unresolved | Useful product work, but not part of docs/dev-context population. |
| Project creation wizard | Observed unresolved | Would distract from current state and control rails. |
| Production auth/access control | Observed unresolved | Product/platform decision, not current demo/control-plane stabilization. |
| Full formal DHF migration | Unverified / needs human review | This folder may link DHF-like concerns, but is not official DHF. |
| Processware/SRI app integration | Observed parked | Parked until data/system/app structure is clarified. |
| Broad refactors | Proposed only | Too risky before structural map and render-quality checks exist. |
| Runtime lazy/on-demand implementation | Proposed only | Useful later, but unsafe before load classes, render-quality checks, computed-artifact guardrails, and human decisions are reviewed. |
| Full automation | Proposed only | Could distract from client-quality rendering and current structure. |

## REJECT / DO NOT DO NOW

| Candidate | Status | Reason |
| --- | --- | --- |
| Turn SRI / Processware / DHF rails into app features | Observed boundary | User instruction and `docs/dev-context/HOME.md` keep rails outside runtime for now. |
| Build SaaS platform capabilities, accounts, billing, tenancy, or production backend | Observed out-of-scope | `CLAUDE.md`, `docs/01-scope.md`, and `docs/00-purpose.md` mark these as not current alpha work. |
| Treat backlog recommendations as committed scope | Observed boundary | User instruction for this pass. |
| Refactor `src/`, `prep/`, `projects/`, package files, or config files during this docs pass | Observed boundary | User instruction for this pass. |
| Resolve data/document contradictions silently | Observed boundary | User instruction requires recording contradictions. |
| Reduce bloat by simplifying visuals or reducing client-data complexity | Observed boundary | Bloat reduction means structural clarity; visual quality and necessary complexity must be preserved. |

## Review Notes

- Observed: NOW items above are framed as documentation, audit, or measurement moves that support current demo/control-plane stability.
- Observed: NEXT items are plausible architecture inputs, but not implementation tasks.
- Observed: Current work is structural refinement before updated time-pressure/demo-specific goals.
- Observed: Utah FORGE seismic is needed and underway; older blocked/not-active docs need reconciliation, not automatic rollback.
- Unverified / needs human review: Which proposed NOW/NEXT/PARK items should become implementation prompts after human review.
