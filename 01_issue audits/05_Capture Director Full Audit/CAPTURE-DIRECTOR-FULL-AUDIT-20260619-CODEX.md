# Capture Director Full Audit And 8K Output Deep Dive

Date: 2026-06-19  
Repo: `C:\GeoSee\GeoSee_Dev`  
Mode: diagnosis-only; no source, project, page, overlay, environment, fixture, or docs edits performed by this audit except this report.

## Executive Summary

Highest-risk finding: 8K supersample handling is split across UI display, recipe validation, endpoint validation, and local renderer CLI defaults. The UI can display an effective 1x 8K render while the provider still validates the raw selected 2x value, causing 8K Render Out or Still Capture to fail or fall back to JSON. Separately, local video and scroll-package endpoints launch `tools/render-capture-video-job.mjs` without an explicit `--superscale`, so accepted 8K jobs use the tool default of 2x and plan a 15360 x 8640 render surface.

Static and Node runtime verification is strong: all requested Node Capture Director suites passed, `check:runtime-assets` passed, production build passed, the 8K still self-test passed, and a bounded synthetic one-frame 8K video smoke produced an exact 7680 x 4320 MP4.

Browser automation is currently not green. The requested Playwright suite produced 2 passed and 6 failed. Failure contexts show Capture Director opened, but tests still target controls now nested in popouts and a Camera Path add flow that now opens a Keyframe/Transition popover. Browser evidence is therefore recorded as a verification failure and workflow/test drift. No generated output media was visually inspected; current status is `ready for visual check`.

## Current Workspace And Contamination State

Baseline command: `git status --short --branch`

Current branch is `main`. The workspace already had broad local changes before this audit. Capture Director-related dirty source/test/docs were present in:

- `docs/capture-director/README.md`
- `docs/03-decisions.md`
- `src/capture/CaptureDirectorProvider.tsx`
- `src/capture/CaptureDirectorToolbar.tsx`
- `src/capture/captureRecipe.ts`
- `src/capture/captureResolution.ts`
- `src/capture/captureTypes.ts`
- `src/capture/deterministicFrameSequenceExporter.ts`
- `src/capture/deterministicStillExporter.ts`
- `src/capture/deterministicStillTileExporter.ts`
- `tests/tools/capture-director-runtime.test.mjs`
- `tests/tools/capture-director-source.test.mjs`
- `tools/render-capture-still-job.mjs`
- `tools/render-capture-video-job.mjs`

Unrelated or adjacent dirty work was also present in editor/dev mode, loaders, scene/postprocessing, topo runtime, docs, tools, and untracked issue-audit folders.

Baseline `npm run check:workspace` passed with:

- tracked changes: 32
- untracked files: 7
- snapshot-sensitive local files: 0
- local sketch state: none detected
- excluded user work candidates: present
- accepted snapshot: current

Generated audit/smoke artifacts stayed under `.tmp` or Playwright ignored output:

- `.tmp/capture-still-self-test.png`
- `.tmp/capture-video-8k-smoke-job.json`
- `.tmp/capture-video-8k-synthetic-smoke.mp4`
- `test-results/**` from the requested Playwright run

## Capture Director Workflow Map

