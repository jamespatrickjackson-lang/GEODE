# Intake Test 1: Utah FORGE Add to Project

## Purpose

Test 1 adds a bounded, dev-only Utah FORGE intake path:

human messy files/context -> local staging folder -> manifest/context note -> later Codex inventory/classification prompt.

It does not process files, create computed artifacts, update project layers, or mark anything accepted.

## UI Location

The `Add to Project` button appears in two Utah FORGE-only places:

- loaded editor header, near the project title and Save control in `src/editor/EditorRoot.tsx`
- home/project list Utah FORGE row, on the right side of the row in `src/App.tsx`

The editor-header button is hidden outside local dev mode, hidden outside Utah FORGE, and hidden in presenter mode. The home-row button is only shown on the Utah FORGE row for Test 1.

## Modal Reuse

Audit confirmed `UtahForgeAddToProjectDrop` does not require `EditorProvider` and can be reused from the home screen with `open`, `projectRoot`, and `onClose`.

## Preflight Review

Selecting or dropping files does not write anything immediately.

Before writing files, the modal shows a preflight review:

- selected files
- file count
- total size
- individual file sizes
- any file-limit errors
- target path under `projects/utah-forge/intake_staging/drops/<dropId>/`
- files/directories that will be written
- actions that will not happen

The user must choose `Commit Intake` to write files. `Exit` / close cancels the draft and writes nothing.

`Commit Intake` only writes:

- `raw/`
- `intake_manifest.json`
- `intake_context.md`
- `BUILD_DIRECTIVE.md`

It does not process files, update project layers/config/pages, create computed artifacts, move files into `geosee_processed`, or mark anything accepted.

## Target Folder

Dropped files are written under:

```text
projects/utah-forge/intake_staging/drops/<dropId>/
```

Each drop contains:

```text
raw/
BUILD_DIRECTIVE.md
intake_manifest.json
intake_context.md
```

Drop IDs use:

```text
YYYY-MM-DD_HH-mm-ss_<short-random>
```

## Manifest Shape

`intake_manifest.json` uses:

```json
{
  "schemaVersion": "0.1.0",
  "dropId": "...",
  "project": "utah-forge",
  "createdAt": "...",
  "createdBy": "dev-ui",
  "entrypoint": "home-project-list",
  "status": "staged_unprocessed",
  "processingStatus": "not_started",
  "accepted": false,
  "reviewRequired": true,
  "files": [
    {
      "originalName": "...",
      "relativePath": "...",
      "storedPath": "...",
      "size": 0,
      "type": "...",
      "lastModified": 0,
      "status": "staged_unprocessed"
    }
  ],
  "userContext": {
    "text": "...",
    "providedAt": "..."
  },
  "nextCodexPrompt": "read build directive"
}
```

## Context Note Shape

`intake_context.md` includes:

- drop ID
- project
- created timestamp
- user context
- file list
- explicit staged-only boundary
- next safe Codex instruction

## Build Directive Rail

The project-level directive is:

```text
projects/utah-forge/BUILD_DIRECTIVE.md
```

The tiny Codex command is:

```text
read build directive
```

For Test 1, the human manually sends this command to Codex. Codex acts as the temporary intelligence layer / API stand-in: it reads the project/drop directive files, creates proposed source inventory outputs, and may create a staged review page only if the drop-local directive mode allows it.

That command should lead Codex to the latest active staged drop under:

```text
projects/utah-forge/intake_staging/drops/
```

Each new drop also receives:

```text
BUILD_DIRECTIVE.md
```

The drop-level directive is the local rail for the next safe action:

- read `intake_manifest.json`
- read `intake_context.md`
- inspect `raw/` filenames and lightweight metadata
- create `source_inventory.json`
- create `source_inventory.md`
- create `proposed_next_steps.md`
- do not process, move, interpret as accepted, wire layers, or create computed artifacts

This separates staging from processing. Staging copies files and records context. Processing remains blocked until explicit human approval.

## Directive Modes

`source_inventory_only` allows only:

- `source_inventory.json`
- `source_inventory.md`
- `proposed_next_steps.md`

`source_inventory_plus_review_page` allows those inventory outputs plus a staged review page:

- `projects/utah-forge/pages/intake_<dropId>.json`
- `projects/utah-forge/overlays/intake_<dropId>/text.md`
- `project.json` `pageOrder` update only to add `intake_<dropId>`

The review page remains proposed / needs_review. It is not acceptance, not data processing, not geologic/geophysical interpretation as truth, and not a layer created from dropped files.

## Directive Hierarchy / Review Page Permission Fix

The first active-drop inventory pass found a directive conflict:

- the drop-local `BUILD_DIRECTIVE.md` used `source_inventory_plus_review_page`
- the project-level hard boundaries still broadly forbade `project.json`, page, and overlay updates

The project-level directive now resolves this by making the hierarchy explicit:

- project-level directive controls safety boundaries
- drop-local directive controls drop-specific mode
- stricter safety wins unless the project-level directive explicitly permits the drop-local mode

For `source_inventory_plus_review_page`, the only allowed project/page/overlay changes are:

