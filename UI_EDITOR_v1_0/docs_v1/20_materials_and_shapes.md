# v1 Materials, Grouping, Shapes, Effects

## 1. Goal

Promote v1 from "structured panel layout with snap" to a genuine Figma-lite editor by adding four orthogonal capabilities:

| Capability | What it gives the author |
| --- | --- |
| **Style Library** (Materials) | Save fill + border + effects + padding as a reusable named Style; apply with one click; edit the Style and every reference updates live. |
| **Grouping** | Wrap selected elements in a `container-group`. Cascade selection (click child → selects group first; shift-click drills in). Ungroup lifts children back to the parent. |
| **Shape primitives** | Ellipse, free-angle Line, lightweight Rectangle (as a Component, distinct from a structural Container), Image placeholder. |
| **Effects** | Shadow, blur, opacity as first-class properties on Component / Container. Driven by tokens or literal values. |

These four are scope additions to the v1 pack. Affected: [04_toolkit.md](04_toolkit.md), [05_libraries.md](05_libraries.md), [07_package_format.md](07_package_format.md), [08_validation_rules.md](08_validation_rules.md), [14_component_archetype_reference.md](14_component_archetype_reference.md), [09_glossary.md](09_glossary.md), [10_build_phases.md](10_build_phases.md), [19_known_pitfalls.md](19_known_pitfalls.md). This doc is the single-source-of-truth; doc patches reference back here.

## 2. Style Library (Materials)

### 2.1 Schema

A new Library kind `styles`, added to the `Libraries` interface in [05_libraries.md](05_libraries.md) §4:

```ts
export interface StyleLibraryEntry {
  id: string;                          // kebab-case, unique within library
  name: string;
  semanticRole?: "card" | "panel" | "control" | "input" | "elevated" | "ghost" | "accent" | "warning" | "error";
  rationale?: string;

  // The applied properties. All optional — a Style sets only the fields the
  // author wants to enforce; other fields remain element-local.
  fill?: { hex: string; alpha: number } | { tokenRef: string };
  border?: {
    width: number | { tokenRef: string };
    colour: { hex: string; alpha: number } | { tokenRef: string };
    radius?: number | { tokenRef: string };
    sides?: ("left" | "top" | "right" | "bottom")[];
  };
  padding?: {
    x?: number | { tokenRef: string };
    y?: number | { tokenRef: string };
  };
  effects?: Effects;                   // see §5 below
}
```

`Libraries.styles: StyleLibraryEntry[]` added alongside `components`, `colours`, `icons`, `tokens`. Persisted in `libraries.json`.

### 2.2 Application

`src/core/libraries/applyStyle.ts`:

```ts
export function applyStyle(
  selection: SelectionIds,
  styleId: string,
  pkg: Package,
): Package;
```

For each element in `selection`, sets every defined field on the matching Style as a `{ styleRef: styleId }` reference (analogous to `tokenRef`). The renderer resolves the ref at render time so editing the Style updates every reference live.

If the element's archetype does not support a Style field (e.g. applying a `padding`-bearing Style to a `divider` Component), that field is skipped silently per-element; the other fields apply.

### 2.3 Properties Inspector affordance

When Selection is non-empty, the Inspector shows a **Style** section above the per-archetype fields:

```text
┌─ Style ──────────────────────────────────────┐
│ Applied style: [ panel-primary           ▾ ] │
│                                              │
│ Edit applied style ▸                         │
│ Detach (clear styleRef)  ⌫                  │
└──────────────────────────────────────────────┘
```

- Dropdown lists every Style in the Library plus "(none)".
- "Edit applied style" navigates to the Style Library Panel with the entry pre-selected for editing.
- "Detach" clears all `styleRef` fields on the Selection, leaving the resolved values as literals (preserves the current rendering; subsequent Style edits no longer affect this Selection).

Selection with mixed styles shows "Multiple values" in the dropdown.

### 2.4 Library Panel — Styles tab

A fifth tab in the Library Panel (`src/shell/libraryPanel/StyleLibraryView.tsx`) shows Styles with:

