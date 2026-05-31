# v1 Component & Container Archetype Reference

## 1. Goal

Per-archetype specification: TypeScript props interface, default rendering, supported variants and states, default size, applicable validation rules, default intent annotation. Codex uses this doc to render every archetype consistently. An archetype not in this doc is not in v1.

The v1 archetype set is chosen exactly to express the GeoSee editor sidebar (see [06_straw_subject.md](06_straw_subject.md)). Additional archetypes are a v2 expansion.

## 2. Naming and structure

Every archetype is a string id (kebab-case). Components and Containers share the id namespace.

| Concept | Naming | Example |
| --- | --- | --- |
| Archetype id | kebab-case noun | `pill-button`, `page-list-row` |
| Component instance id | `component-<archetype>-<6-char ulid>` | `component-pill-button-a3f9b1` |
| Container instance id | `container-<archetype>-<6-char ulid>` | `container-page-list-row-c7e201` |
| Props interface | PascalCase `<Archetype>Props` | `PillButtonProps`, `PageListRowProps` |

Props interface lives in `src/core/schema/component.ts` (for Components) or `src/core/schema/container.ts` (for Containers).

## 3. Component archetypes

### 3.1 `pill-button`

Rounded full-radius button used for compact icon + accent actions.

```ts
export interface PillButtonProps {
  archetype: "pill-button";
  label: string;                              // empty allowed but warned by validation
  surface: "dark" | "tinted";                 // chrome variant
  fill?: { hex: string; alpha: number } | { tokenRef: string };
  text?: { hex: string; alpha: number } | { tokenRef: string };
  icon?: { iconLibraryEntryId: string };      // optional leading icon
  onClickAction?: string;                     // free-text action name
}
```

- **Default size:** 80×28 px.
- **Variants:** none (style controlled via `surface` + Swatches).
- **States:** default, hover, active, focus, disabled.
- **Rendering:** rounded full-radius pill, centred text, optional leading 16×16 icon.
- **Default intent:** "Compact rounded action. Used inline within rows or as a quick affordance."
- **Applicable validation rules:** `component.touch-target-min`, `component.button.label-non-empty`, `restricted.locked-property-mutated.blocker`.

### 3.2 `icon-button`

Square icon-only button. Smallest interactive surface.

```ts
export interface IconButtonProps {
  archetype: "icon-button";
  iconLibraryEntryId: string;                 // required
  ariaLabel: string;                          // required for accessibility
  surface: "dark" | "tinted";
  size: 20 | 24 | 28 | 32;                    // px square
  onClickAction?: string;
}
```

- **Default size:** 28×28 px.
- **States:** default, hover, active, focus, disabled.
- **Rendering:** square; icon centred; rounded corners (4 px radius).
- **Default intent:** "Single-glyph action. Used for reorder, hide/show, add, delete, re-snapshot, and similar row-level controls."
- **Applicable validation rules:** `component.touch-target-min`, `restricted.locked-property-mutated.blocker`.

### 3.3 `footer-action-button`

Larger icon button used in panel footers (Add / Duplicate / Reset / Delete row).

```ts
export interface FooterActionButtonProps {
  archetype: "footer-action-button";
  iconLibraryEntryId: string;
  ariaLabel: string;
  destructive?: boolean;                      // gates a confirm step in real apps
  disabled?: boolean;
  onClickAction?: string;
}
```

- **Default size:** 32×32 px.
- **States:** default, hover, active, focus, disabled.
- **Rendering:** square 32×32, rounded 6 px, icon 20×20 centred.
- **Default intent:** "Panel-footer action. Larger than `icon-button` because it sits outside the row chrome."
- **Applicable validation rules:** `component.touch-target-min`, `restricted.locked-property-mutated.blocker`.

### 3.4 `inline-editable-text`

Static text that becomes a single-line input on click.

```ts
export interface InlineEditableTextProps {
  archetype: "inline-editable-text";
  value: string;
  fontSize: number | { tokenRef: string };
  fontFamily?: string | { tokenRef: string };
  colour?: { hex: string; alpha: number } | { tokenRef: string };
  maxLength?: number;
  onCommitAction?: string;
  truncate?: boolean;                         // truncate with ellipsis when overflowing
}
```

