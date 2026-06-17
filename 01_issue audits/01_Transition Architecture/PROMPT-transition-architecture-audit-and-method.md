# PROMPT — Audit the transition system and propose a unified, extensible method

> Hand this whole file to each agent. Each agent produces its own report (unique
> ID) in `C:\GeoSee\GeoSee_Dev\Transition Architecture\`. This pass is
> **audit + proposed method only — do NOT change runtime code.** Convergence
> across agents is the goal; a later pass will implement the winning method.

---

## 1. Mission

Design **one** transition model for the GeoSee 3D scene that makes page-to-page
transitions smooth, correct, and **comprehensive** — and that **keeps working
for any scene entity we introduce later** without a new bespoke code path.

Today, transition behavior is handled per-product and patched per-symptom. It
regresses repeatedly because each fix is local (a global flag flip, a per-layer
special case, a commit-time replay). The target is a **principled, composable
model**: every scene entity declares *how it transitions* through a small,
uniform contract, and a single runtime composes those declarations. Adding a
new layer/product/overlay should require only a declaration, not new runtime
branching.

Deliverable: an **audit of the current system** + a **proposed method
(architecture + migration plan)**. No runtime edits in this pass.

---

## 2. Repository & how to run

- Active repo root: `C:\GeoSee\GeoSee_Dev` (branch `main`). The dev server
  serves this tree. Some sibling forks exist (e.g.
  `C:\GeoSee\Side projects\GeoSee_Dev_VI`) — audit the active repo unless told
  otherwise, and note fork drift if found.
- Run app: `npm run dev`. Live introspection hooks:
  - `window.__pageController` — `goto(index)`, `next()`, `prev()`, `getState()`.
  - `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle()` — `.manager` is the live
    `SceneManager` (layers map, `lastSceneSectionStyle`, resolver methods,
    `sceneSectionRuntime`, transition debug state).
- Deck-state evidence tools (explicitly deck-state, keep OUT of app-health):
  `tools/capture-transition-matrix.mjs`, `tools/analyze-transition-matrix.mjs`
  (scope with `TRANSITION_MATRIX_CASES`, disable video with
  `TRANSITION_MATRIX_VIDEO=0`).
- Verify: `npx tsc --noEmit`, `node tools/validate-project-pages.mjs`,
  `npm run check:workspace`, and `node --test tests/tools/<...>.test.mjs`.

---

## 3. Read first (canonical context)

- `CLAUDE.md` — operating contract (page-agnostic rules, workspace rules,
  output rail, MT/section/seismic invariants).
- `docs/dev-context/Transition-Runtime-Operating-Spec.md` — **active operating
  contract for transition work.**
- `docs/dev-context/Page-Transitions-And-Section-Frames.md` — directives for the
  page-transition runtime and section-frame helpers (transition-kind registry,
  helper-stability contract, frame compatibility).
- `docs/03-decisions.md` — DEC entries below.
- `docs/dev-context/UI-Visual-Standards.md` — visual rules (legends, section
  axes, overlay/transition rendering).

Core runtime source (start here):
- `src/scene/SceneManager.ts` — orchestration / commit owner.
- `src/scene/transitions/`:
  - `transitionStyles.ts` — kinds, scalar/section field sets, signatures.
  - `layerTweenRuntime.ts` — per-frame tick.
  - `transitionEffectiveLayersForPage.ts` — the classifier (source→target
    per-layer/per-entity decision).
  - `transitionEntityPolicy.ts`, `transitionRenderGraphAdapter.ts` — channel
    capabilities (`interpolate` / `discrete-commit`) and entity policy.
  - `transitionExecutionPlan.ts` — per-entity operation plan (TRD-013/DEC-152).
  - `transitionEntityOpacityExecutor.ts` — visibility/opacity composition.
  - `transitionCommitGate.ts` — commit ownership/suppression.
  - `productFamilyRegistry.ts`, `sceneSectionFrameSignature.ts`.
- `src/scene/section/sceneSectionController.ts` — section clip + helpers.
- `src/ui/ResistivityLegend.tsx` — MT slider mode transitions.
- `src/scene/overlays/SceneOverlaysController.ts` — overlays on transition clock.

---

## 4. HARD INVARIANTS — the proposed method MUST preserve all of these

These are non-negotiable base rules. A method that breaks any of them is
rejected. Cite how the proposal honors each.

1. **MT Resistivity Cells slider modes.** `All Valid Cells` / `Log10
   Resistivity Window` are **local legend view transitions**, not
   page-transition kinds. They use a ~1.5s live scalar-style interpolation in
   `ResistivityLegend.tsx`, persist only `scalarLegendVisible` and
   `scalarInclusionMode`, and must not mutate `LayerTransitionKind`,
   `SCALAR_TRANSITION_STYLE_FIELDS`, `scalarInclusionFilterActive`, or the
   `full-density-scalar` page-transition path. Local mode RAF must cancel on
   navigation. (See CLAUDE.md MT rules + Operating Spec.)
2. **MT full-density / scalar cloud is a protected success path.** Do not
   weaken it. Log10 Window pages register a `full-density-scalar` tween so
   isolines enter on the page clock; the post-commit graph check is
   observational only (no final visibility/style replay that pops isolines in).
3. **Sections MUST MOVE (DEC-164).** Per-frame partition: a frame present on
   both pages with the same cut geometry **interpolates** (the plane slides, the
   extent moves in/out); only added/removed/identity-changed frames dissolve via
   dual-mask. No global all-or-nothing section snap.
4. **Section helper orientation is right-handed (DEC-165).** Helper basis must
   be a proper rotation; never feed a left-handed basis to
   `Matrix4.makeBasis` + `setFromRotationMatrix`.
5. **Helper stability (DEC-076).** Helper geometry/materials are built at tween
   start/end only — never rebuilt per tick. Only opacity/uniforms/transforms
   move during a tween.
6. **ISO opacity composition (DEC-071).** `composed = authored × transition ×
   threshold-surface attenuation`. Never overwrite material opacity directly.
7. **Discrete vs interpolable channels (DEC-163).** Color/material channels
   commit discrete; mixed color+scalar keeps preserve-interpolate. Generalize
   this, don't special-case it away.
8. **Execution-plan entities (TRD-013 / DEC-152).** Seismic survey-geometry and
   figures are independent enter/exit entities driven by the execution plan, not
   whole-layer crossfades.
9. **Commit ownership (DEC-162).** SceneManager owns the final commit;
   editor-deferred flush must not double-apply; settled/suppressed reapply is
   narrow (e.g. full-density target style only) and skips while a tween is
   active.
10. **Overlays + camera on the transition clock.** Scene overlays ride the
    page-transition duration; dynamic camera obeys camera policy (e.g.
    orbit-radius clamp to scene scale).
11. **Page-agnostic (CLAUDE.md).** No fix or test may key on page id, index,
    title, number, order position, or source/target page pair. App-behavior
    tests use **synthetic fixtures**; deck-state tools are named and excluded
    from app-health.
12. **Authoring persistence** stays the dev-only Vite plugin writing
    `projects/<project>/`. Do not redesign persistence.

---

## 5. Known failure modes the method must structurally prevent

Each has bitten this codebase. The proposal must explain how its model makes
each one impossible (or caught by a test), not just "be careful":

- **Global all-or-nothing flags** (one frame/field change snapping a whole
  family). DEC-164 fixed it for sections; the method should generalize the
  per-entity decision so no family can regress to a global snap.
- **Commit-time replay pop** (final visibility/style reapply making things
  appear/disappear after the tween).
- **Per-tick helper rebuild flicker.**
- **Handedness / basis math errors** (left-handed Y basis, DEC-165).
- **Dual-mask dissolving things that should translate** (surviving section
  planes; moving extents).
- **Readiness/attach timing** (async-loaded target layers entering on a fresh
  clock instead of the remaining transition time; isolines popping in late).
- **Legend writes during transitions** persisting onto the wrong page (landed
  gate `legendWritesLanded`).
- **Source/target ownership ambiguity** (an entity switching basis/representation
  family across pages — e.g. built-in vs seismic source-face section basis).

---

## 6. What the proposed method must define (the deliverable's core)

Produce a concrete model, not prose. At minimum:

1. **Entity model.** What is a "transition entity" (layer? sub-entity? helper?
   overlay? camera? post FX?). How is identity established and matched
   source→target (stable id, representation, frame id, product id)?
2. **Channel model.** Enumerate channel classes (position/geometry, opacity,
   color/material, categorical/discrete, clip/section, scalar window, camera,
   fog/background, helpers). For each: capability (`interpolate` /
   `discrete-commit` / `crossfade` / `enter-exit` / `translate`) and composition
   rule. This generalizes the existing `transitionEntityPolicy` /
   `transitionRenderGraphAdapter` capabilities.
3. **Declaration contract (extensibility).** How a NEW entity registers its
   channels/policies so the runtime handles it with zero new branching. Show a
   worked example: "introduce a hypothetical new volumetric layer X — what does
   the author/dev declare, and what does the runtime do automatically?"
4. **Composition runtime.** One uniform per-frame compose: authored × transition
   × attenuation; per-entity move vs crossfade vs enter/exit; clock ownership;
   helper transform-follow vs rebuild-at-ends.
5. **Lifecycle.** Setup (classify/plan) → tick (compose) → commit (single
   owner) → settle (narrow reapply) → interruption/replan (mid-transition nav,
   async readiness).
6. **Invariant enforcement.** How each §4 rule is expressed in the model (not
   bolted on), and how each §5 failure mode is structurally prevented.
7. **Verification strategy.** Runtime-introspection checks (via the hooks in
   §2), synthetic-fixture unit tests (per §4.11), and a regression-lock plan.
   Include the per-axis world-bbox technique and determinant/handedness checks
   already proven useful.
8. **Migration plan.** How to move the current per-product code onto the model
   incrementally without weakening the protected MT/section paths — ordered,
   low-risk steps, each independently verifiable.
9. **Risks & open questions.** Especially the source-face/representation
   ownership seam and any place the model is under-specified.

---

## 7. Deliverable format & rules

- Write a markdown report to `C:\GeoSee\GeoSee_Dev\Transition Architecture\`
  with a **unique filename + internal Report ID** (other agents report here too;
  do not collide — namespace by agent + date).
- **No runtime code changes this pass.** Read-only audit + proposal. (You may
  run read-only introspection and existing tests.)
- Be page-agnostic: cite behavior families and synthetic repros, not live page
  ids/titles as proof of generic behavior.
- Honest status language: use "proposed", "audited", "needs runtime evidence" —
  not "fixed"/"verified" for anything not implemented and confirmed.
- Follow the CLAUDE.md output rail (no first/second-person pronouns in authored
  prose; facts, files, decisions, verification).
- Do not stage, revert, or normalize unrelated dirty working-tree files; treat
  them as in-progress user/agent work.

---

## 8. Acceptance criteria for the proposed method

A strong proposal:
- Handles **every existing** family (terrain/topo, MT full-density scalar cloud,
  MT volume/threshold/slices, seismic volume/sections/figures, scene sections +
  helpers, section-ISO overlays, point clouds, boreholes, overlays, legends,
  labels, camera, fog/background) under **one** model.
- Makes **adding a new entity** a declaration, not a new runtime branch
  (worked example required).
- Preserves **all** §4 invariants and structurally prevents **all** §5 failure
  modes, with the enforcement shown in the model.
- Comes with a concrete, ordered, independently-verifiable migration plan and a
  regression-lock test strategy using synthetic fixtures.

---

## 9. Context: what is already in place (do not re-discover from scratch)

- Per-entity scaffolding exists: `transitionExecutionPlan`,
  `transitionEntityPolicy`, `transitionRenderGraphAdapter` (channel
  capabilities), `productFamilyRegistry`, `transitionEntityOpacityExecutor`
  (visibility composition). The method should likely **formalize and complete**
  these into the full model above, not start over.
- Recent landed decisions to build on: DEC-071 (ISO composition), DEC-076
  (helper stability), DEC-097/098 (topo/overlay sectioning), DEC-152/TRD-013
  (execution-plan seismic entities), DEC-162 (commit/flush), DEC-163 (discrete
  color channels), DEC-164 (per-frame section partition), DEC-165 (right-handed
  helper basis). The MT slider path and full-density-scalar path are the
  reference "good" behaviors to generalize from.
</content>
