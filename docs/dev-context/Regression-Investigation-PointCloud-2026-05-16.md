# Regression Investigation: Utah FORGE Point Cloud View Quality

Date recorded: 2026-05-17  
Regression date under investigation: 2026-05-16  
Status: needs review, no fix implemented

## Current Symptom

The large Utah FORGE point-cloud / full-density MT resistivity dataset is reported to look terrible on screen. This pass verifies state, page overrides, runtime diagnostics, and screenshots without changing rendering behavior.

## Likely Affected Layer

Primary suspect:

- `utah-forge-mt-resistivity-full-density`

Secondary suspects:

- `utah-forge-mt-resistivity-preview`
- `utah-forge-mt-resistivity-volume`
- page-local state around the full-density layer

## Suspected Causes

- Page-local full-density overrides are exposing a poor visual state.
- Active `pageOrder` changed by removing old demo pages and appending intake pages.
- Intake pages are active in `pageOrder` and explicitly hide the full-density layer.
- Loader registry timing or dispatch remains a lower-probability suspect.

## Files Inspected

- `projects/utah-forge/project.json`
- `projects/utah-forge/environment.json`
- `projects/utah-forge/pages/*.json`
- `src/scene/layerLoaders.ts`
- `src/scene/layerLoaderRegistry.ts`
- `src/scene/layerDiagnostics.ts`
- `docs/dev-context/Generated-Reports/runtime-diagnostics-utah-forge*.json`
- recent loader/intake change receipts under `docs/dev-context/Change-Receipts/`

## Page Order Findings

Current `pageOrder`:

1. `02_untitled`
2. `12_untitled`
3. `10_untitled`
4. `06_untitled`
5. `07_untitled`
6. `04_untitled`
7. `05_untitled`
8. `08_untitled`
9. `09_untitled`
10. `11_untitled`
11. `intake_2026-05-16_02-12-44_uxm6dg`
12. `intake_2026-05-16_02-45-23_1kbq3z`

First project page remains `02_untitled`. The default opening page probably did not change, but the active page set did change because the old demo pages are no longer in active `pageOrder` and the two intake pages are now reachable.

Important UI nuance: the default editor opening state has Global Settings selected, so it previews the environment/base style over the first page camera. Selecting Page Manager row `01.` applies the actual page-local `02_untitled` override state.

## Full-Density Page Override Table

| page id | title | in pageOrder? | full-density visible? | opacity | scalar/focus/range overrides | other relevant overrides | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `02_untitled` | Untitled page | yes | true | `0` | focus/blend `-2..4.5` | none | When Page Manager row `01.` is selected, diagnostics show layer visible, but page opacity makes it visually absent. |
| `12_untitled` | Untitled page copy | yes | inherited | inherited | focus/blend `-2..4.5` | none | Broad scalar range. |
| `10_untitled` | Untitled page copy | yes | inherited | inherited | none | none | Uses environment style. |
| `06_untitled` | Untitled page copy | yes | inherited | inherited | focus/blend `1.318..2.266` | noise `0.6`, scalar edge average/line width | Narrow scalar window. |
| `07_untitled` | Utah FORGE copy | yes | inherited | inherited | focus/blend `-2..1.340` | noise `0.36`, edge upper value | Low-range scalar window. |
| `04_untitled` | Untitled page copy | yes | inherited | inherited | focus `2.694..4.5`, blend `3.620..4.5` | scalar edge average/line width | High-range scalar window. |
| `05_untitled` | Untitled page | yes | true | `0.3` | focus/blend `3.056..4.5` | noise `0.65`, edge lower `3.056`, scalar edge average/line width | Captured as filtered scalar candidate bad state. |
| `08_untitled` | Untitled page | yes | true | `0.05` | none | threshold surfaces visible | Captured as faint opacity candidate bad state. |
| `09_untitled` | Untitled page | yes | inherited | inherited | none | none | Captured as candidate good environment-style state. |
| `11_untitled` | Untitled page | yes | true | `0.3` | none | color `#cccccc`, point size `1`, legend visible | Greyscale full-density style. |
| `intake_2026-05-16_02-12-44_uxm6dg` | Intake Review | yes | false | n/a | none | none | Explicitly hides full-density. |
| `intake_2026-05-16_02-45-23_1kbq3z` | Intake Review | yes | false | n/a | none | none | Explicitly hides full-density. |

