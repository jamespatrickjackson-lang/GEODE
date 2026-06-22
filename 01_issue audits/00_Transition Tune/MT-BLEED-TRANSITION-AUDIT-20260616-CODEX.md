# MT Bleed Transition Audit - 2026-06-16 - Codex

## Scope

Audit only. No rollback or runtime fix was applied.

Observed human case:
- `25 -> 20`: a large yellow MT/Section ISO-looking surface appears during transition.
- Settled page `20` is a clipped section view.
- Settled page `25` is a broad full-density MT cell-center view.

## Authored State Check

This is not a simple global toggle left on.

Page mapping from current `projects/utah-forge/project.json`:
- Page 20: `182_page`, title `3d duplicate duplicate duplicate duplicate duplicate`.
- Page 25: `146_page`, title `New page duplicate duplicate duplicate`.

Relevant settled authoring:
- `182_page` explicitly shows:
  - `utah-forge-mt-resistivity-volume`
  - `utah-forge-mt-resistivity-threshold-surfaces`
  - active X scene section
  - full-density MT hidden
- `146_page` explicitly shows:
  - `utah-forge-mt-resistivity-full-density`
  - terrain visible with opacity `0`
  - no page override that should show MT volume or threshold surfaces

Global/default state includes low-opacity full-density MT as a default layer, but page 20 explicitly hides it and page 25's settled screenshot matches the full-density cell view. The large yellow section/band surface is therefore transition composition, not an authored global state that should appear on page 25.

## Runtime Trace Summary

Headless runtime probe against `http://127.0.0.1:42902/?project=utah-forge`:

Settled page 20:
- Current page: `182_page`
- Visible relevant layers:
  - `utah-forge-mt-resistivity-volume`
  - `utah-forge-mt-resistivity-threshold-surfaces`
- Volume has active Section ISO band/line overlays.
- Threshold surfaces visible IDs include:
  - `bank-ge-5461-ohm-m`
  - `conductive-le-30-ohm-m`
  - `resistive-ge-1000-ohm-m`

Settled page 25:
- Current page: `146_page`
- Visible relevant layer:
  - `utah-forge-mt-resistivity-full-density`
- MT volume and threshold surface layers are hidden.

During `25 -> 20`, transition setup reports:
- Source page: `146_page`
- Target page: `182_page`
- Snapshot created for:
  - `utah-forge-mt-resistivity-full-density`
- Layer tweens include:
  - `utah-forge-mt-resistivity-full-density`
  - `utah-forge-mt-resistivity-volume`
  - `utah-forge-mt-resistivity-threshold-surfaces`
- Scene section style tween is active.

This means page 25's full-density point cloud is an outgoing snapshot/fade, while page 20's MT volume and threshold surfaces are live target-enter layers.

## Root-Cause Candidate

The most likely failure family is target-enter ordering for inactive-section to active-section transitions.

For `25 -> 20`:
- Source section state is inactive.
- Target section state is active.
- Target MT volume and threshold surfaces become live target-enter layers during transition setup.
- Section state is applied after layer style/visibility setup, through the scene-section tween path.
- The target Section ISO overlays can therefore exist/render before their target-enter opacity and section mask are safely synchronized.

The evidence matches the screenshot: a target page-20 MT section/ISO visual appears during transition even though settled page 25 does not author that visual.

## Current Dirty Patch Risk

Current dirty files include:
- `src/scene/SceneManager.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/transitionStyles.ts`
- related source tests

The dirty patch did not directly change the protected MT full-density scalar fields:
- `UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID`
- `SCALAR_TRANSITION_STYLE_FIELDS`
- `scalarInclusionFilterActive`
- `scalarFullDensityAllValidMode`

However, it did change adjacent transition ownership:
- Added generic `"scalar-section"` Section ISO root collection.
- Added source working-area snapshot logic for MT threshold surfaces.
- Added tests that assert these paths exist, but not the failing inactive-to-active target-enter behavior.

The generic Section ISO root collector remains a risk for other page-wide bleed because it scans all layers for `scalarSectionIsoOverlayRoot`. That should be constrained by a failing guard before keeping it.

## Test Gap

Current tests do not yet require:
- inactive-section -> active-section MT volume/threshold target enters to start opacity-gated;
- target Section ISO band/line overlays to attach at transition envelope `0` when source had no active section;
- MT threshold/top/contact surfaces to preserve clipping/hidden state consistently as a family;
- full-density MT snapshots to remain separate from Section ISO root ownership.

## Recommended Next Step

Do not rollback broad commits blindly.

Before any runtime fix:
1. Add a failing source guard for inactive-section -> active-section target enter:
   - target MT volume Section ISO roots must attach at transition envelope `0`;
   - target MT volume/threshold enter cannot show full composed opacity before the section frame is active.
2. Add a guard that generic `"scalar-section"` collection excludes full-density point-cloud ownership and only collects approved Section ISO mesh roots.
3. Add a guard that MT threshold/top/contact working-area/section clipping is handled as one family, not threshold-only.
4. Restore/strengthen the failing MT full-density source guard separately; do not use regex brittleness as proof that runtime ownership is safe.

Visual status remains `ready for visual check`.
