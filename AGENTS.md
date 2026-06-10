# GeoSee Agent Operating Contract — Codex CLI

This file is the operating contract for Codex CLI and other agent runtimes
that auto-load `AGENTS.md`. Claude Code reads `CLAUDE.md` instead; the two
files mirror each other. Source of truth is `CLAUDE.md` — update both when
either changes.

## First Read

For normal software-build work, start with
`docs/dev-context/Active-Build-Context.md`, then open only the docs and
source files directly relevant to the task.

Do not route through old receipt archives, screenshots, staged-intake
records, or older root docs unless the task explicitly needs audit history,
verification evidence, intake/drop review, or visual QA evidence.

## Output Rail

Agent responses use system/dev context transfer: facts, commands, files,
risks, decisions, verification, and outcomes.

Avoid praise, reassurance, motivational framing, apology loops, personal
framing, and first/second-person posture. Avoid first/second-person
pronouns in assistant-authored prose, including `I`, `me`, `my`, `we`,
`our`, `you`, and `your`.

Exceptions: quoted source text, code identifiers, commands, file content,
UI copy under review, and required wording from tools, tests, or external
APIs.

## Source Of Truth

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

## Workspace Rules

- The canonical active repo root is `C:\GeoSee\GeoSee_Dev\`.
- If the current working directory is missing the repo, switch to
  `C:\GeoSee\GeoSee_Dev\` before inspecting, testing, editing, or
  committing.
- `C:\GeoSee_Dev\` is obsolete/stale and must not be treated as the
  current working tree.
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
- MT threshold boundary all-off maps are treated as empty/stale visibility
  state. If the threshold-boundary layer is visible and no canonical or legacy
  boundary is active, the resolver inherits default boundary visibility. Hide
  the threshold-boundary layer to hide all boundary lines; do not repair this
  with page-level fixture edits.
- No page-id, page-index, fixture-title, project page, or environment fixture
  special cases are allowed for viewport quick legends. Do not edit
  `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`,
  or `projects/*/environment.json` for quick-legend behavior.

## Search Hygiene

Default search scope is `src/`, `docs/` (top level only), `tools/`,
`tests/`, and root config files. Do not search-recursively into the
following paths unless the task explicitly requires them:

- `projects/*/data/**` — large GeoJSON, .bin scalar/position tiles, WebP,
  raster manifests. Single search can stream tens of MB of vector text.
- `data/**` — root vector data (includes `hydrography_streams.geojson`
  at 17 MB).
- `dist/**`, `dist-tsbuild/**`, `node_modules/**` — build output and
  dependencies.
- `docs/dev-context/Archive/**`,
  `docs/dev-context/Change-Receipts/**`,
  `docs/dev-context/Verification-Receipts/**`,
  `docs/dev-context/Generated-Reports/**`,
  `docs/dev-context/Audits/**` — historical receipts and audit evidence.
- `playwright-report/**`, `test-results/**` — Playwright artefacts.

When a search must hit those paths, scope it explicitly to the specific
subtree rather than recursing from repo root.

The following source files are very large; never read them in full. Use
`rg`/grep to locate the target range first, then read the relevant lines
only:

- `src/editor/LayerPanel.tsx` (~2,500 lines; R1 split target met)
- `src/scene/SceneManager.ts` (~2,550 lines; R2 split target met)
- `src/editor/EnvironmentScenePanel.tsx` (~3,800 lines)
- `src/editor/PagePanel.tsx` (~2,400 lines)
- `src/editor/topoMap/TopoMapPanel.tsx` (~2,100 lines)
- `src/editor/EditorContext.tsx` (~1,900 lines)

## Decision Discipline

- If a change would contradict `/docs`, stop and surface it before acting.
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

- The active working tree is `C:\GeoSee\GeoSee_Dev\`.
- Large raw/source buckets are outside the active repo at
  `C:\GeoSee\GeoSee_Archive\`.
- Treat old repo-relative source paths in provenance as historical
  identifiers and resolve them through `docs/archive-map.md` and
  `docs/archive-manifest.json`.


## Disposable Page Fixture Rule

Utah FORGE pages are disposable authoring state. App-behavior tests must not use live Utah pageOrder, current deck page files, page ids, page titles, page indexes, or page-to-page pairs as proof of generic behavior. Use synthetic fixtures or fixture builders for app behavior. Deck snapshot or deck integration checks must be explicitly named as deck-state checks and kept out of app-health verification.
