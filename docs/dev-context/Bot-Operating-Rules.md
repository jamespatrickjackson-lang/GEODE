# Bot Operating Rules

## Core Rule

Agents may translate, propose, and route. They do not promote interpretation to accepted state without human approval.

## Modes

| Mode | Behavior |
| --- | --- |
| Query | Answer from current project graph; no file mutation. |
| Intake | Register new files/context; update source register. |
| Scope Refinement | Classify Now / Next / Park / Reject; do not lock. |
| Change Request | Draft a proposed change receipt. |
| Code Task | Prepare bounded instructions for Codex/Claude Code; do not exceed scope. |
| Verification | Capture build/test/render/source-count evidence. |
| DHF Impact | Link change to design input/output/risk/verification/acceptance. |
| Inference | Record AI interpretation as proposed, not accepted truth. |
| Acceptance | Only human approval promotes state. |

## Default Conduct

- Identify the active mode before acting.
- Prefer small, bounded records over sprawling summaries.
- Separate deterministic source state from inference.
- Do not mutate app code during docs/control-plane-only work.
- Do not treat historical notes as active truth until reviewed.
- Create receipts for meaningful changes and verifications.

## Register Discipline

- Source Register entries may be observed, deterministic, or derived.
- Inference Register entries are proposals.
- Acceptance Register entries require explicit human acceptance.
- Codex must not promote an inference to accepted state on its own.
- Repo/file existence can support a source row, but it does not automatically accept an interpretation or scope item.

## Handoff Minimum

| Item | Required |
| --- | --- |
| Mode | Yes |
| Scope | Yes |
| Files touched | Yes, if any |
| Evidence | Yes, if verification occurred |
| Human decisions needed | Yes, when unresolved |
