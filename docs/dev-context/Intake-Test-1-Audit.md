# Intake Test 1 Audit: Utah FORGE Add to Project

## Status

Audit only.

This file is planning context for a future dev-only Utah FORGE Add to Project intake test. It does not implement UI, endpoints, runtime behavior, data processing, project config changes, artifact creation, Processware, SRI, or breadcrumbs.

## Purpose

Audit how to safely test the future Add to Project intake concept:

```text
human messy files/context
-> dev-only drop intake
-> project-local staging folder
-> manifest/context note
-> later Codex processing prompt
```

Nothing should be processed or accepted automatically.

## Files inspected

| File/path | What it contributes |
| --- | --- |
| `src/App.tsx` | Global project landing screen, `ProjectLanding`, `ProjectOption`, project open flow, and current `Add New Project` action. |
| `src/editor/EditorRoot.tsx` | Loaded project editor shell/header with project title, Save button, presenter-mode boundary, and project-specific panel behavior. |
| `src/editor/EditorChrome.tsx` | Editor chrome composition, provider wiring, legends, overlays, labels, and presenter/editor separation. |
| `src/editor/EditorContext.tsx` | Project root/slug, dirty/save flow, batched writes, environment/project/page/overlay persistence, and current save dispatch model. |
| `src/editor/save.ts` | Thin client helpers for `/api/write-file`, `/api/write-batch`, `/api/read-file`, `/api/copy-file`, and `/api/delete-file`. |
| `src/editor/OverlayPanel.tsx` | Existing browser `File` upload pattern for overlay images via base64 and `/api/write-file`. |
| `src/editor/EnvironmentScenePanel.tsx` | Existing logo/overlay source upload pattern via base64 and `/api/write-file`. |
| `src/editor/LayerPanel.tsx` | Existing overlay/source image upload pattern via base64 and `/api/write-file`. |
| `src/projects/projectCatalogRuntime.ts` | Project slug/root catalog, including `utah-forge` -> `projects/utah-forge`. |
| `src/projects/projectPathsRuntime.ts` | Project asset URL/path lookup for runtime project files. |
| `src/pages/loadPages.ts` | Loads project manifest, environment, page JSON, and overlays from project roots. |
| `src/ui/LightModeToggle.tsx` | Existing return-to-project-landing affordance, useful for understanding shell/navigation boundaries. |
| `vite.config.ts` | Registers `authorWritePlugin` in dev and confirms build does not ship write capability. |
| `plugins/vite-plugin-author-write.ts` | Existing dev-only project-scoped read/write/copy/delete endpoints and static project file serving. |
| `projects/utah-forge/` | Current project-local structure and existing `intake_staging/` folder. |
| `projects/utah-forge/intake_staging/sample/` | Existing sample intake/control records: `source_inventory.json`, `review_queue.json`, `unresolved.json`, `gaps.json`, `receipts.jsonl`. |
| `projects/utah-forge/AI_FUTURE_DATA_INPUT_PLAYBOOK.md` | Existing Utah guidance: stage source/client files carefully, inventory before processing, do not wire project layers first. |
| `projects/utah-forge/data/README.md` | Current source/client vs GeoSee-ready output folder rules and older seismic-status contradiction that still needs review. |
| `docs/dev-context/Data-System-App-Refinement-Plan.md` | Current app/data-flow foundation context and parked Processware/SRI boundary. |
| `docs/dev-context/Current-State.md` | Current dev-context status orientation. |
| `docs/dev-context/Open-Loops.md` | Existing open review loops. |

## 1. UI location

Recommended Test 1 location:

```text
src/editor/EditorRoot.tsx
loaded project editor shell/header
same top strip as project title and Save button
Utah FORGE only for Test 1
```

Reason:

- `EditorRoot` already runs only after a project is loaded.
- `useEditor()` provides `state.projectSlug`, `state.projectRoot`, dirty/save state, and project context.
- The header strip is project-level, not layer/page-specific.
- Presenter mode already hides the editor shell, so this avoids presenter/client-demo clutter.
- The button can be conditionally shown only when `state.projectSlug === "utah-forge"`.

Alternative location:

```text
src/App.tsx
ProjectLanding / ProjectOption for the Utah FORGE card
```

