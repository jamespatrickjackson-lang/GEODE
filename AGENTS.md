# GeoSee / GEODE Agent Operating Contract — Shared Engineering Instructions

This is the provider-neutral engineering contract for agents working in this
repository. Read the relevant scoped `AGENTS.md` before changing its subtree.
A provider-specific entry file such as `CLAUDE.md` is not intended to own
separate engineering policy.

**Migration boundary:** The existing root and nested `CLAUDE.md` files still
contain substantive original instructions and have not been converted into
import-only routers. Only owner-approved workspace, authority, and writing
policy corrections are made during this review stage. Do not shrink, remove,
or replace those instructions until their unique rules are preserved and
provider loading is verified. The migration plan
and unresolved holds are recorded in
`docs/dev-context/Agent-Instruction-Consolidation-Plan.md`.

## First Read

For normal software-build work, start with
`docs/dev-context/Active-Build-Context.md`, then open only the docs and
source files directly relevant to the task.

Do not route through old receipt archives, screenshots, staged-intake
records, or older root docs unless the task explicitly needs audit history,
verification evidence, intake/drop review, or visual QA evidence.

For work under a scoped area, also read its shared instructions **before**
changing files in that area:

- `projects/AGENTS.md`: project authoring, bulk scientific data and provenance.
- `src/editor/AGENTS.md`: editor controls, persistence, UI and safe edits.
- `src/scene/AGENTS.md`: Three.js runtime, loaders, opacity and transitions.
- `docs/AGENTS.md`: documentation evidence, decisions, source rights and claims.

Read these explicitly if the current agent runtime does not automatically
discover nested instructions. Do not assume all providers load the same files
or that an abbreviated scoped rule supersedes its detailed technical owner.

## Output Rail

Agent engineering handoffs use factual system/development reporting:
commands, files, risks, decisions, verification evidence, and outcomes.
Avoid praise, reassurance, motivational framing, apology loops, and
unnecessary personal framing. Keep first/second-person wording restrained
when a concise technical status report does not need it.

This reporting convention does **not** dictate the language of user-facing
README content, tutorials, documentation, UX copy, or requested writing.
Write appropriately for the intended audience, including natural first- and
second-person language when useful. Quoted source text, code identifiers,
commands, file content, UI copy, and tool/test/API wording retain their
original form.

## Source Of Truth

- Human repository landing page: `README.md`
- Stable product/system orientation: `docs/START-HERE.md`
- Product purpose and alpha boundaries: `docs/00-purpose.md`
- Scope: `docs/01-scope.md`
- Architecture and locked stack decisions: `docs/02-architecture.md`
- Decision log: `docs/03-decisions.md`
- Active software-work routing: `docs/dev-context/Active-Build-Context.md`
- Workspace and verification routing:
  `docs/dev-context/Verification-Routing.md`
- Editor sidebar control manifest and approval policy:
  `docs/dev-context/editor-control-manifest.json` and
  `docs/dev-context/Editor-Control-Manifest-Policy.md`
- Page transitions and section-frame helpers:
  `docs/dev-context/Page-Transitions-And-Section-Frames.md`
- Editor feature completion and user-facing field exposure:
  `docs/06-editor-exposure-rules.md`
- Public-release, provenance and third-party data rights:
  `docs/LICENSING.md`

## Workspace Rules

- Work in the Git checkout explicitly authorized for the current task.
  Verify its root with `git rev-parse --show-toplevel`; verify the intended
  repository identity and branch before modifying files or committing.
- If no Git checkout is present or its identity is ambiguous, stop and report
  rather than selecting a different checkout. Never automatically switch to a
  remembered local path.