Inherited visibility means the page does not set a page-local visibility override and therefore inherits the environment default-visible state.

## Runtime Capture

Generated report:

- `docs/dev-context/Generated-Reports/runtime-diagnostics-utah-forge-pointcloud-regression.json`

Screenshots:

- `docs/dev-context/Verification-Receipts/screenshots/utah-forge-pointcloud-default-2026-05-17.png`
- `docs/dev-context/Verification-Receipts/screenshots/utah-forge-pointcloud-page-02-selected-2026-05-17.png`
- `docs/dev-context/Verification-Receipts/screenshots/utah-forge-pointcloud-filtered-page-2026-05-17.png`
- `docs/dev-context/Verification-Receipts/screenshots/utah-forge-pointcloud-bad-page-2026-05-17.png`
- `docs/dev-context/Verification-Receipts/screenshots/utah-forge-pointcloud-candidate-good-page-2026-05-17.png`

Captured states:

| state | expected page id | full-density visible objects | visible scene objects | approximate point count | note |
| --- | --- | ---: | ---: | ---: | --- |
| default opening page | `02_untitled` camera with Global Settings selected | 12 | 92 | 1,186,500 | Environment/base preview; not the page-local opacity `0` state. |
| page 02 selected page-local override state | `02_untitled` | 12 | 95 | 1,186,500 | Page row `01.` selected; full-density is visible by diagnostics but visually absent due opacity `0`. |
| filtered scalar candidate bad page | `05_untitled` | 21 | 101 | 1,186,500 | Narrow high scalar focus, noise threshold, edge lower value. |
| faint opacity candidate bad page | `08_untitled` | 12 | 97 | 1,186,500 | Full-density opacity `0.05`; threshold surfaces also visible. |
| candidate good environment-style page | `09_untitled` | 12 | 92 | 1,186,500 | Uses environment full-density style. |

## Loader Registry Finding

The full-density layer still dispatches through the tiled point-cloud preview handler:

- `layerFiles(spec)` remains `spec.previewFiles ?? spec.files ?? {}`.
- `utah-forge-mt-resistivity-full-density` has `previewFiles.previewTiles`.
- `pointcloud-preview-tiles` matches `spec.type === "pointcloud" && !!layerFiles(spec).previewTiles`.
- `onLoaded` still adds the object and calls `manager.reapplyCurrentPageState()`.
- No full-density-specific handler was moved.

Loader registry dispatch remains a lower-probability cause based on current evidence.

## What Is Known

- The full-density layer is loaded in the captured runtime.
- Diagnostics show `approximatePointCount` remains 1,186,500 across captured states.
- Default editor opening has Global Settings selected and shows the environment/base full-density style over the first page camera.
- Selecting Page Manager row `01.` for `02_untitled` makes the full-density layer effectively invisible with opacity `0`.
- Page `08_untitled` makes the full-density layer very faint with opacity `0.05`.
- Page `05_untitled` applies a narrow high scalar focus/blend range plus noise and edge settings.
- Intake pages are reachable in `pageOrder` and explicitly hide full-density.
- Runtime diagnostics are read-only and did not mutate scene state.

## What Remains Unknown

- Which exact screen/page prompted the human report.
- Whether the human-visible "terrible" view is default invisibility, faint opacity, scalar filtering, threshold co-rendering, or a page-navigation expectation change.
- Whether the removed demo pages were the expected known-good visual route.
- Whether a loader timing issue exists despite unchanged dispatch/count evidence.

## No Fix Implemented

No rendering code, loaders, materials, scalar ranges, project config, page JSON, overlays, data, prep scripts, package files, or computed artifacts were changed in this pass.

## Page-State Fix Attempted

