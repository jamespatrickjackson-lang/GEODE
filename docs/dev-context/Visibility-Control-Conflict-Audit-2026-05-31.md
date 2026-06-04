# Visibility Control Conflict Audit - 2026-05-31

## Scope

Audit target: conflicts between editor controls, legend controls, the global
page-transition runtime, section views, Master/Sub Master inheritance, and
individual page overrides.

Scope rule: pages are disposable reproduction fixtures. Fixes from this audit
must target reusable editor, save, validation, and transition ownership rules.
Do not add fixture-id, fixture-index, fixture-title, or source/target
fixture-path conditionals.

No automated tests are part of this pass. Visual review is the acceptance path.

## Findings

### P1 - Live editor writes use selected page, not landed page

`PagePanel` selects a clicked page immediately, then schedules camera navigation after paint. `EditorContext` treats `selectedPageId` as the currently displayed page when applying page-local style and visibility changes directly to the live scene. During a transition, that can apply target-page style or visibility to the source or in-flight scene before `PageController` finishes.

Primary evidence:

- `src/editor/PagePanel.tsx`: `selectPageImmediately` runs before `goto`.
- `src/editor/EditorContext.tsx`: `setPageLayerOverride`, `clearPageLayerOverride`, `setPageVisibilityOverride`, and `clearPageVisibilityOverride` live-apply when `cur.selectedPageId === pageId`.
- `src/pages/PageController.tsx`: transition start stores target index; transition completion commits that index and reapplies target-page state.

### P1 - Page structural actions can mutate transition indexes

Page hide, reorder, duplicate, delete, add, reset, and Sub Master structure actions remain reachable while a transition is active. `PageController` stores the active target by index. Reordering or deleting during an active transition can make the stored index point at a different page than the transition target.

Primary evidence:

- `src/pages/PageController.tsx`: transition state stores `targetIndexRef`.
- `src/editor/PagePanel.tsx`: page row actions call `movePageBlock`, `setPageField(... hidden ...)`, duplicate, delete, reset, add Sub Master, add Sub Master child, and re-snapshot. Structural actions are transition-locked by the current Page Manager guard.
- `src/editor/EditorContext.tsx`: `MOVE_PAGE_BLOCK` rebuilds `pages` order while preserving Sub Master block constraints.

### P2 - Section controls and legends bypass the same transition boundary

Section views and legends often call `sceneHandle.manager.applyStyle` directly before dispatching page or environment state. These paths can bypass `PageController` transition ownership.

Primary evidence:

- `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`
- `src/editor/layerControls/mt/IsobandControls.tsx`
- `src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx`
- `src/editor/layerControls/workingArea/WorkingAreaFocusContainer.tsx`
- `src/ui/SceneSectionLegend.tsx`
- `src/ui/SectionIsoLegend.tsx`
- `src/ui/SeismicVolumeLegend.tsx`
- `src/ui/MtSurfaceBoundaryLegend.tsx`
- `src/ui/ResistivityLegend.tsx`

### P2 - Sub Master runtime resolution is correct, but adjacent editor reads can bypass it

`resolveEnvironmentForPage` correctly resolves Sub Master and child pages to frozen `envSnapshot`. `PageController` contains a duplicated resolver for runtime transitions. Some adjacent editor and legend reads still use global environment registries or settings directly, which can conflict with Sub Master expectations.

Primary evidence:

- `src/pages/effective.ts`: canonical `resolveEnvironmentForPage`.
- `src/pages/PageController.tsx`: duplicated Sub Master resolver in `resolvePresentationState`.
- `src/editor/LayerPanelGroups.tsx`: scene overlay rows enumerate `state.environment.sceneOverlays`.
- `src/editor/layerControls/overlays/SceneOverlayControls.tsx`: overlay row definition reads `state.environment.sceneOverlays`.
- `src/ui/AssayLegend.tsx`: assay legend visibility resolves by page, but assay settings come from global environment.

### P3 - Page-bound transition threshold is duplicated

The page-bound UI switch threshold exists as `PAGE_BOUND_UI_SWITCH_THRESHOLD` in `PageController`, but other consumers hard-code `0.92`. This is drift-prone.

Primary evidence:

- `src/pages/PageController.tsx`
- `src/ui/SceneLabels.tsx`
- `src/ui/AssayLegend.tsx`
- `src/editor/EditorChrome.tsx`

## Fix Plan

### Phase 1 - Transition-safe live apply gate

Add an editor-level live-apply gate backed by a ref in `EditorContext`. A
bridge inside `PageControllerProvider` will set the gate active while global
page transitions are active. Editor state dispatches still persist normally,
but direct scene mutation is skipped while the gate is active.

