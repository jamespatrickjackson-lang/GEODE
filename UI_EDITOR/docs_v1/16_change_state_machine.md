# v1 Change State Machine

## 1. Goal

A GUI Package moves through a strictly-ordered series of states from "newly created and unvalidated" to "exported and ready for downstream consumption." This doc draws the state machine, lists the triggers and gates for every transition, and specifies persistence + reversal rules.

Without a single source of truth for state transitions, Codex will scatter the logic across `applyEdit`, the export pipeline, the Properties Inspector, and the Top Bar — producing subtle inconsistencies in when a save advances state vs. resets it. This doc is that source of truth.

## 2. States in v1

v1 uses three of the six v0.1 Change States. The other three are deferred (see [12_deferred_to_v2.md](12_deferred_to_v2.md) §15).

| State | Meaning | Visible to author as |
| --- | --- | --- |
| **Draft** | Package has unsaved or unvalidated edits, or has been touched since its last validation. Default state for any package being edited. | Top Bar pill: "Draft" (yellow). |
| **Validated** | Package has passed validation. No unacknowledged Errors / Blockers. Last save and last validation are mutually consistent. | Top Bar pill: "Validated" (green). |
| **Approved** | Author has explicitly approved the validated package. The package is considered fit for downstream consumption (handoff to implementing agent or developer). | Top Bar pill: "Approved" (blue, persistent). |

Deferred:

- **Applied** — requires embedded mode (v2+).
- **Rejected** — requires reviewer workflow (v2+).
- **Archived** — requires multi-package management (v2+).

## 3. State machine diagram

```text
                       (newly created or loaded)
                                 │
                                 ▼
                         ┌───────────────┐
                         │     Draft     │ ◀──────────────┐
                         └───────────────┘                │
                                 │                        │ any edit
                                 │ author clicks          │ that
                                 │ Validate +             │ produces
                                 │ findings have          │ a Change
                                 │ 0 Blockers and         │ Record
                                 │ all Errors             │ targeting
                                 │ acknowledged           │ schema or
                                 ▼                        │ library
                         ┌───────────────┐                │ content
                         │   Validated   │ ───────────────┤
                         └───────────────┘                │
                                 │                        │
                                 │ author clicks          │
                                 │ Approve in             │
                                 │ Top Bar +              │
                                 │ types "approve"        │
                                 │ confirmation           │
                                 ▼                        │
                         ┌───────────────┐                │
                         │   Approved    │ ───────────────┘
                         └───────────────┘
                                 │
                                 │ (any edit; no
                                 │  Approved → Validated
                                 │  shortcut)
                                 ▼
                            back to Draft

      (other states: Applied / Rejected / Archived — deferred to v2+)
```

Plain-English: every edit downgrades to Draft. Approve is the only state that requires an explicit human confirmation step. Validation can be re-run as often as the author wants; only its **result** changes the state, not the act of running it.

## 4. Triggers

Every state transition is triggered by exactly one of these:

| Trigger | From state | To state | Source | Code path |
| --- | --- | --- | --- | --- |
| Edit appended | Validated / Approved | Draft | Any `applyEdit` success that touches schema or library content | `core/editing/applyEdit.ts` followed by reducer dispatch of `STATE_DEMOTE_TO_DRAFT` |
| Validation pass clean | Draft | Validated | Author clicks Validate (Top Bar) and the resulting findings array has 0 Blockers and all Error findings have an `acknowledged` field | `shell/topBar/TopBar.tsx` validate handler reading `core/validation/runValidation.ts` result |
| Approve action | Validated | Approved | Author clicks Approve in Top Bar AND types "approve" in the confirm modal | `shell/topBar/TopBar.tsx` approve handler |
| Demote from Approved | Approved | Draft | Any subsequent edit | Same as edit trigger |

There is no direct Validated → Approved without the confirm. There is no Draft → Approved without passing through Validated. There is no upward transition without explicit user action — validation alone never advances state; only the *result* of validation when the author requested it does.

## 5. Edit classes

Edits divide into two classes:

| Class | Effect on state | Examples |
| --- | --- | --- |
| **Schema edits** | Downgrade state to Draft | Move, Resize, Container draw, Text insert, Library entry add / remove / edit, Properties Inspector value change, Re-snapshot equivalent (v2+), Intent annotation edit |
| **Ephemeral edits** | No state change | Viewport pan / zoom, Selection change, active Tool change, active background swap, snap toggle, Properties Inspector field focus (without commit), Library Panel search filter, Layers Panel collapse/expand |

