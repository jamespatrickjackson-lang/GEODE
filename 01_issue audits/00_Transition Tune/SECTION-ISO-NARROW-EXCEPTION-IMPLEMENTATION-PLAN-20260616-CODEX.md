# Section ISO Narrow Exception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining Section ISO/isobar/isoline snap by adding one narrow derived-root fade exception while preserving target-inactive no-bleed for live scene-section state and all non-ISO section visuals.

**Architecture:** The fix must keep transition classification in `src/scene/transitions/transitionEffectiveLayersForPage.ts` and Section ISO root lifecycle in `src/scene/SceneManager.ts`. The only behavior change is Section ISO derived-root presence/classification and root fade lifecycle; section masks, helpers, controls, ground traces, axes, cones, frame outlines, MT scalar ownership, exact-key execution, and transition commit/interruption gates remain protected.

**Tech Stack:** Vite, React, TypeScript, Three.js, Node source guards, Playwright only for later browser evidence.

---

## Current Baseline

- Repo: `C:\GeoSee\GeoSee_Dev`
- Branch: `CODEX_Tansition_002`
- HEAD: `ea2d366`
- Dedicated branch test URL: `http://127.0.0.1:42902/`
- Dedicated URL status during plan creation: HTTP `200`
- Port isolation observed during plan creation:
  - `127.0.0.1:42902` -> node, dedicated branch server
  - `127.0.0.1:5173` -> node, existing server
  - `127.0.0.1:5177` -> node, existing server
  - `127.0.0.1:5182` -> node, existing server
- Do not run `Launch GeoSee.bat`.
- Do not reuse ports `5173`, `5177`, or `5182`.
- If the dedicated branch server is restarted, use:

```powershell
npm run dev -- --host 127.0.0.1 --port 42902 --strictPort
```

## Workspace Caveat

`git status --short --branch` was run before writing this plan. The tree already contained unrelated/background state:

- tracked deletions under old `Transition Architecture/**`
- tracked deletions under old `Y Axis issue/**`
- untracked `01_issue audits/**`
- untracked `docs/Capture Director/**`

Those paths are not implementation scope for the Section ISO fix. Later staging must use exact paths only.

## Narrow Exception Language

This language is the center of the later fix. It is intentionally narrow and must not be widened during implementation.

Allowed:

- A detached, visual-only Section ISO source root may be snapshotted and faded to zero during `active -> inactive` or `active -> unrelated` transitions.
- The detached root exists only as a transition-owned visual fade artifact.
- The detached root must not remain live after the transition finishes or is discarded.
- The detached root must use the page transition clock and composed Section ISO opacity path.

Not allowed:

- This exception must not carry live scene-section state into an inactive target.
- This exception must not keep source section masks active in an inactive target.
- This exception must not create or preserve source section helper snapshots for inactive target pages.
- This exception must not carry source frame controls, frame outlines, push/pull cones, axes, axis labels, ground traces, dashed traces, crop boxes, or live section clipping into inactive targets.
- This exception must not promote interrupted target roots to full opacity.
- This exception must not change MT full-density scalar transition ownership.
- This exception must not use page id, page filename, page title, page number, page index, page order, live Utah page pairs, or fixture-specific logic.

Contract interpretation:

- DEC-100 and TRD-012 remain authoritative for scene-section masks, helpers, controls, frame visuals, ground traces, axes, live clipping, and inactive target application.
- The later decision entry should supersede DEC-100/TRD-012 only where those entries forbid a detached visual-only Section ISO source-root fade-out.
- The exception restores the DEC-099 Section ISO root exit fade only for the derived overlay root, not for the live section system.

## State Machine Acceptance

The later implementation is acceptable only if every state transition below keeps its assigned behavior:

