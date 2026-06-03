# v1 Libraries

> Current status: catalog reference only. Use this for reusable kind/style/token
> vocabulary when it helps the standalone editor. Ignore package schema,
> validation, export, and autonomous-agent language in this file.

## 1. Goal

Provide four kinds of reusable content the author draws from while editing a Frame: Components, Colours, Icons, Tokens. Each is presented in the Library Panel; each has a schema in the GUI Package; each supports drag / click instantiation onto the active Frame or Selection.

## 2. Library kinds

| Kind | What it contains | How the author uses it |
| --- | --- | --- |
| **Component Library** | Reusable Components (button, slider, toggle, text input, etc.) and Container Archetypes (page-row, layer card, footer action row, etc.). | Drag onto Canvas to instantiate; the new Component / Container is added to the active Frame at the drop point. |
| **Colour Library** | Named Swatches with hex + alpha + rationale. | Drag onto an element to set its fill; or activate Colour Tool and click a Swatch to apply to Selection. |
| **Icon Library** | Small SVG glyphs. | Drag onto Canvas to instantiate as an Icon Component. |
| **Token Library** | Design Tokens: spacing scale, border radii, font sizes, font families, animation durations, shadows. | Apply to Selection (e.g. "apply token `space.md` to padding-x"); Properties Inspector also surfaces tokens as suggested values. |
| **Style Library** | Reusable Materials — saved fill + border + effects + padding as a named Style. | Drag onto an element to apply; or pick from the Inspector's Style dropdown. See [20_materials_and_shapes.md](20_materials_and_shapes.md) §2. |

## 3. Library Panel layout

`src/shell/libraryPanel/LibraryPanel.tsx` shows a tabbed pane with four tabs (one per Library kind). The active tab's contents are rendered by the corresponding view component:

- `ComponentLibraryView.tsx`
- `ColourLibraryView.tsx`
- `IconLibraryView.tsx`
- `TokenLibraryView.tsx`

Each view supports:

- **Search filter** (case-insensitive substring match on entry name).
- **Drag source** (HTML5 drag-and-drop, dataTransfer payload = `{ libraryKind, entryId }`).
- **Click-to-apply** (where applicable — Swatches, Tokens).
- **Add / remove entry** (footer buttons; deletion requires confirm).

## 4. Schemas

`src/core/schema/library.ts`:

```ts
export type LibraryKind = "components" | "colours" | "icons" | "tokens";

export interface ComponentLibraryEntry {
  id: string;                        // kebab-case, unique within the library
  name: string;                      // human-readable
  kind: "component" | "container";   // component = leaf; container = group
  archetype: string;                 // ComponentArchetype or ContainerArchetype id
  defaultProps: Record<string, unknown>;
  defaultSize: { w: number; h: number };
  rationale?: string;
  thumbnail?: string;                // optional relative path inside the package
}

export interface ColourLibraryEntry {
  id: string;
  name: string;
  hex: string;                       // "#RRGGBB"
  alpha: number;                     // 0.0 – 1.0
  rationale?: string;
  semanticRole?: "fill" | "text" | "divider" | "accent" | "warning" | "error" | "success" | "info";
}

export interface IconLibraryEntry {
  id: string;
  name: string;
  svgPath: string;                   // SVG `d` attribute
  viewBox: string;                   // e.g. "0 0 24 24"
  defaultSize: { w: number; h: number };
  rationale?: string;
}

export type TokenCategory =
  | "spacing"
  | "radius"
  | "font-size"
  | "font-family"
  | "duration"
  | "shadow"
  | "z-index"
  | "padding";          // doc 21 §10.3 — JSON-string values parseable as a Padding object

export interface TokenLibraryEntry {
  id: string;                        // e.g. "space.md", "radius.full", "font.mono"
  name: string;
  category: TokenCategory;
  value: number | string;            // numeric for spacing / size / duration; string for font-family / shadow
  unit?: "px" | "ms" | "rem" | "em" | null;
  rationale?: string;
}

export interface Libraries {
  components: ComponentLibraryEntry[];
  colours: ColourLibraryEntry[];
  icons: IconLibraryEntry[];
  tokens: TokenLibraryEntry[];
  // Style Library — see [20_materials_and_shapes.md](20_materials_and_shapes.md) §2 for the
  // StyleLibraryEntry interface. v1 ships 6 bundled Styles in the straw-subject package.
  styles: StyleLibraryEntry[];
}
```

