# Page Transition Orchestration Audit - 2026-05-30

Status: audit log and fix-planning input. This file captures the transition
orchestration findings from the full visual-state audit before any smoothing
or polish work is attempted.

Companion contract: `docs/dev-context/Page-Transitions-And-Section-Frames.md`.
That file remains the durable section-frame helper contract. This file maps the
runtime clocks, state owners, divergence paths, and recommended repair order.

Pre-fix prep log:
`docs/dev-context/Page-Transition-Fix-Prep-2026-05-30.md`.

## Scope

This audit covers global transition behavior exposed by page navigation across:

- camera movement and dynamic camera pages
- page overlay slide/fade transitions
- scene-layer opacity and scalar style transitions
- transparency, opacity composition, and ignored-style overlays
- section frames, section helper visuals, ISO bands, ISO lines, and cut traces
- volume renderings, MT slices, seismic/section products, and scalar legends
- point clouds, full-density scalar surfaces, surface masks, and derived
  previews
- editor/presenter UI state, legends, labels, assays, and controls
- interruption behavior, async layer load behavior, and debug visibility

No runtime changes were made while producing this audit.

Scope rule added after follow-up review: pages are disposable reproduction
fixtures. Page IDs, page numbers, page titles, and matrix case IDs in this
audit are evidence handles only. Repair work must target global transition
state ownership, classification, opacity composition, camera policy,
editor/save gating, and validation rules, not fixture-specific source/target paths.

## Executive Finding

The transition system is not a single orchestrated runtime. It is several
mostly-correct local systems running on separate clocks:

1. PageController owns React page transition state.
2. CameraTweener owns camera interpolation and completion callbacks.
3. SceneManager owns layer/style/section/working-area transition runtime.
4. Scene overlay handles own fixed-duration opacity tweens.
5. React UI consumers interpret `targetIndex`, `transitionProgress`, and
   `isTransitioning` differently.
6. Scene/editor interaction handlers can also write camera-control state.

During simple forward navigation these systems often appear aligned. They can
diverge during interruptions, async loads, camera-only moves, section-frame
changes, page-scene mood changes, and transitions with mixed scalar, volume,
surface, point-cloud, overlay, and label behavior.

The repair foundation should be a single transition run model with one run id,
one start time, one duration/easing resolver, explicit source/target resolved
state, and registered consumers for camera, scene data, overlays, labels,
legends, editor controls, and debug.

## Clock And State Source Map

