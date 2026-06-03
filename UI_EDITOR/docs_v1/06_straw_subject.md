# Straw Subject

**Status:** active standalone editor reference surface.

The straw subject is the default design shown in `gui-editor.html`. It exists
to test whether the editor can author a real GeoSee-style panel, not just draw
isolated boxes.

## Purpose

The default surface should expose editor gaps quickly:

- Nested sections and rows.
- Text and icons as real child layers.
- Padded containers.
- Overlay materials.
- Control rows.
- Page/layer/navigator patterns.
- Library save and instantiate flows.
- Snap, auto-nest, reorder, align, and resize behavior.

## Required Default Surface

The canvas should include a GeoSee-style editor panel with:

- Sidebar shell.
- Header row.
- Page manager area.
- Section stack.
- Nested section header.
- Layer card or layer row stack.
- Control rows with labels, icons, sliders, swatches, and inputs.
- Save/footer row.
- Overlay card or HUD sample.
- Navigator-style group.

Every visible object that should be editable must be a `data-c` node.

## Layer Expectations

The layers tree should show real nesting, for example:

```text
Product Surface
  Sidebar Shell
    Header Row
      Brand Text
      Save Icon
    Page Manager
      Page Row
        Page Icon
        Page Name
    Layer Stack
      Layer Card Header
        Visibility Icon
        Layer Title
      Layer Controls
        Opacity Row
          Label
          Slider
          Value Input
```

Text, icons, inputs, sliders, and swatches must not float as unrelated root
siblings when they visually belong inside a row.

## Gap-Finding Rules

When the straw subject cannot be rebuilt inside the editor, add the missing
capability to the editor rather than simplifying the subject.

Examples:

- If icons only show names, improve icon thumbnails.
- If rows cannot hold child labels, fix nesting.
- If padding is invisible or ignored, fix padding overlays and placement.
- If library products cannot preserve nested children, fix Library templates.
- If a slider row cannot be represented, add the primitive or assembly needed.

## Acceptance

The straw subject is useful when:

1. It renders on first open.
2. Its layers tree mirrors visible hierarchy.
3. Parent padding is visible and affects child placement.
4. The panel can be saved as a Product.
5. Child rows can be saved as Assemblies.
6. Text, icons, swatches, inputs, and sliders can be edited or replaced.
7. Library drag/drop can rebuild equivalent sections.
8. Reload preserves the edited subject.
