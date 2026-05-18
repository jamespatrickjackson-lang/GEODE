# Conceptual Frame: GeoVox Lab, Processware, SRI, and Breadcrumbs

## Status

- Conceptual context only.
- Not current implementation scope.
- Not official DHF.
- Not an accepted product requirement.
- Future agents should read this to understand the frame, but should follow `Current-State.md`, `Open-Loops.md`, and explicit human prompts for active work.

This file is orientation. It is not an app requirement and does not authorize runtime, data, page, Processware, SRI, breadcrumb, or intake implementation.

## Short version

GeoVox is the lab.

Logs, receipts, wrappers, diagnostics, and `docs/dev-context` records are the notebook.

Software is the deterministic highway/spine.

Data and computed artifacts are the material moving through the lab.

AI is the adaptive translator/router/librarian/switchboard.

Human judgment owns acceptance.

Verification keeps the relay honest.

Breadcrumbs are future road signs.

Processware is the general systems frame.

## The practical loop

```text
human intent
-> AI translation / routing
-> deterministic software constraints
-> file/code/data/artifact change
-> computation / render / build
-> verification
-> receipt / log
-> next shared state
```

The loop is useful because it keeps deterministic state, AI interpretation, verification evidence, and human acceptance separate.

## Current lab components

Current repo/lab components include:

- `docs/dev-context/` as lab notebook / control rail.
- Change receipts that record intent, files changed, verification, impact, unresolveds, and next moves.
- Verification receipts that preserve build/test/render/source-count evidence when a pass creates them.
- Artifact metadata wrappers for selected Utah FORGE artifacts, all still review-required and not accepted.
- Runtime diagnostics for dev-only structural/resource snapshots.
- Project-artifact coverage reports for layer/wrapper/load-role review.
- `projects/utah-forge/DATA_LAYER_STATUS.md` as project-local data/layer status guidance.
- `docs/dev-context/Loader-Project-Module-Audit.md` as the loader/project-module boundary map.
- Loader registry shell and reference-stage sentinel extraction as current app-spine cleanup, not a complete project-module architecture.
- `docs/dev-context/Computed-Artifact-Pipeline.md` as the guardrail for raw-to-computed artifact capability.

Unknowns remain unknown. This file does not accept any artifact, project scope, implementation direction, or product requirement.

## Processware frame

Processware treats human, AI, software, data, computation, verification, and acceptance as interacting subsystems of one workflow/pipeline.

Clarifications:

- Processware is not being built as an app feature right now.
- Current work only creates lab/notebook/app-spine foundations.
- Later implementation may use this frame to design intake, routing, review, and breadcrumb systems.
- This conceptual frame does not authorize Processware implementation.

## SRI frame

SRI is adaptive inference inside a deterministic control loop:

```text
state -> context -> inference -> policy -> action -> verification -> audit -> state
```

Standing rule:

- Software/local files are deterministic state.
- AI interpretations are proposals.
- Human review owns acceptance.

## Breadcrumbing frame

The lab notebook will become too large for AI context windows. Breadcrumbs are future small local context road signs placed at important seams.

Possible future examples:

- `src/scene/BREADCRUMBS.md`
- `src/loaders/BREADCRUMBS.md`
- `projects/utah-forge/BREADCRUMBS.md`
- `projects/utah-forge/artifact_metadata/BREADCRUMBS.md`
- `prep/BREADCRUMBS.md`
- `docs/dev-context/breadcrumbs/`

Each breadcrumb should eventually answer:

- what this subsystem is
- what not to break
- where deeper records live
- what verification is required
- what the next safe move is

Do not create breadcrumbs yet unless explicitly instructed.

## Future New Project / drop-file intake frame

Future concept:

- user clicks New Project
- a drop-files area receives messy human/client/source data
- AI/agents classify, inventory, and structure it
- software rails constrain allowed transforms/actions
- source register, artifact register, inference/proposal records, and review queue are created
- AI acts as librarian/switchboard/context-aware inputter
- human reviews, accepts, rejects, or fine-tunes
- only accepted outputs patch project config/pages/layers or trigger computed artifacts

This is future work. Do not build this now. Phase 3 DMT / updated directives may define this later.

## Active priority boundary

Current active work remains foundational app/data-flow refinement:

- loader registry shell / project-module boundary
- data/artifact wrapper discipline
- diagnostics
- verification rails
- render/computed-artifact protection
- no presentation work unless explicitly requested
- no Processware implementation unless explicitly requested

## How future agents should use this file

Future agents should:

- read this as conceptual orientation
- not treat it as scope
- check `Current-State.md` and `Open-Loops.md` for active state
- follow explicit human prompts over this conceptual record
- preserve source/inference/acceptance separation
- avoid expanding scope based on this file alone

## Risks if misused

- future agents may treat concept as directive
- Processware may become philosophy sludge
- breadcrumbs may become uncontrolled truth
- lab notebook may become a junk drawer
- AI may promote inference to truth
- app work may drift away from foundational priorities

## Minimal future breadcrumb template

For later use only:

```markdown
# Breadcrumb: [Name]

## Applies to

## Current state

## Do not break

## Safe changes

## Unsafe changes / human review

## Deep records

## Verification required

## Next safe move
```

Do not create breadcrumbs yet unless explicitly instructed.

## Final boundary

This file preserves the conceptual frame. It does not authorize implementation.
