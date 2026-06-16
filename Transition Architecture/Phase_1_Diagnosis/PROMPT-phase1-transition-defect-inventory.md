# PROMPT — Phase 1: Transition defect inventory + harden-vs-rewrite recommendation

> Hand this whole file to each agent. Each agent writes its own report (unique
> ID) into `C:\GeoSee\GeoSee_Dev\Transition Architecture\Phase_1_Diagnosis\`.
> **This is a converging diagnosis pass. No design, no runtime code changes.**
> Phase 2 (design) only starts after Phase 1 decides whether a redesign is even
> warranted.

---

## 1. Mission (Phase 1 only)

Answer two questions with evidence, not opinion:

1. **What transition behavior is still broken *right now*** (after the recent
   DEC-164 / DEC-165 fixes), reproduced with live evidence?
2. **Harden incrementally vs re-architect?** Based on the defect inventory,
   recommend the *smallest sufficient* path to smooth, comprehensive,
   future-proof transitions — and justify it.

Do **not** design a new transition engine in this pass. Phase 1 produces the
evidence that decides whether Phase 2 (a unifying design) is justified at all.

---

## 2. Why diagnosis first

Transitions have regressed repeatedly, and several fixes already landed this
cycle. Commissioning an architecture before knowing the *residual* defect rate
is backwards. Parallel agents converge on diagnosis (shared ground truth) and
diverge on open-ended design. Phase 1 is the convergent step.

---

## 3. Repo & how to run

- Active repo: `C:\GeoSee\GeoSee_Dev` (branch `main`); the dev server serves
  this tree. Note any sibling-fork drift if found (e.g.
  `C:\GeoSee\Side projects\GeoSee_Dev_VI`) but audit the active repo.
- Run: `npm run dev`. Live introspection hooks:
  - `window.__pageController` — `goto(index)`, `next()`, `prev()`, `getState()`.
  - `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` — live
    `SceneManager` (layers, `lastSceneSectionStyle`, `sceneSectionRuntime`,
    resolver methods, transition debug state).
- Deck-state evidence tools (explicitly deck-state; keep OUT of app-health
  claims): `tools/capture-transition-matrix.mjs`,
  `tools/analyze-transition-matrix.mjs` (scope with `TRANSITION_MATRIX_CASES`,
  `TRANSITION_MATRIX_VIDEO=0`).
- Read-only checks allowed: `npx tsc --noEmit`,
  `node tools/validate-project-pages.mjs`, `npm run check:workspace`,
  `node --test tests/tools/<...>.test.mjs`.

---

## 4. Read first

- `CLAUDE.md`; `docs/dev-context/Transition-Runtime-Operating-Spec.md`;
  `docs/dev-context/Page-Transitions-And-Section-Frames.md`;
  `docs/03-decisions.md`.
- Runtime: `src/scene/SceneManager.ts`; `src/scene/transitions/*`
  (`transitionStyles.ts`, `layerTweenRuntime.ts`,
  `transitionEffectiveLayersForPage.ts`, `transitionEntityPolicy.ts`,
  `transitionRenderGraphAdapter.ts`, `transitionExecutionPlan.ts`,
  `transitionEntityOpacityExecutor.ts`, `transitionCommitGate.ts`,
  `sceneSectionFrameSignature.ts`, `productFamilyRegistry.ts`);
  `src/scene/section/sceneSectionController.ts`; `src/ui/ResistivityLegend.tsx`;
  `src/scene/overlays/SceneOverlaysController.ts`.

---

## 5. Reference for "correct" — base rules / invariants

A behavior is a **defect** only if it violates intended behavior. Treat these as
the spec for "correct" (full detail in
`..\PROMPT-transition-architecture-audit-and-method.md` §4):

- **MT Resistivity Cells slider** (All Valid / Log10 Window) = local ~1.5s
  scalar-style interpolation; persists only `scalarLegendVisible` +
  `scalarInclusionMode`; not a page-transition kind. **Known-good reference —
  generalize from it, do not "fix" it.**
- **MT full-density scalar cloud** = protected success path; isolines enter on
  the page clock, no commit-time replay pop.
- **Sections must MOVE** (DEC-164): surviving frames interpolate (plane slides,
  extent moves), only added/removed/identity-changed frames dissolve.
- **Section helper basis right-handed** (DEC-165).
- Helper stability — no per-tick rebuild (DEC-076); ISO opacity composed, never
  overwritten (DEC-071); discrete color/material channels (DEC-163);
  execution-plan seismic entities (TRD-013/DEC-152); single commit owner /
  deferred-flush suppression (DEC-162); overlays + camera on the transition
  clock.
- **Page-agnostic:** a defect must be filed against a behavior family, not a
  page id/index/title/pair; reproductions may cite pages as *evidence only*.

---

## 6. Already-landed this cycle — VERIFY, do not re-litigate

Confirm these hold (or report if they regressed); do not re-report them as new:

- DEC-164 — per-frame section partition (surviving planes slide; only
  changed/added/removed dissolve). Live check: a same-axis plane interpolates
  its position across a transition; another axis toggling does not snap it.
- DEC-165 — section frame helper orientation right-handed; the Y helper world
  bbox is flat in Y (not Z); settled helper transform determinant +1.
- Camera orbit-radius clamp (runaway `dynamicCamera.orbitRadius` capped to scene
  scale).
- Legend writes landed-gate (`legendWritesLanded`) — legend writes do not
  persist onto a non-displayed page during a transition.

---

## 7. Deliverable — the defect inventory

A table/list of every *current* transition defect. For each:

- **ID + short title.**
- **Behavior family** (e.g. section move/dissolve, MT scalar cloud, MT
  volume/threshold/slices, seismic volume/sections/figures, section-ISO
  overlays, point clouds, boreholes, overlays, legends/labels, camera,
  fog/background, commit/settle, readiness/attach, interruption/replan).
- **Reproduction** — synthetic fixture if possible; if a live page is used, label
  it evidence-only and give the exact navigation.
- **Evidence** — live introspection readout, matrix capture, screenshot, or
  numeric measurement (e.g. per-axis world bbox, determinant, opacity/clip
  readback). State the expected vs observed.
- **Severity** (blocks review / visible glitch / cosmetic) and **frequency**
  (every transition of this family / specific conditions).
- **Suspected owner** (file/function) and whether a regression test already
  covers it.
- **Closed-or-open** relationship to §6 (is it a §6 regression, or new?).

Also report **what is NOT broken** (families that transition correctly today) —
the convergent "clean" list matters as much as the defect list.

---

## 8. Deliverable — harden-vs-rewrite recommendation

Based on the inventory, recommend ONE:

- **Harden incrementally** — list the smallest sufficient targeted fixes + the
  regression-test net needed to make them stick, ordered by leverage.
- **Re-architect (unified model)** — only if the inventory shows the defect rate
  or coupling cannot be tamed incrementally; if so, state precisely *why*
  incremental hardening is insufficient, with evidence.

Either way, identify the **regression-test net** (synthetic-fixture tests per
behavior family) as the durable mechanism that keeps transitions correct as new
entities are introduced. State which families have no test today.

---

## 9. Rules for this pass

- **Read-only. No runtime code changes.** (Read-only introspection and existing
  tests are fine.)
- **Page-agnostic.** No fix or claim keyed to page id/index/title/order/pair;
  synthetic fixtures for behavior claims; deck-state tools stay labeled and out
  of app-health.
- Honest status language: "reproduced", "not reproduced", "needs runtime
  evidence" — never "fixed"/"verified" for anything not implemented.
- Output rail (CLAUDE.md): facts, files, repros, evidence, decisions — no
  first/second-person pronouns in authored prose.
- Do not stage, revert, or normalize unrelated dirty working-tree files; treat
  them as in-progress user/agent work.

---

## 10. Deliverable format

- Markdown report into
  `C:\GeoSee\GeoSee_Dev\Transition Architecture\Phase_1_Diagnosis\` with a
  **unique filename + internal Report ID**, namespaced by agent + date (other
  agents report here too — do not collide).
- Structure: (1) summary verdict (defect count by family + harden-vs-rewrite
  call); (2) defect inventory (§7); (3) clean list; (4) §6 verification;
  (5) recommendation (§8) with the test-net gap list; (6) method notes /
  reproduction commands for other agents.

The point of Phase 1 is convergence: the reports should make it obvious whether
the remaining work is a handful of targeted fixes + tests, or a genuine
re-architecture — decided on shared evidence.
