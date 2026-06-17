# Transition Preservation Audit - 2026-06-16

## Summary

Audit scope: preserve recent Claude/Codex transition advancements before any
new Section ISO / isobar / isoline fade fix.

Current repo: `C:\GeoSee\GeoSee_Dev`

Current branch: `CODEX_Tansition_002`

Current head: `ea2d366 Claude transition integration`

Mode: report-only. No source/runtime/page implementation edits were made for
this audit.

Visual status: ready for visual check. Static source guards and log review were
performed, but no browser or human visual acceptance pass was run.

## Workspace Caveat

`git status --short --branch` reports `CODEX_Tansition_002` with pre-existing
tracked deletions under the old `Transition Architecture/**` and
`Y Axis issue/**` paths, plus untracked `01_issue audits/**`.

These old-path deletions are background audit-folder relocation/deletion noise.
They were not normalized, restored, staged, or otherwise touched by this audit.

## Active Contract Baseline

Read first, per the transition operating contract:

- `docs/dev-context/Transition-Runtime-Operating-Spec.md`
- `docs/dev-context/Transition-Constitution.md`
- `docs/dev-context/Transition-Continuity-Contract.md`
- `docs/dev-context/Transition-Guardrails.md`
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`
- relevant `docs/03-decisions.md` entries, especially DEC-071, DEC-098,
  DEC-099, DEC-100, DEC-153, DEC-163, DEC-164, DEC-165, DEC-166, DEC-167,
  and DEC-168.

Contract findings:

- `Transition-Runtime-Operating-Spec.md` defines page transitions as a
  deterministic diff between live source render graph and target resolved
  render graph. It forbids page-id/page-index/page-pair fixes and forbids using
  final full reapply as a visual fix.
- The same spec says derived roots must never appear at full opacity during a
  transition if created late, and that target geometry/material/data readiness
  must hold source or attach target at the current transition opacity.
- `Page-Transitions-And-Section-Frames.md` preserves Section ISO opacity
  composition as `authored x transition x attenuation`, and warns that Section
  ISO roots created by delayed height sampling must attach at the current
  transition opacity.
- DEC-099 says Section ISO roots should enter, exit, or crossfade on the page
  transition clock.
- DEC-100 later supersedes DEC-099 for active-to-inactive/unrelated target pages
  by forbidding source section masks, helpers, frame controls, ground traces,
  and Section ISO roots from carrying into inactive targets.
- The current user-visible requirement reopens only the Section ISO root part of
  that DEC-100 tradeoff: isobars/isolines should fade in/out when changing
  between pages where they are present and absent. Section masks, helper
  controls, ground traces, axes, cones, and frame controls should remain
  target-active no-bleed.

## Advancement Ledger

| Source | Preserved advancement | Guard/evidence | Regression risk to avoid |
| --- | --- | --- | --- |
| `55a0244 Fix high-priority transition runtime handoffs` | Commit gate, interruption lineage, readiness handoff tracing, and assignment-plan hardening. | `transition-commit-gate.test.mjs`, `transition-execution-plan.test.mjs`, `transition-high-fixes-source.test.mjs`. | Do not add final reapply or duplicate target assertion as a visual fix. |
| `6b00709 Smooth topo public surface transitions` | Numeric public-surface clip fields moved to continuous style tween; categorical clip state stays discrete. | `topo-transition-classification-source.test.mjs`. | Do not route topo/public-surface fields back through broad snapshot crossfade. |
| `151d629 Gate legend writes, declare discrete channels, clock overlays` | Legend writes are authoring-target gated, color/material channels are explicit discrete channels, scene overlays use the transition clock. | `transition-entity-channel-policy.test.mjs`, legend source guards from Phase 1 reports. | Do not let transition work persist UI writes to the wrong page or invent undeclared interpolation channels. |
| `d547321 Gate matrix capture readiness on canvas and controller` | Matrix capture waits for canvas/controller readiness. | Matrix reports show capture failures `0` in the core sample. | Do not use matrix case ids as runtime policy or remediation criteria. |
| `035e3a8 Fade section helper disable handoffs through exit snapshots` | Helper disable handoffs fade via snapshots instead of popping. | `scene-section-helper-transition-source.test.mjs`. | Current Section ISO fix must not broaden helper carryover; helper no-bleed remains separate from derived ISO root fade policy. |
| `28ef38b Fix Y section frame helper orientation (right-handed basis)` | DEC-165: helper orientation uses `tangentA x tangentB` as the basis third column so Y helper visuals render in the correct plane. | `scene-section-frame-orientation-source.test.mjs`; Claude Y-axis root-cause report. | Do not alter settled helper orientation while fixing Section ISO roots. Do not conflate DEC-165 with Section ISO fade ownership. |
| `28ef38b` / DEC-164 code path | Scene-section frame transitions partition by stable frame id; surviving frames move while changed frames dissolve. | `scene-section-frame-partition-source.test.mjs`, `scene-section-transition-behavior-source.test.mjs`. | Do not restore a global all-or-nothing section snap. |
| `9b3f771 Harden transition runtime handoffs` | Claude worktree runtime-scope delta integrated: detached fade defaults, scalar/discrete declarations, preview visibility preservation, local atmosphere discrete declarations, transition interrupt finalization, perf/test scaffolding. | Source guard batch in this audit. | Do not damage `DEFAULT_DETACHED_FADE_MS`, scalar tween eligibility, preview environment visibility, local atmosphere declarations, or interrupt-finalize ownership. |
| `ea2d366 Claude transition integration` | Deck-state integration: `138_page`, `182_page`, `182_page` overlay, and page order changes. | Commit stat only; deck-state context. | Do not use these page ids/order changes as app-health proof or runtime fix targets. |

## Claude Worktree Lineage

Claude source worktree inspected:
`C:\GeoSee\Claude_WT\GeoSee_Dev\reverent-torvalds-e40a9c`

Current worktree branch: `claude/reverent-torvalds-e40a9c`

Claude branch head: `28ef38b Fix Y section frame helper orientation
(right-handed basis)`

Claude worktree still contains the dirty runtime-scope delta that was integrated
as `9b3f771`, plus the worktree-only launcher/cache/deck noise that was already
classified earlier. Current local `main`/`CODEX_Tansition_002` already contains
the integrated runtime source/docs/tests and the deck-state commit. Preserve the
Claude worktree and branch unless a separate cleanup request is made.

## Contract Conflicts

### C1 - Section ISO exit fade versus DEC-100 target-inactive no-bleed

Current source shape:

- `transitionEffectiveLayersForPage.ts` detects Section ISO root state changes
  when a source visible root becomes absent/hidden in the target.
- It calls `beginSectionIsoOverlayTransition(...)` when
  `sceneSectionDiscreteChanged || sectionIsoRootStateChanged`.
- `SceneManager.sectionIsoOverlayTransitionShouldStart(...)` returns true only
  for active-to-active or inactive-to-active section states.
- Active-to-inactive therefore returns early before Section ISO roots are
  snapshotted for an exit fade.

Result:

- Source Section ISO roots are cleared by inactive target style application
  instead of fading out.
- This matches DEC-100 and the current source guard, but it conflicts with the
  current user requirement and with the older DEC-099 fade model.

Required decision before code:

- Add a narrow durable decision that supersedes DEC-100 only for visual-only
  Section ISO overlay-root exit snapshots.
- Keep source section masks, helper controls, frame controls, axes, cones,
  ground traces, and data clipping target-active no-bleed.
- Treat Section ISO exit roots as detached transition snapshots with opacity
  ownership only; they must not preserve target section semantics, target masks,
  helper controls, or live section state into an inactive page.

### C2 - Passing tests currently include stale Section ISO behavior

`tests/tools/section-iso-transition-smoothing-source.test.mjs` has a passing
test named `Section ISO roots are not snapshotted for inactive or unrelated
target pages`.

That guard is now stale relative to the requested isobar/isoline fade behavior.
It should be replaced by narrower assertions:

- active-to-inactive Section ISO roots may snapshot only as visual exit roots;
- inactive target section masks/helpers/controls still apply immediately;
- no source helper snapshot or source section mask tween is introduced by the
  ISO-root exception;
- interruption discards transition-owned roots without promoting target roots
  to full opacity.

### C3 - Enter snap remains a readiness/target-root preparation issue

Inactive-to-active transitions are allowed to start a Section ISO transition,
but target roots can still appear late if target Section ISO geometry is not
prepared before or during the transition envelope.

Existing source already contains these hardening points:

- `transitionAwareSectionIsoOverlayUpdateOptions(...)` injects
  `initialTransitionOpacity` for active target transitions.
- `sectionIsoOverlayUpdateHeldByTransition(...)` holds duplicate target-root
  rebuilds once populated target roots exist.
- delayed height-sampler retries are expected to attach at current transition
  opacity.

Remaining risk:

- target roots may not be built early enough when the source page has no active
  section state and `lastSceneSectionStyle` has no active planes for target
  generation.
- A later fix must prove target root preparation against synthetic inactive to
  active fixtures, not rely on live Utah page pairs.

## Remaining Issue Inventory

| ID | Issue | Evidence | Fix owner later |
| --- | --- | --- | --- |
| ISO-001 | Active-to-inactive Section ISO/isobar/isoline roots snap out. | Current tune log plus source inspection of `sectionIsoOverlayTransitionShouldStart`. | `src/scene/SceneManager.ts`, `src/scene/transitions/transitionEffectiveLayersForPage.ts`, tests/docs. |
| ISO-002 | Inactive-to-active Section ISO roots can attach late or at final apply rather than fading in. | DEC-099, transition tune log, current target-root preparation comments. | Section ISO target preparation path and synthetic readiness/attach tests. |
| ISO-003 | Current guard suite locks stale inactive-target no-snapshot behavior. | `section-iso-transition-smoothing-source.test.mjs` passing subtest 4. | Rewrite source guard around detached ISO exit roots plus no-bleed helpers. |
| ISO-004 | Existing matrix evidence has no Section ISO entries, so it cannot prove or disprove the current snap. | `transition-analysis.md` shows `sectionIsoEntries 0`, `sectionIsoRenderOpacityMismatch 0`. | New synthetic tests and optional narrow runtime capture after code. |
| ISO-005 | Section helper snapshots and Section ISO roots are easy to conflate. | Phase 1 SYN-001 and Y-axis audits distinguish helper snapshots, helper orientation, and ISO roots. | Keep helper no-bleed tests separate from ISO root tests. |
| ISO-006 | Readiness/attach timing remains undercovered. | Agent D and synthesis recommend synthetic readiness/attach fixtures. | Add a target-only loading/late-root fixture before claiming app-health proof. |

## Evidence Index

Markdown logs reviewed:

- `01_issue audits/00_Transition Tune/TRANSITION-TUNE-LOG-20260616-CODEX.md`
- `01_issue audits/01_Transition Architecture/PROMPT-transition-architecture-audit-and-method.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/PROMPT-phase1-transition-defect-inventory.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/P1-claude-opus48-20260613-transition-defect-inventory.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/codex-phase1-transition-diagnosis-20260613-7a94c1.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/deep-research-report.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/REPORT-agent-a-scene-section-phase1-20260613T132218.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/REPORT-agent-b-mt-phase1-20260613T132218.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/REPORT-agent-c-seismic-entities-phase1-20260613T132218.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/REPORT-agent-d-camera-env-commit-phase1-20260613T132218.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/REPORT-synthesis-phase1-transition-defect-inventory-20260613T132218.md`
- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/evidence-coordinator-matrix-core-20260613T132218/transition-analysis.md`
- `01_issue audits/complete_y_axis issue/YAX-claude-opus48-20260613-handedness-rootcause.md`
- `01_issue audits/complete_y_axis issue/YAX-claude-opus48-20260613-02-second-audit-inconsistencies.md`
- `01_issue audits/complete_y_axis issue/YAXIS-FULL-AUDIT-20260613-CODEX-RUNTIME-5F9A.md`
- `01_issue audits/complete_y_axis issue/YAXIS-DEEP-AXIS-TRANSITION-ISSUES-REGISTER-20260613-B7A4.md`
- `01_issue audits/complete_y_axis issue/YAXIS-DEEP-AXIS-TRANSITION-REVIEW-20260613-FRESH-B7A4.md`
- `01_issue audits/complete_y_axis issue/YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B-FULL.md`
- `01_issue audits/complete_y_axis issue/YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B-RECOMMENDATIONS.md`
- `01_issue audits/complete_y_axis issue/YAXIS-AUDIT-20260613-8C7F.md`
- `01_issue audits/complete_y_axis issue/GEOSEE-Y-AXIS-RUNTIME-AUDIT-20260613-123935-CODEX.md`
- `01_issue audits/complete_y_axis issue/y-axis-audit-findings-20260613-112351.md`
- `01_issue audits/complete_y_axis issue/codex-yaxis-section-logic-audit-20260613-vi-0f6b83.md`
- `01_issue audits/complete_y_axis issue/codex-yaxis-findings-20260613-planmode-8c71f2.md`
- `01_issue audits/complete_y_axis issue/codex-yaxis-deep-patch-audit-20260613-vi-4e2a91.md`

