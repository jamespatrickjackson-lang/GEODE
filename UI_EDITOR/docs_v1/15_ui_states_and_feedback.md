# v1 UI States and Feedback

## 1. Goal

Define every non-default UI state the workbench can be in and the feedback the author receives at each state transition. Without this doc, Codex will invent loading / empty / error patterns inconsistently. With it, every state is reachable and observable, and the agent automation runbook can verify each.

## 2. State catalogue

| State | What it means | Where it appears | What the author sees |
| --- | --- | --- | --- |
| **Boot** | Workbench loaded, no package selected yet | Whole shell | Package Browser populated; Canvas blank with placeholder text "Select a package to begin." |
| **Loading** | A package read is in flight | Canvas + status indicator | Canvas blank; small spinner top-right; package browser entry shows "Loading..." after its name. |
| **Loaded — empty package** | Package opened but has 0 Frames | Canvas | Canvas shows "This package has no Frames yet. Use the New Frame action above to create one." with a single button "New Frame". |
| **Loaded — empty Frame** | Frame opened but has 0 elements | Active Frame area | Frame border visible; centre text "This Frame is empty. Drag from the Library Panel or use a Tool to add elements." |
| **Loaded — populated** | Normal editing | Whole shell | Default working state. |
| **Selection — none** | No element selected | Properties Inspector | Inspector shows "No selection. Click an element on the Canvas to inspect its properties." |
| **Selection — single** | One element selected | Properties Inspector + Layers Panel | Inspector renders the full property set; Layers Panel highlights the matching row. |
| **Selection — multiple** | More than one element selected | Properties Inspector + Layers Panel | Inspector renders shared properties only; per-element-differing properties show "Multiple values"; Layers Panel highlights all matching rows. |
| **Editing — drag** | Pointer-down drag in flight (Move / Resize / Container / Divider / Marquee) | Canvas | Cursor matches Tool; transient overlay shows preview shape; snap indicators render; smart guides render. |
| **Editing — inline text** | Inline text input has focus | Canvas | Element rendered as input; cursor in field; Tool palette disabled; Esc cancels, Enter / blur commits. |
| **Editing — refused** | An edit was blocked by a Restricted Surface rule | Toast + Validation Panel | Toast appears near the action source (3 s); Validation Panel surfaces the Blocker finding permanently. |
| **Saving** | Save in flight | Top Bar | Save button shows spinner + "Saving..." label; other actions disabled. |
| **Saved** | Save completed successfully | Top Bar | Save button briefly shows "Saved" (1 s) then reverts. `manifest.updatedAt` reflects new timestamp. |
| **Save failed** | Save returned an error from the Vite plugin | Top Bar + Modal | Save button shows error icon; modal opens with error message + Retry / Dismiss. Dirty bit stays set. |
| **Validating** | `runValidation` in flight | Validation Panel | Panel header shows spinner; findings list grayed out (showing last result) until complete. |
| **Validation complete** | Findings cached | Validation Panel | Panel header shows finding counts by Severity; list updates. |
| **Validation failed** | Validation threw an error (rare; shouldn't happen for pure rules) | Validation Panel | Panel shows error banner with the thrown message; Re-run button. |
| **Exporting** | Export in flight | Top Bar | Export button shows spinner + "Exporting..." |
| **Exported** | Export completed | Top Bar | Export button briefly shows "Exported" (1 s). Toast confirms path: "Exported to `packages/<id>/`". |
| **Profile change** | Author changes Device / Input / Use-Case Profile | Whole shell | Brief banner: "Profile changed. Validation may need to be re-run." with a Re-run button. |
| **Background swap** | Active Background Stress Test image swapped | Canvas | Background fades in over 200 ms; contrast rule re-evaluates if applicable. |
| **Tool change** | Active Tool changed | Canvas + Toolkit | Cursor changes; Toolkit highlights new active Tool. |
| **Package switch** | Author switches between packages in Package Browser | Whole shell | If current package is dirty, prompt "You have unsaved changes. Save / Discard / Cancel." Else, load the new package directly. |
| **Network offline** | Vite plugin endpoint unreachable (rare; localhost-only) | Top Bar | Top Bar shows red banner "Dev server lost. Saves will fail until restored." Save button disabled. |

## 3. Feedback patterns

### 3.1 Toast

- Position: bottom-right of the shell.
- Stack: up to 3 visible; older toasts dismissed via FIFO.
- Auto-dismiss timing:
  - Info: 2 s.
  - Suggestion: 3 s.
  - Warning: 4 s.
  - Error: 5 s.
  - Blocker: 6 s.
- Each toast has a close button (manual dismiss).
- Toast text format: `<severity icon> <one-line message>`. No long-form content in toasts; tap toast to focus the Validation Panel for details.
- Implemented in `src/shell/feedback/ToastStack.tsx`.

### 3.2 Modal

Reserve modals for **destructive** or **blocking** decisions only:

- Save failed (Retry / Dismiss).
- Switch packages with unsaved changes (Save / Discard / Cancel).
- Delete a Container that has children (Confirm + child count).
- Delete a Library Entry that has references (Confirm + reference count).
- Manual Approve transition (type "approve" to confirm).

Modal layout: centred overlay; backdrop dims rest of shell; Esc closes (treated as Cancel).

Implemented in `src/shell/feedback/Modal.tsx`.

### 3.3 Inline indicator

For non-blocking, non-toast feedback bound to a specific element:

- A Validation Finding for an element renders a small `!` badge in the corner of the element's Canvas rect (matching Severity colour).
- The badge is clickable → focuses the Validation Panel filtered to that element.
- A Save-failed for a specific file renders a yellow stripe on the affected Frame's chrome.
- A Sub Master row with stale snapshot (future v2 drift indicator) renders a "diverged" chip.

Implemented in `src/shell/canvas/SelectionLayer.tsx` for in-Canvas badges.

### 3.4 Status banner

Persistent banners that occupy a single row at the top of the shell (under the TopBar):

- "Dev server lost. Saves will fail until restored." (red)
- "Profile changed. Re-run validation." (yellow, with action button)
- "Package state advanced to Validated." (neutral, auto-dismiss after 5 s)

Banners stack vertically; max 2 visible. Older banners auto-dismiss.

Implemented in `src/shell/topBar/StatusBanner.tsx`.

## 4. Refusal feedback (Restricted Surface)

When `applyEdit` returns `{ ok: false, refused: true, findings }`, the shell:

1. Renders a 3 s Toast near the action source. The "action source" is:
   - For a Toolkit action: the Toolkit button (e.g. Move Tool).
   - For an Inspector edit: the field that triggered the edit.
   - For a Library drag: the drop point on the Canvas.
2. Appends each Blocker finding to the Validation Panel with the originating finding id.
3. Does NOT mutate state. Edits are atomic — refused edits leave state byte-identical.
4. Does NOT append a Change Record. Refused edits are not history.
5. Does NOT auto-clear the Blocker from the Validation Panel. Authors must dismiss or fix.

The Toast's message format: `Blocker: <finding.message>`. Clicking the Toast focuses the corresponding Properties Inspector field with the offending value highlighted.

## 5. Error feedback (Save / Export / Read failures)

When the Vite plugin returns an error:

1. The error response includes `{ ok: false, code: string, message: string, path?: string }`.
2. The shell shows a Modal (because the author cannot continue safely until they decide).
3. Modal text: `Save failed: <message>`. If `path` is present: `Affected file: <path>`.
4. Modal actions: `Retry` (re-attempt the same operation) and `Dismiss` (keep dirty state; user decides next).
5. The dirty bit stays set.
6. A Change Record is NOT appended for the failed save (it never happened).

## 6. Loading feedback

- Package read: spinner in Package Browser entry + Top Bar overall spinner.
- Validation: spinner in Validation Panel header; findings list grays.
- Export: Top Bar spinner.
- Background swap: 200 ms fade; no spinner (too fast).

All spinners are CSS-only (no JS animation loop). Spinner size: 14×14 px.

## 7. Empty states

Each major surface has an empty state:

- **Canvas — no package:** "Select a package to begin." + button "Browse packages".
- **Canvas — empty package:** "This package has no Frames yet." + button "New Frame".
- **Canvas — empty active Frame:** "This Frame is empty. Drag from the Library Panel or use a Tool to add elements." (no button; the affordances are already on the shell).
- **Layers Panel — no Selection / empty Frame:** "No layers."
- **Properties Inspector — no Selection:** "No selection."
- **Validation Panel — no findings:** "No findings. Click Validate to run." (with Validate button).
- **Library Panel — empty library:** "This library has no entries. Use the `+ Add` footer button to add one."

Empty-state text style: secondary text colour, 14 px, centred in available space. Buttons offered inline below.

## 8. State persistence

| State | Persisted across session? | Stored where |
| --- | --- | --- |
| Active package | Yes | localStorage `workbench.lastPackageId` |
| Active Frame | Yes | localStorage `workbench.activeFrameId.<packageId>` |
| Viewport (pan / zoom) | No | reset on package load |
| Selection | No | reset on package load |
| Active Tool | No | reset to `select` on package load |
| Snap settings (pixelGridSize, thresholdPx, toggles) | Yes | localStorage `workbench.snap` |
| Active background id | No | reset to `null` on package load |
| Active profile (device / input / use case) | Yes (per package) | written into the package manifest's `profileDefaults` on save |
| Dirty bit | No | resets on package load |
| Validation cache | Yes | written to package `validation/findings.json` on save |

localStorage keys are namespaced under `workbench.*` to avoid collision with anything else.

## 9. Accessibility

v1 minimum accessibility:

- All interactive elements have visible focus rings.
- Keyboard navigation through Toolkit, Properties Inspector fields, Library Panel.
- ARIA roles on Layers Panel (`role="tree"`), Validation Panel rows (`role="listitem"`).
- Modals trap focus until dismissed; Esc closes.
- Toasts are announced via `aria-live="polite"`.
- Validation Findings include screen-reader text describing severity and element.

Full WCAG compliance is **not** a v1 goal — the strict-accessibility rule pack is deferred to v2. But basic keyboard + screen-reader navigation must work.

## 10. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Boot state correct | Launch workbench with no package selected; placeholder text visible. |
| 2 | Loading state | Click a package; loading spinner appears; then loaded. |
| 3 | Empty package state | Open a package with 0 Frames; "This package has no Frames yet." visible. |
| 4 | Empty Frame state | Create a new Frame; "This Frame is empty." visible. |
| 5 | Multiple-selection inspector | Select 2 elements with different `name`; Inspector shows "Multiple values". |
| 6 | Refused edit toast | Try to delete a locked element; Toast appears for 3 s near Delete button. |
| 7 | Save failed modal | Simulate plugin error; Modal appears; Retry button visible. |
| 8 | Save success toast | Save completes; "Saved" briefly shown on button. |
| 9 | Tool switch updates cursor | Switch tools; cursor changes within one frame. |
| 10 | Package switch with dirty state | Make edit; switch packages; modal "Save / Discard / Cancel" appears. |
| 11 | localStorage persistence | Set snap pixel grid to 8; reload page; setting persists. |
| 12 | Profile change banner | Change Device Profile; banner appears with Re-run button. |
| 13 | Validation panel empty state | Open fresh package; click Validate; if 0 findings, show "No findings." |
| 14 | Inline element badge | Element has a Warning finding; badge visible at corner; click focuses Validation Panel. |
| 15 | Esc closes modal | Open modal; Esc dismisses. |
| 16 | Esc aborts drag | Begin Move drag; Esc; element returns to start; Move Tool stays active. |
| 17 | Save while saving | Try to click Save while a save is in flight; click is a no-op (button disabled). |
| 18 | Toast queue cap | Trigger > 3 toasts in succession; only newest 3 visible. |
| 19 | Inline text edit commit | Click `inline-editable-text`; type; blur; value commits; Change Record appended. |
| 20 | Inline text edit cancel | Click `inline-editable-text`; type; press Esc; value reverts; no Change Record. |