- Each entry's name, semantic role chip, and a small preview swatch (a 24×24 element rendered with the Style applied).
- Drag onto Canvas → applies to the element under the drop point (no instantiation; Styles are not instantiatable themselves).
- Click → opens the Style edit form (inline form with fill / border / padding / effects fields).
- Search filter.
- Footer "+ Add" and per-row "✏ Edit" / "🗑 Remove".

### 2.5 Style mutation

Editing a Style updates all `{ styleRef: styleId }` references live. The reducer dispatches `STYLE_EDITED` with the new Style content; the Properties Inspector and Canvas re-render.

Removing a Style with active references requires confirm (analogous to removing a Token with references — see [05_libraries.md](05_libraries.md) §7). "Remove anyway" sets every `{ styleRef }` to its currently-resolved literal value (no break in rendering) and produces a `library.unresolved-style-ref` Warning that auto-resolves on the next save.

### 2.6 Bundled Styles for the straw-subject package

`packages/geosee_editor_sidebar/libraries.json` `styles` array ships with:

| Style id | Semantic role | What it sets |
| --- | --- | --- |
| `style-panel-primary` | panel | fill `swatch-editor-field-bg`; border 1 px `rgba(255,255,255,0.16)`; radius `radius.md`; padding `space.md` / `space.md`; effects: shadow `0 24px 80px rgba(0,0,0,0.24)`. |
| `style-panel-elevated` | elevated | fill raised panel grey; border hairline; radius `radius.lg`; effects: shadow + inset highlight per GeoSee frosted material. |
| `style-control-ghost` | ghost | fill transparent; border 1 px subtle; radius `radius.sm`; padding `space.sm` / `space.xs`. |
| `style-card-vibrancy` | card | fill `swatch-global-settings`; border hairline; radius `radius.md`; padding `space.md` / `space.md`. |
| `style-accent-warning` | warning | fill amber Swatch at 0.18 alpha; border 1 px amber at 0.4; radius `radius.sm`. |
| `style-accent-error` | error | fill coral Swatch at 0.18 alpha; border 1 px coral at 0.4; radius `radius.sm`. |

## 3. Grouping

### 3.1 New Container archetype: `container-group`

Added to [14_component_archetype_reference.md](14_component_archetype_reference.md) §4. Definition:

```ts
export interface ContainerGroupExtras {
  archetype: "container-group";
  groupName?: string;            // optional human-readable name distinct from `id`
  collapseInLayersPanel: boolean;
}
```

- Has no visual chrome (transparent fill, no border, no effects) unless the author adds them.
- Acts purely as a layout grouping wrapper.
- Children are positioned in the group's Frame-space (i.e. relative to the group's `rect.x`, `rect.y`).
- When created via Group action (§3.2), the group's rect is computed to be the bounding rect of the selected elements + 0 padding; children's rects are translated into group-local coordinates.

### 3.2 Group / Ungroup actions