Selected evidence artifacts reviewed:

- `01_issue audits/01_Transition Architecture/Phase_1_Diagnosis/evidence-coordinator-matrix-core-20260613T132218/transition-analysis.md`

Generated bulk intentionally skipped except as summarized by logs:

- matrix PNGs
- per-frame JSON traces not directly required by the report
- broad adjacent transition matrix output
- PDF summaries

Reason for skip: the selected audit depth requested log preservation plus
selected evidence deep dive, not broad generated-artifact reanalysis. The core
matrix summary already records that its sampled cases had `sectionIsoEntries 0`
and therefore cannot prove the current Section ISO fade defect.

## Fix Boundary For Later Implementation

Do:

- Add a narrow decision entry that distinguishes visual-only Section ISO root
  fade snapshots from scene-section helper/mask carryover.
- Keep the fix page-agnostic and rooted in transition entity/channel ownership.
- Preserve `sectionIsoStableLayerIds` for visible-on-both continuity.
- Preserve DEC-168 pure move behavior: unchanged Section ISO roots follow the
  moving cut instead of crossfading.
- Attach late target roots at the current transition envelope.
- Add synthetic source/runtime tests before code changes, especially for
  active-to-inactive ISO exit and inactive-to-active ISO enter.

Do not:

- Edit `projects/*/pages/**`, overlays, project page order, or environment JSON
  as a transition fix.