| Transition | Required behavior |
| --- | --- |
| `active -> inactive` | Detached source Section ISO roots fade to zero; live section state applies inactive target immediately. |
| `active -> unrelated` | Same as `active -> inactive`; no page-pair special case. |
| `inactive -> active` | Target Section ISO roots attach at zero or the current transition envelope and fade in. |
| `active -> active incompatible` | Source and target Section ISO roots crossfade. |
| `active -> active pure move` | No Section ISO crossfade starts; DEC-168 move-follow remains active. |
| interrupted transition | Transition-owned roots discard without full-opacity promotion. |

## Regression Locks

These behaviors are protected and must be checked explicitly:

- No helper snapshot is created for inactive target pages.
- `applySceneSectionPlanes(targetSceneSectionStyle)` still runs immediately for inactive targets.
- `discardSectionIsoOverlayTransition()` never promotes source or target roots to full opacity.
- `sectionIsoStableLayerIds` continues to protect visible-on-both continuity.
- DEC-168 pure move behavior remains intact: unchanged Section ISO roots follow the moving cut instead of crossfading.
- DEC-164 per-frame section partition remains intact.
- DEC-165 right-handed helper orientation remains intact.
- Helper material/root stability is not weakened.
- Exact-key transition execution remains intact.
- MT full-density scalar transition kind, inclusion semantics, scalar range interpolation, scalar legend target authority, and scalar edge/isoline overlay generation remain unchanged.
- Transition commit/interruption gates remain intact.
- No project page, overlay, project order, environment, or Utah deck fixture edit is allowed as an app-behavior fix.

## Implementation Boundary

Later source changes are limited to:

- `C:\GeoSee\GeoSee_Dev\src\scene\transitions\transitionEffectiveLayersForPage.ts`
  - make Section ISO root presence section-active-aware;
  - classify active source roots as absent on section-inactive targets even when stale ISO style fields remain true;
  - ensure source-only ISO exit fade setup happens before inactive target application clears live roots;
  - preserve pure move no-crossfade behavior.
- `C:\GeoSee\GeoSee_Dev\src\scene\SceneManager.ts`
  - allow a Section ISO transition to start for detached source-only exit roots;
  - avoid empty source-only transitions;
  - keep target-root enter/crossfade behavior unchanged;
  - keep late target roots attaching at current transition opacity;
  - keep discard separate from commit.
- Focused tests and docs only.

Later source changes must not touch:

- `projects/*/pages/**`
- `projects/*/overlays/**`
- `projects/*/project.json`
- `projects/*/environment.json`
- `Launch GeoSee.bat`
- MT full-density scalar transition declarations unless a failing guard proves an accidental import/order-only adjustment is necessary.

## Planned Documentation Change

Add one durable decision entry to `C:\GeoSee\GeoSee_Dev\docs\03-decisions.md`.

Required decision content:

- Title should identify the exception as Section ISO detached-root exit fade.
- It must state that DEC-100/TRD-012 are superseded only for detached visual-only Section ISO source-root fade-out.
- It must state that DEC-100/TRD-012 remain authoritative for live section state, masks, helpers, controls, frame visuals, ground traces, axes, and inactive target application.
- It must state that source roots are transition-owned and removed/discarded at transition end or interruption.
- It must state that no page-fixture logic is allowed.

Optional matching docs, only if needed to keep contracts consistent:

- `C:\GeoSee\GeoSee_Dev\docs\dev-context\Transition-Runtime-Operating-Spec.md`
- `C:\GeoSee\GeoSee_Dev\docs\dev-context\Transition-Decision-Log.md`
- `C:\GeoSee\GeoSee_Dev\docs\dev-context\Page-Transitions-And-Section-Frames.md`

## Task 1: Write Failing Guards First

**Files:**

- Modify: `C:\GeoSee\GeoSee_Dev\tests\tools\section-iso-transition-smoothing-source.test.mjs`
- Modify as needed: `C:\GeoSee\GeoSee_Dev\tests\tools\section-iso-transition-source.test.mjs`
- Preserve/tighten: `C:\GeoSee\GeoSee_Dev\tests\tools\scene-section-transition-behavior-source.test.mjs`

