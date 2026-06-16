# Y-Axis Section Issue Findings
Unique ID: codex-yaxis-findings-20260613-planmode-8c71f2
Repo audited: C:\GeoSee\Side projects\GeoSee_Dev_VI
Requested report folder: C:\GeoSee\GeoSee_Dev\Y Axis issue

## Findings

1. The tracked offshore page JSONs do not currently contain `Y issue 1`, `Y issue 2`, or any `sceneSection` keys.
   Checked: `projects/offshore-vancouver-island/pages/*.json`.

2. `projects/offshore-vancouver-island/project.json` only showed `reviewStartPageId: "02_world_base"` for page routing during this pass.
   The saved Y issue states are likely in live browser/editor state, unsaved editor memory, or another artifact not present in tracked page JSON.

3. The working tree is already dirty with unrelated source/data edits and untracked paper-cut/topography work.
   Any audit or fix must avoid cleanup/revert and preserve existing work.

4. Primary Y-axis section owners found:
   - `src/scene/section/sceneSectionController.ts`
   - `src/geophysics/seismicSectionGraphBasis.ts`
   - `src/scene.ts`
   - `src/editor/EditorContext.tsx`
   - `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`

5. The likely high-risk path is frame-basis resolution.
   Built-in X/Y/Z frame basis is axis-spec driven, but seismic source face frames can override `normal`, `axisAVector`, and `axisBVector` through `sectionFaceFrameFromGraphBasis`.

6. The drag/authoring path is separate from rendered helper geometry.
   `src/scene.ts` uses resolved normals when available, but has hard-coded fallback vectors for section drag. The audit should verify that rendered basis and edit/drag basis agree.

7. Helper frame geometry is built in `rebuildSceneSectionHelpers`.
   It creates outline geometry, cone handles, scale axes, labels, and ground traces from resolved `tangentA`, `tangentB`, and `basisNormal`.

8. No focused tests currently cover scene-section frame basis, Y/Z non-coplanarity, helper geometry, or source seismic face-frame math.
   Existing offshore tests found were unrelated paper-cut relief tests.

9. Existing dev hooks can support first-pass browser evidence without adding an overlay:
   - `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle()`
   - `window.__pageController`

10. Transition code should be held until static Y-frame geometry is proven.
    Relevant transition owners found:
    - `src/scene/transitions/transitionStyles.ts`
    - `src/scene/transitions/layerTweenRuntime.ts`
    - `src/scene/transitions/transitionEffectiveLayersForPage.ts`

## Recommended Next Audit Step

Run the app, recover the live `Y issue 1` and `Y issue 2` states from browser/editor state, and dump numeric frame data for X/Y/Z:
`normal`, `axisAVector`, `axisBVector`, `center`, signed distance, min/max A/B, helper transform/quaternion, outline vertices, cone transforms, and shader frame uniforms.

Do not purge section data or fix transitions until that numeric basis evidence proves where Y becomes coplanar or visually rotated wrong.