Persisted as `packages/<id>/libraries.json`.

## 5. Default libraries shipped with the straw-subject package

The `geosee_editor_sidebar` package ships pre-populated libraries that match GeoSee's existing editor sidebar style. v1 phase 6 of [10_build_phases.md](10_build_phases.md) builds these.

### 5.1 Component Library defaults

| Entry id | Kind | Archetype | Default size |
| --- | --- | --- | --- |
| `component-pill-button` | component | `pill-button` | 80×28 |
| `component-icon-button` | component | `icon-button` | 28×28 |
| `component-footer-action-button` | component | `footer-action-button` | 32×32 |
| `component-inline-editable-text` | component | `inline-editable-text` | 160×20 |
| `component-dirty-dot` | component | `dirty-dot` | 8×8 |
| `component-letter-glyph` | component | `letter-glyph` | 12×12 |
| `component-numeric-label` | component | `numeric-label` | 40×16 |
| `component-colour-swatch` | component | `colour-swatch` | 16×16 |
| `component-slider` | component | `slider` | 200×20 |
| `component-numeric-input` | component | `numeric-input` | 80×24 |
| `component-select-dropdown` | component | `select-dropdown` | 160×24 |
| `component-checkbox` | component | `checkbox` | 16×16 |
| `component-native-disclosure` | component | `native-details` | 200×24 |
| `component-controlled-disclosure` | component | `aria-expanded-row` | 200×24 |
| `container-page-row` | container | `page-list-row` | 280×32 |
| `container-page-row-sub-master` | container | `page-list-row-sub-master` | 280×32 |
| `container-page-row-sub-master-child` | container | `page-list-row-sub-master-child` | 268×32 |
| `container-pseudo-page-bar` | container | `pseudo-page-bar` | 280×32 |
| `container-layer-card` | container | `layer-card` | 280×120 |
| `container-layer-subsection` | container | `layer-subsection` | 280×80 |
| `container-scene-section-frame` | container | `scene-section-frame-container` | 280×140 |
| `container-camera-subcontainer` | container | `camera-studio-subcontainer` | 280×80 |
| `container-footer-action-row` | container | `footer-action-row` | 280×40 |
| `container-cinematic-render-preset` | container | `cinematic-render-preset` | 280×60 |

### 5.2 Colour Library defaults

Captured from `src/editor/styles.ts` in GeoSee at v1 start (values by inspection, not import):

| Swatch id | Name | Hex | Alpha | Semantic role |
| --- | --- | --- | --- | --- |
| `swatch-page-accent-pink` | Page accent pink | `#facdc d` | 0.496 | accent |
| `swatch-page-accent-blue` | Page accent blue | `#bcdbfa` | 0.496 | accent |
| `swatch-page-accent-teal` | Page accent teal | `#c5e4cd` | 0.496 | accent |
| `swatch-page-accent-yellow` | Page accent yellow | `#f8e2ae` | 0.496 | accent |
| `swatch-page-accent-purple` | Page accent purple | `#daccf7` | 0.496 | accent |
| `swatch-page-accent-orange` | Page accent orange | `#f6cab5` | 0.496 | accent |
| `swatch-sub-master-teal` | Sub Master teal | `#78b4c8` | 0.496 | accent |
| `swatch-sub-master-magenta` | Sub Master magenta | `#c482b4` | 0.496 | accent |
| `swatch-sub-master-amber` | Sub Master amber | `#d4a860` | 0.496 | accent |
| `swatch-sub-master-lime` | Sub Master lime | `#a8c66e` | 0.496 | accent |
| `swatch-sub-master-indigo` | Sub Master indigo | `#8e90c8` | 0.496 | accent |
| `swatch-sub-master-coral` | Sub Master coral | `#dc8e74` | 0.496 | accent |
| `swatch-global-settings` | Global Settings bar | `#121518` | 0.672 | fill |
| `swatch-vibrancy-label` | Vibrancy label | `#f4f0e8` | 1.000 | text |
| `swatch-vibrancy-secondary` | Vibrancy secondary | `#f4f0e8` | 0.720 | text |
| `swatch-vibrancy-tertiary` | Vibrancy tertiary | `#f4f0e8` | 0.460 | text |
| `swatch-editor-field-bg` | Editor field background | `#121518` | 0.400 | fill |
| `swatch-divider-hairline` | Divider hairline | `transparent` | 1.000 | divider |

