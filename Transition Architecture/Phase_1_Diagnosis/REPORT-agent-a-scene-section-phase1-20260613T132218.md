# 1. Report ID

PHASE1-A-SCENE-SECTION-20260613T132218

Scope: Agent A scene-section, Section ISO, working-area masks, helper stability, and DEC-164/DEC-165 verification.

Status: read-only diagnosis. Runtime/source/page/project JSON changes: none. Writes limited to this Markdown report and evidence artifacts under `Transition Architecture/Phase_1_Diagnosis/evidence-agent-a-scene-section-20260613T132218/`.

# 2. Summary Verdict

Defect count by family:

| Family | Count | Verdict |
| --- | ---: | --- |
| Scene-section active-to-inactive helper lifecycle | 1 | Open defect: helper exit snapshot contradicts DEC-100/TRD-012 no-bleed wording. |
| DEC-164 per-frame section move/dissolve | 0 | Verified clean by source tests and live deck-state evidence. |
| DEC-165 helper orientation | 0 | Verified clean by source tests and settled live Y-helper geometry. |
| Helper stability during transition frames | 0 | Verified clean by source tests and live `helperRebuildMs: 0` during transition frames. |
| Section ISO opacity/root lifecycle | 0 functional defects reproduced | Source guards pass; live sampled paths exposed opacity policy and transition envelope but no populated transition roots. Needs a root-pop fixture. |
| Working-area focus masks | 0 functional defects reproduced | Live masks tweened through runtime debug; focused source guard is missing. |

Recommendation: harden incrementally. A rewrite is not justified by this scope. The observed residual defect is a narrow contract/implementation mismatch, not evidence of an untamable transition model. The smallest sufficient path is to reconcile active-to-inactive helper exit behavior with DEC-100/TRD-012, then add focused source/runtime guards for helper no-bleed, working-area focus interpolation, and populated Section ISO roots.

# 3. Defect Inventory

## A-SCENE-001 - Active-to-inactive helper exit snapshot violates no-bleed contract

Behavior family: scene-section helper lifecycle, active-to-inactive target-active guard.

Reproduction:

- Evidence type: deck-state evidence only, not app-health proof.
- Base URL: `http://127.0.0.1:5173/?project=utah-forge`.
- Navigation: page-controller transition from index `11` (`172_page`, active section with X and Y frames, Section ISO enabled) to index `28` (`163_page`, `sceneSectionEnabled: false`, working-area focus enabled).
- Command: `node "Transition Architecture\Phase_1_Diagnosis\evidence-agent-a-scene-section-20260613T132218\collect-agent-a-scene-section-evidence.mjs"`.
- Evidence artifact: `Transition Architecture/Phase_1_Diagnosis/evidence-agent-a-scene-section-20260613T132218/live-scene-section-evidence.json`.

Expected:

- DEC-100 says active-to-inactive and active-to-unrelated transitions must apply inactive target section state at transition start, must not create source helper snapshots, and must not snapshot or preserve Section ISO transition roots.
- TRD-012 carries the same target-active rule.

Observed:

- At `t+80ms`: `sceneSectionStyleTweenActive: false`, `sectionIsoTransition: null`, `sceneSectionHelperTransitionSnapshotActive: true`, `helperSnapshot.opacityNow: 0.6373333333333333`.
- At `t+450ms`: `sceneSectionHelperTransitionSnapshotActive: true`, `helperSnapshot.opacityNow: 0.5010666666664183`.
- At `t+950ms`: `sceneSectionHelperTransitionSnapshotActive: true`, `helperSnapshot.opacityNow: 0.18103333333320915`.
- Product-family trace reports `utah-forge-scene-section-planes`, family `scene-section-helpers`, `sourceVisible: true`, `targetVisible: false`, policy `translate-section-helpers`.
- Working-area focus tween is active in the same transition, so the page transition is live; the section style tween and Section ISO root transition are correctly suppressed.

Severity/frequency:

- Severity: visible glitch / contract violation. The target page owns no section state, but source helper visuals remain through a fading snapshot.
- Frequency: expected whenever `sceneSectionHelperExitSnapshotNeeded(fromStyle, toStyle)` is true for an active helper source and inactive helper target.

Suspected owner:

- `src/scene/transitions/transitionEffectiveLayersForPage.ts:1092` - inactive target branch starts `beginSceneSectionHelperTransitionSnapshot` before `applySceneSectionPlanes(targetSceneSectionStyle)`.
- `src/scene/SceneManager.ts:1745` - `beginSceneSectionHelperTransitionSnapshot` clones the live helper group into a fading scene snapshot.
- `src/scene/section/sceneSectionController.ts:2988` - helper opacity function returns `0` for active-to-inactive live helpers, leaving the snapshot as the remaining visible helper path.

Test coverage:

- Covered in conflicting directions.
- `tests/tools/scene-section-transition-behavior-source.test.mjs` asserts inactive target pages apply target section state immediately.
- `tests/tools/scene-section-helper-transition-source.test.mjs` asserts active-to-inactive helper handoffs create an exit snapshot.
- `docs/03-decisions.md:1079` and TRD-012 forbid source helper snapshots for inactive targets. The helper test appears stale or intentionally divergent from the durable decision. This mismatch needs resolution before code work.

Relationship to DEC-164/DEC-165:

- Not a DEC-164 regression; moving/dissolve frame partition remains intact.
- Not a DEC-165 regression; helper orientation remains right-handed.
- Open against already-landed DEC-100/TRD-012 no-bleed target-active guard.

# 4. Clean List

- DEC-164 per-frame section partition: live active-to-active evidence from index `11` to `12` reports `movingFrameIds: ["axis:x"]` and `dissolveFrameIds: ["axis:y"]`; source tests pass.
- Surviving-frame helper/content movement path: live samples keep `transitionKind: "continuous"` for `scene-section-helpers` and do not report a section-wide dissolve for the surviving X frame.
- Helper rebuild stability: live transition frames report `sceneSectionApplyMode: "transition-frame"` and `helperRebuildMs: 0`; source guard locks `if (!options?.transitionFrame) rebuildSceneSectionHelpers(...)`.
- DEC-165 Y helper orientation: settled Y-helper evidence on index `110` reports `Y Section frame` `matrixWorldDeterminant: 1` and bbox extent `[128646.531, 0, 78078.852]`, flat on world Y as expected.
- Section ISO opacity composition: live debug reports `opacityPolicy: "split-section-iso-overlay-opacity-from-layer-opacity"` with no independent overlay material count; source tests verify `sectionIsoStableLayerIds` keeps stable overlays in the opacity envelope.
- Section ISO inactive-target root suppression: active-to-inactive evidence reports `sectionIsoTransition: null`; no transition roots are preserved into the inactive target sample.
- Working-area focus masks: active-to-inactive evidence reports `workingAreaFocusTweenActive: true` and outside opacity interpolation from `1` toward authored target values; inactive-to-active evidence reports the reverse path toward `1`. No runtime defect reproduced.
- Late reapply during sampled transitions: live `lateReapply.duringTransitionCount` remains `0` in sampled scene-section and working-area cases.
- Console health: live Playwright collection emitted only the known Chromium `GPU stall due to ReadPixels` warning class.

# 5. Already-Landed Verification

DEC-164:

- Source: `src/scene/transitions/sceneSectionFrameSignature.ts:203` partitions frames into `movingFrameIds` and `dissolveFrameIds`.
- Runtime wiring: `src/scene/transitions/transitionEffectiveLayersForPage.ts:1056` stores partition sets on `sceneSectionStyleTween`.
- Runtime application: `src/scene/section/sceneSectionController.ts:3147` builds interpolated tween style, and `src/scene/section/sceneSectionController.ts:3159` scopes dual-mask source/target state to `dissolveFrameIds`.
- Verification: `node --test tests/tools/scene-section-frame-partition-source.test.mjs tests/tools/scene-section-frame-orientation-source.test.mjs` passed 13/13 subtests.
- Live deck-state evidence: index `11` to `12` reports `movingFrameIds: ["axis:x"]`, `dissolveFrameIds: ["axis:y"]`, `maskMode: "dual-mask"`, and `helperRebuildMs: 0`.

DEC-165:

- Source: `src/scene/section/sceneSectionController.ts:3591` documents proper right-handed helper basis; `orientationNormal = tangentA x tangentB` feeds `Matrix4.makeBasis` at `src/scene/section/sceneSectionController.ts:3602`.
- Verification: `scene-section-frame-orientation-source.test.mjs` passed; it locks determinant `+1` behavior and forbids raw `basisNormal` as the third `makeBasis` column.
- Live settled evidence: index `110` Y-only helper reports determinant `1`; the frame bbox is flat in world Y, not world Z.

Helper stability:

- Source: `src/scene/section/sceneSectionController.ts:4261` rebuilds helpers only when `options?.transitionFrame` is false; `src/scene/section/sceneSectionController.ts:4271` still applies helper opacity.
- Runtime: sampled transition frames report `helperRebuildMs: 0` and nonzero `helperObjectCount`, indicating opacity/uniform updates without helper rebuild.
- Verification: `scene-section-transition-behavior-source.test.mjs` and `scene-section-helper-transition-source.test.mjs` passed.

Section ISO opacity/root lifecycle:

- Source: `src/scene/SceneManager.ts:1478` passes a separate Section ISO transition envelope into `applySectionIsoOverlayMaterialOpacity`.
- Source: `src/scene/SceneManager.ts:1825` discards transition-owned Section ISO clones separately from live roots; `src/scene/SceneManager.ts:1965` avoids early snap commit when target opacity is below `0.98`.
- Source: `src/scene/SceneManager.ts:4294` resumes in-flight ISO landing after full reapply.
- Verification: `section-iso-transition-source.test.mjs` passed.
- Live limit: sampled deck paths showed Section ISO material opacity policy and inactive-target suppression, but no populated transition roots. A fixture with actual populated target roots is still needed.

