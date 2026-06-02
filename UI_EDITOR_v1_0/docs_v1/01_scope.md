# v1 Scope

## 1. Headline goal

Build a **standalone Figma-lite visual editor** for application GUI panels. The editor must let an author lay out, edit, validate, and export interface intent against a known straw subject (GeoSee's editor sidebar), and produce a portable GUI Package + documentation that downstream developers and AI agents can act on without ambiguity.

## 2. In scope for v1

### 2.1 Standalone Shell + Canvas

- Vite + React + TypeScript application launched via `npm run dev` from `UI_EDITOR/`.
- A multi-Frame **Canvas** with pan (space + drag, middle-mouse drag) and zoom (mouse wheel, +/- shortcuts, fit-to-frame).
- **Rulers** along Canvas top and left edges. Origin = active Frame's top-left.
- **Pixel Grid** (configurable: 1 / 2 / 4 / 8 px; default 1).
- **Anchors** computed at runtime from Frame edges, Container edges, sibling-element edges, Safe Area edges, and user **Guides**.
- **Snapping** with default 4-px threshold (configurable). Snaps to: Pixel Grid, Anchors, Guides, Smart Guides.
- **Smart Guides** appear at runtime when a moving / resizing element aligns with another element's edge or centre.
- **Safe Area** rendered as a dashed inset boundary per Frame, driven by the active Device Profile.
- **Background Stress Test** overlay: switch the Canvas's Frame background between four bundled images (plain dark, plain light, low-contrast noise, GOC terrain capture).

### 2.2 Toolkit (full v1 set)

See [04_toolkit.md](04_toolkit.md) for per-tool spec. v1 ships:

| Tool | Purpose |
| --- | --- |
| Select | Click / shift-click / marquee select Containers and Components. |
| Move | Drag Selection. Honours snapping + smart guides + arrow-key nudge. |
| Resize | Drag Transform Handles on Selection. Honours snapping + Constraints. |
| Container | Draw a new empty Container onto the Canvas. |
| Text | Insert an inline editable text Component. |
| Divider | Insert a horizontal or vertical Divider Component. |
| Eyedropper | Sample a colour from the Canvas (including the active background) to a Swatch. |
| Colour | Open the Colour picker for the active Selection. |
| Align | Align Selection (left / right / top / bottom / centre-h / centre-v) to Selection bounds or to Frame bounds. |
| Distribute | Distribute Selection (horizontally / vertically) at equal spacing. |

### 2.3 Layers Panel

- Tree view of the active Frame's Containers and Components in Z-order.
- Per-row: name (rename inline), lock toggle, hide toggle, Z-order arrows.
- Selection in Layers Panel mirrors Selection on Canvas.
- Drag to reorder Z. Drag onto a Container to reparent.

### 2.4 Library Panel

See [05_libraries.md](05_libraries.md) for full spec. v1 ships four Libraries:

- **Component Library** — drag-from-library onto Canvas to instantiate a Component.
- **Colour Library** — Swatches; assign to Selection.
- **Icon Library** — small SVG icon set; drag onto Canvas.
- **Token Library** — Design Tokens (spacing scale, radii, font sizes); apply to Selection.

### 2.5 Properties Inspector

- Shows properties of the current Selection.
- All Safe Edit Surface fields editable (labels, dimensions, padding, variant, state, accent colour, anchor, constraint, visibility).
- Edits dispatch through `core/editing/applyEdit.ts` → state update + Change Record.

### 2.6 Validation

- Deterministic rule pack: **Desktop Technical Editing** (concrete thresholds in [08_validation_rules.md](08_validation_rules.md)).
- Runs on demand (Validate button), automatically on save, and incrementally during edits for the touched elements.
- Findings panel shows Severity, location, message, currentValue, suggestedValue. Filters by Severity. Group-by Container.
- Findings with Severity ≥ Error cannot be silently saved past Validated state without an acknowledged rationale.
- Blocker findings refuse the action entirely.

### 2.7 Background Stress Test

- Per-Frame selector for active background (four bundled assets shipped under `packages/<id>/assets/backgrounds/`).
- The contrast Validation Rule reads the active background when computing findings for transparent / semi-transparent Containers.
- "Cycle backgrounds" affordance: walk through all backgrounds and surface the worst-case finding per element.

### 2.8 Package IO

- Load a GUI Package from `UI_EDITOR/packages/<id>/`.
- Save changes back to the same folder.
- Export = save + regenerate `validation_report.json`, `change_log.json`, `spec.md`, `ai_agent_brief.md`.
- Re-import-round-trip must produce identical Frame layout and validation state.

### 2.9 Change Log

- Every edit produces a Change Record.
- Per-package change log file: `change_log.json` with append-only entries.
- Change States used in v1: Draft, Validated, Approved.
- Each save commits at least one Change Record; each Validate run records a `validation_run` Change Record with the finding count and worst severity.

### 2.10 Host-App Adapter contract (design only, not implementation)

- `src/adapter/HostAppAdapter.ts` ships the TypeScript interface that v2 will implement.
- `src/adapter/geoSeeAdapter.stub.ts` ships as a type-checked stub that throws at runtime.
- This is a non-negotiable structural requirement: v2 must be able to drop in an implementation without redesigning the Workbench Core / Shell boundary.

### 2.11 Bundled straw subject package

- `packages/geosee_editor_sidebar/` ships in v1 as the reference target.
- Hand-modelled from GeoSee's current editor sidebar (Page Manager, Global Settings, Layer panels, Camera Studio, Lighting Studio, tool containers).
- Used by the agent automation runbook as the smoke-test target on every phase.

### 2.12 Agent automation entry point

- [11_agent_automation_runbook.md](11_agent_automation_runbook.md) is the canonical one-shot Codex orchestration doc.
- Every build phase in [10_build_phases.md](10_build_phases.md) has explicit phase-completion acceptance criteria that the runbook checks.

## 3. Out of scope for v1 (with rationale, full list in [12_deferred_to_v2.md](12_deferred_to_v2.md))

| Out | Why |
| --- | --- |
| Embedded mode + real Host-App Adapter implementation | Embedded integration is a separate v2 effort; the v1 standalone shape is sufficient to prove the schema and validation. The adapter interface is designed in v1 so v2 can wire it. |
| AI-Assisted Review layer | Deterministic rules first per v0.1 validation philosophy. The finding shape carries an optional `advisory?` field for forward compat. |
| Import / Inventory (screenshots, code, design token files) | The straw subject is hand-modelled; auto-import would couple v1 to specific source shapes. |
| Multiple Validation Rule Packs (touch / tablet / projector / a11y-strict / phone) | v1 ships the one most-used profile (Desktop Technical Editing). Adding rule packs is a v2 expansion task, structurally trivial once the engine exists. |
| Project Override layering (Base → App Default → Project Override → User Draft) | v1 supports one package at a time. Layering is a v2 architectural addition. |
| Wizard-driven creation flow | v1 opens existing packages or starts from a blank package. The guided creation wizard from the v0.1 PRD is deferred. |
| Open-source extraction / npm publishing of the Workbench Core | v1 lives in the GeoSee monorepo under `UI_EDITOR/`. Standalone publishing is a v3+ concern. |
| Undo / Redo | v1 is save-or-discard. Undo is a v2 quality-of-life feature. |
| Multi-user collaboration | Single-user local only. |
| Container Archetype Library beyond what the straw subject requires | v1 expresses only the archetypes the straw subject needs. |
| User-Testing Scaffold export | v0.1 lists this as a future output; deferred. |
| Network calls / cloud sync | All filesystem-local in v1. |

## 4. Definition of "Done" for v1

v1 is complete when **all** of the following observable facts hold:

| # | Fact | How an agent verifies |
| --- | --- | --- |
| 1 | Workbench launches | `cd UI_EDITOR && npm install && npm run dev` returns a local URL; HTTP 200 from that URL. |
| 2 | Bundled package auto-loads | Workbench startup loads `packages/geosee_editor_sidebar/`; landing UI shows at least one Frame populated. |
| 3 | Canvas interactions work | Pan + zoom + select + move + resize + multi-select + reparent + reorder Z all functional. Smoke-tested via the agent automation runbook's interaction tests. |
| 4 | Rulers + snapping correct | A test that drags a 100×40 element to (50, 30) lands at exactly (50, 30) when snap-to-pixel-grid is on. |
| 5 | Anchors + smart guides | A test that drags an element near another element's left edge surfaces a Smart Guide and snaps to it. |
| 6 | Toolkit complete | All 10 v1 Tools dispatch their canonical action. Per-tool acceptance in [04_toolkit.md](04_toolkit.md). |
| 7 | Libraries complete | All four Libraries load from the bundled package and instantiate / apply correctly. |
| 8 | Validation correct | Running the rule pack on the straw subject produces ≥1 of each Severity ladder for testing visibility; the suite of canonical tests in [08_validation_rules.md](08_validation_rules.md) §7 all pass. |
| 9 | Background Stress Test | Switching backgrounds visibly changes the Canvas; the contrast rule re-evaluates and may change finding count. |
| 10 | Package round-trip | Export then re-import produces byte-identical Frame layouts and the same validation result. |
| 11 | Spec + brief exports | `spec.md` and `ai_agent_brief.md` are produced; both are non-empty and reference the actual package's Frames and Components. |
| 12 | Change Log integrity | `change_log.json` records every save with a Change Record; no save lacks an entry. |
| 13 | tsc clean | `npx tsc --noEmit` exits 0. |
| 14 | No GeoSee imports | `grep -r "from \"\\.\\./\\.\\./src\\|from \"\\.\\./\\.\\./projects" UI_EDITOR/src` returns nothing. |
| 15 | Adapter contract present | `src/adapter/HostAppAdapter.ts` exists and exports the interface defined in [02_architecture.md](02_architecture.md) §3.3. The stub adapter type-checks. |
| 16 | Automation runbook runs end-to-end | The runbook in [11_agent_automation_runbook.md](11_agent_automation_runbook.md) executes from a clean `UI_EDITOR/` (no `node_modules`, no `dist`) to a passing state without human intervention. |

## 5. What v1 is **not** trying to be

- A pixel-perfect re-skin of Figma. The Canvas is functional and ergonomic, not slick.
- A replacement for GeoSee's existing editor sidebar. The straw subject is a *target*, not a *replacement*.
- A self-hosting environment. v1 cannot edit its own UI through itself.
- A polished external product. v1 is in-house tooling for the GeoSee team and downstream agents.
- A general-purpose component library publisher. v1 produces packages; broader distribution is a v3+ concern.

## 6. Why this scope, in two sentences

v1 is large enough to prove the schema, validation engine, package format, and visual editing surface against a realistic straw subject. It is bounded enough that a Codex automation can build all of it from these docs in one sweep, leaving the embedded-mode and rule-pack-library work as clean, additive v2 efforts.
