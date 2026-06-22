# Background / Light Mode Transition Regression Audit - 2026-06-16

## Scope

Audit only. No runtime, source, page, launcher, or fixture fixes were made while
collecting this evidence.

Observed issue: after recent transition work, pages can appear to inherit the
previous page's background or dark/light treatment after the transition stops.

Active branch: `CODEX_Tansition_003`.

Dirty runtime/test patch at audit start:

- `src/scene/SceneManager.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/transitionStyles.ts`
- `tests/tools/environment-scene-transition-source.test.mjs`
- `tests/tools/section-iso-transition-smoothing-source.test.mjs`
- `tests/tools/working-area-focus-transition-source.test.mjs`

## Render-Stack Trace

Source data for the reported dark/light case is clean. The target pages are not
authored as light pages.

Environment scene:

- `lightMode`: `false`
- dark background: `#383838`
- light-mode background: `#d4d4d4`
- dark fog: `#454545`
- light fog: `#b5b5b5`
- fog density: `0.0000037267080745341615`
- render presets: none in `projects/utah-forge/environment.json`

Representative pages:

| Index | Page id | Title | Page scene override | Resolved background/fog |
| --- | --- | --- | --- | --- |
| 1 | `157_page` | `Utah Forge Project Location` | `lightMode: true` | light `#d4d4d4`, fog `#b5b5b5` |
| 16 | `61_psdm_mt_58_32_source_location_tie` | `PSDM + MT + 58-32 Source-Location Tie` | none | dark `#383838`, fog `#454545` |
| 19 | `182_page` | `3d duplicate duplicate duplicate duplicate duplicate` | none | dark `#383838`, fog `#454545` |
| 20 | `131_page` | `MT High-Resistivity Context duplicate duplicate duplicate duplicate duplicate` | none | dark `#383838`, fog `#454545` |
| 25 | `167_page` | `1 duplicate duplicate duplicate duplicate duplicate` | `lightMode: false` | dark `#383838`, fog `#454545` |
| 30 | `137_page` | `MT High-Resistivity Context duplicate duplicate duplicate duplicate duplicate duplicate duplicate` | none | dark `#383838`, fog `#454545` |
| 31 | `133_page` | `L11 BAND` | none | dark `#383838`, fog `#454545` |
| 32 | `134_page` | `MT High-Resistivity Context duplicate duplicate duplicate duplicate duplicate` | none | dark `#383838`, fog `#454545` |

Conclusion: a light background/fog landing on pages 16, 19, 20, 25, 30, 31, or
32 is runtime state carryover. It is not explained by project page data, page
order, render presets, or launcher/server configuration.

## Contract References

Active transition contracts say:

- Source graph must be current live resolved render state at transition start.
- Final commit must be visually idempotent.
- Background and fog are environment-scene transition channels.
- Final commit must not reassert global/default state over page-local target
  state.
- Target graph must resolve from the target effective state, including
  page-local state.

## Introduced Patch Findings

### Finding 1: final helper leaves terminal transition frame as active bridge state

The current dirty patch adds:

```ts
private commitEnvironmentSceneTargetFrame(
  environment: EnvironmentSetup,
  page: PresentationPage,
): void {
  const targetState = resolveBackgroundFogState(
    resolveCinematicSceneForTransition(environment, page),
  );
  const frame: EnvironmentSceneTransitionFrame = {
    ...targetState,
    progress: 1,
    done: true,
  };
  this.environmentSceneTransition = null;
  this.applyEnvironmentSceneTransitionFrame(frame);
  this.currentEnvironmentSceneTransitionFrame = frame;
}
```

`currentEnvironmentSceneTransitionFrame` is used by `updateCinematicPostFrame()`
to synthesize a scene for active cinematic blending. Leaving a final settled
frame in that field after `environmentSceneTransition` has been nulled creates a
stale environment-frame bridge.

Risk:

- a later cinematic/post frame can read a previous terminal background/fog frame;
- tests do not assert that settled final commit clears this transition-only
  bridge state;
- this can make dark/light treatment appear correct during the transition and
  then wrong after final commit or a later post/frame tick.

### Finding 2: final helper does not land the post-processing/tint side of background/fog

`applyEnvironmentSceneTransitionFrame()` writes:

- renderer clear color;
- `scene.background`;
- scene fog;
- topo fog uniforms;
- layer fog density.

During active transitions, `updateCinematicPostFrame()` also applies fog-driven
post tint by composing `syntheticSceneForEnvironmentFrame(frame)` into cinematic
postprocessing.

The current final helper only lands renderer/fog state. It does not apply the
same terminal environment frame through `applyCinematicPostProcessing()`, and the
new test does not guard this. That leaves two writers for "background feeling":
the renderer/fog target state and whatever post/tint state was last applied.

Risk:

- the clear color can be target-correct while grade/tint still reads from an
  older page state;
- this matches the user report that the transition looks correct until the
  transition stops, then the dark/light treatment appears wrong.