Working-area focus:

- Source: `src/scene/workingArea/workingAreaFocusController.ts:302` interpolates `workingAreaFocusOutsideOpacityByLayerId`.
- Source: `src/scene/workingArea/workingAreaFocusController.ts:370` starts `workingAreaFocusTween` when resolved focus state differs.
- Live evidence: active-to-inactive and inactive-to-active sampled transitions report `workingAreaFocusTweenActive: true` and interpolating outside opacity maps.
- Gap: no focused source test currently locks this behavior.

# 6. Recommendation And Test-Net Gaps

Recommendation: harden incrementally.

Smallest sufficient hardening set:

1. Resolve A-SCENE-001 by aligning active-to-inactive helper snapshot behavior with DEC-100/TRD-012. Either remove the inactive-target helper exit snapshot or add a new decision that explicitly supersedes DEC-100 for a narrowly named helper-exit exception. Code work should not start until that contract is settled.
2. Add a source/runtime guard for active-to-inactive no-bleed behavior that checks all three facts together: no `sceneSectionStyleTween`, no `sectionIsoOverlayTransition`, and no source helper snapshot when target `sceneSectionEnabled !== true`.
3. Add a focused working-area transition source test covering `transitionWorkingAreaFocusForPage`, state equality skip, interpolation of per-layer outside opacity, and composition with page transition debug.
4. Add a populated Section ISO root fixture or synthetic runtime harness. Current source tests cover root lifecycle, but live deck-state evidence in this scope did not populate source/target transition roots.
5. Add a debug trace assertion that working-area focus appears as an owned transition channel or clearly documented guarded legacy kernel. Current `productFamilies` reports `utah-forge-working-area-focus` as `state-source-only` even while `workingAreaFocusTweenActive` is true.

Rewrite threshold:

- Not met. The residual defect is one narrow helper lifecycle inconsistency plus missing tests. DEC-164, DEC-165, helper-stability, Section ISO opacity policy, and working-area mask interpolation all have clean evidence in this scope.

# 7. Method Notes And Exact Commands

Read first:

- `Transition Architecture/Phase_1_Diagnosis/PROMPT-phase1-transition-defect-inventory.md`
- `CLAUDE.md`
- `docs/dev-context/Transition-Runtime-Operating-Spec.md`
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`
- `docs/dev-context/Transition-Constitution.md`
- `docs/dev-context/Transition-Continuity-Contract.md`
- `docs/dev-context/Transition-Guardrails.md`
- `docs/03-decisions.md` entries DEC-071, DEC-076, DEC-164, DEC-165; DEC-098/099/100 reviewed for no-bleed context.

Targeted source/test inspection:

- `src/scene/transitions/sceneSectionFrameSignature.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/section/sceneSectionController.ts` targeted ranges only.
- `src/scene/SceneManager.ts` targeted Section ISO/debug ranges only.
- `src/scene/workingArea/workingAreaFocusController.ts`
- `tests/tools/scene-section-frame-partition-source.test.mjs`
- `tests/tools/scene-section-frame-orientation-source.test.mjs`
- `tests/tools/scene-section-transition-behavior-source.test.mjs`
- `tests/tools/scene-section-helper-transition-source.test.mjs`
- `tests/tools/section-iso-transition-source.test.mjs`
- `tests/tools/transition-executor-registry.test.mjs`

Commands run:

```powershell
node --test tests/tools/scene-section-frame-partition-source.test.mjs tests/tools/scene-section-frame-orientation-source.test.mjs
```

Result: pass, 13/13 subtests.

```powershell
node --test tests/tools/scene-section-transition-behavior-source.test.mjs tests/tools/scene-section-helper-transition-source.test.mjs tests/tools/section-iso-transition-source.test.mjs
```

Result: pass, 18/18 subtests.

```powershell
node --test tests/tools/transition-executor-registry.test.mjs
```

Result: pass, 6/6 subtests.

```powershell
node "Transition Architecture\Phase_1_Diagnosis\evidence-agent-a-scene-section-20260613T132218\collect-agent-a-scene-section-evidence.mjs"
```

Result: wrote `Transition Architecture/Phase_1_Diagnosis/evidence-agent-a-scene-section-20260613T132218/live-scene-section-evidence.json`.

Browser method note:

- In-app Browser connection closed during initial hook read (`target closed while handling command`).
- Standalone Playwright Chromium fallback was used against the already running dev server.
- No screenshot or visual-human acceptance occurred. Status is diagnosis with live runtime introspection, not final visual acceptance.

Working tree note:

- Pre-existing unrelated dirty page/project/source files were present before this pass.
- No staging, reverting, cleanup, or source/runtime/page/project JSON edits occurred.
