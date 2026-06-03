# Component And Archetype Reference

**Status:** active standalone editor catalog.

This file defines the kinds of things the standalone editor should create,
nest, inspect, save, and instantiate. These are DOM archetypes, not package
schema records.

## Tiers

| Tier | Use | Nesting |
| --- | --- | --- |
| Component | Atomic object or control | Usually leaf. |
| Assembly | Reusable nested structure | Can contain Components and smaller Assemblies. |
| Product | Larger authored surface | Can contain all tiers. |

## Core Container Kinds

| Kind | Tier | Accepts children | Notes |
| --- | --- | --- | --- |
| Product surface | Product | Yes | Root authoring surface for full panels. |
| Sidebar shell | Product | Yes | GeoSee editor sidebar-style container. |
| Panel | Product/Assembly | Yes | Generic major region. |
| Overlay card | Product/Assembly | Yes | Frosted card material with rounded border and shadow. |
| Section stack | Assembly | Yes | Vertical group of sections. |
| Collapsible section | Assembly | Yes | Header plus nested body rows. |
| Nested section header | Assembly | Yes | Indented subsection header. |
| Row | Assembly | Yes | Horizontal control row. |
| Group | Assembly | Yes | User-created wrapper. |
| Navigator group | Product/Assembly | Yes | Page/nav chip row or compact navigation strip. |
| Floating HUD | Product/Assembly | Yes | Absolute overlay controls. |

## Component Kinds

| Kind | Accepts children | Required fields |
| --- | --- | --- |
| Text | No | Text content, font, size, weight, color. |
| Icon | No | Glyph, size, color. |
| Icon button | Usually no | Glyph, label/name, size, button material. |
| Rectangle | No | Fill, radius, border. |
| Ellipse | No | Fill, border. |
| Line | No | Direction, line width, color, opacity. |
| Divider | No | Orientation, line width, color, opacity. |
| Swatch | No | Color, label/name. |
| Input | No | Value/placeholder, typography, fill, border. |
| Slider control | No | Min, max, value, track style. |

If a button or slider needs child text/icons, represent it as an Assembly row
rather than a leaf.

## Assembly Patterns

| Assembly | Expected children |
| --- | --- |
| Icon-label row | Icon, text label, optional value. |
| Labelled input row | Text label, input. |
| Labelled slider row | Text label, slider control, value input/text. |
| Layer row | Visibility icon, layer label, optional opacity/fog controls. |
| Page row | Page icon, page name, status/action icons. |
| Sub Master row | Page row fields plus add child/re-snapshot controls. |
| Section header | Disclosure icon, text label, optional action icon. |
| Save footer | Status label, save button/icon, optional timestamp. |
| Tool palette row | Group of icon buttons. |

## Product Patterns

| Product | Expected assemblies |
| --- | --- |
| GeoSee sidebar | Header, page manager, section stack, layer stack, save footer. |
| Page manager | Page rows, Sub Master rows, child page rows, action controls. |
| Layer panel | Layer card headers, nested layer subsections, opacity/fog rows. |
| Cinematics panel | Shot rows, timing controls, camera controls, preview actions. |
| GUI styles panel | Style swatches, token rows, typography controls. |
| Navigator bar | Navigator group, page chips, active state, compact actions. |
| Overlay HUD | Overlay cards, floating controls, labels, status chips. |

## Valid Nesting Rules

- Product can contain Product, Assembly, and Component entries.
- Assembly can contain Assembly and Component entries.
- Component cannot contain children unless it is changed to a container-like
  kind.
- A parent cannot be dropped into its own descendant.
- Hidden or locked items cannot accept drops.
- Reorder is allowed only among siblings under the same parent.

## Inspector Requirements By Kind

| Kind group | Inspector must expose |
| --- | --- |
| Containers | Padding, gap, stack, alignment, fill, opacity, radius, border, blur, saturation, shadow. |
| Rows | Direction, gap, alignment, padding, height, row material. |
| Text/labels | Text content, font, size, weight, color, alignment. |
| Icons | Glyph, size, color, button wrapper when applicable. |
| Shapes | Fill, radius where applicable, stroke, opacity. |
| Lines/dividers | Orientation, line width, color, opacity. |
| Inputs/sliders | Value fields, typography, track/material style. |

## Library Requirements

Every archetype that appears in the default GeoSee straw subject should also be
available through the Library as a Component, Assembly, Product, Token, or
Style entry.

## Acceptance

The reference is satisfied when:

1. All listed kinds can be represented in the editor.
2. Valid child rules are used by canvas drag, tree drag, and library drag.
3. Tree nesting mirrors the expected archetype hierarchy.
4. Inspector fields match the selected kind.
5. Library entries preserve nested assemblies and product structures.