| Workflow | Route | Current evidence | Audit status |
|---|---:|---|---|
| Realtime Capture | Browser-only / display-capture for full UI | Realtime presets exclude `render-8k`; `CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER` omits `render-8k`; runtime tests cover MIME and zero-byte guards. | Source/Node pass; Playwright failed waiting for popout controls. |
| Render Out | Mixed: browser deterministic frames below 4K; local renderer for 4K+; JSON fallback | `shouldDefaultToExternalVideoRenderJob` routes width >= 3840 or height >= 2160 to external/local. | High 8K superscale issues found. |
| Still Capture | Browser deterministic still; display capture for full UI; external tiled JSON fallback on browser/GPU limits | External still self-test exact 8K output passed; fallback JSON path exists. | 8K still self-test pass; raw supersample preflight issue found. |
| Camera Path authoring | Browser UI/recipe-only state | V2/V3/spline Node runtime tests passed. | Browser spec drift found around two-step add flow and timeline controls. |
| Record Path Video | Browser MediaRecorder preview | Path recording is realtime preview, not deterministic 8K. | Source/Node pass; browser camera-path spec failed. |
| Convert Preview to MP4 | Browser FFmpeg | Browser FFmpeg runtime tests passed; runtime assets check passed. | Asset validator coverage gap found. |
| Render Path Video | Mixed: local renderer for 4K+; JSON fallback | Same external video runner as Render Out. | Same high 8K superscale issues apply. |
| Scroll Animation preview | Browser-only preview | Page Bar applies scene source; Camera Path owns camera when valid. | Node timeline tests pass. |
| Scroll Animation Record/package output | Local-renderer package output; manual fallback accepted only explicitly | Scroll request contracts enforce exact 8K and local-external route for 4K+. | Exactness pass; local renderer default superscale risk applies. |

## 8K Output And Render Logic Matrix

| Path | 8K exactness | Effective supersample | Frame/tile envelope | Result |
|---|---:|---:|---|---|
| Render Out video | Output preset is exact 7680 x 4320 in `captureResolution.ts:50-56`. | UI display clamps to 1x, but provider validation uses raw selected scale. Local CLI defaults to 2x unless passed. | Correct envelope should be 16 tiles at 1920 x 1080 per frame, 126.6 MiB RGBA per frame. Endpoint can plan 15360 x 8640, 64 tiles, 506.3 MiB RGBA per frame. | Finding F-CD-001, F-CD-002, F-CD-003. |
| Render Path Video | Same as Render Out because it creates `CaptureVideoRenderJobV1` and uses the same local renderer runner. | Same mismatch. | Same risk, multiplied by path frame count. | Finding F-CD-002 and F-CD-003. |
| Still Capture | Self-test exact 7680 x 4320 passed. | Tiled still tool normalizes recipe supersample to 1 and uses fixed 8K target. Provider still preflights raw 2x before fallback. | 16 tiles, 1920 x 1080, 132,710,400 RGBA bytes. | Still tool pass; provider raw-scale fallback issue in F-CD-001. |
| External/tiled Still Capture | Exact 7680 x 4320. | Tool normalizes recipe supersample to 1. | 16 tiles; Sharp compositing likely bottleneck after base64 bridge. | No tool defect found in bounded smoke. |
| Scroll package output | Request validators enforce exact 7680 x 4320 for `8k`. | Render job carries current `supersampleScale`; endpoint launches video tool without explicit `--superscale`. | 8K full timeline frame count can generate very large frame directories. | Finding F-CD-002 and F-CD-003. |
| Multi-format Scroll Animation | Primary frames are rendered once, then secondary formats encode from same frame directory. | Same render superscale risk on first render. | Secondary encode risk is FFmpeg-bound; current code records warnings without discarding primary. | No secondary-format discard issue found. |
| PNG sequence output | Frames-only route still uses same video renderer frame plan. | Same superscale launch risk. | Disk-write and frame directory size are likely bottlenecks. | Finding F-CD-002. |

8K resource envelope for correct 1x delivery:

- Output dimensions: 7680 x 4320.
- Effective supersample: 1x.
- Default tile size: 1920 x 1080.
- Tile count: 16.
- RGBA byte scale: 33,177,600 pixels x 4 = 132,710,400 bytes per full frame, about 126.6 MiB.
- One-frame synthetic MP4 smoke output: 545,504 bytes.
- Likely real-scene bottlenecks: GPU tile render, base64 bridge, Sharp compositing, FFmpeg encode, disk write, then dev-server polling.

8K resource envelope for current endpoint default 2x risk:

