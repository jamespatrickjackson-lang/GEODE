# v1 Straw Subject — GeoSee Editor Sidebar

## 1. Why a straw subject

A v1 workbench built against synthetic toy panels would silently absorb assumptions that break on the first real integration. The straw subject is a realistic reference target: GeoSee's editor sidebar as it exists at v1 start. The workbench reconstructs it as a sample GUI Package and uses it as the smoke-test target for every phase.

The straw subject is **structural**: the package captures panel hierarchy, container archetypes, component types, default layouts, default tokens. It is **not** behavioural: no React, no reducers, no event wiring.

## 2. What is in the bundled package

Package location: `UI_EDITOR/packages/geosee_editor_sidebar/`.

Frames (one per major panel):

| Frame id | Source panel in GeoSee | Frame size (default) |
| --- | --- | --- |
| `frame-page-manager` | `src/editor/PagePanel.tsx` page list + footer actions + Global Settings row | 320×900 |
| `frame-environment-panel` | `src/editor/EnvironmentScenePanel.tsx` "Environment" view | 320×900 |
| `frame-lighting-studio` | `src/editor/EnvironmentScenePanel.tsx` "Lighting Studio" view | 320×900 |
| `frame-camera-studio` | `src/editor/EnvironmentScenePanel.tsx` `CameraSetupPanel` (incl. DEC-080 Focus transition) | 320×900 |
| `frame-layer-panel-archetype-mt` | `src/editor/LayerPanel.tsx` + MT layer subcontrols | 320×900 |
| `frame-layer-panel-archetype-seismic` | `src/editor/LayerPanel.tsx` + seismic layer subcontrols | 320×900 |
| `frame-layer-panel-archetype-topo` | `src/editor/LayerPanel.tsx` + topo layer subcontrols (incl. DEC-081 Utah preset) | 320×900 |
| `frame-layer-panel-archetype-drillhole` | drillhole layer subcontrols | 320×900 |
| `frame-layer-panel-archetype-geology` | geology layer subcontrols | 320×900 |
| `frame-layer-panel-archetype-working-area` | working-area layer subcontrols | 320×900 |
| `frame-layer-panel-archetype-layout` | layout layer subcontrols | 320×900 |
| `frame-site-details` | `src/editor/SiteDetailsPanel.tsx` | 320×600 |
| `frame-scene-section-frame-container` | scene-section frame container (per-axis) | 320×400 |
| `frame-topo-map-tool-container` | `src/editor/topoMap/TopoMapPanel.tsx` (representative subset) | 320×900 |
| `frame-seismic-tool-container` | seismic tool container | 320×900 |
| `frame-working-area-tool-container` | working-area tool container | 320×600 |

All Frames share a Canvas-space layout that places them in a grid (4 wide × N tall) so the author can survey the full sidebar at a glance and zoom into any single Frame.

## 3. What the package does **not** capture

- Per-field detail on every layer (e.g. every individual slider on the MT panel). Capture the archetypes (slider, numeric input, select dropdown, etc.) and a representative subset of the fields. Exhaustive field-by-field reconstruction is a v2 task once the schema and validation are proven.
- The 3D viewport, page-tween machinery, camera focus runtime (DEC-080 picking/focus camera), Sub Master reducer (DEC-079 ADD_SUB_MASTER / RE_SNAPSHOT / cascade delete), Utah topo material runtime (DEC-081 shader patches).
- The frosted-glass material, drop shadows, exact pixel rendering. Tokens captured for spacing / radii / colours; pixel-perfect material fidelity not required.
- Persistence behaviour (`commitPending`, dirty tracking).
- Effective-style resolver (`effective.ts`) or any inheritance logic.
- Editor reducer logic (`EditorContext.tsx`).

## 4. Component / Container archetypes the straw subject exercises

By reconstructing the sidebar, the workbench schema must express at least these archetypes. Each is encoded as a Library entry (see [05_libraries.md](05_libraries.md) §5).

### Component archetypes

| Archetype id | Description | Source pattern in GeoSee |
| --- | --- | --- |
| `pill-button` | Rounded full-radius button. | Page-row colour-picker chip. |
| `icon-button` | Small square icon-only button. | Page-row triangles, eye, `+`, `↻`. |
| `footer-action-button` | Larger icon button row. | Page list footer Add/Duplicate/Reset/Delete. |
| `inline-editable-text` | Text that becomes an editable input on click. | Page title (`InlineEditableTitle`). |
| `dirty-dot` | Small filled circle indicating unsaved state. | Page row dirty dot. |
| `letter-glyph` | Single-character text indicator. | `F` cue for `cameraObjectFocus`. |
| `numeric-label` | Padded numeric display with role-aware formatting. | Page-row "XX." / "XX.M.NN" labels. |
| `colour-swatch` | A small colour circle that opens a native `<input type="color">`. | Page-row colour picker. |
| `slider` | Range input with label and value readout. | Many layer subcontrols. |
| `numeric-input` | Plain numeric input field. | Many layer subcontrols. |
| `select-dropdown` | Native select. | Layer / mode / preset choosers. |
| `checkbox` | Boolean toggle (native checkbox style). | Visibility / enabled flags. |
| `native-details` | Uncontrolled HTML `<details>` disclosure. | `Appearance` / `Labels` / `Provenance` row inside LayerPanel. |
| `aria-expanded-row` | Controlled disclosure via `aria-expanded`. | `GuiSubsection` pattern in EnvironmentScenePanel. |