- [ ] Replace the stale assertion that inactive or unrelated target pages must not snapshot Section ISO roots.
- [ ] Add an assertion that source-only detached Section ISO exit roots are permitted only when source section state is active and target section state is inactive or unrelated.
- [ ] Add an assertion that inactive target pages still suppress helper snapshots.
- [ ] Add an assertion that inactive target pages still call `applySceneSectionPlanes(targetSceneSectionStyle)` immediately.
- [ ] Add an assertion that pure move logic still avoids Section ISO crossfade and remains under DEC-168 follow behavior.
- [ ] Add an assertion that `discardSectionIsoOverlayTransition()` still does not call `applyRenderOpacityToTree(root.group, 1, 1)`.

Run:

```powershell
node tests/tools/section-iso-transition-smoothing-source.test.mjs
node tests/tools/section-iso-transition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
```

Expected before source changes:

- At least the new detached ISO exit-root expectation fails.
- Existing protected no-bleed assertions continue to pass or fail only where the stale wording is being replaced.

## Task 2: Add Narrow Docs Decision

**Files:**

- Modify: `C:\GeoSee\GeoSee_Dev\docs\03-decisions.md`
- Modify only if contract wording would otherwise remain contradictory:
  - `C:\GeoSee\GeoSee_Dev\docs\dev-context\Transition-Runtime-Operating-Spec.md`
  - `C:\GeoSee\GeoSee_Dev\docs\dev-context\Transition-Decision-Log.md`
  - `C:\GeoSee\GeoSee_Dev\docs\dev-context\Page-Transitions-And-Section-Frames.md`

- [ ] Add the narrow decision entry.
- [ ] Use the exact exception language from this plan.
- [ ] Keep DEC-100/TRD-012 no-bleed authority intact for every non-ISO-root section visual.
- [ ] Do not rewrite old decisions; add a new superseding/refining entry.

Run:

```powershell
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/section-iso-transition-smoothing-source.test.mjs
```

Expected:

- Guard wording matches the new decision.
- The docs no longer encode a broad ban on detached Section ISO exit roots.
- The docs still ban helper/mask/control/frame/ground/axis bleed into inactive targets.

## Task 3: Implement Section-Active-Aware ISO Root Presence

**Files:**

- Modify: `C:\GeoSee\GeoSee_Dev\src\scene\transitions\transitionEffectiveLayersForPage.ts`

- [ ] Make Section ISO root presence require the related section state to be transition-active, not only `sectionIsoEnabled` and layer visibility.
- [ ] Ensure a target with `sceneSectionEnabled !== true` resolves target Section ISO root presence as absent.
- [ ] Ensure active source roots can be detected before inactive target application clears live groups.
- [ ] Preserve `sectionIsoStableLayerIds` for visible-on-both continuity.
- [ ] Preserve DEC-168 pure move no-crossfade behavior.

Run:

```powershell
node tests/tools/section-iso-transition-smoothing-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
```

Expected:

- Section ISO presence guards pass.
- Scene-section target-inactive no-bleed guards pass.
- DEC-164 partition guard passes.

## Task 4: Implement Detached Source-Only Root Fade Lifecycle

**Files:**

- Modify: `C:\GeoSee\GeoSee_Dev\src\scene\SceneManager.ts`

- [ ] Allow `beginSectionIsoOverlayTransition(...)` to start when the source has active Section ISO roots and the target section is inactive.
- [ ] Snapshot source roots before the inactive target apply clears live roots.
- [ ] Do not require target roots for source-only exit fades.
- [ ] Do not create an empty Section ISO transition when no source roots and no target roots exist.
- [ ] Keep target-root registration and late target attach behavior unchanged.
- [ ] Keep `discardSectionIsoOverlayTransition()` as discard-only, never promote-to-full.
- [ ] Keep `commitSectionIsoOverlayTransition()` responsible for completed transition cleanup only.