- Render dimensions: 15360 x 8640.
- Default tile count: 64 at 1920 x 1080.
- RGBA byte scale: 132,710,400 pixels x 4 = 530,841,600 bytes per frame, about 506.3 MiB.
- Risk: browser/GPU memory pressure, black/empty frames, very slow base64 bridge, huge frame directory, and misleading status polling.

## Failure-Mode Matrix

| Failure mode | Current handling | Risk or bug | Recommended follow-up |
|---|---|---|---|
| Local renderer endpoint unavailable | UI catches local start/poll error and publishes JSON fallback. | Good fallback, but JSON can look like completed output in job history. | Make `fallbackOnly` visually distinct from completed media. |
| `ffmpeg-static`, `FFMPEG_PATH`, PATH FFmpeg unavailable | Availability endpoint reports unavailable; local route should fall back. | No failure observed in static/Node checks. | Add endpoint-level test with missing FFmpeg env/path. |
| GPU launch falls back to SwiftShader/software | Renderer diagnostics include GPU/renderer; plugin surfaces renderer. | Risk if software fallback is not blocked unless allowed. | Add smoke asserting software fallback is flagged and not silently accepted for real 8K. |
| Renderer produces zero-byte playable output | Tool validates final output size; endpoint marks failed. | Zero-byte frame message has a `frameIndex` ReferenceError risk. | Fix diagnostic variable and add zero-byte frame test. |
| Playable output succeeds but master `.mov` missing/zero-byte | Endpoint clears `masterUrl`; playable remains complete. | Good behavior. | Add test to assert playable success does not fail without master. |
| Diagnostics missing/malformed | Endpoint treats diagnostics enrichment as best-effort. | Missing diagnostics can hide superscale/renderer evidence. | Mark completed status with `diagnosticsMissing` warning. |
| Cancel during frame render | Child kill; video output and diagnostics removed. | Master `.mov` partial is not removed. | Remove `run.masterPath` on video cancel. |
| Cancel during FFmpeg encode | Child kill; video status cancelled. Scroll package writes cancelled manifest with frames. | Video master partial cleanup gap remains. | Test cancel during master encode. |
| Cancel after child exit before status poll | Endpoint state may already be complete; cancel returns public status. | No confirmed bug. | Add race test. |
| Output URL before completion | `/api/capture/video-output` returns 409. | Good. | Keep endpoint test. |
| Output URL unknown run | Returns 404. | Good. | Keep endpoint test. |
| Output path missing after completed status | Output route returns 404. | Good, but status may still say complete. | Add warning status if file disappears after completion. |
| Scroll secondary format fails after primary succeeds | Warning recorded and primary kept. | Good. | Add multi-format failure injection test. |
| Scroll manifest partial/cancelled/failed | Cancel and failed manifests retain frames/diagnostics status. | Good. | Keep existing runtime tests. |
| Browser FFmpeg load/import/MEMFS/write/encode stalls | Runtime adapter tests cover lazy load, abort, cleanup, and stalled exec. | Asset validator checks UMD while Vite serves ESM. | Update validator to check served ESM assets. |
| File picker cancelled after successful still render | Save helper reports cancelled/unavailable and keeps download fallback. | No confirmed issue. | Add browser check once popout tests are updated. |
| Object URL revoked too early or not revoked | Runtime tests cover capture job cleanup; provider revokes old JSON/media URLs. | No confirmed issue. | Keep URL cleanup tests. |

## Output Custody Audit

Confirmed custody boundaries:

- Video job JSON: `.tmp/capture-video-jobs` in `plugins/vite-plugin-author-write.ts:849`.
- Render Out videos: `media_output/capture-video-outputs` in `plugins/vite-plugin-author-write.ts:850`.
- Scroll package job JSON: `.tmp/capture-scroll-package-jobs` in `plugins/vite-plugin-author-write.ts:1137`.
- Scroll package outputs: `media_output/capture-scroll-outputs` by default in `plugins/vite-plugin-author-write.ts:51` and `plugins/vite-plugin-author-write.ts:1125`.
- Scroll destination/package path safety is guarded by browser and Node contracts; `captureScrollTimeline.ts:331-340` rejects URI, absolute, and parent paths; `plugins/scroll-package-contract.ts:597-603` mirrors destination/package validation.
- No inspected Capture Director output path writes to `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/environment.json`, `projects/*/project.json`, or browser local storage unless explicit recipe/path save actions are used.

