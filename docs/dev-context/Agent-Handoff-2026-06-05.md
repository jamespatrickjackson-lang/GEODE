# Agent Handoff 2026-06-05

Status: current cross-session handoff for the GeoSee Utah FORGE authoring and
runtime savepoint.

## Current Commit Stack

- `88dc02e` `Guard GeoSee authoring and hidden payloads`
  - Added stale editor save conflict guards.
  - Restored MT full-density default/page authoring baselines.
  - Made Global Settings virtual page `00` with no presenter card.
  - Guarded hidden seismic layers from eager product payload loads.
- `6bb140b` `Split GeoSee runtime chunks`
  - Kept Vite's 600 kB chunk warning guard.
  - Lazy-loaded `EditorRoot` from `EditorChrome`.
  - Split `src/loaders/` into `app-scene-loaders`.
  - Added DEC-104 and source guard coverage.
- Current handoff commit records the Utah FORGE presentation savepoint and doc
  refresh.

## Utah FORGE Savepoint

- `project.json` active `pageOrder` now starts with `156_page`, `157_page`,
  `158_page`, `159_page`, `166_page`, `160_page`, and `164_page`, then
  continues through the reordered resistivity, section, seismic, and context
  review pages.
- New active authoring pages: `159_page`, `160_page`, `161_page`, `162_page`,
  `163_page`, `164_page`, `165_page`, and `166_page`.
- Empty overlay text files were saved for `159_page`, `160_page`, `161_page`,
  `163_page`, `164_page`, and `166_page`.
- `archivedPageOrder` contains `165_page`.
- `projects/utah-forge/pages/_archive/166_page.json` remains delete-recovery
  storage and is not part of the staff Page Archive.

## Verification Route

Use the smallest verification that matches the changed surface:

- Project/page/overlay wiring: `npm run check:pages`.
- Workspace scope before commit: `npm run check:workspace`.
- Build/bundle guard after runtime or Vite changes: `npm run build`.
- Source guards used for the runtime savepoint:
  `node --test tests/tools/seismic-hidden-product-load-guard-source.test.mjs tests/tools/mt-full-density-page-authoring-source.test.mjs tests/tools/global-settings-start-page-source.test.mjs tests/tools/editor-save-conflict-guard-source.test.mjs tests/tools/vite-source-code-splitting-source.test.mjs`.

## Visual Status

Static checks and build output verify wiring and code health only. The Utah
FORGE deck savepoint is ready for visual check until a running browser is
inspected or human review accepts the look.
