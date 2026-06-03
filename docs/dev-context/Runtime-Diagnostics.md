# Runtime Diagnostics

## Purpose

Dev-only runtime diagnostics expose a read-only snapshot of current GeoVox scene, layer, and renderer resource state.

They are intended to support structural/load-policy review before runtime bloat cleanup. They do not change runtime behavior, layer loading, visibility, renderer settings, materials, cameras, scalar ranges, color ramps, seismic products, MT products, computed artifacts, prep scripts, project manifests, pages, or data artifacts.

## What The Diagnostics Report

The dev hook attempts to report:

- timestamp
- project slug/name
- total scene object count
- visible scene object count
- geometry/material/texture counts
- approximate triangle count
- approximate point count
- `renderer.info.memory`
- `renderer.info.render`
- registered layer IDs
- loaded layer IDs
- visible layer IDs
- hidden layer IDs
- per-layer object counts
- per-layer visible-object counts
- notes for unavailable or best-effort fields

Fields that are unavailable remain `null`, empty, or noted rather than forcing runtime changes.

## Transition Diagnostics

For the contract these diagnostics protect, see
`docs/dev-context/Page-Transitions-And-Section-Frames.md`. The directives doc
states the helper-stability rules; the fields below are the inspection surface
that proves the rules held during a tween.

`SceneManager.getTransitionDebugState()` is available through the page
controller debug state during browser tests. It reports whether a transition is
active, source/target page ids, transition reason, active data-transition count,
snapshot count, scalar tween count, and layer tween count.

For MT/seismic transition regressions, inspect product-level scene state in
addition to this layer-level diagnostic. A layer can be visible while a product
inside it is intentionally hidden. The important invariant is that product-owned
shader opacity, for example MT scalar-volume `uOpacity` after
`sectionIsoSourceOpacity`, is not overwritten by the layer fade.

For Section ISO transition regressions, inspect overlay material `userData`
fields as well as layer visibility. ISO line and band materials expose
authored base opacity, transition opacity, threshold-surface attenuation,
composed opacity, and threshold occlusion count so tests can prove the final
opacity came through the single composed path.

For graticule/grid regressions, focused tests should inspect the line material
depth flags and terrain underside-grid camera state. Topo graticule line
materials report depth-test/depth-write settings, role, and opacity. Terrain
underside grids report camera-side visibility, hidden reason, camera offset
from sampled terrain, and hysteresis thresholds when the helper exists.

For local atmosphere/cloud regressions, inspect the layer group's
`userData.localAtmosphereDebug`. It should report `textureSource:
generated-canvas`, cache key `local-atmosphere:<layerId>:<seed>:<softness>`,
resolved bounds, puff count, `THREE.SpriteMaterial`, `THREE.Sprite` geometry,
depth flags, render order, drift state, and whether a single-puff fixture is
active. This is structural/render-stack evidence only; visual acceptance still
requires a browser screenshot or human review.

## How To Call It

In a Vite dev session, open the browser console and run:

```js
window.__GEOVOX_DIAGNOSTICS__.getSnapshot()
```

To log and return a snapshot:

```js
window.__GEOVOX_DIAGNOSTICS__.logSnapshot()
```

To inspect the last captured snapshot without collecting a new one:

```js
window.__GEOVOX_DIAGNOSTICS__.getLastSnapshot()
```

## What It Does Not Do

- It does not mutate the scene.
- It does not change visibility.
- It does not trigger loading.
- It does not dispose anything.
- It does not alter the render loop.
- It does not change render output.
- It does not validate technical accuracy.
- It does not mark any artifact, wrapper, render result, or inference accepted.
- It does not prove transition correctness without a source/target page test.

## Warnings

Runtime diagnostics are structural/resource evidence. They do not replace render-quality checks, screenshot review, source/provenance review, computed-artifact verification, or human acceptance.

The diagnostics do not authorize lazy loading, disposal changes, visibility changes, seismic defaults, MT settings, scalar ranges, color ramps, material/depth changes, camera/page changes, or artifact simplification.

## Intended Use Before Runtime Cleanup

Use diagnostics to compare what is loaded, visible, hidden, and resource-heavy before proposing runtime loading changes. Pair diagnostics with:

- `docs/dev-context/Runtime-Loading-Policy.md`
- `docs/dev-context/Render-Quality-Checks.md`
- regenerated `test-results/project-artifact-coverage/project-artifact-coverage.md`
- focused screenshot/render receipts
- human review

## Captured Utah FORGE Demo Page Snapshot

Observed: historical dev-only diagnostics snapshots were purged from active context and removed from reachable Git history. Capture fresh diagnostics for current decisions.

The snapshot reports `utah-forge-mt-resistivity-slices` and `utah-forge-phase3-seismic-browser` visible together. It is structural/runtime evidence only and does not accept render quality, technical accuracy, product choice, page scope, or runtime loading behavior.