- **Default size:** 160×20 px.
- **States:** default, hover, focus (editing), disabled.
- **Rendering:** plain text by default; focus state renders a bordered input.
- **Default intent:** "Renames a thing inline. Click to edit; blur or Enter to commit."
- **Applicable rules:** `component.text.font-size-min`, `component.text.font-size-suggested`.

### 3.5 `dirty-dot`

Small filled circle indicating unsaved state.

```ts
export interface DirtyDotProps {
  archetype: "dirty-dot";
  size: 6 | 8 | 10;
  fill?: { hex: string; alpha: number } | { tokenRef: string };
  visible: boolean;
}
```

- **Default size:** 8×8 px.
- **States:** default.
- **Rendering:** full-radius filled circle.
- **Default intent:** "Indicates the element it sits next to has unsaved changes."

### 3.6 `letter-glyph`

Single-character text cue (e.g. the `F` for `cameraObjectFocus`).

```ts
export interface LetterGlyphProps {
  archetype: "letter-glyph";
  letter: string;                             // single character; validation forbids longer
  fontSize: number | { tokenRef: string };
  fontFamily?: string | { tokenRef: string };
  colour?: { hex: string; alpha: number } | { tokenRef: string };
}
```

- **Default size:** 12×12 px.
- **Default intent:** "Single-letter glyph cue. Used as a compact status indicator alongside row chrome."

### 3.7 `numeric-label`

Padded numeric display with role-aware formatting.

```ts
export interface NumericLabelProps {
  archetype: "numeric-label";
  value: string;                              // pre-formatted (the package author decides format)
  fontSize: number | { tokenRef: string };
  colour?: { hex: string; alpha: number } | { tokenRef: string };
  trailingSeparator?: "." | " " | "";
}
```

- **Default size:** 40×16 px.
- **Default intent:** "Page or row number label, e.g. `05.` or `05.1.00`. The package author formats the value; the component does not compute it."

### 3.8 `colour-swatch`

A small colour circle that opens a native `<input type="color">` on click.

```ts
export interface ColourSwatchProps {
  archetype: "colour-swatch";
  size: 12 | 16 | 20 | 24;
  currentColour: { hex: string; alpha: number } | { tokenRef: string };
  onChangeAction?: string;
}
```

- **Default size:** 16×16 px.
- **Default intent:** "Inline colour pick. Click opens the native colour picker; on change, dispatches the bound action."

### 3.9 `slider`

Range input with label and value readout.

```ts
export interface SliderProps {
  archetype: "slider";
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;                              // e.g. "px", "ms", "%"
  showValueLabel: boolean;
  onChangeAction?: string;
  onCommitAction?: string;
}
```

- **Default size:** 200×20 px.
- **Default intent:** "Numeric range input. `onChangeAction` fires during drag; `onCommitAction` fires on release."

### 3.10 `numeric-input`

Plain numeric input field.

```ts
export interface NumericInputProps {
  archetype: "numeric-input";
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  unit?: string;
  onChangeAction?: string;
}
```

- **Default size:** 80×24 px.

### 3.11 `select-dropdown`

Native select.

```ts
export interface SelectDropdownProps {
  archetype: "select-dropdown";
  label?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  placeholder?: string;
  onChangeAction?: string;
}
```

- **Default size:** 160×24 px.

### 3.12 `checkbox`

Boolean toggle.

```ts
export interface CheckboxProps {
  archetype: "checkbox";
  label?: string;
  checked: boolean;
  indeterminate?: boolean;
  onChangeAction?: string;
}
```

- **Default size:** 16×16 px (plus label width).

### 3.13 `native-details`

Uncontrolled HTML `<details>` disclosure. The schema notes that the open state is browser-managed (not stored in the package).

```ts
export interface NativeDetailsProps {
  archetype: "native-details";
  summaryLabel: string;
  defaultOpen: boolean;
  contents: string[];                         // ids of child Components / Containers
}
```

- **Default size:** 200×24 px (closed); auto height when open.

### 3.14 `aria-expanded-row`