### Finding 3: existing final commit order is fragile around page-local overrides

`finalizePageTransitionCommit()` calls:

```ts
this.applyEnvironment(environment);
this.applyPageScene(nextPage);
this.commitEnvironmentSceneTargetFrame(environment, nextPage);
```

`applyEnvironment(environment)` resolves page-local scene overrides through
`this.lastEffectivePage`. If `lastEffectivePage` is stale for any path, the
environment pass can re-apply the previous page's light/dark override before the
new helper repairs only renderer/fog. `applyPageScene(nextPage)` updates
`lastEffectivePage`, but it does not re-run the full scene merge unless the
render preset changes.

`transitionEffectiveLayersForPage()` normally sets `lastEffectivePage` to the
target before final commit, which masks this in straightforward transitions.
The order is still unsafe for interrupted, async reapply, or late commit paths.

Risk:

- previous page scene overrides can re-enter final commit;
- final helper hides part of the bug by fixing renderer/fog, but not all
  environment/postprocessing state.

### Finding 4: the new guard is too narrow

`tests/tools/environment-scene-transition-source.test.mjs` added a guard for the
final helper, but it only proves:

- helper exists;
- helper resolves target background/fog;
- helper runs after `applyEnvironment()` and `applyPageScene()`.

It does not prove:

- `currentEnvironmentSceneTransitionFrame` is cleared after final commit;
- final postprocessing/tint is landed with target background/fog;
- `applyEnvironment()` resolves against the target page at final commit;
- interrupted navigation cannot commit an older page's environment.

## Browser Evidence

Fresh headless app load at `http://127.0.0.1:42902/`:

- direct `goto(1)` then settled `goto(16)` landed dark in sampled pixels;
- quick interrupted `goto(1)` then `goto(16)` also landed dark in a fresh
  browser session.

This did not reproduce the user's current in-app leak in a clean headless
session. That points to a state-lifecycle bug rather than bad page data. The
best code-level matches are the stale terminal frame bridge and incomplete final
post/tint landing introduced in the current patch.

## Root Cause Assessment

Primary root cause in the introduced patch:

`commitEnvironmentSceneTargetFrame()` treats a terminal target background/fog
frame as both final settled state and active transition bridge state. It applies
only the renderer/fog side, leaves `currentEnvironmentSceneTransitionFrame`
non-null after commit, and does not land the cinematic postprocessing/tint side
with the same terminal frame.

Secondary contributing risk:

The final commit order still lets `applyEnvironment(environment)` depend on
whatever `this.lastEffectivePage` currently is. Normal transitions usually mask
that because transition setup already sets `lastEffectivePage = target`, but the
ordering remains unsafe for interrupted or late reapply paths.

## Fix Boundary

Later implementation should stay app-level and narrow:

- do not edit `projects/*`;
- do not edit launchers;
- do not add page id, page index, page title, page order, or Utah page-pair
  branches;
- do not weaken the Section ISO, working-area focus, MT scalar, or helper
  transition protections.

Recommended fix shape:

1. Add failing source guards before runtime changes:
   - final commit must set the final target page before full environment apply
     or call a target-page-aware environment apply path;
   - final background/fog landing must not leave
     `currentEnvironmentSceneTransitionFrame` non-null after commit;
   - final background/fog landing must also land fog-driven cinematic
     postprocessing/tint through the same resolved target scene;
   - interrupted/cancelled navigation must not let stale target environment
     state finalize after a newer target has won.
2. Runtime change:
   - make final commit target-page-aware before full `applyEnvironment()`;
   - keep active-transition frame state active only during a transition;
   - after final target landing, clear the transition bridge frame or keep it in
     a separate non-transition terminal state that `updateCinematicPostFrame()`
     does not consume as active blend input;
   - apply target cinematic post/tint with the same terminal target scene.

## Verification To Run After Fix

Static/source:

- `node tests/tools/environment-scene-transition-source.test.mjs`
- `node tests/tools/transition-interrupt-finalize-source.test.mjs`
- `node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"`

Protected batch:

- `node tests/tools/transition-entity-opacity-executor.test.mjs`
- `node tests/tools/transition-execution-plan.test.mjs`
- `node tests/tools/scalar-tween-eligibility-source.test.mjs`
- `node tests/tools/discrete-field-declaration-source.test.mjs`
- `node tests/tools/preview-environment-visibility-source.test.mjs`
- `node tests/tools/local-atmosphere-volume-source.test.mjs`

Workspace/build:

- `npm run check:workspace`
- `npm run check:visual-qa-clean`
- `npm run build`
- `git diff --check`

Human/browser:

- `1 -> 16`: target lands dark and stays dark after transition stops.
- `16 -> 1`: target lands light and stays light after transition stops.
- rapid `1 -> 16 -> 20` and `16 -> 1 -> 16`: no older page dark/light state
  lands after the current target transition completes.

Visual status remains `ready for visual check` until the running browser or
human inspection confirms those cases.
