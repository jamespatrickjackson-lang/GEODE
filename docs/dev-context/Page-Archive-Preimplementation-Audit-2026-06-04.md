# Page Archive Preimplementation Audit

Status: historical pre-implementation audit. Superseded for current behavior by
DEC-094, DEC-095, `src/pages/loadPages.ts`, `src/editor/EditorContext.tsx`,
`src/editor/PagePanel.tsx`, `src/pages/PageController.tsx`,
`tools/validate-project-pages.mjs`, and `vite.config.ts`.

Recorded on 2026-06-04.

Note: Original findings below intentionally preserve the preimplementation
snapshot. Do not treat "implementation must" language in this file as current
source state without checking the superseding files listed above.

## Intent Locked

The staff Page Archive is an editor-side shelf for draft or alternate pages. It
is not audience-facing and does not reuse `pages/_archive/`, which remains
delete recovery. Archived pages remain selectable, previewable, and editable,
but are not part of presenter next/previous navigation or built client/project
output.

The durable model is `project.json` `archivedPageOrder?: string[]` alongside
the existing active `pageOrder`.

## Loader And State Shape

Current loader behavior reads only ids in `manifest.pageOrder` and returns a
single `pages` array. Implementation must load the union of `pageOrder` and
`archivedPageOrder`, preserve active order and archive order separately, and
make all loaded pages available to Sub Master inheritance resolution.

Implementation should not enumerate `pages/` to infer archive membership. The
manifest lists remain the source of truth. Existing files in `pages/_archive/`
must not be imported into the staff archive.

Final code audit evidence:

- `src/pages/types.ts` `ProjectManifest` has `pageOrder` only; there is no
  typed `archivedPageOrder` field yet.
- `src/pages/loadPages.ts` fetches pages by `manifest.pageOrder.map(...)` only
  and returns one `LoadedProject.pages` array.
- `src/editor/types.ts` has one `EditorState.pages` array and no active/archive
  projections or all-pages lookup.
- `src/editor/EditorContext.tsx` reducer paths for add, delete, reorder, and
  drag-move mutate `manifest.pageOrder` only; persistence writes selected dirty
  pages out of `state.pages`.

## Build And Export Filtering

Archived page JSON stays in the dev/editor workspace as ordinary
`pages/<id>.json` files, but build/export output must ship active pages only.
Any code path that copies `projects/` into a static output or client-facing
package must filter page JSON against `manifest.pageOrder` and omit
archive-only ids from output. `archivedPageOrder` is authoring state and should
not create audience-visible page payloads.

Final code audit evidence: `vite.config.ts` `copyProjectsPlugin()` currently
copies the full `projects/` tree recursively, filtering raw data and extracted
images but not page JSON by `pageOrder`. Archive implementation must add a
manifest-aware copy filter before archive-only page files can exist safely.

## Controller Index Risk

`PageControllerProvider` currently receives `state.pages`, and several editor
surfaces compare `state.pages.findIndex(...)` to `PageController.currentIndex`.
Archived pages being editable but excluded from navigation means active
controller indexes can no longer be assumed to match all editable pages.

Implementation must introduce an active-page projection or index mapper before
allowing archived selection/preview. Presenter navigation, keyboard next/prev,
NavControls, and transition frames must use active pages only. Editor controls
for an archived selection must resolve against the selected archived page
without treating its all-pages index as a controller index.

Final code audit evidence:

- `src/editor/EditorChrome.tsx` passes `state.pages` directly to
  `PageControllerProvider` and mirrors `pages[currentIndex]?.id` back to editor
  selection.
- `src/editor/authoringTarget.ts` determines landed selection by numeric
  `selectedPageIndex === currentIndex`.
- `src/editor/PagePanel.tsx`, `src/editor/LayerPanel.tsx`,
  `src/editor/LayerPanelGroups.tsx`, and `src/editor/EditorRoot.tsx` compare
  selected page indexes against `PageController.currentIndex`.
- `src/pages/PageController.tsx` stores `pagesRef`, `currentIndex`, and
  `targetIndex` as navigation state and uses `pages` for `goto`, keyboard
  next/previous, transition source/target pages, and context value.

## Sub Master Archive Inheritance

DEC-094 allows an archived Sub Master to remain the inheritance source for active
children. The resolver must therefore search active plus archived pages when a
child references `parentMasterId`.

