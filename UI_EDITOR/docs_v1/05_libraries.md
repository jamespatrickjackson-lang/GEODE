# v1 Libraries

**Status:** active standalone editor spec.

Libraries live in the standalone editor and persist in `localStorage` with the
edited DOM. They are not package-export schemas in the current build.

The editor also imports read-only seed catalogs from
`packages/geosee_editor_sidebar/` when it is served over HTTP:

- `libraries.json` for packaged Components, Assemblies, Products, Colours,
  Icons, Tokens, and Styles.
- `components.json` for concrete package component examples.
- `containers.json` for package container examples.
- `tokens.json` for token names and values.

Those files are used as library seeds only. They do not make the standalone
editor a package workbench, and clicking library entries still creates editable
DOM templates in `gui-editor.html`.

## 1. Library Kinds

| Kind | What it contains | How the author uses it |
| --- | --- | --- |
| Components | Leaf controls such as text, icon, rectangle, ellipse, line, divider, swatch, input. | Click to instantiate; save selected leaf as a reusable Component. |
| Assemblies | Small composites such as icon-label row, button, labelled slider. | Click to instantiate; save selected composite as an Assembly. |
| Products | Full surfaces such as sidebar, overlay card, navigator bar, panel stack. | Click to instantiate; save selected surface as a Product. |
| Colours | Named GeoSee swatches. | Apply to selected fill. |
| Icons | Small glyph entries. | Instantiate or apply text/icon value. |
| Tokens | Reusable sizes such as radius, blur, spacing, pill radius. | Apply to compatible selected fields. |
| Styles | GeoSee material presets. | Apply overlay-card, navigator, editor-chrome, or label style. |

## 2. Starter Library

The starter library must include:

- Components: Text, Icon, Rectangle, Ellipse, Line, Swatch, Divider, Numeric
  Input.
- Assemblies: Icon label row, Pill button, Labelled slider.
- Products: Starter sidebar, Overlay card, Navigator bar.
- Colours: Overlay background, warm text, page accent.
- Tokens: panel radius, backdrop blur, pill radius.
- Styles: overlay card glass, navigator glass, editor chrome.

## 3. GeoSee Seed Coverage

The current built-in Library must also include representative entries pulled
from the real GeoSee editor and Base GUI:

- Editor atoms: visibility eye button, disclosure chevron, slider track/thumb,
  override checkbox, number readout, material line, label chip.
- Editor assemblies: editor header row, top-level section header, nested
  section header, layer visibility row, override style row, provenance field
  row, slider control row, save footer.
- Product surfaces: GeoSee editor sidebar, page manager sidebar, cards editor,
  layer card stack, topo material panel, floating preview HUD.
- Colours: overlay background, warm/secondary/body text, terrain ramp colours,
  mist volume colour.
- Tokens: editor panel width, UI scale, section gap, pill inset, slider track
  and thumb sizes, overlay blur, mist opacity.
- Styles: overlay card glass, navigator glass, editor chrome shell, heading
  bars, scene label pill, terrain ramp, mist volume.

## 4. Save And Instantiate

- Saving a selection as Component / Assembly / Product stores a DOM template
  with runtime ids stripped.
- Clicking a saved library item instantiates a fresh editable DOM copy.
- Instantiated children appear in the layers tree under their parent.
- Components are leaves. Assemblies and Products may contain nested editable
  children.

## 5. GeoSee Variable Presets

The Style library and inspector preset dropdown use conceptual values from
Base GUI and the dev editor:

- Overlay card: background, alpha, radius, padding, blur, border.
- Navigator: pill radius, low alpha background, row layout, button gap.
- Editor chrome: dark panel material, section spacing, panel padding.
- Label: dark fill, warm text, compact padding.

These presets are design-authoring helpers. They do not mutate GeoSee project
files.

## 6. Acceptance

1. Library panel renders all seven tabs.
2. Starter entries appear without package loading.
3. GeoSee-derived editor atoms, assemblies, products, colours, tokens, and
   styles appear in their tiers.
4. Package-backed entries from `packages/geosee_editor_sidebar` appear after
   the import completes.
5. Saving a selected element creates a library item in the chosen tier.
6. Clicking a library item creates a fresh editable DOM instance.
7. Colour/icon/token/style items can apply compatible values to a selected
   element.
8. Reload restores saved library entries.
