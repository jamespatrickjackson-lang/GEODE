# Capture Director Camera Path Workflow Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair Capture Director camera-path authoring so Play Path, realtime path capture, deterministic render-out, still capture, focus lock, and the lower timeline all use one coherent path model.

**Architecture:** Make `CaptureCameraPathV2` the only editable path source. Display path nodes as ordered camera-view line items and display transition containers between adjacent active items. Recipes include a camera path only when an authored path is usable; otherwise still/render use the current camera pose without path validation failures.

**Tech Stack:** React, TypeScript, Three.js, Canvas 2D capture overlays, Playwright smoke tests, source/runtime Node tests.

---

## Current Audit

- `src/capture/captureCameraPathV2.ts` already models `keyframe` vs `transition` nodes, `holdSecondsAfter`, `transitionSeconds`, `lookMode`, `focusPointId`, display options, timeline resolution, path sampling, path movement, and focus binding.
- `src/capture/CaptureDirectorProvider.tsx` has playback, overlay, preview monitor, realtime recording, save/load, and focus binding hooks, but `createRecipeSnapshot()` always normalizes the current `captureCameraPathV2` even when it has no nodes.
- `src/capture/captureRecipe.ts` rejects empty `cameraPathV2.nodes`. That is correct for an authored path, but wrong when no path has been authored. This caused Still Capture to fail with `Invalid capture recipe: cameraPathV2.nodes must be a non-empty array.`
- `playCameraPath()` only checks for `nodes.length === 0`; it can still try to play a zero-duration or one-node path, and `startCameraPathPreviewRecording()` calls `startRecording()` even after `playCameraPath()` reports an invalid path.
- `src/capture/CaptureDirectorToolbar.tsx` currently presents global path draft controls and a legacy `cameraKeyframes` list. It does not make each `CaptureCameraPathV2.nodes[]` entry an editable ordered line item.
- The current keyframe list edits `cameraKeyframes.timeSeconds`, while the canonical v2 timeline derives node times from node holds and segment transition durations. That creates two competing timing systems.
- The lower timeline is currently a narrow range input plus text lanes. It does not represent hold blocks, transition blocks, selected nodes, inactive nodes, focus locks, or draggable timing handles like a video-editor timeline.
- The in-scene overlay and Line2 work are useful and should be kept, but the overlay must receive active/hidden state, ordered labels, selected node/segment state, and timeline sample state from the corrected path model.

## Product Model

### Ordered Camera View Items

Each path row represents one camera view item:

```ts
interface CaptureCameraPathNodeV2 {
  id: string;
  kind: "keyframe" | "transition";
  enabled: boolean;
  label: string;
  position: [number, number, number];
  target?: [number, number, number];
  focusPointId?: string;
  up: [number, number, number];
  fov: number;
  lookMode: "free-direction" | "focus-point-lock" | "follow-path-tangent";
  holdSecondsAfter: number;
}
```

Rules:
- Keyframe nodes are main camera views and may hold.
- Transition nodes shape the curve and cannot hold.
- Disabled nodes remain in the list and can be shown as ghosted overlay handles, but they are excluded from playback, render-out, and still camera-path sampling.
- Row numbering is display order: `01`, `02`, `03`, and so on. Numbers are not stored as permanent ids.
- Clicking a row selects that node, jumps the inspector to that node, highlights the scene handle, and optionally updates the preview monitor.

### Transition Containers

Each transition container appears between camera view item `N` and item `N+1`:

```ts
interface CaptureCameraPathSegmentV2 {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  enabled: boolean;
  transitionSeconds: number;
  easing: "linear" | "ease-in-out";
}
```

Rules:
- Segment `01` is the transition from row `01` to row `02`.
- Segment controls live between rows, not in a detached global form.
- Transition duration is editable from the list and from the lower timeline block handles.
- Disabled segment means no travel through that segment; playback/render skips it and reports a broken path if no valid route remains.

### Look And Focus

Look modes:
- `free-direction`: stores an explicit target point per node.
- `follow-path-tangent`: derives target from path travel direction at the sampled time.
- `focus-point-lock`: target resolves to a recipe-local focus point.

