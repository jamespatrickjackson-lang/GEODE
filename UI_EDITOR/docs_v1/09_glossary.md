# Glossary

**Status:** active standalone editor terminology.

Use these terms in UI labels, docs, tests, and implementation notes for
`gui-editor.html`.

## Active Terms

| Term | Meaning |
| --- | --- |
| Standalone editor | The current `UI_EDITOR/gui-editor.html` editor. |
| Canvas | The live DOM authoring surface. |
| Editable element | Any real DOM node marked with `data-c`. |
| Layer | An editable element as shown in the Layers tree. |
| Layers tree | The left tree that mirrors real DOM parent/child nesting and order. |
| Parent | The DOM element that owns another editable element. |
| Child | An editable element nested inside a parent. |
| Leaf | An element that cannot accept children, such as text, icon, line, divider, swatch, or input. |
| Container | An element that can accept children. |
| Content box | A parent's bounds after padding is removed. |
| Padding overlay | The visible inset shown on selected containers. |
| Placement engine | The shared ruleset for canvas drag, tree drag, library drag, and draw-create. |
| Drop intent | The resolved action: move, nest, reorder before, reorder after, instantiate, create, or reject. |
| Auto-nest | Reparenting into a valid container when the target is clear. |
| Reorder | Changing sibling DOM order before or after another layer. |
| Smart guide | A temporary line showing the snap target currently being used. |
| User guide | A persistent guide created by the user. |
| Snap | Aligning movement or resize to grid, guides, parent content lines, or sibling lines. |
| Component | A reusable leaf or atomic control. |
| Assembly | A reusable nested group of components and containers. |
| Product | A larger composed surface such as a sidebar, page manager, or layer panel. |
| Library | The floating panel that stores reusable Components, Assemblies, Products, Colours, Icons, Tokens, and Styles. |
| Thumbnail | A visible preview for a Library entry. |
| Token | A reusable value such as spacing, radius, alpha, typography, or line width. |
| Style | A reusable group of compatible visual values. |
| Inspector | The right panel that edits selected element properties. |
| Behavior Log | User-facing log of accepted and rejected placement actions. |
| Background image | A loaded image behind the canvas, used as a reconstruction/reference aid. |
| GeoSee preset | A standalone editor style/control preset derived from GeoSee editor concepts. |

## Element Kinds

| Kind | Accepts children | Typical tier |
| --- | --- | --- |
| `product-surface` | Yes | Product |
| `sidebar-shell` | Yes | Product |
| `panel` | Yes | Product or Assembly |
| `card` | Yes | Assembly or Product |
| `section` | Yes | Assembly |
| `row` | Yes | Assembly |
| `group` | Yes | Assembly |
| `container` | Yes | Assembly or Product |
| `text` | No | Component |
| `icon` | No | Component |
| `button` | Usually no, unless represented as an assembly | Component or Assembly |
| `rect` | No | Component |
| `ellipse` | No | Component |
| `line` | No | Component |
| `divider` | No | Component |
| `swatch` | No | Component |
| `input` | No | Component |
| `slider-row` | Yes | Assembly |

## Parked Terms

These terms belong to the historical package workbench unless an explicit task
resumes that work:

| Parked term | Current replacement |
| --- | --- |
| GUI Package | DOM snapshot and local editor state. |
| `frames.json` | Not active. Use live DOM/canvas state. |
| `containers.json` | Library seed reference only. |
| `components.json` | Library seed reference only. |
| `tokens.json` | Token Library seed reference only. |
| PackageManifest | Not active. |
| Validation report | Not active. Use direct editor tests and visual checks. |
| Change state | Not active. Use undo/redo and saved local state. |
| AI-agent brief | Not active. Use notes/intent fields only. |
| Autonomous runbook | Not active. Use current implementation/test plan. |
| Host adapter | Not active. |

## Naming Rules

- Use plain user-facing names: Layers, Library, Inspector, Canvas, Behavior Log.
- Use Component, Assembly, and Product for tiers.
- Use notes or intent for human-readable context.
- Do not label current UI as package export, validation, AI handoff, or
  autonomous agent flow.
