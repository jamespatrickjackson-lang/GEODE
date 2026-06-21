# Dev Mode Inspector — Scoped Controls, Clickable Labels, Reorder, Dev Save

Date: 2026-06-17
Author: Claude (Opus 4.8)
Status: Definition + first audit. NO code changes. Implementation on hold per
operator request.

## Trigger

Operator request (paraphrased from intent, original wording partly truncated):

1. Pressing `d` enters dev mode. Clicking an element currently surfaces a large
   list of variables. That full list is unwanted. Only the variables associated
   with the clicked container should appear. If another container's padding (or
   other property) affects the clicked one, that related variable may also be
   listed. Scoping must be dynamic, derived from the clicked target.
2. A back-panel container may not be directly clickable (children sit on top).
   The main container's name should appear beside it; clicking that name selects
   the container and surfaces its variables.
3. Figma-style direct manipulation of order: click-and-hold a subcontainer,
   button, or other item and drag to change its order, for quick reordering.
4. A dev-mode save control should appear so the operator can decide whether to
   persist dev-mode changes or not.

Last sentence of the request was truncated ("and m"). Item 4 wording and any
fifth ask need operator confirmation (see Open Questions).

## Current Implementation Reality

Single component: `src/editor/DevModeInspector.tsx` (~1,896 lines), mounted in
`src/editor/EditorRoot.tsx:1556` as `<DevModeInspector enabled
onEnabledChange editorSettings={editorChromeSettings}
onEditorSettingsChange={patchEditorChrome} />`.

Key mechanics:

- Toggle: `keydown` on `d` (no modifier, not while typing) flips `enabled`
  (DevModeInspector.tsx:128-151).
- Hover/click resolution: `inspectAtPoint` (266) walks from the event target up
  to the nearest `[data-dev-container="true"]`, else nearest `[data-dev-source]`,
  else a React `_debugSource` fallback (`readReactDebugSource`, 1523). It also
  finds a text node hit (`findTextHit`, 1353).
- Hover paints outline + tooltip; click locks (`onClick`, 164-172) and opens
  `DevContainerControlPanel`.
- Container outlines: `collectContainerOutlines` (1152) enumerates ALL
  `[data-dev-container="true"]` in viewport and draws each as a rectangle plus a
  leader line and a name label (`ContainerOutline`, 359). Labels are
  `pointerEvents: "none"` (containerLabelStyle, 1621-1637).
- Markers in the tree: `data-dev-container`, `data-dev-container-type`,
  `data-dev-container-name`, `data-dev-container-scope`, `data-dev-source`,
  `data-dev-text-source`, `data-dev-padding-source` are applied across 13 files,
  116 occurrences (e.g. `EnvironmentScenePanel.tsx`, `PagePanel.tsx`,
  `LayerPanel.tsx`, `layout/LayoutControls.tsx`).

The "big log list" is `DevContainerControlPanel` (412-801). It renders a FIXED,
GLOBAL control set regardless of which container was clicked:

- "Padding - bars": `sectionMarginXPx`, `sectionGapYPx`, `topBarBottomGapPx`,
  `barRadiusPx`, `topBarHeightPx`, `pillTextInsetPx`.
- "Padding - body": `nestedBarHeightPx`, `containerGapPx`,
  `containerBodyIndentPx`, `pageListIndentPx`, `scrollEndPaddingPx`,
  `saveFooterGapPx`, `saveIconSizePx`.
- "Alignment": `containerAlignItems`, `containerJustifyContent`.
- "Low-level chrome": Panel (7 ranges), Header (~13 controls), Sliders (2).
- "Text": live text + font controls bound to the resolved text element.

Every one of these is the same for every clicked target. They are not scoped to
the clicked container. That is the source of the "mess."

### Two distinct persistence paths today (matters for Item 4)

- Layout/chrome controls call `onPatch` -> `patchEditorChrome`
  (EditorRoot.tsx:924-938) -> `setEnvScene({ gui: { editor: { ...patch } } })`.
  These DO enter editor state, mark `state.dirty`, and persist via the normal
  save flow (`commitPending`, Ctrl/Cmd+S at EditorRoot.tsx:1257-1269; footer save
  button around 1604-1662).
- Text edits (`writeEditableText`, 1234; `applyTextStyle`, 1276) mutate the live
  DOM node's `textContent` / inline `style` directly. These do NOT go through
  editor state, do NOT mark dirty, and have NO persistence path. They are lost on
  reload. This is the gap Item 4's "save or not" most directly exposes.