Controlled disclosure via `aria-expanded`. Distinct from `native-details` because the open state is stored externally and the chrome is custom.

```ts
export interface AriaExpandedRowProps {
  archetype: "aria-expanded-row";
  summaryLabel: string;
  isExpanded: boolean;
  contents: string[];                         // ids of child Components / Containers
  onToggleAction?: string;
}
```

- **Default size:** 200×24 px.

### 3.15 `divider`

Horizontal or vertical line.

```ts
export interface DividerProps {
  archetype: "divider";
  orientation: "horizontal" | "vertical";
  thickness: number;                          // px; default 1
  colour?: { hex: string; alpha: number } | { tokenRef: string };
  length?: number;                            // px; if null, divider stretches via constraints
}
```

- **Default size:** 200×1 px (horizontal) or 1×200 px (vertical).

### 3.16 `icon`

A standalone icon as a component (vs `icon-button` which adds click + label).

```ts
export interface IconProps {
  archetype: "icon";
  iconLibraryEntryId: string;
  size: number;                               // px square
  colour?: { hex: string; alpha: number } | { tokenRef: string };
}
```

### 3.17 `text`

Plain text block.

```ts
export interface TextProps {
  archetype: "text";
  value: string;
  fontSize: number | { tokenRef: string };
  fontFamily?: string | { tokenRef: string };
  fontWeight?: 400 | 500 | 600 | 700;
  colour?: { hex: string; alpha: number } | { tokenRef: string };
  alignment?: "left" | "centre" | "right";
  truncate?: boolean;
}
```

### 3.18 `rectangle` (see [20_materials_and_shapes.md](20_materials_and_shapes.md) §4.1)

Lightweight rectangle as a leaf Component. Distinct from a structural Container — has no children.

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

- **Default size:** 120×80 px.
- **States:** default.
- **Rendering:** `<div class="rectangle" />` with CSS background / border / box-shadow / opacity per resolved properties.
- **Default intent:** "Decorative or structural rectangle. Has no children; use a Container for layout grouping."
- **Applicable rules:** `effects.shadow-no-colour.warning`, `effects.opacity-out-of-range.error`, `library.unresolved-style-ref`.

### 3.19 `ellipse` (see [20_materials_and_shapes.md](20_materials_and_shapes.md) §4.2)

Circle or oval primitive.

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

- **Default size:** 80×80 px (circle).
- **Rendering:** `<div class="ellipse" />` with `border-radius: 50%`; or `<svg><ellipse/></svg>` if effects require SVG filters.
- **Default intent:** "Circle or oval primitive."

### 3.20 `line` (see [20_materials_and_shapes.md](20_materials_and_shapes.md) §4.3)

Free-angle line segment.

```ts
export interface LineProps {
  archetype: "line";
  start: { x: number; y: number };     // Frame space
  end: { x: number; y: number };       // Frame space
  thickness: number;
  colour?: { hex: string; alpha: number } | { tokenRef: string };
  endCap?: "butt" | "round" | "square";
  effects?: Effects;
}
```

- **Default size:** the bounding rect computed from `start` / `end`; the Component's `rect` is derived from them.
- **Rendering:** `<svg><line x1 y1 x2 y2 stroke stroke-width stroke-linecap /></svg>`.
- **Default intent:** "Free-angle line segment. Distinct from `divider`, which is row chrome."

### 3.21 `image-placeholder` (see [20_materials_and_shapes.md](20_materials_and_shapes.md) §4.4)

Image content placeholder for downstream agents.

```ts
export interface ImagePlaceholderProps {
  archetype: "image-placeholder";
  altText?: string;
  aspectRatio?: number;
  placeholderStyle: "checkerboard" | "diagonal-stripes" | "labeled-box";
}
```

- **Default size:** 200×150 px.
- **Rendering:** a labelled box with the chosen placeholder fill (checkerboard / diagonal stripes / plain box with alt-text label).
- **Default intent:** "Image content placeholder. Final image sourced by the implementing agent at build time."

## 4. Container archetypes

Containers carry the same `Container` schema (see [07_package_format.md](07_package_format.md) §5) with the archetype id determining the chrome variant and the expected children.

### 4.1 `page-list-row`