This is less safe for Test 1 because the global landing screen does not have the loaded project/editor context, dirty/save state, or project shell boundaries. It could still hardcode `projects/utah-forge`, but that makes the first test feel more like a project-selection feature than a project-local intake action.

Recommendation:

- Test 1 should be Utah FORGE-only.
- Add a small `Add to Project` button in the loaded editor header.
- Defer reusable/catalog-wide intake until the Utah path and staging contract are reviewed.
- Keep it out of presenter mode.
- Avoid adding it to page panels, layer panels, or the demo walkthrough pages.

Clutter risk:

- Low if the button is compact and adjacent to Save in the editor header.
- Medium if added to the global project landing page because it could compete with `Open project` and `Add New Project`.
- High if added inside layer/page panels because users may think it wires files into layers or pages.

## 2. Existing dev-only write path

Existing plugin:

```text
plugins/vite-plugin-author-write.ts
authorWritePlugin
```

Registered in:

```text
vite.config.ts
plugins: [react(), authorWritePlugin(), copyRuntimeDataPlugin(), copyProjectsPlugin()]
```

Dev endpoints:

| Endpoint | Method | Body | Capability |
| --- | --- | --- | --- |
| `/api/write-file` | `POST` | `{ path, content, encoding? }` | Writes one file. |
| `/api/write-batch` | `POST` | `{ files: [{ path, content, encoding? }] }` | Writes multiple files through temp files then rename. |
| `/api/read-file` | `POST` | `{ path }` | Reads UTF-8 text file content. |
| `/api/copy-file` | `POST` | `{ from, to }` | Copies one regular file. |
| `/api/delete-file` | `POST` | `{ path }` | Deletes one regular file. |
| `/projects/<path>` | `GET` | none | Dev-only static project file serving for regular files. |

Write support:

- Text: yes, default `utf8`.
- JSON/Markdown: yes, as UTF-8 text.
- Binary: yes, if the caller sends base64 string content with `encoding: "base64"`.
- Blob/File upload: not directly as multipart/form-data; current UI callers read browser `File` objects to `ArrayBuffer`, convert to base64, then call `/api/write-file`.
- Multiple files: yes via `/api/write-batch`.
- Folder creation: yes; `fs.mkdir(dirname(abs), { recursive: true })` runs before writes.
- Atomic-ish batch behavior: partial temp-file cleanup exists before final renames, but this is not a full transaction if a later rename/write fails after earlier renames.

Path safety rules:

- Path must be relative.
- Path must start with `projects/`.
- `..` segments are rejected.
- Absolute paths are rejected.
- Resolved path must remain under `<repo>/projects/`.
- Existing symlinks, directories, sockets, and other non-regular files are rejected before write/delete.
- Endpoint is project-tree scoped, not Utah-intake scoped.

Production behavior:

- `authorWritePlugin` has `apply: "serve"`.
- It is dev-only and not included in `vite build` output.
- Shipped static builds have no write capability.

Current callers/helpers:

- `src/editor/save.ts`: `writeFile`, `writeFilesBatch`, `readFile`, `copyFile`, `deleteFile`.
- `src/editor/EditorContext.tsx`: uses batched writes for project/environment/page/overlay save flow.
- `src/editor/OverlayPanel.tsx`: uploads page overlay images using `File.arrayBuffer()` -> base64 -> `writeFile`.
- `src/editor/EnvironmentScenePanel.tsx`: uploads logo/overlay source images using base64 writes.
- `src/editor/LayerPanel.tsx`: uploads overlay/source images using base64 writes.

Finding:

The existing dev-only write path is suitable for a small bounded Test 1 intake using browser `File` -> base64 -> `/api/write-batch`, provided implementation adds explicit size/type/path safeguards in the UI flow and writes only under the approved staging target.

It is not suitable as-is for unbounded large client/geophysical archives because it buffers files in browser memory, encodes them as base64, and sends them inside JSON bodies without an explicit endpoint size limit or streaming/multipart support.

## 3. If no suitable write path exists

A suitable dev-only write path does exist for small staged test files.

Missing pieces before real intake:

- Intake-specific UI.
- Intake-specific staging target allowlist.
- Explicit file-size limits.
- Drop batch size limits.
- Clear error handling for partial failures.
- User context capture.
- Manifest/context note writer.
- Path normalization for original file names and optional `webkitRelativePath`.
- Negative tests for path traversal and unsafe filenames.
- A decision on whether large binary files require a streaming/multipart endpoint.

