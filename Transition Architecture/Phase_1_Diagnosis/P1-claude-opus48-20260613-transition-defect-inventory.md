# Phase 1 — Transition Defect Inventory & Harden-vs-Rewrite Recommendation

- **Report ID:** `P1-CLAUDE-OPUS48-20260613-01`
- **Author:** Claude Code (Opus 4.8)
- **Date (UTC):** 2026-06-13
- **Repo:** `C:\GeoSee\GeoSee_Dev` @ `main` (tip `28ef38b`)
- **Pass:** Phase 1 diagnosis only — no design, no runtime edits.
- **Evidence provenance per item:** `[live]` = measured live this cycle via
  `__GEOVOX_DIAGNOSTICS__`/`__pageController`; `[code]` = source analysis;
  `[needs-live]` = recommend a fresh runtime check by a peer agent (convergence).

---

## 1. Summary verdict

**Recommendation: HARDEN incrementally + build the regression-test net. A
re-architecture is NOT justified by current evidence.**

The three severe, repeatedly-reported defects are fixed and verified this cycle
(section snap → per-frame move DEC-164; Y frame wrong-plane → right-handed basis
DEC-165; "cloud vanishes on entry" → runaway camera orbit radius clamp). The
residual items are **low-severity / cosmetic / latent**, and the dominant gap is
**missing per-family regression tests**, not architectural coupling. The
per-entity scaffolding that a unified model would need already exists
(`transitionExecutionPlan`, `transitionEntityPolicy`,
`transitionRenderGraphAdapter`, `productFamilyRegistry`,
`transitionEntityOpacityExecutor`) and is being completed incrementally. The
fixes that "stuck" were small + test-locked; that pattern should continue.

Defect counts by severity (open): **High 0, Medium 0, Low 4, Latent 3, Test-gap
(systemic) 1.** (D3, the only Medium, was reproduced-clean and downgraded — see
§3 D3 / §7.)

---

## 2. Verification of already-landed fixes (§6) — all hold

| Fix | Check | Result |
|---|---|---|
| DEC-164 section move | enter 172→166: x-plane positionM ramps `-10545 → … → -5753`; partition `moving:[axis:x]`, `dissolve:[axis:y]` | **holds** `[live]` |
| DEC-165 handedness | Y helper world bbox flat in **Y** (was Z); settled helper transform det **+1**; X/Y/Z frames perpendicular | **holds** `[live]` |
| Camera orbit clamp | `dynamicCamera.orbitRadius` 144,024,210 → camera horiz clamped `~4.57M` (8× framing) vs `~141M` | **holds** `[live]` |
| Legend landed-gate | legend writes do not persist onto a non-displayed page mid-transition | **holds** `[code]`, `[live earlier]` |
| Source-face ownership (180/181) | `axis:y` resolves through built-in basis on both pages (`axisB=(0,0,1)`), not seismic source-face | **confirmed** `[live]` |

No regressions of §6 observed.

---

## 3. Open defect / risk inventory

### D1 — Section frame B-heading text rotation may be mirrored for Y `[code]`
- **Family:** scene-section helpers (text orientation).
- **Cause:** `axisBHeadingQuaternion` (`sceneSectionController.ts:~3963`) rotates
  +90° about **local Z**. After DEC-165, helper local +Z = −normal for Y, so the
  in-plane 90° is reversed for Y. Plane is correct; text rotation sense suspect.
- **Severity:** Low (cosmetic). **Test:** none. **Owner:** `rebuildSceneSectionHelpers`.
- **Repro:** open a Y-active section frame; read the B-axis heading orientation.
  `[needs-live]` visual confirm.

### D2 — Push/pull drag direction for Y `[code]`
- **Family:** scene-section editor interaction.
- **Cause:** push/pull handle authored along local Z (`:3809`), now −normal for Y.
  Visual is a symmetric double-arrow (correct `[live]`: cone elongated along Y),
  but the **drag delta** must be driven by the true plane normal
  (`getSceneSectionPlaneNormal`) or Y drag could invert.
- **Severity:** Low (interaction). **Test:** none. **Owner:** drag path in
  `EditorContext.tsx` / `scene.ts` / `SceneManager.ts`. `[needs-live]`.

### D3 — "Page 1 bleeds into 2" on section page-switch — CLEARED (settled) `[live]`
- **Family:** transition commit/settle + non-frame discrete classification.
- **Result:** reproduced clean. Round-trip 181→180→181→180, settled state each
  step: 180 shows only `enabledAxes:[y]` / `helperAxes:[y]`; 181 shows
  `[x,y,z]` / `[x,y,z]`. **No persistent stale frame/helper carry after settle.**
  Any "bleed" is transient dual-mask dissolve *during* the tween (intended
  DEC-164). The earlier user report coincided with the broken empty-
  `transitionStyles.ts` build state, not a live runtime bug.
- **Severity:** downgraded to None-persistent / cosmetic-transient.
- **Residual (latent, optional):** peer audits (8C7F, 5F9A) note a
  `nonFrameDiscreteChanged` classifier would make target-scope/source-face-only
  changes dissolve all frames; not required to fix any reproduced defect, but a
  clean generalization if Phase 2 proceeds. Verify with a fresh live run on
  content where targeting (not frames) changes between pages. `[needs-live]`

