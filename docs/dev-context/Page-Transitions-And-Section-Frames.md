# Page Transitions and Section-Frame Helper Visuals

Status: directives doc. Canonical for the page-transition / section-frame helper
contract. Cross-referenced from `CLAUDE.md` Source Of Truth,
`docs/dev-context/Active-Build-Context.md`,
`docs/dev-context/UI-Visual-Standards.md`,
`docs/dev-context/Runtime-Diagnostics.md`, and `docs/03-decisions.md` (DEC-071,
DEC-076).

## Read this before

This file is the contract for page-to-page transitions and the section-frame
helper visuals (ISO bands, ISO lines, ground trace, dashed intersection traces,
push/pull cone handles, scale axes and their labels, frame outline / crop box).

Open this file before touching any of:

- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/transitions/transitionStyles.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/section/sceneSectionController.ts` — especially
  `rebuildSceneSectionHelpers`, `applySceneSectionPlanes`, and
  `applySceneSectionHelperTransitionOpacity`
- `src/scene/isoOverlays/sectionIsoOverlay.ts`
- `src/scene/isoOverlays/volumeCutIsoOverlays.ts`

Skipping this routing has produced the regressions enumerated in **Known
regressions** below. The runtime fixes are sequenced; the rules here are
durable.

## Transition kind registry

`LayerTransitionKind` is a closed union declared at
[transitionStyles.ts:104-108](../../src/scene/transitions/transitionStyles.ts#L104-L108):

| Kind | Meaning |
| --- | --- |
| `continuous` | Source and target layers share enough state that scalar / numeric fields can be interpolated frame-by-frame. Default for compatible scalar-style tweens. |
| `discrete-crossfade` | Source and target represent discrete states that cannot be numerically interpolated. The outgoing helper snapshot and incoming helper fade are crossfaded by opacity. Section-frame style changes between page pairs route here when frame identity / orientation / enable state differ. |
| `full-density-scalar` | Full-density scalar layer tween that runs the scalar-source opacity pipeline, not the layer-opacity pipeline. |
| `none` | No transition. The target state is applied at the navigation moment. |

There is **no formal `slide` kind**. What authors call a "slide" transition is
an opacity tween realised through a `LayerTransitionSnapshot`
([transitionStyles.ts:77-81](../../src/scene/transitions/transitionStyles.ts#L77-L81)).
Adding a `slide` kind requires a new decision-log entry, not an ad-hoc string.

Layer classification per page pair happens in
[transitionEffectiveLayersForPage.ts:160-166](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L160-L166)
and is gated by `transitionEnvelopeAllowsLayer()` at
[layerTweenRuntime.ts:24-32](../../src/scene/transitions/layerTweenRuntime.ts#L24-L32).
A "missing slide" is almost always one of: layer outside the envelope, no
snapshot pair produced, or classification resolving to `none`.

## ISO opacity composition contract

Section ISO line and band materials never overwrite opacity. Effective opacity
is **composed**:

```
composed = authored × transition × threshold-surface attenuation
```

- `authored` — the value set by the editor / project JSON.
- `transition` — the page/layer fade contribution during a tween.
- `threshold-surface attenuation` — `0.8^surfaceCount` with short-frame
  smoothing so camera motion does not flicker the result.

Codified by DEC-071 in [docs/03-decisions.md](../03-decisions.md). Runtime
exposes the components on overlay material `userData` for inspection — see
[Runtime-Diagnostics.md](Runtime-Diagnostics.md) for the field names.

Section ISO / MT / seismic cut identities include the section frame id so
multiple same-orientation frames cannot overwrite each other through the
transition pipeline.

## Section-frame helper stability contract

Helpers are the on-canvas visuals attached to a section frame: ISO bands, ISO
lines, ground trace, dashed frame-intersection traces, push/pull cone handles,
scale-axis tick lines, axis labels, axis headings, and the frame outline / crop
box.

The contract:

1. Helper **geometry** must be built at tween start (from the start style) and
   at tween end (from the end style). It must **not** be rebuilt every frame
   during the tween. Mid-tween rebuilds re-instantiate materials, recompute
   lighting state, and read interpolated authored opacity as if it were the
   final authored opacity — that is the source of the visible flicker.
2. Helper **material instances** must remain stable across a tween. This
   applies in particular to:
   - `makeSceneSectionIsoBandMaterial()` `ShaderMaterial` in
     [sectionIsoOverlay.ts:890-1042](../../src/scene/isoOverlays/sectionIsoOverlay.ts#L890-L1042).
   - `makeSceneSectionConeMaterial()` used by the push/pull handles in
     [sceneSectionController.ts:2398-2476](../../src/scene/section/sceneSectionController.ts#L2398-L2476).
   - The ISO line, ground trace, and intersection trace materials adjacent to
     the above.
3. During the tween, only **opacity and uniforms** move:
   - `sceneSectionHelperTransitionOpacity` is the layer-wide multiplier driven
     by the tween progress at
     [layerTweenRuntime.ts:104-110](../../src/scene/transitions/layerTweenRuntime.ts#L104-L110).
   - ISO band material `uOpacity` and per-helper authored opacity move via the
     composition above.
4. The **load-bearing offender today** is
   `rebuildSceneSectionHelpers()` at
   [sceneSectionController.ts:2845-2851](../../src/scene/section/sceneSectionController.ts#L2845-L2851).
   `applySceneSectionPlanes(style)` calls it unconditionally, including from
   inside `tickLayerTweens()`. Treat invocation of
   `rebuildSceneSectionHelpers()` from inside a tween tick as a regression.
5. Push/pull handle geometry is **always cone-shaped**
   ([sceneSectionController.ts:2423-2442](../../src/scene/section/sceneSectionController.ts#L2423-L2442)).
   The `BoxGeometry` at line 2455 is an invisible pick proxy at opacity 0.
   When a handle reads as a flat cube mid-transition, the geometry has not
   changed — the cone material's shading state has been rebuilt. The fix is
   material-instance stability, not geometry replacement.

The next round of runtime work re-routes `tickLayerTweens()` so the per-frame
path animates only opacity and uniforms, and the rebuild is gated to tween
start / tween end. This file is the contract that fix must satisfy.

## Frame compatibility: continuous interpolation vs crossfade

Per DEC-071:

- **Compatible** section-frame transitions interpolate numeric frame geometry
  by stable frame id: plane position, crop bounds, scale interval, label /
  heading sizing and padding, and ground trace width.
- **Incompatible** section-frame transitions crossfade helpers. Frame
  identity, orientation, enable state, flip state, object visibility target
  state, and added / removed frame ids are discrete.

`transitionEffectiveLayersForPage.ts` is the classifier. The crossfade path
fades **between two pre-built helper snapshots** — not between a snapshot and
a per-frame rebuild. The same stability contract applies on both branches.

## Verification recipe

Before claiming a transition fix:

1. **Visual**: Walk a Utah FORGE page pair that exercises section frames. Look
   for: no ISO band flicker, no cone flattening, no ground-trace pulse, no
   dashed intersection-trace stutter, no abrupt brightness change at tween end.
2. **Runtime diagnostic**: `SceneManager.getTransitionDebugState()` reports
   tween counts and snapshot counts. ISO line / band materials expose authored
   base opacity, transition opacity, threshold-surface attenuation, composed
   opacity, and threshold occlusion count via `userData`. See
   [Runtime-Diagnostics.md](Runtime-Diagnostics.md).
3. **Smoke test**: a page pair with `transition.kind = none` should produce
   zero helper rebuilds during the (instant) transition.
4. **Type / workspace**: `npx tsc --noEmit` and `npm run check:workspace`
   clean before commit.

## Known regressions to watch for

| Symptom | Surface | Most likely cause |
| --- | --- | --- |
| ISO bands dim then snap back at tween end | [sceneSectionController.ts:2845-2851](../../src/scene/section/sceneSectionController.ts#L2845-L2851) | `rebuildSceneSectionHelpers()` ran every tween tick; `sceneSectionHelperTransitionOpacity` snapped to 1.0 at done. |
| Top-surface line darkens mid-transition then sharpens | same as above | ISO band material re-instantiated each frame; authored opacity read mid-interpolation; transition opacity stacked on top. |
| Push/pull handle reads as a flat cube during the tween, becomes a cone at the end | [sceneSectionController.ts:2421](../../src/scene/section/sceneSectionController.ts#L2421) | `makeSceneSectionConeMaterial` `ShaderMaterial` was rebuilt; lighting state lost; cone read as flat shaded until the final rebuild. **Not a geometry swap.** |
| Dashed frame-intersection trace flickers / dashes drift | [sceneSectionController.ts:2768-2857](../../src/scene/section/sceneSectionController.ts#L2768-L2857) | Same rebuild cause; dash phase reset per rebuild. |
| Ground trace width pulses across a page transition | rebuild path | Authored width re-applied through the interpolated style each frame; ribbon mesh re-instantiated. |
| Authored "slide" between two pages does nothing | [transitionEffectiveLayersForPage.ts:160-166](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L160-L166), [layerTweenRuntime.ts:24-32](../../src/scene/transitions/layerTweenRuntime.ts#L24-L32) | No formal `slide` kind exists. Diagnose: classification, envelope membership, snapshot pair. Do not add a new kind without a decision entry. |
| ISO overlay swaps abruptly between pages | composition path | DEC-071 composition violated; an overlay write went through `material.opacity` directly instead of the `authored × transition × attenuation` path. |

## Cross-reference index

- `docs/03-decisions.md`:
  - DEC-053 through DEC-075 — section-frame policy, ISO band geometry, scale
    axes, ground trace, intersection traces, MT / seismic cut composition.
  - DEC-071 — grid and section ISO transition composition. **Load-bearing
    sibling to this doc.**
  - DEC-076 — names this doc as canonical; codifies the helper-stability
    contract above.
- `docs/dev-context/UI-Visual-Standards.md` — "Section Frame Scale Axes" and
  "Scene Overlay And Transition Rendering" sections carry the visual rules
  themselves (numeric ranges, defaults).
- `docs/dev-context/Active-Build-Context.md` lines 60–92 — transition product
  awareness and rendering contract for the active build mode.
- `docs/dev-context/Runtime-Diagnostics.md` "Transition Diagnostics" — fields
  the runtime exposes for inspection during transition regressions.
- `docs/schemas/page.json.md` lines 119–132 — page schema for
  `transition.duration` and `transition.easing`.

## Glossary

- **Helper**: any on-canvas visual attached to a section frame that is not
  layer data itself — ISO bands, ISO lines, ground trace, dashed
  frame-intersection traces, push/pull cone handles, scale-axis tick lines,
  axis labels, axis headings, frame outline / crop box.
- **Helper rebuild**: `rebuildSceneSectionHelpers()`. Disposes existing helper
  meshes and rebuilds them from the current style.
- **Tween tick**: a single frame of an active page-to-page transition,
  executed inside `tickLayerTweens()` in `layerTweenRuntime.ts`.
- **Compatible frame transition**: source and target frame style permit
  numeric interpolation by stable frame id.
- **Incompatible frame transition**: source and target frame style require
  helper-snapshot crossfade because identity / orientation / enable state
  differs.
- **Section ISO**: late readability overlay drawn on the section plane;
  authored opacity composes through transition opacity and threshold-surface
  attenuation, never overwritten.