Smallest dev-only extension if large file support becomes required later:

- Add an explicitly dev-only intake endpoint such as `/api/intake-drop`.
- Accept multipart/form-data or streamed file chunks.
- Restrict writes to `projects/<slug>/intake_staging/drops/<dropId>/raw/`.
- Enforce a project slug allowlist, drop ID format, max file size, max total size, max file count, and regular-file-only writes.
- Write the manifest and context note server-side after file writes succeed.

Do not implement that extension without approval.

## 4. Proposed intake target

Recommended target:

```text
projects/utah-forge/intake_staging/drops/<dropId>/
```

Inside each drop:

```text
raw/
intake_manifest.json
intake_context.md
```

Reason:

- Keeps unprocessed human/client/source files outside runtime `project.json`, pages, layers, environment, overlays, and `geosee_processed`.
- Uses the already-existing `projects/utah-forge/intake_staging/` convention.
- Makes each drop easy to inspect, delete, archive, or promote through a later reviewed process.
- Avoids mixing staged raw files with accepted source/client slots under `data/client_preprocessed/` before review.

## 5. Proposed dropId format

Recommended format:

```text
YYYY-MM-DD_HH-mm-ss_<short-random>
```

Example:

```text
2026-05-16_14-42-08_k7p9q2
```

Rules:

- Use local time or ISO-derived local timestamp consistently.
- Use only ASCII letters, digits, hyphen, and underscore.
- Do not include spaces, slashes, colons, or user-provided text.
- Generate `<short-random>` from a browser-safe random source where practical.

## 6. Proposed manifest shape

File:

```text
projects/utah-forge/intake_staging/drops/<dropId>/intake_manifest.json
```

Shape:

```json
{
  "schemaVersion": 1,
  "dropId": "2026-05-16_14-42-08_k7p9q2",
  "project": "utah-forge",
  "createdAt": "2026-05-16T21:42:08.000Z",
  "createdBy": "dev-local-user",
  "status": "staged_unprocessed",
  "processingStatus": "not_started",
  "accepted": false,
  "reviewRequired": true,
  "files": [
    {
      "originalName": "client-file.zip",
      "relativePath": "client-file.zip",
      "storedPath": "projects/utah-forge/intake_staging/drops/2026-05-16_14-42-08_k7p9q2/raw/client-file.zip",
      "size": 123456,
      "type": "application/zip",
      "lastModified": 1760000000000,
      "status": "staged_unprocessed"
    }
  ],
  "userContext": {
    "text": "Human-entered note from the drop popout.",
    "providedAt": "2026-05-16T21:42:08.000Z"
  },
  "nextCodexPrompt": "Inspect this drop, create a source inventory, classify file types, and propose next processing steps. Do not process, move, wire, or accept files unless explicitly instructed."
}
```

Notes:

- `relativePath` should use browser `webkitRelativePath` when a directory drop supplies it; otherwise use `originalName`.
- `storedPath` should be project-root-relative and under the drop's `raw/` folder.
- File names must be sanitized for storage, while original names are preserved in metadata.
- If a sanitized name collides, append a deterministic suffix.

## 7. Proposed context note shape

File:

```text
projects/utah-forge/intake_staging/drops/<dropId>/intake_context.md
```

Shape:

```markdown
# Intake Drop: 2026-05-16_14-42-08_k7p9q2

## Created

2026-05-16T21:42:08.000Z

## Project

utah-forge

## User Context

Human-entered note from the drop popout.

## Files

| Original name | Stored path | Size | Type | Last modified |
| --- | --- | ---: | --- | --- |
| client-file.zip | raw/client-file.zip | 123456 | application/zip | 2026-05-16T21:40:00.000Z |

## Status

These files are staged only.

- They have not been processed.
- They have not been accepted.
- They have not been moved into `data/client_preprocessed/`.
- They have not been moved into `data/geosee_processed/`.
- They have not been wired into `project.json`, `environment.json`, pages, overlays, loaders, runtime behavior, or computed artifacts.

## Next safe Codex instruction

Inspect this drop, create a source inventory, classify file types, and propose next processing steps. Do not process, move, wire, or accept files unless explicitly instructed.
```

## 8. Safety boundaries

