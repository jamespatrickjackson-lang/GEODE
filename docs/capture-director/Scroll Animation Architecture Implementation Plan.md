# Scroll Animation Capture Director Implementation Plan

> **Completed (2026-06-17).** This plan shipped to `main` (merge `290cd71`):
> Tasks 1-9 landed plus the 2026-06-17 closeout. Unchecked `- [ ]` boxes below
> reflect the original drafting state, not remaining work. Net changes vs. the
> plan: FPS is 30/60 only (120 dropped per closeout), Record output is
> multi-format (a checkbox list, not a single format), and package output
> defaults to `media_output/`. See DEC-174 and `docs/capture-director/README.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scroll-animation Render Out workflow in Capture Director that previews authored camera/page motion, records deterministic 60 FPS output up to 8K, and produces a designer-ready `ScrollHandoffPackageV1`.

**Architecture:** Add scroll-specific contracts first, then wire UI and renderer behavior against those contracts. Keep Preview as onscreen playback and Record as a validated package render. Keep the Page Bar override and transition sampling behind explicit runtime seams so page state never depends on fixture edits.

**Tech Stack:** Vite, React, TypeScript, Three.js, Capture Director runtime modules, Node test scripts, local dev renderer, FFmpeg.

---

## Implementation Rules

- Work only on branch `CODEX_ScrollDirector_000` in `C:\GeoSee\Claude_WT\GeoSee_Dev\CODEX_ScrollDirector_000`.
- Preserve the baseline docs commit before source work starts.
- Add tests before each implementation slice.
- Do not mutate `projects/*/pages/**`, `projects/*/project.json`, or `projects/*/environment.json`.
- Do not use page ids, page titles, page indexes, or live page pairs as reusable app behavior proof.
- Keep existing realtime recording, still capture, Render Out, and Camera Path behavior working unless a task explicitly changes scroll-owned behavior.

## Target Files

- Create `src/capture/captureScrollTimeline.ts` for `CaptureScrollTimelineV1`, FPS policy, normalized progress, frame range, anchors, and timeline sampling.
- Create `src/capture/scrollHandoffPackage.ts` for `ScrollHandoffPackageV1` manifest construction, validation, file roles, and partial-package status.
- Modify `src/capture/captureTypes.ts` to add the scroll panel and scroll output format/profile types.
- Modify `src/capture/CaptureDirectorProvider.tsx` to own scroll UI state, preview state, record request validation, package job state, and Page Bar override hooks.
- Modify `src/capture/CaptureDirectorToolbar.tsx` to add the Scroll Animation container, Play/Pause/Stop controls, Record button, centered popout, and progressive format options.
- Modify `src/capture/externalVideoRenderJob.ts`, `src/capture/localVideoRenderRunner.ts`, `plugins/vite-plugin-author-write.ts`, and `tools/render-capture-video-job.mjs` to support scroll package output, PNG sequences, dense-keyframe video, and partial package preservation.
- Extend `tests/tools/capture-director-source.test.mjs` and `tests/tools/capture-director-runtime.test.mjs` as the source/runtime gates for every task.

## Task 1: Schema And FPS Gates

**Files:**
- Create: `src/capture/captureScrollTimeline.ts`
- Create: `src/capture/scrollHandoffPackage.ts`
- Modify: `src/capture/captureTypes.ts`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/tools/capture-director-runtime.test.mjs`

- [ ] **Step 1: Add failing source-test assertions**

Add assertions that require:

```js
for (const expected of [
  "CaptureScrollTimelineV1",
  "normalizeCaptureScrollTimeline",
  "validateCaptureScrollTimeline",
  "sampleCaptureScrollTimeline",
  "CAPTURE_SCROLL_FPS_OPTIONS",
  "DEFAULT_CAPTURE_SCROLL_FPS",
]) {
  assert.ok(scrollTimelineSource.includes(expected), `scroll timeline should include ${expected}`);
}

for (const expected of [
  "ScrollHandoffPackageV1",
  "createScrollHandoffManifest",
  "validateScrollHandoffManifest",
  '"complete"',
  '"partial"',
  '"cancelled"',
  '"failed"',
]) {
  assert.ok(scrollPackageSource.includes(expected), `scroll package should include ${expected}`);
}
```

- [ ] **Step 2: Add failing runtime-test assertions**

Add runtime cases that require:

```js
const {
  DEFAULT_CAPTURE_SCROLL_FPS,
  CAPTURE_SCROLL_FPS_OPTIONS,
  normalizeCaptureScrollTimeline,
  resolveCaptureScrollFrameRange,
  sampleCaptureScrollTimeline,
} = await importBundled("src/capture/captureScrollTimeline.ts");

assert.equal(DEFAULT_CAPTURE_SCROLL_FPS, 60);
assert.deepEqual(CAPTURE_SCROLL_FPS_OPTIONS, [30, 60, 120]);

const timeline = normalizeCaptureScrollTimeline({
  version: 1,
  fps: 60,
  durationSeconds: 10,
  range: { mode: "frame-range", startFrame: 120, endFrame: 239 },
  pageSource: { mode: "page-bar", fallback: "current-page" },
  cameraSource: { mode: "camera-path", pathId: "camera-spine" },
  anchors: [{ id: "intro", label: "Intro", progress: 0, posterFrame: 0 }],
  outputProfileId: "mp4-review",
});

assert.equal(timeline.fps, 60);
assert.deepEqual(resolveCaptureScrollFrameRange(timeline), {
  startFrame: 120,
  endFrame: 239,
  totalFrames: 120,
});
assert.equal(sampleCaptureScrollTimeline(timeline, 180).normalizedProgress, 0.3);
```

- [ ] **Step 3: Implement minimal scroll timeline module**

Create these exported contracts:

```ts
export const DEFAULT_CAPTURE_SCROLL_FPS = 60;
export const CAPTURE_SCROLL_FPS_OPTIONS = [30, 60, 120] as const;
export type CaptureScrollFps = (typeof CAPTURE_SCROLL_FPS_OPTIONS)[number];

export type CaptureScrollFrameRange =
  | { mode: "full" }
  | { mode: "frame-range"; startFrame: number; endFrame: number };

export interface CaptureScrollTimelineV1 {
  version: 1;
  fps: CaptureScrollFps;
  durationSeconds: number;
  range: CaptureScrollFrameRange;
  pageSource: { mode: "page-bar" | "current-page"; fallback: "current-page" | "none" };
  cameraSource: { mode: "camera-path" | "current-camera"; pathId: string | null };
  anchors: Array<{ id: string; label: string; progress: number; posterFrame?: number | null }>;
  outputProfileId: string;
}
```

Rules:

- default FPS is 60;
- range frame indexes are zero-based and inclusive;
- duration derives total frames through `Math.ceil(durationSeconds * fps)`;
- normalized progress is clamped `0..1`;
- full range resolves to `0..totalFrames - 1`;
- invalid frame ranges return validation errors instead of silent repair.

- [ ] **Step 4: Implement minimal handoff package module**

Create these exported contracts:

```ts
export type ScrollHandoffPackageStatus =
  | "complete"
  | "partial"
  | "cancelled"
  | "failed";

export interface ScrollHandoffPackageV1 {
  schema: "ScrollHandoffPackageV1";
  version: 1;
  packageId: string;
  status: ScrollHandoffPackageStatus;
  createdAt: string;
  outputProfileId: string;
  fps: number;
  durationSeconds: number;
  frameRange: { startFrame: number; endFrame: number; totalFrames: number };
  media: Array<{ role: "primary" | "delivery" | "scroll-friendly"; path: string; mimeType: string; byteLength?: number }>;
  frames: { directory: string | null; pattern: string | null; count: number };
  posters: Array<{ anchorId: string; frame: number; path: string }>;
  contactSheetPath: string | null;
  sourceContract: Record<string, unknown>;
  diagnosticsPath: string | null;
  hashes: Array<{ path: string; sha256: string }>;
  warnings: string[];
}
```

Rules:

- complete packages require at least one media file or a frame sequence;
- partial/cancelled/failed packages may contain any safely written files;
- all file paths are package-relative;
- package status must never be inferred from missing files alone.

- [ ] **Step 5: Run and commit**

Run:

```powershell
node tests/tools/capture-director-source.test.mjs
node tests/tools/capture-director-runtime.test.mjs
git diff --check -- src/capture tests/tools
git add src/capture/captureScrollTimeline.ts src/capture/scrollHandoffPackage.ts src/capture/captureTypes.ts tests/tools/capture-director-source.test.mjs tests/tools/capture-director-runtime.test.mjs
git commit -m "feat: add scroll animation capture contracts"
```

## Task 2: Scroll Animation UI Container And Record Popout

**Files:**
- Modify: `src/capture/captureTypes.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/capture/CaptureDirectorToolbar.tsx`
- Test: `tests/tools/capture-director-source.test.mjs`

- [ ] **Step 1: Add failing source-test assertions**

Require:

```js
for (const expected of [
  '"scroll-animation"',
  "capture-scroll-panel",
  "capture-scroll-play",
  "capture-scroll-pause",
  "capture-scroll-stop",
  "capture-scroll-record",
  "capture-scroll-record-popout",
  "capture-scroll-advanced-toggle",
  "Accept and Render",
]) {
  assert.ok(toolbarSource.includes(expected) || typesSource.includes(expected), `scroll UI should include ${expected}`);
}
```

- [ ] **Step 2: Add panel and provider state**

Add `scroll-animation` to `CaptureDirectorPanel`.

Provider state must include:

- selected scroll output format;
- selected quality preset;
- range mode;
- start/end frame;
- save destination label/path;
- advanced disclosure open/closed;
- preview state: idle, playing, paused;
- record popout open/closed;
- last package path and last manifest path.

- [ ] **Step 3: Add Scroll Animation section**

Toolbar behavior:

- section title: `Scroll Animation`;
- Play starts onscreen preview only;
- Pause pauses preview only;
- Stop resets preview to selected range start;
- Record opens the centered popout;
- Open Output appears only after a completed or partial package exists.

The section must not start the renderer directly.

- [ ] **Step 4: Add Record popout**

Default popout fields:

- Format: MP4, WebM, Scroll-Friendly Video, PNG Sequence;
- Quality: 1080p, 1440p, 4K, 6K, 8K where available;
- Range: Full video or Frame range;
- Save destination;
- output package name;
- estimated frame count and render size;
- `Advanced` disclosure.

Each default field includes one short explanation line. Advanced fields render only when the disclosure is open and only for the selected format.

- [ ] **Step 5: Run and commit**

Run:

```powershell
node tests/tools/capture-director-source.test.mjs
git diff --check -- src/capture tests/tools
git add src/capture/captureTypes.ts src/capture/CaptureDirectorProvider.tsx src/capture/CaptureDirectorToolbar.tsx tests/tools/capture-director-source.test.mjs
git commit -m "feat: add scroll animation capture director shell"
```

## Task 3: Record Request Validation And Package Manifest

**Files:**
- Modify: `src/capture/captureScrollTimeline.ts`
- Modify: `src/capture/scrollHandoffPackage.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Test: `tests/tools/capture-director-runtime.test.mjs`

- [ ] **Step 1: Add failing runtime tests**

Require:

```js
const {
  createScrollRecordRequest,
  validateScrollRecordRequest,
} = await importBundled("src/capture/captureScrollTimeline.ts");
const {
  createScrollHandoffManifest,
  validateScrollHandoffManifest,
} = await importBundled("src/capture/scrollHandoffPackage.ts");

const request = createScrollRecordRequest({
  timeline,
  format: "png-sequence",
  quality: { id: "render-8k", width: 7680, height: 4320 },
  packageName: "utah-forge-scroll",
  destination: { kind: "local-output-lane", path: ".tmp/capture-scroll/utah-forge-scroll" },
});
assert.equal(validateScrollRecordRequest(request).valid, true);

const manifest = createScrollHandoffManifest({
  request,
  packageId: "utah-forge-scroll-001",
  status: "partial",
  media: [],
  frames: { directory: "frames", pattern: "frame-%06d.png", count: 10 },
  warnings: ["cancelled during render"],
});
assert.equal(validateScrollHandoffManifest(manifest).valid, true);
```

- [ ] **Step 2: Implement record request type**

Add a scroll record request with:

- selected timeline;
- format profile;
- quality/resolution;
- frame range;
- destination;
- package name;
- advanced encoder options;
- clean render mode flag;
- created timestamp.

Validation must reject:

- empty package name;
- unsupported format;
- unsupported FPS;
- frame range outside timeline;
- 4K-or-higher output without external-render route availability unless fallback is explicit;
- 8K output when exact render size cannot be produced.

- [ ] **Step 3: Wire provider validation**

Record popout `Accept and Render` must:

- build the request;
- validate it;
- show validation errors in the popout;
- close the popout only after validation passes;
- create a capture job record without rendering media until the renderer task is wired.

- [ ] **Step 4: Run and commit**

Run:

```powershell
node tests/tools/capture-director-runtime.test.mjs
git diff --check -- src/capture tests/tools
git add src/capture/captureScrollTimeline.ts src/capture/scrollHandoffPackage.ts src/capture/CaptureDirectorProvider.tsx tests/tools/capture-director-runtime.test.mjs
git commit -m "feat: validate scroll record package requests"
```

## Task 4: Output Package Writer And Partial Cancellation

**Files:**
- Modify: `src/capture/scrollHandoffPackage.ts`
- Modify: `src/capture/localVideoRenderRunner.ts`
- Modify: `plugins/vite-plugin-author-write.ts`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/tools/capture-director-runtime.test.mjs`

- [ ] **Step 1: Add failing tests**

Test expectations:

- local package runs expose a package path;
- cancelling a scroll package marks status `cancelled`;
- completed frames remain listed in the manifest;
- diagnostics are not deleted for accepted scroll packages;
- existing video cancel endpoint keeps legacy delete behavior for non-scroll jobs.

- [ ] **Step 2: Add package writer endpoints**

Add dev-only endpoints:

- `POST /api/capture/scroll-package/start`
- `POST /api/capture/scroll-package/status`
- `POST /api/capture/scroll-package/cancel`
- `GET /api/capture/scroll-package-output`

Rules:

- accepted scroll package folders live under `.tmp/capture-scroll-outputs/` unless File System Access supplies a real destination;
- writes are package-relative and path-safe;
- manifest is written at start with `status: "partial"`;
- manifest is updated to `complete`, `cancelled`, or `failed` at the end;
- cancellation never deletes completed frames or diagnostics.

- [ ] **Step 3: Add provider package status handling**

Provider state must expose:

- package path;
- manifest path;
- package status;
- rendered frames;
- total frames;
- current phase;
- warnings;
- Open Output URL when available.

- [ ] **Step 4: Run and commit**

Run:

```powershell
node tests/tools/capture-director-source.test.mjs
node tests/tools/capture-director-runtime.test.mjs
git diff --check -- src/capture plugins tests/tools
git add src/capture/scrollHandoffPackage.ts src/capture/localVideoRenderRunner.ts plugins/vite-plugin-author-write.ts tests/tools/capture-director-source.test.mjs tests/tools/capture-director-runtime.test.mjs
git commit -m "feat: add scroll output package lifecycle"
```

## Task 5: External Renderer Profiles And PNG Sequence Output

**Files:**
- Modify: `src/capture/externalVideoRenderJob.ts`
- Modify: `src/capture/frameSequenceVideoEncoder.ts`
- Modify: `tools/render-capture-video-job.mjs`
- Modify: `plugins/vite-plugin-author-write.ts`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/tools/capture-director-runtime.test.mjs`

- [ ] **Step 1: Add failing encoder and renderer tests**

Require:

- MP4 review profile;
- WebM delivery profile;
- Scroll-Friendly Video profile with dense keyframes;
- PNG Sequence profile with `frame-%06d.png`;
- renderer diagnostics include profile id, frame range, and package path.

- [ ] **Step 2: Extend output profiles**

Profiles:

- `mp4-review`: H.264, `yuv420p`, faststart, normal GOP;
- `webm-delivery`: VP9, `yuv420p`, row multithreading;
- `scroll-friendly-mp4`: H.264, dense keyframes every 5 frames by default;
- `scroll-friendly-all-keyframe`: H.264, every frame is a keyframe;
- `png-sequence`: PNG frames only, no video encode required.

- [ ] **Step 3: Add frame range support**

Renderer must accept `startFrame`, `endFrame`, and `totalFrames`. It must render only the selected inclusive frame range while preserving original timeline frame numbers in filenames and diagnostics.

- [ ] **Step 4: Preserve source frames**

For scroll packages, source frames stay in `frames/` unless the selected format explicitly excludes them through Advanced settings. Cancellation during encoding must keep frames.

- [ ] **Step 5: Run and commit**

Run:

```powershell
node tests/tools/capture-director-source.test.mjs
node tests/tools/capture-director-runtime.test.mjs
git diff --check -- src/capture plugins tools tests/tools
git add src/capture/externalVideoRenderJob.ts src/capture/frameSequenceVideoEncoder.ts tools/render-capture-video-job.mjs plugins/vite-plugin-author-write.ts tests/tools/capture-director-source.test.mjs tests/tools/capture-director-runtime.test.mjs
git commit -m "feat: render scroll packages with delivery profiles"
```

## Task 6: Page Bar Override And Transition Sampling

**Files:**
- Modify: `src/capture/captureScrollTimeline.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/pages/PageController.tsx`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/tools/capture-director-runtime.test.mjs`

- [ ] **Step 1: Add failing tests**

Require:

- scroll preview can select active Page Bar clip without changing saved `selectedPageId`;
- empty Page Bar records explicit current-page fallback;
- transition samples expose `sourcePageId`, `targetPageId`, and `transitionProgress`;
- source tests forbid page-id, page-title, and page-index special cases in scroll capture modules.

- [ ] **Step 2: Add runtime seam**

Add a Page Controller method that accepts a capture-only page source sample:

```ts
previewCapturePageSource(sample: {
  sourcePageId: string | null;
  targetPageId: string | null;
  transitionProgress: number;
  reason: "capture-scroll-preview" | "capture-scroll-record";
}): void;
```

Rules:

- session/runtime only;
- no page JSON writes;
- no project order writes;
- no camera path writes;
- normal authoring page selection restores after preview/record stops.

- [ ] **Step 3: Connect scroll timeline sampling**

`sampleCaptureScrollTimeline()` must produce page source samples that include:

- current clip id;
- source page id;
- target page id;
- local time;
- transition progress;
- transition easing;
- fallback mode.

- [ ] **Step 4: Use transition contract**

When source and target page differ, route effective scene changes through existing transition runtime behavior or a deterministic equivalent that uses the same source live graph and target resolved graph semantics. Bare camera pose tweening remains valid only for same-page camera movement.

- [ ] **Step 5: Run and commit**

Run:

```powershell
node tests/tools/capture-director-source.test.mjs
node tests/tools/capture-director-runtime.test.mjs
git diff --check -- src/capture src/pages tests/tools
git add src/capture/captureScrollTimeline.ts src/capture/CaptureDirectorProvider.tsx src/pages/PageController.tsx tests/tools/capture-director-source.test.mjs tests/tools/capture-director-runtime.test.mjs
git commit -m "feat: sample scroll page bar transitions"
```

## Task 7: Clean Render Mode, Posters, Contact Sheet, And Final Verification

**Files:**
- Modify: `src/capture/captureProfiles.ts`
- Modify: `src/capture/scrollHandoffPackage.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/capture/CaptureDirectorToolbar.tsx`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/tools/capture-director-runtime.test.mjs`

- [ ] **Step 1: Add failing tests**

Require:

- scroll Record uses Clean Render Mode before first frame;
- Capture Director toolbar, Camera Path overlay, lower timeline, page clip handles, debug panels, and authoring UI are absent from final frames unless an explicit export overlay is selected;
- poster frames are generated from named anchors;
- contact sheet lists key timeline frames;
- manifest records poster paths, contact sheet path, and clean-render settings.

- [ ] **Step 2: Add clean-render checklist**

Clean Render Mode must hide:

- Capture Director toolbar;
- Camera Path authoring overlay;
- camera location helpers;
- Page Bar authoring clips and handles;
- editor chrome;
- nav controls;
- debug panels;
- non-selected presenter overlays.

The selected export overlay, if any, must be explicit in the manifest.

- [ ] **Step 3: Generate posters and contact sheet**

Poster frames use anchor-defined frame numbers. Contact sheet uses selected anchor frames plus first, midpoint, and last frames when those frames are not already included.

- [ ] **Step 4: Full verification**

Run:

```powershell
node tests/tools/capture-director-source.test.mjs
node tests/tools/capture-director-runtime.test.mjs
npm run check:workspace -- --commit
git diff --check
git status --short --branch
```

Expected:

- tests pass;
- workspace check passes or reports only pre-existing unrelated dirt outside the safe worktree;
- no unstaged implementation files remain;
- branch contains only intentional scroll Capture Director commits.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/capture src/pages tests/tools plugins/vite-plugin-author-write.ts tools/render-capture-video-job.mjs
git commit -m "feat: complete scroll animation render handoff"
```

## Acceptance Criteria

- Scroll Animation appears as its own Capture Director container.
- Play previews scroll movement onscreen and does not create files.
- Record always opens the centered popout before rendering.
- Accepted Record creates a `ScrollHandoffPackageV1` folder.
- MP4, WebM, Scroll-Friendly Video, and PNG Sequence are supported output choices.
- 60 FPS is the default scroll timeline rate.
- 30, 60, and 120 FPS are valid scroll rates.
- Frame ranges are zero-based, inclusive, and validated against total timeline frames.
- 4K-or-higher final output prefers local external rendering.
- 8K fails clearly if exact-size output cannot be produced.
- Cancelled renders keep completed frames and a manifest marked `cancelled`.
- Page Bar preview/record override does not persist editor page selection.
- Page transitions are sampled through the transition runtime contract or a deterministic equivalent.
- No page fixture edits are needed for tests or runtime behavior.

## Task 8: Page Bar Precision Editor

**Intent:** Make the lower Page Bar precise enough for Scroll Animation timing
without changing render output contracts.

- Add a floating searchable page picker for `Add Page` and clip page
  replacement. The picker uses visible page options and does not silently insert
  the first/default page. It floats centered above the lower bar and scrolls
  internally for long page lists.
- Add selected-clip removal through Delete and Backspace only when the Page lane
  has focus and no text input is active.
- Use frame-primary labels at the Scroll Animation FPS. The default editing rate
  is 60 FPS, with duration labels also showing `x.xx s` time.
- Show start frame, end frame, and duration on each lane-filling Page clip.
  Double-clicking a frame value opens compact numeric entry.
- Add readable frame ruler ticks and snap points that scale with total timeline
  duration. For short timelines, the lower grid uses 0.1-second subdivisions and
  extends behind the Page and Camera Path bars.
- Keep edits local. Manual frame edits and boundary drags must affect only the
  selected clip and, when a shared boundary is involved, the one adjacent clip.
  Do not ripple timing across the full Page Bar line.
- Keep this as an authoring UI slice. Do not modify scroll package rendering,
  output manifests, page fixtures, or project files.

## Task 9: Scroll Page Bar Playhead Scene Preview

**Intent:** Make the lower Scroll Animation playhead the live preview authority
for Page Bar scene state while Camera Path remains the only camera-pose source.

- Add shared scroll playhead frame helpers for deterministic 60 FPS
  seconds-to-frame conversion, range clamping, and playback start selection.
- Route lower timeline placement through one provider-owned controller:
  seconds -> frame -> selected frame range -> `sampleCaptureScrollTimeline()` ->
  `previewCapturePageSource()` -> `sampleCaptureCameraPathV3()` ->
  `sceneHandle.setCameraPose()`.
- Clicking empty timeline/grid rail space, the time axis, or a Page clip places
  the Scroll Animation playhead. Clicking a Page clip also selects that clip and
  uses the clicked position inside the clip. Double-click page-name and timing
  editors keep editor behavior and do not scrub.
- `Play` starts from the current Scroll Animation playhead when it is inside the
  selected frame range; otherwise it starts at the range start. `Pause` leaves
  the sampled page state visible. `Stop` resets to the range start and clears
  capture page-source preview.
- Keep `window.__captureDirectorScrollPreview` DEV-only and add a hidden
  `data-testid="capture-scroll-preview-trace"` JSON DOM mirror for browser
  automation.
- Lower timeline footer Play/Pause use `playScrollPreview()` and
  `pauseScrollPreview()`, while the red footer record action opens the Scroll
  Record popout. Camera Path-only play and record preview remain available from
  the Camera Path panel controls.
- Add a hidden DEV-only `data-testid="capture-page-source-preview-trace"` mirror
  of the Page Controller capture page-source state so browser checks can verify
  the sampled page was resolved and applied without relying on page globals.
- Do not call page navigation, selected-page setters, `pageOrder`, or
  `projects/**` writes from this playhead path.
