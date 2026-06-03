# v1.1 GeoSee Editor Inventory — Component / Assembly / Product mapping

**Status:** active inventory reference. Use this to understand GeoSee editor
content and populate standalone Component / Assembly / Product libraries.
It is not an AI-agent build prompt or package export contract.

This was originally mapped into the three-tier authoring model from
[23_v1_1_direction.md](23_v1_1_direction.md). The UI Editor's bundled
library is populated from this catalogue.

This doc walks the surface area of `C:\GeoSee\GeoSee_Dev\src\editor\` at
the v1.1-start line and assigns every distinct UI element a tier.
It supersedes the earlier doc 06 (`geosee_editor_sidebar` straw subject)
which framed the sidebar as a single reconstruction target.

## 1. Surface inventory by source file

Where a single file produces multiple distinct authoring units, each
unit is named separately and given its own row in §2–§4.

| Source file | Tier(s) produced |
| --- | --- |
| `EditorRoot.tsx` | Editor chrome (Product), Save button (Component) |
| `EditorChrome.tsx` | Outer chrome bar (Product fragment) |
| `PagePanel.tsx` | Page Manager (Product), Page List Row (Assembly), Sub Master Row + Child variants (Assemblies), Pseudo Page Bar / Global Settings row (Assembly), Footer Action Row (Assembly), Footer Action Button (Component) |
| `EnvironmentScenePanel.tsx` | Environment Studio (Product), GUI Setup Panel (Product), Camera Setup Panel (Product), Labelled Slider / `Range` (Assembly), Studio Disclosure / `GuiSubsection` (Assembly), Font Select (Assembly) |
| `LayerPanel.tsx` + `LayerPanelGroups.tsx` | Layer Stack (Product), Layer Card Header (Assembly), Layer Subsection Disclosure (Assembly) |
| `OverlayPanel.tsx` | Overlay Box Manager (Product), Page Text Section / Inset Image Section / Timing Section (Assemblies), Visible / Hidden toggle (Component) |
| `SiteDetailsPanel.tsx` | Site Details panel (Product) |
| `DevModeInspector.tsx` | Dev Mode Inspector (Product, internal) |
| `CollapsibleSection.tsx` | Collapsible Section frame (Assembly chrome) |
| `InlineEditableTitle.tsx` | Inline Editable Text (Component) |
| `styleControls.tsx` | EnvStyleRow / PageStyleRow / EnvVisibilityRow / PageVisibilityRow (Assemblies); the row-level building blocks for layer Appearance, Labels, Provenance disclosures |
| `layerControls/seismic/*` | Seismic Browser controls (Product fragment), Audience+Preset Picker (Assembly), Product Picker (Assembly), Slice / Position Sliders (Assemblies), Amplitude Window Sliders (Assemblies), Background Stress chip strip (Assembly) |
| `layerControls/mt/*` | MT Volume / Threshold Surface / Isoband controls (Product fragments + Assemblies) |
| `layerControls/style/*` | Style Controls (Assemblies), Area Outlines Controls (Assemblies) |
| `layerControls/page/PageOverrideRows.tsx` | Override Tag (Component), Override Toggle Row (Assembly) |
| `layerControls/overlays/SceneOverlayControls.tsx` | Scene Overlay Controls (Product fragment) |

## 2. Components (atomic)

| Workbench id | GeoSee name | Source | What it is |
| --- | --- | --- | --- |
| `component-text` | Text | `styles.ts` (`panelStyles.fieldLabel`) | Plain label text — uppercase, tertiary colour, 11 px. |
| `component-inline-editable-text` | Inline Editable Title | `InlineEditableTitle.tsx` | Click to edit single-line text. |
| `component-numeric-label` | Numeric label (XX. / XX.M.NN) | `PagePanel.tsx` | Padded numeric display, role-aware formatting. |
| `component-letter-glyph` | Camera Focus F glyph | `PagePanel.tsx` | Single-character status indicator. |
| `component-dirty-dot` | Dirty dot | `PagePanel.tsx` | Small filled circle indicating unsaved state on a row. |
| `component-colour-swatch` | Page accent swatch | `PagePanel.tsx` | Small colour chip → native `<input type="color">` on click. |
| `component-icon-button` | Icon button | many | Square icon-only button (page reorder, hide/show, refresh, add). |
| `component-footer-action-button` | Footer action button | `PagePanel.tsx` | Larger icon button used in panel footers (Add / Duplicate / Reset / Delete). |
| `component-pill-button` | Pill button | various | Rounded full-radius button. |
| `component-divider` | Divider line | `styles.ts` (`FROSTED_HAIRLINE`) | Horizontal or vertical 1 px hairline. |
| `component-checkbox` | Visibility / boolean toggle | `styleControls.tsx` | Native checkbox. |
| `component-slider` | Range slider | `styleControls.tsx` `EnvStyleRow` | Native `<input type="range">` with optional fill. |
| `component-numeric-input` | Numeric input | `styleControls.tsx` | Native `<input type="number">`. |
| `component-select-dropdown` | Native select | various | `<select>` with options. |
| `component-icon` | Standalone glyph | SVG paths bundled in library | Static icon used in row chrome / footer rows. |
| `component-override-tag` | "overridden" / "inherited" badge | `styleControls.tsx` `overrideTagStyle` | Small pill tag showing override state. |
| `component-save-button` | Save button (with dirty count) | `EditorRoot.tsx` `SaveButton` | Circular icon button + numeric dirty-count counter to its left. |

## 3. Assemblies (small composites)

| Workbench id | GeoSee name | Composition | Used in |
| --- | --- | --- | --- |
| `assembly-labelled-slider` | Range row | `component-text` + `component-slider` + numeric readout | Env style controls, layer controls, camera studio. |
| `assembly-labelled-numeric` | Numeric row | `component-text` + `component-numeric-input` + optional unit text | Camera FOV, focus distance, layer thresholds. |
| `assembly-labelled-select` | Select row | `component-text` + `component-select-dropdown` | Material preset picker, easing picker, render preset. |
| `assembly-labelled-colour` | Colour row | `component-text` + `component-colour-swatch` + optional hex readout | Env scene fog colour, layer colour fields. |
| `assembly-visibility-row` | Visible toggle row | `component-text` ("Visible") + `component-checkbox` | Env layer Appearance section. |
| `assembly-override-toggle-row` | Page-override row | override toggle `component-checkbox` + value input + `component-override-tag` | Layer/page override rows. |
| `assembly-collapsible-section` | Collapsible Section | summary header (`component-text` + chevron) + accent border + content slot | Wraps every studio in the editor sidebar. |
| `assembly-page-list-row` | Page list row | `component-dirty-dot` + `component-numeric-label` + `component-inline-editable-text` + `component-colour-swatch` + 2× `component-icon-button` (up/down) + `component-icon-button` (hide/show) | Page Manager rows. |
| `assembly-sub-master-row` | Sub Master page row | `assembly-page-list-row` + 4 px left border + `component-icon-button` (`+` add child) + `component-icon-button` (`↻` re-snapshot) | Page Manager Sub Master rows (DEC-079). |
| `assembly-sub-master-child-row` | Sub Master child row | Indented `assembly-page-list-row`, accent inherited from parent | Page Manager Sub Master children. |
| `assembly-pseudo-page-bar` | Global Settings bar | `component-dirty-dot` + `component-numeric-label` ("00") + `component-text` ("Global Settings") + `component-icon-button` (`+` add Sub Master) | Page Manager top row. |
| `assembly-footer-action-row` | Footer action row | 4× `component-footer-action-button` (Add / Duplicate / Reset / Delete) | Beneath Page Manager and Layer Stack. |
| `assembly-camera-studio-subsection` | Camera Studio subsection | `assembly-collapsible-section` wrapping camera-related rows | Camera Setup Panel (focus transition / perspective / vignette / image-finish / glow). |
| `assembly-layer-card-header` | Layer card header | disclosure chevron + `component-text` (layer name) + `component-checkbox` (visible) + `component-override-tag` | Layer card top bar. |
| `assembly-layer-subsection` | Layer subsection | `assembly-collapsible-section` (Appearance / Labels / Provenance) | Inside layer cards. |
| `assembly-seismic-audience-picker` | Audience + Preset picker | `assembly-labelled-select` (Audience mode) + `assembly-labelled-select` (Preset) + caption text | Seismic Browser top of Appearance. |
| `assembly-seismic-window-pair` | Amplitude window pair | 2× `assembly-labelled-slider` (Amp min / Amp max) | Seismic Display Tuning. |
| `assembly-overlay-text-section` | Overlay Box Manager — Page Text | section heading + Visible/Hidden toggle + Title input + Subtitle input + body textarea | Overlay Box Manager. |
| `assembly-overlay-image-section` | Overlay Box Manager — Inset Image | section heading + file input + per-image insert/remove rows | Overlay Box Manager. |
| `assembly-overlay-timing-section` | Overlay Box Manager — Timing | section heading + Fade-ms input + Gap-ms input + Easing select | Overlay Box Manager. |

## 4. Products (full surfaces)

| Workbench id | GeoSee name | Source | Composition |
| --- | --- | --- | --- |
| `product-editor-chrome` | Editor outer chrome | `EditorRoot.tsx`, `EditorChrome.tsx` | Top bar with Save button, Presenter toggle, project picker, audience-lens dropdown. Hosts the rest of the products. |
| `product-page-manager` | Page Manager | `PagePanel.tsx` | `assembly-pseudo-page-bar` + stack of `assembly-page-list-row` (with Sub Master variants where present) + `assembly-footer-action-row`. |
| `product-environment-studio` | Environment scene | `EnvironmentScenePanel.tsx` | Sun azimuth/elevation, exposure, fog density, fog colour, studio lighting rows — each built from `assembly-labelled-slider` / `assembly-labelled-colour`. |
| `product-camera-studio` | Camera Studio | `EnvironmentScenePanel.tsx` `CameraSetupPanel` | Five `assembly-camera-studio-subsection`s (focus transition / perspective / vignette / image-finish / glow) plus `dynamicCamera` + `cinematicRenderPreset` panels. |
| `product-gui-setup` | GUI Setup | `EnvironmentScenePanel.tsx` `GuiSetupPanel` | Overlay style picker, label-style controls, navigator controls. |
| `product-layer-stack` | Layer Panel | `LayerPanel.tsx` | Multiple `assembly-layer-card-header` + nested `assembly-layer-subsection`s. |
| `product-overlay-box-manager` | Overlay Box Manager | `OverlayPanel.tsx` | `assembly-overlay-text-section` + `assembly-overlay-image-section` + `assembly-overlay-timing-section`. |
| `product-site-details` | Site Details | `SiteDetailsPanel.tsx` | Header text + `assembly-labelled-text` rows for site metadata. |
| `product-dev-mode-inspector` | Dev Mode Inspector | `DevModeInspector.tsx` | Source-link rows; developer-only, hidden behind a dev flag. |

## 5. Where each item lives in the bundled library

The standalone editor's browser-local library should expose these entries as
Components, Assemblies, and Products with plain notes/intent metadata. Saved
library entries are DOM templates, not package-export records.

The composition of each Assembly and Product is documented in this file's
tables. Current standalone behavior may instantiate starter entries as compact
DOM templates; fuller composition recipes can be added incrementally without
reviving the paused package workbench.

Current implementation sources:

- Hand-authored GeoSee entries in `gui-editor.html` cover real editor atoms,
  rows, product surfaces, Base GUI colours, editor chrome tokens, overlay
  materials, navigator materials, label pills, terrain ramp, and mist volume.
- Read-only package imports from `packages/geosee_editor_sidebar/libraries.json`
  add packaged Components, Assemblies, Products, Colours, Icons, Tokens, and
  Styles.
- Read-only package imports from `components.json`, `containers.json`, and
  `tokens.json` add concrete example controls, root containers, nested
  containers, and token names/values.

These imports are library seeds only. The standalone editor still edits real
DOM and persists `localStorage`; it does not export package schemas.

## 6. Current gap list

The first rebuild pass intentionally exposes these remaining gaps:

1. Package entries instantiate as compact DOM templates, not full reducer-backed
   GeoSee behavior.
2. Deep typed editors are still needed for ramps, vector XYZ values, topo
   bounds, texture paths, dynamic lists, shadow stacks, enum records, and
   inheritance diffs.
3. Inheritance/source views are still shallow. A future inspector should show
   environment defaults, Sub Master snapshots, page overrides, render preset
   patches, layer style patches, topo material authority, active asset URL/cache
   key, and resolved effective values side by side.
4. Visual debugging should expose the required render-stack trace without
   leaving diagnostic overlays enabled by default.

## 7. Forward-compat hooks for v2

Each entry in §2–§4 has a known GeoSee source file. Keep these source
references so future host-app integration can map authored UI back to real
GeoSee concepts. Host-app adapter work remains parked.

## 8. Acceptance criteria for this inventory

1. Every distinct UI atom in `src/editor/` appears in §2, §3, or §4
   exactly once. Walk the source files in §1 and verify nothing is
   missing.
2. Every Assembly in §3 has a Composition column listing only
   Component ids from §2 or Assembly ids that appear earlier in §3
   (no forward references).
3. Every Product in §4 has a Composition column listing only Assembly
   ids from §3, Component ids from §2, or other Products from §4
   higher in the list.
4. The standalone Library panel exposes representative entries from §2, §3,
   and §4.
5. The standalone Library panel exposes package-backed seed entries from
   `packages/geosee_editor_sidebar`.
6. Each library entry has a non-empty source or intent aligned with the
   description columns above.

This inventory is the single source of truth for GeoSee concepts used by the
standalone editor. When GeoSee adds a new editor surface, append it here first,
then update the library.