- Reintroduce global all-or-nothing section snapping.
- Make helper controls, section masks, frame controls, ground traces, axes, or
  cones bleed into inactive targets.
- Use final target-style replay as a visual fix.
- Rebuild helper geometry every transition tick except the already documented
  DEC-168 move-follow path.
- Damage MT full-density scalar transition ownership, scalar edge/isoline
  generation, `scalarInclusionFilterActive`, `SCALAR_TRANSITION_STYLE_FIELDS`,
  or local Full Cloud/Spectrum mode transition semantics.
- Weaken exact-key transition entity ownership.
- Treat live Utah page pairs as app-health proof.
- Treat static source guard success as visual acceptance.

## Test Plan For Later Fix

Required pre-code test work:

- Replace the stale inactive-target Section ISO no-snapshot source guard with a
  guard that permits detached ISO exit roots only.
- Add synthetic tests for:
  - active source Section ISO roots -> inactive target: source ISO roots fade to
    zero while section masks/helpers are immediately target-inactive.
  - inactive source -> active target: target ISO roots attach at zero/current
    envelope and fade in.
  - active -> active incompatible ISO root state: source/target roots crossfade.
  - active -> active pure move: ISO roots follow the cut and do not crossfade.
  - delayed target generation: late roots attach at current transition opacity.
  - interruption: transition-owned roots discard without full-opacity promotion.