Standard page row chrome.

```ts
export interface PageListRowExtras {
  archetype: "page-list-row";
  role: "global-child";
  accentSwatchId?: string;
}
```

- **Default size:** 280×32 px.
- **Children:** typically a `dirty-dot`, a `numeric-label`, an `inline-editable-text`, a `colour-swatch`, two `icon-button` (up/down), one `icon-button` (hide/show).
- **Constraints default:** horizontal `stretch`, vertical `left`.
- **Default intent:** "One page in the page list. Click selects; up/down reorder; hide/show toggles visibility."

### 4.2 `page-list-row-sub-master`

Variant of `page-list-row` for Sub Master rows (DEC-079).

```ts
export interface PageListRowSubMasterExtras {
  archetype: "page-list-row-sub-master";
  role: "sub-master";
  accentSwatchId: string;                     // required; the group hue
  subMasterOrdinal: number;
}
```

- **Default size:** 280×32 px.
- **Chrome variant:** 4 px solid left border in `accentSwatchId` colour.
- **Children:** as `page-list-row` plus a `+` `icon-button` (add child) and a `↻` `icon-button` (re-snapshot).
- **Default intent:** "A Sub Master page heading a contiguous group. The group hue, the left-border chrome, and the `+`/`↻` affordances distinguish it from a Global child row."

### 4.3 `page-list-row-sub-master-child`

Variant of `page-list-row` for children of a Sub Master.

```ts
export interface PageListRowSubMasterChildExtras {
  archetype: "page-list-row-sub-master-child";
  role: "sub-master-child";
  accentSwatchId: string;                     // inherited from parent
  parentMasterRowId: string;
}
```

- **Default size:** 268×32 px (12 px less wide due to indent).
- **Chrome variant:** 12 px left indent; shares parent's hue.
- **Default intent:** "A child of a Sub Master. Inherits the parent's hue and is indented to read as nested."

### 4.4 `pseudo-page-bar`

The Global Settings bar — a dark glass row that is not a real persisted page.

```ts
export interface PseudoPageBarExtras {
  archetype: "pseudo-page-bar";
  role: "global-settings";
}
```

- **Default size:** 280×32 px.
- **Chrome:** dark glass background (`swatch-global-settings`).
- **Children:** `dirty-dot`, `numeric-label` ("00."), `text` ("Global Settings"), `+` `icon-button` (add Sub Master).

### 4.5 `layer-card`

The card around a single layer's controls.

```ts
export interface LayerCardExtras {
  archetype: "layer-card";
  collapsedByDefault: boolean;
  layerKindHint?: string;                     // free-form label like "MT", "seismic", "topo"
}
```

- **Default size:** 280×120 px.

### 4.6 `layer-subsection`

A subgrouping inside a layer card (Appearance / Labels / Provenance etc.).

```ts
export interface LayerSubsectionExtras {
  archetype: "layer-subsection";
  summary: string;
  defaultOpen: boolean;
  disclosureKind: "native-details" | "aria-expanded";
}
```

- **Default size:** 280×80 px.

### 4.7 `scene-section-frame-container`

Per-axis section frame controls (DEC-053 / DEC-070 / DEC-078).

```ts
export interface SceneSectionFrameContainerExtras {
  archetype: "scene-section-frame-container";
  axis: "x" | "y" | "z";
}
```

- **Default size:** 280×140 px.

### 4.8 `camera-studio-subcontainer`

A subgrouping inside Camera Studio (Focus transition, Perspective, Vignette, Image finish, Glow).

```ts
export interface CameraStudioSubcontainerExtras {
  archetype: "camera-studio-subcontainer";
  sectionKey: "focus-transition" | "perspective" | "vignette" | "image-finish" | "glow";
}
```

- **Default size:** 280×80 px.

### 4.9 `footer-action-row`

A horizontal row of `footer-action-button` Components beneath a panel.

```ts
export interface FooterActionRowExtras {
  archetype: "footer-action-row";
  alignment: "left" | "centre" | "right";
}
```

- **Default size:** 280×40 px.

### 4.10 `cinematic-render-preset`

The Cinematic Render Preset container (moved into Camera Studio per DEC-080).