The `applyEdit` function returns an `editClass` field so the reducer knows whether to dispatch `STATE_DEMOTE_TO_DRAFT`:

```ts
export type ApplyEditResult =
  | { ok: true; pkg: Package; change: ChangeRecord; editClass: "schema" | "ephemeral" }
  | { ok: false; refused: true; findings: ValidationFinding[] };
```

Refused edits never transition state.

## 6. Validation result handling

When the author clicks Validate:

1. `runValidation(pkg, frameId: null, profile)` runs against the whole package.
2. Findings are sorted (worst severity first) and persisted to `validation/findings.json`.
3. The shell evaluates:
   - If any Blocker exists → state stays at Draft (cannot advance).
   - Else if any Error exists without `acknowledged` → state stays at Draft.
   - Else → state advances Draft → Validated.
4. The Top Bar pill updates.
5. A Change Record `validation_run` is appended regardless of state outcome, capturing finding count and worst severity.

If the package is already Validated and validation is re-run:
- If the new result is still clean → state stays at Validated.
- If the new result has Blockers / unacknowledged Errors → state downgrades to Draft.

If the package is Approved and validation is re-run:
- Same logic as Validated. A clean re-run keeps Approved; a dirty re-run downgrades all the way to Draft. (Approved does not have an intermediate "Validated but Approve was revoked" state.)

## 7. Approval workflow

1. Package must currently be Validated.
2. Author clicks "Approve" in the Top Bar.
3. Confirm modal opens (see [15_ui_states_and_feedback.md](15_ui_states_and_feedback.md) §3.2):
   - Title: "Approve this package?"
   - Body: "Approving marks the package as ready for downstream consumption. Type `approve` to confirm. Any subsequent edit will reset the state to Draft."
   - Inline text field: must contain exactly `approve` (case-insensitive) for the Confirm button to enable.
   - Confirm + Cancel buttons.
4. On Confirm: state advances Validated → Approved. Change Record `package_approved` is appended with rationale text optionally captured during the modal (extra textarea, optional).
5. The Top Bar pill becomes Approved (persistent).
6. Export becomes available with a different default brief tone (see §10 below).

To downgrade out of Approved, the author simply edits anything. There is no explicit Demote action (would be ambiguous).

## 8. Acknowledgement workflow for Errors

Some Error findings represent intentional density decisions (e.g. a deliberately small icon button). The author may acknowledge an Error to unblock state advancement.

1. In the Validation Panel, each Error finding shows an "Acknowledge" button.
2. Click → opens an inline rationale form (small textarea, required, min 8 chars).
3. Submit → finding's `acknowledged` field is set: `{ by: author, at: <ISO ts>, rationale }`.
4. Save round-trips the acknowledgement into `validation/findings.json`.
5. Once all Errors are acknowledged (and 0 Blockers exist), Validated state is reachable on next Validate click.

Acknowledged findings remain visible in the Validation Panel with a distinct chrome (small ✓ + rationale tooltip). Unacknowledging is a single click + undo Change Record.

Blockers cannot be acknowledged. Blockers represent categorical failures (e.g. element outside Frame bounds; edit refused on Restricted Surface) that must be resolved by editing the package.

## 9. Persistence

Package state is stored in `manifest.json` `packageState` field. Every state transition writes the manifest immediately (within the next save). Reload restores the persisted state.

Important: state and dirty bit are **independent**:

| `packageState` | Dirty bit | Meaning |
| --- | --- | --- |
| Draft | false | Saved as Draft. No pending edits. |
| Draft | true | Saved as Draft, since-edited. Save will keep state at Draft. |
| Validated | false | Saved as Validated. No pending edits. Findings cache is fresh. |
| Validated | true | Should never occur. Any edit demotes to Draft (which also sets dirty). If observed, the validation cache is stale and the state should be treated as Draft. |
| Approved | false | Saved as Approved. No pending edits. |
| Approved | true | Should never occur. Same logic as Validated + true. |

The reducer enforces this: edits that touch schema dispatch BOTH `STATE_DEMOTE_TO_DRAFT` and `MARK_DIRTY` atomically.

## 10. Export behaviour by state

Export is permitted from any state but the generated `ai_agent_brief.md` carries different framing language depending on state:

