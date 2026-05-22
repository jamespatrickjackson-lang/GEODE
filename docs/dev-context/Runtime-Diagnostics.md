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