(Agent note: the first entry's hex shows a typo example only — actual entries must be valid 6-digit hex.)

### 5.3 Icon Library defaults

Small starter set sufficient for the straw subject. Each SVG path uses `viewBox="0 0 24 24"`.

| Icon id | Name | Purpose |
| --- | --- | --- |
| `icon-add` | Add | The `+` glyph; the page list "Add page" button. |
| `icon-trash` | Trash | Delete affordance. |
| `icon-duplicate` | Duplicate | Duplicate affordance. |
| `icon-reset` | Reset | Reset overrides. |
| `icon-eye` | Eye | Visible / show. |
| `icon-eye-off` | Eye off | Hidden / hide. |
| `icon-triangle-up` | Triangle up | Reorder up. |
| `icon-triangle-down` | Triangle down | Reorder down. |
| `icon-refresh` | Refresh | Re-snapshot (`↻`). |
| `icon-camera` | Camera | Camera marker / capture. |
| `icon-focus` | Focus | Camera object focus indicator (`F` glyph alternative). |
| `icon-dot` | Dot | Dirty indicator. |

### 5.4 Token Library defaults

Captured from `src/editor/styles.ts` and GeoSee conventions:

| Token id | Category | Value | Unit |
| --- | --- | --- | --- |
| `space.xs` | spacing | 4 | px |
| `space.sm` | spacing | 8 | px |
| `space.md` | spacing | 12 | px |
| `space.lg` | spacing | 18 | px |
| `space.xl` | spacing | 24 | px |
| `space.section-margin-x` | spacing | 12 | px |
| `space.section-gap-y` | spacing | 10 | px |
| `space.page-list-indent-x` | spacing | 18 | px |
| `space.sub-master-child-indent` | spacing | 12 | px |
| `space.sub-master-border-width` | spacing | 4 | px |
| `radius.sm` | radius | 4 | px |
| `radius.md` | radius | 8 | px |
| `radius.lg` | radius | 12 | px |
| `radius.full` | radius | 999 | px |
| `font.body-size` | font-size | 13 | px |
| `font.label-size` | font-size | 12 | px |
| `font.small-size` | font-size | 11 | px |
| `font.mono` | font-family | `"SFMono-Regular", Consolas, "Liberation Mono", monospace` | null |

## 6. Instantiation rules

### 6.1 Component / Container instantiation

Two paths exist for putting a Component on a Frame:

1. **Library drag** — author drags a Library entry onto the Canvas. Calls `instantiateComponent` (below), which reads the entry's `defaultProps` and `defaultSize` and adds a new Component with the corresponding archetype id.
2. **Toolkit creation** — the Container Tool, Text Tool, and Divider Tool create Components with archetype ids `container-blank`, `text`, and `divider` respectively. These do NOT require a matching Library entry; the archetype id is first-class in the schema (see [14_component_archetype_reference.md](14_component_archetype_reference.md) §3 for the canonical list of all valid archetype ids).

Both paths produce a Change Record (`component_added` or `container_added`).

`src/core/libraries/instantiateComponent.ts`:

```ts
export function instantiateComponent(
  entry: ComponentLibraryEntry,
  dropPointFrameSpace: { x: number; y: number },
  parentContainerId: string | null,           // null = direct child of Frame
  pkg: Package,
): { nextPkg: Package; newId: string };
```

- Generates a fresh kebab-case id (`component-<archetype>-<uid>` or `container-<archetype>-<uid>`).
- Places the new element with `defaultSize` at `dropPointFrameSpace`.
- If `parentContainerId` is set, appends to that Container's children; otherwise adds to the Frame's root.
- Returns the new Package + the new element's id (for auto-Selection).

### 6.2 Swatch application

`src/core/libraries/applySwatch.ts`:

```ts
export function applySwatch(
  selection: SelectionIds,
  swatchId: string,
  targetProperty: "fill" | "text" | "border" | "divider",
  pkg: Package,
): Package;
```

Writes the Swatch's `hex` and `alpha` to the specified property on every element in `selection`. Multi-target safe.

### 6.3 Token application

`src/core/libraries/applyToken.ts`:

```ts
export function applyToken(
  selection: SelectionIds,
  tokenId: string,
  targetProperty: string,            // schema property path, e.g. "padding.x", "border.radius", "font.size"
  pkg: Package,
): Package;
```

- Sets the property to `{ tokenRef: tokenId }` rather than the literal value.
- The renderer resolves token refs at render time.
- Validation findings can flag stale token refs (token id no longer exists in the package).

### 6.4 Library merge

When a package imports an external library (deferred to v2), `libraryMerge.ts` will reconcile entries by id. v1 ships only single-package libraries; `libraryMerge.ts` exports a stub that throws if invoked.

## 7. Library mutation

Authors may modify libraries via the Library Panel:

- **Add entry** — for Components / Containers / Icons, requires authoring the entry inline (id, name, archetype, default size). For Swatches and Tokens, a simple add form.
- **Edit entry** — click an entry to open its edit form. Editing an entry that is referenced by elements in the package updates those elements live (token-by-reference) for Tokens and Swatches with `tokenRef`; literal references are not updated.
- **Remove entry** — requires confirm. If the entry is referenced by any element, the confirm dialog lists the references and offers "remove anyway" (creates `validation_warning_unresolved_token_ref` findings) or "cancel".

All mutations dispatch through the editing pipeline and produce a Change Record (`library_entry_added`, `library_entry_edited`, `library_entry_removed`).

## 8. Acceptance criteria for the Libraries phase

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Library Panel renders 4 tabs | Open workbench; Library Panel shows Components / Colours / Icons / Tokens. |
| 2 | All 4 default libraries populated | Each tab shows ≥1 entry from the bundled straw-subject package. |
| 3 | Component drag instantiates | Drag `component-pill-button` from the Component tab onto an empty Frame; new Component appears at drop point; auto-selected. |
| 4 | Container drag instantiates | Drag `container-page-row` onto Frame; new Container appears; appears in Layers Panel. |
| 5 | Swatch click applies to Selection | Select an element; click Colour tab; click a Swatch; element's fill updates. |
| 6 | Swatch drag-onto applies | Drag a Swatch from the Colour tab onto a Container on the Canvas; that Container's fill updates. |
| 7 | Icon drag instantiates as Icon Component | Drag `icon-add` onto Canvas; an Icon Component appears with the `+` glyph rendered. |
| 8 | Token apply via Inspector | Select element; in Properties Inspector, click the "padding-x" field; pick `space.md`; padding updates and stores `{ tokenRef: "space.md" }`. |
| 9 | Token edit propagates | Change `space.md` from 12 to 16 in the Token Library Panel; any element using `{ tokenRef: "space.md" }` updates its padding-x to 16 px. |
| 10 | Library entry add | Use Library Panel footer to add a new Swatch; new Swatch appears and is persistable. |
| 11 | Library entry remove with references | Try to remove a Swatch that is in use; confirm dialog lists references; "remove anyway" produces a `library.unresolved-token-ref` warning. |
| 12 | Library search filters | Type in the Library Panel search box; entries filter case-insensitively. |
