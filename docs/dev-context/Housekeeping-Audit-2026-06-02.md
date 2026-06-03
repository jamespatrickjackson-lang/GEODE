# Housekeeping Audit - 2026-06-02

Status: executed cleanup and archive-routing record

Canonical active repo: `C:\GeoSee\GeoSee_Dev`

Archive root: `C:\GeoSee\GeoSee_Archive`

## Summary

This pass cleaned local bloat without moving runtime assets, page JSON, source
code, project manifests, or processed artifacts. Runtime-critical tracked
artifacts were retained, including:

- `projects/*/data/processed`
- `projects/utah-forge/data/geosee_processed`
- top-level runtime data such as `data/*.geojson` and `data/*.tif`

Excluded user work was present under `UI_EDITOR/` and remained unstaged.

## Pre-Clean Measurements

| Area | Size / count |
| --- | --- |
| Active repo tracked files | 338.66 MB across 1,361 files |
| Active repo ignored/other files | 1,862.66 MB across 14,656 files |
| Active repo total folder size | 3,987.68 MB |
| `.git` folder | 1,786.36 MB |
| Git loose objects | 4,180 objects, 1.54 GiB |
| Git pack size | 203.08 MiB |
| `docs/dev-context/artifacts/transition-matrix` | 1,227.54 MB |
| `C:\GeoSee\GeoSee_Dev_Past` | 88,805.28 MB |
| `C:\GeoSee\GeoSee_Archive` | 64,909.41 MB |

`C:\GeoSee_Dev` was confirmed as a junction to
`C:\GeoSee\GeoSee_Dev`, not a second copy.

## Actions Taken

- Archived ignored transition review evidence from
  `docs/dev-context/artifacts/transition-matrix` to
  `C:\GeoSee\GeoSee_Archive\docs\dev-context\artifacts\transition-matrix\2026-06-02-cleanup`.
- Quarantined historical snapshots from
  `C:\GeoSee\GeoSee_Dev_Past\Major Release` to
  `C:\GeoSee\GeoSee_Archive\repo-snapshots-quarantine\2026-06-02\Major Release`.
- Removed regenerable active-repo cache/build/dependency material:
  `dist`, root `node_modules`, `UI_EDITOR/node_modules`,
  `UI_EDITOR_v1_0/node_modules`, `.tmp`, `test-results`, root logs,
  root TypeScript build info files, and `desktop.ini` OS metadata.
- Restored tracked declaration files under `dist-tsbuild` after detecting that
  this folder contains tracked declarations as well as ignored build info.
- Stopped the active UI editor Vite/esbuild process pair that locked
  `UI_EDITOR/node_modules`.
- Expired reflogs and ran immediate Git garbage collection:
  `git reflog expire --expire=now --all`
  and `git gc --prune=now --aggressive`.

## Post-Clean Measurements

| Area | Size / count |
| --- | --- |
| Active repo total folder size | 623.05 MB |
| `.git` folder | 258.76 MB |
| Git loose objects | 0 objects, 0 bytes |
| Git pack size | 258.51 MiB |
| `C:\GeoSee\GeoSee_Dev_Past` | 11,658.41 MB |
| `C:\GeoSee\GeoSee_Archive` | 143,283.82 MB |
| Archive transition evidence destination | 1,227.54 MB |
| Archive snapshot quarantine destination | 77,146.87 MB |

## Retained Ignored Material

The following ignored paths remained because they are not proven regenerable
cleanup targets in this pass:

- `.claude/settings.local.json`
- `data/Marketing/`
- `docs/dev-context/Audits/`
- `docs/dev-context/Change-Receipts/`
- `docs/dev-context/Visual-Review/`
- empty or near-empty `docs/dev-context/artifacts/` parent

## Excluded User Work

The following tracked and untracked UI editor files were present before the
housekeeping doc commit and were intentionally left unstaged:

- `UI_EDITOR/Launch UI Editor.cmd`
- `UI_EDITOR/Open GUI Editor.cmd`
- `UI_EDITOR/README.md`
- `UI_EDITOR/docs_v1/*`
- `UI_EDITOR/gui-editor.html`
- `UI_EDITOR/Launch Package Workbench (paused).cmd`

## Verification Notes

- `npm run check:workspace` ran before dependency purge and reported excluded
  UI editor work candidates with no snapshot-sensitive local files.
- `git count-objects -vH` before cleanup showed 1.54 GiB of loose objects.
- `git count-objects -vH` after cleanup showed 0 loose objects and one pack at
  258.51 MiB.
- Final doc-only verification should run `git diff --check` and
  `npm run check:workspace` before committing archive documentation.