Focus picking:
- `Pick Focus Point` arms a selected node.
- Next scene click raycasts a world point and stores it in `focusPoints[]`.
- The selected node switches to `focus-point-lock` and references the new focus point.
- No page camera field, project fixture, or editor dirty state is written.

### Timeline

Timeline entries are derived from active nodes and active segments:

```ts
type CapturePathTimelineBlock =
  | { kind: "hold"; nodeId: string; startSeconds: number; durationSeconds: number }
  | { kind: "transition"; segmentId: string; startSeconds: number; durationSeconds: number };
```

Rules:
- The lower bar spans the full available width.
- A playhead/scrubber overlays the full timeline.
- Hold blocks sit above keyframe rows.
- Transition blocks sit between hold blocks.
- Dragging a hold block edge changes `node.holdSecondsAfter`.
- Dragging a transition block edge changes `segment.transitionSeconds`.
- Clicking a block selects its node or segment.
- Focus and look lanes show compact markers for `free`, `tangent`, and `focus-lock`.

---

## Task 1: Fix Empty Path Recipe Semantics

**Files:**
- Modify: `src/capture/captureCameraPathV2.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/capture/captureRecipe.ts`
- Test: `tests/tools/capture-director-runtime.test.mjs`
- Test: `tests/utah-forge/capture-director.spec.ts`

- [ ] Add helpers:

```ts
export function captureCameraPathV2HasNodes(path: CaptureCameraPathV2): boolean {
  return path.nodes.length > 0;
}

export function captureCameraPathV2ActiveNodes(path: CaptureCameraPathV2): CaptureCameraPathNodeV2[] {
  return normalizeCaptureCameraPathV2(path).nodes.filter((node) => node.enabled !== false);
}

export function captureCameraPathV2IsRenderable(path: CaptureCameraPathV2): boolean {
  const activeNodes = captureCameraPathV2ActiveNodes(path);
  if (activeNodes.length === 0) return false;
  if (activeNodes.length === 1) return activeNodes[0].holdSecondsAfter > 0;
  return resolveCaptureCameraPathV2Timeline(path).durationSeconds > 0;
}
```

- [ ] Update `createRecipeSnapshot()`:

```ts
const normalizedPath = normalizeCaptureCameraPathV2(captureCameraPathV2);
const cameraPathForRecipeSnapshot =
  options?.cameraPath === undefined
    ? captureCameraPathV2HasNodes(normalizedPath)
      ? normalizedPath
      : null
    : options.cameraPath?.version === 2
      ? normalizeCaptureCameraPathV2(options.cameraPath)
      : options.cameraPath;
```

- [ ] Keep `validateCaptureCameraPathV2()` strict when a path object exists.
- [ ] Add runtime test: current-scene recipe with no path has `cameraPath === null` and validates.
- [ ] Add Playwright smoke assertion: Still Capture works before any path keyframe exists.

Expected result: Still Capture and render-out no longer fail when no camera path has been authored.

## Task 2: Make Playback State Valid And Predictable

**Files:**
- Modify: `src/capture/captureCameraPathV2.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/capture/CaptureDirectorToolbar.tsx`
- Test: `tests/tools/capture-director-camera-path-v2-runtime.test.mjs`
- Test: `tests/utah-forge/capture-director.spec.ts`

- [ ] Add validation for playback:

```ts
export function validateCaptureCameraPathV2Playback(path: CaptureCameraPathV2): CaptureCameraPathV2ValidationResult {
  const base = validateCaptureCameraPathV2(path);
  const errors = [...base.errors];
  const activeNodes = captureCameraPathV2ActiveNodes(path);
  if (activeNodes.length < 2) {
    errors.push("Add at least two active camera views before playing the path.");
  }
  const timeline = resolveCaptureCameraPathV2Timeline(path);
  if (timeline.durationSeconds <= 0) {
    errors.push("Camera path duration must be greater than zero.");
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] Change `playCameraPath()` to return `boolean`:

```ts
const playCameraPath = useCallback((): boolean => {
  stopCameraPathPlayback();
  const validation = validateCaptureCameraPathV2Playback(captureCameraPathV2);
  if (!validation.valid) {
    setError(validation.errors.join(" "));
    return false;
  }
  setError(null);
  setCameraPathPlaying(true);
  setCameraPathTimelinePlaying(true);
  // existing tick subscription follows
  return true;
}, [...deps]);
```

- [ ] Change `startCameraPathPreviewRecording()`:

```ts
const startCameraPathPreviewRecording = useCallback(async () => {
  if (!playCameraPath()) return;
  await startRecording();
}, [playCameraPath, startRecording]);
```

- [ ] Disable `Play Path`, lower `Play`, and `Record Path Preview` when playback validation fails. Show the validation message in Camera Path panel.
- [ ] Add Playwright smoke: with zero nodes, Play Path does not start recording; with two active nodes, Play Path advances scrub time.

Expected result: Play and Play Path either play a valid path or clearly explain what is missing.

## Task 3: Add Enabled/Hidden State To Path Nodes And Segments

**Files:**
- Modify: `src/capture/captureCameraPathV2.ts`
- Modify: `src/capture/captureRecipe.ts`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/scene.ts`
- Test: `tests/tools/capture-director-camera-path-v2-runtime.test.mjs`

- [ ] Add `enabled?: boolean` to node and segment normalization with default `true`.
- [ ] Runtime sampling uses only enabled nodes and enabled segments.
- [ ] Disabled nodes are still listed and ghosted in scene overlay:

```ts
export interface CaptureCameraPathOverlayKeyframe {
  id: string;
  nodeKind?: "keyframe" | "transition";
  enabled?: boolean;
  position: CaptureVec3;
  target?: CaptureVec3;
  lookMode?: CaptureCameraPathLookModeV2;
  focusLocked?: boolean;
}
```

- [ ] Overlay renders disabled nodes with reduced opacity and excludes them from sampled path line unless `showTimelineGhost` is true.
- [ ] Add edit helper:

```ts
export function setCaptureCameraPathV2NodeEnabled(path: CaptureCameraPathV2, nodeId: string, enabled: boolean): CaptureCameraPathV2;
```

- [ ] Add edit helper:

```ts
export function setCaptureCameraPathV2SegmentEnabled(path: CaptureCameraPathV2, segmentId: string, enabled: boolean): CaptureCameraPathV2;
```

- [ ] Add tests for disabled middle node and disabled segment.

Expected result: each camera line item can be shown/hidden for active path participation without deleting authored work.

## Task 4: Replace Global Path Draft Controls With Ordered Line Items