Date: 2026-05-17  
Change receipt: `docs/dev-context/Change-Receipts/CHG-2026-05-17-041-point-cloud-page-state-fix.md`  
Verification receipt: `docs/dev-context/Verification-Receipts/VER-2026-05-17-007-utah-forge-pointcloud-fix-verification.md`

Fix applied:

- `projects/utah-forge/pages/02_untitled.json`
- Changed `layerOverrides.utah-forge-mt-resistivity-full-density.opacity` from `0` to `0.3`.
- `0.3` matches the existing environment-level full-density opacity and avoids inventing a new style.

Verification status:

- JSON parse passed for `project.json` and `02_untitled.json`.
- `npm run build` passed.
- `node tools/validate-artifact-metadata.mjs --project projects/utah-forge` passed.
- `node tools/report-project-artifact-coverage.mjs` passed and refreshed the generated coverage reports.
- Fixed screenshot captured: `docs/dev-context/Verification-Receipts/screenshots/utah-forge-pointcloud-fixed-2026-05-17.png`.
- Fixed runtime diagnostics captured: `docs/dev-context/Generated-Reports/runtime-diagnostics-utah-forge-pointcloud-fix.json`.

Result:

- Page Manager row `01.` / `02_untitled` now shows the full-density point cloud instead of the opacity-0 page-local state.
- Runtime diagnostics still show stable point count: `1,186,500`.
- Full-density remains routed through `pointcloud-preview-tiles`; loader registry remains a lower-probability cause.

Remaining review needs:

- Human review of the fixed `02_untitled` screenshot for visual quality.
- Human decision on whether `08_untitled` opacity `0.05` and threshold co-render is intentional or should receive a separate page-local fix.
- Human decision on whether intake pages should remain in active `pageOrder`.

## Visual Baseline Restore Attempted

Date: 2026-05-17  
Change receipt: `docs/dev-context/Change-Receipts/CHG-2026-05-17-042-utah-forge-visual-baseline-restore.md`  
Verification receipt: `docs/dev-context/Verification-Receipts/VER-2026-05-17-008-utah-forge-visual-baseline-restore.md`

Backups created:

- `docs/dev-context/Backups/visual-baseline-restore-2026-05-17/project.json`
- `docs/dev-context/Backups/visual-baseline-restore-2026-05-17/environment.json`

Fix applied:

- `projects/utah-forge/environment.json`
- Restored top-level `renderPreset: "cinematic-dark"` based on prior Utah FORGE render-preset receipts.
- Restored `terrain` and `transport-roads` to `defaultVisibleLayers` based on the available local baseline copy and the first-page visual context.

Point-cloud page-state status:

- The previous page-state fix remains in place: `02_untitled` full-density opacity is `0.3`, matching the environment full-density opacity.
- No scalar ranges, noise thresholds, point size, material settings, loader code, renderer code, data, prep scripts, or computed artifacts were changed.

Verification status:

- JSON parse passed for `project.json` and `environment.json`.
- `npm run build` passed.
- `node tools/validate-artifact-metadata.mjs --project projects/utah-forge` passed.
- `node tools/report-project-artifact-coverage.mjs` passed and refreshed the generated coverage reports.
- Restored default screenshot captured: `docs/dev-context/Verification-Receipts/screenshots/utah-forge-visual-baseline-restored-default-2026-05-17.png`.
- Restored point-cloud screenshot captured: `docs/dev-context/Verification-Receipts/screenshots/utah-forge-visual-baseline-restored-pointcloud-2026-05-17.png`.
- Runtime diagnostics captured: `docs/dev-context/Generated-Reports/runtime-diagnostics-utah-forge-visual-baseline-restore.json`.

Result:

- Startup no longer presents as a white background in the captured runtime.
- The UI reports the `Cinematic Dark` project preset.
- The full-density layer remains visible with approximately stable point count evidence.
- Loader registry remains a lower-probability cause and was not rolled back.

Remaining review needs:

- Human review of the restored screenshots for whether they match the earlier dark/cinematic baseline closely enough.
- Human decision on whether `08_untitled` is an intentional faint/threshold page or needs a separate bounded page-state pass.
- Human decision on whether intake pages should remain in active `pageOrder` after the visual baseline is accepted.