| State at export | AI-Agent Brief opening line |
| --- | --- |
| Draft | "DRAFT export — this package has unresolved validation or unsaved edits. Downstream implementing agents should treat this as a preview." |
| Validated | "Validated export — this package has passed validation with no Blockers or unacknowledged Errors. Suitable for downstream implementation, pending human approval." |
| Approved | "Approved export — this package has been validated and explicitly approved by the author. Suitable for downstream implementation." |

The body of the brief is unchanged across states. Only the opening framing changes. Downstream agents reading the brief know whether to trust it as authoritative or as a preview.

The Validation Report (`validation/report.json`) is always exported regardless of state; consumers can inspect it directly.

## 11. Change Record kinds related to state

Append to the kinds listed in [09_glossary.md](09_glossary.md) §5.6:

| Kind | When |
| --- | --- |
| `validation_run` | Every Validate click (regardless of outcome). |
| `state_advanced_to_validated` | Validation outcome promotes state. |
| `state_advanced_to_approved` | Author completes the Approve confirm. |
| `state_demoted_to_draft` | Any edit while state ≠ Draft. |
| `error_acknowledged` | Author acknowledges a specific Error. |
| `error_unacknowledged` | Author removes an acknowledgement. |
| `package_exported` | Export action runs (regardless of state). |

The Change Log allows downstream readers to audit how a package reached its current state — which validations passed, which errors were acknowledged with what rationale, when approval was granted.

## 12. Edge cases

### 12.1 Load a package whose manifest state contradicts its cached findings

On load, if `manifest.packageState === "Validated"` but `validation/findings.json` contains Blockers or unacknowledged Errors:
- Demote state to Draft.
- Append a Change Record `state_demoted_to_draft` with rationale "State on disk inconsistent with cached findings."
- Banner notification (see [15_ui_states_and_feedback.md](15_ui_states_and_feedback.md) §3.4) informs the author.

### 12.2 Load a package whose manifest is missing `packageState`

Default to Draft. No banner needed.

### 12.3 Approval then immediate edit

The edit succeeds and demotes to Draft. The previous Approved state is recorded in the Change Log; the package can be re-validated and re-approved as a fresh decision.

### 12.4 Two consecutive Approve attempts

The second is a no-op (Approve action is disabled while already Approved). Top Bar greys the button with tooltip "Already Approved".

### 12.5 Cross-Frame validation triggering different states

Validation runs at the package scope, not the Frame scope. There is no Frame-level state. A single Blocker in any Frame keeps the whole package at Draft.

## 13. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | New package defaults to Draft | Create a new package; manifest `packageState` is `"Draft"`. |
| 2 | Validate with 0 Blockers / 0 unack-Errors → Validated | Validate; pill shows Validated; manifest persisted. |
| 3 | Validate with a Blocker → stays Draft | Introduce a Blocker; Validate; pill stays Draft. |
| 4 | Acknowledge an Error | Click Acknowledge on an Error; rationale form opens; submit; finding shows ✓; next Validate can advance. |
| 5 | Approve requires "approve" string | Click Approve; confirm modal appears; Confirm button disabled until "approve" typed. |
| 6 | Approve advances state | Type "approve"; confirm; pill becomes Approved. |
| 7 | Edit while Approved → Draft | Make any edit; state demotes to Draft; Change Record `state_demoted_to_draft` appended. |
| 8 | Approve action disabled when Validated → false | Approve while not Validated; button is grey; tooltip explains. |
| 9 | Export from Draft | Export; brief opens with "DRAFT export — ..." |
| 10 | Export from Approved | Export; brief opens with "Approved export — ..." |
| 11 | Manifest state persisted | Set state to Validated; save; close workbench; reopen; pill still shows Validated. |
| 12 | Inconsistent state on load | Manually edit `findings.json` to include a Blocker but leave `manifest.packageState: "Validated"`; load; state demotes to Draft + banner. |
| 13 | Change Log captures every transition | Validate + Approve + Edit + Re-validate sequence produces records: `validation_run`, `state_advanced_to_validated`, `package_approved` (or `state_advanced_to_approved`), `state_demoted_to_draft`, `validation_run`. |
| 14 | Ephemeral edits do not demote | Pan / zoom / select / change Tool while Validated; state stays Validated; no Change Record. |
| 15 | applyEdit reports editClass | Programmatic test: `applyEdit(pkg, moveEdit).editClass === "schema"`; `applyEdit(pkg, selectionEdit).editClass === "ephemeral"`. |
| 16 | Concurrent edit + Validate race | Begin a long Validate (artificially slow); interleave an edit; state ends at Draft (edit wins over the in-flight validation). |