## Per-Requirement Audit

### Item 1 — Scope variables to the clicked container (dynamic)

Finding: there is currently no mapping from a clicked container to "the variables
that affect it." `DevContainerControlPanel` is a hand-authored superset. The
`data-dev-container-type` / `data-dev-container` / `data-dev-source` attributes
exist and could key such a mapping, but no registry consumes them for control
selection.

Gap to close:
- A descriptor registry keyed by container type (and/or source tag) that lists
  which `EditorChromeSettings` fields actually drive that container. Example: a
  top-bar pill container -> `topBarHeightPx`, `barRadiusPx`, `pillTextInsetPx`,
  `sectionMarginXPx`; the panel shell -> `panelWidthPx`, `panelMarginPx`,
  `panelCornerRadiusPx`, etc.
- "If another container's padding affects it, list that too": needs an
  adjacency/parent rule. Candidate source of truth is the box model already
  computed in `readBoxModel` (1412) plus the ancestor chain — the panel can
  detect that the clicked element's offset is produced by a parent container's
  `containerBodyIndentPx` / `containerGapPx` and surface that parent's field as a
  secondary, labeled group ("inherited from <parent>").
- Constraint: these controls map to editor-backed fields governed by the editor
  control manifest. Reorganizing which controls render where, or adding/removing
  control surfaces, must go through `docs/dev-context/editor-control-manifest.json`
  and `docs/dev-context/Editor-Control-Manifest-Policy.md`. Scoping the existing
  controls per container is a presentation change over the same manifest ids; any
  NEW field or removed control needs a manifest entry first.

### Item 2 — Clickable container name beside an unclickable back panel

Finding: the leader-line name labels already exist (`ContainerOutline`, 359;
`containerLabelStyle`). They are non-interactive (`pointerEvents: "none"`). The
back-panel-not-clickable problem is real because children intercept the pointer,
and `inspectAtPoint` resolves to the nearest ancestor container of the event
target — it cannot reach a sibling/behind container the pointer never lands on.

