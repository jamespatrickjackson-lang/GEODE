# GeoSee Agent Operating Contract

This file is the agent operating contract. `README.md` is the human repo
landing page, `docs/START-HERE.md` is stable product/system orientation, and
`docs/dev-context/Active-Build-Context.md` is the active software-work entry.

## First Read

For normal software-build work, start with
`docs/dev-context/Active-Build-Context.md`, then open only the docs and source
files directly relevant to the task.

Do not route through old receipt archives, screenshots, staged-intake records,
or older root docs unless the task explicitly needs audit history,
verification evidence, intake/drop review, or visual QA evidence.

## Output Rail

Agent responses use system/dev context transfer: facts, commands, files, risks,
decisions, verification, and outcomes.

Avoid praise, reassurance, motivational framing, apology loops, personal
framing, and first/second-person posture. Avoid first/second-person pronouns in
assistant-authored prose, including `I`, `me`, `my`, `we`, `our`, `you`, and
`your`.

Exceptions: quoted source text, code identifiers, commands, file content, UI
copy under review, and required wording from tools, tests, or external APIs.

## Source Of Truth

- Product purpose and alpha boundaries: `docs/00-purpose.md`
- Scope: `docs/01-scope.md`
- Architecture and locked stack decisions: `docs/02-architecture.md`
- Decision log: `docs/03-decisions.md`
- Active software-work routing: `docs/dev-context/Active-Build-Context.md`
- Workspace and verification routing: `docs/dev-context/Verification-Routing.md`

## Workspace Rules

- Run `npm run check:workspace` before commits or broad verification.
- Stage exact paths for focused commits; do not use broad staging when unrelated
  local work exists.
- Treat dirty files outside the current task as user work unless proven
  otherwise.
- Do not stage, rewrite, delete, or normalize excluded user work while doing
  unrelated changes.

## Decision Discipline

- If a change would contradict `/docs`, stop and surface it before acting.
- New durable decisions belong in `docs/03-decisions.md`.
- Do not rewrite earlier decision entries; add a new entry with a
  `supersedes DEC-NNN` note when replacing an older decision.

## Authoring Persistence

The editor persists project edits through a dev-only Vite plugin endpoint
registered in `vite.config.ts`. State lives on disk under `projects/<project>/`.

Do not replace this with IndexedDB, LocalStorage, or a backend service unless
the user explicitly asks for a persistence architecture change.

## Working Tree And Archive

- The active working tree is `C:\GeoSee\GeoSee_Dev\`.
- Large raw/source buckets are outside the active repo at
  `C:\GeoSee\GeoSee_Archive\`.
- Treat old repo-relative source paths in provenance as historical identifiers
  and resolve them through `docs/archive-map.md` and
  `docs/archive-manifest.json`.
