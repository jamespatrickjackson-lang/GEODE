# v1 Interactive Overlays and Primitives

## 1. Goal

Close the remaining "this is supposed to be Figma-lite but" gaps by adding the interactive overlay components and refined button states that real app surfaces require. Specifically:

| Capability | What it gives the author |
| --- | --- |
| **Per-side padding** | `padding.top` / `padding.right` / `padding.bottom` / `padding.left` distinct, instead of uniform x/y only. Matches Figma + CSS conventions. |
| **Tooltip** | A small bordered popover that the author can place on a Frame to represent "tooltip appears here in the host app." |
| **Modal** (overlay + content) | A backdrop Container + a centred dialog Container for representing modal-dialog surfaces. |
| **Tabs** (container + triggers + content) | A tabbed interface primitive: a row of tab triggers + a content panel per tab. |
| **Dropdown menu** (rich) | Beyond native `<select>` — a popover Container with menu items, dividers, optional icons / descriptions. |
| **Carousel** (container + slides + indicators) | Horizontal slide container + per-slide Containers + a dot indicator row Component. |
| **Toggle button** | Pressed / unpressed state distinct from default / active. |
| **Segmented control** | A row of mutually-exclusive toggle buttons (radio-group semantics). |
| **Loading button state** | `isLoading` prop on the three existing button archetypes (pill / icon / footer-action). When true, button renders a spinner and ignores clicks. |

These are scope additions to v1. Affected: [04_toolkit.md](04_toolkit.md), [05_libraries.md](05_libraries.md), [07_package_format.md](07_package_format.md), [08_validation_rules.md](08_validation_rules.md), [09_glossary.md](09_glossary.md), [10_build_phases.md](10_build_phases.md), [14_component_archetype_reference.md](14_component_archetype_reference.md), [19_known_pitfalls.md](19_known_pitfalls.md). This doc is the single-source-of-truth; doc patches reference back here.

## 2. Per-side padding

### 2.1 Schema change

Update `Container.padding` and `StyleLibraryEntry.padding` to support per-side overrides with uniform shorthand:

```ts
export interface Padding {
  // Uniform shorthand. If set, applies to both axes unless overridden per-side.
  x?: number | { tokenRef: string };
  y?: number | { tokenRef: string };
  // Per-side overrides. If set for a side, takes precedence over x/y for that
  // side. Resolved at render time:
  //   resolvedTop    = padding.top    ?? padding.y ?? 0
  //   resolvedRight  = padding.right  ?? padding.x ?? 0
  //   resolvedBottom = padding.bottom ?? padding.y ?? 0
  //   resolvedLeft   = padding.left   ?? padding.x ?? 0
  top?: number | { tokenRef: string };
  right?: number | { tokenRef: string };
  bottom?: number | { tokenRef: string };
  left?: number | { tokenRef: string };
}
```

Old packages with only `x` / `y` continue to work — backward compatible.

### 2.2 Properties Inspector

The padding editor in the Inspector renders a 4-edge mini-diagram (top / right / bottom / left numeric inputs around a centred box). A "link all" toggle at the centre constrains all four to one value (sets `x` and `y` to the value, clears per-side). When any per-side differs, "link all" auto-disables.

### 2.3 Tokens

Tokens for common padding combos:

| Token id | Value | Use |
| --- | --- | --- |
| `padding.symmetric-md` | `{ x: 12, y: 12 }` | Standard symmetric padding. |
| `padding.compact-row` | `{ x: 8, y: 4 }` | Row chrome (e.g. layer rows). |
| `padding.dialog-body` | `{ x: 24, y: 20 }` | Modal content padding. |
| `padding.tooltip-body` | `{ x: 8, y: 4 }` | Tooltip body padding. |

These are JSON-string-valued tokens in the `padding` category (new TokenCategory — extend [05_libraries.md](05_libraries.md) §4).

## 3. Tooltip

### 3.1 Component archetype