Gap to close:
- Make the outline labels interactive: clicking a label locks that specific
  container (set `locked` to that outline's element) and opens its scoped panel.
- The label already carries `outline.element`; wiring a click handler that builds
  a `HoverInfo` from that element is the mechanism. Must keep label clicks out of
  the global `onClick` capture path so they do not re-resolve to a child
  (`isDevModeControlTarget` pattern, 1058, already excludes
  `[data-dev-mode-control]`; labels would need an equivalent guard or be marked as
  dev-mode control surfaces).
- Z-order/overlap: when multiple container labels stack, define disambiguation
  (e.g. clicking cycles, or hover-raises). Needs a decision.

### Item 3 — Figma-style drag-to-reorder (click-and-hold)

Finding: this is the largest new capability and the least supported today. Dev
mode has no concept of ordered child collections. DOM order is produced by React
render order, which is driven by the underlying data arrays (page order, section
order, layer order, control rows), NOT by anything dev mode can currently
reorder. Direct DOM reordering would not persist and would desync from React on
the next render.

Gap to close / unknowns:
- Reorder must target the backing ordered model, not the DOM. Need to enumerate
  which containers represent a genuine ordered, persistable list and what field
  backs each (candidates: page list / `pageOrder`, section order, layer order,
  overlay order, sidebar group order). NOT every "subcontainer, button, or item"
  is reorderable — many are fixed source-ordered structure.
- Hard constraint (CLAUDE.md): no fix may key on live `pageOrder` discovery,
  page ids, page titles, page indexes, or fixture pairs for app behavior. A
  reorder feature that writes page order is a deliberate authoring action on
  user data — distinct from a behavior fix — but the IMPLEMENTATION and any tests
  must use the reusable "ordered collection" behavior family with synthetic
  fixtures, never live deck state as proof.
- Persistence: reordering page/section/overlay order writes through the same
  editor-state -> dirty -> Vite dev save plugin path. Reordering must mark dirty
  and obey Item 4's save gate. Manifest-backed control rows that reorder would
  need manifest support.
- Interaction model: "click and hold" conflicts with the current click-to-lock
  handler (164). A press-and-hold (drag threshold) vs click (select) distinction
  is needed, plus a drag ghost, drop targets, and an order-commit step.

### Item 4 — Dev-mode save control

Finding: a save flow already exists for chrome/layout patches (dirty set +
footer save + Ctrl/Cmd+S). The missing piece is (a) an explicit, dev-mode-scoped
save affordance and (b) a persistence path for the DOM-only text/style edits that
currently evaporate on reload.

Gap to close / decisions:
- Define WHAT a "dev save" commits: only the chrome/layout patches already in the
  dirty set, or also the live text/style edits (`writeEditableText`,
  `applyTextStyle`) which today have no backing field?
- If text/style edits are to persist, they need editor-backed fields (new
  manifest ids) — a non-trivial addition, not a presentation change.
- "decide to save or not" implies a discard path: dev-mode edits should be
  revertable without saving. Chrome patches currently apply immediately to live
  state; a discard would need a snapshot/rollback boundary entered on dev-mode
  open.

## Constraints That Bound Any Implementation

- Editor control manifest guard: `docs/dev-context/editor-control-manifest.json`
  + `docs/dev-context/Editor-Control-Manifest-Policy.md` govern add/move/
  rename/hide/remove of sidebar/editor controls and backed fields. Scoped
  re-presentation of existing controls is allowed over existing ids; new fields
  (text persistence, reorder fields) require manifest entries first.
- Page-agnostic / page-to-page false-fix ban (CLAUDE.md): reorder and any tests
  must use synthetic fixtures and the reusable "ordered collection" /
  "effective-state" families. No live `pageOrder`, page id, title, index, or
  page-pair coupling as proof of app behavior.
- Persistence architecture lock: keep the dev-only Vite plugin + on-disk
  `projects/<project>/` path. No IndexedDB/LocalStorage/backend swap.
- Output/UI standards: dev-mode chrome already uses `styles.ts` material/label
  tokens and `TransientSlider`; new surfaces should reuse them.

## Open Questions (operator decision needed before a fix plan)

1. Item 4 scope: should "dev save" persist (a) only chrome/layout patches,
   (b) also live text edits, (c) also reorder changes — and should non-saved dev
   edits be discardable via a revert/rollback?
2. Item 1 secondary controls: when a parent container's padding affects the
   clicked one, show those parent fields inline as a read-with-edit "inherited"
   group, or just reference/jump to the parent?
3. Item 3 reorder targets: confirm which collections are in scope first
   (pages? sections? layers? overlays? sidebar groups? control rows?). Likely
   start with one well-defined ordered list rather than "any item."
4. Item 2 overlap behavior when multiple container labels stack on a small area.
5. The truncated trailing ask in the request ("...save or not. ... and m") —
   confirm whether a fifth requirement was intended.

## Operator Decisions (2026-06-17)

Answers to the open questions, logged verbatim-in-intent:

1. Dev-save scope = SAVE ALL (chrome/layout patches, live text + style edits, and
   reorder changes). Unsaved dev edits CAN be discarded. -> requires a dev-mode
   session snapshot/rollback boundary and a persistence path for text/style edits
   that today only mutate the DOM.
2. Inherited/affecting controls from a parent (e.g. padding that affects the
   clicked container) are shown INLINE, under a different heading from the
   clicked container's own controls.
3. Reorder scope = ALL reorderable collections.
4. Container name labels must NOT stack/overlap; collision handling is required.
5. No fifth requirement — request was complete; trailing truncation was noise.

Directive: PLAN ONLY. Log all decisions and findings. No implementation.

## Proposed Direction (NOT implemented — for a later plan)

Sequencing by risk, smallest first:

1. Item 2 (clickable labels): low risk, reuses existing outline/label geometry
   and lock mechanism. Make labels dev-mode control surfaces and lock their
   `outline.element` on click.
2. Item 1 (scoped panel): introduce a container-type -> control-descriptor
   registry (over existing manifest ids); render only matching groups, plus a
   computed "inherited padding/layout" group derived from `readBoxModel` + the
   ancestor chain. Presentation change over existing fields; manifest guard for
   any new field.
3. Item 4 (dev save + discard): add a dev-mode snapshot boundary on open, a dev
   save/discard control, and decide text-edit persistence (manifest-backed
   fields if yes).
4. Item 3 (drag-reorder): largest. Build an "ordered collection" reorder
   primitive bound to one confirmed backing list, with press-and-hold vs click
   disambiguation, drag ghost, drop commit -> dirty -> save. Synthetic-fixture
   tests only.

No edits to `DevModeInspector.tsx`, `EditorRoot.tsx`, the manifest, or any
project fixtures have been made. Awaiting operator answers on the open questions
before authoring a fix plan.