### Container archetypes

| Archetype id | Description | Source pattern in GeoSee |
| --- | --- | --- |
| `page-list-row` | Standard page row chrome. | Global child page row. |
| `page-list-row-sub-master` | Page row with 4 px left border in group hue. | Sub Master row (DEC-079). |
| `page-list-row-sub-master-child` | Page row indented 12 px, shares group hue. | Sub Master child row (DEC-079). |
| `pseudo-page-bar` | The Global Settings bar shape (dark glass). | Global Settings row. |
| `layer-card` | The card around a layer's controls. | Each layer in LayerPanel. |
| `layer-subsection` | Subgrouping inside a layer card. | Appearance / Labels / Provenance disclosure bodies. |
| `scene-section-frame-container` | Per-axis section frame controls. | DEC-053 / DEC-070 / DEC-078 frame container. |
| `camera-studio-subcontainer` | Subgrouping inside Camera Studio. | Focus transition, Perspective, Vignette, Image finish, Glow. |
| `footer-action-row` | Bottom action row beneath a panel. | Page list footer. |
| `cinematic-render-preset` | The Cinematic Render Preset container. | Moved into Camera Studio per DEC-080. |

## 5. Tokens captured

See [05_libraries.md](05_libraries.md) §5.4 for the full list. Source values come from `src/editor/styles.ts` in GeoSee at v1 start. Captured by value (no live linkage).

## 6. Restricted Surfaces (no-touch from v0.1 Boundary Charter)

The straw-subject package marks the following Container / Component properties as `locked: true` so the workbench Resize / Move / Properties Inspector refuse to mutate them. v1 Validation flags any attempt with a Blocker finding.

| Property | Why locked |
| --- | --- |
| Component `archetype` | Changing a component's archetype (e.g. button → slider) is a destructive structural change. |
| Container `archetype` | Same reason. |
| Schema-marked `permanent` fields (e.g. a delete button's existence) | Listed in the v0.1 Boundary Charter (renderer, data pipeline, permissions, destructive logic, state, auth). v1 cannot remove these. |
| `id` of any element | Renaming is a Change Log event; v1 does not support it. |
| `parentMasterId` semantics (DEC-079) | The workbench captures the *visual* Sub Master row chrome but does not model the reducer behaviour. |
| `cameraObjectFocus` engagement (DEC-080) | The straw subject captures the `F` cue glyph but not the runtime. |

## 7. How the package is created

v1 does **not** auto-import GeoSee source. The straw-subject package is hand-assembled by an agent / author during build phase 7 of [10_build_phases.md](10_build_phases.md), following these steps:

1. Open GeoSee (`cd .. && npm run dev`) and screenshot each panel listed in §2 above.
2. For each panel:
   1. Create a Frame in the workbench at the recommended size.
   2. Use the Container Tool to draw the panel's outer container.
   3. Use the Component Library to drag in archetype instances for each row / control.
   4. Label and position each element to match GeoSee's layout.
   5. Set Constraints to mirror GeoSee's responsive behaviour.
   6. Save the Frame.
3. Run validation; resolve or acknowledge findings.
4. Export the package; verify round-trip.

The first hand-assembly is a one-time bring-up cost. After v1 ships, the workbench is the source of truth for the package; if GeoSee's editor changes, the package is updated in the workbench (re-screenshot, re-edit), not re-imported.

## 8. Forward-compatibility hooks for v2

The straw subject is the v1 vehicle for proving the Host-App Adapter shape. v1 ensures the package shape carries enough information for v2 to build the GeoSee adapter:

- Every Component / Container has a `hostRef?: string` field reserved for future use. v1 leaves it unset. v2's GeoSee adapter populates it (e.g. `hostRef: "PagePanel.PageRow"`).
- Every Frame has a `hostSurface?: string` field reserved for future use. v1 leaves it unset. v2 populates it (e.g. `hostSurface: "src/editor/PagePanel.tsx"`).
- The Restricted-Surface marker scheme is implemented in v1; v2's adapter consumes it as the embedded-mode lockout list.

## 9. Acceptance criteria for the straw-subject package

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Package folder exists | `UI_EDITOR/packages/geosee_editor_sidebar/` present with all files from [07_package_format.md](07_package_format.md) §2. |
| 2 | All Frames present | `frames.json` contains ≥16 Frames matching §2 above. |
| 3 | Library archetypes present | Component Library contains ≥14 archetypes from §4. Container Library contains ≥10. |
| 4 | Tokens present | Token Library matches [05_libraries.md](05_libraries.md) §5.4. |
| 5 | Restricted Surfaces marked | At least one component in the package has `locked: true`; the workbench refuses to mutate it. |
| 6 | Validation runs | Running validation on the loaded package produces 0 Blocker findings (Restricted Surfaces are locked, not violated). |
| 7 | Export round-trips | Export the package; re-import; Frames render identically; `validation_report.json` is byte-identical. |
| 8 | Spec readable | The generated `spec.md` lists every Frame, every archetype used, every Token used, and is intelligible to a developer who has never seen GeoSee. |
