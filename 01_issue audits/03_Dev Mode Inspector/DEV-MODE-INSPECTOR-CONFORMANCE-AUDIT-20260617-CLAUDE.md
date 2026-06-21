# Dev Mode Inspector — Conformance Audit (Code / Logic / Docs vs Landed Decisions)

Date: 2026-06-17
Author: Claude (Opus 4.8)
Status: Audit only. No feature code changed. Guardrail docs (manifest note +
policy section) were added per the R2 resolution; verified with
`npm run check:editor-controls` (passed, 164 entries, 48 source ids).

Companions: `DEV-MODE-INSPECTOR-SCOPED-CONTROLS-AUDIT-20260617-CLAUDE.md`
(findings + decisions), `DEV-MODE-INSPECTOR-FIX-PLAN-20260617-CLAUDE.md` (plan).

## Landed Decisions Under Audit

- D1 dev save = save ALL (chrome/layout + text/style + reorder); discardable.
- D2 affecting parent/sibling controls inline, separate heading.
- D3 reorder ALL collections.
- D4 container labels must not stack.
- D5 scope = these four items only.
- R1 text persistence tag-required (LOCKED).
- R2 sidebar-structure reorder gated by `devModeReorderGuard` (LOCKED).

Verdict legend: CONFORMS (code/docs already match), GAP (must be built; no
conflict), CONFLICT (current code/logic actively contradicts the decision).

## Code / Logic Conformance

### D1 — Save all, discardable

- Current: chrome/layout edits route `patchEditorChrome`
  (EditorRoot.tsx:924-938) -> `setEnvScene` -> editor dirty set -> save
  (`commitPending`, Ctrl/Cmd+S 1257-1269, footer save 1604-1662). PARTIAL match
  for the chrome slice.
- Current CONFLICT: text/style edits call `writeEditableText`
  (DevModeInspector.tsx:1234) and `applyTextStyle` (1276), which mutate the live
  DOM node only — no editor state, no dirty mark, no persistence, lost on reload.
  "Save all" cannot include them as written.
- Current GAP: no dev-mode session snapshot exists, so "discard" has nothing to
  roll back to; chrome edits apply to live state immediately and irreversibly
  within the session.
- Required: S1 session snapshot/rollback boundary; S4 backing store so text/style
  enters the dirty/save path; a dev Save/Discard control.

### D2 — Inherited controls inline, separate heading

- Current CONFLICT (by omission): `DevContainerControlPanel`
  (DevModeInspector.tsx:412-801) renders one fixed GLOBAL control superset for
  every clicked container. There is no per-container scoping and no inherited
  grouping at all.
- Asset available: `readBoxModel` (1412) already computes padding/content boxes;
  the ancestor `data-dev-container` chain is walkable. These support deriving an
  "inherited from <ancestor>" group.
- Required: S2 descriptor registry + panel rewrite to render matched groups plus
  a separate inherited heading. Re-presentation over existing manifest ids.

### D3 — Reorder all collections

- Current GAP: dev mode has no reorder capability. No `data-dev-order-*` markers
  exist anywhere (grep: 0 matches).
- Dispatch reality (verified): only PAGE reorder dispatch exists —
  `reorderPage(pageId, "up"|"down")` and group-aware `movePageBlock`
  (EditorContext.tsx:165, DEC-079), step-wise up/down, NOT arbitrary index. No
  layer / overlay / section arbitrary-index reorder dispatch exists.
- Current CONFLICT (interaction): the global capture `onClick` locks on press
  (DevModeInspector.tsx:164-172); a press-and-hold drag would collide with
  click-to-lock unless a drag threshold is introduced.
- Required: S3 reorder primitive + group registry; either map drag to repeated
  existing up/down steps or add arbitrary-index/new dispatches; press-hold vs
  click disambiguation.

### D4 — Labels must not stack

- Current CONFLICT: `collectContainerOutlines` (1152) enumerates ALL in-viewport
  containers and `containerLabelGeometry` (1062) places each label by the
  container's own rect with no collision avoidance — dense container regions
  overlap labels today. Labels are also `pointerEvents:"none"`
  (containerLabelStyle, 1621-1637), so they cannot be clicked (also blocks
  item 2).
- Required: collision-resolving label layout (lane-packing / nudge / collapse to
  count chip) and interactive labels marked as dev-mode control surfaces.