Run:

```powershell
node tests/tools/section-iso-transition-smoothing-source.test.mjs
node tests/tools/section-iso-transition-source.test.mjs
node tests/tools/transition-interrupt-finalize-source.test.mjs
```

Expected:

- Source-only exit root fade guards pass.
- Enter/crossfade/delayed attach guards pass.
- Interruption/finalize guards pass.

## Task 5: Run Protected Guard Batch

Run after source/docs/tests are changed:

```powershell
node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"
node tests/tools/transition-commit-gate.test.mjs
node tests/tools/transition-execution-plan.test.mjs
node tests/tools/transition-render-graph-adapter.test.mjs
node tests/tools/transition-entity-opacity-executor.test.mjs
node tests/tools/transition-entity-channel-policy.test.mjs
node tests/tools/transition-executor-registry.test.mjs
node tests/tools/transition-dispatch-order-source.test.mjs
node tests/tools/transition-interrupt-finalize-source.test.mjs
node tests/tools/transition-high-fixes-source.test.mjs
node tests/tools/environment-scene-transition-source.test.mjs
node tests/tools/topo-transition-classification-source.test.mjs
node tests/tools/scene-section-active-to-inactive-source.test.mjs
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-helper-transition-source.test.mjs
node tests/tools/scene-section-object-visibility-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/section-iso-transition-source.test.mjs
node tests/tools/section-iso-transition-smoothing-source.test.mjs
node tests/tools/scalar-tween-eligibility-source.test.mjs
node tests/tools/discrete-field-declaration-source.test.mjs
node tests/tools/preview-environment-visibility-source.test.mjs
node tests/tools/local-atmosphere-volume-source.test.mjs
```

Expected:

- All guards pass.
- Any failure must be classified as either expected stale guard wording, actual regression, or unrelated existing workspace condition before continuing.

## Task 6: Run Build And Workspace Checks

Run:

```powershell
npm run check:workspace
npm run check:visual-qa-clean
npm run build
git diff --check
```

Expected:

- Workspace checks pass or report only pre-existing unrelated dirty state that is not staged.
- Build passes.
- `git diff --check` passes.

If browser or QA commands generate page/project dirt, restore only QA-created paths and rerun `npm run check:visual-qa-clean`.

## Task 7: Focused Browser Evidence

Use only the isolated branch server:

- URL: `http://127.0.0.1:42902/`
- Do not use `5173`, `5177`, or `5182`.
- Do not run `Launch GeoSee.bat`.
- Do not use live Utah page pairs as app-health proof.
- Runtime/browser observation may use a known reproduction pair as visual evidence only, labeled deck-state or reproduction evidence.
- App-health proof must remain the synthetic/source guard suite.

Visual checks to perform:

- Active Section ISO/isobar/isoline page to inactive section page: ISO roots fade out instead of snapping out.
- Inactive section page to active Section ISO/isobar/isoline page: ISO roots fade in instead of snapping in.
- Pure section move: ISO follows the cut under DEC-168 and does not crossfade.
- Interrupted transition: roots discard without full-opacity promotion.

Final visual status wording:

- Use `ready for visual check` unless a running browser or human inspection confirms the screen.

## Commit Hygiene For Later Implementation

Do not stage or commit while creating this plan document unless explicitly requested.

When implementation is later approved:

- Stage exact paths only.
- Exclude unrelated old audit-folder deletions, `docs/Capture Director/**`, project page/overlay/project/environment fixture changes, launcher edits, cache files, and QA-created page dirt unless explicitly in scope.
- Run `git diff --cached --check` before commit.

Suggested later commit message:

```text
Fade detached Section ISO exits
```

## Current Pass Result

This file is a plan artifact only. No runtime/source/docs contract implementation, tests, page fixtures, or project data were changed by this pass.