- `projects/utah-forge/pages/intake_<dropId>.json`
- `projects/utah-forge/overlays/intake_<dropId>/text.md`
- one `pageOrder` entry in `projects/utah-forge/project.json` for `intake_<dropId>`

This is review-surface permission only. It still does not allow processing, computed artifacts, layers from dropped files, `geosee_processed`, existing-page edits, existing-overlay edits, environment changes, rendering changes, or acceptance.

## Directive-Driven Source Inventory

The first directive-driven inventory pass was run on the latest staged smoke-test drop:

```text
projects/utah-forge/intake_staging/drops/2026-05-16_01-32-03_1r8mdw/
```

It created proposed-only outputs in the drop folder:

- `source_inventory.json`
- `source_inventory.md`
- `proposed_next_steps.md`

The pass used the project-level `BUILD_DIRECTIVE.md`, the drop-local `BUILD_DIRECTIVE.md`, `intake_manifest.json`, `intake_context.md`, and raw filenames/lightweight metadata only. It did not parse or process raw file contents, update project config/pages, move files, create computed artifacts, or mark anything accepted.

The end-to-end smoke test succeeded. The smoke-test drop is now marked `ignored_test` with `ignoreForLatestDirective: true`, so future `read build directive` runs should skip it unless a human explicitly references the drop path. The next real test should stage actual source files through Add to Project.

Future drop status conventions are:

- `staged_unprocessed`
- `inventoried_proposed`
- `review_page_created`
- `ignored_test`
- `superseded`
- `archived`
- `approved_for_processing_review`
- `rejected`

The first review-page test succeeded for drop `2026-05-16_02-12-44_uxm6dg`. It created a proposed intake page, overlay, and pageOrder entry. The drop is now `review_page_created`, with `accepted: false` and `reviewRequired: true`.

Future test drops can be ignored, superseded, archived, approved for processing review, or rejected without deleting the staged files or deleting review pages.

## Real-Drive Intake Build Test

The first directive-driven real-drive intake build pass ran on drop:

```text
projects/utah-forge/intake_staging/drops/2026-05-16_02-12-44_uxm6dg/
```

The pass created `processing_plan.md`, safe image metadata, a drop-local thumbnail, and preview status files:

- `preview/image_metadata.json`
- `preview/thumbnail_320.jpg`
- `preview/preview_status.json`

The JPEG was decoded only to identify dimensions and create a small thumbnail review aid. It remains staged, proposed, unaccepted, and review-required. No project data, layers, computed artifacts, `geosee_processed` outputs, MT/seismic artifacts, render behavior, or accepted interpretation were created.

## Real-Drive PDF / Handoff Intake Build Test

The first full PDF/handoff intake build pass ran on drop:

```text
projects/utah-forge/intake_staging/drops/2026-05-16_02-45-23_1kbq3z/
```

The pass created proposed-only outputs:

- `source_inventory.json`
- `source_inventory.md`
- `processing_plan.md`
- `proposed_next_steps.md`
- `proposed_page_update_plan.md`
- `pdf_review/pdf_index.json`
- `pdf_review/pdf_index.md`
- per-PDF `summary.md`
- per-PDF `extracted_text.txt`
- per-PDF `page_previews/page_001.png`
- `projects/utah-forge/pages/intake_2026-05-16_02-45-23_1kbq3z.json`
- `projects/utah-forge/overlays/intake_2026-05-16_02-45-23_1kbq3z/text.md`

The Markdown handoff was read as proposed demo-planning context. The PDFs were parsed for page count/text and rendered only as first-page review previews. Canonical PDF remains unknown. No existing demo pages, layers, computed artifacts, `geosee_processed` outputs, MT/seismic artifacts, render behavior, or accepted interpretation were changed.

## File Limits

Test 1 client-side limits:

- maximum files: 10
- maximum individual file size: 25 MB
- maximum total drop size: 75 MB

These limits are intentionally small and can be revised later.

## Write Endpoint Used

The modal uses the existing editor save helper `writeFilesBatch`, which calls the dev-only Vite author-write endpoint:

```text
POST /api/write-batch
```

Raw files are written as base64. The manifest and context note are written as UTF-8 text.

The endpoint is dev-only via the existing Vite plugin and is project-scoped by path safety checks.

## Safety Boundaries

- Do not update `project.json` layers.
- Do not update `environment.json`.
- Do not update page JSON.
- Do not process files.
- Do not infer geology or geophysics.
- Do not mark files accepted.
- Do not move files into `data/geosee_processed`.
- Do not alter current demo/runtime behavior.
- Do not create computed artifacts.
- Block absolute paths and `..` traversal.
- Do not claim success if the write endpoint fails.

## What This Does Not Do

This is not full Processware, production upload, New Project intake, large archive ingest, automatic classification, layer creation, or acceptance.

## Next Staged Codex Processing Prompt

read build directive

## Known Limitations

- Browser file APIs do not consistently preserve folder paths unless the browser supplies `webkitRelativePath`.
- `/api/write-batch` uses base64 for binary content, so large archives need a future streaming or multipart endpoint.
- Test 1 does not include an allowlist/denylist by extension.
- Partial writes are reported but not automatically deleted.
- Human review is required before staged files become project data, layers, or computed artifacts.