Files:

- Modify `src/editor/EditorContext.tsx`
- Modify `src/editor/EditorChrome.tsx`
- Modify `src/pages/PageController.tsx`

Expected behavior:

- Page-local edits can still update editor state while a transition is active.
- Live scene mutation waits for `PageController` to apply the resolved page state.
- Global environment edits also avoid direct scene mutation during active transitions.

### Phase 2 - Page structural action lock

Disable page list structural actions while a transition is active. This protects `PageController` index-based transition state from page list mutation.

Files:

- Modify `src/editor/PagePanel.tsx`

Locked actions:

- Add page
- Add Sub Master
- Add Sub Master child
- Re-snapshot Sub Master
- Duplicate page
- Delete page
- Reorder page
- Hide/show page
- Reset selected page overrides

Selection and navigation remain available so the author can still choose a target page.

### Phase 3 - Section and legend direct-apply guards

Guard direct `sceneHandle.manager.applyStyle` calls in section controls and legends with the same transition-aware behavior. Controls that route through `setEnvLayerStyle`, `setPageLayerOverride`, or page visibility setters inherit the central gate and do not need local direct-apply edits.

Files:

- Confirm `src/editor/LayerPanelGroups.tsx` routes through central setters
- Modify `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`
- Modify `src/editor/layerControls/mt/IsobandControls.tsx`
- Modify `src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx`
- Modify `src/editor/layerControls/workingArea/WorkingAreaFocusContainer.tsx`
- Modify `src/ui/SceneSectionLegend.tsx`
- Modify `src/ui/SectionIsoLegend.tsx`
- Modify `src/ui/SeismicVolumeLegend.tsx`
- Modify `src/ui/MtSurfaceBoundaryLegend.tsx`
- Modify `src/ui/ResistivityLegend.tsx`

### Deferred Follow-Up

After visual review of the root fix, address lower-risk cleanup:

- Move `PAGE_BOUND_UI_SWITCH_THRESHOLD` into a shared module.
- Resolve scene overlay editor rows from the current page environment instead of global environment.
- Resolve assay legend settings from page-resolved environment if assay settings become page or Sub Master scoped.
- Consider replacing duplicated Sub Master resolution in `PageController` with a shared helper.

## Implementation Applied

Implemented in this pass:

- Added an `EditorContext` live-apply gate controlled by `PageControllerProvider` page-transition state.
- Kept editor state dispatches active while suppressing direct scene mutation during global page transitions.
- Added deferred live-scene replay through `PageController` so any suppressed direct apply is reapplied to the landed page after the transition releases without bypassing presentation transforms.
- Locked Page Manager structural actions during active transitions while leaving selection and navigation available.
- Guarded direct section, working-area, seismic, MT boundary, resistivity, and legend style applies with the live-apply gate.
- Confirmed `LayerPanel` and `LayerPanelGroups` route ordinary layer show/hide and style edits through the central editor setters, so they inherit the same gate without local direct-apply edits.

No test, build, or browser verification commands were run. Visual review remains the requested verification path.

## Save and Legend Contract Follow-Up

Additional user-reported save risks were audited after the first visibility-control fix:

- MT threshold boundary edits can store visibility in both the current boundary-by-id model and the older legacy visibility map. The controls now normalize writes into both shapes so existing reads, previews, transitions, and persisted project JSON stay aligned.
- Working-area focus clipping edits were previously persisted as sparse style fragments. The focus controls now write the full canonical focus/clip style patch, including enabled state, mode, bounds, opacity, and label fields.
- Public topo surface clip fields and scene-section fields were added to preview/transition preservation lists so transition preview state does not drop authored clip or section state.
- Floating legends now author against the selected page or environment target instead of only the transition/controller page being rendered. This lets legend controls create the same page overrides as editor controls.
- Section plane legend axis toggles now update the parent `sceneSectionEnabled` state, `sceneSectionMode`, legacy `sceneSectionPlanes`, and matching `sceneSectionFrames` entries. The viewer, editor panel, and page override state now share the same section on/off contract.
- Editor section plane/frame child controls now update the parent section enabled state when child state implies an active section, and disable the parent only when no remaining plane/frame state should keep it active.
- Section ISO legend line, band, target, and numeric controls now update `sectionIsoEnabled` when their visible state implies the overlay is on or off. The editor-side ISO controls already gate child edits behind the parent enabled switch.

Verification for the follow-up:

| Check | Result | Notes |
| --- | --- | --- |
| `git diff --check` | PASS | Only line-ending warnings were emitted. |
| Automated visual/browser tests | Not run | User requested visual review as the acceptance path. |
