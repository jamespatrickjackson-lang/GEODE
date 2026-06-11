# Page Transitions and Section-Frame Helper Visuals

Status: directives doc. Canonical for the page-transition / section-frame helper
contract. Cross-referenced from `CLAUDE.md` Source Of Truth,
`docs/dev-context/Active-Build-Context.md`,
`docs/dev-context/UI-Visual-Standards.md`,
`docs/dev-context/Runtime-Diagnostics.md`, and `docs/03-decisions.md` (DEC-071,
DEC-076, DEC-097, DEC-098).

## Read this before

This file is the contract for the global page-transition runtime and the
section-frame helper visuals (ISO bands, ISO lines, ground trace, dashed
intersection traces, push/pull cone handles, scale axes and their labels, frame
outline / crop box).

Open this file before touching any of:

- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/transitions/transitionStyles.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/section/sceneSectionController.ts` â€” especially
  `rebuildSceneSectionHelpers`, `applySceneSectionPlanes`, and
  `applySceneSectionHelperTransitionOpacity`
- `src/scene/isoOverlays/sectionIsoOverlay.ts`
- `src/scene/isoOverlays/volumeCutIsoOverlays.ts`

Skipping this routing has produced the regressions enumerated in **Known
regressions** below. The runtime fixes are sequenced; the rules here are
durable.

## Page-agnostic scope rule

Pages are disposable content fixtures. Page numbers, page IDs, titles, matrix
case IDs, and visible navigation paths are reproduction evidence only. Transition
runtime fixes must target reusable state ownership, layer classification,
opacity composition, helper stability, camera policy, editor/save gating, or
validation rules.

Do not implement fixture-id, fixture-index, fixture-title, or source/target
fixture-path conditionals in
transition code. If a reproduction path fails, file the issue against the
global transition family that failed:

- already-visible product ownership;
- Section ISO bands and isolines;
- scene-section helpers and reference layers;
- MT volume / threshold boundary handoffs;
- surfaces, seismic products, point clouds, overlays, legends, labels, assays;
- camera path and end-of-transition commit timing.

## Transition kind registry

`LayerTransitionKind` is a closed union declared at
[transitionStyles.ts:104-108](../../src/scene/transitions/transitionStyles.ts#L104-L108):

| Kind | Meaning |
| --- | --- |
| `continuous` | Source and target layers share enough state that scalar / numeric fields can be interpolated frame-by-frame. Default for compatible scalar-style tweens. |
| `discrete-crossfade` | Source and target represent discrete states that cannot be numerically interpolated. The outgoing helper snapshot and incoming helper fade are crossfaded by opacity. Section-frame style changes route here when frame identity / orientation / enable state differ. |
| `full-density-scalar` | Full-density scalar layer tween that runs the scalar-source opacity pipeline, not the layer-opacity pipeline. |
| `none` | No transition. The target state is applied at the navigation moment. |

There is **no formal `slide` kind**. What authors call a "slide" transition is
an opacity tween realised through a `LayerTransitionSnapshot`
([transitionStyles.ts:77-81](../../src/scene/transitions/transitionStyles.ts#L77-L81)).
Adding a `slide` kind requires a new decision-log entry, not an ad-hoc string.

Background/fog scene channels are not `LayerTransitionKind` values. Renderer
background color, scene fog color, scene fog density, topo fog uniforms, layer
fog density, and fog-driven post tint use the environment-scene transition
owner accepted in TRD-009. Do not add background/fog to the layer enum or route
them through layer opacity/snapshot classification.

`MT Resistivity Cells` All Valid Cells / Log10 Resistivity Window clicks are
local legend view transitions, not page-transition kinds. They use a 1.5s live
scalar-style interpolation in `src/ui/ResistivityLegend.tsx`, persist only
`scalarLegendVisible` and `scalarInclusionMode`, and must not mutate
`LayerTransitionKind`, `SCALAR_TRANSITION_STYLE_FIELDS`,
`scalarInclusionFilterActive`, or the `full-density-scalar` page-transition
path. Local mode animations are scoped to the effective page context; when
navigation changes that context, stale RAF ticks must be canceled or ignored
before they can apply an old page's style. Initial Log10 Resistivity Window page
loads from Global Settings/page 00 are a separate preview-environment resolution
concern: `previewEnvironmentBase` must preserve the full-density authored scalar
window and isoline fields through the Utah FORGE preview field map. Do not
repair that load path by changing transition internals or by editing page
fixtures.

MT Resistivity Cells Log10 Resistivity Window pages require transition-time
scalar tween ownership for their isoline overlays. The full-density
MT inversion cell-center layer must register a `full-density-scalar` tween
whenever authored Log10 Resistivity Window fields differ, even if scalar
edge geometry is not ready at transition setup; async reapply and tween ticks
then apply the interpolated scalar style on the page-transition clock. The
post-commit graph check is observational only and must not replay final page
visibility/styles, because that makes isolines pop in after the transition.
The legend header must reflect the target authored mode; use interpolated scalar
style only for ramp/handle visuals during the transition. Do not repair missing
MT Resistivity Cells Log10 Resistivity Window lines by editing page fixtures or
by changing `SCALAR_TRANSITION_STYLE_FIELDS`, `scalarInclusionFilterActive`, or
resistivity isoline overlay generation.

After a transition has settled, suppressed target-page reapply may still need to
build an isoline overlay for an already-loaded Log10 Resistivity Window page. That
settled repair is limited to reapplying the effective style for
`utah-forge-mt-resistivity-full-density` only, and it must skip when a scalar
tween is active. Do not use full visibility/style replay as this safety net.

Scene section masks are transition-scene channels, not `LayerTransitionKind`
values. Per TRD-010, compatible same-frame section changes interpolate numeric
section style values, while incompatible section frame, target, or enable-state
changes use a dual-mask alpha fade:
`lerp(sourceMaskAlpha, targetMaskAlpha, easedProgress)`. The section mask path
uses the target page `transition.duration` and `transition.easing`; it must not
add `section-mask` or any other section-specific layer kind.

Layer classification compares resolved source and target presentation state in
[transitionEffectiveLayersForPage.ts:160-166](../../src/scene/transitions/transitionEffectiveLayersForPage.ts#L160-L166)
and is gated by `transitionEnvelopeAllowsLayer()` at
[layerTweenRuntime.ts:24-32](../../src/scene/transitions/layerTweenRuntime.ts#L24-L32).
A "missing slide" is almost always one of: layer outside the envelope, no
snapshot pair produced, or classification resolving to `none`.

## ISO opacity composition contract

Section ISO line and band materials never overwrite opacity. Effective opacity
is **composed**:

```text
composed = authored Ã— transition Ã— threshold-surface attenuation
```

- `authored` â€” the value set by the editor / project JSON.
- `transition` â€” the page/layer fade contribution during a tween.
- `threshold-surface attenuation` â€” `0.8^surfaceCount` with short-frame
  smoothing so camera motion does not flicker the result.

Codified by DEC-071 in [docs/03-decisions.md](../03-decisions.md). Runtime
exposes the components on overlay material `userData` for inspection â€” see
[Runtime-Diagnostics.md](Runtime-Diagnostics.md) for the field names.

Section ISO / MT / seismic cut identities include the section frame id so
multiple same-orientation frames cannot overwrite each other through the
transition pipeline.

Section ISO roots have their own derived-entity lifecycle. Page transitions
snapshot current roots, build target roots once, and crossfade root opacity on
the page transition clock. Target roots created by delayed height sampling must
start at the current Section ISO transition opacity, not full opacity.

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
   final authored opacity â€” that is the source of the visible flicker.
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
   - Section ISO source/target roots crossfade when the target page has active
      section state and Section ISO enters or changes geometry/identity. The
      transition does not rebuild contour geometry every frame.
   - Source helper snapshots are allowed only for active-to-active section
      helper changes. When the target page has section helpers inactive, source
      frame outlines, cones, ground traces, and scale helpers must not carry
      into the target transition.
   - Active-to-inactive and active-to-unrelated transitions must not carry source
      section masks, helpers, frame controls, ground traces, or Section ISO roots.
      They apply the inactive target section state at transition start and discard
      transition-owned Section ISO roots instead of promoting them.
   - For active-to-active incompatible helper changes, the outgoing snapshot
     fades out while the live target helper group fades in. This is a true
     crossfade, not two fully opaque helper sets.
   - Section-frame outlines and push/pull control cones are studio overlay
     controls. They stay in the transparent render queue with depth testing
     disabled and use the top scene-section control render order so terrain,
     topo, satellite, Section ISO, and transparent data products cannot cover
     them.
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
   changed â€” the cone material's shading state has been rebuilt. The fix is
   material-instance stability, not geometry replacement.

Runtime transition frames route `tickLayerTweens()` through the section
transition-frame path so only material/shader uniforms and helper opacity move
per frame. Helper rebuilds stay gated to tween start / tween end.

## Topo / graticule sectioning default (DEC-097)

Scene section planes and section-frame crops apply to targeted topo context by
default. The terrain/topomap surface, satellite/orthophoto imagery sampled by
the terrain shader, terrain-composited overlays, longitude/latitude graticule
lines/ribbons/labels, topo labels/legends, and topo branding all flow through
the section-clipping path when the active target scope includes them.

Existing target-scope behavior remains. `all-visible` clips all visible content.
`selected-targets` clips only selected layers/products, but topo objects and
materials no longer have a special bypass once targeted.

`EditableStyle.topoSectionable` is deprecated compatibility state from DEC-077
and is now a no-op for the default clipping contract. Older project JSON may
still carry the field, but the editor no longer presents an opt-in checkbox.
Public surface clip composition remains intact: public crop still applies to the
topo surface and graticule materials, and scene section planes/frames layer on
top of that crop.

## Frame compatibility: continuous interpolation vs crossfade

Per DEC-071:

- **Compatible** section-frame transitions interpolate numeric frame geometry
  by stable frame id: plane position, crop bounds, scale interval, label /
  heading sizing and padding, and ground trace width.
- **Incompatible** section-frame transitions crossfade helpers only when both
  source and target pages have active section helpers. Frame identity,
  orientation, enable state, flip state, target layer/product state, and added /
  removed frame ids are discrete for helper geometry. Sectioned render content
  still fades through the TRD-010 dual-mask alpha path.
- `sceneSectionObjectVisibilityByAxis` and
  `sceneSectionObjectVisibilityByFrameId` outside-opacity maps are continuous
  opacity channels. Adding, removing, or changing one of these values must fade
  to the target opacity on the page transition clock.

`transitionEffectiveLayersForPage.ts` is the classifier. The crossfade path
fades **between two pre-built helper snapshots** â€” not between a snapshot and
a per-frame rebuild. The same stability contract applies on both branches.

## Verification recipe

Before claiming a transition fix:

1. **Visual**: Use one or more reproduction fixtures that exercise the affected
   global transition family. Look for: no ISO band flicker, no cone flattening,
   no ground-trace pulse, no dashed intersection-trace stutter, no abrupt
   brightness change at tween end. Do not treat the fixture as the fix target.
2. **Runtime diagnostic**: `SceneManager.getTransitionDebugState()` reports
   tween counts and snapshot counts. ISO line / band materials expose authored
   base opacity, transition opacity, threshold-surface attenuation, composed
   opacity, and threshold occlusion count via `userData`. See
   [Runtime-Diagnostics.md](Runtime-Diagnostics.md).
3. **Smoke test**: a transition with `transition.kind = none` should produce
   zero helper rebuilds during the instant transition.
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
| ISO overlay swaps abruptly between source and target resolved states | composition path | DEC-071 composition violated; an overlay write went through `material.opacity` directly instead of the `authored Ã— transition Ã— attenuation` path. |

## Cross-reference index

- `docs/dev-context/Page-Transition-Orchestration-Audit-2026-05-30.md` -
  companion audit mapping page-transition clocks, state owners, divergence
  paths, and the recommended repair order before transition smoothing work.
- `docs/03-decisions.md`:
  - DEC-053 through DEC-075 â€” section-frame policy, ISO band geometry, scale
    axes, ground trace, intersection traces, MT / seismic cut composition.
  - DEC-071 â€” grid and section ISO transition composition. **Load-bearing
    sibling to this doc.**
  - DEC-076 â€” names this doc as canonical; codifies the helper-stability
    contract above.
  - DEC-097 â€” targeted topo context participates in scene-section clipping by
    default.
  - DEC-098 â€” section masks and section studio controls transition as scene
    overlay channels.
- `docs/dev-context/UI-Visual-Standards.md` â€” "Section Frame Scale Axes" and
  "Scene Overlay And Transition Rendering" sections carry the visual rules
  themselves (numeric ranges, defaults).
- `docs/dev-context/Active-Build-Context.md` lines 60â€“92 â€” transition product
  awareness and rendering contract for the active build mode.
- `docs/dev-context/Runtime-Diagnostics.md` "Transition Diagnostics" â€” fields
  the runtime exposes for inspection during transition regressions.
- `docs/schemas/page.json.md` lines 119â€“132 â€” page schema for
  `transition.duration` and `transition.easing`.

## Glossary

- **Helper**: any on-canvas visual attached to a section frame that is not
  layer data itself â€” ISO bands, ISO lines, ground trace, dashed
  frame-intersection traces, push/pull cone handles, scale-axis tick lines,
  axis labels, axis headings, frame outline / crop box.
- **Helper rebuild**: `rebuildSceneSectionHelpers()`. Disposes existing helper
  meshes and rebuilds them from the current style.
- **Tween tick**: a single frame of an active page-transition runtime,
  executed inside `tickLayerTweens()` in `layerTweenRuntime.ts`.
- **Compatible frame transition**: source and target frame style permit
  numeric interpolation by stable frame id.
- **Incompatible frame transition**: source and target frame style require
  helper-snapshot crossfade because identity / orientation / enable state
  differs.
- **Section ISO**: late readability overlay drawn on the section plane;
  authored opacity composes through transition opacity and threshold-surface
  attenuation, never overwritten. Root lifecycle follows TRD-011 and TRD-012:
  target-active transitions crossfade source/target roots, while inactive or
  unrelated target pages discard transition roots at transition start.

## Transition Runtime Operating Spec

Before transition runtime, editor/save transition gating, scene-section, Section ISO, working-area focus, opacity, or page-navigation work, read:

docs/dev-context/Transition-Runtime-Operating-Spec.md

This spec is the active operating contract for current transition work. Older audits and matrix logs are evidence only.