| System | State / clock owner | Key files | Notes |
| --- | --- | --- | --- |
| Page transition state | React state and refs in PageController | [PageController.tsx:573](../../src/pages/PageController.tsx#L573), [PageController.tsx:887](../../src/pages/PageController.tsx#L887) | Owns `currentIndex`, `targetIndex`, `transitionProgress`, `isTransitioning`, `pageTransitionRef`, `transitionDynamicRef`, and `activeSceneTransitionRef`. React progress updates are throttled. |
| Page transition start | `goto()` | [PageController.tsx:1118](../../src/pages/PageController.tsx#L1118) | Computes source/target page ids, starts camera tween, starts scene transition, starts overlay transition, applies target page scene immediately. |
| Camera movement | TWEEN group | [cameraTween.ts:27](../../src/pages/cameraTween.ts#L27) | Owns camera position, target, and fov interpolation. Its completion callback currently ends the page transition. |
| Scene data/style transition | SceneManager transition runtime | [transitionEffectiveLayersForPage.ts:17](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L17), [layerTweenRuntime.ts:75](../../src/scene/transitions/layerTweenRuntime.ts#L75) | Owns layer opacity, scalar styles, scene sections, helper snapshots, working-area focus, and visibility envelope during data transitions. |
| Section-frame interpolation | Section controller | [sceneSectionController.ts:2039](../../src/scene/section/sceneSectionController.ts#L2039) | Interpolates compatible numeric section-frame style fields. Incompatible frame changes use helper snapshots. |
| Working-area focus | Working-area controller | [workingAreaFocusController.ts:302](../../src/scene/workingArea/workingAreaFocusController.ts#L302) | Only interpolates outside opacity. Bounds and most geometry-like fields snap to target. |
| Scene overlays | Scene overlay controller and loaded overlay handles | [SceneOverlaysController.ts:16](../../src/scene/overlays/SceneOverlaysController.ts#L16), [loadSceneOverlays.ts:316](../../src/loaders/loadSceneOverlays.ts#L316) | Uses fixed 800 ms linear fades independent of page duration/easing. |
| Main frame order | Scene render loop | [scene.ts:351](../../src/scene.ts#L351) | PageController tickers run before `controls.update()`, then SceneManager `frameUpdate()` runs, then render. |
| Presenter overlay UI | React progress consumer | [OverlayDisplay.tsx:433](../../src/presenter/OverlayDisplay.tsx#L433) | Crossfades/slides source and target overlay HTML using `transitionProgress`. CSS transitions are disabled while the page transition is active. |
| Utah legend stack | React progress consumer | [EditorChrome.tsx:268](../../src/editor/EditorChrome.tsx#L268) | Uses multi-phase exit/layout/enter math derived from `transitionProgress`. |
| Resistivity legend | Interpolated target consumer | [ResistivityLegend.tsx:592](../../src/ui/ResistivityLegend.tsx#L592) | Interpolates scalar legend style when `targetIndex` is non-null. |
| Labels and assays | Threshold target consumers | [SceneLabels.tsx:1052](../../src/ui/SceneLabels.tsx#L1052), [AssayLegend.tsx:92](../../src/ui/AssayLegend.tsx#L92) | Continue showing source page until `transitionProgress >= 0.92`, then switch. |
| Runtime debug | PageController and SceneManager debug handles | [PageController.tsx:1524](../../src/pages/PageController.tsx#L1524), [SceneManager.ts:3150](../../src/scene/SceneManager.ts#L3150) | Exposes some transition state but omits several clocks and consumer decisions. |

## Detailed Findings

### 1. There is no single transition authority

PageController creates page transition refs and records a start time. SceneManager
creates a separate active scene transition context with a fresh
`performance.now()`. Working-area focus and scene overlays also stamp their own
start times. These are close in normal frames, but they are not the same clock,
not the same object, and not the same debug surface.

Recommendation:

- Introduce a `TransitionRun` object created by PageController and passed to
  camera, SceneManager, overlays, UI, and debug.
- Store `runId`, `sourcePageId`, `targetPageId`, `startedAtMs`,
  `durationMs`, `easing`, `sourceIndex`, `targetIndex`, and interruption
  ancestry.
- Make all progress calculations derive from that run object unless a consumer
  has an explicit secondary phase.

### 2. Camera completion currently ends the page transition

The camera tween callback clears transition refs, flips `currentIndex`, clears
`targetIndex`, sets progress to 1, re-enables raycast, applies overlay transition
end, and activates saved focus.

That means camera completion is the de facto page-transition completion event,
even if scene data, overlays, async loads, labels, or UI animation phases are
not logically finished.

Recommendation:

- Separate `cameraDone`, `sceneDone`, `overlayDone`, and `uiDone` from
  `transitionDone`.
- PageController should complete the run only after required consumers report
  completion or after the orchestrator deliberately marks them non-blocking.
- Keep camera-only tweens out of page-transition completion semantics.

### 3. Interrupted transitions can disagree on source page

When navigation is interrupted, PageController derives the new scene transition
source from the active target page, while React `currentIndex` can still point
to the original source page until the camera callback finishes. SceneManager may
therefore transition from source resolved state B to target resolved state C while `OverlayDisplay` and other UI
surfaces still treat page A as the source.

Recommendation:

- Move source/target page ownership into the shared transition run.
- On interruption, explicitly promote the visual source page for every consumer
  to the same source id.
- Add debug fields for `reactCurrentPageId`, `transitionSourcePageId`,
  `sceneSourcePageId`, and `overlaySourcePageId`.

### 4. `isTransitioning` is overloaded

Page-to-page transitions, focus camera tweens, and reset camera tweens all write
`isTransitioning`. For camera-only movement, PageController can set
`isTransitioning=true`, `transitionProgress=1`, and `targetIndex=null`.

Consumers that read only `isTransitioning` may disable controls or infer page
transition behavior when no page transition is active.

Recommendation:

- Split transition mode into explicit values:
  - `idle`
  - `page`
  - `camera-focus`
  - `camera-reset`
  - `editor-drag`
- Keep `isTransitioning` only as a derived convenience flag if needed.

### 5. UI consumers use incompatible page-source rules

The UI is not uniformly driven by the same source/target/progress model:

- `OverlayDisplay` renders both source and target panels.
- `EditorChrome` uses phased progress math for the Utah legend stack.
- `ResistivityLegend` interpolates scalar legend style.
- Many other legends switch immediately to target when `targetIndex` is set.
- `SceneLabels` and `AssayLegend` wait until progress reaches 0.92.

This causes target legends to appear while the scene still visually contains
source data, and labels/assays can snap late while camera motion is still
underway.

Recommendation:

- Define a per-consumer transition contract:
  - crossfade
  - interpolate
  - hold-source-until-threshold
  - hold-target-from-start
  - no-transition
- Store this decision in code as named policy, not ad hoc conditionals.
- Make the default policy conservative: scene-bound UI should match the scene
  data source unless it has an explicit interpolation path.

### 6. Overlay timing is independent of page timing

Scene overlays use a fixed 800 ms linear fade. They do not use the page
transition duration or easing. Overlay transition start only fades handles down
when the target opacity is lower than current; transition end then fades any
remaining differences. Transition end is tied to camera completion.

Recommendation:

- Route scene overlays through the shared transition run.
- Decide whether each overlay participates in:
  - full-duration page fade
  - camera-end fade
  - scene-data-end fade
  - independent authored overlay fade
- If fixed 800 ms remains desired, make it explicit in the run debug and
  authoring schema.

### 7. Easing is duplicated

Page progress easing, scene transition easing, and camera tween easing are
implemented separately. The names line up today, but a future easing addition
or bug fix can drift across implementations.

Recommendation:

- Centralize easing name resolution.
- Keep one mapping from page schema easing names to:
  - scalar progress function
  - camera tween easing function
  - debug display name
- Add a small test that verifies all page transition easing names are supported
  by every transition subsystem.

### 8. React progress is throttled but scene/camera update every frame

PageController avoids setting React state for tiny progress deltas. SceneManager
and CameraTweener still update every frame. This is usually fine, but it means
React UI progress can be one or more frames behind camera/scene progress during
short durations, browser stalls, or test virtual-time runs.

Recommendation:

- Keep throttling if needed for render cost, but expose raw progress and UI
  progress separately in debug.
- For visually critical UI, consider deriving from a shared animation clock
  rather than throttled React state.

### 9. Section helper rebuilds can fight visual smoothness

The canonical section-frame contract already identifies helper rebuilds during
tween ticks as a regression source. Rebuilding ISO bands, ISO lines, ground
traces, dashed intersection traces, frame outlines, crop boxes, and push/pull
handle materials mid-transition can cause flicker, opacity recomposition bugs,
dash phase resets, lighting/shading changes, and cone handles that read as flat.

Recommendation:

- Preserve the existing contract: build helper geometry at tween start/end, not
  every frame.
- During tween ticks, move only opacity, stable uniforms, and compatible numeric
  values.
- Treat any `rebuildSceneSectionHelpers()` call from a tween tick as a failing
  condition.

### 10. Continuous section interpolation still snaps non-lerped fields

Compatible section transitions interpolate many numeric fields, but the current
interpolation starts from the target style and then selectively lerps supported
fields. Any field not explicitly interpolated snaps to target at transition
start.

Recommendation:

- Audit every section-frame field and classify it as:
  - interpolated
  - snapshot-crossfaded
  - discrete-at-start
  - discrete-at-end
- Avoid accidental target-start snaps by requiring every field to have a policy.

### 11. Section geometry crop/window changes are translations

Several visual changes described by authors as "slides" are really translations
or changes in crop/window/bounds. They currently route through scalar/style
interpolation or discrete snapshot fades depending on frame compatibility. There
is no formal layer transition kind named `slide`.

Recommendation:

- Do not add an ad hoc `slide` string.
- If slide behavior is required, define it as an explicit transition policy with
  geometry ownership, clipping behavior, and debug output.
- Keep the current closed `LayerTransitionKind` union unless a decision entry
  expands it.

### 12. Working-area focus interpolation is partial

Working-area focus interpolation currently moves outside opacity but most other
fields come from the target style. Bounds/helper changes can snap while opacity
eases.

Recommendation:

- Classify working-area fields with the same policy table used for section
  frames.
- If bounds should visually move, implement a real bounds interpolation path.
- If bounds should snap, make the snap phase intentional and visible in debug.

### 13. Page scene mood and lighting apply immediately

`applyPageScene(target)` runs at transition start. Page-level mood, lighting,
environment, exposure, or similar scene-wide changes can therefore pop while
camera, layers, overlays, and labels are still in transition.

Recommendation:

- Decide which page-scene properties are transitionable.
- Move transitionable scene mood/light fields into the shared transition run.
- Keep truly discrete page-scene switches explicit as start or end events.

### 14. Async layer loads only receive partial transition reapply

When a layer finishes loading during an active transition, SceneManager only
reapplies the transition visibility envelope and section planes before returning.
It does not fully apply target style, page scene, or overlay state to the late
asset.

Recommendation:

- Late-loaded layers should receive a transition-aware style application based
  on the current run progress.
- Debug should log late-load reapplication with page id, layer id, run id, and
  applied progress.

### 15. Full scene apply paths can cancel data transitions

`applyEffectiveStylesForPage` and `applyEffectiveVisibilityForPage` clear
SceneManager transition state. PageController avoids calling these during an
active transition, but any external caller can still cancel the scene transition
while PageController/camera/UI continue.

Recommendation:

- Add guarded entry points or assertions for full apply calls during active
  transition runs.
- Prefer transition-aware reapply methods that preserve active run state.
- Include cancellation reason and caller label in transition debug.

### 16. Ignored-style overlays do not fade with layer style

Overlays that intentionally ignore layer style are not guaranteed to participate
in the same opacity transitions as the underlying layer. This can preserve
readability in some cases, but it can also leave helper/annotation visuals
visible while their parent data appears to fade away.

Recommendation:

- Separate "ignore style color/ramp" from "ignore transition opacity".
- Add an explicit `participatesInTransitionOpacity` policy for helper and
  overlay objects.

### 17. MT slice opacity composition can double-own visibility

MT/scalar slice products have both layer/source visibility and scalar style
opacity concerns. If opacity is applied through more than one path, slices can
dim, snap, or fail to visually match legends during page changes.

Recommendation:

- Give volume/slice/scalar products one composed opacity formula:
  authored opacity x transition opacity x product attenuation.
- Expose the components on material or layer debug.
- Keep legend interpolation tied to the same effective scalar style progress.

### 18. Volume rendering and scalar products need product-level policies

Volume renderings, slices, isosurfaces, scalar sections, and full-density
surface masks do not all behave like simple mesh opacity transitions. Some are
style interpolation problems, some are data-source opacity problems, and some
are discrete product swaps.

Recommendation:

- Create a product transition registry for:
  - scalar volume rendering
  - scalar slices
  - isosurfaces
  - section ISO overlays
  - full-density surfaces
  - point clouds
  - simple mesh layers
- Each product should declare whether it supports style interpolation, source
  crossfade, helper snapshot crossfade, or no transition.

### 19. Point clouds have partial transition coverage

Point clouds can participate in scalar style transitions, but fields such as
point size can snap. Full-density surface masks and async source updates can
also race the active transition. Point clouds are not consistently represented
in section affected-layer sets.

Recommendation:

- Classify point-cloud visual fields as interpolated or discrete.
- Include point size, scalar ramp, opacity, mask visibility, and section
  participation in the product transition registry.
- Verify full-density point/surface products with interruption and late-load
  scenarios.

### 20. Labels and assays have independent timing behavior

Labels and assays project against the live camera every frame, but their page
source switches at a hard 0.92 progress threshold. Scene labels also have their
own short removal timer. This makes label/assay content timing independent from
scene-layer and overlay timing.

Recommendation:

- Give labels and assay markers an explicit transition policy.
- Consider tying threshold switches to transition phases, not a hard-coded
  progress value.
- Debug the active page source used by each label layer.

### 21. Keyboard navigation can interrupt while buttons are disabled

Navigation controls are disabled during `isTransitioning`, but the keyboard
handler still allows navigation and therefore interruption. That may be desired,
but the UI affordance and keyboard behavior are inconsistent.

Recommendation:

- Decide whether interruption is supported as a product behavior.
- If supported, expose it consistently in controls and debug.
- If not supported, block keyboard navigation while a page transition run is
  active.

### 22. Camera controls have multiple writers

CameraTweener disables controls during camera tweening. Scene/editor drag
handlers also toggle `controls.enabled`. A pointer-up or editor interaction path
can re-enable controls while a tween still expects ownership.

Recommendation:

- Replace direct `controls.enabled` writes with an ownership/lease model.
- Example owners: `camera-tween`, `editor-drag`, `object-drag`, `measurement`,
  `presentation-lock`.
- Effective controls state should be derived from active owners.

### 23. Dynamic camera state is hard to reason about

Dynamic camera transition state is layered after camera tween updates. On
completion, PageController may apply a final dynamic pose, then reset dynamic
base refs around the static target pose. This may be intentional, but the
runtime debug does not expose enough to prove it during transition regressions.

Recommendation:

- Add debug for dynamic camera source pose, target pose, current computed pose,
  base pose, dynamic page id, dynamic start time, and transition run id.
- Treat dynamic camera movement as a registered consumer of the transition run.

### 24. Debug state does not expose enough divergence data

Current debug state exposes page transition progress and some SceneManager
transition counts. It does not show the page transition ref, dynamic camera ref,
camera tween ownership, scene overlay tween state, UI source/target page
decisions, late-load reapply events, or per-product transition policy.

Recommendation:

- Add a transition debug panel/object that reports:
  - run id and status
  - source/target page ids for every consumer
  - raw progress, eased progress, and UI progress
  - camera progress and completion
  - scene data progress and active tween counts
  - overlay progress and active overlay handles
  - label/legend/assay source policy
  - late-loaded layers touched during the run
  - cancellation/interruption history

### 25. Presenter overlay timing schema is broader than runtime use

`TextOverlayTiming` includes `fadeMs`, `gapMs`, `leadMs`, `slidePx`,
`slideEnabled`, and easing-related fields. The presenter overlay runtime uses
some of these values, but active navigation overlay movement is primarily
driven by `transitionProgress`. Fields such as `gapMs` and `leadMs` are exposed
in editor/schema surfaces but are not clearly represented in the active
transition orchestration.

Recommendation:

- Decide whether text overlay timing is authored independently or derived from
  the page transition run.
- Remove or hide timing fields that do not affect runtime behavior.
- If `gapMs` and `leadMs` should affect transitions, route them through the
  shared transition run and expose them in debug.

### 26. Some scene progress calculations still read global time directly

Most frame-update work receives a frame time, but some transition helpers still
call `performance.now()` directly. Examples include
`transitionFrameOpacityForLayer`, transition context creation, working-area
focus start, and default section-style reads. These hidden clock reads make it
harder to replay or debug a transition from one timeline.

Recommendation:

- Pass the transition run time or frame time through transition helpers.
- Avoid direct `performance.now()` inside transition consumers except at run
  creation.
- Add tests or debug assertions that transition consumers agree on raw/eased
  progress for the same frame.

### 27. Reduced-motion policy is not applied consistently

`prefersReducedMotion()` is used for some focus-camera behavior, but page
transitions, scene data transitions, overlays, labels, and legends still animate
through their normal paths. This may be acceptable for the presentation app, but
it is not currently an explicit policy.

Recommendation:

- Decide whether reduced motion applies to presentation navigation.
- If yes, make the shared transition run resolve reduced-motion duration/easing
  once and pass that result to every consumer.
- If no, document that presentation transitions intentionally ignore reduced
  motion and limit the preference to editor/focus affordances.

## Supplemental Findings To Preserve

These are narrower observations from the same audit. They should stay visible
because they are easy to lose when the larger orchestration model is discussed.

### A. Interrupted camera tweens skip old completion callbacks

`CameraTweener` correctly stops an active tween before starting a new one, and
the old `onComplete` callback does not fire. That is useful for preventing stale
camera completion, but it also means any cleanup tied only to the old camera
completion path will be skipped.

Specific risk:

- Old page-transition end cleanup can be bypassed unless it is moved into a
  transition-run cancellation path.
- Scene overlay transition-end fades can be skipped on interruption because
  they are currently invoked from camera completion.

Recommendation:

- Give every transition run an explicit `cancelled` path.
- Move end-of-run cleanup that must always happen out of camera `onComplete`.

### B. Presenter overlay content loading is asynchronous

`OverlayDisplay` loads source and target overlay content asynchronously. The
component guards its own effect lifecycle, but the loaded content is not tied to
a transition run id. During rapid navigation, content fetch completion can be
logically newer or older than the visual run being animated.

Recommendation:

- Key overlay content loads by transition run id and page id.
- Expose pending/loaded overlay page ids in transition debug.

### C. Editor selection and page landing are separate states

Editor-side surfaces distinguish the selected page from whether that page has
"landed" as the current page. This is visible in `selectedPageHasLanded`
behavior in the editor shell and layer panels. During transition, the editor can
show target-page selection while the scene is still source/transition state.

Recommendation:

- Keep this split if it is intentional, but expose it as:
  - selected page
  - current landed page
  - transition source page
  - transition target page
- Avoid using selected page as a proxy for scene state during transitions.

### D. 2D section ISO and volume-cut ISO rebuild paths need separate checks

The broad section-helper finding covers helper rebuilds generally, but the audit
also observed that 2D scalar section ISO overlays and volume-cut ISO overlays can
be rebuilt by scalar/section tween paths. These are separate product paths from
the frame-outline/helper visuals and should be verified independently.

Recommendation:

- Add explicit checks for 2D scalar section ISO overlays during scalar style
  tweens.
- Add explicit checks for volume-cut ISO overlays during volume/slice page
  transitions.
- Confirm opacity/uniform updates do not recreate material instances each
  frame.

### E. Direct translation fields can snap

Some visual movement is not an opacity transition and not a camera tween. Layer
lifts, contour offsets, marker positions, section crop/window changes, and other
position-like fields may be direct translations. If they are not explicitly
interpolated, they snap at transition start when the target style is applied.

Recommendation:

- Classify every position-like field as interpolated, start-snap, end-snap, or
  snapshot-crossfaded.
- Treat author language like "slide" as a request for translation policy, not a
  request for a new transition kind by default.

### F. Page reapply is intentionally deferred during active transitions

PageController avoids full page/scene reapply while a transition is active. This
prevents accidental cancellation of SceneManager transition state, but it also
means edits or external state changes made during a transition may not become
visible until the transition completes or a later reapply path runs.

Recommendation:

- Keep the guard, but add debug for deferred reapply requests.
- Route safe transition-aware edits through the active run instead of waiting for
  a full post-transition reapply.

## Recommended Fix Order

### Phase 1 - Instrument before changing visuals

1. Add `TransitionRun` debug state without changing visual behavior.
2. Add consumer source/target reporting for scene data, overlay UI, legends,
   labels, assays, scene overlays, and camera.
3. Add interruption debug: old run id, new run id, promoted source page id, and
   cancellation reason.
4. Add late-load transition debug for layers that finish loading during a run.

### Phase 2 - Centralize orchestration

1. Create one transition run in PageController.
2. Pass the run to SceneManager, CameraTweener, scene overlays, and UI context.
3. Centralize easing resolution.
4. Separate transition mode from the overloaded `isTransitioning` boolean.
5. Make camera completion a consumer event, not the sole transition completion
   authority.

### Phase 3 - Normalize consumer policies

1. Define page-source policies for overlays, legends, labels, assays, and
   editor chrome.
2. Define product transition policies for scalar volumes, slices, isosurfaces,
   section ISO overlays, full-density surfaces, point clouds, and simple meshes.
3. Define field-level policies for section frames and working-area focus.
4. Add explicit transition-opacity participation for ignored-style overlays and
   helper visuals.

### Phase 4 - Fix visual smoothness by product family

1. Section frames and helpers: prevent mid-tween rebuilds; animate stable
   materials and uniforms only.
2. Scalar/volume/MT products: enforce one composed opacity/style formula.
3. Point clouds/full-density products: eliminate snapping fields where smooth
   interpolation is expected.
4. Page scene mood/light: move transitionable fields into the run.
5. Labels/assays/UI overlays: align page-source timing with scene data.

### Phase 5 - Verification

1. Exercise normal forward/back navigation across Utah FORGE pages with MT,
   seismic, sections, volume rendering, and point clouds.
2. Exercise interrupted transitions by triggering next/previous before the first
   camera tween completes.
3. Exercise async late-load behavior by navigating before heavy products finish
   loading.
4. Verify section-frame pages for ISO band flicker, ISO line snap, cone handle
   shading, dashed trace phase reset, ground trace pulsing, and crop/window
   translation.
5. Verify reduced-motion behavior and decide whether page transitions should
   honor it.
6. Run targeted workspace checks after code changes:
   - `npm run check:pages`
   - `npm run check:runtime-assets`
   - `npm run check:utah-runtime`
   - `npm run check:workspace`
   - targeted browser/render scripts for the affected pages

## Non-Goals For The First Fix Pass

- Do not redesign page authoring schema until the runtime ownership model is
  visible in debug.
- Do not add an ad hoc `slide` transition kind without a decision entry.
- Do not broadly refactor `SceneManager.ts` or `PageController.tsx` before the
  transition run model has a narrow integration path.
- Do not tune easing/duration for visual polish until consumer divergence is
  measurable.

## Acceptance Criteria For The Later Repair

A later transition-smoothing pass should not be considered complete until:

1. A single transition run id can be traced across page, camera, scene data,
   overlays, labels, legends, and debug.
2. Interrupted transitions report the same promoted source page for scene data
   and UI consumers.
3. Camera-only tweens no longer look like page transitions to UI consumers.
4. Scene overlays either follow page timing or report their independent timing
   explicitly.
5. Section helper visuals do not rebuild during tween ticks.
6. Scalar/volume/MT opacity composition has one visible formula in debug.
7. Point-cloud visual fields are classified and no unexpected snaps remain.
8. Async layer loads during transition receive transition-aware style state.
9. Debug output exposes enough data to identify which consumer diverged without
   reading code.