### D4 — Source-face vs built-in basis family switch (latent) `[code]`/`[live partial]`
- **Family:** section frame basis ownership.
- **Cause:** a page with active-Y + selected seismic targets can resolve Y
  through the right-handed seismic source-face basis, while another page uses the
  built-in (left-handed) basis. Confirmed **not active** on 180/181, but the
  same-axis activation guard (matches by axis, not exact frame id) leaves the
  switch possible on other content.
- **Severity:** Latent. **Test:** none. **Owner:** `sceneSectionSourceFaceFrame`.

### D5 — Default per-axis basis is left-handed for Y (latent) `[code]`
- **Family:** section basis construction (root inconsistency behind DEC-165).
- **Cause:** `sceneSectionBasisVectors` (`:1558`) hand-codes a left-handed Y
  triple; `sceneSectionOrthonormalSourceBasis` is right-handed. DEC-165 fixes the
  consumer; the producer inconsistency remains.
- **Severity:** Latent. Fixing it flips Y `axisB` sign → reinterprets authored
  B-extents (data-affecting), so deferred. **Owner:** `sceneSectionBasisVectors`.

### D6 — Surviving-frame helper outline crossfades instead of translating during a dissolve tween `[code]`
- **Family:** section helpers during dual-mask transitions.
- **Cause:** helpers rebuild at tween start/end only (DEC-076); during a tween
  with dissolve frames present, a surviving frame's data clip slides but its
  outline/labels crossfade rather than translate.
- **Severity:** Low (cosmetic mismatch during the tween only). **Test:** partial.

### D7 — MT Log10 Window load from Global Settings / page 00 `[needs-live]`
- **Family:** MT full-density scalar load path.
- **Cause (per CLAUDE.md):** `previewEnvironmentBase` must preserve authored
  Log10 fields so a Log10 page shows isolines without a mode click. Status not
  re-verified this cycle.
- **Severity:** Low–Medium if reproduced. **Repro:** load a Log10-authored page
  directly from Global Settings. `[needs-live]`.

### D8 (systemic) — Regression-test net gaps `[code]`
- Families with synthetic-fixture tests today: section partition
  (`scene-section-frame-partition`), section helper orientation/handedness
  (`scene-section-frame-orientation`), helper transition, channel policy, entity
  opacity executor, camera clamp.
- Families with **no** synthetic test: MT full-density scalar enter/settle, MT
  volume/threshold/slices crossfade, seismic volume/sections/figures
  enter-exit, section-ISO overlay composition, overlays-on-clock, commit/settle
  pop, readiness/attach timing, interruption/replan. **This is the highest-value
  gap** for "stays correct as new entities are introduced."

---

## 4. Clean list (transition correctly today)

`[live]`/`[code]`: per-frame section plane slide + extent move; section dissolve
of toggled axis; section frame helper plane correctness (all axes); MT scalar
cloud slider modes (All Valid / Log10) ~1.5s interpolation; MT scalar cloud
page-transition (full-density-scalar tween) on the page clock; camera
orbit-radius within scene scale; legend write gating; scene overlays on the
transition clock; single-owner commit / deferred-flush suppression.

---

## 5. Harden-vs-rewrite — rationale

- Severe defects are resolved; residuals are Low/Latent/cosmetic.
- Root causes were **localized math/logic** (handedness, global-vs-per-frame,
  runaway value), each fixed in a few lines + a locking test — not architectural
  rot.
- The per-entity composition scaffolding already exists and DEC-152/162/163/164/
  165 are incrementally completing it. A rewrite would discard a working,
  protected MT/section path and re-introduce risk into the exact subsystem with
  the worst regression history.
- The durable "works regardless of what we introduce" guarantee is the
  **regression-test net (D8)**, achievable without a rewrite.

**Smallest sufficient path (ordered by leverage):**
1. Build the **D8 test net** — one synthetic-fixture test per untested family,
   asserting the family's invariants (composition, move-vs-dissolve, enter/exit,
   no commit pop). Highest leverage; this is what stops future regressions.
2. Close **D1/D2** (cosmetic/interaction Y follow-ups) once visually confirmed.
3. Optional generalization (only if Phase 2 proceeds): add the
   `nonFrameDiscreteChanged` classifier so targeting-only changes dissolve all
   frames (D3 residual) — not required to fix any reproduced defect.
4. Schedule **D4/D5** (basis-family unification) only as a deliberate
   data-migration, not inline.
5. Adopt a lightweight **entity transition declaration contract** by formalizing
   the existing scaffolding (Phase 2 design, optional) — incremental, not a
   rewrite.

D3 (the only Medium-severity open item at first pass) was reproduced **clean**
at settled state, so no persistent section-bleed defect remains; this further
supports HARDEN over rewrite.

---

## 6. Method notes (for peer agents)
- Live: `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` +
  `window.__pageController.goto(idx)`.
- Section plane move check: sample `manager.lastSceneSectionStyle
  .sceneSectionPlanes.<axis>.positionM` across a transition (must ramp).
- Helper plane check: per-axis world bbox of `manager.sceneSectionRuntime` meshes
  grouped by `userData.sceneSectionAxis` (flat axis = plane normal axis).
- Handedness: `det([axisA|axisB|normal])` must be +1.
- Convergence priority: **reproduce or clear D3**; everything else is consistent
  with the harden recommendation.