- Historical `C:\GeoSee\GeoSee_Dev\` and `C:\GeoSee_Dev\` are
  local-context references, not universal locations or instructions to enter
  those trees.
- `UI_EDITOR` prototype/package work stays separate from this active app tree.
  Do not merge or resurrect `UI_EDITOR/` or `UI_EDITOR_v1_0/` content into
  `main` unless a request explicitly asks for that standalone package.
- Run `npm run check:workspace` before commits or broad verification.
- Stage exact paths for focused commits; do not use broad staging when
  unrelated local work exists.
- Treat dirty files outside the current task as user work unless proven
  otherwise.
- Do not stage, rewrite, delete, or normalize excluded user work while
  doing unrelated changes.
- Before changing editor sidebar bars, groups, subsections, controls, or
  backed editor fields, read the editor control manifest and policy. Add,
  move, rename, hide, or remove controls only through the manifest guard.
- Cinematics render-preset authoring currently has one apparent mode.
  `Camera Studio` -> `Render Preset` must show `Project preset` in every
  authoring context and must show the selected page's `Page preset` override
  beside it when a page is selected. Do not bury project presets behind Global
  Settings-only paths or hide page/project preset selectors behind separate
  Presentation Presets modes.
- Before changing viewport quick legends, read
  `docs/dev-context/UI-Visual-Standards.md`; use the compact quick legend helpers
  in `src/ui/legendStyles.ts`; do not hand-tune local quick legend button
  geometry without a documented exception.
- `MT Resistivity Cells` controls only the full-density MT inversion
  cell centers. `All Valid Cells` and `Log10 Resistivity Window` are
  exclusive modes over that same layer: All Valid Cells hides the compact log10
  resistivity window and suppresses resistivity isoline overlays, while Log10
  Resistivity Window enables filtering by log10 resistivity and controls. Mode
  clicks use the 1.5s slider-style scalar transition and final persistence
  writes only `scalarLegendVisible` plus `scalarInclusionMode`.
- MT Resistivity Cells mode animations are local app-level transitions. Scope
  them to the current effective page context and cancel or ignore stale RAF
  ticks when navigation changes that context; do not repair this with page
  fixture edits.
- When Global Settings/page 00 is selected, `previewEnvironmentBase` must still
  preserve page `visibilityOverrides` so authored page navigation can show
  section, seismic, topo, and layer-presence state while previewing the Global
  Settings base. It must also
  preserve MT Resistivity Cells authored Log10 Resistivity Window fields
  through the Utah FORGE preview field map. A Log10 Resistivity Window-authored
  page should not require an All Valid Cells/Log10 Resistivity Window click to
  show isoline detail. Do not fix that load path by mutating
  `scalarInclusionFilterActive`, `SCALAR_TRANSITION_STYLE_FIELDS`,
  `full-density-scalar`, or page fixtures.
- During page transitions, MT Resistivity Cells All Valid Cells/Log10
  Resistivity Window buttons must reflect the target authored mode, not
  transient ramp interpolation. Log10 Resistivity Window pages with line
  controls on must register the full-density scalar tween so isoline overlays
  enter on the page-transition clock, not via a final-commit target-style replay
  or page-level fixture edits.
- After a settled/suppressed page reapply, MT Resistivity Cells may refresh only
  the full-density target style to rebuild page-load Log10 Resistivity Window
  isolines. Skip that narrow refresh while a scalar tween is active, and never
  replace it with broad page visibility/style replay.
- MT threshold boundary visibility maps carrying any explicit `visible` flag
  are authoritative, including deliberate all-off maps ("show no
  isosurfaces"). Only maps with no explicit visibility flags at all are
  empty/stale and inherit default boundary visibility (DEC-145, supersedes
  the earlier all-off-is-stale rule). Do not repair boundary visibility with
  page-level fixture edits.
- Utah FORGE seismic sections are trace-header driven. Do not plot 2D or 3D
  seismic sections by product row/column index, square trace-count grids,
  navigation envelopes, page fixtures, or endpoint-only paths when SEG-Y trace
  geometry exists. `prep/build_utah_forge_seismic_browser.py` must preserve
  Miller/GDR 1141 custom trace fields (CMP_X byte 189 and CMP_Y byte 193 as
  4-byte IBM real values; inline bytes 9-10 and crossline bytes 13-14 as
  2-byte integers), with standard SEG-Y coordinate fields only as fallback.
  L5/L11 legacy sections may use trace-header-derived State Plane-to-UTM paths
  when plausible, but must remain `canClaimPreciseRegistration: false` until
  control-point validation exists. `Forge3d_ANI_PSDM_Stack_Enh.segy` remains a
  source-gated non-renderable product until a complete CRC-valid source member
  exists; use the GDR landing page only, never a constructed direct download
  URL. DEC-148 allows only the explicitly labeled
  `psdm-depth-surrogate-showcase`, which renders the unenhanced ANI PSDM source
  as a source-derived presentation-enhanced surrogate without claiming the
  enhanced SEG-Y is held. For seismic geometry/source changes run
  `node tests/tools/seismic-trace-geometry-source.test.mjs`,
  `node tests/tools/seismic-product-catalog-source.test.mjs`, and
  `npm run check:seismic-source-gates`.
- No page-id, page-index, fixture-title, project page, or environment fixture
  special cases are allowed for viewport quick legends. Do not edit
  `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`,
  or `projects/*/environment.json` for quick-legend behavior.

## Search Hygiene

Default search scope is `src/`, `docs/` (top level only), `tools/`,
`tests/`, and root config files. Do not search-recursively into the
following paths unless the task explicitly requires them:

- `projects/*/data/**` â€” large GeoJSON, .bin scalar/position tiles, WebP,
  raster manifests. Single search can stream tens of MB of vector text.
- `data/**` â€” root vector data (includes `hydrography_streams.geojson`
  at 17 MB).
- `dist/**`, `dist-tsbuild/**`, `node_modules/**` â€” build output and
  dependencies; gitignored files may still be reachable by some Glob/file-discovery tools.
- `docs/dev-context/Archive/**`,
  `docs/dev-context/Change-Receipts/**`,
  `docs/dev-context/Verification-Receipts/**`,
  `docs/dev-context/Generated-Reports/**`,
  `docs/dev-context/Audits/**` â€” historical receipts and audit evidence.
- `playwright-report/**`, `test-results/**` â€” Playwright artefacts.

When a search must hit those paths, scope it explicitly to the specific
subtree rather than recursing from repo root.

<!-- mirror:monoliths begin (kept in sync with AGENTS.md by check:mirror) -->
The following source files are very large; never `Read` them in full
without `offset`+`limit`, and prefer `Grep` first to locate the target
range (approximate current line counts):

- `src/scene/SceneManager.ts` (~6,060 lines)
- `src/editor/EnvironmentScenePanel.tsx` (~5,740 lines)
- `src/scene/section/sceneSectionController.ts` (~4,700 lines)
- `src/editor/PagePanel.tsx` (~4,160 lines)
- `src/editor/EditorContext.tsx` (~3,880 lines)
- `src/editor/topoMap/TopoMapPanel.tsx` (~3,690 lines)
- `src/editor/LayerPanel.tsx` (~2,950 lines)
<!-- mirror:monoliths end -->

## Decision Discipline

- Accepted requirements and dated decisions govern intended behavior; active
  approved specifications explain that intent. Current code, tests, project
  manifests, and artifacts are evidence of what is implemented, not automatic
  approval of a change in requirements.
- If observed implementation and accepted intent disagree, document the
  competing clauses and evidence, then stop the affected change for review.
  A stale, proposed, or historical document does not automatically override
  current observed behavior; current behavior does not silently override an
  accepted requirement.
- New durable decisions belong in `docs/03-decisions.md`.
- Do not rewrite earlier decision entries; add a new entry with a
  `supersedes DEC-NNN` note when replacing an older decision.

## Authoring Persistence

The editor persists project edits through a dev-only Vite plugin endpoint
registered in `vite.config.ts`. State lives on disk under
`projects/<project>/`.

Do not replace this with IndexedDB, LocalStorage, or a backend service
unless the user explicitly asks for a persistence architecture change.

## Working Tree And Archive

- The active working tree is the authorized checkout verified with
  `git rev-parse --show-toplevel`, not a fixed machine directory.
- Historical local working-tree path: `C:\GeoSee\GeoSee_Dev\` (reference
  only; do not switch to it automatically).
- Historical large raw/source buckets were held outside that tree at
  `C:\GeoSee\GeoSee_Archive\`. This is provenance information, not
  permission to inspect or modify an archive.
- Treat old repo-relative source paths in provenance as historical
  identifiers and resolve them through `docs/archive-map.md` and
  `docs/archive-manifest.json`.


## Disposable Page Fixture Rule

Utah FORGE pages are disposable authoring state. App-behavior tests must not use live Utah pageOrder, current deck page files, page ids, page titles, page indexes, or page-to-page pairs as proof of generic behavior. Use synthetic fixtures or fixture builders for app behavior. Deck snapshot or deck integration checks must be explicitly named as deck-state checks and kept out of app-health verification.

## Page-to-page false-fix ban

Utah FORGE pages are disposable authoring state. App behavior, runtime behavior, editor behavior, tests that claim app behavior, and agent fixes must not depend on current page IDs, page filenames, page numbers, page titles, page order positions, live pageOrder discovery, or source/target page pairs.

App-behavior tests must use synthetic in-memory fixtures or fixture builders. Dynamic selection from live project.json pageOrder is deck-state coupling, not app-behavior proof.

Deck snapshot, deck matrix, and presentation audit tools may inspect live pageOrder only when explicitly named as deck-state tools and excluded from app-health verification.

If a failing behavior is observed on a page pair, the fix must be filed against the reusable behavior family: transition entity matching, effective-state resolution, layer style composition, visibility resolution, camera policy, legend state, save/persistence, or validation. Never fix by targeting the observed page pair.

## Transition Runtime Operating Spec

Before transition runtime, editor/save transition gating, scene-section, Section ISO, working-area focus, opacity, or page-navigation work, read:

docs/dev-context/Transition-Runtime-Operating-Spec.md

This spec is the active operating contract for current transition work. Older audits and matrix logs are evidence only.
