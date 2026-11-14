# Documentation — shared agent instructions

Scope: `docs/`. This file describes safe documentation work across coding agents. It routes to existing technical and decision records; it **does not create a new authority ranking** or permit changing an unresolved engineering decision.

## Read the owning document, not the whole archive

- For the purpose, alpha scope and architecture, consult `docs/00-purpose.md`, `docs/01-scope.md`, and `docs/02-architecture.md`.
- For durable design decisions and supersession history, consult `docs/03-decisions.md`. Preserve existing entries; record an approved change as a new entry that explicitly identifies any superseded decision. Do not silently reword history.
- For task-specific current routing and evidence, use `docs/dev-context/Active-Build-Context.md` and `docs/dev-context/Verification-Routing.md`. Follow links to the smallest relevant technical area; do not search all archives, receipts, generated reports or screenshots by default.
- For editor controls and persisted authoring fields, consult `docs/dev-context/Editor-Control-Manifest-Policy.md` and `docs/dev-context/editor-control-manifest.json`. For editor completeness claims and GUI exposure, consult `docs/06-editor-exposure-rules.md`.
- For transition descriptions, consult `docs/dev-context/Transition-Constitution.md`, `docs/dev-context/Transition-Continuity-Contract.md`, `docs/dev-context/Transition-Decision-Log.md`, `docs/dev-context/Transition-Guardrails.md` and `docs/dev-context/Transition-Runtime-Operating-Spec.md`; preserve the status of draft clauses and existing contradictions rather than assigning a new hierarchy here.
- For visual conventions, consult `docs/dev-context/UI-Visual-Standards.md` and `docs/dev-context/Visual-Review-Current.md`.
- For public distribution and scientific provenance, consult `docs/LICENSING.md`, `docs/GEODE-publication-manifest.md`, `docs/dev-context/Dataset-Map.md` and the actual data/source manifests.

## Preservation and evidence discipline

- Preserve established engineering methods, exclusions, exceptions, source paths, historical rationale, test commands and negative-regression guards when reconciling documentation. Consolidate only genuinely equivalent requirements. Maintain a source-to-destination crosswalk for substantive restructuring.
- Label claims according to the available evidence: implemented/verified, observed but not independently verified, proposed, historical, or unresolved. A design specification, draft plan, demo screenshot or source-path reference is not evidence that the runtime behavior or scientific interpretation has been verified.
- Do not present GEODE's proposed independently reusable common spine as a separately delivered runtime until source and tests substantiate it. Retain the research/software-development alpha boundary and avoid unsupported geospatial accuracy, medical clearance, validated depth or source-registration claims.
- Do not promote third-party scientific data, satellite imagery, reports, research figures, photographs, provenance records or derivative products to Apache-2.0 merely because they appear inside a public repository. Preserve source attribution and verify permissions before republication; see `docs/LICENSING.md`.
- Documentation describing a user-facing configuration feature must account for where the field lives, applies, appears in the editor, saves/reloads, and is visually verified. An implementation that is still missing these steps must not be documented as complete; see `docs/06-editor-exposure-rules.md`.
- Do not equate automated tests, synthetic fixtures, page/deck snapshots or automated screenshots with the user's required human visual acceptance for presentation or visual-quality changes.
- When source behavior, an active specification and historical prose disagree, **record the competing evidence and hold the resolution**. Do not silently rewrite a decision, alter code to fit a possibly stale document, or promote observed current implementation into an approved requirement.
- For docs-only edits, verify changed links and references, check the Git diff, and follow the applicable focused checks in `docs/dev-context/Verification-Routing.md`. Never claim tests or runtime checks ran if they were not executed.

## Scope limits during instruction consolidation

The current consolidation audit and held discrepancies live in `docs/dev-context/Agent-Instruction-Consolidation-Plan.md`. This file is a new scoped instruction candidate, not a replacement for existing specification detail or a resolution of the held authority conflicts. No repository history, local archive, third-party dataset, user-authored project scene, or other active agent instruction file is implicitly authorized for modification.
