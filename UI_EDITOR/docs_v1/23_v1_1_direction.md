# v1.1 Direction - Component / Assembly / Product Hierarchy

**Status:** active direction for the standalone editor in
`UI_EDITOR/gui-editor.html`.

This doc defines the authoring model now used by the standalone editor. It is
not a package-export contract and it is not an AI-agent build prompt.

## 1. Why This Exists

The old package workbench proved useful as a concept archive, but it was not a
usable direct authoring surface. The current editor must let an author build
GeoSee-style UI directly: create containers, place text/icons/shapes, align
children, edit padding, save reusable pieces, and compose full products.

## 2. The Three Tiers

| Tier | What it is | Examples | Children |
| --- | --- | --- | --- |
| Component | Atomic interface element. | Text, icon, rectangle, ellipse, line, divider, swatch, input. | No children. |
| Assembly | Small reusable composite. | Icon-label button, row, labelled slider, labelled numeric input. | Components and containers. |
| Product | Full authoring surface. | Sidebar, page manager, layer stack, overlay card, navigator, tool palette. | Assemblies, Components, Products, and containers. |

The tiers are authoring scopes in one app. They are not separate runtimes.

## 3. Current Standalone Behavior

- Toolbar mode buttons switch Component / Assembly / Product mode.
- New elements receive a default tier based on the current mode and element
  kind.
- Components are treated as leaves for nesting.
- Assemblies and Products can hold nested editable children.
- Save as Component / Assembly / Product stores a browser-local DOM template in
  the matching library.
- Clicking a library item instantiates a fresh editable DOM copy.

## 4. Starter Pack

The active starter pack is browser-local and appears in the Library panel:

- Components: Text, Icon, Rectangle, Ellipse, Line, Divider, Swatch, Numeric
  Input.
- Assemblies: Icon label row, Pill button, Labelled slider.
- Products: Starter sidebar, Overlay card, Navigator bar.
- Assets: Colours, Icons, Tokens, Styles.

This starter pack complements the GeoSee sidebar reference. It does not replace
GeoSee as the conceptual source for product authoring.

## 5. GeoSee Concept Mapping

Use `24_geosee_editor_inventory.md` to map real GeoSee editor concepts into
Component / Assembly / Product libraries:

- Page Manager, Cinematics, Sections, Topo, Forge/Data, Cards.
- Editor chrome, save footer, section stack, nested headers.
- Overlay card, navigator, labels, GUI style variables.
- Layer card stack, visibility/opacity/fog/provenance rows.

Do not flatten GeoSee page inheritance, render presets, or topo material
authority into generic style values. Those are reference concepts only in the
standalone editor.

## 6. Acceptance

1. The editor exposes all three modes.
2. Components, Assemblies, and Products can be saved to separate libraries.
3. Nested text/icons appear under their parent rows in the layers tree.
4. Drawing tools create editable Component leaves.
5. Product mode can compose full GeoSee-style surfaces from nested editable
   DOM.
6. Docs and UI wording use plain `notes` / `intent`, not AI handoff language.