Required guard batch after implementation:

```powershell
node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"
node tests/tools/section-iso-transition-source.test.mjs
node tests/tools/section-iso-transition-smoothing-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/scene-section-helper-transition-source.test.mjs
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scalar-tween-eligibility-source.test.mjs
node tests/tools/discrete-field-declaration-source.test.mjs
node tests/tools/preview-environment-visibility-source.test.mjs
node tests/tools/local-atmosphere-volume-source.test.mjs
node tests/tools/transition-commit-gate.test.mjs
node tests/tools/transition-execution-plan.test.mjs
node tests/tools/transition-render-graph-adapter.test.mjs
node tests/tools/transition-entity-opacity-executor.test.mjs
node tests/tools/transition-entity-channel-policy.test.mjs
node tests/tools/transition-executor-registry.test.mjs
node tests/tools/transition-dispatch-order-source.test.mjs
node tests/tools/transition-interrupt-finalize-source.test.mjs
node tests/tools/topo-transition-classification-source.test.mjs
```

Visual acceptance remains separate. After source/static checks pass, browser
work should inspect representative enter/exit routes and report `ready for
visual check` unless a human or running browser inspection confirms the screen.

## Static Verification Run During This Audit

Initial command typo:

- A first PowerShell batch failed before running tests because the quoted
  `await` string was parsed by PowerShell. This did not execute test code.