Custody issues:

- Video cancel removes `run.outputPath` and `run.diagnosticsPath`, but not `run.masterPath`; see `plugins/vite-plugin-author-write.ts:1698-1701`.
- Docs contain stale `.tmp/capture-video-outputs` prose while current code writes video outputs to `media_output/capture-video-outputs`.

## Render-Stack Trace Sample

Sample source: synthetic deterministic 8K video smoke, command:

```powershell
node tools\render-capture-video-job.mjs --job .tmp\capture-video-8k-smoke-job.json --out .tmp\capture-video-8k-synthetic-smoke.mp4 --synthetic --superscale 1 --master none --no-keep-frames
```

Trace fields:

- Workflow: Render Out video through Node renderer, synthetic mode.
- `environment.scene`: not present in synthetic fixture; `recipe.environmentState` is `null`.
- Sub Master `envSnapshot`: not captured by synthetic fixture.
- Render preset and `scenePatch`: none in synthetic fixture; `recipe.qualityPreset` is `render-8k`.
- Page `sceneOverrides`: none in synthetic fixture.
- Capture recipe mode: `scene-only`.
- Capture grade: not present in fixture output; treated as clean/no overlay in synthetic mode.
- Effective resolution: 7680 x 4320.
- Effective supersample: 1.
- Layer visibility/styles: `{}` and `{}`.
- Topo material authority: not present in synthetic fixture.
- Active texture URL/cache key: not present in synthetic fixture.
- Shader/material identity: synthetic tile generator, not app scene shader.
- Mesh/geometry authority: synthetic tile grid, not app scene geometry.
- Public clip state: not present in synthetic fixture.
- Material edge fade state: not present in synthetic fixture.
- Edge outline state: not present in synthetic fixture.
- Active render preset: `render-8k`.
- Capture Director overlays/chrome: gated out; synthetic diagnostics report no overlay compositing.

Trace outcome:

- Delivery: 7680 x 4320 MP4.
- Render: 7680 x 4320 at superscale 1.
- Tiles: 16 at 1920 x 1080.
- Playable output: `.tmp\capture-video-8k-synthetic-smoke.mp4`, 545,504 bytes.

Boundary: this trace validates renderer plumbing, exact-size tiling, and FFmpeg output for a synthetic source only. It does not prove real scene visual correctness, topo/raster texture authority, material state, or live browser output.

## Doc And Code Drift Ledger

| ID | Drift | Evidence | Recommendation |
|---|---|---|---|
| D-001 | Video output path docs conflict. | README says `media_output/capture-video-outputs` at `docs/capture-director/README.md:133`, but also says `.tmp/capture-video-outputs` at `docs/capture-director/README.md:366`; DEC-142 says `.tmp` at `docs/03-decisions.md:2204`, while DEC-174 says `media_output` at `docs/03-decisions.md:3240-3241`. Code writes `media_output/capture-video-outputs` at `plugins/vite-plugin-author-write.ts:850`. | Normalize docs to current `media_output` behavior and mark DEC-142 superseded by DEC-174. |
| D-002 | FFmpeg runtime asset validator checks UMD files while Vite serves ESM files. | Vite comments and copy list use ESM in `vite.config.ts:49-55`; validator checks `node_modules/@ffmpeg/core/dist/umd` in `tools/validate-runtime-assets.mjs:389-400`. | Update validator to assert the exact served ESM assets plus package lock. |
| D-003 | Playwright helper expectations drifted from popout/two-step UI. | Tests wait for `capture-mode-select` or `capture-render-resolution-select` without opening Record popouts; Camera Path add now opens a Keyframe/Transition popover. | Update helpers to open the correct popout and choose `capture-camera-add-kind-keyframe`. |