**Files:**
- Create: `src/capture/CameraPathLineItemEditor.tsx`
- Create: `src/capture/CameraPathTransitionEditor.tsx`
- Modify: `src/capture/CaptureDirectorToolbar.tsx`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/utah-forge/capture-director.spec.ts`

- [ ] Create row component:

```tsx
export function CameraPathLineItemEditor(props: {
  index: number;
  node: CaptureCameraPathNodeV2;
  selected: boolean;
  onSelect(id: string): void;
  onEnabledChange(id: string, enabled: boolean): void;
  onKindChange(id: string, kind: CaptureCameraPathNodeKindV2): void;
  onHoldChange(id: string, seconds: number): void;
  onLookModeChange(id: string, mode: CaptureCameraPathLookModeV2): void;
  onFocusBind(id: string): void;
  onJump(id: string): void;
  onUpdatePose(id: string): void;
  onDelete(id: string): void;
}): JSX.Element
```

- [ ] Row visible content:
  - number badge `01`;
  - active toggle;
  - node kind select;
  - hold seconds input, disabled for transition nodes;
  - look mode select;
  - focus bind button/status;
  - position/target summary;
  - Jump, Set From Current, Delete.
- [ ] Create transition component:

```tsx
export function CameraPathTransitionEditor(props: {
  index: number;
  segment: CaptureCameraPathSegmentV2;
  selected: boolean;
  disabled: boolean;
  onSelect(id: string): void;
  onEnabledChange(id: string, enabled: boolean): void;
  onDurationChange(id: string, seconds: number): void;
  onEasingChange(id: string, easing: "linear" | "ease-in-out"): void;
}): JSX.Element
```

- [ ] Render sequence:

```tsx
nodes.map((node, index) => (
  <Fragment key={node.id}>
    <CameraPathLineItemEditor index={index + 1} node={node} ... />
    {segments[index] ? <CameraPathTransitionEditor index={index + 1} segment={segments[index]} ... /> : null}
  </Fragment>
))
```

- [ ] Remove detached `Node kind`, `Segment transition`, `Hold time`, `Look mode`, and `Focus bind` controls after row editor covers them.
- [ ] Keep `Options` as a collapsible subsection under Camera Path.

Expected result: path authoring reads like a shot list with transition blocks between shots.

## Task 5: Build A Real Lower Timeline

**Files:**
- Create: `src/capture/CameraPathTimeline.tsx`
- Create: `src/capture/cameraPathTimelineLayout.ts`
- Modify: `src/capture/CaptureDirectorToolbar.tsx`
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Test: `tests/tools/capture-director-runtime.test.mjs`
- Test: `tests/utah-forge/capture-director.spec.ts`

- [ ] Add layout helper:

```ts
export function layoutCapturePathTimeline(options: {
  timeline: CaptureCameraPathV2Timeline;
  widthPx: number;
  minBlockPx: number;
}): Array<{
  id: string;
  kind: "hold" | "transition";
  leftPx: number;
  widthPx: number;
  startSeconds: number;
  durationSeconds: number;
}>;
```

- [ ] Timeline component lanes:
  - ruler/tick lane;
  - hold/transition block lane;
  - node marker lane;
  - look/focus marker lane;
  - playhead overlay.
- [ ] Scrub behavior:
  - click timeline sets scrub time;
  - drag playhead updates `cameraPathScrubTimeSeconds`;
  - preview monitor updates from the same sample.
- [ ] Block editing:
  - drag right edge of hold block updates `node.holdSecondsAfter`;
  - drag right edge of transition block updates `segment.transitionSeconds`;
  - clamp minimum duration to `0`;
  - update timeline duration immediately.
- [ ] Keep existing `capture-timeline-*` test ids and add:
  - `capture-timeline-ruler`;
  - `capture-timeline-playhead`;
  - `capture-timeline-hold-block`;
  - `capture-timeline-transition-block`;
  - `capture-timeline-block-handle`.

Expected result: the lower bar behaves like a compact video-editor timeline, not a form slider.

## Task 6: Make Focus Picking And Look Direction Explicit

**Files:**
- Modify: `src/capture/CaptureDirectorProvider.tsx`
- Modify: `src/capture/CaptureDirectorToolbar.tsx`
- Modify: `src/scene.ts`
- Test: `tests/utah-forge/capture-director.spec.ts`

- [ ] Add selected-node `Pick Focus Point` button in the line item.
- [ ] When pressed, set `bindFocusKeyframeId` to the selected node and show armed status in row.
- [ ] Scene click stores recipe-local focus point:

```ts
bindCameraPathFocusPoint(nodeId, `focus-${nodeId}`, point);
setCameraPathNodeLookMode(nodeId, "focus-point-lock");
```

- [ ] Overlay shows:
  - camera position handle;
  - travel/tangent direction ray;
  - look ray;
  - focus lock ray;
  - focus point marker;
  - node label `01`, `02`, etc.
- [ ] Preview monitor opens when:
  - a node is selected and monitor mode is `selected-node`;
  - scrubber moves and monitor mode is `scrub-time`;
  - a handle/target/focus point is dragged and mode is `while-editing`;
  - live editor camera differs from selected path camera by a configured threshold while path editing is open.

Expected result: camera travel direction and camera look/focus direction are visibly distinct and authorable.

## Task 7: Preserve Line2 Overlay And Headless Still Work

**Files:**
- Modify: `src/scene/captureCameraPathOverlayLine.ts`
- Modify: `src/scene.ts`
- Modify: `src/capture/deterministicStillTileExporter.ts`
- Modify: `src/capture/externalStillRenderJob.ts`
- Modify: `tools/render-capture-still-job.mjs`
- Test: `tests/tools/capture-director-source.test.mjs`
- Test: `tests/tools/capture-director-runtime.test.mjs`
- Test: `tests/utah-forge/capture-director.spec.ts`

- [ ] Keep Line2/LineMaterial as the path/ray/segment-hit implementation.
- [ ] Extend overlay metadata to include `enabled`, display index, active segment ids, selected segment id, and timeline sample.
- [ ] Keep external still jobs out of `full-ui` mode.
- [ ] Keep browser Still Capture first, external tiled fallback second.
- [ ] Keep `tools/render-capture-still-job.mjs --self-test` and synthetic fixture paths passing.

Expected result: the path UX repair does not regress stable camera track rendering or 8K still fallback.

## Task 8: Tests And Verification

**Files:**
- Modify: `tests/tools/capture-director-source.test.mjs`
- Modify: `tests/tools/capture-director-runtime.test.mjs`
- Modify: `tests/tools/capture-director-camera-path-v2-runtime.test.mjs`
- Modify: `tests/utah-forge/capture-director.spec.ts`
- Modify: `docs/capture-director/README.md`
- Modify: `docs/03-decisions.md`

- [ ] Source tests assert:
  - line item editor file exists;
  - transition editor file exists;
  - lower timeline file exists;
  - no detached global timing controls remain;
  - recipe snapshot omits empty path.
- [ ] Runtime tests assert:
  - empty path recipe validates with `cameraPath === null`;
  - playback validation rejects zero nodes and one active movement node;
  - disabled node/segment behavior is deterministic;
  - timeline layout maps hold/transition blocks to correct positions;
  - focus-point lock samples deterministic targets.
- [ ] Playwright smoke asserts:
  - Still Capture works before any path nodes exist;
  - Add Current Camera creates row `01`;
  - Add Transition Node creates a transition node row;
  - transition container `01` appears between row `01` and row `02`;
  - row active toggle hides path participation without deleting row;
  - Play Path advances scrub time for two active views;
  - Record Path Preview does not record if playback validation fails;
  - timeline blocks can be dragged to update hold/transition durations;
  - focus point pick updates selected row focus lock;
  - closing Capture Director clears overlay and preview monitor.
- [ ] Run:

```powershell
node tests\tools\capture-director-source.test.mjs
node tests\tools\capture-director-runtime.test.mjs
node tests\tools\capture-director-camera-path-v2-runtime.test.mjs
node tools\render-capture-still-job.mjs --self-test
node tools\render-capture-still-job.mjs --job tests\fixtures\capture-still-render-job-v1.json --out .tmp\capture-still-self-test.png --synthetic
npm run check:editor-controls
npm run check:pages
npm run check:runtime-assets
npm run build
npm run check:workspace
git diff --check
npx playwright test tests/utah-forge/capture-director.spec.ts --workers=1
npm run check:visual-qa-clean
```

Expected result: focused checks pass. If `check:visual-qa-clean` fails because unrelated Utah FORGE page fixtures are dirty, report exact files and keep browser status at `ready for visual check` unless a running browser was visually inspected.

## Agent Allocation

- Agent A: Path schema and recipe semantics. Owns Tasks 1 and 3.
- Agent B: Playback, realtime path capture, and path validation. Owns Task 2.
- Agent C: Camera Path UI line item and transition container components. Owns Task 4.
- Agent D: Lower timeline layout and interaction. Owns Task 5.
- Agent E: Focus picking, overlay metadata, preview monitor triggers. Owns Task 6.
- Agent F: Regression protection for Line2 overlay and headless still renderer. Owns Task 7.
- Agent G: Tests, docs, verification, dirty-worktree report. Owns Task 8.

## Acceptance Criteria

- Play Path and lower Play are disabled or error-clean when the path cannot be played.
- Record Path Preview cannot start a meaningless recording when path playback is invalid.
- Still Capture works with no camera path authored.
- Each camera view is a numbered selectable row with active toggle, node kind, hold time, look mode, focus bind, jump, update, and delete controls.
- Each transition is a visible container between rows with segment number, enabled state, transition duration, and easing.
- The lower timeline spans the available screen width and shows editable hold and transition duration blocks.
- Scrubbing the timeline updates the scene sample marker, look/focus rays, and preview monitor.
- Focus picking stores recipe-local focus points only.
- Disabled rows remain editable but do not participate in playback/render sampling.
- Line2 overlay stays in use for stable track width and color.
- External 8K still job path remains intact.
- No project/page fixture, overlay, environment, visual preset, or editor dirty-state write is introduced.
