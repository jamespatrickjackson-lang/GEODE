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

It does not process files, update project layers/config/pages, create computed artifacts, move files into `geosee_processed`, or mark anything accepted.

## Target Folder

Dropped files are written under:

```text
projects/utah-forge/intake_staging/drops/<dropId>/
```

Each drop contains:

```text
raw/
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
  "nextCodexPrompt": "run intake trailhead"
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
- suggested smoke/API call trace

## Canonical Intake Review Flow

The current first-pass smoke/API behavior is intentionally simple:

```text
drop files -> run intake trailhead -> INTAKE_REVIEW -> one app-visible review page -> stop
```

`run intake trailhead` now appraises safe file contents by family and writes:

- `INTAKE_REVIEW.json`
- `INTAKE_REVIEW.md`
- one `projects/utah-forge/pages/intake_<dropId>.json`
- one `projects/utah-forge/overlays/intake_<dropId>/text.md`

The review page is the product of the first pass. It should show the actual input preview where available, a concise plan, file-family summary, and questions only if a blocking question exists.

Compatibility files such as `AI_REVIEW.json` and `INTAKE_SWITCHBOARD.json` may still be written during transition, but `INTAKE_REVIEW` is the primary review state and `LATEST_INTAKE_REVIEW.json` is the primary UI pointer.

`USER_CONTEXT_RESPONSE.json/.md` is not required before the first review page. It is only needed when the canonical review contains blocking questions or a later route needs human context before mutation.

Canonical file roles:

- active: `intake_manifest.json`, `intake_context.md`, `INTAKE_REVIEW.json`, `INTAKE_REVIEW.md`, `LATEST_INTAKE_REVIEW.json`
- optional review outputs: `source_inventory.json/.md`, `proposed_next_steps.md`, file-family review folders, and route execution logs
- conditional human-response files: `USER_CONTEXT_RESPONSE.json/.md`
- compatibility aliases: `AI_REVIEW.json/.md`, `LATEST_AI_REVIEW.json`, `INTAKE_SWITCHBOARD.json/.md`
- historical only: `AGENT_TRAILHEAD.md`, `BUILD_DIRECTIVE.md`, `INTENT_BINDINGS.md`

Route execution remains separate from first-pass review.

## Historical Build Directive Rail

Historical note: this section records the older directive-rail test shape. It is preserved as trace, but no longer defines active intake authority.

The former project-level directive file was:

```text
projects/utah-forge/BUILD_DIRECTIVE.md
```

The former tiny Codex command was:

```text
read build directive
```

For Test 1, the human manually sent this command to Codex. Codex acted as the temporary intelligence layer / API stand-in. This is now historical trace only.

Current intake runner state should use manifest/context, `INTAKE_REVIEW.json`, `USER_CONTEXT_RESPONSE.json`, selected route ID, and route-handler allowlists instead of reading directive files. `AI_REVIEW.json` and `INTAKE_SWITCHBOARD.json` are compatibility aliases, not authority.

The runner still finds staged drops under:

```text
projects/utah-forge/intake_staging/drops/
```

New drops should not receive drop-local `BUILD_DIRECTIVE.md` or `AGENT_TRAILHEAD.md` files from the Add to Project UI.

The drop-level directive is the local rail for the next safe action:

- read `intake_manifest.json`
- read `intake_context.md`
- inspect `raw/` filenames and lightweight metadata
- create `source_inventory.json`
- create `source_inventory.md`
- create `proposed_next_steps.md`
- do not process, move, interpret as accepted, wire layers, or create computed artifacts

This separates staging from processing. Staging copies files and records context. Processing remains blocked until explicit human approval.

## Context Confirmation / Route Selection Gate

The first deterministic context-confirmation bridge has been added to the intake design.

The intake rail now uses a two-review model:

1. Intelligence review: Codex/API reads staged trace and writes `AI_REVIEW.json`.
2. Context confirmation / route selection: the UI shows unresolveds and route options, then the human confirms context or chooses the next route.

When a drop-local `AI_REVIEW.json` returns `questions_required` or `route_options_ready`, the Utah FORGE Add to Project modal can load the review, show the blocking questions/routes, and save human context confirmation as:

```text
projects/utah-forge/intake_staging/drops/<dropId>/USER_CONTEXT_RESPONSE.json
projects/utah-forge/intake_staging/drops/<dropId>/USER_CONTEXT_RESPONSE.md
```

The response schema is generic for messy intake unresolveds. It is not limited to PDF review. It can capture answers about file family, missing context, canonical selection, source authority, route selection, metadata inspection, review-page intent, duplicate handling, or holding unresolveds.

The runner now reads `USER_CONTEXT_RESPONSE.json` on the next run. If the response exists, `AI_REVIEW.json` reports:

```text
status: route_ready
responseFound: true
contextConfirmed: true
routeExecutionImplemented: false
```

This proves:

```text
AI asks a blocking question or proposes route options
-> UI records human context confirmation as deterministic repo state
-> runner reads the answer
-> route becomes ready
-> no processing occurs yet
```

`route_ready` is not execution. Route handlers for PDF, image, text, CSV, GeoJSON, review pages, and other future file families remain later work. PDF review generation and review-page creation remain future explicit gates.

## Route Dispatcher Shell

The runner now has a generic route dispatcher shell after context confirmation.

The shell reads `selectedRouteId` from `USER_CONTEXT_RESPONSE.json` and compares it with registered route contracts. The route ID is treated as an opaque token until a registered handler claims it.

Current route shell statuses:

- `not_implemented`: a known route ID was selected, but the handler is not implemented.
- `unknown_route`: a selected route ID has no registered contract.
- `no_route_selected`: context was confirmed, but no route ID was selected.
- `waiting_for_context_confirmation`: no response file exists yet.

The shell records `PRIOR_STATE` and `RETURN_STATE` in `AI_REVIEW.json` through the route-dispatch object. This is transition logging only. It does not execute route work.

Future route contracts include holding unresolveds, generating PDF review, inspecting image metadata, parsing text handoffs, classifying CSV previews, inspecting GeoJSON bounds, creating intake review pages, proposing project update plans, and asking for more context.

## Route Selection Binding

Route selection now distinguishes human prose from deterministic route state.

The AI review may expose route candidates with both legacy IDs and normalized route IDs. For example:

```text
ROUTE-002 -> generate_pdf_review
```

The Add to Project modal should save the human answer as context and save `selectedRouteId` when a route option is chosen or can be deterministically inferred from a simple affirmative answer with one matching route. Free text alone is not a route. If no route token is saved, the runner should continue to report `no_route_selected`.

This keeps the two-review model intact:

```text
AI review -> human context confirmation -> selected route token -> later explicit route execution gate
```

No route execution, PDF review generation, page creation, overlay creation, data processing, project config mutation, or acceptance is authorized by this binding step.

## First Route Handler: Generate PDF Review

The first route handler target is `generate_pdf_review`.

Execution remains deterministic:

- it requires a saved `selectedRouteId`
- it runs only for PDF files in the active drop
- it writes only under the active drop's `pdf_review/` folder
- it leaves `accepted: false` and `reviewRequired: true`
- it records canonical PDF as unknown unless a later human decision supplies stronger evidence

The route may create:

- `pdf_review/pdf_index.json`
- `pdf_review/pdf_index.md`
- per-PDF `summary.md`
- per-PDF `extracted_text.txt` when local Poppler extraction succeeds
- per-PDF `page_previews/page_001.png` when local Poppler rendering succeeds

It still does not create pages, overlays, layers, project config changes, environment config changes, project data, `geosee_processed` outputs, computed artifacts, or accepted state.

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

## Historical Directive Hierarchy / Review Page Permission Fix

The first active-drop inventory pass found a directive conflict:

- the drop-local `BUILD_DIRECTIVE.md` used `source_inventory_plus_review_page`
- the project-level hard boundaries still broadly forbade `project.json`, page, and overlay updates

At that time, the project-level directive resolved this by making the hierarchy explicit:

- project-level directive controls safety boundaries
- drop-local directive controls drop-specific mode
- stricter safety wins unless the project-level directive explicitly permits the drop-local mode

For `source_inventory_plus_review_page`, the only allowed project/page/overlay changes are:

- `projects/utah-forge/pages/intake_<dropId>.json`
- `projects/utah-forge/overlays/intake_<dropId>/text.md`
- one `pageOrder` entry in `projects/utah-forge/project.json` for `intake_<dropId>`

This is review-surface permission only. It still does not allow processing, computed artifacts, layers from dropped files, `geosee_processed`, existing-page edits, existing-overlay edits, environment changes, rendering changes, or acceptance.

## Historical Directive-Driven Source Inventory

The first directive-driven inventory pass was run on the latest staged smoke-test drop:

```text
projects/utah-forge/intake_staging/drops/2026-05-16_01-32-03_1r8mdw/
```

It created proposed-only outputs in the drop folder:

- `source_inventory.json`
- `source_inventory.md`
- `proposed_next_steps.md`

The pass used the project-level `BUILD_DIRECTIVE.md`, the drop-local `BUILD_DIRECTIVE.md`, `intake_manifest.json`, `intake_context.md`, and raw filenames/lightweight metadata only. It did not parse or process raw file contents, update project config/pages, move files, create computed artifacts, or mark anything accepted.

The end-to-end smoke test succeeded. The smoke-test drop is now marked `ignored_test` with `ignoreForLatestDirective: true`, so future latest-drop runner/API passes should skip it unless a human explicitly references the drop path. The next real test should stage actual source files through Add to Project.

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

## Open Appraisal Review Route

The first real messy-intake appraisal route is now registered as:

```text
open_appraisal_review
```

It is selected through `USER_CONTEXT_RESPONSE.json` and remains review-only. The route can appraise safe staged Markdown, text, CSV, JSON, GeoJSON, PDF, and image inputs, create drop-local file-family review artifacts, write `processing_plan.md`, `proposed_page_update_plan.md`, and route execution logs, and create one intake-prefixed app-visible review page and overlay.

The route records `PRIOR_STATE` and `RETURN_STATE`. Outputs remain `accepted: false` and `reviewRequired: true`.

Protected areas remain existing demo pages, existing overlays, existing MT/seismic products, render settings, loaders, materials, scalar ranges, color ramps, camera behavior, project data, `geosee_processed`, computed artifacts, runtime code, and prep scripts.

Current latest-drop smoke status: the route is implemented, but the latest user response did not contain `selectedRouteId: open_appraisal_review`, so the dry run correctly stayed at `no_route_selected` and did not execute the route.

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

## Next Staged Runner/API Trigger

run intake trailhead

## Restoration Note: Local Directive Authority Removed

The intake system no longer treats repo-local `BUILD_DIRECTIVE.md` or drop-local `AGENT_TRAILHEAD.md` / `BUILD_DIRECTIVE.md` files as instruction, authority, or blockers.

Older directive/trailhead files remain historical trace. New Add to Project drops should stage only `raw/`, `intake_manifest.json`, and `intake_context.md` before AI review/user response outputs are created.

The active bridge is now manifest/context -> `INTAKE_REVIEW.json` -> `USER_CONTEXT_RESPONSE.json` when needed -> selected route ID -> route-handler allowlists/protected-area checks. `AI_REVIEW.json` remains a compatibility mirror during transition.

## Known Limitations

- Browser file APIs do not consistently preserve folder paths unless the browser supplies `webkitRelativePath`.
- `/api/write-batch` uses base64 for binary content, so large archives need a future streaming or multipart endpoint.
- Test 1 does not include an allowlist/denylist by extension.
- Partial writes are reported but not automatically deleted.
- Human review is required before staged files become project data, layers, or computed artifacts.
