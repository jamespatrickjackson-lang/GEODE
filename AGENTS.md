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

## Workspace Rules

- The canonical active repo root is `C:\GeoSee\GeoSee_Dev\`.
- If the current working directory is missing the repo, switch to
  `C:\GeoSee\GeoSee_Dev\` before inspecting, testing, editing, or
  committing.
- `C:\GeoSee_Dev\` is obsolete/stale and must not be treated as the
  current working tree.
- Run `npm run check:workspace` before commits or broad verification.
- Stage exact paths for focused commits; do not use broad staging when
  unrelated local work exists.
- Treat dirty files outside the current task as user work unless proven
  otherwise.
- Do not stage, rewrite, delete, or normalize excluded user work while
  doing unrelated changes.

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

- `src/editor/LayerPanel.tsx` (~12,500 lines; in-flight R1 split per
  `docs/dev-context/Source-Monolith-Split-Plan.md`)
- `src/scene/SceneManager.ts` (~12,000 lines; R2 split queued)
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