Successful rerun:

- `node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"`
- `node tests/tools/transition-commit-gate.test.mjs`
- `node tests/tools/transition-execution-plan.test.mjs`
- `node tests/tools/transition-render-graph-adapter.test.mjs`
- `node tests/tools/transition-entity-opacity-executor.test.mjs`
- `node tests/tools/transition-entity-channel-policy.test.mjs`
- `node tests/tools/transition-executor-registry.test.mjs`
- `node tests/tools/transition-dispatch-order-source.test.mjs`
- `node tests/tools/transition-interrupt-finalize-source.test.mjs`
- `node tests/tools/transition-high-fixes-source.test.mjs`
- `node tests/tools/environment-scene-transition-source.test.mjs`
- `node tests/tools/topo-transition-classification-source.test.mjs`
- `node tests/tools/scene-section-active-to-inactive-source.test.mjs`
- `node tests/tools/scene-section-frame-orientation-source.test.mjs`
- `node tests/tools/scene-section-frame-partition-source.test.mjs`
- `node tests/tools/scene-section-helper-transition-source.test.mjs`
- `node tests/tools/scene-section-object-visibility-source.test.mjs`
- `node tests/tools/scene-section-transition-behavior-source.test.mjs`
- `node tests/tools/section-iso-transition-source.test.mjs`
- `node tests/tools/section-iso-transition-smoothing-source.test.mjs`
- `node tests/tools/scalar-tween-eligibility-source.test.mjs`
- `node tests/tools/discrete-field-declaration-source.test.mjs`
- `node tests/tools/preview-environment-visibility-source.test.mjs`
- `node tests/tools/local-atmosphere-volume-source.test.mjs`

Result: `ALL SOURCE GUARDS PASSED`.

Important interpretation: this proves the current guard suite is internally
consistent. It does not prove the requested Section ISO enter/exit fade works,
because one currently passing guard asserts stale inactive-target no-snapshot
behavior.

## Bottom Line

The next fix should be narrow and contract-first. The protected advancements
from Claude/Codex are real and test-backed: right-handed helper orientation,
per-frame section partition, helper stability, protected MT scalar ownership,
exact-key transition execution, commit/interruption gates, and page-agnostic
guards.

The remaining Section ISO/isobar/isoline snap is a specific derived-root
lifecycle conflict, not a reason to unwind those advancements. The safest
implementation path is to supersede DEC-100 only for detached, visual-only
Section ISO exit roots while preserving target-active no-bleed for section
masks, helpers, controls, ground traces, axes, and live section state.
