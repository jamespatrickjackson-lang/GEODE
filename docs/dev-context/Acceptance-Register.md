# Acceptance Register

## Purpose

Track human-reviewed promotion of a source state, project state, design decision, scope item, or interpretation into accepted shared state.

Governing rule: software/local files own deterministic state; AI interpretation is proposal; human judgment owns acceptance.

## Register

No accepted items recorded in this pass unless explicitly human-approved.

| acceptance_id | item | item_type | accepted_by | accepted_at | basis | related_receipts | status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACC-000 | No accepted items recorded in this pass | Register note | Not accepted | 2026-05-15 | User instruction: do not mark anything accepted without explicit acceptance or clear repo acceptance record | None | Pending human review | Placeholder row only; do not treat as accepted state. |

## Entry Template

| acceptance_id | item | item_type | accepted_by | accepted_at | basis | related_receipts | status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACC-000 | Accepted statement | Source state / project state / design decision / scope item / interpretation | Human name or role | YYYY-MM-DD | Source/inference/human decision basis | VER/CHG/SRC/INF links | Accepted / Superseded / Rejected / Pending review | Concise caveat |

## Rules

- Acceptance Register entries require explicit human acceptance.
- Codex must not promote an inference to accepted state on its own.
- Do not backfill acceptance from AI preference or from repo existence alone.
- If evidence is ambiguous, record the item as source or inference and mark human review required.
