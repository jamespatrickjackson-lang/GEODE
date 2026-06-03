# Libraries

**Status:** active standalone editor spec.

The Library is a floating searchable panel in the standalone editor. It stores
and instantiates editable DOM templates, not package-export records.

## Library Sections

| Section | Contents |
| --- | --- |
| Components | Leaves and small controls: text, icon, button, divider, swatch, input, slider control. |
| Assemblies | Reusable composites: icon-label row, labelled slider, section header, page row, layer row. |
| Products | Larger surfaces: sidebar shell, page manager, layer stack, navigator bar, overlay card set. |
| Colours | Swatches and material colors. |
| Icons | Visible glyph thumbnails with scalable preview. |
| Tokens | Spacing, sizing, alpha, radius, blur, saturation, typography, line width. |
| Styles | Overlay card, navigator, editor chrome, label, row, panel, HUD styles. |

## Required Panel Behavior

- The Library is floating and can stay open while editing the canvas.
- Entries are searchable.
- Each entry shows a visible thumbnail or preview.
- Preview scale can be changed by the user.
- Empty sections show a concise empty state.
- Saved entries appear immediately.
- Reload restores saved entries and useful panel state.

## Starter Entries

The starter Library must include:

- GeoSee sidebar shell.
- Editor header row.
- Collapsible section.
- Nested section header.
- Page manager row.
- Sub Master row.
- Layer card header.
- Layer subsection.
- Overlay card.
- Navigator group.
- Save footer.
- Control row.
- Icon button.
- Divider.
- Text label.
- Swatch.
- Input.
- Slider row.
- Common GeoSee icons.
- Overlay, navigator, label, and editor chrome style presets.

## Package Catalog Seeds

Read-only entries from `packages/geosee_editor_sidebar` may seed the Library:

- `libraries.json`
- `components.json`
- `containers.json`
- `tokens.json`

These files are references only. They do not turn the editor back into the
package workbench. Imported entries create editable DOM copies in
`gui-editor.html`.

## Save To Library

Saving a selection creates:

- A stable display name.
- A section: Component, Assembly, or Product.
- A thumbnail/preview.
- A DOM template with nested structure.
- Style and token references where useful.
- Notes describing intent.

Components are usually leaves. Assemblies and Products may contain nested
editable children.

## Instantiate From Library

Click behavior:

- Insert inside the selected valid container when possible.
- Respect parent padding.
- Otherwise insert into the root product surface near the visible canvas.

Drag behavior:

- Show a preview at the cursor.
- Use the placement engine for snap, auto-nest, reorder, and reject.
- Preserve nested structure.
- Log accepted or rejected action in the Behavior Log.

## Icons

Icon entries must not be name-only. Each icon entry needs:

- A visible glyph thumbnail.
- Name.
- Optional category.
- Scalable preview.
- Default size.
- Ability to instantiate as an editable icon element.

## Tokens And Styles

Tokens and styles can apply compatible values to the selected element:

- Width, height, and spacing.
- Padding and gap.
- Radius.
- Border alpha and width.
- Fill color and opacity.
- Text color, font size, and weight.
- Blur and saturation.
- Shadow.
- Line width.

Applying a token or style should not change incompatible properties silently.
If nothing compatible can be applied, the editor should reject and log it.

## Acceptance

The Library is working when:

1. It floats above the editor without blocking required canvas use.
2. Each section has visible thumbnails or previews.
3. Search filters entries.
4. Preview scale changes thumbnails.
5. Saved Component / Assembly / Product entries persist.
6. Click instantiation places a fresh editable copy.
7. Drag instantiation uses snap, padding, auto-nest, and reject rules.
8. Icon entries show actual glyphs.
9. Style and token entries apply compatible values.
10. Reload restores saved entries and panel state.