### D5 — Scope = four items only

- CONFORMS: plan and audit cover exactly items 1-4; no extra surface proposed.

### R1 — Tag-required text persistence

- Current: tags exist and are resolvable — `data-dev-text-source` /
  `data-dev-source` are read in `findTextHit` (1353), `findPrimaryTextElement`
  (1197). 116 marker occurrences across 13 files. Mechanism to key persistence on
  tags is feasible.
- GAP: no persistence consumes them yet; untagged-edit "session-only" notice does
  not exist.
- CONFORMS in approach: keys chosen are the stable author-assigned attributes the
  code already relies on.

### R2 — Sidebar-structure reorder guard

- CONFORMS (docs landed): `devModeReorderGuard` added to
  `editor-control-manifest.json`; "Dev-Mode Reorder Guard" section added to
  `Editor-Control-Manifest-Policy.md`; guard check passes.
- Logic note: `tools/check-editor-control-manifest.mjs` fires the
  companion-update error only when a PROTECTED source file changes without a
  manifest companion change. `DevModeInspector.tsx` is NOT in
  `protectedSourceFiles`; `EditorRoot.tsx`, `PagePanel.tsx`, `LayerPanel.tsx`,
  `OverlayPanel.tsx` ARE. So Phases touching those panels carry the
  companion-update cost; editing only `DevModeInspector.tsx` does not.

## Docs Conformance

- CLAUDE.md page-to-page false-fix ban: CONFORMS — plan binds reorder + tests to
  the synthetic "ordered collection" family; no live pageOrder/id/title/index or
  page-pair proof. Page reorder writing user data is authoring, kept distinct
  from behavior fixes.
- CLAUDE.md authoring-persistence lock (Vite plugin -> `projects/<project>/`):
  CONFORMS — S1/S4 reuse editor state + existing save path; no IndexedDB/
  LocalStorage/backend.
- Editor-Control-Manifest-Policy.md: CONFORMS and EXTENDED — new Dev-Mode Reorder
  Guard section; existing "Page Manager Guard" already documents the working
  `aria-label="Drag page to reorder"` grip the reorder primitive can model on.
- editor-control-manifest.json: CONFORMS — new top-level `devModeReorderGuard`
  note; validator tolerates unknown top-level keys (only `schemaVersion`,
  `entries`, `protectedSourceFiles`, `requiredCompanionPaths` are shape-checked);
  no new entry/source-anchor added, so no anchor obligation.
- src/editor/CLAUDE.md file-size map: NOTE — `DevModeInspector.tsx` is listed as
  "safe to read whole," but it is ~1,896 lines. Item 1-4 work will grow it;
  splitting (registry, reorder primitive, override store, label layout into
  modules) is advisable to keep it readable. Not a conflict; a maintainability
  flag.

## Net Assessment

- Conflicts to clear (active contradictions): D1 (DOM-only text edits not
  persistable; no snapshot for discard), D2 (fixed global superset), D4 (no
  collision avoidance; labels non-interactive), D3 interaction (click-lock vs
  press-hold).
- Pure gaps (build, no contradiction): D3 reorder primitive + dispatches, R1
  persistence wiring + untagged notice, S1/S2/S4 infrastructure.
- Already conforming: D5 scope, R2 guard (docs landed + check green), persistence
  and page-agnostic doc alignment.
- Reusable assets reducing build cost: `readBoxModel` (inherited derivation),
  existing tag readers (R1 keys), `patchEditorChrome`/dirty/save (D1 chrome
  slice), `reorderPage`/`movePageBlock` (D3 pages), `isDevModeControlTarget`
  pattern (label/drag event isolation), Page Manager grip (D3 reference model).

## Outstanding Items

- None blocking. All five open questions and both flags are resolved/locked.
- Build-time-only decisions (not operator-blocking): snapshot-on-open vs lazy
  (recommend lazy); drag-to-arbitrary-index vs repeated up/down steps for pages
  (recommend arbitrary-index dispatches); whether to split `DevModeInspector.tsx`
  during Phase work (recommend yes).

## Status

PLAN + AUDIT complete. Feature code untouched
(`DevModeInspector.tsx`, `EditorRoot.tsx`, panels, types, fixtures). Only
guardrail docs changed (manifest note + policy section), guard check green.
Ready to begin Phase 1 on go-ahead.
