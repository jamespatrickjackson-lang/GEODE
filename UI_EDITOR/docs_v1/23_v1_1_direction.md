# Direction

**Status:** active direction for the standalone editor in
`UI_EDITOR/gui-editor.html`.

This doc defines what should improve next after the current editor basics are
in place. It is not a package-export contract and it is not an AI-agent build
prompt.

## Product Direction

The editor should become good enough to rebuild its own GeoSee-style panels
from scratch:

- Pick the right mode: Component, Assembly, or Product.
- Create primitive elements.
- Nest children reliably.
- Snap and align without guessing.
- Save useful parts into the Library.
- Rebuild larger surfaces from Library entries.
- Inspect and tune GeoSee material variables.
- Use the Behavior Log to see what the editor accepted or rejected.

## Current Priority

1. Make placement behavior predictable.
2. Keep the tree faithful to DOM structure.
3. Make padding visible and meaningful.
4. Make Library thumbnails and drag/drop reliable.
5. Ensure every GeoSee panel piece has an editor primitive or Library entry.
6. Keep docs free of package/AI instructions while standalone work is active.

## Missing Or Improvement Candidates

These are candidates for follow-up implementation:

- Richer drag-create gestures for all shape tools.
- More complete multi-select editing.
- Responsive/device preview.
- Better ruler guide creation and management.
- Component variant properties.
- Hover/active/disabled state editing.
- More complete icon categories.
- Export of a simple human-readable editor snapshot after the editor UX is
  stable.
- Optional package export only after the standalone editor is reliable.

## Non-Goals For Now

- Autonomous AI build loops.
- Generated AI-agent briefs.
- Package validation reports.
- Host-app writeback.
- React/Vite workbench as the primary editor.

## Acceptance For Direction Changes

A proposed new feature belongs here when it helps the user author, inspect,
nest, align, style, save, or reuse visual editor content. It does not belong
here if it mainly helps package export, validation automation, or AI handoff
before the editor itself is stable.