```ts
export interface CinematicRenderPresetExtras {
  archetype: "cinematic-render-preset";
}
```

- **Default size:** 280×60 px.

### 4.11 `container-group` (see [20_materials_and_shapes.md](20_materials_and_shapes.md) §3.1)

Layout grouping wrapper produced by Group action (Ctrl/Cmd+G). No visual chrome by default; pure structural grouping.

```ts
export interface ContainerGroupExtras {
  archetype: "container-group";
  groupName?: string;                  // human-readable group label
  collapseInLayersPanel: boolean;
}
```

- **Default size:** auto — computed as the union rect of the grouped Selection.
- **Default fill / border / effects:** none.
- **Default intent:** "A layout grouping wrapper. Holds elements that move together."
- **Applicable rules:** `group.empty.warning`, `group.cycle.blocker`, `group.depth-excessive.warning`.

## 5. Variants vs. props

`variant` (Component-level) is a named state-shape preset. Most archetypes use props directly rather than declared variants. The `pill-button`'s `surface: "dark" | "tinted"` is a props-level variant.

When a future archetype needs more elaborate variants, declare them in `componentLibraryEntry.archetypeVariants` (deferred to v2 — v1 uses props only).

## 6. States

States are: `default`, `hover`, `active`, `focus`, `disabled`. The workbench renders elements in their declared state (Properties Inspector lets the author pick). Validation rule `component.disabled-state-defined` (Info) suggests authoring the disabled state where archetypes support `disabled`.

## 7. Default rendering reference

Codex renders each archetype using minimal CSS + the active Token Library. Reference DOM patterns:

| Archetype | DOM pattern |
| --- | --- |
| `pill-button` | `<button class="pill"><span>{label}</span></button>` |
| `icon-button` | `<button class="icon-btn" aria-label={ariaLabel}><svg>{icon}</svg></button>` |
| `footer-action-button` | Same as `icon-button` with larger sizing. |
| `inline-editable-text` | `<span>{value}</span>` swapped to `<input type="text">` on focus. |
| `dirty-dot` | `<span class="dot" />` |
| `letter-glyph` | `<span class="glyph">{letter}</span>` |
| `numeric-label` | `<span class="numeric">{value}{trailingSeparator}</span>` |
| `colour-swatch` | `<label class="swatch"><input type="color" /></label>` |
| `slider` | `<label>{label} <input type="range" /> <span>{value}{unit}</span></label>` |
| `numeric-input` | `<label>{label} <input type="number" /></label>` |
| `select-dropdown` | `<label>{label} <select>{options.map(...)}</select></label>` |
| `checkbox` | `<label><input type="checkbox" />{label}</label>` |
| `native-details` | `<details open={defaultOpen}><summary>{summaryLabel}</summary>{contents}</details>` |
| `aria-expanded-row` | `<div><button aria-expanded={isExpanded}>{summaryLabel}</button>{isExpanded && contents}</div>` |
| `divider` | `<hr class={orientation} />` |
| `icon` | `<svg viewBox={viewBox}><path d={svgPath} /></svg>` |
| `text` | `<span style={...}>{value}</span>` |

All DOM examples use plain HTML. The workbench wraps each in a React component named `<{Archetype}/>` exported from `src/shell/canvas/elements/{archetype}.tsx`.

## 8. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Every Component archetype has a props interface | grep `src/core/schema/component.ts` for each `*Props` name listed in §3. |
| 2 | Every Container archetype has a props extras interface | grep `src/core/schema/container.ts`. |
| 3 | Each archetype renders in the workbench | Drag from Library Panel; new element appears with default size + default rendering. |
| 4 | Each archetype has a default intent | Hover the entry in Library Panel; tooltip shows the intent from this doc. |
| 5 | Validation rules apply per archetype | `runValidation` on a package containing each archetype produces findings of the expected rule ids. |
| 6 | All 24 archetypes round-trip | Export and re-import a package containing one of each archetype; byte-identical after canonicalisation. |
| 7 | Discriminated union is exhaustive | `applyEdit` and renderer use `switch` on `archetype` that the TypeScript compiler proves exhaustive (no fallthrough). |