Active grouping still applies when the master is active. When the master is
archived, active children may appear outside a visible master block and must
retain their `parentMasterId`. Making a child into a new Sub Master remains the
authored escape hatch for breaking the relationship.

Final code audit evidence: both `src/pages/effective.ts`
`resolveEnvironmentForPage(...)` and `src/pages/PageController.tsx`
`resolvePresentationState(...)` find a child's parent master in the passed
`pages` collection. If the controller receives active pages only, these
resolvers need a separate all-editable-pages lookup for archived masters.

## PagePanel Drag And Reveal Model

Current drag targeting only detects active rows via `[data-page-id]` and uses
`MOVE_PAGE_BLOCK` for before/after active-page reorder. Implementation needs a
target model that can distinguish:

- active row before/after reorder
- Archive header drop
- archived row before/after reorder
- archived row restore into active Pages

Dropping on the Archive header archives without toggling reveal state. Clicking
the header toggles reveal/collapse. Drag visuals should reuse the existing
source-row opacity, floating preview, and insertion-line language.

Relationship badges are reveal controls, not selection controls. Clicking `C`
reveals and pulses the linked master row, opening Archive first if needed.
Clicking `M` reveals and pulses the first linked child row, preferring active
Pages before archived rows.

Final code audit evidence:

- `src/editor/PagePanel.tsx` renders rows by `state.pages.map(...)` and
  calculates row metadata from that same single array.
- Current drag targeting finds only `[data-page-id]` rows and dispatches
  `movePageBlock(pageId, target.pageId, target.insertPosition)`.
- The add-page path calculates the next navigation index from
  `state.pages.length`; the delete guard disables only when
  `state.pages.length <= 1`. Both need active-page counts when archive pages
  exist.
- `computePageRowMetas(...)` derives Sub Master row labels and parent indexes
  from one contiguous page list. Archived-master/active-child display needs a
  relationship lookup that is not dependent on visible contiguity.

## Validation And Test Gaps

Current focused Page Manager tests cover footer geometry, active row drag,
floating drag preview, and insertion lines. New coverage is needed for:

- `archivedPageOrder` loading and persistence shape
- archived pages excluded from presenter navigation
- archived page selection/preview/edit routing
- active-to-archive and archive-to-active drag/drop
- archived Sub Master inheritance for active children
- M/C reveal-only badge behavior and Archive auto-open
- build/export filtering that omits archived page JSON from client output

`npm run check:workspace` does not include `npm run check:pages`. Archive
implementation must run both when project/page wiring changes.

The editor control manifest should not receive active Archive ids until matching
source anchors exist. The implementation phase should add manifest entries and
source anchors together for `page.archive.toggle` and the relationship badge
control family.

Final code audit evidence: `tools/validate-project-pages.mjs` validates only
`manifest.pageOrder` and active page files today. It needs checks for
`archivedPageOrder` type, missing archived page files, duplicate ids across
active/archive lists, archive-only id exclusion from built output fixtures, and
archived-master inheritance references.

## Stale Or Superseded Docs Found

- `docs/schemas/page.json.md` previously said every page id must be in
  `pageOrder`. Replacement: page ids belong to either `pageOrder` or
  `archivedPageOrder`.
- `docs/schemas/page.json.md` previously described `pages/_archive/` as the
  only archive-like page lifecycle. Replacement: `pages/_archive/` remains
  delete recovery only; staff Page Archive is manifest-backed.
- `docs/02-architecture.md` previously described Sub Master blocks as always
  contiguous in `pageOrder`. Replacement: active masters keep active block
  behavior, but an archived master may remain an inheritance source for active
  children.
- `docs/dev-context/UI-Visual-Standards.md` previously used `M` and `C` only as
  footer action labels. Replacement: row-level `M`/`C` badges are relationship
  reveal controls that pulse targets without selecting them.
- Existing build-copy behavior copies full project folders. Replacement:
  implementation must filter built client/project output so `archivedPageOrder`
  pages remain authoring-only.
- `docs/dev-context/Runtime-Loading-Policy.md` described `pageOrder` as the
  only page list. Replacement: current source remains `pageOrder`-only, but
  DEC-094 requires active plus archived editor loading while presenter
  navigation stays `pageOrder`-only.

## Hold

No source implementation has been performed in this audit phase. Do not add the
Archive UI, reducer actions, loader behavior, test fixtures, or project data
changes until this documentation/audit pass has been reviewed.
