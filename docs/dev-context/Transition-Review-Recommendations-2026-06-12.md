# Transition Review Recommendations - 2026-06-12

Status: review-only findings and recommendations for follow-up agents.
No runtime code was changed during this review.

Scope: page-transition docs, runtime logic, and architecture under
`src/scene/transitions/`, `src/scene/section/`, `src/scene/isoOverlays/`,
and the SceneManager transition entry points. Goal: identify scene object
types that are handled incorrectly or not at all during page transitions,
and recommend fixes that smooth transitions without violating the
Transition Runtime Operating Spec.

Governing contracts read before this review:

- `docs/dev-context/Transition-Runtime-Operating-Spec.md`
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`
- `CLAUDE.md` transition rules (MT scalar protected path, page-fixture ban)

Hard constraints any fixing agent must respect:

- No page-id / page-index / fixture-pair conditionals in transition code.
- No edits to `projects/*/pages/**` or fixtures to "fix" transitions.
- MT full-density scalar/cloud path is protected; do not alter it.
- Final commit must be visually idempotent; no full reapply as a visual fix.
- Opacity is composed (authored x transition x mask x attenuation), never
  overwritten.

---

## Review log

Findings are appended below in stepped passes as each subsystem is read.

### Pass 1 - module inventory (complete)

`src/scene/transitions/` contains 14 modules, ~5.5k lines:

| Module | Lines | Role |
| --- | --- | --- |
| transitionEffectiveLayersForPage.ts | 1365 | classifier: resolves effective layers + transition kinds |
| transitionStyles.ts | 708 | kind registry, snapshot types, style field lists |
| cinematicSceneTransitions.ts | 667 | camera / cinematic transition driver |
| transitionCommitGate.ts | 498 | final-commit gating |
| layerTweenRuntime.ts | 412 | per-frame tween ticking |
| transitionEntityPolicy.ts | 414 | entity assignment policy |
| transitionRenderGraphAdapter.ts | 307 | render-graph source/target adapter |
| productFamilyRegistry.ts | 263 | product family registration |
| transitionExecutionPlan.ts | 255 | execution-plan builder |
| seismicGraphTransitionExecutor.ts | 173 | seismic graph executor |
| environmentSceneTransition.ts | 168 | background/fog owner (TRD-009) |
| transitionEntityOpacityExecutor.ts | 160 | entity opacity executor |
| transitionExecutorRegistry.ts | 99 | executor registry |
| transitionEasing.ts | 26 | easing curves |

Further passes will examine: (2) classifier + kind coverage per scene
object type, (3) entity policy / execution plan vs the operating-spec
assignment model, (4) section + Section ISO + helper runtime, (5) commit
gate and final-commit idempotence, (6) object types with no transition
ownership at all.

### Pass 2 - classifier, kind registry, tween runtime (complete)

Files read: `transitionStyles.ts`, `transitionEffectiveLayersForPage.ts`,
`layerTweenRuntime.ts`, SceneManager opacity/reapply regions.

#### Finding 2.1 - HIGH - mid-transition layer loads never attach; they wait out the whole transition

`targetNotReadyLayerIds` is computed once at transition setup
([transitionEffectiveLayersForPage.ts:764-801](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L764-L801))
and no code path ever removes an id from the set when the layer's async
load resolves mid-transition. Consequences:

- `transitionEnvelopeAllowsLayer()` keeps returning false for the layer
  ([layerTweenRuntime.ts:64-73](../../src/scene/transitions/layerTweenRuntime.ts#L64-L73)),
  so `enforceTransitionVisibilityEnvelope()` clamps it to opacity 0 for
  the rest of the transition.
- `reapplyActiveTransitionPageState()`
  ([SceneManager.ts:3099-3157](../../src/scene/SceneManager.ts#L3099-L3157))
  handles `async-layer-resolve` during a transition but only re-applies
  styles; it neither clears the not-ready flag nor starts an enter tween
  for the newly ready layer.
- The layer finally enters via the post-commit `async-layer-resolve`
  full-reapply path ([SceneManager.ts:4559-4609](../../src/scene/SceneManager.ts#L4559-L4609))
  with a fresh `DEFAULT_LAYER_FADE_MS` (800ms) fade after the transition
  has already finished.

The operating spec readiness rule says: "hold source or attach target at
current transition opacity when ready". Current behavior is "stay absent
until the transition fully completes, then run a second detached fade".
On long transitions a target layer that loaded 200ms in still waits the
full duration, then fades in late - visible as content arriving in two
waves.

Recommendation: when a load resolves while
`activeSceneTransitionContext` is live, delete the id from
`targetNotReadyLayerIds` and start a layer tween from 0 to the target
opacity over the remaining transition time (or attach instantly at the
current envelope value if remaining time is below a small floor). Record
the readiness handoff in the commit-gate debug state per the spec.
Full implementation steps: see "Fix write-up: Finding 2.1" below.

#### Finding 2.2 - MEDIUM - color and categorical channels snap at transition start for every non-scalar layer

`transitionEffectiveLayersForPage` applies the full target style
immediately for any layer that does not qualify for a scalar tween
([transitionEffectiveLayersForPage.ts:1231](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L1231)).
That means `color`, `fillColor`, `outlineColor`, label colors, line
widths, etc. jump to target values on frame one while opacity fades over
the transition. The spec lists `color` and `material uniforms` as
transition channels and requires unsupported channels to be "explicitly
declared discrete", not silently snapped. The render graph adapter
diligently collects `COLOR_STYLE_FIELDS` into channel records, but no
executor interpolates them - the channel data is trace-only.

Recommendation (two acceptable resolutions, pick one explicitly):
(a) declare color/categorical channels `commit-discrete` in the entity
policy and document it in the spec's unsupported-channel list, or
(b) add a color-lerp executor for same-identity visible-in-both layers
(simple-geometry family first). Either way the decision belongs in
`docs/03-decisions.md`; today the behavior is implicit.
Full implementation steps: see "Fix write-up: Finding 2.2" below.

#### Finding 2.3 - MEDIUM - scalar tween eligibility depends on loaded geometry, so behavior varies by load timing

`shouldTweenScalarStyle` requires `layerSupportsScalarStyleTween(id,
group)` which traverses loaded geometry for `scalarValues`
([SceneManager.ts:1528-1551](../../src/scene/SceneManager.ts#L1528-L1551)).
A layer whose data has not finished loading at transition setup gets
`transitionKind: none` for a style change that would have been
`continuous` one second later. Combined with finding 2.1, slow loads
degrade transitions invisibly. Recommendation: derive scalar-tween
eligibility from the layer spec / product family (authoritative,
load-independent), and use geometry presence only as a readiness gate.
Full implementation steps: see "Fix write-up: Finding 2.3" below.

#### Finding 2.4 - LOW - execution-plan and assignment traces are built but mostly unconsumed

The TRD-013 execution layer (`buildTransitionExecutionPlan`) is consumed
only by the seismic entity executor; layer opacity, scene-section,
Section ISO, and working-area paths keep their own guarded kernels and
the plan is "mirrored for trace fidelity"
([transitionEffectiveLayersForPage.ts:926-937](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L926-L937)).
This is allowed by DEC-152 but means the assignment model in the
operating spec (one assignment per entity/channel) is only enforced for
seismic entities. Recommendation: when migrating the next family to the
executor model, prefer the simple-geometry/point-marker family - lowest
risk, and it would carry finding 2.2's color channel cleanly.

#### Finding 2.5 - DOC DRIFT - canonical transition doc line references are stale

`docs/dev-context/Page-Transitions-And-Section-Frames.md` references:

- `sceneSectionController.ts:2845-2851` for `rebuildSceneSectionHelpers`
  - actually at line 3216 now (file is 4,289 lines).
- `sceneSectionController.ts:2398-2476` for cone material - actually at
  776 and 3521.
- `transitionStyles.ts:104-108` for `LayerTransitionKind` - actually at
  121-125.
- `layerTweenRuntime.ts:24-32` for `transitionEnvelopeAllowsLayer` -
  actually 64-73.

`src/scene/CLAUDE.md` says `sceneSectionController.ts` is ~1,180 lines
(actual 4,289, over the stated 1,200-line cap) and `SceneManager.ts` is
~2,550 (actual 5,139). Recommendation: refresh both docs' line
references and size maps; the size-cap claim ("R2 split target met") no
longer holds and misleads agents about read strategy.

### Pass 3 - entity policy, render-graph adapter, execution plan, executors (complete)

Files read: `transitionEntityPolicy.ts`, `transitionRenderGraphAdapter.ts`,
`transitionExecutionPlan.ts`, `transitionExecutorRegistry.ts`,
`seismicGraphTransitionExecutor.ts`, `transitionEntityOpacityExecutor.ts`,
`productFamilyRegistry.ts`.

The entity policy itself is sound: assignment precedence is
skip -> hold-until-ready -> exit -> enter -> crossfade(incompatible/unknown)
-> channel fallback -> preserve-interpolate, with deterministic
dependency-depth ordering. Findings are about what is NOT wired.

#### Finding 3.1 - HIGH (same root as 2.1) - `hold-until-ready` is a terminal state; no re-planner exists

`evaluateTransitionExecutionPlan` says a holding operation "does not ramp
the target in until the operation is re-planned as enter"
([transitionExecutionPlan.ts:220-224](../../src/scene/transitions/transitionExecutionPlan.ts#L220-L224)),
but a repo-wide search finds no re-planning code path. An entity that
classifies `hold-until-ready` stays held for the entire transition and is
resolved only by final commit. The spec's readiness clause ("attach
target at current transition opacity when ready") is unimplemented at
both the legacy layer (finding 2.1) and the execution layer.
Recommendation: implement one readiness re-plan hook - on async layer
resolve during an active transition, re-classify only the affected
entity pairs and swap their operations from `hold-source` to `enter`
with `startMs = now` and remaining-duration ramp. Keep it entity-scoped;
do not rebuild the whole plan (that would re-snapshot live state
mid-flight). Full implementation steps: see "Fix write-up: Finding 3.1"
below.

#### Finding 3.2 - MEDIUM - entity opacity executor overwrites per-child visibility across the entity subtree

`applyTransitionEntityOpacityToTree`
([transitionEntityOpacityExecutor.ts:109-140](../../src/scene/transitions/transitionEntityOpacityExecutor.ts#L109-L140))
sets `object.visible = treeFactor > 0.001` on every descendant of an
entity-tagged object. Any child that is authored invisible inside that
subtree (a hidden survey-geometry role child, an annotation sub-part
toggled off, an invisible pick proxy) is forced visible during the fade
and only restored by the final-commit style reapply. The operating spec
treats visibility/presence as a composed channel; this is an overwrite.
Today the blast radius is limited to seismic survey-geometry and
figure-annotation sub-trees (the only consumers), but this executor is
the template for future family migrations.
Recommendation: capture each object's pre-transition `visible` into
`userData` (same pattern as `transitionBaseMaterialOpacity`) and compose:
`visible = authoredVisible && treeFactor > 0.001`. Fix before any other
family migrates onto this executor.
Full implementation steps: see "Fix write-up: Finding 3.2" below.

#### Finding 3.3 - LOW - dead `holding` branch in enter evaluation

`holdUntilReady` is only ever true for `hold-source` operations
([transitionExecutionPlan.ts:182](../../src/scene/transitions/transitionExecutionPlan.ts#L182)),
so the `holding ? 0 : progress` guard in the `enter` factor can never
take the 0 branch. Harmless, but it documents the intended (missing)
hold->enter re-plan handoff from finding 3.1. Resolve together.

#### Finding 3.4 - LOW - declared executor kinds with no producer

`TransitionExecutorKind` includes `environment-scene` and `working-area`
and the dispatch order lists their buckets, but `genericExecutorKind`
never returns them and no `resolveExecutorKind` override exists. The
environment/fog and working-area owners run entirely outside the plan.
Acceptable under DEC-152 phasing, but the registry reads as if they are
wired. Recommendation: comment them as reserved/unwired in
`transitionExecutorRegistry.ts`, or wire working-area first since its
tween (`workingAreaFocusTween`) is already a single well-bounded owner.

#### Observation 3.5 - seismic slice moves are double-declared

`seismicSliceAxis`/`seismicSliceFraction` are discrete crossfade fields
at the layer level ([transitionStyles.ts:685-698](../../src/scene/transitions/transitionStyles.ts#L685-L698))
while `seismicSliceFraction` is simultaneously a continuous scalar
channel in the seismic graph (`SEISMIC_GRAPH_SCALAR_STYLE_FIELDS`).
Crossfading a slice move is a legitimate "cannot morph safely" call
(slice change resamples the volume texture), but when seismic section
entities later migrate to the execution plan the scalar channel will
claim `interpolate` and contradict the layer-level crossfade. A fixing
agent should declare the slice-position channel `discrete-commit` or
`crossfade` in the graph channel classes at that time, with a decision
entry.

#### Observation 3.6 - product family registry is Utah-FORGE-id keyed with generic fallbacks

`baseFamilyForLayer` resolves families by hard-coded Utah FORGE layer
ids first, generic `layerSpec.type` second
([productFamilyRegistry.ts:50-87](../../src/scene/transitions/productFamilyRegistry.ts#L50-L87)).
This is layer-id (not page-id) coupling, so it does not violate the
page-fixture ban, but new non-FORGE products only get correct families
if their `layerSpec.type` is one of `pointcloud|point|volume|seismic`.
Layer types like `atmosphere-volume`, topo/graticule, and borehole-log
layers fall through to `simple-geometry`. Recommendation: extend the
type mapping as families gain executor-specific behavior; today the
family mostly feeds traces, so this is LOW priority.

### Pass 4 - scene-section controller, Section ISO overlays, helper stability (complete)

Files read: `sceneSectionController.ts` (apply/helper/opacity regions),
`SceneManager.ts` Section ISO transition lifecycle (lines ~1221-1467,
1778-1978, 4786-4830), `sectionIsoOverlay.ts` tagging,
`volumeCutIsoOverlays.ts` transition-root registration.

#### Verified-good in pass 4 (do not re-fix)

- Helper rebuild is correctly gated: `applySceneSectionPlanes()` only
  calls `rebuildSceneSectionHelpers()` when `options.transitionFrame` is
  not set ([sceneSectionController.ts:4037-4044](../../src/scene/section/sceneSectionController.ts#L4037-L4044)).
  The historical per-tick rebuild regression is fixed; tween ticks pass
  `transitionFrame: true` from `tickLayerTweens`.
- Section ISO root lifecycle matches TRD-011/012: source roots are
  cloned snapshots, late target roots (delayed height sampling) register
  through `registerSectionIsoOverlayTransitionTargetRoot()` and start at
  the current crossfade envelope, commit uses a residual clock (120ms
  minimum) instead of snapping when the crossfade has not landed
  ([SceneManager.ts:1918-1953](../../src/scene/SceneManager.ts#L1918-L1953)),
  and interrupt discard keeps live roots in the scene
  ([SceneManager.ts:1778-1801](../../src/scene/SceneManager.ts#L1778-L1801)).
- DEC-071 composition (authored x transition x occlusion attenuation,
  with 0.04/frame attenuation smoothing) is implemented in
  `applySectionIsoOverlayMaterialOpacity`
  ([SceneManager.ts:1342-1387](../../src/scene/SceneManager.ts#L1342-L1387)).

#### Finding 4.1 - HIGH - Section ISO band/line materials have two competing opacity owners

Section ISO band and line materials created in `sectionIsoOverlay.ts`
are tagged BOTH `scalarSectionIsoOverlay = true`
([sectionIsoOverlay.ts:1228](../../src/scene/isoOverlays/sectionIsoOverlay.ts#L1228),
[1387](../../src/scene/isoOverlays/sectionIsoOverlay.ts#L1387)) and
`sceneSectionHelper = true`
([sectionIsoOverlay.ts:1277-1279](../../src/scene/isoOverlays/sectionIsoOverlay.ts#L1277-L1279),
[1399-1400](../../src/scene/isoOverlays/sectionIsoOverlay.ts#L1399-L1400)).
Two writers therefore target the same `material.opacity`/`uOpacity`:

1. `applySectionIsoOverlayMaterialOpacity` - composes
   `authored x transition x occlusion`, base cached in
   `userData.sectionIsoBaseOpacity`.
2. `applySceneSectionHelperTransitionOpacity`
   ([sceneSectionController.ts:2985-3010](../../src/scene/section/sceneSectionController.ts#L2985-L3010)) -
   writes `baseOpacityForMaterial x sceneSectionHelperTransitionOpacity`
   with NO occlusion attenuation, base cached in the separate
   `materialBaseOpacity` map, and it runs at the end of EVERY
   `applySceneSectionPlanes`, including every transition-frame tick
   ([sceneSectionController.ts:4047](../../src/scene/section/sceneSectionController.ts#L4047)).

Risks: (a) per-frame last-writer-wins between a composed value and an
unattenuated value - the historical "band dims then sharpens" family;
(b) the `materialBaseOpacity` cache can capture an already-composed
value as "base" if its first read happens after an ISO composition
write, permanently dimming the helper-path output. This violates the
spec rule that no subsystem may run its own opacity envelope outside
assignment ownership.

Recommendation: make `applySceneSectionHelperTransitionOpacity` skip
materials tagged `scalarSectionIsoOverlay`, and instead feed
`sceneSectionHelperTransitionOpacity` into the ISO composition's
transition factor (single owner, single base cache). Verify with the
`userData` diagnostics fields (`sectionIsoComposedOpacity`,
`sectionIsoTransitionOpacity`) during an active-to-active section tween.
Full implementation steps: see "Fix write-up: Finding 4.1" below.

#### Finding 4.2 - MEDIUM (performance) - section tween ticks re-resolve bounds and traverse the full scene every frame

Every `applySceneSectionPlanes` call - including per-tick
transition-frame applies - recomputes `sceneSectionBounds`
([sceneSectionController.ts:3042-3094](../../src/scene/section/sceneSectionController.ts#L3042-L3094)),
which walks every visible object of every layer calling
`Box3.setFromObject` per object, then traverses all layers again
applying clipping materials. In dual-mask mode
`sceneSectionObjectVisibilityForObject` runs three times per object per
frame (current + source + target styles)
([sceneSectionController.ts:3981-4008](../../src/scene/section/sceneSectionController.ts#L3981-L4008)).
The debug record (`boundsMs`, `materialApplyMs`, `traversedObjectCount`)
already measures this. On dense scenes this is the most likely source of
section-transition frame hitches.

Recommendation: during a tween the from/to styles are frozen - only
progress changes. Cache for the tween's lifetime: (a) resolved bounds
(invalidate on non-transition-frame applies), (b) per-object source and
target visibility resolutions keyed by object id, computed once at tween
start. This is a pure-performance change; behavior must stay identical.
Full implementation steps: see "Fix write-up: Finding 4.2" below.

#### Observation 4.3 - helper transition opacity writes are full-subtree traversals per tick

`applySceneSectionHelperTransitionOpacity` traverses the entire helper
runtime group per call. Cheap relative to 4.2, but the same caching
window applies if profiling shows it matters. Lower priority than 4.2.

### Pass 5 - commit gate, final commit, environment/cinematic owners, scene overlays (complete)

Files read: `transitionCommitGate.ts`, SceneManager finalize region
(~2969-3071, 5100-5110), `PageController.tsx` transition completion
callback (~2680-2755), `environmentSceneTransition.ts`,
`cinematicSceneTransitions.ts` channel table,
`SceneOverlaysController.ts`.

#### Verified-good in pass 5 (do not re-fix)

- Commit gate: single-finalize with duplicate suppression across
  `overlay-end-application` / `tween-completion` /
  `editor-deferred-reapply` phases; post-commit graph check is
  observational only. Matches the spec's final-commit rules.
- Environment background/fog transition (TRD-009) is a clean standalone
  owner: lerped hex + density, fog kept enabled while either side needs
  it, target state at done.
- Cinematic post channels have an explicit declared policy table
  (`CINEMATIC_SCENE_TRANSITION_CHANNELS`) with owner and kind per
  channel - this is the model the spec asks for ("unsupported channels
  must be explicitly declared discrete").

#### Finding 5.1 - MEDIUM - scene overlays do not ride the page-transition clock

`SceneOverlaysController` fades outgoing overlays at transition start
and incoming/changed overlays only at transition end, each on a fixed
`SCENE_OVERLAY_FADE_MS = 800` clock
([SceneOverlaysController.ts:251-304](../../src/scene/overlays/SceneOverlaysController.ts#L251-L304)).
The page's authored `transition.duration`/`easing` are ignored. On a
long transition (cinematic multi-second camera move) target-page
overlays appear only after the camera lands, as a detached 800ms fade -
the same "content in two waves" pattern as finding 2.1. On a short or
`none` transition the 800ms fade outlasts the transition.
Recommendation: pass the active transition's duration/easing into the
overlay applies; enter overlays during the transition once textures are
ready (they load eagerly, so readiness is usually immediate), and clamp
the fade to the remaining transition time. Keep the fixed-duration
policy only for non-transition page applies.
Full implementation steps: see "Fix write-up: Finding 5.1" below.

#### Verification item 5.2 - free-look / interrupted transitions may never finalize

Final commit is invoked from the camera-tween completion callback in
`PageController.tsx:2737`. A transition interrupted by free-look or by
chained navigation relies on the next `transitionEffectiveLayersForPage`
call to rebuild the context. A fixing agent should verify (via
`getTransitionDebugState()` and the commit traces) that an interrupted
transition that is NOT followed by another navigation cannot leave
`activeSceneTransitionContext` alive with `hasFinalized === false` -
that state keeps the visibility envelope enforcement active
indefinitely and suppresses non-async reapplies. If reproducible, add a
finalize-on-interrupt path that records `reason: "interrupted"`.

### Pass 6 - scene-object coverage sweep (complete)

Ownership map of scene object types versus transition handling:

| Scene object type | Transition owner | Status |
| --- | --- | --- |
| Layer groups (geojson/point/mesh/pointcloud/volume/seismic) | layer opacity tween + envelope | OK; color/categorical snap (2.2) |
| MT full-density scalar cloud | `full-density-scalar` protected path | OK (protected, untouched) |
| MT volume / threshold surfaces / slices | discrete crossfade + scalar tween | OK |
| Scene-section masks | TRD-010 interpolated / dual-mask | OK |
| Section-frame helpers (outline, cones, traces, axes) | helper opacity + snapshot crossfade | OK except double-owner (4.1) |
| Section ISO roots (MT/seismic cuts) | root crossfade lifecycle | OK |
| Seismic survey geometry / figure annotations | execution-plan entity executor | OK except visibility overwrite (3.2) |
| Working-area focus | dedicated style tween | OK |
| Terrain-composite fills (lakes, geology, claims, targets) | terrain uniform overrides on tween clock | OK |
| Environment background / fog | TRD-009 owner | OK |
| Cinematic post (grade, vignette, DoF, etc.) | declared channel table | OK |
| Camera | PageController tween + finalize callback | OK (see 5.2) |
| Scene overlays (compass/branding planes) | fixed 800ms detached fade | gap - finding 5.1 |
| Atmosphere volumes | discrete crossfade only | gap - finding 6.1 |
| Borehole log tracks | none (fields dead) | gap - finding 6.2 |
| UI legends (React side) | local UI transitions + deferred live-apply gate | gaps - findings 7.1, 7.2, 7.3, 8.1 |
| Editor panel live edits | `canApplyLiveSceneEdits` defer + flush | gap - finding 7.1 (flush suppressed) |

#### Finding 6.1 - MEDIUM - atmosphere continuous fields are double-declared and can never interpolate

`atmosphereDensity`, `atmosphereSoftness`, `atmospherePuffCount`,
`atmospherePuffScaleM`, `atmosphereScaleJitter`,
`atmosphereVerticalFalloff`, `atmosphereEdgeFade`, and `atmosphereSeed`
appear in BOTH `SCALAR_TRANSITION_STYLE_FIELDS` (interpolable)
([transitionStyles.ts:235-247](../../src/scene/transitions/transitionStyles.ts#L235-L247))
and `LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS` (discrete crossfade)
([transitionStyles.ts:263-281](../../src/scene/transitions/transitionStyles.ts#L263-L281)).
The discrete check runs first in both `authoredProductTransitionKind`
and `shouldCrossfadeDiscreteData`, so any atmosphere change always
snapshot-crossfades. Additionally, atmosphere geometry carries no
`scalarValues`, so `layerSupportsScalarStyleTween` is false anyway -
the scalar declarations are doubly dead. A density change between two
pages crossfades two whole puff systems instead of breathing the same
system, which is heavier and visually noisier.
Recommendation: split the lists - keep `atmosphereSubtype`,
`atmosphereSeed`, `atmospherePuffCount`, bounds mode in the discrete
list; remove the genuinely continuous fields (`density`, `softness`,
`edgeFade`, `verticalFalloff`, drift speeds) from the discrete list and
give atmosphere layers a scalar-tween eligibility path (per finding
2.3's spec-driven eligibility). Needs a decision-log entry.
Full implementation steps: see "Fix write-up: Finding 6.1" below.

#### Finding 6.2 - MEDIUM - borehole log style fields are declared interpolable but no path can interpolate them

All `boreholeLog*` numeric fields sit in
`SCALAR_TRANSITION_STYLE_FIELDS`
([transitionStyles.ts:248-260](../../src/scene/transitions/transitionStyles.ts#L248-L260)),
but `loadUtahForgeBoreholeLogs.ts` writes no `scalarValues` to geometry
userData, so the borehole layer never passes
`layerSupportsScalarStyleTween` and its transition kind resolves to
`none`. Result: borehole track offset/width/scale/depth-window changes
snap at transition start (the immediate `applyStyle(targetStyle)` at
[transitionEffectiveLayersForPage.ts:1231](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L1231)).
The channel list in the operating spec requires these either to work or
to be declared discrete. Recommendation: same fix as 2.3 - eligibility
from layer spec/product family. If borehole interpolation is not wanted,
move the fields out of `SCALAR_TRANSITION_STYLE_FIELDS` and declare them
discrete explicitly.
Full implementation steps: see "Fix write-up: Finding 6.2" below.

#### Observation 6.3 - presence state `dormant` is declared but never produced

`TransitionPresenceState` includes `dormant`, but `graphPresenceState`
only emits `visible | hidden | loading | absent`. Harmless; remove or
document when touching the policy types.

### Pass 7 - quick legends and editor live-apply interplay (complete)

Files read: `ResistivityLegend.tsx` (full), `legendAuthoringTarget.ts`,
`EditorChrome.tsx` live-apply bridge, `EditorContext.tsx` dispatcher
callbacks (`canApplyLiveSceneEdits`, `setEnvLayerStyle`,
`setPageLayerOverride`, `setPageVisibilityOverride`,
`toggleEnvDefaultVisible`), `authoringTarget.ts`,
`SceneManager.setVisible` / `reapplyCurrentPageState` /
`suppressDuplicatePostCommitReapply`, live-apply grep across all legend
panels, `tests/tools/editor-transition-gate-source.test.mjs`.

#### Verified-good in pass 7 (do not re-fix)

- The MT Resistivity Cells mode animation implements the stale-RAF
  contract correctly: the 1.5s RAF loop is token-guarded and
  scope-keyed by project/page/write-page/layer
  ([ResistivityLegend.tsx:558-568](../../src/ui/ResistivityLegend.tsx#L558-L568),
  [658-674](../../src/ui/ResistivityLegend.tsx#L658-L674)); a page-context
  change cancels the frame and clears the local mode state.
- Mode clicks persist only `scalarLegendVisible` +
  `scalarInclusionMode` ([ResistivityLegend.tsx:890-900](../../src/ui/ResistivityLegend.tsx#L890-L900)),
  per the CLAUDE contract.
- The legend header derives `targetMode` from the target authored style,
  not the interpolated ramp style
  ([ResistivityLegend.tsx:722-728](../../src/ui/ResistivityLegend.tsx#L722-L728)).
- All legend panels gate live `applyStyle` writes behind
  `canApplyLiveSceneEdits()`, which defers during an active page
  transition; editor state persistence is never blocked (covered by
  `editor-transition-gate-source.test.mjs`).

#### Finding 7.1 - HIGH - deferred mid-transition edits are flushed into the post-commit suppression window and visually dropped

During a page transition every live scene write from legends and editor
panels is deferred: `canApplyLiveSceneEdits()` returns false and sets
`deferredLiveSceneApplyRef`
([EditorContext.tsx:2309-2315](../../src/editor/EditorContext.tsx#L2309-L2315)).
At transition end, `EditorLiveApplyTransitionBridge` flushes exactly
once by calling `reapplyCurrentPageState()`
([EditorChrome.tsx:589-611](../../src/editor/EditorChrome.tsx#L589-L611)).
That flush cannot land:

- The bridge effect runs after the camera-completion callback, which has
  already called `finalizePageTransitionCommit` synchronously - so
  either the still-live context's `hasFinalized` branch suppresses the
  reapply ([SceneManager.ts:4503-4516](../../src/scene/SceneManager.ts#L4503-L4516)),
  or `suppressDuplicatePostCommitReapply` consumes it as the
  first-post-commit duplicate
  ([SceneManager.ts:2981-2997](../../src/scene/SceneManager.ts#L2981-L2997)).
- The only repair inside the suppression path is the sanctioned
  MT-full-density narrow reapply
  (`applySettledMtCellPointsTargetStyle`,
  [SceneManager.ts:2999-3018](../../src/scene/SceneManager.ts#L2999-L3018)).

Result: an edit made to any non-MT-full-density layer while a
transition is running (legend slider, editor panel control, visibility
toggle on the selected page) is persisted to editor state but never
applied to the live scene - the viewport silently diverges from
authored state until the next edit, navigation, or async resolve. The
existing source test only asserts persistence is not blocked; nothing
asserts the deferred visual flush lands.

Recommendation: give the deferred flush its own reapply reason (e.g.
`"editor-deferred-flush"`) passed by the bridge, and allow that reason
through both suppression branches the same way `"async-layer-resolve"`
is allowed today. Alternatively, skip suppression when the deferred
flag was set during the just-finished transition. Either way, extend
the editor-transition-gate test family with a behavior test: edit a
non-MT layer mid-transition, finish the transition, assert the live
scene style matches the persisted override.

#### Finding 7.2 - MEDIUM - MT mode buttons are clickable during a page transition and capture an interpolated base style

The All Valid Cells / Log10 Resistivity Window buttons disable
themselves during a LOCAL mode animation but not during a PAGE
transition ([ResistivityLegend.tsx:1158-1198](../../src/ui/ResistivityLegend.tsx#L1158-L1198)).
A click mid-transition runs `setMtCellPointsMode` with `style` resolved
from the transition-interpolation branch
([ResistivityLegend.tsx:714-721](../../src/ui/ResistivityLegend.tsx#L714-L721)),
so `authoredSpectrumStyle` / `fullCloudPreviewStyle` bake mid-tween
scalar values into the 1.5s mode animation's from/to styles. While the
page transition runs, each RAF tick's live apply is deferred (no
visual fight - good), but the RAF outlives the page transition and its
remaining ticks plus the final
`applyLiveMtCellPointsStyle({ ...style, ... })` write the stale
interpolated snapshot over the freshly committed target page style.
Persistence stays correct (mode fields only); the live scene's scalar
window/edge values diverge from authored state until the next reapply.
The directives doc says interpolated scalar style is for ramp/handle
visuals only.

Recommendation: either disable the two mode buttons while
`transitionFrame.active` (mirrors `controlsAvailable` behavior), or
build the mode-animation from/to styles from `targetStyle` (authored)
instead of `style`, and bump `modeTransitionTokenRef` when
`transitionActive` flips true so an in-flight mode animation cannot
straddle a page transition.

#### Finding 7.3 - MEDIUM - quick-legend visibility toggles snap instantly and trigger full section/working-area reapplies

Legend master toggles (e.g. MT Cells) route through
`setPageVisibilityOverride` -> `SceneManager.setVisible`, which flips
`group.visible` binarily with no fade and then runs
`reapplySceneSectionPlanes()` and `reapplyWorkingAreaFocus()`
([SceneManager.ts:1192-1206](../../src/scene/SceneManager.ts#L1192-L1206)).
Two consequences: (a) a quick-legend visibility click pops the layer
on/off with zero ramp - inconsistent with the 1.5s slider-style
standard the mode buttons set, and visually harsher than any page
transition; (b) every click pays a full scene-section apply including
`rebuildSceneSectionHelpers` and the full-scene material traversal
(finding 4.2's cost) even when the toggled layer is not sectioned.
`toggleEnvDefaultVisible` has the same shape for environment-level
toggles.

Recommendation: add a faded visibility path for editor/legend toggles -
reuse the existing `layerTweens` machinery with a short local fade
(300-500ms, easeInOutCubic) from the current render opacity to
target, leaving `setVisible` untouched for PageController's internal
instant applies. Scope the post-toggle section/working-area reapply to
the toggled layer where the targeting state allows it. Keep the fade
out of `applyEffectiveVisibilityForPage` so page loads stay instant.

#### Observation 7.4 - slider drags dispatch a persistence write per pointer-move

Legend handle drags call `setPageLayerOverride` on every pointer-move
([ResistivityLegend.tsx:851-865](../../src/ui/ResistivityLegend.tsx#L851-L865)),
dispatching a reducer action (and dirty-marking) per move event in
addition to the live `applyStyle`. Editor-state churn during a drag is
UI-side cost, not a transition defect; if profiling ever shows drag
jank, throttle the persistence dispatch to pointer-up or an interval
while keeping the live apply per-move. No change required now.

### Pass 8 - editor panel selection and authoring-target interplay (complete)

Files read: `authoringTarget.ts` (full), `PageController.tsx`
(`applyAuthoringPageNow`, `previewAuthoringPage`, `goto` selection
paths), `PagePanel.tsx` selection flow, `LayerPanel.tsx`
landed-gating region, `EditorContext.tsx` page-override dispatchers.

#### Verified-good in pass 8 (do not re-fix)

- The editor panel gates page-scoped style controls behind
  `pageSelectionHasLanded` (selection equals current index, not
  transitioning, no target index) and disables them otherwise
  ([LayerPanel.tsx:368-381](../../src/editor/LayerPanel.tsx#L368-L381),
  [authoringTarget.ts:23-40](../../src/editor/authoringTarget.ts#L23-L40)).
- `applyAuthoringPageNow` refuses to fight an active transition
  (`if (isTransitioningRef.current) return`,
  [PageController.tsx:2377-2382](../../src/pages/PageController.tsx#L2377-L2382)),
  so authoring-preview applies cannot stomp transition state.
- `EditorContext` page-override dispatchers only live-apply when the
  write target is the selected page, and route everything through the
  same deferred gate during transitions.

#### Finding 8.1 - MEDIUM - quick legends lack the landed gate; after a mid-transition selection they author and live-apply a page the viewport is not showing

Selecting a page in the sidebar during an active transition updates
editor selection but `applyAuthoringPageNow` no-ops (correctly). If the
transition lands on a different page than the new selection, the editor
panel's controls stay disabled via `pageSelectionHasLanded` - but the
quick legends do not use that gate. `ResistivityLegend` resolves its
working `page` from the SELECTED page once no transition is active
([ResistivityLegend.tsx:638-649](../../src/ui/ResistivityLegend.tsx#L638-L649))
and its live writes (`setSpectralValue`, `setScalarRenderPatch`,
`setEdgeValue`) call `manager.applyStyle` with no landed or
selected-equals-displayed check
([ResistivityLegend.tsx:851-875](../../src/ui/ResistivityLegend.tsx#L851-L875)).
The persistence path compounds it: `setPageLayerOverride` live-applies
the SELECTED page's merged effective style because the write target is
the selected page ([EditorContext.tsx:3281-3305](../../src/editor/EditorContext.tsx#L3281-L3305)),
even though the viewport is displaying a different page. Result: a
legend drag in the selected-not-displayed state writes page-X styles
onto a scene showing page Y. The other legend panels share the
live-apply shape and the same exposure.

Recommendation: give the quick legends the same landed semantics the
panel has - when the legend's authoring page is not the landed
displayed page, either (a) disable the write controls (read-only
legend), or (b) keep controls active but suppress the legend's direct
`manager.applyStyle` and rely on persistence only. Option (a) matches
the editor panel's established UX. Implement once in a shared hook
(e.g. `useLegendAuthoringGate`) consumed by all legend panels rather
than per-legend copies.

---

## Fix write-ups for HIGH findings

Each HIGH finding gets its own implementation write-up below: scope,
concrete steps, edge cases, and verification. The write-ups are
independent; they can be executed by different agents in any order
except where noted (3.1 builds on 2.1's hook).

### Fix write-up: Finding 2.1 - attach mid-transition layer loads at the transition envelope

Scope: `SceneManager.ts` (`reapplyActiveTransitionPageState`,
async-layer-resolve routing), `layerTweenRuntime.ts` (no changes
expected, behavior flows through existing envelope functions). No
changes to classifier field lists or the MT protected path.

Steps:

1. Add a readiness hook inside `reapplyActiveTransitionPageState`
   ([SceneManager.ts:3099-3157](../../src/scene/SceneManager.ts#L3099-L3157)),
   which is already the routing target for `async-layer-resolve` during
   a live, non-finalized transition. At the top of the layer loop,
   resolve newly ready layers:
   - For each id in
     `this.activeSceneTransitionContext.targetNotReadyLayerIds` where
     `this.layers.has(id)` is now true: delete the id from the set.
   - Track these ids in a new context field (e.g.
     `readinessAttachedLayerIds: Set<string>`) so debug state records
     the handoff per the operating-spec readiness rule.
2. For each newly ready id, start an enter tween instead of leaving the
   layer clamped at 0:
   - Skip if the id already has a `layerTweens`, `scalarStyleTweens`,
     or `layerTransitionSnapshots` entry (an executor already owns it).
   - Skip if `!transition.targetVisibleLayerIds.has(id)` (target no
     longer wants it; the envelope keeps it hidden).
   - Compute `target = this.targetOpacityForLayer(this.lastEffectiveEnv,
     this.lastEffectivePage, id)`. If `target <= 0.001`, skip.
   - Apply the target style first (`this.applyStyle(id, effectiveStyle(...))`
     - the existing loop at line 3124 already does this), then
     `this.applyLayerTransitionRenderOpacity(id, 0, 0)` and set
     `this.layerTweens.set(id, { from: 0, to: target, startMs: now,
     durationMs: remaining, easing: transition.easing })` where
     `remaining = max(transition.startMs + transition.durationMs - now,
     FLOOR_MS)` with `FLOOR_MS` around 150. If the transition has under
     `FLOOR_MS` left, apply the target opacity directly
     (`applyLayerTransitionRenderOpacity(id, target, 1)`) - a 1-frame
     fade is worse than a clean commit-time entry.
3. No change is needed in `transitionEnvelopeAllowsLayer` /
   `transitionFrameOpacityForLayer`: once the id leaves
   `targetNotReadyLayerIds` both functions resolve the layer's target
   opacity naturally, and `enforceTransitionVisibilityEnvelope` already
   skips layers that own a `layerTweens` entry.
4. Leave the post-commit `async-layer-resolve` enter-fade path
   ([SceneManager.ts:4559-4609](../../src/scene/SceneManager.ts#L4559-L4609))
   untouched - it remains the correct path for loads that resolve after
   finalize.

Edge cases:

- A load resolving during a `durationMs <= 0` (instant) transition:
  context is short-lived; the skip-on-remaining-floor rule covers it.
- Chained navigation while the enter tween runs: the next
  `transitionEffectiveLayersForPage` call clears `layerTweens` and
  re-snapshots live state, so the half-entered opacity becomes the new
  source - correct by construction.
- Editor mutation of the same layer mid-transition: the
  scalar/snapshot-ownership skip in step 2 prevents double ownership.

Verification:

- Synthetic fixture test (no live pageOrder per the page-fixture ban):
  build source/target pages where the target layer's loader resolves
  100ms into an 800ms transition; assert opacity ramps from ~0 at
  resolve time to target by transition end, with no post-commit second
  fade.
- Existing transition opacity regression test must stay green.
- `npx tsc --noEmit`, `npm run check:workspace`.

### Fix write-up: Finding 3.1 - execution-layer hold-until-ready re-plan

Scope: `transitionExecutionPlan.ts`, plus one call from the readiness
hook added in fix 2.1. Pure-TS module changes; unit-testable without
THREE. Depends on fix 2.1's hook existing (the hook is the only place
that knows readiness changed).

Steps:

1. Give operations an optional per-operation clock. Add
   `startMsOverride?: number` to `TransitionEntityOperation` and use it
   in `operationProgress`
   ([transitionExecutionPlan.ts:202-212](../../src/scene/transitions/transitionExecutionPlan.ts#L202-L212)):
   `const start = operation.startMsOverride ?? startMs`. Today every
   operation shares `plan.startMs`; a re-planned enter must ramp from
   the moment readiness arrived, not from transition start (which would
   make it appear mostly faded-in instantly).
2. Add `replanTransitionEntityReadiness(plan, readyEntityKeys, nowMs,
   remainingMs)` to `transitionExecutionPlan.ts`. For each operation
   where `holdUntilReady === true` and `entityKey` (or
   `parentLayerId`) matches a ready key, mutate in place:
   - `executionMode: "enter"`, `assignment: "enter"`,
     `holdUntilReady: false`,
   - `startMsOverride: nowMs`, `durationMs: max(remainingMs, FLOOR_MS)`,
   - append `traceReasons` entry
     `readiness-replan:<previousMode>-><enter>` so commit traces show
     the handoff.
   Do NOT rebuild the render graphs or re-run the classifier - that
   would re-capture live mid-fade state as a fresh source snapshot and
   violate the source-graph rule.
3. Call it from the fix-2.1 readiness hook with the ready layer's
   entity keys: the layer entity (`layer:<id>`) plus any plan operation
   whose `parentLayerId === id`. Guard with
   `this.activeSceneTransitionContext?.executionPlan`.
4. Delete the dead `holding` branch in `evaluateTransitionExecutionPlan`
   (finding 3.3): after this change an enter operation can exist with a
   fresh `startMsOverride`, and `enteringOpacityFactor = progress` is
   correct unconditionally. The `hold-source` mode keeps its current
   semantics (source at full, target not ramping).

Edge cases:

- Entities whose parent layer became ready but whose own
  `targetReadiness` is still `loading` (derived entities with their own
  async step, e.g. delayed height sampling): only re-plan operations
  whose readiness blocker actually cleared. The seismic executor's
  late-root pattern (`registerSectionIsoOverlayTransitionTargetRoot`)
  already covers Section ISO; do not double-attach those.
- Re-plan arriving after the plan completed
  (`transitionExecutionPlanComplete` true): no-op - final commit owns
  the target state from here.

Verification:

- Unit test in `tests/` against the pure module: build a plan with a
  `hold-source` operation, call `replanTransitionEntityReadiness` at
  t=200ms of an 800ms plan, assert `enteringOpacityFactor` is 0 at
  200ms, ramps monotonically, and `done` lands at 200ms + remaining.
- Assert a non-matching held operation is untouched.
- `npx tsc --noEmit`, `npm run check:workspace`.

### Fix write-up: Finding 4.1 - single-owner Section ISO band/line opacity

Scope: `sceneSectionController.ts`
(`applySceneSectionHelperTransitionOpacity`), `SceneManager.ts`
(`applySectionIsoOverlayMaterialOpacity` call wiring),
`sectionIsoOverlay.ts` (creation-time base seeding only). No changes to
isoline/band generation, `SCALAR_TRANSITION_STYLE_FIELDS`, or anything
in the protected MT scalar path.

Steps:

1. Remove the second writer. In
   `applySceneSectionHelperTransitionOpacity`
   ([sceneSectionController.ts:2985-3010](../../src/scene/section/sceneSectionController.ts#L2985-L3010)),
   skip materials tagged `scalarSectionIsoOverlay === true` before the
   `sceneSectionHelper` write:
   `if (material.userData?.scalarSectionIsoOverlay === true) continue;`
   This stops the unattenuated `baseOpacityForMaterial x helperOpacity`
   write from racing the composed DEC-071 write.
2. Route the helper transition factor through the single composition
   owner instead. In the same traversal, for the skipped
   `scalarSectionIsoOverlay` materials call
   `this.applySectionIsoOverlayMaterialOpacity(material,
   clamp01(this.sceneSectionHelperTransitionOpacity))`
   ([SceneManager.ts:1342-1387](../../src/scene/SceneManager.ts#L1342-L1387)).
   The composition then produces
   `authored x helperTransition x occlusionAttenuation` with one base
   cache (`sectionIsoBaseOpacity`) and one set of diagnostic userData
   fields. Note: `applySectionIsoOverlayMaterialOpacity` is currently
   `private`; expose a narrow internal accessor rather than widening
   the class surface.
3. Make the authored base deterministic. In `sectionIsoOverlay.ts`,
   where band/line materials are created (uOpacity seeded with authored
   opacity at [sectionIsoOverlay.ts:1101](../../src/scene/isoOverlays/sectionIsoOverlay.ts#L1101)),
   also set `material.userData.sectionIsoBaseOpacity = authoredOpacity`
   at creation. Today the base is lazily cached on first read by
   `sectionIsoAuthoredOpacity`, which can capture an already-composed
   value if the first read happens after a transition write.
   Creation-time seeding removes the ordering hazard entirely.
4. Do not touch the `materialBaseOpacity` map or
   `baseOpacityForMaterial` - after step 1 they are no longer consulted
   for ISO materials, and other helper materials (cones, outlines,
   traces, axis labels) keep their current, correct path.

Edge cases:

- Authored opacity edited mid-tween: the composition reads
  `sectionIsoBaseOpacity`, so the editor write path that updates
  authored opacity must update that userData field (check
  `applyStyle`'s ISO branch; if it already rewrites uOpacity from
  style, mirror the base field there).
- Materials on snapshot clones (crossfade sources): clones carry the
  copied userData tags; the skip in step 1 applies to them equally, and
  their opacity is owned by `applyRenderOpacityToTree` on the snapshot
  root - confirm the clone path does not strip
  `scalarSectionIsoOverlay` from cloned material userData
  (`cloneTransitionUserData` keeps primitive fields, so it survives).

Verification:

- Runtime: during an active-to-active section tween over threshold
  surfaces, sample `material.userData.sectionIsoComposedOpacity`,
  `sectionIsoTransitionOpacity`, and
  `sectionIsoThresholdOcclusionAttenuation` per frame; assert
  `composed == authored x transition x attenuation` every sampled frame
  with no two-value alternation between frames.
- Visual recipe from `Page-Transitions-And-Section-Frames.md`: no band
  dim-then-sharpen at tween end, no brightness step when the helper
  clock and the Section ISO root crossfade clock diverge.
- Smoke: `transition.kind = none` still produces zero helper rebuilds.
- Existing transition opacity regression test, `npx tsc --noEmit`,
  `npm run check:workspace`.

---

## Fix write-ups for MEDIUM findings

One write-up per MEDIUM finding, same format as the HIGH write-ups:
scope, steps, edge cases, verification. Dependencies on other write-ups
are stated explicitly; otherwise each is independently executable.

### Fix write-up: Finding 2.2 - color and categorical channels snap at transition start

This is a policy decision before it is a code change. Two resolutions
are acceptable; pick one, record it in `docs/03-decisions.md`, then
implement. Recommended: Option A now, Option B as a follow-up slice for
the simple-geometry family only.

Option A - declare color/categorical channels discrete (baseline,
low risk):

1. In `transitionRenderGraphAdapter.ts`, change the capability that
   `channelsFromRecord` assigns to `colorChannels` from `"interpolate"`
   to `"discrete-commit"`
   ([transitionRenderGraphAdapter.ts:158-164](../../src/scene/transitions/transitionRenderGraphAdapter.ts#L158-L164)).
   Categorical channels already carry `"discrete-commit"`. This makes
   the classifier's assignments honest: a color-only change then
   resolves to `discrete-commit` instead of `preserve-interpolate`
   claiming an interpolation that no executor performs.
2. Add the color channel family to the operating spec's declared
   unsupported-channel list
   (`docs/dev-context/Transition-Runtime-Operating-Spec.md` requires
   unsupported channels to be explicit, not silently snapped).
3. No runtime visual change - this option documents and traces current
   behavior correctly.

Option B - interpolate colors for same-identity layers (visual
improvement, scoped):

1. Extend `interpolatedScalarStyleImpl`
   ([layerTweenRuntime.ts:375-412](../../src/scene/transitions/layerTweenRuntime.ts#L375-L412))
   to lerp `COLOR_STYLE_FIELDS` hex values using the same
   `THREE.Color().lerp()` pattern as `blendHexColor` in
   `environmentSceneTransition.ts`. Guard: both values must parse as
   hex; otherwise commit discrete at tween start.
2. Extend scalar-tween eligibility so a color-only change on a layer
   visible in both pages registers a `continuous` tween (today
   `scalarTransitionStyleChanged` only checks numeric scalar fields; add
   a `colorTransitionStyleChanged` helper and OR it into the
   `shouldTweenScalarStyle` predicate, scoped to the simple-geometry /
   point-markers families first).
3. Cost note: this routes the layer through `applyStyle` per frame for
   the tween duration. Profile with a geojson-heavy page pair before
   widening beyond simple-geometry.

Edge cases: layers whose `applyStyle` rebuilds geometry on color change
must stay discrete (verify per layer type before enrolling it).
Verification: visual - color shifts ramp instead of popping at frame
one (Option B); assignment traces show `discrete-commit` for color-only
changes (Option A); `npx tsc --noEmit`, `npm run check:workspace`.

### Fix write-up: Finding 2.3 - spec-driven scalar-tween eligibility

Scope: `SceneManager.layerSupportsScalarStyleTween`
([SceneManager.ts:1543-1551](../../src/scene/SceneManager.ts#L1543-L1551))
and its call site in the classifier
([transitionEffectiveLayersForPage.ts:1184-1193](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L1184-L1193)).
Must not change `full-density-scalar` classification (protected path).

Steps:

1. Derive eligibility from authoritative, load-independent state:
   `this.layerSpecFor(id)` type and/or the product family from
   `productFamilyRegistry.baseFamilyForLayer`. Eligible families to
   start: `point-cloud`, `scalar-volume`, plus the existing explicit MT
   volume layer id. Keep the geometry-presence check
   (`layerHasScalarPreviewData`) as a secondary OR (covers loaded
   layers whose spec/family fall through), never as the primary gate.
2. Decouple registration from readiness. Today
   `shouldTweenScalarStyle` requires `!!group`; follow the established
   MT full-density pattern (tween registers even when geometry is not
   ready; async reapply + tween ticks apply the interpolated style once
   it arrives - documented in
   `Page-Transitions-And-Section-Frames.md`). Allow tween registration
   when the layer is target-visible but not yet loaded; the readiness
   hook from fix 2.1 applies the in-flight interpolated style on
   attach (`reapplyActiveTransitionPageState` already prefers an active
   `scalarStyleTweens` entry at
   [SceneManager.ts:3112-3123](../../src/scene/SceneManager.ts#L3112-L3123)).
3. Leave the `full-density-scalar` branch untouched: the
   `id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID` checks and
   their semantics must not move or change.

Edge cases: a layer eligible by family whose loaded geometry genuinely
has no scalar data - `applyStyle` with interpolated scalar fields must
be a no-op for it (it already is; the fields only drive scalar-aware
materials). Verification: synthetic fixture where the same authored
scalar change is tested with the layer loaded vs loading - both must
classify `continuous`; transition opacity regression test;
`npx tsc --noEmit`; `npm run check:workspace`.

### Fix write-up: Finding 3.2 - compose authored visibility in the entity opacity executor

Scope: `transitionEntityOpacityExecutor.ts` only. Do this before any
family beyond seismic migrates onto the executor.

Steps:

1. In `applyTransitionEntityOpacityToTree`
   ([transitionEntityOpacityExecutor.ts:109-140](../../src/scene/transitions/transitionEntityOpacityExecutor.ts#L109-L140)),
   capture each object's authored visibility once before the first
   overwrite, mirroring the `transitionBaseMaterialOpacity` pattern:
   `const userData = object.userData ?? (object.userData = {});`
   `if (typeof userData.transitionBaseVisible !== "boolean")`
   `userData.transitionBaseVisible = object.visible;`
2. Compose instead of overwrite:
   `object.visible = userData.transitionBaseVisible === true && treeFactor > 0.001;`
   Apply the same composition to the root write at line 117.
3. Restore on completion: in `applyTransitionEntityOpacityFrames`, when
   `frame.done` is true, traverse the entity objects once more, set
   `object.visible = userData.transitionBaseVisible`, and delete the
   key. (The final-commit seismic style reapply also restores state,
   but the executor must be self-healing so it stays safe for families
   whose commit path is lighter.)
4. Material `transparent` restoration stays as-is (final reapply owns
   it); note this in a comment only if the executor gains a non-seismic
   consumer whose commit does not reapply materials.

Edge cases: an entity faded twice in one transition (e.g. operation
re-planned by fix 3.1) - the `typeof` guard keeps the first-captured
base; correct. An editor visibility toggle mid-fade writes
`object.visible` directly - the next frame overwrites it; acceptable
during a transition window, and the captured base is refreshed next
transition. Verification: unit test (module is THREE-free): subtree with
one authored-invisible child, factor 0.5 - child stays invisible;
factor done - all flags restored, userData keys removed;
`npx tsc --noEmit`; `npm run check:workspace`.

### Fix write-up: Finding 4.2 - cache bounds and visibility resolution across section-tween ticks

Scope: `sceneSectionController.ts` (`applySceneSectionPlanes`,
`sceneSectionBounds`) plus tween-lifecycle hooks in
`transitionEffectiveLayersForPage.ts` / `layerTweenRuntime.ts`. Pure
performance: rendered output must be bit-identical.

Steps:

1. Add a tween-scoped cache (e.g. `this.sceneSectionTweenCache` on the
   host) holding: resolved `bounds`, the source and target
   `resolveSceneSectionMaskContext` results, and two
   `Map<objectUuid, visibility>` for source/target style visibility
   resolutions.
2. Populate lazily on the first `transitionFrame: true` apply of a
   tween; key the cache by the tween object identity
   (`this.sceneSectionStyleTween`) so a new tween never reads a stale
   cache.
3. In `applySceneSectionPlanes`, when `options.transitionFrame` is set
   and the cache matches the active tween:
   - reuse `bounds` instead of calling `sceneSectionBounds`
     ([sceneSectionController.ts:3042-3094](../../src/scene/section/sceneSectionController.ts#L3042-L3094) -
     the dominant cost: per-object `Box3.setFromObject` over every
     visible layer);
   - reuse the source/target mask contexts
     ([sceneSectionController.ts:3943-3948](../../src/scene/section/sceneSectionController.ts#L3943-L3948) -
     styles are frozen for the tween's lifetime, only `progress`
     changes);
   - reuse per-object source/target visibility lookups in the dual-mask
     branch ([sceneSectionController.ts:3981-4008](../../src/scene/section/sceneSectionController.ts#L3981-L4008)),
     falling back to direct computation on cache miss (objects added
     mid-tween by async loads).
   The interpolated current-style visibility
   (`sceneSectionObjectVisibilityForObject` with the eased style) stays
   per-frame - it depends on progress.
4. Invalidate the cache on: tween completion (the `done` full apply),
   any `applySceneSectionPlanes` call without `transitionFrame`,
   `reapplyActiveTransitionPageState`, and layer registry mutation
   (layer added/removed). Cheapest correct rule: clear whenever
   `this.sceneSectionStyleTween` changes or becomes null.

Edge cases: bounds intentionally track content during non-tween
applies; only the frozen-tween window may reuse them. If a mid-tween async
load makes a large layer visible, the cached bounds lag until tween end;
that matches the pre-existing once-per-apply semantics at tween start
and is visually safe (bounds feed frame sizing, re-resolved at the
final full apply). Verification: `lastSceneSectionApplyDebug.boundsMs`
and `.materialApplyMs` drop measurably during a dual-mask tween;
screenshot-compare a section transition before/after (must be
identical); smoke test `transition.kind = none` still performs zero
helper rebuilds; `npx tsc --noEmit`; `npm run check:workspace`.

### Fix write-up: Finding 5.1 - scene overlays on the page-transition clock

Scope: `SceneOverlaysController.ts`, `loadSceneOverlays.ts`
(`fadeSceneOverlayTo` duration parameter already exists), call sites in
`SceneManager.ts` (~3025, 3057, 5100) and the PageController
transition-start path.

Steps:

1. Extend `applySceneOverlaysAtTransitionStart` and
   `applySceneOverlaysAtTransitionEnd` to accept an optional clock:
   `{ durationMs, easing, startMs }`. Callers pass the active
   transition's values (SceneManager has them on
   `activeSceneTransitionContext`; the start-phase caller passes the
   target page's `transition.duration`/`easing`).
2. Move enter fades to the start phase. In
   `applySceneOverlaysAtTransitionStart`
   ([SceneOverlaysController.ts:251-275](../../src/scene/overlays/SceneOverlaysController.ts#L251-L275)),
   fade every resolved overlay toward its target - both decreases
   (current behavior) and increases - using the transition clock.
   Overlay textures are loaded eagerly at registration, so readiness is
   immediate; the existing registration replay covers handles that
   register mid-tween.
3. Make the end phase a clamp, not a second fade. In
   `applySceneOverlaysAtTransitionEnd`
   ([SceneOverlaysController.ts:277-304](../../src/scene/overlays/SceneOverlaysController.ts#L277-L304)),
   for any handle not at target (registration raced the tween, or an
   editor change landed mid-transition), fade over the remaining time
   `max(transitionEndMs - now, 150)` instead of a fresh 800ms.
4. Instant transitions (`durationMs <= 0` or kind `none`): apply target
   opacity directly, no tween.
5. Keep `SCENE_OVERLAY_FADE_MS = 800` for the non-transition
   `applySceneOverlaysForPage` path (editor toggles, mount-time apply).
6. Update `SceneOverlayDebugState.policy` from
   `"fixed-duration-linear-fade"` to reflect the new clock source so
   the diagnostic stays truthful.

Edge cases: chained navigation mid-fade - the next transition-start
apply re-targets every handle on the new clock; `fadeSceneOverlayTo`
re-anchoring from current opacity already handles this. Easing support
in the overlay tween is optional; duration matching alone removes the
two-wave artifact - add easing only if `tickSceneOverlayTweens` can take
an `EasingName` without reaching into transition modules.
Verification: long cinematic transition - overlays fade during the
camera move and are settled at landing, no post-landing 800ms fade;
`transition.kind = none` - overlays switch instantly; overlay debug
state shows the transition-derived duration; `npx tsc --noEmit`;
`npm run check:workspace`.

### Fix write-up: Finding 6.1 - split atmosphere discrete vs continuous fields

Scope: `transitionStyles.ts`
(`LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS`), the atmosphere style-apply
path (verify uniform-only fields), eligibility from fix 2.3. Needs a
`docs/03-decisions.md` entry.

Steps:

1. Audit the atmosphere `applyStyle` path first and classify each field
   as uniform-only (safe to interpolate) or geometry-regenerating (must
   stay discrete). Expected split, to be confirmed against the code:
   - stay discrete: `atmosphereSubtype`, `atmosphereSeed`,
     `atmospherePuffCount`, `atmospherePuffScaleM`,
     `atmosphereScaleJitter`, `atmosphereBoundsMode`, bounds
     center/size (these re-place or re-instance puff geometry);
   - move to continuous: `atmosphereDensity`, `atmosphereSoftness`,
     `atmosphereVerticalFalloff`, `atmosphereEdgeFade` (shader
     uniforms). Any field that turns out to rebuild geometry stays in
     the discrete list regardless of this table.
2. Remove the confirmed-continuous fields from
   `LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS`
   ([transitionStyles.ts:263-281](../../src/scene/transitions/transitionStyles.ts#L263-L281)).
   They already sit in `SCALAR_TRANSITION_STYLE_FIELDS`, so once the
   discrete check stops claiming them, `scalarTransitionStyleChanged`
   sees them.
3. Enroll `atmosphere-volume` layers in scalar-tween eligibility via
   fix 2.3's spec-driven path (this write-up depends on 2.3; without
   it, atmosphere geometry has no `scalarValues` and the kind still
   resolves to `none`).
4. Record the split in `docs/03-decisions.md` (which fields are
   discrete and why), satisfying the spec's
   explicitly-declared-discrete rule.

Edge cases: a page pair changing both a continuous field (density) and
a discrete field (seed) - the discrete check still wins and the whole
layer crossfades; correct and unchanged. Bounds interpolation is
deliberately out of scope (spatial channel; a later slice may move it).
Verification: fixture pages differing only in `atmosphereDensity` -
kind `continuous`, density ramps with no puff-system double-render;
differing in `atmosphereSeed` - kind `discrete-crossfade` as today;
`npx tsc --noEmit`; `npm run check:workspace`.

### Fix write-up: Finding 6.2 - resolve borehole log field handling

Scope: `transitionStyles.ts` field lists, possibly
`forgeDiscreteDataStyleChanged`. Needs a `docs/03-decisions.md` entry
either way.

Steps:

1. Decide interpolate vs discrete by inspecting how the borehole style
   fields are applied (`loadUtahForgeBoreholeLogs.ts` /
   `siteDetailStyles.ts`). The deciding question: do
   `boreholeLogTrackOffsetM`, `boreholeLogDepthMinFt/MaxFt`,
   `boreholeLogVerticalExaggeration`, etc. drive uniforms/transforms,
   or do they rebuild curve/track geometry per change?
2. If they rebuild geometry (likely for depth-window and exaggeration):
   declare them discrete -
   - remove all `boreholeLog*` fields from
     `SCALAR_TRANSITION_STYLE_FIELDS`
     ([transitionStyles.ts:248-260](../../src/scene/transitions/transitionStyles.ts#L248-L260));
   - add a borehole branch to `forgeDiscreteDataStyleChanged`
     ([transitionStyles.ts:616-708](../../src/scene/transitions/transitionStyles.ts#L616-L708))
     keyed by the borehole layer id constant or `layerSpec` type
     (layer-id keying is allowed; page-id keying is not), listing the
     authored fields whose change should snapshot-crossfade. This turns
     the current hard snap into the standard crossfade.
3. If they are uniform/transform-driven: keep the fields in
   `SCALAR_TRANSITION_STYLE_FIELDS` and enroll the borehole layer in
   fix 2.3's spec-driven eligibility (same dependency as 6.1).
4. Either way, record the declaration in `docs/03-decisions.md` so the
   channel is explicitly discrete or explicitly interpolable, never
   implicit.

Edge cases: mixed outcome (some fields uniform-driven, some
geometry-rebuilding) is fine - split them across the two lists exactly
as the atmosphere fix does; the discrete check winning over the scalar
check is the established precedence. Verification: fixture pages
differing only in a borehole field - either a crossfade (option 2) or a
ramp (option 3), never a frame-one snap; `npx tsc --noEmit`;
`npm run check:workspace`.

---

## Prioritized fix order

Review complete. Recommended sequencing for fixing agents; each step is
independently verifiable and respects the operating-spec constraints.

1. **Finding 4.1** (HIGH, visual) - single-owner the Section ISO
   band/line opacity write. Smallest blast radius, directly in the
   spec's "first likely code target" cluster, and removes a live
   flicker mechanism. Implementation: see "Fix write-up: Finding 4.1"
   above.
2. **Findings 2.1 + 3.1 + 3.3** (HIGH, structural) - readiness handoff:
   remove a layer from `targetNotReadyLayerIds` when its load resolves
   mid-transition, start its enter tween at the current envelope, and
   wire the hold->enter re-plan at the execution layer. Fixes the
   "content arrives in two waves" family for every late-loading layer.
   Implementation: see "Fix write-up: Finding 2.1" and "Fix write-up:
   Finding 3.1" above (2.1's hook is a prerequisite for 3.1).
2b. **Finding 7.1** (HIGH, correctness) - let the editor's deferred
   live-edit flush through the post-commit suppression window (distinct
   reapply reason allowed like `async-layer-resolve`), with a behavior
   test that a mid-transition edit to a non-MT layer is visible after
   the transition. Small, isolated, and it un-breaks every legend and
   editor control during transitions.
3. **Finding 3.2** (MEDIUM, correctness) - compose authored visibility
   in the entity opacity executor before any other family migrates to
   it. Implementation: see "Fix write-up: Finding 3.2" above.
4. **Finding 5.1** (MEDIUM, visual) - put scene overlays on the page
   transition clock. Implementation: see "Fix write-up: Finding 5.1"
   above.
5. **Findings 2.3 + 6.1 + 6.2** (MEDIUM, declaration cleanup) -
   spec-driven scalar-tween eligibility, then split the atmosphere
   discrete/continuous lists and resolve borehole field handling. One
   decision-log entry can cover all three. Implementation: see "Fix
   write-up: Finding 2.3", "Fix write-up: Finding 6.1", and "Fix
   write-up: Finding 6.2" above (6.1 and 6.2's interpolate option
   depend on 2.3 landing first).
6. **Finding 2.2** (MEDIUM, policy decision) - decide color-channel
   handling (declare discrete vs interpolate) with a decision entry.
   Implementation: see "Fix write-up: Finding 2.2" above.
7. **Finding 4.2** (MEDIUM, performance) - cache bounds and visibility
   resolution across section-tween ticks. Pure perf; do after the
   correctness items so profiling reflects final behavior.
   Implementation: see "Fix write-up: Finding 4.2" above.
7b. **Findings 7.2 + 8.1** (MEDIUM, legend gating) - disable or re-base
   the MT mode buttons during page transitions, and give all quick
   legends the panel's landed-gate semantics via one shared hook. Do
   together; both are "legend writes against the wrong base state".
7c. **Finding 7.3** (MEDIUM, visual) - faded visibility path for
   editor/legend toggles plus layer-scoped section/working-area
   reapply.
8. **Finding 2.5** (DOC) - refresh stale line references and size maps
   in `Page-Transitions-And-Section-Frames.md` and `src/scene/CLAUDE.md`.
9. **Verification item 5.2** - reproduce-or-clear the
   interrupted-transition finalize question; fix only if reproducible.
10. **Findings 2.4 + 3.4 + observations** (LOW) - fold into the next
    executor-migration slice rather than fixing standalone.
11. **Success factors A1-A9** (see "Additional success factors" below) -
    highest leverage first: A2 (interruption matrix test) and A9
    (editor-mutation test) before starting the HIGH fixes so the
    refactors land against a safety net; A4 (hidden-tab handling) and
    A3 (resource soak) next; A5-A8 opportunistically alongside related
    work.

## Additional success factors

Gap items beyond the per-subsystem findings: things no finding covers
but that determine whether the transition system stays smooth once the
fixes land. Added individually below.

### A1 - verified: single transition clock authority

Recorded as verified-good so nobody "fixes" it. Camera tween, layer
transition, environment scene transition, and cinematic transition all
receive the same `target.transition.duration` and
`target.transition.easing` from one call site
([PageController.tsx:2503-2573](../../src/pages/PageController.tsx#L2503-L2573)).
There is no clock divergence between camera and data layers. The only
subsystems off this clock are scene overlays (finding 5.1) and the
Section ISO residual commit clock (intentional, bounded at ~120-360ms).
Any new transition-participating subsystem must take its clock from this
same site - add that rule to the operating spec when next edited.

### A2 - interruption / chained-navigation stress coverage

The existing transition test suite (15 files under `tests/tools/`) is
pure-module: commit gate, execution plan, executors, adapters, source
guards. No test exercises the interruption path end-to-end: navigate
again at 10% / 50% / 90% of a running transition, including
freelook-interrupt (`NavigationReason: "interrupted"` / `"freelook"`).
The riskiest state lives exactly there: orphaned layer snapshots,
Section ISO transition roots surviving a discard, helper snapshots from
the previous tween, and the `activeSceneTransitionContext` /
commit-gate handoff (verification item 5.2).

Recommendation: add a synthetic-fixture interruption matrix test
(fixture builders only, per the page-fixture ban) asserting after each
interrupt-and-complete sequence: zero entries in
`layerTransitionSnapshots`, no objects tagged
`sectionIsoOverlayTransitionRoot` left in the scene, no
`sceneSectionHelperTransitionSnapshot`, `activeSceneTransitionContext`
null, and commit traces recording the interrupted run. This single test
guards the whole "ghosting/persisting to unrelated pages" symptom
family in the operating spec.

### A3 - GPU resource hygiene across chained transitions

Every discrete crossfade clones a layer subtree
(`cloneLayerTransitionSnapshot`), every Section ISO transition clones
overlay roots, and helper snapshots clone section helper groups.
Disposal paths exist (`disposeObjectTree`,
`clearLayerTransitionSnapshots`, `discardSectionIsoOverlayTransition`),
but nothing proves they hold up under rapid chained navigation, where a
new transition begins before the previous one's clones are released.
A leak here degrades transitions progressively - exactly the "it gets
choppier the longer the deck runs" failure mode.

Recommendation: add a soak check to the verification recipe: run ~50
chained transitions across crossfade-heavy synthetic fixtures and
assert `renderer.info.memory.geometries` and `.textures` return to the
pre-run baseline (allowing the steady-state delta of the final page).
Wire it as a deck-state-excluded tool (named as such) or a Playwright
diagnostic, not into app-health verification.

### A4 - hidden-tab / RAF-starvation handling is absent

No `visibilitychange` or `document.hidden` handling exists anywhere in
`src/`. All transition clocks are `performance.now()`-anchored, so a
transition that starts and then loses the tab resumes with every clock
past its end: layer tweens, the section style tween, the Section ISO
residual clock, and overlay tweens all complete in a single catch-up
frame when RAF resumes. That is usually benign (everything lands at
target), but the multi-clock landings are unordered - the Section ISO
crossfade commit, the section full apply, and the final commit can
execute in one frame in an order never exercised during normal play.

Recommendation: on visibility regain during an active transition,
short-circuit deterministically - advance every transition clock to
done and run the normal completion sequence once (tick -> ISO commit ->
final commit), rather than letting each subsystem independently detect
overrun. Small change in the frame driver; removes a whole class of
hard-to-reproduce "it glitched when the laptop woke up" reports.

### A5 - numeric frame-budget guard for transition ticks

The instrumentation already exists (`lastLayerTweenTickDebug` with
per-stage ms, `lastSceneSectionApplyDebug` with
bounds/material/helper timings, `traversedObjectCount`), but nothing
consumes it as a pass/fail signal - smoothness regressions are caught
only by eye. After finding 4.2 lands, the numbers become stable enough
to budget.

Recommendation: extend the verification recipe with a numeric gate: on
a dense synthetic fixture pair (dual-mask section change + crossfade +
scalar tween simultaneously), sample `lastLayerTweenTickDebug.totalMs`
across the transition and assert p95 below a budget (pick the budget
from a baseline run, e.g. 2x median hardware frame headroom). Run it as
a named perf tool, excluded from app-health verification, so it can be
strict without flaking CI.

### A6 - dispatch-order drift guard

`TRANSITION_EXECUTOR_DISPATCH_ORDER`
([transitionExecutorRegistry.ts:58-67](../../src/scene/transitions/transitionExecutorRegistry.ts#L58-L67))
documents the intended per-frame order (scene-section masks first
because they set clip uniforms other layers read, then working-area,
scalar, layer opacity, snapshots, Section ISO, seismic, environment).
The actual order is hand-maintained imperative sequence in
`tickLayerTweensImpl` and the SceneManager frame driver. Nothing ties
them together; a future edit that reorders a tick block silently
invalidates the registry's documentation and can produce one-frame
uniform/opacity inconsistencies that read as flicker.

Recommendation: add a source-guard test (same pattern as the existing
`*-source.test.mjs` guards) asserting the tick sequence in
`layerTweenRuntime.ts` matches `TRANSITION_EXECUTOR_DISPATCH_ORDER` -
either by parsing the call order or by emitting a runtime order trace in
debug state and asserting it. Cheap insurance on an invariant the
registry already claims.

### A7 - consolidate the default fade constants

`DEFAULT_LAYER_FADE_MS = 800`
([transitionEffectiveLayersForPage.ts:38](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L38)),
the post-commit async-resolve enter fade (also 800, same constant), and
`SCENE_OVERLAY_FADE_MS = 800`
([SceneOverlaysController.ts:16](../../src/scene/overlays/SceneOverlaysController.ts#L16))
are three independent declarations of the same design value. They agree
today by coincidence. When fix 5.1 puts overlays on the transition
clock, the remaining non-transition fades should share one constant in
one module (e.g. `transitionStyles.ts` or a small
`transitionDefaults.ts`) so future tuning changes every detached fade
together instead of desynchronizing them.

### A8 - free-look return paths bypass the transition system (document, then decide)

`tweenTo(pose, 1500, "easeOutCubic")` camera moves at
[PageController.tsx:2826](../../src/pages/PageController.tsx#L2826) and
[PageController.tsx:2897](../../src/pages/PageController.tsx#L2897)
(free-look return / pose restore) move the camera without creating a
transition context - no layer transition, no commit gate, no envelope.
For a same-page camera return this is correct (no state change to
transition), but it is an undocumented exception to "every navigation
runs through the transition runtime", and a future feature (e.g.
returning from free-look directly to a different page) could reuse
these paths and silently skip layer transitions.

Recommendation: no behavior change. Add one paragraph to the operating
spec naming these as sanctioned non-transition camera moves, with the
rule that any path that changes effective page/environment state must go
through `transitionEffectiveLayersForPage` + the commit gate, never
through a bare pose tween.

### A9 - editor-mutation-during-transition behavior test

The operating spec's user/editor mutation section distinguishes saved
page state, selected authoring state, live scene state, transition
snapshots, and in-flight mutations. The runtime honors this through
`captureLayerRenderStates` (live source) and
`reapplyActiveTransitionPageState` (mid-transition editor writes), but
no test pins the behavior: an editor style change to layer A during an
active transition must (a) not restart or snap layer B's tween, (b) not
contaminate the source snapshot, and (c) survive final commit without a
visible second apply. This is the regression class most likely to
reappear during the refactors recommended above, because every fix
write-up touches the reapply path's neighborhood.

Recommendation: synthetic-fixture behavior test: start a transition,
mutate one layer's style and one unrelated layer's visibility
mid-flight, then assert tween continuity for untouched layers (opacity
monotonic, no restart), the mutated values present after final commit,
and commit traces free of duplicate target assertions beyond the
suppressed ones the gate already counts.

## Agent handoff prompt

Copy-paste prompt for the reviewing/fixing agent:

> Task: review `docs/dev-context/Transition-Review-Recommendations-2026-06-12.md`
> and independently verify its top findings against current source before
> planning any fix. This pass is review + audit only - do not edit
> runtime code. Deliverable: a validated, sequenced fix plan.
>
> Read first, in order:
>
> 1. `CLAUDE.md` - operating contract, output rail, protected MT
>    scalar path, page-fixture ban, search-hygiene no-go paths.
> 2. `docs/dev-context/Transition-Runtime-Operating-Spec.md` - the
>    active transition operating contract.
> 3. `docs/dev-context/Page-Transitions-And-Section-Frames.md` -
>    helper-stability and ISO composition contracts (line references in
>    it are stale per finding 2.5; trust the rules, not the line
>    numbers).
> 4. The review report itself - findings, per-finding fix write-ups,
>    prioritized fix order, success factors A1-A9.
>
> Audit before planning - re-verify each claim in current source (the
> report's line anchors may have drifted since 2026-06-12):
>
> 1. Finding 4.1 (Section ISO double opacity owner): confirm band/line
>    materials in `src/scene/isoOverlays/sectionIsoOverlay.ts` still
>    carry both `scalarSectionIsoOverlay` and `sceneSectionHelper`
>    tags; confirm `applySceneSectionHelperTransitionOpacity` in
>    `src/scene/section/sceneSectionController.ts` still writes those
>    materials without occlusion attenuation while
>    `applySectionIsoOverlayMaterialOpacity` in
>    `src/scene/SceneManager.ts` writes the composed value. Verify at
>    runtime during an active-to-active section tween by sampling
>    `material.userData.sectionIsoComposedOpacity` /
>    `sectionIsoTransitionOpacity` per frame and looking for two-value
>    alternation.
> 2. Findings 2.1 + 3.1 (readiness handoff): confirm
>    `targetNotReadyLayerIds` is still never pruned mid-transition
>    (grep for deletions), that `reapplyActiveTransitionPageState`
>    starts no enter tween, and that no hold->enter re-planner exists in
>    `transitionExecutionPlan.ts`. Reproduce the two-wave entry with a
>    target layer whose loader resolves mid-transition.
> 3. Finding 7.1 (deferred edit flush suppressed): trace
>    `EditorLiveApplyTransitionBridge` in `src/editor/EditorChrome.tsx`
>    into `reapplyCurrentPageState` and both suppression branches in
>    `src/scene/SceneManager.ts`. Reproduce by editing a non-MT layer
>    style mid-transition and confirming the live scene diverges from
>    the persisted override after the transition lands.
> 4. Spot-check at least two "verified-good" entries (helper rebuild
>    gating, Section ISO root lifecycle) before relying on them.
>
> Plan output requirements, per the operating spec's "Required evidence
> before code": transition state ownership map, render entity/channel
> inventory, unsupported channel list, first-slice implementation plan,
> and source guards against page-specific fixes. Use the report's
> per-finding fix write-ups as the implementation basis; deviate only
> with stated reasons. Sequence per the report's prioritized fix order
> (4.1 first, then 2.1/3.1, then 7.1) unless the audit overturns a
> finding - if it does, record why in the report under a new dated
> section instead of deleting the finding.
>
> Constraints: no page-id/page-index/fixture-pair conditionals; no
> edits to `projects/*/pages/**` or fixtures; the MT full-density
> scalar path is protected and must not change; behavior tests use
> synthetic fixtures only; `npx tsc --noEmit` and
> `npm run check:workspace` plus the transition opacity regression test
> gate any later code change; new behavior decisions need
> `docs/03-decisions.md` entries.

## Constraints recap for fixing agents

- Verify every step with `npx tsc --noEmit`, `npm run check:workspace`,
  and the transition opacity regression test.
- Use `SceneManager.getTransitionDebugState()` and the material
  `userData` diagnostic fields for runtime evidence; reproduction pages
  are evidence only, never fix targets.
- The MT full-density scalar/cloud path is protected: none of the items
  above may alter `full-density-scalar` classification, scalar inclusion
  semantics, or resistivity isoline generation.
- New behavior decisions (color channels, atmosphere field split,
  borehole declaration, overlay clock) each need a `docs/03-decisions.md`
  entry; do not rewrite older entries.

## 2026-06-12 topo public-surface transition audit note

- Render-stack trace for `projects/utah-forge` page `156_page` showed topo
  material authority from `environment.scene.terrain`, active preset `user-3`,
  shader `terrainMaterial/topo-image`, NAIP 2024 8192 texture
  `v=684f5a7e42719aa9`, public clip enabled, rounded-square edge fade, and
  runtime terrain mesh geometry.
- Synthetic visibility transitions classified terrain as `fade-opacity`;
  terrain shader `uOpacity` accepted transition writes, ruling out the
  shader-ignore/no-uniform hypothesis for ordinary visibility fades.
- Synthetic public-surface clip movement reproduced the active-to-active snap
  mechanism: numeric clip fields forced `discrete-crossfade`, created a terrain
  layer snapshot, and hid/re-entered the live terrain root despite compatible
  render-graph assignment.
- Fix family: treat numeric public-surface clip bounds as continuous
  page-clock style channels, keep `publicSurfaceClipEnabled`,
  `publicSurfaceClipShape`, and `publicSurfaceClipPreviewVisible` discrete, and
  allow the topo surface layer to use the existing scalar-style tween executor.
  No page ids, page indexes, fixture pairs, or project page JSON changes were
  used.