## Verification Command Table

| Command | Result | Evidence |
|---|---:|---|
| `git status --short --branch` | PASS with dirty workspace | Branch `main`; broad pre-existing dirty files; no audit source edits. |
| `npm run check:workspace` | PASS | No snapshot-sensitive local files; broad verification not limited by presentation sketch files. |
| `node tests/tools/capture-director-source.test.mjs` | PASS | 59/59 passed. |
| `node tests/tools/capture-director-runtime.test.mjs` | PASS | 80/80 passed. |
| `node tests/tools/capture-director-camera-path-v2-runtime.test.mjs` | PASS | 12/12 passed. |
| `node tests/tools/capture-director-camera-path-v3-runtime.test.mjs` | PASS | 9/9 passed. |
| `node tests/tools/capture-director-camera-path-v3-spline-runtime.test.mjs` | PASS | 13/13 passed. |
| `npm run check:runtime-assets` | PASS | `PASS runtime asset wiring`. |
| `npm run build` | PASS | `tsc -b && vite build`; 418 modules transformed. |
| `node tools\render-capture-still-job.mjs --self-test` | PASS | Exact 7680 x 4320 output; 16 tiles; `status: pass`; final PNG 12,132,135 bytes. |
| Generated `.tmp\capture-video-8k-smoke-job.json` | PASS | Derived from `tests\fixtures\capture-video-render-job-v1.json`; job id `fixture-video-7680x4320-1f`. |
| `node tools\render-capture-video-job.mjs --job .tmp\capture-video-8k-smoke-job.json --out .tmp\capture-video-8k-synthetic-smoke.mp4 --synthetic --superscale 1 --master none --no-keep-frames` | PASS | Exact 7680 x 4320 MP4; 16 tiles; `supersample: 1`; output 545,504 bytes. |
| `npm run check:visual-qa-clean` before Playwright | PASS | No snapshot-sensitive local files. |
| `npx playwright test tests/utah-forge/capture-director.spec.ts tests/utah-forge/capture-director-load.spec.ts tests/utah-forge/capture-director-realtime.spec.ts tests/utah-forge/capture-director-render-still.spec.ts tests/utah-forge/capture-director-camera-path.spec.ts tests/utah-forge/capture-director-camera-path-v3-surfacing.spec.ts --workers=1` | FAIL | 2 passed, 6 failed. Repeated failures waited for hidden/moved controls or missing path rows. |
| `npm run check:visual-qa-clean` after Playwright | PASS | No snapshot-sensitive local files. |

Playwright failure text:

- `capture-director-camera-path-v3-surfacing.spec.ts`: expected `capture-path-row` count 3, received 0.
- `capture-director-camera-path.spec.ts`: `capture-timeline-scrubber` element not found.
- `capture-director-realtime.spec.ts`: timeout waiting for `capture-mode-select`.
- `capture-director-render-still.spec.ts`: timeout waiting for `capture-mode-select` and `capture-render-resolution-select`.

## Findings Inventory

### F-CD-001 - High - Raw Supersample State Breaks 8K Clamp Contract

Confidence: high  
Affected workflow: Render Out, Still Capture, Scroll package recipe creation  
Fix scope: source-only plus runtime tests

Evidence:

- `captureResolution.ts:143-149` documents clamping so 4K uses 2x and 8K uses 1x.
- `CaptureDirectorToolbar.tsx:1745-1752` displays an effective clamped value with `clampCaptureSupersampleScale`.
- `CaptureDirectorProvider.tsx:3230-3234` stores raw selected supersample without resolution-aware clamping.
- `CaptureDirectorProvider.tsx:5205-5213` validates Render Out using raw `recipe.supersampleScale`.
- `CaptureDirectorProvider.tsx:6157-6164` validates Still Capture using raw `recipe.supersampleScale`.

