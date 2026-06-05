# Page Archive Implementation Plan

Status: historical implementation plan. Implemented on branch
`codex/page-archive-implementation`; current behavior is governed by DEC-094,
DEC-095, the active source files, validation tools, and UI docs.

Recorded on 2026-06-04.

Note: Original implementation-order language below is preserved as planning
history, not as a hold condition.

## Summary

Implement a staff-only Page Archive in the Pages panel. Archived pages remain
editable and previewable in the dev/editor workspace, but are excluded from
presenter navigation, audience playback, and built client/project output.

## Key Changes

- Add `archivedPageOrder?: string[]` to project manifest handling.
- Load active plus archived page ids into editor state while keeping active
  pages and archived pages as separate ordered views.
- Keep `pageOrder` as the only presenter navigation sequence.
- Preserve `pages/_archive/` as delete recovery; do not import it into the
  staff Page Archive.
- Add an Archive header below the Page Manager footer, aligned to the
  three-button footer column.
- Render archived rows as full page rows and support drag into and out of the
  Archive.
- Add row-level `M`/`C` relationship badges that reveal and pulse related rows
  without changing selection.
- Allow a Sub Master to live in Archive while active children keep inheriting
  from it.
- Update build/export copying so archived page JSON and archive-only ids do not
  ship in built client/project output.

## Implementation Order From Final Audit

1. Add manifest typing and loader normalization for `archivedPageOrder`, then
   derive active pages, archived pages, and an all-editable-pages lookup from
   the manifest lists.
2. Split `PageControllerProvider` inputs from editor all-pages state so
   presenter navigation, keyboard next/previous, transition indexes, and
   NavControls operate on active pages only.
3. Add id-based archived preview/edit handling before rendering archived rows,
   so editor panels can resolve selected archived pages without comparing
   all-pages indexes to controller indexes.
4. Update Sub Master inheritance resolution to search all editable pages, not
   only active controller pages.
5. Add reducer actions for archive, restore, archived reorder, and active
   reorder while preserving current active `MOVE_PAGE_BLOCK` rules.
6. Extend PagePanel drag targets for active rows, Archive header, archived rows,
   and restore placement; add reveal-only M/C badge controls and pulse state.
7. Add manifest/source anchors for `page.archive.toggle` and relationship badge
   controls during the same source change that introduces those controls.
8. Add build-copy filtering and validation/test coverage before project fixtures
   receive real `archivedPageOrder` entries.

## Test Plan

- `npm run check:workspace`
- `npm run check:editor-controls`
- `npm run check:pages`
- Focused source tests for `archivedPageOrder`, archive actions, manifest
  anchors, and build-output filtering.
- Focused Playwright coverage for Archive toggle/drop, restore drag, archived
  edit/preview, active navigation exclusion, archived-master inheritance, and
  reveal-only M/C badge pulses.

## Assumptions

- Archive is GeoSee staff/editor-side only.
- Archived pages remain ordinary `pages/<id>.json` files in the authoring
  workspace.
- Built output emits active `pageOrder` pages only.
- Existing delete-recovery files in `pages/_archive/` remain untouched.
- Source implementation remains on hold until this plan is explicitly resumed.
