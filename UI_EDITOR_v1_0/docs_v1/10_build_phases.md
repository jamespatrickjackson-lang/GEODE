# v1 Build Phases

## 1. Goal

Decompose the v1 build into agent-executable phases. Each phase is:

- **Independent** — does not require manual hand-off between agents.
- **Verifiable** — has concrete acceptance criteria the agent runs and observes.
- **Committable** — produces a clean git commit at end-of-phase.
- **Sequential** — each phase depends on every earlier phase being complete.

An agent executing this list end-to-end produces a working v1. The orchestration is in [11_agent_automation_runbook.md](11_agent_automation_runbook.md).

## 2. Phase summary

| Phase | Name | Deliverable | Approx. effort (rough) |
| --- | --- | --- | --- |
| **0** | Scaffolding | `UI_EDITOR/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `main.tsx`. Workbench launches and shows "Hello Workbench". | 1 commit |
| **1** | Core schema + util | All types under `src/core/schema/` and `src/core/util/`. tsc clean. | 1 commit |
| **2** | Package IO + plugin | `plugins/vite-plugin-package-write.ts`, `src/core/packageIO/`, hand-authored minimal sample package. Workbench reads the package on launch. | 1 commit |
| **3** | State + Shell skeleton | `src/shell/state/`, `ShellRoot.tsx`, `TopBar.tsx`, `PackageBrowser.tsx`, empty `CanvasRoot.tsx`, empty `ValidationPanel.tsx`. Workbench loads, package browser lists sample. | 1 commit |
| **4** | Canvas Engine | `src/shell/canvas/*`, `src/core/geometry/*`. Pan, zoom, rulers, pixel grid, anchors, snap, smart guides, guides, safe area, transforms, constraints, selection, layers. | 1 commit |
| **5** | Toolkit | `src/shell/toolkit/*`. All **13** Tools functional (10 original + 3 shape tools: Rectangle, Ellipse, Line). Grouping shortcuts (Ctrl/Cmd+G, Ctrl/Cmd+Shift+G) wired in ShellRoot key handler. Resize Tool shortcut moved from `r` to `s`. | 1 commit |
| **6** | Libraries | `src/core/libraries/*`, `src/shell/libraryPanel/*`. **All 5** Libraries populated and drag-to-instantiate works (Component / Colour / Icon / Token / Style). Bundled Styles + shape Components + Group container + shadow Tokens per [05_libraries.md](05_libraries.md) §5 + [20_materials_and_shapes.md](20_materials_and_shapes.md) §6. | 1 commit |
| **7** | Straw-subject package | `packages/geosee_editor_sidebar/` populated with all Frames / Containers / Components / Libraries per [06_straw_subject.md](06_straw_subject.md). | 1 commit |
| **8** | Validation | `src/core/validation/*`, `src/shell/validationPanel/*`. Desktop Technical Editing rule pack functional including the §4.7 intent, §4.8 migration, and §4.9 materials/grouping/effects subsections. Runs on demand and at save. | 1 commit |
| **9** | Editing + Change Log | `src/core/editing/*`. Edit operations dispatched from shell flow through `applyEdit`. `ELEMENTS_GROUP`, `ELEMENTS_UNGROUP`, `STYLE_APPLIED`, `STYLE_DETACHED`, `EFFECTS_CHANGED` reducer cases implemented per [20_materials_and_shapes.md](20_materials_and_shapes.md) §3.2 and §7. Change Log appends. Save round-trips. | 1 commit |
| **10** | Background Stress Test | `src/shell/backgroundStress/*`, `src/core/validation/contrast.ts`. Background switcher functional; contrast rule re-evaluates. | 1 commit |
| **11** | Properties Inspector | `src/shell/propertiesInspector/*`. Editing through the inspector updates state; safe-edit-only enforced. Includes Style section (dropdown + Edit / Detach), Effects section (shadows list + blur + opacity), per-shape archetype editors (Rectangle / Ellipse / Line / Image placeholder) per [20_materials_and_shapes.md](20_materials_and_shapes.md) §2.3 and §5.1. | 1 commit |
| **12** | Export | `src/core/export/*`. `spec.md` + `ai_agent_brief.md` + `validation_report.json` produced on export. | 1 commit |
| **13** | Adapter contract | `src/adapter/HostAppAdapter.ts` + `src/adapter/geoSeeAdapter.stub.ts`. Type-checks. Stub throws at runtime. | 1 commit |
| **14** | End-to-end smoke + docs lint | Full automation runbook passes. `npm run check` clean. README points to docs_v1. | 1 commit |

13 phases. 14 commits. Each phase produces a single focused commit with a message in the form `Phase NN: <deliverable summary>`.

## 3. Per-phase specifications

### Phase 0 — Scaffolding

**Files to create:**

- `UI_EDITOR/package.json` with dependencies pinned: `react@18.x`, `react-dom@18.x`, `vite@5.x`, `typescript@5.x`, `@types/react`, `@types/react-dom`, `vitest`, `@vitest/ui`.
- Scripts: `dev`, `build`, `check`, `test` (exactly four; no others).
- `UI_EDITOR/tsconfig.json` extends GeoSee's root tsconfig if available; otherwise strict + ESNext target + JSX react-jsx.
- `UI_EDITOR/vite.config.ts` configured to run on port 5174.
- `UI_EDITOR/index.html` mounts at `#root`.
- `UI_EDITOR/src/main.tsx` renders `<div>Hello Workbench</div>`.
- `UI_EDITOR/README.md` is one line: `See docs_v1/00_README.md for v1 build context.`

**Acceptance:**

- `cd UI_EDITOR && npm install` succeeds with zero peer-dep warnings.
- `npm run dev` reports a URL; that URL returns 200 and the page text contains "Hello Workbench".
- `npm run check` exits 0.

**Commit message:** `Phase 0: scaffold UI_EDITOR with Vite + React + TS, "Hello Workbench" shell`.

### Phase 1 — Core schema + util

**Files to create:** every file under `src/core/schema/` and `src/core/util/` per [02_architecture.md](02_architecture.md) §2.

Types must match the canonical schemas in [07_package_format.md](07_package_format.md) and [05_libraries.md](05_libraries.md) and [08_validation_rules.md](08_validation_rules.md).

**Acceptance:**

- `npm run check` exits 0.
- Every interface mentioned in the docs above is exported from somewhere under `src/core/schema/`.
- `src/core/util/ids.ts` exports `newId()` and `isValidId()`.
- `src/core/util/clone.ts` exports `clone<T>(v: T): T` (deep clone).
- `src/core/util/invariant.ts` exports `invariant(cond, msg)`.

**Commit message:** `Phase 1: core schema types + util helpers`.

### Phase 2 — Package IO + plugin

**Files to create:**

- `plugins/vite-plugin-package-write.ts` per [07_package_format.md](07_package_format.md) §13.
- `src/core/packageIO/readPackage.ts`, `writePackage.ts`, `packageWriteClient.ts`, `pathPolicy.ts`.
- `packages/geosee_editor_sidebar/manifest.json` minimally: id, name, schemaVersion: 1, workbenchVersion: "1.0.0", packageState: "Draft", createdAt, updatedAt, targetHostApp: { name: "geosee" }, profileDefaults: { deviceId: "desktop-1080p", inputId: "mouse-keyboard", useCaseId: "technical-editing" }, rulePackId: "desktop-technical-editing".
- Empty `frames.json`, `containers.json`, `components.json`, `tokens.json`, `libraries.json`, `guides.json`, `validation/rule_pack.json`, `validation/findings.json`, `change_log.json`.
- `vite.config.ts` updated to register the plugin.

**Acceptance:**

- `npm run dev` exposes the three endpoints (manually probe with curl or fetch from devtools).
- `pathPolicy.ts` unit-tested: traversal attempts fail.
- `readPackage("geosee_editor_sidebar")` from a smoke test returns a structured object with `manifest.id === "geosee_editor_sidebar"`.
- `writePackage` round-trip: write a synthetic package; read it back; deep-equal original.

**Commit message:** `Phase 2: package IO via dev-only Vite plugin; minimal sample package`.

### Phase 3 — State + Shell skeleton

**Files to create:**

- `src/shell/state/shellState.ts`, `shellReducer.ts`, `shellActions.ts`, `ShellContext.tsx` per [02_architecture.md](02_architecture.md) §4.
- `src/shell/ShellRoot.tsx`, `src/shell/topBar/TopBar.tsx` (Save / Validate / Export buttons that dispatch placeholder actions), `src/shell/packageBrowser/PackageBrowser.tsx`.
- Empty stubs: `src/shell/canvas/CanvasRoot.tsx`, `src/shell/validationPanel/ValidationPanel.tsx`, `src/shell/toolkit/ToolkitBar.tsx`, `src/shell/layersPanel/LayersPanel.tsx`, `src/shell/libraryPanel/LibraryPanel.tsx`, `src/shell/propertiesInspector/PropertiesInspector.tsx`, `src/shell/backgroundStress/BackgroundStressBar.tsx`.
- `main.tsx` mounts `ShellRoot`.

**Acceptance:**

- Workbench launches; layout matches [02_architecture.md](02_architecture.md) §3.2 wireframe (top bar + left package browser + centre canvas + right library/inspector + bottom toolkit + bottom validation panel).
- Package Browser shows the `geosee_editor_sidebar` entry.
- Clicking the entry dispatches `PACKAGE_LOADED` and the reducer state's `pkg` is non-null (devtools verify).
- `npm run check` clean.

**Commit message:** `Phase 3: shell skeleton with package browser and root reducer`.

### Phase 4 — Canvas Engine

**Files to create:** every file under `src/shell/canvas/` and `src/core/geometry/` per [02_architecture.md](02_architecture.md) §2.

Implementation matches every section of [03_canvas_engine.md](03_canvas_engine.md).

**Acceptance:**

- Each of the 24 acceptance checks in [03_canvas_engine.md](03_canvas_engine.md) §18 passes.
- `npm run test` includes ≥1 unit test per pure function in `src/core/geometry/` (snap, anchors, transforms, distribute, smart guides).

**Commit message:** `Phase 4: canvas engine — pan, zoom, rulers, snapping, anchors, smart guides, transforms, constraints`.

### Phase 5 — Toolkit

**Files to create:** every file under `src/shell/toolkit/` per [02_architecture.md](02_architecture.md) §2 and [04_toolkit.md](04_toolkit.md).

**Acceptance:**

- Each of the 22 acceptance checks in [04_toolkit.md](04_toolkit.md) §7 passes.
- Three additional shape-tool checks: Rectangle Tool draws a `rectangle` Component on drag; Ellipse Tool draws an `ellipse` (Shift constrains to circle); Line Tool draws a `line` (Shift snaps angle to 15°).
- Grouping checks: Ctrl/Cmd+G on a 2-element Selection creates a `container-group`; Ctrl/Cmd+Shift+G ungroups; cross-parent Group attempt refuses with Toast.
- Resize Tool responds to `s` (not `r`).
- `npm run check` clean.

**Commit message:** `Phase 5: toolkit — 13 tools (incl. Rectangle/Ellipse/Line), grouping shortcuts, modal cursors`.

### Phase 6 — Libraries

**Files to create:**

- `src/core/libraries/*` per [02_architecture.md](02_architecture.md) §2.
- `src/shell/libraryPanel/*` per [02_architecture.md](02_architecture.md) §2.
- Populate `packages/geosee_editor_sidebar/libraries.json` and `tokens.json` with the defaults from [05_libraries.md](05_libraries.md) §5.

**Acceptance:**

- Each of the 12 acceptance checks in [05_libraries.md](05_libraries.md) §8 passes.
- `npm run check` clean.

**Commit message:** `Phase 6: libraries — components, colours, icons, tokens; library panel; drag to instantiate`.

### Phase 7 — Straw-subject package

**Files to create / populate:** every file in `packages/geosee_editor_sidebar/` per [06_straw_subject.md](06_straw_subject.md).

Hand-author Frames, Containers, Components, Guides, validation cache, and assets.

**Acceptance:**

- Each of the 8 acceptance checks in [06_straw_subject.md](06_straw_subject.md) §9 passes.
- Workbench launches; all 16 Frames render on the Canvas; zooming to fit shows the panels recognisably similar to GeoSee's editor sidebar.

**Commit message:** `Phase 7: straw-subject GUI package — GeoSee editor sidebar reconstruction`.

### Phase 8 — Validation

**Files to create:** every file under `src/core/validation/` per [02_architecture.md](02_architecture.md) §2 and [08_validation_rules.md](08_validation_rules.md).

Validation Panel (`src/shell/validationPanel/*`) renders findings with severity icons, filtering, and group-by-Container.

**Acceptance:**

- Each of the 18 acceptance tests in [08_validation_rules.md](08_validation_rules.md) §7 passes.
- Running validation on the straw-subject package produces a Findings list (count > 0; no Blockers / Errors).
- `npm run test` passes the new validation tests under `src/core/validation/__tests__/`.

**Commit message:** `Phase 8: validation — Desktop Technical Editing rule pack + validation panel`.

### Phase 9 — Editing + Change Log

**Files to create:** every file under `src/core/editing/`.

`applyEdit` integrates Restricted Surface rules per [08_validation_rules.md](08_validation_rules.md) §8.

The shell wires `Move`, `Resize`, library drag, properties inspector edits, etc., through `applyEdit` and appends Change Records.

**Acceptance:**

- A test that performs Move + Resize + Library drag + Swatch apply + Token apply confirms each produces exactly one Change Record.
- Save persists `change_log.json` with the appended records.
- Attempting to edit a locked element produces a refusal + Blocker finding; no Change Record appended.
- Round-trip: save package; re-load; Frame layout identical; `change_log.json` byte-identical.

**Commit message:** `Phase 9: editing pipeline — applyEdit, Change Log, save round-trip`.

### Phase 10 — Background Stress Test

**Files to create:**

- `src/shell/backgroundStress/BackgroundStressBar.tsx`, `backgroundCatalog.ts`.
- `src/core/validation/contrast.ts` — WCAG contrast math.
- Bundle the four background assets under `packages/geosee_editor_sidebar/assets/backgrounds/`.

**Acceptance:**

- BackgroundStressBar shows four buttons (one per bundled background).
- Clicking each swaps the active Canvas background.
- The `frame.background.contrast-text-min` rule re-evaluates on switch; finding count may change.
- "Cycle backgrounds" affordance walks all four and surfaces worst-case findings per element.

**Commit message:** `Phase 10: background stress test + contrast rule`.

### Phase 11 — Properties Inspector

**Files to create:** every file under `src/shell/propertiesInspector/`.

Per-archetype property editors render fields. Edits dispatch through `applyEdit`. Locked properties render as read-only.

**Acceptance:**

- Selecting a Component shows its props in the Inspector.
- Editing a label updates the canvas + the package + appends a Change Record.
- Editing an anchor / constraint updates the layout.
- Multi-selection shows shared properties only (or "Multiple values" placeholder).
- Locked property: render disabled; tooltip explains.

**Commit message:** `Phase 11: properties inspector — per-archetype editors`.

### Phase 12 — Export

**Files to create:** every file under `src/core/export/`.

Export action in TopBar wires to `exportSpec` + `exportAiAgentBrief` + `exportValidationReport`, then calls Save.

**Acceptance:**

- Export produces `docs/spec.md` and `docs/ai_agent_brief.md` matching [07_package_format.md](07_package_format.md) §12.
- `spec.md` lists every Frame, every archetype used, every Token used.
- `ai_agent_brief.md` includes the no-touch list, validation findings, and acceptance criteria.
- Re-import produces an identical package after canonicalisation.

**Commit message:** `Phase 12: export — spec.md, ai_agent_brief.md, validation report`.

### Phase 13 — Adapter contract

**Files to create:**

- `src/adapter/HostAppAdapter.ts` per [02_architecture.md](02_architecture.md) §3.3.
- `src/adapter/geoSeeAdapter.stub.ts` — type-checked stub implementing every method as `throw new Error("HostAppAdapter not implemented in v1 — embedded mode is v2+")`.

**Acceptance:**

- `npm run check` confirms the stub satisfies the interface.
- `npm run test` includes a test that instantiates the stub and asserts every method throws the expected error.

**Commit message:** `Phase 13: HostAppAdapter contract + geoSeeAdapter.stub for v2 forward compat`.

### Phase 14 — End-to-end smoke + docs lint

**Tasks:**

- Update `UI_EDITOR/README.md` to point at `docs_v1/00_README.md`.
- Run the full automation runbook end-to-end on a clean checkout: no `node_modules`, no `dist`, no warm caches.
- Run `npm run check` and verify exit 0.
- Run all 24 + 22 + 12 + 8 + 18 acceptance checks across the prior phases manually as a final smoke pass.
- Verify no `UI_EDITOR/src/` file imports from `../../src/`, `../../projects/`, or any other GeoSee surface (grep).
- Verify Adapter stub still throws at runtime (`new GeoSeeAdapterStub().listEditableSurfaces()` throws).

**Acceptance:** every v1 Definition-of-Done item from [01_scope.md](01_scope.md) §4 holds.

**Commit message:** `Phase 14: v1 end-to-end smoke; documentation lint clean`.

## 4. Phase ordering invariants

- Phase 0 has no prerequisites.
- Phases 1, 2, 3 must complete before Phase 4 starts (Canvas needs core types + state + package loaded).
- Phase 5 (Toolkit) depends on Phase 4 (Canvas) only — no library prerequisite.
- Phase 6 (Libraries) depends on Phase 3 (state) and Phase 4 (Canvas, for drag drop targeting).
- Phase 7 (straw-subject) depends on Phases 1–6 (needs schema + IO + libraries + ability to render).
- Phase 8 (Validation) depends on Phase 1 (schema) and Phase 7 (a real package to validate). May start in parallel with Phase 6 / 7 if the rule engine is unit-tested against fixtures, but the shell-side panel needs Phase 7's package.
- Phase 9 (Editing) depends on Phases 4 + 5 + 8 (Canvas + Toolkit dispatch into edits; edits run Restricted rules from Phase 8).
- Phase 10 (Background) depends on Phase 7 (assets bundled) and Phase 8 (contrast rule wired).
- Phase 11 (Inspector) depends on Phase 9 (edits flow through `applyEdit`).
- Phase 12 (Export) depends on Phases 1–11 (it reads everything).
- Phase 13 (Adapter contract) has no prerequisite beyond Phase 1 (schema for the interface). Can be implemented anywhere after Phase 1; convention places it at 13 to keep agent focus on the user-facing path first.
- Phase 14 (Smoke) requires everything else.

Agents may parallelise Phases 8 and 9 once Phase 7 is done if running multiple agents. Sequential single-agent execution is the documented default.

## 5. Commit discipline

- Each phase ends with **one commit** containing only the files that phase created/modified.
- Commit messages use the exact format above: `Phase NN: <deliverable summary>`.
- Co-authored-by footer per CLAUDE.md / project convention.
- No `--no-verify`. No `--amend` on previous phases.
- Before commit: run `npm run check` and `npm run test` (if present); both must pass.

## 6. Reset behaviour

If a phase fails its acceptance checks:

1. Do **not** commit.
2. Diagnose; fix in place.
3. Re-run acceptance.
4. Commit when green.

If multiple consecutive phases fail to converge, stop the run and surface to the human author. The automation runbook ([11_agent_automation_runbook.md](11_agent_automation_runbook.md)) covers this escalation path.