Impact:

Selecting 8K while the supersample selector is 2x can display an effective exact 8K/1x status but still fail provider preflight as 8K at 2x. Still Capture can publish an external JSON fallback instead of attempting the intended 8K route. Render Out can fail before the local renderer path.

Recommendation:

Compute and store an explicit effective supersample per recipe/output route. Provider validation, recipe serialization, local job generation, and UI display should use the same effective value. For 8K, the effective value should be 1.

Smallest follow-up verification:

- Unit test: selected supersample 2 + render preset 8K produces valid effective supersample 1.
- Browser test: switch 4K 2x to 8K and verify no false `exceeds 7680x4320` preflight error.

### F-CD-002 - High - Local Video Renderer Defaults 8K Jobs To 2x Superscale

Confidence: high  
Affected workflow: Render Out video, Render Path Video, Scroll package video, PNG sequence  
Fix scope: local-renderer and dev-server endpoint

Evidence:

- `tools/render-capture-video-job.mjs:16` sets `DEFAULT_SUPERSCALE = 2`.
- `tools/render-capture-video-job.mjs:568` uses `superscale = DEFAULT_SUPERSCALE`.
- `tools/render-capture-video-job.mjs:175-176` multiplies target dimensions by superscale.
- `plugins/vite-plugin-author-write.ts:880-888` starts video renderer without `--superscale`.
- `plugins/vite-plugin-author-write.ts:1191-1212` starts scroll package renderer without `--superscale`.
- The explicit smoke command with `--superscale 1` reported 7680 x 4320 render; without that flag an 8K job would plan 15360 x 8640.

Impact:

Accepted 8K local jobs can allocate a 15360 x 8640 render plan: 64 default tiles and about 506 MiB RGBA per frame. This contradicts the documented 8K memory budget and can cause stalls, black frames, huge temporary frame directories, or misleading status polling.

Recommendation:

Derive effective superscale from delivery dimensions in the app and/or endpoint, then pass `--superscale 1` for 8K. Consider changing the CLI default to safe `1` and letting callers opt into 2x only when validated.

Smallest follow-up verification:

- Endpoint unit/source test asserting 8K jobs spawn `render-capture-video-job.mjs --superscale 1`.
- Synthetic endpoint smoke that reports `render.width === 7680`, not `15360`.

### F-CD-003 - High - Endpoint Job Validation Rejects Documented 4K 2x Supersample Jobs

Confidence: high  
Affected workflow: Render Out video, Render Path Video, Scroll package video  
Fix scope: source-only plus endpoint/runtime tests

Evidence:

- UI exposes 2x supersample in `CaptureDirectorToolbar.tsx:1708-1721`.
- 4K 2x is explicitly documented as within budget in `captureResolution.ts:143-149` and `docs/03-decisions.md:3351-3354`.
- `externalVideoRenderJob.ts:188-189` rejects any `recipe.supersampleScale !== 1`.
- `plugins/vite-plugin-author-write.ts:412-413` rejects any local video job whose recipe supersample is not 1.
- `tools/render-capture-video-job.mjs:81-87` would normalize recipe supersample to 1, but the endpoint rejects before invoking the tool.

Impact:

4K deterministic video with the documented 2x supersample setting can pass provider preflight, route to the local renderer, then be rejected by the dev endpoint and fall back to manual JSON. That turns a normal local-renderer success path into fallback-only output.

Recommendation:

Separate recipe-authored UI supersample from renderer effective superscale. Endpoint validation should accept a job plus an explicit renderer superscale, or the provider should normalize the job recipe before sending while preserving original UI intent in diagnostics.

Smallest follow-up verification:

- Runtime test creating a 4K recipe with selected supersample 2 and proving local endpoint accepts it with effective renderer superscale 2.

