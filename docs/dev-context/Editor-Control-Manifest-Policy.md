# Editor Control Manifest Policy

Status: active guardrail

The canonical editor sidebar control inventory is
`docs/dev-context/editor-control-manifest.json`. It is the constraining source
for user-facing editor bars, peer groups, subsections, commands, persisted
variables, and dynamic control families.

## Required Checklist Before Editor-Bar Changes

1. Read `docs/dev-context/editor-control-manifest.json` before changing editor
   sidebar source.
2. Identify every impacted manifest id.
3. Preserve the same id when a control only moves between groups or files.
4. Add a new active manifest entry before adding a new user-facing control.
5. Mark removals, renames, or hidden controls with structured approval metadata.
6. Run `npm run check:editor-controls`.

## Included Controls

Manifest entries are required for:

- top-level sidebar bars;
- peer editor groups and nested subsections;
- toggles, selects, sliders, color fields, uploads, buttons, and visibility
  controls;
- controls backed by `environment.scene`, `environment.layerStyles`,
  page `sceneOverrides`, page `layerOverrides`, page fields, or editor chrome
  fields;
- dynamic/repeated controls generated from pages, layers, seismic products,
  MT boundaries, atmosphere volumes, and similar data.

Pure decorative icons, static styling wrappers, and non-interactive helper text
do not need manifest entries unless they become actionable or backed by stored
state.

## Page Manager Guard

The Pages footer actions are manifest-controlled and must retain these active
ids when moved or restyled:

- `page.action.add`
- `page.action.duplicate`
- `page.action.reset-overrides`
- `page.action.make-master`
- `page.action.make-child`
- `page.action.delete`

The current layout is add / duplicate / reset on the top icon row and `M` / `C`
/ trash on the lower row. The visible `M` and `C` labels keep the accessible
names `Make Master` and `Make Child`.

The repeated page-row reorder grip is a direct-manipulation page action. It must
keep `aria-label="Drag page to reorder"`, remain rightmost in the row action
group, use the DEC-093 Page Manager action-button geometry, and retain focused
source/rendered tests before any future layout change is accepted.

## Approval Metadata

Any `removed`, `renamed`, or `hidden` entry must keep the old id in the
manifest and include:

- `approval.status: "approved"`
- `approval.approvedBy`
- `approval.approvedAt`
- `approval.reason`

Individual control removals do not require a `docs/03-decisions.md` entry
unless the change also alters product architecture, persistence, runtime
ownership, or a durable product decision.

## Validation

`tools/check-editor-control-manifest.mjs` enforces the manifest shape, source
anchors, approval metadata, and protected editor-file companion update rule.
`npm run check:workspace` runs the guard so editor source changes fail when the
manifest/checklist is skipped.
