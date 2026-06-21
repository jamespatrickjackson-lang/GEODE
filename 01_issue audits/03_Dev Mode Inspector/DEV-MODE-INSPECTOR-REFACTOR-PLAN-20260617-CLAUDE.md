# Dev Mode Inspector — Refactor / Split Plan + Engineering Recommendations

Date: 2026-06-17
Author: Claude (Opus 4.8)
Status: PLAN ONLY. No code changed. Companion to the audit + fix plan in this
folder.

## Why

`src/editor/DevModeInspector.tsx` is a single ~1,896-line module. The four-item
feature work (scoped panel, clickable/non-stacking labels, reorder, save-all)
adds four new infrastructure pieces (S1 session, S2 control registry, S3 reorder
primitive, S4 override store) plus a label-collision layout and a rewritten
control panel. Growing the single file past ~2,500 lines would put it in the same
"never read whole" bucket as the known monoliths. `src/editor/CLAUDE.md`
currently lists it under "safe to read whole" — that claim is already inaccurate
(it is ~1,896 lines) and the feature work makes it worse.

Editor-dir extraction convention (src/editor/CLAUDE.md): "No new editor
extraction file exceeds 800 lines." The split targets that ceiling.

## Constraint That Shapes The Split

- `DevModeInspector.tsx` is NOT in the manifest `protectedSourceFiles`, so
  extraction does not trip the editor-control manifest guard.
- `EditorRoot.tsx` (PROTECTED) imports `{ DevModeInspector } from
  "./DevModeInspector"` (EditorRoot.tsx:12). To avoid a protected-file edit (and
  its companion-update cost), KEEP the entry component at
  `src/editor/DevModeInspector.tsx` and extract everything else into a sibling
  `src/editor/devMode/` folder that the entry imports. Zero churn in EditorRoot.
- Pure mechanical move first; behavior identical; verify by typecheck/build.

## Current Content Map (for extraction boundaries)

Approximate line spans in the existing file:

- Orchestration shell: `DevModeInspector` + keydown/pointer/click effects +
  portal render (119-264).
- Inspection resolution: `inspectAtPoint` (266-345), `findTextHit` /
  `getTextNodeAtPoint` (1353-1398), `readReactDebugSource` / `shortenPath`
  (1523-1558), `describeElement` (1400-1410), `genericContainerType` (1188-1195),
  `findPrimaryTextElement` (1197-1222).
- Box model / geometry: `readBoxModel` (1412), `readPaddingHit`, `containsPoint`,
  `cssNumber`, `cleanText` (1412-1521).
- Outlines + labels: `collectContainerOutlines` (1152), `ContainerOutline` (359),
  `containerLabelGeometry` (1062), `BoxModelOverlay` (347).
- Control panel: `DevContainerControlPanel` (412-801, ~390 lines — largest block),
  `controlPanelPlacement` (1089-1146).
- Text controls: `DevTextControls` (829-909), `readTextDraft` / `applyTextStyle`
  / `writeEditableText` / `readEditableText` / `normalize*` / `cssColorToHex`
  (1224-1351).
- Control primitives: `DevControlGroup`, `DevRange`, `DevSelect`, `DevCheckbox`,
  `DevColorInput`, `DevTextField`, `ComputedValue` (803-1048).
- Types + constants: `HoverInfo`/`BoxModelInfo`/`RectLike`/`PaddingHit`/
  `ContainerOutlineInfo`/`ContainerLabelGeometry`, attribute names, option lists
  (15-117).
- Utilities: `isTypingTarget`, `isDevModeControlTarget`, `clampNumber`.
- Styles: the `*Style` const block (1560-1896, ~336 lines).

## Target Layout (`src/editor/devMode/`)

Entry stays put; the rest moves. Estimated sizes all < 800 lines.

- `src/editor/DevModeInspector.tsx` — thin entry: state, effects, composition,
  portal. Imports from `devMode/`. (~180 lines)
- `devMode/constants.ts` — attribute names (`data-dev-*`), option lists. (~60)
- `devMode/types.ts` — interfaces. (~80)
- `devMode/inspect.ts` — `inspectAtPoint`, text-hit, react-debug-source, describe,
  generic type, primary-text resolution. Pure-ish; DOM-reading only. (~280)
- `devMode/boxModel.ts` — box model, padding hit, geometry/number helpers. (~150)
- `devMode/containerOutlines.tsx` — collect + `ContainerOutline` + label geometry
  + `BoxModelOverlay`. Gains the D4 collision layout. (~250 -> ~350 post-feature)
- `devMode/ControlPanel.tsx` — `DevContainerControlPanel` + placement. Rewritten
  in Phase 2 to consume the registry. (~250 after scoping, down from 390)
- `devMode/textControls.tsx` — `DevTextControls` + text read/write/normalize.
  (~200)