### F-CD-004 - Medium - Browser Verification Suite Drifted From Current Capture Director UI

Confidence: high  
Affected workflow: Realtime Capture, Render Out, Still Capture, Camera Path authoring  
Fix scope: tests/browser workflow helpers; possible UI regression only if product intended one-click behavior

Evidence:

- Playwright run: 2 passed, 6 failed.
- Failure contexts show Capture Director opened, but `capture-mode-select` and `capture-render-resolution-select` were absent because Realtime/Video/Still controls are now inside Record/Still popouts.
- `CaptureDirectorToolbar.tsx:1490-1597` places realtime mode select inside `CaptureRecordPopout`.
- `CaptureDirectorToolbar.tsx:1619-1632` places video render controls inside `CaptureRecordPopout`.
- `CaptureDirectorToolbar.tsx:2375-2377` now opens a camera-add kind popover rather than directly adding a keyframe.
- `tests/utah-forge/capture-director-helpers.ts:314-327` dispatches only one click and does not choose `capture-camera-add-kind-keyframe`.

Impact:

Browser verification is blocked for several Capture Director workflows. Current failed tests cannot prove product behavior. Camera Path tests may be testing stale one-click behavior rather than the current Keyframe/Transition selection flow.

Recommendation:

Update Playwright helpers to open the relevant popout before selecting controls and to choose Keyframe in the camera-add popover. After helper update, rerun the same browser suite and classify any remaining failures as product defects.

Smallest follow-up verification:

- Targeted Playwright helper patch and rerun of the six failed specs only.

### F-CD-005 - Medium - Video Cancel Cleanup Can Leave Partial ProRes Master Files

Confidence: medium  
Affected workflow: Render Out video, Render Path Video  
Fix scope: dev-server endpoint/local-renderer

Evidence:

- Video run creates `masterPath` at `plugins/vite-plugin-author-write.ts:858`.
- Public status can include `masterPath` and `masterUrl` at `plugins/vite-plugin-author-write.ts:875-876`.
- Cancel removes only `run.outputPath` and `run.diagnosticsPath` at `plugins/vite-plugin-author-write.ts:1698-1701`.

Impact:

Cancel during or after master encode can leave a partial `.master.mov` in `media_output/capture-video-outputs`. This violates clean output custody and can confuse later artifact review.

Recommendation:

Include `run.masterPath` in video cancel cleanup. Preserve diagnostics only when intentional; otherwise mark cancellation with a small JSON sidecar instead of deleting only some outputs.

Smallest follow-up verification:

- Endpoint cancel test that seeds output, diagnostics, and master paths and verifies only intended artifacts remain.

### F-CD-006 - Medium - Zero-Byte Frame Error References Undefined `frameIndex`

Confidence: high  
Affected workflow: local video renderer diagnostics  
Fix scope: local-renderer source plus test

Evidence:

- `tools/render-capture-video-job.mjs:660` defines `actualFrameIndex`.
- `tools/render-capture-video-job.mjs:676-679` throws `frame ${frameIndex} produced zero bytes`, but `frameIndex` is not defined in that scope.

Impact:

A zero-byte frame failure can produce a secondary `ReferenceError` and hide the real frame index. This weakens diagnosis for the exact class of failures expected under 8K memory pressure.

Recommendation:

Use `actualFrameIndex` in the error string and add a zero-byte frame fixture test.

Smallest follow-up verification:

- Synthetic renderer test forcing one zero-byte frame and asserting the error names the correct frame number.

### F-CD-007 - Low - FFmpeg Asset Validation Does Not Guard The Served ESM Core

Confidence: medium  
Affected workflow: browser FFmpeg encode, Convert Preview to MP4  
Fix scope: verification-system

Evidence:

- Vite serves ESM FFmpeg core assets from `node_modules/@ffmpeg/core/dist/esm` per `vite.config.ts:49-55`.
- `tools/validate-runtime-assets.mjs:389-400` checks `node_modules/@ffmpeg/core/dist/umd`.
- `npm run check:runtime-assets` passed, proving current install has the checked UMD assets but not proving the served ESM path.

