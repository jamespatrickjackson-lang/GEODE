# Worktree Housekeeping Ledger

Status: HOUSEKEEPING LEDGER - intake context quarantined, no reset, no commit
Date: 2026-05-20

## Intent

Reduce structural confusion in the current dirty worktree by grouping the work into reviewable checkpoints. The current priority is practical software-build clarity: prevent stale intake artifacts and old directive rails from pulling agent context during runtime/editor/visualization work.

The intake test payloads and intake review surfaces were intentionally purged from the active Utah FORGE project surface. The Add to Project UI remains available as dormant capability.

## Source Commands

- `git status --short`
- `git diff --name-status`
- `git diff --stat`
- `git ls-files --others --exclude-standard`
- archive check for deleted active Utah FORGE pages

## Checkpoint 1 - MT Rendering Hotfix

Purpose: restore readable Utah FORGE full-density MT point-cloud rendering.

Files:

- `projects/utah-forge/environment.json`
- `projects/utah-forge/pages/04_untitled.json`
- `projects/utah-forge/pages/05_untitled.json`
- `projects/utah-forge/pages/06_untitled.json`
- `projects/utah-forge/pages/08_untitled.json`
- `projects/utah-forge/pages/12_untitled.json`

Current notes:

- This checkpoint is runtime-visible project configuration/page state.
- It should stay separate from intake architecture and documentation work.
- Validation already run during the rendering pass: JSON parse, `npm run build`, artifact metadata validation, artifact coverage report, and a Playwright render/state check.

## Checkpoint 2 - Dormant Intake Capability

Purpose: keep intake UI/code available while preventing intake rails from steering normal software-build work.

Files:

- `src/editor/UtahForgeAddToProjectDrop.tsx`
- `tools/run-utah-forge-intake-directive.mjs`
- `projects/utah-forge/BUILD_DIRECTIVE.md`
- `projects/utah-forge/intake_staging/README.md`
- `projects/utah-forge/project.json`

Current notes:

- `project.json` should not contain active `intake_*` pageOrder entries after the quarantine.
- `BUILD_DIRECTIVE.md` is historical trace only and must not be followed for software-build tasks.
- `intake_staging/README.md` now records the dormant-capability boundary.
- This checkpoint should not include drop payloads or generated review artifacts unless explicit intake work is resumed.

## Checkpoint 3 - Intake Test Artifacts

Purpose: record that prior intake test payloads were removed from the active project surface.

Tracked deletions in active `drops/`:

- `projects/utah-forge/intake_staging/drops/2026-05-16_01-08-33_199sn0/**`
- `projects/utah-forge/intake_staging/drops/2026-05-16_01-15-38_15sfd4/**`
- `projects/utah-forge/intake_staging/drops/2026-05-16_01-32-03_1r8mdw/**`
- `projects/utah-forge/intake_staging/drops/2026-05-16_02-07-24_wtu012/**`
- `projects/utah-forge/intake_staging/drops/2026-05-16_02-12-44_uxm6dg/**`

Purged or emptied during intake context quarantine:

- `projects/utah-forge/intake_staging/archived_drops/**`
- `projects/utah-forge/intake_staging/drops/2026-05-18_00-18-33_stwdk8/**`
- `projects/utah-forge/intake_staging/drops/2026-05-18_01-03-27_128bzd/**`
- `projects/utah-forge/intake_staging/drops/2026-05-18_02-26-08_1471nu/**`
- `projects/utah-forge/intake_staging/drops/2026-05-19_10-48-56_1y7oit/**`
- `projects/utah-forge/intake_staging/LATEST_AI_REVIEW.json`
- `projects/utah-forge/intake_staging/LATEST_INTAKE_REVIEW.json`
- `projects/utah-forge/intake_staging/sample/**`
- `projects/utah-forge/pages/intake_*.json`
- `projects/utah-forge/pages/_archive/intake_*.json`
- `projects/utah-forge/overlays/intake_*/**`

Current notes:

- These were test inputs/review outputs, not current software-build context.
- This is a purge from the active workspace surface, not acceptance or rejection of any geophysical claim.
- Rendering/parity evidence under `projects/utah-forge/intake_staging/audits/` was left in place because it is software-build evidence, not an intake route source.

## Checkpoint 4 - Dev-Context Docs And Receipts

Purpose: group design notes, audits, HOLD notes, receipts, and open-loop documentation.

Modified docs:

- `docs/dev-context/GeoVox-Spine.md`
- `docs/dev-context/HOME.md`
- `docs/dev-context/Inference-Register.md`
- `docs/dev-context/Intake-Test-1.md`
- `docs/dev-context/Open-Loops.md`

Untracked docs:

- `docs/dev-context/Agent-Drift-Anchors.md`
- `docs/dev-context/Audits/**`
- `docs/dev-context/Change-Receipts/2026-05-16-shahbazi-overview-tiled-preview-visibility-fix.md`
- `docs/dev-context/Change-Receipts/2026-05-16-shahbazi-tls-tiled-preview-visual-verification.md`
- `docs/dev-context/Change-Receipts/2026-05-17-utah-forge-minimum-walkthrough-page-wiring.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-044-intake-route-state-audit.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-045-context-confirmation-route-selection-gate.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-045-user-context-response-bridge.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-046-intake-route-dispatcher-shell.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-047-route-selection-binding.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-048-open-appraisal-review-route.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-048-route-handler-generate-pdf-review.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-18-049-remove-local-directive-authority.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-19-050-intake-canonical-review-flow.md`
- `docs/dev-context/Future-Holds/**`
- `docs/dev-context/Intake-Route-State-Audit.md`
- `docs/dev-context/System-Requirements/**`

Current notes:

- Keep docs separate from code/config changes.
- HOLD notes are documentation only and should not be treated as implementation authority.

## Checkpoint 5 - Case Study B / Shahbazi

Purpose: isolate unrelated Case Study B changes from Utah FORGE work.

Files:

- `projects/case-study-b/pages/01_overview.json`
- `projects/case-study-b/pages/02_bench_walkthrough.json`

Current notes:

- These are unrelated to Utah FORGE rendering and intake cleanup.
- Review as a separate checkpoint or leave parked.

## Checkpoint 6 - Generated Reports

Purpose: isolate generated verification output.

Files:

- `docs/dev-context/Generated-Reports/project-artifact-coverage.json`
- `docs/dev-context/Generated-Reports/project-artifact-coverage.md`

Current notes:

- These were refreshed by `node tools/report-project-artifact-coverage.mjs`.
- Keep them as their own checkpoint or regenerate once after all functional checkpoints are finalized.

## Active Utah FORGE Page Archive Check

Deleted active page files with archive counterparts present:

- `02_untitled`: active missing, archive present
- `07_untitled`: active missing, archive present
- `10_untitled`: active missing, archive present
- `11_untitled`: active missing, archive present

Current notes:

- Non-intake page archive moves must still be reviewed with `project.json` before staging.
- Intake archive pages were removed during the intake context quarantine.

## Parked / Unclear Until Reviewed

- `projects/utah-forge/overlays/07_untitled/text.md`
- `projects/utah-forge/overlays/10_untitled/text.md`
- `projects/utah-forge/overlays/02_untitled/text.md`
- `projects/utah-forge/overlays/11_untitled/text.md`
- `projects/utah-forge/pages/_archive/**`

Current notes:

- These likely belong to non-intake page archive work, but should be reviewed with `project.json` and the active page order.

## Recommended Order

1. Checkpoint the MT rendering hotfix first.
2. Review and checkpoint intake system code separately.
3. Keep intake payloads out of active software-build context unless explicit intake work is resumed.
4. Stage archive moves only as paired delete/add moves for non-intake page archives.
5. Checkpoint dev-context docs and receipts.
6. Regenerate reports once at the end, or keep the current generated reports as their own checkpoint.

## Boundaries Held

- No reset.
- Intake test artifacts purged by explicit human instruction.
- No broad delete.
- No stash.
- No commit.
- No file content restoration.
- Logs and receipts preserved.