- `devMode/controls.tsx` — `DevControlGroup`/`DevRange`/`DevSelect`/`DevCheckbox`/
  `DevColorInput`/`DevTextField`/`ComputedValue` primitives. (~180)
- `devMode/styles.ts` — dev-mode style consts (named `devMode/styles.ts` to avoid
  clashing with the existing `src/editor/styles.ts`). (~340)

New feature infrastructure lands as its own modules (built in the feature
phases, not in the mechanical split):

- `devMode/controlRegistry.ts` — S2: container-type/source -> field-id descriptor
  map + inherited-from-ancestor resolution (uses `boxModel`). (~200)
- `devMode/session.ts` — S1: snapshot / dev-dirty / discard / commit boundary.
  (~150)
- `devMode/overrideStore.ts` — S4: tag-keyed text/style persistence + untagged
  session-only handling. (~150)
- `devMode/reorder.ts` + `devMode/reorderRegistry.ts` — S3: drag primitive +
  group-key -> dispatch map. (~250 + ~120)

## Sequencing

Phase 0 (mechanical, BEFORE feature work): extract the STABLE, low-risk parts —
`types.ts`, `constants.ts`, `styles.ts`, `inspect.ts`, `boxModel.ts`,
`controls.tsx`, `textControls.tsx`. Leave `ControlPanel.tsx` and
`containerOutlines.tsx` in place if preferred, since Phase 2 (scoping) and
Phase 1 (labels) rewrite them anyway — extract them as part of those phases to
avoid a move-then-rewrite double edit.

Then per the fix plan:

- Phase 1 extracts/edits `containerOutlines.tsx` (labels interactive + D4
  collision).
- Phase 2 extracts/edits `ControlPanel.tsx` + adds `controlRegistry.ts`.
- Phase 3 adds `session.ts` + the Save/Discard control.
- Phase 4 adds `overrideStore.ts`; routes `textControls` writes through it.
- Phase 5 adds `reorder.ts` + `reorderRegistry.ts`.

Rationale: do not big-bang move all ten files at once when half are about to be
rewritten. Extract the genuinely stable helpers up front (they make every later
phase smaller and unit-testable), and fold the rewritten surfaces into their
owning phase.

## Companion Doc Update Required

- `src/editor/CLAUDE.md` file-size map: move `DevModeInspector.tsx` out of "safe
  to read whole" and add the `devMode/` module list once the split lands. This
  doc is not manifest-protected; update it in the same change as the extraction.

## Other Engineering Recommendations

- Testability dividend: keep `inspect.ts`, `boxModel.ts`, `controlRegistry.ts`
  (inherited derivation), `reorder.ts` (index math), and `overrideStore.ts` (key
  derivation) as pure/DOM-only modules with no React, so the synthetic-fixture
  tests the fix plan requires can target them directly without mounting the panel.
- Performance: `collectContainerOutlines` runs `querySelectorAll` +
  `getBoundingClientRect` over ALL containers on every render while hovering
  (DevModeInspector.tsx:1152). Adding D4 collision layout increases per-pass cost.
  Recommend recomputing outlines on lock / scroll / resize (throttled) rather than
  on every `pointermove`-driven render. Behavior-neutral optimization; schedule
  with Phase 1.
- Z-index ladder: the file hardcodes ~8 magic z-indexes (2147483641-648).
  Recommend a single `devMode/zIndex.ts` constant map to prevent drift as overlay
  layers (drag ghost, drop indicator, save bar) are added in Phases 1/3/5.
- Known fragility (document, do not fix now): `readReactDebugSource` depends on
  React's `_debugSource` dev fiber (DevModeInspector.tsx:1523), which is
  version-sensitive and dev-only. It is already a labeled fallback; note it in
  `devMode/inspect.ts` so a future React bump does not silently break source tags.
- Reorder dispatch consolidation (Phase 5): pages use step-wise
  `reorderPage`/`movePageBlock` (EditorContext.tsx:165, DEC-079); layers/overlays/
  sections have no arbitrary-index dispatch. Recommend adding a single
  arbitrary-index `moveWithinOrderedCollection`-style dispatch family in
  `EditorContext.tsx` (PROTECTED -> manifest companion) rather than translating
  drags into N up/down calls, so the reorder primitive has one clean contract.

## Build-Time Decisions (not operator-blocking; recommendations recorded)

- Session snapshot timing: LAZY on first dev edit (avoids snapshotting on
  inspect-only sessions).
- Reorder model: arbitrary-index dispatch (cleaner than repeated up/down).
- Extraction granularity: Phase 0 stable-helper extraction now; rewritten
  surfaces extracted within their phase.

## Status

PLAN ONLY. No `src/` files, manifest entries, or fixtures changed by this
document. The split is mechanical and behavior-neutral; feature phases proceed
per `DEV-MODE-INSPECTOR-FIX-PLAN-20260617-CLAUDE.md`.