Impact:

`check:runtime-assets` can pass while the actual browser-served ESM FFmpeg core is missing or mis-copied.

Recommendation:

Update the validator to check ESM `ffmpeg-core.js`, `ffmpeg-core.wasm`, and expected worker 404 behavior or file presence as used by Vite.

Smallest follow-up verification:

- Temporarily point validator at the served ESM list and rerun `npm run check:runtime-assets`.

### F-CD-008 - Low - Capture Director Docs Retain Stale `.tmp/capture-video-outputs` Path

Confidence: high  
Affected workflow: operator handoff/docs  
Fix scope: docs

Evidence:

- Current code writes video outputs to `media_output/capture-video-outputs` at `plugins/vite-plugin-author-write.ts:850`.
- Current README also says `media_output/capture-video-outputs` at `docs/capture-director/README.md:133`.
- The same README says `.tmp/capture-video-outputs` at `docs/capture-director/README.md:366`.
- DEC-142 says `.tmp/capture-video-outputs` at `docs/03-decisions.md:2204`; DEC-174 says `media_output/capture-video-outputs` at `docs/03-decisions.md:3240-3241`.

Impact:

Operators can look in the wrong directory or classify persistent render outputs as temporary.

Recommendation:

Normalize Capture Director docs to `media_output/capture-video-outputs` and add a supersedes note to the older decision text if edited through a new decision entry.

Smallest follow-up verification:

- `rg "\.tmp/capture-video-outputs|media_output/capture-video-outputs" docs/capture-director docs/03-decisions.md`.

## No-Finding Statements

- 8K is not exposed through realtime preview presets: `CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER` excludes `render-8k`, and source/runtime tests passed this contract.
- Exact 8K dimensions are enforced for capture resolution and scroll request quality; malformed partial 8K dimensions are rejected.
- External/tiled still self-test validates exact 7680 x 4320 assembly with 16 tiles.
- Scroll package secondary format failure handling keeps primary output and records warnings by design.
- Output serving returns expected 409 for incomplete video/media and 404 for unknown/missing outputs in inspected code.
- Browser FFmpeg runtime tests cover lazy load, MEMFS-style file calls, abort forwarding, virtual cleanup, and stall rejection.

## Prioritized Fix Backlog

1. Unify effective supersample derivation across provider, recipe, external job, endpoint, and renderer CLI. Add explicit tests for 8K selected after 2x and 4K 2x local rendering.
2. Pass explicit `--superscale` from `/api/capture/render-video` and `/api/capture/scroll-package/start`; consider making CLI default `1`.
3. Relax or reshape local endpoint validation so documented 4K 2x jobs do not fall back to JSON.
4. Update Capture Director Playwright helpers for Record popouts and Camera Path Keyframe/Transition popover; rerun failed browser specs.
5. Fix zero-byte frame diagnostic variable and add a forced zero-byte frame test.
6. Include `masterPath` in video cancel cleanup.
7. Update FFmpeg runtime asset validation to match the served ESM core.
8. Normalize docs/decision prose around `media_output/capture-video-outputs`.

## Visual Confirmation Boundary

No running browser screen or generated Capture Director media file was visually inspected for final appearance during this audit. Playwright browser automation ran and produced failure artifacts, but the generated 8K MP4/PNG smoke outputs were not visually reviewed. Current conclusion is `ready for visual check`.

Visual confirmation still needed:

- Real-scene 8K Render Out after effective superscale fix.
- Real-scene Render Path Video at 4K and 8K.
- Real-scene 8K Still Capture with a topo/raster-heavy page.
- Scroll package MP4/WebM/PNG sequence at 8K with a short frame range.
- Verification of topo material authority, texture URL/cache key, shader/material identity, public clip, material edge fade, and edge outline on a live scene.