```ts
export interface TooltipProps {
  archetype: "tooltip";
  text: string;
  arrowPosition?: "none" | "top" | "right" | "bottom" | "left";
  fill?: { hex: string; alpha: number } | { tokenRef: string } | { styleRef: string };
  text_colour?: { hex: string; alpha: number } | { tokenRef: string };
  border?: {
    width: number | { tokenRef: string };
    colour: { hex: string; alpha: number } | { tokenRef: string };
    radius?: number | { tokenRef: string };
  };
  padding?: Padding;
  effects?: Effects;
  // Authoring intent: which element does this tooltip describe?
  describesElementId?: string;          // resolves to an element id in same package
}
```

- **Default size:** 140×32 px.
- **Rendering:** small rounded box with optional arrow on chosen side.
- **States:** default. Tooltips have no hover state (they're the tooltip themselves).
- **Default intent:** "Hover hint or contextual explanation. The `describesElementId` carries the relationship for downstream agents."

### 3.2 Validation rule

| Rule id | Severity | Condition | Message |
| --- | --- | --- | --- |
| `tooltip.dangling-reference.warning` | Warning | `describesElementId` set but element not in package | "Tooltip `{id}` describes `{missingId}` which is not in this package." |

## 4. Modal (overlay + content)

Two Container archetypes that compose together. Modal is rare — exists at the Frame scope, not nested within rows — so the schema models it as a top-level Container that takes the whole Frame.

### 4.1 `modal-overlay` Container

```ts
export interface ModalOverlayExtras {
  archetype: "modal-overlay";
  backdrop: {
    fill: { hex: string; alpha: number } | { tokenRef: string };
    blur?: number | { tokenRef: string };
  };
  dismissOnBackdropClick?: boolean;     // default true
}
```

- **Default size:** spans the entire Frame.
- **Children:** typically exactly one `modal-content` Container.
- **Rendering:** semi-opaque fullscreen overlay; centres its child.
- **Default intent:** "Modal backdrop. Click-outside dismisses unless dismissOnBackdropClick is false."

### 4.2 `modal-content` Container

```ts
export interface ModalContentExtras {
  archetype: "modal-content";
  // Optional dialog metadata for downstream AI-agent briefs:
  modalKind?: "alert" | "confirm" | "form" | "info" | "destructive";
  trapFocus?: boolean;                  // default true
  closeAffordance?: "x-button" | "esc-only" | "neither";
}
```

- **Default size:** 480×320 px, centred in the overlay.
- **Children:** any.
- **Rendering:** raised panel with border + shadow.
- **Default intent:** "Modal dialog content. modalKind hints the implementing agent on confirm patterns."

### 4.3 Validation rules

| Rule id | Severity | Condition | Message |
| --- | --- | --- | --- |
| `modal.content-outside-overlay.warning` | Warning | A `modal-content` Container has no `modal-overlay` parent | "Modal content `{id}` is not wrapped in a modal-overlay; backdrop semantics will be lost." |
| `modal.no-close-affordance.suggestion` | Suggestion | `closeAffordance === "neither"` | "Modal `{id}` has no close affordance; ensure dismissal is wired elsewhere." |
| `modal.destructive-no-confirm.suggestion` | Suggestion | `modalKind === "destructive"` and no `confirm` button identified | "Destructive modal `{id}` should require explicit confirmation in the implementing app." |

## 5. Tabs

Three archetypes that compose: a `tabs` Container holds a row of `tab-trigger` Components + a `tab-content` Container per tab.

### 5.1 `tabs` Container

```ts
export interface TabsExtras {
  archetype: "tabs";
  activeTabId: string;                  // references a tab-trigger id
  orientation: "horizontal" | "vertical";
  triggerAlignment?: "start" | "centre" | "end" | "stretch";
}
```

- **Default size:** 320×400 px.
- **Children:** one tab-trigger row container + one tab-content per tab (matched by tab id).
- **Default intent:** "Tabbed interface. Active tab determines which tab-content is visible."

### 5.2 `tab-trigger` Component

```ts
export interface TabTriggerProps {
  archetype: "tab-trigger";
  label: string;
  tabId: string;                        // ties this trigger to a tab-content
  iconLibraryEntryId?: string;
  badge?: string;
  isActive: boolean;                    // derived from parent tabs.activeTabId
}
```

- **Default size:** 100×32 px.
- **Rendering:** button-like; active state shows underline / fill per chrome convention.

### 5.3 `tab-content` Container

```ts
export interface TabContentExtras {
  archetype: "tab-content";
  tabId: string;                        // matches a tab-trigger
}
```

- **Default size:** 320×320 px.
- **Visible iff** parent tabs `activeTabId === tabId`.

### 5.4 Validation rules

| Rule id | Severity | Condition | Message |
| --- | --- | --- | --- |
| `tabs.orphan-trigger.warning` | Warning | A `tab-trigger` has `tabId` matching no `tab-content` in the same `tabs` parent | "Tab trigger `{id}` with tabId `{tabId}` has no matching tab-content." |
| `tabs.orphan-content.warning` | Warning | A `tab-content` has `tabId` matching no `tab-trigger` | "Tab content `{id}` is never reachable; no trigger has tabId `{tabId}`." |
| `tabs.active-tab-missing.error` | Error | `tabs.activeTabId` references no existing trigger | "Tabs `{id}` activeTabId `{tabId}` does not exist." |

## 6. Dropdown menu (rich)

A popover-style menu distinct from `select-dropdown` (which is the native `<select>`). Rich dropdowns are common for action menus, command palettes, context menus.

### 6.1 `dropdown-menu` Container

```ts
export interface DropdownMenuExtras {
  archetype: "dropdown-menu";
  triggerLabel?: string;                // visible label / icon button when collapsed
  anchorPosition: "top" | "right" | "bottom" | "left";
  isOpen: boolean;                      // authored open / closed state for layout preview
  dismissOnOutsideClick?: boolean;
}
```

- **Default size when open:** 200×240 px popover; when closed, the trigger-sized chip.
- **Children:** `menu-item` Components and `menu-divider` Components.
- **Default intent:** "Action menu / command list. The implementing agent wires open/close behaviour."

### 6.2 `menu-item` Component

```ts
export interface MenuItemProps {
  archetype: "menu-item";
  label: string;
  iconLibraryEntryId?: string;
  description?: string;                 // optional secondary text below label
  trailingHint?: string;                // e.g. "Ctrl+S" shortcut hint
  destructive?: boolean;
  disabled?: boolean;
  onClickAction?: string;
}
```

- **Default size:** 180×32 px.

### 6.3 `menu-divider` Component

```ts
export interface MenuDividerProps {
  archetype: "menu-divider";
  // No properties beyond the standard Component base.
}
```

- **Default size:** 180×1 px.

### 6.4 Validation rules

| Rule id | Severity | Condition | Message |
| --- | --- | --- | --- |
| `menu.empty.warning` | Warning | A `dropdown-menu` has no child menu items | "Dropdown menu `{id}` is empty." |
| `menu.consecutive-dividers.suggestion` | Suggestion | Two `menu-divider` Components are siblings with no `menu-item` between them | "Dropdown menu `{id}` has consecutive dividers; one is redundant." |

## 7. Carousel

A horizontal scroll container + per-slide Containers + an indicator row Component.

### 7.1 `carousel` Container

```ts
export interface CarouselExtras {
  archetype: "carousel";
  activeSlideIndex: number;             // 0-based; authored for preview
  autoAdvance?: { intervalMs: number; pauseOnHover?: boolean };
  loop?: boolean;
}
```

- **Default size:** 400×240 px.
- **Children:** N `carousel-slide` Containers + optionally one `carousel-indicators` Component.

### 7.2 `carousel-slide` Container

```ts
export interface CarouselSlideExtras {
  archetype: "carousel-slide";
  slideIndex: number;
}
```

- **Default size:** matches parent carousel.

### 7.3 `carousel-indicators` Component

```ts
export interface CarouselIndicatorsProps {
  archetype: "carousel-indicators";
  count: number;
  activeIndex: number;                  // mirrors parent carousel
  shape: "dot" | "bar" | "number";
  position: "below" | "above" | "overlay-bottom" | "overlay-top";
}
```

- **Default size:** 120×8 px.

### 7.4 Validation rules

| Rule id | Severity | Condition | Message |
| --- | --- | --- | --- |
| `carousel.empty.warning` | Warning | A `carousel` has no `carousel-slide` children | "Carousel `{id}` has no slides." |
| `carousel.active-out-of-range.error` | Error | `activeSlideIndex >= slide count` | "Carousel `{id}` activeSlideIndex `{n}` exceeds slide count." |
| `carousel.indicator-count-mismatch.warning` | Warning | `carousel-indicators.count` differs from actual slide count | "Carousel `{id}` indicators count `{n}` does not match slide count `{m}`." |

## 8. Toggle button + segmented control + loading state

### 8.1 `toggle-button` Component archetype

Distinct from the regular pill/icon/footer-action buttons because it carries a binary pressed state that persists between clicks.

```ts
export interface ToggleButtonProps {
  archetype: "toggle-button";
  label?: string;
  iconLibraryEntryId?: string;
  pressed: boolean;
  surface: "dark" | "tinted";
  size: 24 | 28 | 32;
  onPressedChangeAction?: string;
}
```

- **Default size:** 28×28 px (icon-only) or 80×28 px (with label).
- **States:** default, hover, pressed, focus, disabled.
- **Rendering:** pressed state distinct from active (active = momentary; pressed = persistent).

### 8.2 `segmented-control` Container

```ts
export interface SegmentedControlExtras {
  archetype: "segmented-control";
  activeSegmentId: string;
  orientation: "horizontal" | "vertical";
}
```

- **Default size:** 240×28 px.
- **Children:** N `toggle-button` Components forming a mutually-exclusive radio group.
- **Default intent:** "Mutually-exclusive choice from a small fixed set. Activating one segment deactivates the others."

### 8.3 Loading state on existing buttons

Three existing button archetypes (`pill-button`, `icon-button`, `footer-action-button`) gain an `isLoading` prop:

```ts
// Extend each existing button props interface:
isLoading?: boolean;                    // default false
```

When `isLoading === true`:
- Renders a spinner glyph in place of the icon / label.
- Click events are ignored.
- The button retains its size (no layout shift).
- `disabled` is logically true while loading.

### 8.4 Validation rules

| Rule id | Severity | Condition | Message |
| --- | --- | --- | --- |
| `segmented.empty.warning` | Warning | A `segmented-control` has no toggle-button children | "Segmented control `{id}` has no segments." |
| `segmented.active-missing.error` | Error | `activeSegmentId` references no child toggle-button | "Segmented control `{id}` activeSegmentId `{id}` does not exist." |
| `button.loading-no-aria.suggestion` | Suggestion | A button with `isLoading: true` has no aria-label | "Loading button `{id}` should carry an aria-label so screen readers announce the loading state." |

## 9. Toolkit additions

These archetypes are **Library-instantiated** (drag from Component Library Panel onto Canvas), not Tool-drawn. The Toolkit gets no new Tools for tooltips / modals / tabs / dropdowns / carousels / toggles / segmented. Authors who want one drag from the Library.

The reason: free-drawing a modal or carousel is uncommon. They are mostly placed as units. Free-form shape tools (Rectangle / Ellipse / Line from doc 20) cover the few free-drawing needs.

Rationale documented to prevent agents from inventing tools that aren't needed.

## 10. Library defaults extended

### 10.1 Component Library additions

Append to [05_libraries.md](05_libraries.md) §5.1:

| Entry id | Kind | Archetype | Default size |
| --- | --- | --- | --- |
| `component-tooltip` | component | `tooltip` | 140×32 |
| `component-tab-trigger` | component | `tab-trigger` | 100×32 |
| `component-menu-item` | component | `menu-item` | 180×32 |
| `component-menu-divider` | component | `menu-divider` | 180×1 |
| `component-carousel-indicators` | component | `carousel-indicators` | 120×8 |
| `component-toggle-button` | component | `toggle-button` | 28×28 |
| `container-modal-overlay` | container | `modal-overlay` | 1920×1080 |
| `container-modal-content` | container | `modal-content` | 480×320 |
| `container-tabs` | container | `tabs` | 320×400 |
| `container-tab-content` | container | `tab-content` | 320×320 |
| `container-dropdown-menu` | container | `dropdown-menu` | 200×240 |
| `container-carousel` | container | `carousel` | 400×240 |
| `container-carousel-slide` | container | `carousel-slide` | 400×240 |
| `container-segmented-control` | container | `segmented-control` | 240×28 |

### 10.2 Padding tokens added

Per §2.3 above: `padding.symmetric-md`, `padding.compact-row`, `padding.dialog-body`, `padding.tooltip-body`.

### 10.3 New TokenCategory

Append `padding` to the `TokenCategory` union in [05_libraries.md](05_libraries.md) §4:

```ts
export type TokenCategory =
  | "spacing"
  | "radius"
  | "font-size"
  | "font-family"
  | "duration"
  | "shadow"
  | "z-index"
  | "padding";              // NEW
```

Padding tokens carry JSON-string values parseable as a `Padding` object (per §2.1 above).

## 11. Reducer action shapes

These actions extend the editor's `EditorAction` union. They flow through `core/editing/applyEdit.ts` per [02_architecture.md](02_architecture.md) §3.1 invariants.

```ts
// New actions added to EditorAction union:

| { type: "PADDING_SET"; elementId: string; padding: Padding }

// Modal helpers (composed actions for ergonomics):
| { type: "MODAL_OPEN"; modalContentId: string }
| { type: "MODAL_CLOSE"; modalContentId: string }

// Tabs:
| { type: "TABS_SET_ACTIVE"; tabsId: string; activeTabId: string }

// Dropdown:
| { type: "DROPDOWN_SET_OPEN"; dropdownId: string; isOpen: boolean }

// Carousel:
| { type: "CAROUSEL_SET_ACTIVE_SLIDE"; carouselId: string; activeSlideIndex: number }

// Toggle / segmented:
| { type: "TOGGLE_SET_PRESSED"; toggleId: string; pressed: boolean }
| { type: "SEGMENTED_SET_ACTIVE"; segmentedId: string; activeSegmentId: string }

// Loading state:
| { type: "BUTTON_SET_LOADING"; buttonId: string; isLoading: boolean }
```

Each produces a Change Record (`padding_changed`, `modal_state_changed`, `tabs_active_changed`, etc.).

For Tabs / Dropdown / Carousel / Toggle / Segmented actions: state lives on the element itself (e.g. `tabs.activeTabId`), so these actions are just typed `PROPERTY_CHANGED` variants. Implementing them as distinct actions improves type safety and Change Log clarity.

## 12. Change Record kinds (new)

Append to [09_glossary.md](09_glossary.md) §5.6:

- Padding: `padding_changed`.
- Modals: `modal_state_changed`, `modal_overlay_added`, `modal_content_added`.
- Tabs: `tabs_active_changed`, `tab_trigger_added`, `tab_content_added`.
- Dropdowns: `dropdown_state_changed`, `menu_item_added`, `menu_item_removed`.
- Carousels: `carousel_active_slide_changed`, `carousel_slide_added`, `carousel_slide_removed`.
- Toggle / segmented: `toggle_pressed_changed`, `segmented_active_changed`.
- Loading: `button_loading_changed`.

## 13. Build phase impact

Per-phase adjustments to [10_build_phases.md](10_build_phases.md):

| Phase | Addition |
| --- | --- |
| **Phase 1** (Core schema + util) | Extend `padding.ts` with per-side fields; add archetypes (`tooltip`, `modal-overlay`, `modal-content`, `tabs`, `tab-trigger`, `tab-content`, `dropdown-menu`, `menu-item`, `menu-divider`, `carousel`, `carousel-slide`, `carousel-indicators`, `toggle-button`, `segmented-control`); add `isLoading?` to existing button props. |
| **Phase 6** (Libraries) | Bundle the 14 new Library entries from §10.1; add the 4 padding tokens from §10.2; extend `TokenCategory` per §10.3. |
| **Phase 7** (Straw subject) | Use modal-overlay + modal-content for any GeoSee-modal-like surface; use tooltips on Sub Master row affordances; tabs are appropriate for nothing in the current GeoSee sidebar (skip in straw subject — keep archetypes available for future packages). |
| **Phase 8** (Validation) | Add §4.11 → §4.16 covering the new rule families (tooltip / modal / tabs / dropdown / carousel / segmented / loading). |
| **Phase 9** (Editing) | Implement the new reducer cases from §11. |
| **Phase 11** (Properties Inspector) | Add per-side padding editor; add per-archetype editors for tooltip / modal / tabs / dropdown / carousel / toggle / segmented; add `isLoading` toggle on existing button editors. |

Estimated total build-time addition: ~6 hours of agent work.

## 14. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Per-side padding round-trips | Set `padding.left: 24` only; save; reload; left = 24, others unset. |
| 2 | Per-side overrides x/y | Set `padding.x: 12` + `padding.left: 24`; resolved left = 24, resolved right = 12. |
| 3 | Padding editor link toggle | Toggle "link all"; all four inputs become bound. |
| 4 | Tooltip instantiate | Drag `component-tooltip` from Library; tooltip Component appears with default text. |
| 5 | Tooltip dangling ref warning | Set `describesElementId` to a non-existent id; finding fires. |
| 6 | Modal overlay + content | Drag overlay; drag content into overlay; renders centred. |
| 7 | Modal orphan content warning | Place `modal-content` without `modal-overlay` parent; finding fires. |
| 8 | Tabs active switch | Set `tabs.activeTabId` to second tab id; second tab-content visible, first hidden. |
| 9 | Tabs orphan trigger | Add a tab-trigger with tabId not matching any tab-content; warning fires. |
| 10 | Tabs active-missing error | Set `tabs.activeTabId` to non-existent id; error fires. |
| 11 | Dropdown menu open / close | Toggle `isOpen`; popover layout reveals / hides menu items. |
| 12 | Menu consecutive dividers suggestion | Add two `menu-divider` Components side by side; suggestion fires. |
| 13 | Carousel active slide | Set `activeSlideIndex: 2`; third slide visible. |
| 14 | Carousel active-out-of-range error | `activeSlideIndex: 99` on a 3-slide carousel; error fires. |
| 15 | Indicator count mismatch | Indicators say 3, carousel has 4 slides; warning fires. |
| 16 | Toggle pressed state | Click toggle; `pressed` flips; visual state changes. |
| 17 | Segmented mutually exclusive | Pick segment B; A deactivates; `activeSegmentId === B`. |
| 18 | Loading button | Set pill button `isLoading: true`; spinner renders; click ignored. |
| 19 | Loading no-aria suggestion | Loading button without aria-label; suggestion fires. |
| 20 | Round-trip with all new archetypes | Export then re-import a package containing one of each; byte-identical. |

## 15. Migration

For any existing v1 package authored before this addition:

- `Container.padding` with only `x` / `y` continues to work.
- No new archetypes used → no migration needed.
- Existing button archetypes without `isLoading` → defaults to `false`.

Fully backward-compatible.

## 16. Cross-references

| For details on… | Read… |
| --- | --- |
| Component / Container schema base | [07_package_format.md](07_package_format.md) §5, §6 |
| Where these archetypes appear in the canonical reference | [14_component_archetype_reference.md](14_component_archetype_reference.md) (extended per §13 above) |
| Library Panel UX | [05_libraries.md](05_libraries.md) §3 |
| Validation engine signature | [08_validation_rules.md](08_validation_rules.md) §6 |
| Reducer flow / `applyEdit` | [02_architecture.md](02_architecture.md) §3.1 |
| Effects / Style / Group additions | [20_materials_and_shapes.md](20_materials_and_shapes.md) |
| Coherence audit | [22_mvp_coherence_audit.md](22_mvp_coherence_audit.md) |
