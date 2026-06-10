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
- `npm run check:visual-qa-clean`: named visual-QA policy. This runs the broad-verification policy and should be run before and after agent-driven browser/editor checks that may trigger dev persistence.

## Command Tiers

- Workspace state: `npm run check:workspace`
- Visual/browser QA cleanliness: `npm run check:visual-qa-clean`
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
- Browser/render/editor behavior: run `npm run check:visual-qa-clean` before opening the app and again after closing the app, then use the smallest targeted Utah browser script that covers the changed behavior. If the after-check finds snapshot-sensitive files, stop and treat the browser evidence as contaminated by disposable page or overlay state until those files are reverted, stashed, or intentionally accepted.
- Full `npm run test:utah-forge` is broad regression only, not default iteration. Treat it as committed-state evidence only when `npm run check:workspace` reports no relevant local sketch files.

## Page Disposability Rule

`projects/utah-forge/pages/*.json` are disposable authoring state. Deleting, rebuilding, or reordering deck pages must not break app-behavior tests. App-behavior tests (`test:utah:browser` and the individual Utah test scripts) must not hardcode deck page IDs or assume specific deck positions. Synthetic in-memory fixtures or dynamic project.json-based lookups must be used instead.

`check:utah-snapshot` is the deck snapshot check — it intentionally hardcodes page IDs and deck order as content evidence. It is NOT an app-behavior check and must not be included in `test:utah-forge`.

## Dev Server Rule

Agents should not run `Launch GeoSee.bat`. It is a human-facing launcher and it force-kills any process listening on port `5173`, which may interrupt the user's live app session.

For agent-run checks, prefer a scoped dev server command such as `npm run dev -- --host 127.0.0.1 --port <free-port>` and report the URL. If port `5173` is already in use, assume it may belong to the user unless the user explicitly asks to restart it.


## Disposable Page Fixture Rule

Utah FORGE pages are disposable authoring state. App-behavior tests must not use live Utah pageOrder, current deck page files, page ids, page titles, page indexes, or page-to-page pairs as proof of generic behavior. Use synthetic fixtures or fixture builders for app behavior. Deck snapshot or deck integration checks must be explicitly named as deck-state checks and kept out of app-health verification.
