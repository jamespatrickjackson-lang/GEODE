# Verification Routing

Status: active verification and workspace-state routing

## Workspace States

- Committed repo state: the last committed tree plus any staged paths intended for the current commit. Broad verification is committed-state evidence only when relevant local sketch files are absent.
- Local sketch state: uncommitted presentation/project work such as environment, page, overlay, branding, or image changes. This can be useful work without being accepted product truth.
- Excluded user work: dirty files intentionally left out of a focused commit. Do not stage, rewrite, delete, or normalize these while doing unrelated work.
- Accepted snapshot: a presentation sketch that has been intentionally committed. Snapshot checks can represent accepted state only after that happens.

Run `npm run check:workspace` before commits or broad verification. A dirty tree is not automatically a failure, but snapshot-sensitive local files mean broad snapshot/browser results describe the local sketch state, not just committed repo state.

Shared vocabulary for these states lives in `docs/dev-context/GeoSee-Terms.md`.

## Workspace Policy Modes

- `npm run check:workspace`: report-only. Use this before commits and verification to see whether local sketch or excluded user work is present.
- `npm run check:workspace -- --commit`: commit-scope policy. Fails only when staged paths mix snapshot-sensitive files with unrelated categories, or when the staged set is broadly mixed across too many categories.
- `npm run check:workspace -- --broad`: broad-verification policy. Fails when snapshot-sensitive local files are dirty, because broad snapshot/browser results would describe local sketch state rather than committed repo state.

## Command Tiers

- Workspace state: `npm run check:workspace`
- Static page/project wiring: `npm run check:pages`
- Active context-drag markers: `npm run check:agent-drag`
- Runtime asset wiring: `npm run check:runtime-assets`
- Utah runtime and derived-product integrity: `npm run check:utah-runtime`
- Utah presentation snapshot drift: `npm run check:utah-snapshot`
- Utah artifact metadata: `npm run check:artifacts`
- Project artifact coverage: `npm run check:coverage`
- Code/runtime compile risk: `npm run build`
- Browser/render/editor behavior: targeted Utah browser scripts
- Broad Utah regression: `npm run test:utah-forge`

## Evidence Rules

- Docs-only and static routing changes: `git diff --check`, `npm run check:agent-drag`, and `npm run check:workspace`.
- Project/page/overlay wiring changes: add `npm run check:pages`.
- Layer file or runtime data path changes: add `npm run check:runtime-assets`.
- Utah derived/data product changes: add `npm run check:utah-runtime`.
- Utah presentation sketch changes: use `npm run check:utah-snapshot` only when the sketch state is intentionally being checked.
- Browser/render/editor behavior: use the smallest targeted Utah browser script that covers the changed behavior.
- Full `npm run test:utah-forge` is broad regression only, not default iteration. Treat it as committed-state evidence only when `npm run check:workspace` reports no relevant local sketch files.

## Dev Server Rule

Agents should not run `Launch GeoSee.bat`. It is a human-facing launcher and it force-kills any process listening on port `5173`, which may interrupt the user's live app session.

For agent-run checks, prefer a scoped dev server command such as `npm run dev -- --host 127.0.0.1 --port <free-port>` and report the URL. If port `5173` is already in use, assume it may belong to the user unless the user explicitly asks to restart it.
