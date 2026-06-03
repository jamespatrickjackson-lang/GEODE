# GeoSee Editor Inventory

**Status:** active concept inventory for the standalone editor.

This document maps useful GeoSee editor concepts into `gui-editor.html`
capabilities. It is a conceptual transfer, not a React/Vite port and not a
package-export contract.

## Variable Groups To Support

| Group | Editor support |
| --- | --- |
| Overlay material | Fill, alpha, blur, saturation, radius, border alpha, shadow. |
| Text colors | Label, muted, active, warning, value text. |
| Border | Color, alpha, width, hairline presets. |
| Radius | Panel, card, row, pill, custom. |
| Padding | Per-side padding, content zone, default child placement. |
| Typography | Font, size, weight, value/label presets. |
| Image treatment | Background image load, opacity/fit where applicable. |
| Figure labels | Label style tokens and text Components. |
| Navigator style | Bar/pill material, active item, compact labels. |
| Editor chrome | Panel fill, compact gaps, top bar sizing, footer material. |
| Section gaps | Gap tokens and stack controls. |
| Slider sizing | Slider row assembly and token presets. |
| Save icon sizing | Icon entries and footer assembly controls. |
| Topo Environment | Cloud-icon section, scene atmosphere, clouds, sun, and fog controls. |
| Local atmosphere/clouds | Subtype, color, opacity, density, puff count/scale, bounds, falloff, drift, depth, render order, and bounds helper concepts. |
| Sun visual controls | Light-source toggle, sky/orb visibility, source marker, orb/halo color, opacity, size, edge softness, and projected-shadow controls. |

## Container Archetypes

| Archetype | Library tier | Notes |
| --- | --- | --- |
| Editor sidebar shell | Product | Full sidebar surface. |
| Section stack | Assembly | Vertical group of sections. |
| Collapsible section | Assembly | Header plus child body. |
| Nested section header | Assembly | Indented child section header. |
| Layer tool container | Assembly/Product | Layer controls and actions. |
| Control row | Assembly | Label plus input/slider/icon. |
| Save footer | Assembly | Footer row with save/status controls. |
| Card overlay | Assembly/Product | Frosted overlay material. |
| Navigator group | Assembly/Product | Navigation chips/bar. |
| Virtual capability container | Product | Conceptual surface for capabilities and states. |
| Topo Environment container | Product | Scene atmosphere, Clouds, Sun, and Fog under Topo. |
| Atmosphere control group | Assembly/Product | Appearance, Puffs, Bounds, Falloff, Drift, and Render subsections. |

## Workflow Concepts

The standalone editor should have Products and Assemblies that can represent:

- Pages.
- Cards.
- Cinematics.
- GUI Styles.
- Editor chrome.
- Client Logo.
- Topo controls.
- Topo Environment, including Clouds, Sun, and Fog.
- Local atmosphere/cloud volume controls.
- Sections.
- Layer visibility, opacity, and fog controls.
- Provenance labels.
- Render preset controls.
- Page override controls.
- Environment inheritance indicators.
- Sub Master/page child hierarchy.

These are authoring surfaces only. The standalone editor must not pretend to be
the GeoSee runtime persistence layer.

## Product Editor Needs

Product mode should support GeoSee-style authoring surfaces:

- Page manager sidebars.
- Camera/cinematics panels.
- Layer-card stacks.
- Tool palettes.
- Overlay cards.
- Navigator bars.
- Floating HUD controls.
- Topo Environment panels with cloud, sun, and fog control groups.

Each should be representable from nested DOM elements and saveable as a Product
or Assembly.

## Library Population

The Library should contain:

- Components for icons, labels, dividers, swatches, inputs, sliders, and
  buttons.
- Assemblies for rows, headers, page rows, layer rows, section bodies, and
  save footer.
- Products for sidebar shell, page manager, layer stack, navigator, and HUD.
- Products for Topo Map Tool and Topo Environment.
- Assemblies for atmosphere appearance, puffs, bounds, falloff, drift, render,
  sun visual, and fog control groups.
- Colour entries for GeoSee UI colors.
- Token entries for spacing, padding, radius, alpha, blur, saturation,
  typography, line width, and icon sizing.
- Style entries for overlay card, navigator, editor chrome, label, page row,
  layer row, and footer.

Every entry needs a visible thumbnail or preview.

## Concept Transfer Rules

- Use GeoSee files to identify concepts, variables, and patterns.
- Do not port React components directly into `gui-editor.html`.
- Do not flatten GeoSee runtime inheritance or topo material authority.
- Do not resume package export, validation, or AI handoff.
- If a GeoSee concept cannot be rebuilt in the standalone editor, add the
  missing editor primitive, inspector field, Library entry, or placement rule.

## Acceptance

1. The default Library exposes representative entries from this inventory.
2. Product mode can compose GeoSee-style sidebar, page, layer, navigator, and
   overlay surfaces.
3. Inspector fields cover the listed variable groups.
4. Library thumbnails make entries recognizable.
5. The straw subject can be rebuilt using these entries and tools.