Two new reducer actions in `src/editor/types.ts` (and the workbench's `shellActions.ts` equivalent):

```ts
| { type: "ELEMENTS_GROUP"; selectionIds: SelectionIds; frameId: string }
| { type: "ELEMENTS_UNGROUP"; groupId: string }
```

`ELEMENTS_GROUP` rules:

1. Selection size must be ≥ 2; otherwise no-op.
2. All selected elements must share the same `parentId` (no cross-parent grouping); otherwise no-op + Toast "Cannot group elements with different parents."
3. Compute the union rect of all selected elements' rects (in shared-parent-frame-space).
4. Create a new `container-group` Container at that union rect, with `parentId` = the shared parent.
5. Move each selected element under the new group, translating each element's `rect.x` / `rect.y` to be group-local.
6. Set Selection to the new group.
7. Append Change Record `elements_grouped` with the source ids and the new group id.

`ELEMENTS_UNGROUP` rules:

1. `groupId` must refer to a `container-group`; otherwise no-op + Toast.
2. Lift every child up one level: translate each child's `rect` from group-local to parent-local, set each child's `parentId` to the group's `parentId`.
3. Remove the group from the package.
4. Set Selection to the (now-lifted) former children.
5. Append Change Record `elements_ungrouped` with the lifted child ids and the removed group id.

### 3.3 Keyboard shortcuts

- **Ctrl/Cmd + G** — invoke Group on current Selection.
- **Ctrl/Cmd + Shift + G** — invoke Ungroup. If Selection is a single `container-group`, ungroup it. If Selection contains a child of a group, ungroup that group. If Selection has no group context, no-op.

Wired globally in `ShellRoot.tsx`'s key handler; ignored when an input element has focus.

### 3.4 Selection cascade (click-into rule)

Default selection rule when clicking an element on the Canvas:

1. Walk from the clicked element up the parent chain.
2. Select the **topmost ancestor that is a `container-group`** (if any).
3. If no ancestor is a group, select the clicked element directly.

Drill-in: **Double-click on a group** enters "edit-inside" mode for that group. While in edit-inside mode:

- Clicks select the actual clicked element (no cascade).
- The group is rendered with a 1 px dashed outline in `swatch-vibrancy-tertiary`.
- Esc exits edit-inside mode.
- Selecting outside the group also exits edit-inside mode.

Shift-click cascade variant: **Shift + click bypasses the cascade**, selecting the literal clicked element regardless of group membership. This is the quick "I know what I'm doing" override.

### 3.5 Nesting

Groups can contain other groups. Schema allows arbitrary nesting. Validation rule `group.depth-excessive.warning` (Warning) fires at depth > 4 (subjective, but more is suspect for a Figma-lite scope).

### 3.6 Cycle protection

A `container-group` cannot contain itself. The reducer rejects any operation that would create a cycle with Blocker `group.cycle.blocker`. In practice the only way to attempt this is a corrupted package; the editing pipeline cannot construct a cycle in normal use.

### 3.7 Bundled Group archetype intent

Default intent annotation on a fresh `container-group`:

- name: "Group N" (auto-numbered)
- intent: "A layout grouping wrapper. Holds elements that move together."
- behaviour: "Click selects the group; double-click enters edit-inside; Esc exits."

Author refines per instance.

## 4. Shape primitives

Four new Component archetypes. Each is a leaf Component (no children, distinct from Containers).

### 4.1 `rectangle` Component

A lightweight rectangle as a Component, distinct from a structural Container. Use when you want a shape with fill / border / effects but no children and no layout responsibility.

```ts
export interface RectangleProps {
  archetype: "rectangle";
  fill?: { hex: string; alpha: number } | { tokenRef: string } | { styleRef: string };
  border?: {
    width: number | { tokenRef: string };
    colour: { hex: string; alpha: number } | { tokenRef: string };
    radius?: number | { tokenRef: string };
    sides?: ("left" | "top" | "right" | "bottom")[];
  };
  effects?: Effects;
}
```

- Default size 120×80.
- States: default.
- Default intent: "Decorative or structural rectangle. Has no children; use a Container for layout grouping."

### 4.2 `ellipse` Component

```ts
export interface EllipseProps {
  archetype: "ellipse";
  fill?: { hex: string; alpha: number } | { tokenRef: string } | { styleRef: string };
  border?: {
    width: number | { tokenRef: string };
    colour: { hex: string; alpha: number } | { tokenRef: string };
  };
  effects?: Effects;
}
```

- Default size 80×80 (drawn as a circle).
- Drag with Shift held → constrains to a circle (locks aspect ratio at 1:1).
- Default intent: "Circle or oval primitive."

### 4.3 `line` Component (free-angle)

```ts
export interface LineProps {
  archetype: "line";
  // Two endpoints in Frame space. The Component's `rect` is the bounding
  // box; `start` / `end` give the actual line geometry.
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  colour?: { hex: string; alpha: number } | { tokenRef: string };
  endCap?: "butt" | "round" | "square";
  effects?: Effects;
}
```

- Default thickness 2 px.
- Drag with Shift held → snaps angle to nearest 15° increment.
- Distinct from `divider`: `divider` is strictly horizontal or vertical and inherits row-flow semantics; `line` is free-form and decorative.
- Default intent: "Free-angle line segment."

### 4.4 `image-placeholder` Component

```ts
export interface ImagePlaceholderProps {
  archetype: "image-placeholder";
  altText?: string;                    // free-text; used by downstream agent briefs
  aspectRatio?: number;                // optional; if set, Resize preserves it without Shift
  placeholderStyle: "checkerboard" | "diagonal-stripes" | "labeled-box";
}
```

- Default size 200×150.
- Renders as a labelled box ("Image placeholder — alt: …") with optional checkerboard or stripe fill.
- Author plans for a real image at implementation time; the placeholder carries enough metadata for downstream agents to know the intended shape and aspect ratio.
- Default intent: "Image content placeholder. Final image is sourced by the implementing agent at build time, not by the workbench."

### 4.5 Toolkit additions

Three new Tools in [04_toolkit.md](04_toolkit.md):

| Tool | Shortcut | Cursor | Behaviour |
| --- | --- | --- | --- |
| **Rectangle Tool** | `r` (was Resize — Resize moves to `R` capital? No — see §6 conflict resolution below) | `crosshair` | Drag to draw a new `rectangle` Component. Shift constrains to square. |
| **Ellipse Tool** | `o` | `crosshair` | Drag to draw a new `ellipse` Component. Shift constrains to circle. |
| **Line Tool** | `l` | `crosshair` | Drag from start to end to draw a `line` Component. Shift snaps angle to 15° increments. |

(The Image-placeholder is created via the Library Panel only — no dedicated Tool. Drag from the Component Library entry `component-image-placeholder` to instantiate.)

### 4.6 Shortcut conflict resolution

`r` was originally Resize. Rectangle is more authoring-frequent and Figma-aligns. Swap:

- **Rectangle Tool** → `r`
- **Resize Tool** → `s` (was unused; standalone-resize on hovered element)

Update [04_toolkit.md](04_toolkit.md) §3.3 to use `s`. Add a deprecation note in the cold-start prompt for any agent that pre-cached the old shortcut.

## 5. Effects

A new property on Component, Container, Frame:

```ts
// src/core/schema/effects.ts
export interface Shadow {
  offsetX: number | { tokenRef: string };
  offsetY: number | { tokenRef: string };
  blur: number | { tokenRef: string };
  spread?: number | { tokenRef: string };
  colour: { hex: string; alpha: number } | { tokenRef: string };
  inset?: boolean;                     // inset shadow vs drop shadow
}

export interface Effects {
  shadows?: Shadow[];                  // multiple stacked shadows allowed (CSS box-shadow supports lists)
  blur?: number | { tokenRef: string };// CSS filter blur in px
  opacity?: number;                    // 0..1; layer-level opacity
}
```

`Component` and `Container` gain `effects?: Effects`. (Frames already have `background.fill`; v1 keeps Frame-level effects deferred — Frames stay solid backgrounds.)

### 5.1 Properties Inspector

A new collapsible "Effects" section in the Inspector with three subsections:

- Shadows: list of Shadow entries with per-shadow editors; "+ Add shadow" / "Remove" buttons.
- Blur: numeric input + token picker.
- Opacity: slider 0–100 % + numeric input.

### 5.2 Rendering

The renderer translates Effects to CSS:

- `effects.shadows` → `box-shadow: <s1>, <s2>, ...` (or `text-shadow` for text Components).
- `effects.blur` → `filter: blur(Npx)`.
- `effects.opacity` → `opacity: N`.

For SVG / Canvas-rendered elements (lines, ellipses, icons): shadows render via SVG `filter` with `feDropShadow`; blur via `feGaussianBlur`.

### 5.3 Effects in Styles

`StyleLibraryEntry.effects?: Effects` carries reusable Effect bundles. Applying a Style to an element with `effects` field sets the element's `effects` to a `{ styleRef }`. Editing the Style updates every reference.

### 5.4 Validation rules

Three new rules added to [08_validation_rules.md](08_validation_rules.md) §4:

| Rule id | Severity | Condition |
| --- | --- | --- |
| `effects.shadow-no-colour.warning` | Warning | A Shadow with `colour: undefined` or `colour.alpha: 0`. Shadow contributes nothing. |
| `effects.opacity-out-of-range.error` | Error | `effects.opacity < 0` or `> 1`. |
| `effects.blur-excessive.suggestion` | Suggestion | `effects.blur > 32`. Often a typo; double-check the value. |

### 5.5 Tokenisation

Effects values support `tokenRef`. New Token category `shadow` was already listed in [05_libraries.md](05_libraries.md) §4 `TokenCategory`; v1 now actually wires it. Token `value` for `shadow` category is a JSON string parseable as a `Shadow` object.

## 6. Library defaults extended

### 6.1 New Shapes added to Component Library

Append to [05_libraries.md](05_libraries.md) §5.1:

| Entry id | Kind | Archetype | Default size |
| --- | --- | --- | --- |
| `component-rectangle` | component | `rectangle` | 120×80 |
| `component-ellipse` | component | `ellipse` | 80×80 |
| `component-line` | component | `line` | 100×2 (bounding) |
| `component-image-placeholder` | component | `image-placeholder` | 200×150 |

### 6.2 Group Container entry

| Entry id | Kind | Archetype | Default size |
| --- | --- | --- | --- |
| `container-group` | container | `container-group` | auto (from grouped Selection) |

### 6.3 Style entries

See §2.6 above. Six bundled Styles in the straw-subject package.

### 6.4 Shadow tokens

| Token id | Category | Value |
| --- | --- | --- |
| `shadow.sm` | shadow | `{ "offsetX": 0, "offsetY": 1, "blur": 2, "colour": { "hex": "#000000", "alpha": 0.2 } }` |
| `shadow.md` | shadow | `{ "offsetX": 0, "offsetY": 4, "blur": 12, "colour": { "hex": "#000000", "alpha": 0.24 } }` |
| `shadow.lg` | shadow | `{ "offsetX": 0, "offsetY": 24, "blur": 80, "colour": { "hex": "#000000", "alpha": 0.24 } }` |
| `shadow.frosted-elevated` | shadow | Multi-shadow stack for the frosted panel material (use a JSON array). |

## 7. Reducer action shapes

These actions extend the `EditorAction` union (see [02_architecture.md](02_architecture.md) §4 state model). Every action flows through `core/editing/applyEdit.ts` per the [02_architecture.md](02_architecture.md) §3.1 invariants. Per-element rules:

- `editClass` field on the `applyEdit` result must be set to `"schema"` for every action in this section. This triggers the Draft demotion per [16_change_state_machine.md](16_change_state_machine.md) §5.
- Restricted Surface rules ([08_validation_rules.md](08_validation_rules.md) §4.6) run before each action's body executes; refusal returns `{ ok: false, refused: true, findings }` and the action does not mutate state.
- Each action produces exactly one Change Record (kinds listed in §7.x → §8 below).

```ts
// Style Library actions
| { type: "STYLE_ADD"; entry: StyleLibraryEntry }
| { type: "STYLE_EDIT"; styleId: string; patch: Partial<StyleLibraryEntry> }
| { type: "STYLE_REMOVE"; styleId: string; orphanPolicy: "literal-replace" | "warn-only" }
| { type: "STYLE_APPLIED"; selectionIds: SelectionIds; styleId: string }
| { type: "STYLE_DETACHED"; selectionIds: SelectionIds }

// Grouping actions
| { type: "ELEMENTS_GROUP"; selectionIds: SelectionIds; frameId: string }
| { type: "ELEMENTS_UNGROUP"; groupId: string }

// Effects actions
| {
    type: "EFFECTS_CHANGED";
    elementId: string;
    patch: Partial<Effects>;          // partial — caller patches only the fields it changes
  }
| { type: "SHADOW_ADDED"; elementId: string; shadow: Shadow }
| { type: "SHADOW_REMOVED"; elementId: string; shadowIndex: number }

// Shape primitive instantiation (created by Rectangle/Ellipse/Line Tools)
| { type: "RECTANGLE_ADDED"; component: Component /* archetype === "rectangle" */ }
| { type: "ELLIPSE_ADDED"; component: Component /* archetype === "ellipse" */ }
| { type: "LINE_ADDED"; component: Component /* archetype === "line" */ }
| { type: "IMAGE_PLACEHOLDER_ADDED"; component: Component /* archetype === "image-placeholder" */ }
```

### 7.1 STYLE_APPLIED semantics

For each id in `selectionIds`:

1. Resolve the StyleLibraryEntry by `styleId`.
2. For each field that the Style sets (fill / border / effects / padding), assign `{ styleRef: styleId }` on the element.
3. If an element's archetype does not support a field (e.g. `padding` on a `divider`), skip that field silently — no finding.
4. Append one `style_applied` Change Record per element with the original literal values captured for audit.

### 7.2 STYLE_DETACHED semantics

For each id in `selectionIds`:

1. For every field on the element that holds `{ styleRef }`, resolve to the literal value at detach time.
2. Replace the `{ styleRef }` with the resolved literal — rendering is preserved; subsequent Style edits do not affect this element.
3. Append `style_detached` Change Record.

### 7.3 STYLE_REMOVE semantics

When `orphanPolicy: "literal-replace"` (default in v1):

1. Walk every element. For each `{ styleRef: targetId }` found, replace with the literal value the Style would have resolved to.
2. Remove the entry from `libraries.styles`.
3. Append `style_removed` Change Record listing the literal-replaced element count.

When `orphanPolicy: "warn-only"`:

1. Remove the entry from `libraries.styles` without touching elements.
2. Every dangling `{ styleRef }` now produces `library.unresolved-style-ref` Warnings on next validation.
3. Append `style_removed` Change Record with dangling-ref count.

### 7.4 EFFECTS_CHANGED semantics

- `patch` shape: any subset of `{ shadows?, blur?, opacity? }`. Caller specifies only the fields changing.
- Merge semantics: replace `shadows` array wholesale if provided (don't deep-merge — too brittle); shallow merge `blur` and `opacity` (the latter two are scalars).
- Validation rules (`effects.shadow-no-colour.warning`, `effects.opacity-out-of-range.error`, `effects.blur-excessive.suggestion`) run after the patch on the affected element.
- Change Record kind: `effects_changed`. Affected: `{ componentIds: [elementId] }` or `{ containerIds: [elementId] }`.

### 7.5 ELEMENTS_GROUP / ELEMENTS_UNGROUP semantics

Already specified in §3.2. The action shapes above are the canonical typed forms; the reducer cases honour every rule from §3.2 (cross-parent refusal, rect translation to group-local, group-local back to parent-local on ungroup, Selection update).

### 7.6 Multi-target broadcast

`STYLE_APPLIED`, `STYLE_DETACHED`, and `EFFECTS_CHANGED` all support multi-target operation:
- `STYLE_APPLIED` / `STYLE_DETACHED` take `selectionIds` (an array).
- `EFFECTS_CHANGED` takes a single `elementId`; for multi-target, the shell dispatches one action per id and batches them into a single Change Record group (linked by `batchId`).

This satisfies gap L6 from [22_mvp_coherence_audit.md](22_mvp_coherence_audit.md) §5.1.

## 8. Change Record kinds (new)

Append to [09_glossary.md](09_glossary.md) §5.6:

- Styles: `style_added`, `style_edited`, `style_removed`, `style_applied`, `style_detached`.
- Grouping: `elements_grouped`, `elements_ungrouped`.
- Shapes: `rectangle_added`, `ellipse_added`, `line_added`, `image_placeholder_added` (subsumed by `component_added` if preferred; v1 may emit either — the more specific kind aids audit clarity).
- Effects: `effects_changed` (any field on `effects`), `shadow_added`, `shadow_removed`.

## 8. Build phase impact

Per-phase adjustments to [10_build_phases.md](10_build_phases.md):

| Phase | Addition |
| --- | --- |
| **Phase 1** (Core schema + util) | Add `effects.ts`, extend `library.ts` with `StyleLibraryEntry`, extend `component.ts` / `container.ts` with new archetypes (`rectangle`, `ellipse`, `line`, `image-placeholder`, `container-group`). |
| **Phase 5** (Toolkit) | Add Rectangle Tool, Ellipse Tool, Line Tool. Swap Resize shortcut from `r` to `s`. Add Ctrl/Cmd + G grouping handler to ShellRoot's key handler. |
| **Phase 6** (Libraries) | Add `StyleLibraryView.tsx`, `applyStyle.ts`. Extend libraries.json defaults with Styles + shape Components + Group container + shadow Tokens. |
| **Phase 7** (Straw subject) | Use Style Library on the bundled Frames (e.g. apply `style-card-vibrancy` to layer cards). Group affordances inside common rows (e.g. footer-action-row's buttons grouped). |
| **Phase 8** (Validation) | Add §4.7 → §4.11 new rule sub-sections per §5.4 above + grouping rules (`group.empty.warning`, `group.cycle.blocker`, `group.depth-excessive.warning`) + style rule (`library.unresolved-style-ref`). |
| **Phase 9** (Editing) | Implement `ELEMENTS_GROUP`, `ELEMENTS_UNGROUP` reducer cases; `style_applied`, `style_detached` Change Records. |
| **Phase 11** (Inspector) | Add Style section + Effects section + per-shape archetype editors. |

Estimated total build-time addition: ~6 hours of agent work.

## 9. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Style Library tab visible | Open workbench; Library Panel has 5 tabs (Components, Colours, Icons, Tokens, Styles). |
| 2 | Apply Style end-to-end | Drag `style-panel-primary` onto a Container; fill / border / effects update. |
| 3 | Style edit propagates | Edit `style-panel-primary` fill colour; every Container using it updates live. |
| 4 | Detach Style | Detach a Container's Style; styleRef cleared; rendering identical (literal values preserved). |
| 5 | Style remove with refs | Remove a Style with active refs; confirm dialog lists references; "remove anyway" produces `library.unresolved-style-ref` warning. |
| 6 | Group 2 elements | Select 2; press Ctrl+G; new `container-group` wraps them; Selection becomes the group. |
| 7 | Ungroup | Select group; press Ctrl+Shift+G; children lift; group removed. |
| 8 | Group cross-parent refused | Select elements from two parents; Ctrl+G shows Toast "Cannot group elements with different parents." |
| 9 | Click cascade | Click a child of a group; group selected, not child. |
| 10 | Double-click drill-in | Double-click group; edit-inside mode active; click selects the child. |
| 11 | Esc exits drill-in | Press Esc while in edit-inside; mode exits. |
| 12 | Shift-click bypass | Shift-click child of a group; child selected directly. |
| 13 | Rectangle Tool | Press `r`; drag; new `rectangle` Component drawn. |
| 14 | Resize Tool moved to `s` | Press `s`; Resize Tool active. |
| 15 | Ellipse Tool + Shift | Press `o`; Shift+drag; circle constrained to 1:1. |
| 16 | Line Tool free-angle | Press `l`; drag at 30°; line drawn at 30°. |
| 17 | Line Tool Shift 15° snap | Hold Shift while dragging; angle snaps to 15° increments. |
| 18 | Image placeholder | Drag `component-image-placeholder` from Library; renders with alt text and chosen placeholder style. |
| 19 | Shadow application | Add a shadow via Inspector; element renders with CSS box-shadow. |
| 20 | Multiple stacked shadows | Add 2 shadows; both render. |
| 21 | Blur | Set blur 8 px; CSS filter blur applies. |
| 22 | Opacity | Set opacity 0.5; element renders at 50 %. |
| 23 | Shadow with no colour | Add a shadow; clear colour; `effects.shadow-no-colour.warning` finding appears. |
| 24 | Opacity out of range | Set opacity 1.5 (via direct schema edit); `effects.opacity-out-of-range.error` finding appears. |
| 25 | Shadow token | Apply `shadow.md` token to an element; shadow renders. |
| 26 | Round-trip with Styles + Groups + Effects | Export, re-import; identical Frame layout and validation result. |

## 10. Migration

For any existing v1 package that does not have a `styles` library entry in `libraries.json`:

- On load, default `styles` to `[]`. No findings.
- Save round-trips the empty array.

For elements without `effects` field: treat as `effects: undefined`. No rendering change. No findings.

For existing packages without `container-group`: no migration needed.

This addition is fully backward-compatible with packages authored before §1–§9 land.
