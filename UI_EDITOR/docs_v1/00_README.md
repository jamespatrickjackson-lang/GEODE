# GUI Workbench — v1 Build Pack

**Document status:** v1.0 build contract. Approved scope; awaiting agent execution.
**Folder:** `C:\GeoSee\GeoSee_Dev\UI_EDITOR\docs_v1\`
**Relation to `..\docs\` (v0.1):** v0.1 is the concept review pack. This v1 pack closes the load-bearing v0.1 open questions and commits to a buildable, agent-executable first version.

---

## 1. Audience: agents, not humans

This pack is written for autonomous coding agents (Claude Code, Codex) to execute end-to-end without follow-up clarification. Every doc carries:

- **Goals** — what state the codebase should reach.
- **Mechanical steps** — exact file paths, exact symbol names, exact API shapes.
- **No-touch rules** — what the agent must not modify.
- **Acceptance criteria** — observable, scriptable checks (`npm run …` etc.).
- **Cross-links** — explicit pointers to dependent docs so an agent never has to guess.

Read order is not optional: dependencies between phases assume the agent has internalised earlier docs before acting on later ones. The agent automation runbook ([11_agent_automation_runbook.md](11_agent_automation_runbook.md)) is the canonical entry point for a one-shot build.

## 2. What v1 builds, in one sentence

A standalone visual editor — Figma-lite — that loads a GUI Package from disk, renders its Frames on a Canvas with rulers/snapping/anchors, lets the author edit safe surfaces using a Toolkit, draws from Libraries (components, colours, tokens), runs deterministic Validation, and exports a versioned GUI Package + spec + AI-agent brief.

## 3. Product identity (locked)

| Field | Value |
| --- | --- |
| Working product name | **GUI Workbench** |
| Pack version | **v1.0** |
| Folder layout | `C:\GeoSee\GeoSee_Dev\UI_EDITOR\` (sibling of GeoSee source tree; never imports GeoSee internals) |
| Tech stack | Vite + React 18 + TypeScript (strict) |
| Run mode | Standalone only. Embedded mode deferred to v2+. |
| Storage | Local filesystem via dev-only Vite plugin (mirrors GeoSee's `vite-plugin-author-write` pattern) |
| Test subject | GeoSee's current editor sidebar reconstructed as a sample GUI Package; see [06_straw_subject.md](06_straw_subject.md) |

## 4. Locked decisions inherited from v0.1 open-questions index

| v0.1 question | v1 answer | See doc |
| --- | --- | --- |
| Q-003 standalone vs embedded priority | Standalone v1; embedded v2+ | [01_scope.md](01_scope.md) §2 |
| Q-004 adapter/core split | Core = schema + canvas + validation + export + package IO. Adapter = host wiring (designed but not built in v1). | [02_architecture.md](02_architecture.md) §3.3 |
| Q-005 first GOC surface | Whole GeoSee editor sidebar | [06_straw_subject.md](06_straw_subject.md) |
| Q-006 permanently locked surfaces | Renderer / data / state / permissions / destructive / auth / external — all locked, ever. | [06_straw_subject.md](06_straw_subject.md) §6 |
| Q-007 package format folder vs single-file | **Folder** (diff-friendly, asset-friendly) | [07_package_format.md](07_package_format.md) §2 |
| Q-008 JSON vs YAML | **JSON** everywhere | [07_package_format.md](07_package_format.md) §2 |
| Q-010 / Q-011 rule pack thresholds | Concrete numbers in the Desktop Technical Editing pack | [08_validation_rules.md](08_validation_rules.md) §3 |
| Q-013 AI review boundary | Deferred. Validation engine designed to attach advisory layer later without redesign. | [08_validation_rules.md](08_validation_rules.md) §5 |
| Q-017 project override promotion | Deferred. Single package in scope for v1. | [12_deferred_to_v2.md](12_deferred_to_v2.md) |
| Q-022 embedded save model | N/A in v1 (no embedded mode); v1 export = on-disk package | [07_package_format.md](07_package_format.md) §6 |

## 5. Doc index and reading order

| # | Doc | Purpose |
| --- | --- | --- |
| 00 | [README](00_README.md) | This file: status, locked decisions, doc index. |
| 01 | [scope](01_scope.md) | In/out for v1; success criteria. |
| 02 | [architecture](02_architecture.md) | Code layout, modules, tech, state shape. |
| 03 | [canvas_engine](03_canvas_engine.md) | Canvas, rulers, snapping, anchors, transforms, constraints. |
| 04 | [toolkit](04_toolkit.md) | Tool palette: select / move / resize / align / distribute / draw / colour / text. |
| 05 | [libraries](05_libraries.md) | Component library, colour library, icon library, token library. |
| 06 | [straw_subject](06_straw_subject.md) | GeoSee editor sidebar reconstruction as the v1 sample package. |
| 07 | [package_format](07_package_format.md) | GUI Package on-disk folder shape; manifest schema; embedded layout/anchor data. |
| 08 | [validation_rules](08_validation_rules.md) | Desktop Technical Editing rule pack with concrete thresholds. |
| 09 | [glossary](09_glossary.md) | Canonical terms; v0.1 terms preserved, v1 Canvas-era terms added. |
| 10 | [build_phases](10_build_phases.md) | Agent-executable phased plan with per-phase acceptance criteria. |
| 11 | [agent_automation_runbook](11_agent_automation_runbook.md) | One-shot Codex orchestrator: what to run, in what order, what to commit, what to verify. |
| 12 | [deferred_to_v2](12_deferred_to_v2.md) | Explicit non-goals with rationale. |

## 6. Conventions for the pack

- All paths in this pack are relative to `C:\GeoSee\GeoSee_Dev\UI_EDITOR\` unless absolute.
- "Workbench" = the v1 GUI Workbench application. "GeoSee" = the surrounding host app (the existing `C:\GeoSee\GeoSee_Dev\` Vite+React tree).
- "Straw subject" = a static reference target. The GeoSee editor sidebar is *modelled* in the workbench; the workbench cannot mutate GeoSee.
- "Locked" = outside v1's edit surface by deliberate scope.
- v0.1 doc references use the form `..\docs\<filename>.md`. v1 doc references use `<NN>_<topic>.md`.
- CamelCase for TypeScript symbols, snake_case for filesystem paths in package contents, kebab-case for ids inside packages (e.g. `component-pill-button`).
- All schema validation messages and validation findings must use the v0.1 Severity Level ladder: Info, Suggestion, Warning, Error, Blocker.

## 7. Boundary against GeoSee (CLAUDE.md applies)

The GeoSee operating contract in `C:\GeoSee\GeoSee_Dev\CLAUDE.md` continues to apply. Specifically:

- v1 workbench code lives entirely under `UI_EDITOR/`. It does not import from `..\src\`, `..\projects\`, or any other GeoSee surface.
- v1 does not modify `..\vite.config.ts`, `..\package.json`, or any GeoSee build wiring. v1 has its own `UI_EDITOR/package.json` and `UI_EDITOR/vite.config.ts`.
- The straw-subject reconstruction is a *manual* model of GeoSee's editor sidebar based on visual and structural observation. v1 does not auto-import GeoSee source.
- Output rail (no first/second-person pronouns) applies to docs in this pack and to commit messages produced from v1 work.
- Search hygiene (no `Grep`/`Glob` into `projects/*/data/**`, `data/**`, `dist*/**`, `node_modules/**`, archive subtrees, `playwright-report/**`, `test-results/**`) applies during v1 work.

## 8. Naming alignment with v0.1

Every named architectural term in this pack is taken verbatim from v0.1's [glossary](../docs/gui_workbench_glossary_naming_v0_1.md) where it existed: Workbench Core, Standalone Shell, Embedded Shell, Host-App Adapter, GUI Package, GUI Project, Design Token, Component, Component Variant, Component State, Container, Container Archetype, Panel, Section, Safe Edit Surface, Restricted Surface, Project Override, Base GUI System, Use-Case Profile, Device / Display Profile, Input Method Profile, Validation Rule, Validation Rule Pack, Validation Finding, Severity Level (Info / Suggestion / Warning / Error / Blocker), AI-Assisted Review, Background Stress Test, Implementation Brief, AI-Agent Brief, Change Record / Change State (Draft / Validated / Approved / Applied / Rejected / Archived).

v1 introduces a small set of additional terms necessary for the Figma-lite editor surface: Canvas, Frame, Ruler, Anchor, Snap, Guide, Toolkit, Tool, Layers Panel, Library Panel, Properties Inspector, Swatch, Constraint, Selection, Transform Handle, Smart Guide, Safe Area, Pixel Grid. All are defined in [09_glossary.md](09_glossary.md) §3 with explicit cross-reference to v0.1 terms they extend.

## 9. Definition of v1 done

v1 is shippable when **all** of the following hold:

1. `npm install && npm run dev` from `UI_EDITOR/` launches the workbench on `http://localhost:5174`.
2. The workbench loads the bundled `geosee_editor_sidebar` sample package on startup.
3. The author can: open a Frame on the Canvas; select and move Containers and Components with the Toolkit; snap to the pixel grid, to other elements' edges, to anchor points, and to safe-area edges; align/distribute multiple selected elements; assign Swatches from the active Library; edit labels via the Properties Inspector; reorder Layers; lock and hide Layers.
4. Validation runs on demand and on save. Findings render with correct Severity, a stable location reference, and a suggested correction where applicable.
5. Background Stress Test renders the active Frame over at least four canonical backgrounds (plain dark, plain light, low-contrast noise, GOC terrain capture) and surfaces a contrast warning when the panel becomes illegible.
6. Export produces a folder containing `manifest.json`, `components.json`, `containers.json`, `frames.json`, `tokens.json`, `libraries.json`, `validation_report.json`, `change_log.json`, `spec.md`, and `ai_agent_brief.md`.
7. An exported package round-trips: re-importing produces an identical Frame layout and validation state.
8. `npx tsc --noEmit` clean in `UI_EDITOR/`.
9. No `UI_EDITOR/` code imports from `..\src\`, `..\projects\`, or any other GeoSee surface.
10. The bundled `geosee_editor_sidebar` package's exported `spec.md` is intelligible to a developer who has never seen the workbench.
11. The agent automation runbook ([11_agent_automation_runbook.md](11_agent_automation_runbook.md)) executes end-to-end with no human intervention.
12. The Host-App Adapter contract is present (interface only) at `src/adapter/HostAppAdapter.ts` and a stub adapter `src/adapter/geoSeeAdapter.stub.ts` type-checks but throws at runtime. v2 will fill in the stub.