Any implementation must enforce:

- Do not update `project.json` layers.
- Do not update `environment.json`.
- Do not update page JSON.
- Do not update overlays.
- Do not process files.
- Do not infer geology or geophysics.
- Do not mark files, sources, artifacts, wrappers, or interpretations as accepted.
- Do not move files into `data/client_preprocessed/` automatically.
- Do not move files into `data/geosee_processed/`.
- Do not alter the current demo/runtime.
- Do not create computed artifacts.
- Do not run prep scripts.
- Block path traversal.
- Sanitize all stored file names.
- Preserve original file names in metadata.
- Do not claim success if any write endpoint call fails.
- If partial writes occur, report them clearly and leave the drop `status` as failed or incomplete.
- Keep Test 1 dev-only.

## 9. Smallest safe implementation plan

Recommended first implementation slice:

1. Add a Utah FORGE-only `Add to Project` button in `src/editor/EditorRoot.tsx` header when `state.projectSlug === "utah-forge"`.
2. Create a small new component, likely `src/editor/ProjectIntakeDropPanel.tsx`, for the popout and drag/drop area.
3. Use existing `writeFilesBatch` from `src/editor/save.ts` if file size limits are small enough for base64 JSON transport.
4. Convert each dropped `File` to base64 in the browser, sanitize the stored filename, and write to:
   `projects/utah-forge/intake_staging/drops/<dropId>/raw/`.
5. Write `intake_manifest.json` and `intake_context.md` in the same batch.
6. Add explicit UI status for success, failure, and partial failure.
7. Do not mark the editor dirty/save flow unless a conscious decision is made to treat intake staging as an editor-save operation. For Test 1, direct dev write is probably clearer because intake staging is not project config.

Files likely touched in the implementation:

| Path | Need |
| --- | --- |
| `src/editor/EditorRoot.tsx` | Add Utah-only button in loaded project header and mount popout component. |
| `src/editor/ProjectIntakeDropPanel.tsx` | New focused UI for drag/drop, user context, write status, and manifest/context construction. |
| `src/editor/save.ts` | Possibly no change; only if helper naming or batch metadata wrapper is needed. |
| `plugins/vite-plugin-author-write.ts` | Avoid for Test 1 if using existing base64 batch. Touch only if large/streaming/multipart or intake-specific endpoint is approved. |
| `docs/dev-context/*` | Record implementation receipt, open loops, and safety outcome. |

Endpoint changes needed:

- Not needed for small bounded Test 1.
- Needed before large real client/geophysical drops if base64 JSON transport is too memory-heavy or unsafe.

Verification plan for implementation:

- `npm run build`
- Dev open Utah FORGE.
- Confirm the button is visible only in the loaded Utah FORGE editor shell, not presenter mode.
- Drop two tiny test files and a context note.
- Confirm files are written under one `intake_staging/drops/<dropId>/raw/` folder.
- Confirm `intake_manifest.json` parses.
- Confirm `intake_context.md` exists.
- Confirm no `project.json`, `environment.json`, page JSON, overlays, loaders, data artifacts, generated artifacts, or prep scripts changed.
- Negative test: attempt a filename/path with `../` or slashes and confirm the stored path is sanitized or blocked.
- Production boundary: run build and confirm no write endpoint is available in build output.

Rollback risk:

- Low if Test 1 only writes a self-contained drop folder under `intake_staging/drops/`.
- Delete the created test drop folder if human review rejects it.
- Higher if real large files are dropped through base64 JSON; this should be explicitly capped or deferred.

## 10. Go / no-go recommendation

Go for a bounded dev-only implementation if the next prompt explicitly approves:

- Utah FORGE only.
- Loaded editor header only.
- Small test files only.
- Existing `/api/write-batch` base64/UTF-8 write path only.
- Writes only under `projects/utah-forge/intake_staging/drops/<dropId>/`.
- Manifest/context note only.
- No processing, artifact creation, project wiring, or acceptance.

No-go for large real client/geophysical archives until:

- File size and total drop limits are defined.
- A streaming/multipart or intake-specific endpoint is reviewed if needed.
- Human approves staging real source/client files.
- A cleanup/rollback rule for failed drops exists.

## Final boundary

This audit does not authorize implementation. It records the safest observed path for a future Test 1 prompt.
