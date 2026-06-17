# Transition Tune Log - 2026-06-16

## Session State

- Repo: `C:\GeoSee\GeoSee_Dev`
- Branch: `CODEX_Tansition_002`
- Purpose: Section ISO / isobar / isoline transition tuning.
- Current user request: make Section ISO bands and isolines fade in/out when navigating between pages where they are present and pages where they are absent.
- Visual status: static audit only; ready for visual check after implementation and browser inspection.

## Working Tree Note

At log start, `git status --short --branch` reported branch `CODEX_Tansition_002` with many pre-existing deletions under old audit folders:

- `Transition Architecture/**`
- `Y Axis issue/**`

It also reported the new untracked audit folder:

- `01_issue audits/`

Do not stage, restore, delete, or normalize the old audit-folder deletions as part of the Section ISO runtime fix unless explicitly requested. Runtime/source changes should be staged by exact path only.

## Audit Summary

The snap is page-agnostic runtime behavior, not a page-fixture problem.

Observed static root causes:

1. Exit snap:
   - `transitionEffectiveLayersForPage.ts` detects Section ISO root state changes and calls `beginSectionIsoOverlayTransition`.
   - `SceneManager.sectionIsoOverlayTransitionShouldStart` then rejects active-to-inactive section transitions.
   - Result: source Section ISO overlay roots are not snapshotted, so they are cleared by the inactive target apply instead of fading out.

2. Enter snap:
   - inactive-to-active can start a Section ISO transition, but target ISO roots may not be built early.
   - overlay generation reads `lastSceneSectionStyle`; when the source page is inactive, active target planes are not available yet.
   - transition frames intentionally skip ISO regeneration to avoid move/crossfade conflicts.
   - Result: target roots can appear only at final full apply instead of fading in from the page clock.

3. Contract conflict:
   - DEC-099 says Section ISO overlay roots should enter/exit fade.
   - DEC-100 later forbids active-to-inactive Section ISO root carryover with section masks/helpers.
   - The requested behavior requires a narrow superseding decision: section masks/helpers/frame controls remain target-active no-bleed, but derived Section ISO overlay roots may fade out as transition snapshots.

## Representative Deck-State Routes

These are reproduction routes only, not fix targets:

- Exit: `171_page` "Resistivity Isobars" -> `173_page` "Resistivity Iso-surfaces"
- Enter: `176_page` -> `138_page`
- Exit: `182_page` -> `131_page`

The reusable fix must not depend on page IDs, page titles, page order, or project fixtures.

## Implementation Plan

1. Add a durable decision entry in `docs/03-decisions.md` that supersedes DEC-100 only for Section ISO overlay-root exit fading.
2. Adjust Section ISO transition start gating in `src/scene/SceneManager.ts` so enter, exit, and incompatible active-to-active ISO changes can all create the narrow Section ISO transition owner.
3. Add target-root preparation that builds target Section ISO roots against the target section style at the current transition opacity, without waiting for final full apply.
4. Keep DEC-168 pure-move behavior intact: unchanged ISO roots should follow the moving cut, not crossfade.
5. Update source guards that currently lock inactive-target Section ISO no-snapshot behavior.
6. Add or update synthetic page-agnostic tests for:
   - Section ISO exit fade from source roots to zero.
   - Section ISO enter fade from zero/current envelope to target opacity.
   - MT volume, seismic volume, and resistivity-on-seismic Section ISO roots.
   - interruption cleanup with no leaked `sectionIsoOverlayTransitionRoot`.

## Verification To Run After Implementation

- `node tests/tools/section-iso-transition-smoothing-source.test.mjs`
- `node tests/tools/section-iso-transition-source.test.mjs`
- `node tests/tools/scene-section-transition-behavior-source.test.mjs`
- `node tests/tools/transition-page-agnostic-source.test.mjs`
- Additional changed/new source guards for Section ISO enter/exit behavior.
- `npm run check:workspace`
- `npm run check:visual-qa-clean`
- `npm run build`
- Targeted Playwright/browser check for representative ISO enter and exit routes.

Report visual status as `ready for visual check` unless browser inspection confirms the screen.
