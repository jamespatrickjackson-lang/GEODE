# v1 Glossary

Canonical terms for v1. All other v1 docs use this vocabulary verbatim. Agents must not invent synonyms.

This glossary inherits every term from v0.1's [glossary](../docs/gui_workbench_glossary_naming_v0_1.md) without modification. The list below restates the inherited terms briefly for agent convenience and adds the v1 Canvas-era terms.

---

## 1. Product-level terms (inherited from v0.1)

| Term | Meaning |
| --- | --- |
| **GUI Workbench** | The product. Working name; alternates ("Interface Workbench", "Panel Foundry") not adopted in v1. |
| **Workbench Core** | The portable, host-agnostic engine (`src/core/`). Owns schema, validation, package IO, export. |
| **Standalone Shell** | The visible workbench app (`src/shell/`). React UI for the editor, validation panel, canvas, toolkit. |
| **Embedded Shell** | An in-app workbench surface. **Deferred to v2+ in v1.** |
| **Host-App Adapter** | The contract between Workbench Core and a specific host app. v1 designs the TypeScript interface only; v2 implements the GeoSee adapter. |
| **GUI Package** | The portable folder + JSON output produced by the workbench. The unit of import / export. See [07_package_format.md](07_package_format.md). |
| **GUI Project** | A logical authoring session. In v1, one GUI Project corresponds to one GUI Package on disk. |
| **Design Token** | A named reusable interface value (spacing, colour, radius, font, etc.). |
| **Component** | A reusable interface element (button, slider, toggle, input, etc.). Carries variants, states, allowed sizes, validation rules, rationale. |
| **Component Variant** | A named visual / behavioural variation of a Component (e.g. "pill button — surface: tinted"). |
| **Component State** | Default, hover, active, focus, disabled, etc. for a Component or Variant. |
| **Container** | A grouping element that holds Components or other Containers (e.g. a layer panel, a footer action row). |
| **Container Archetype** | A reusable Container template (e.g. "page-list row archetype"). |
| **Panel** | A top-level Container in the workbench's grouping hierarchy. |
| **Section** | A subgrouping inside a Panel. |
| **Safe Edit Surface** | Aspects of a Panel/Container/Component that the author may modify (labels, spacing, order, variants, visibility, colours, tokens). Schema-marked. |
| **Restricted Surface** | Aspects that v1 cannot modify (locked at schema or by the v0.1 Safe Editing Boundary Charter). |
| **Project Override** | A project-specific GUI variant on top of a Base GUI System. **Deferred to v2 in v1.** |
| **Base GUI System** | The default GUI definitions a Project Override builds atop. v1 effectively only models the base. |
| **Use-Case Profile** | A named context (e.g. "technical editing", "client presentation"). Drives validation. |
| **Device / Display Profile** | A named display target (desktop monitor, laptop, tablet, projector, etc.). Drives validation. |
| **Input Method Profile** | A named input method (mouse + keyboard, touch, stylus, presentation remote, etc.). Drives validation. |
| **Validation Rule** | A deterministic check (touch target ≥ N px, contrast ≥ X:Y, etc.). |
| **Validation Rule Pack** | A set of rules tied to a Use-Case + Device + Input Profile. v1 ships one: "Desktop Technical Editing". |
| **Validation Finding** | A single rule's output: `{ severity, ruleId, location, message, currentValue, suggestedValue?, profile }`. |
| **Severity Level** | One of: **Info / Suggestion / Warning / Error / Blocker**. Strictly ordered. |
| **AI-Assisted Review** | Optional advisory layer atop deterministic validation. **Deferred to v2 in v1**, but the finding shape carries an optional `advisory?` field for forward compat. |
| **Background Stress Test** | A preview mode that renders the active Frame over various backgrounds (plain, terrain, noise, etc.) to surface contrast / legibility issues. v1 ships with four bundled backgrounds. |
| **Implementation Brief** | A human-readable export describing the GUI structure for developers. v1 names it `spec.md` inside the package. |
| **AI-Agent Brief** | A constrained implementation brief for AI coding agents. v1 names it `ai_agent_brief.md` inside the package. |
| **Change Record** | A single entry in the package's change history: who, when, what changed, validation status, rationale. |
| **Change State** | One of: **Draft / Validated / Approved / Applied / Rejected / Archived**. v1 only uses Draft / Validated / Approved. Applied/Rejected/Archived deferred to v2 (need embedded mode). |

## 2. Severity ladder (strict)

Lowest to highest:

1. **Info** — neutral observation; does not block anything.
2. **Suggestion** — an improvement opportunity; does not block.
3. **Warning** — measurable issue that should be reviewed; does not block save but is surfaced prominently.
4. **Error** — measurable failure; save permitted only if the author explicitly acknowledges the finding with rationale; Change State cannot reach Validated while Error findings exist unacknowledged.
5. **Blocker** — categorical failure (e.g. attempted edit of a Restricted Surface); the action is refused entirely and never reaches the save pipeline.

The order is structural. An agent computing the worst finding in a set MUST use this exact ordering.

## 3. Canvas-era terms (new in v1)

These extend the v0.1 Visual Editing Bench concept. None are introduced casually; each is required by the Figma-lite product shape.

| Term | Meaning |
| --- | --- |
| **Canvas** | The 2D infinite editing surface inside the Standalone Shell where Frames are laid out and edited. Supports pan, zoom, multi-select. |
| **Frame** | A bounded rectangular workspace on the Canvas that contains a single Panel-being-edited plus its surrounding chrome (rulers, safe area, background stress overlay). One GUI Package may contain several Frames (e.g. one per Panel). |
| **Ruler** | Horizontal and vertical pixel-coordinate scales drawn along the top and left edges of each Frame. Origin is the Frame's top-left. |
| **Anchor** | An alignment reference point or edge that elements snap to: Frame edges (left/top/right/bottom/center-h/center-v), safe-area edges, Container edges, sibling element edges. Anchors are computed on demand; they are not stored as schema entities. |
| **Snap** | The behaviour that pulls a moving / resizing element to an Anchor when the cursor is within a threshold (default 4 px in Canvas-space, configurable per Toolkit). |
| **Guide** | A user-dragged horizontal or vertical line on the Canvas that elements also snap to. Guides persist with the Frame in the package. |
| **Smart Guide** | A short, ephemeral guide that appears at runtime when a moving element aligns with another element's edge or centre (e.g. "this button's left edge matches that container's left edge"). Does not persist. |
| **Toolkit** | The palette of editing tools (`src/shell/toolkit/`). v1 ships: Select, Move, Resize, Container, Text, Divider, Eyedropper, Colour, Align, Distribute. |
| **Tool** | A single mode in the Toolkit. Only one Tool is active at a time. Modal cursor + modal canvas interaction. |
| **Layers Panel** | A tree view of the active Frame's Containers and Components in Z-order. Supports reorder, lock, hide, rename, and selection. |
| **Library Panel** | A right-side panel showing the active Libraries (Components, Colours, Icons, Tokens). Drag from here onto the Canvas to instantiate. |
| **Properties Inspector** | A right-side panel showing properties of the current Selection. Edits here flow through Workbench Core's `applyEdit` and produce a Change Record. |
| **Swatch** | A reusable named colour entry in a Colour Library. Carries a hex, an optional alpha, a name, and rationale. |
| **Constraint** | A pin rule for how an element behaves when its parent Container resizes: left-pinned, right-pinned, both-pinned (stretch), centred, scale, fixed. Mirrors Figma's constraints. |
| **Selection** | The set of currently-selected Container/Component ids on the active Frame. v1 supports single and multi (shift-click + marquee). |
| **Transform Handle** | One of the 8 resize handles drawn around a selected element when the Resize Tool is active, plus the move handle (the body of the element). |
| **Safe Area** | A bounded region inside a Frame within which all editable content must live. Driven by the active Device Profile (e.g. desktop = full Frame; tablet portrait = Frame minus 24 px insets). Anchors snap to it. Validation flags content outside it. |
| **Pixel Grid** | The 1-px lattice the Canvas snaps to by default. Author can change to 2 / 4 / 8 px via the View menu. |
| **Library** | A named collection of reusable assets. v1 ships four kinds: Component Library, Colour Library, Icon Library, Token Library. See [05_libraries.md](05_libraries.md). |

## 4. Filesystem / package terms (new in v1)

| Term | Meaning |
| --- | --- |
| **Package Folder** | The on-disk directory at `UI_EDITOR/packages/<package-id>/` containing one GUI Package. |
| **Package Manifest** | The `manifest.json` file at the root of a Package Folder. Declares schema version, workbench version, target host app, package state, etc. See [07_package_format.md](07_package_format.md) §3. |
| **Generated Docs** | The `docs/` subfolder inside a Package Folder. Holds `spec.md` and `ai_agent_brief.md`. Re-generated on every export. |
| **Bundled Asset** | Any binary or text asset stored under the Package Folder's `assets/` (e.g. background stress test images, exported preview PNGs). |
| **Schema Version** | The integer version of the GUI Package schema. v1 ships `schemaVersion: 1`. Future schema changes increment monotonically; readers reject unknown higher versions. |
| **Workbench Version** | The version of the GUI Workbench code that wrote / read the package. v1 stamps `workbenchVersion: "1.0.0"`. |

## 5. Naming conventions

### 5.1 Document filenames

- v1 docs: `NN_topic.md` (two-digit index, snake_case). e.g. `03_canvas_engine.md`.
- v0.1 docs: `gui_workbench_<topic>_v0_1.md`. Preserved; do not rename.

### 5.2 Package folder names

- snake_case ids matching the manifest's `id` field.
- v1's bundled sample: `geosee_editor_sidebar`.

### 5.3 Object ids inside packages

- kebab-case for human-readable ids: `component-pill-button`, `container-page-row`, `frame-page-manager`.
- Ids must be unique within the kind (component ids unique to components, container ids unique to containers, etc.).
- Ids are stable; renaming an id is a breaking change recorded in the Change Log.

### 5.4 TypeScript symbols

- PascalCase for types, interfaces, components: `PackageManifest`, `Frame`, `CanvasRoot`.
- camelCase for functions, variables, props: `applyEdit`, `selectedIds`, `activeFrameId`.
- Constants exported from `src/core/`: SCREAMING_SNAKE_CASE only for true environmental constants (e.g. `DEFAULT_SNAP_THRESHOLD_PX`). Otherwise camelCase.

### 5.5 Validation rule ids

- `<surface>.<rule>.<variant?>` snake_case. Examples:
  - `component.touch-target-min`
  - `component.text.font-size-min`
  - `container.section.edge-clearance-min`
  - `frame.background.contrast-text-min`
  - `layout.element-overlap.warning`
  - `layout.element-outside-safe-area.forbidden`

### 5.6 Change Record kinds

snake_case verbs. The full v1 set:

- Schema mutation: `component_added`, `component_removed`, `component_property_changed`, `container_added`, `container_removed`, `container_property_changed`, `container_reordered`, `frame_created`, `frame_removed`, `frame_resized`, `frame_property_changed`, `guide_added`, `guide_removed`, `guide_moved`.
- Library mutation: `library_entry_added`, `library_entry_edited`, `library_entry_removed`, `swatch_added`, `swatch_recoloured`, `token_added`, `token_changed`.
- Intent: `intent_edited` (any IntentAnnotations field changed on any element).
- Validation: `validation_run`, `error_acknowledged`, `error_unacknowledged`.
- State machine ([16_change_state_machine.md](16_change_state_machine.md)): `state_advanced_to_validated`, `state_advanced_to_approved`, `state_demoted_to_draft`.
- Package lifecycle: `package_saved`, `package_exported`, `package_approved`.

## 6. Preferred language (carried from v0.1)

- "Author" = the human using the workbench.
- "Agent" = the autonomous coding agent executing build phases.
- "User" is reserved for end-users of the eventual GUI a workbench package describes; avoid using "user" for the workbench operator. Use "Author" instead.
- "Host app" = the application a future Host-App Adapter wires the workbench into. v1's host app is GeoSee (referenced only structurally via the straw subject; no live wiring).
- Avoid first/second-person pronouns ("I", "we", "you", "our") in docs and commit messages, per CLAUDE.md output rail.

## 7. Cross-references quick map

| If a doc says… | Look here |
| --- | --- |
| "Canvas" / "Frame" / "Ruler" / "Snap" | §3 above; details in [03_canvas_engine.md](03_canvas_engine.md). |
| "Toolkit" / Tool names | §3 above; details in [04_toolkit.md](04_toolkit.md). |
| "Library" / "Swatch" | §3 above; details in [05_libraries.md](05_libraries.md). |
| "GUI Package" / "Package Manifest" | §4 above; details in [07_package_format.md](07_package_format.md). |
| "Validation Finding" / "Rule Pack" / "Severity" | §1 + §2 above; details in [08_validation_rules.md](08_validation_rules.md). |
| "Straw Subject" / "GeoSee editor sidebar" | [06_straw_subject.md](06_straw_subject.md). |
| "Host-App Adapter" | §1 above; v1 designs the interface only; see [02_architecture.md](02_architecture.md) §3.3. |
| Any term from v0.1 not listed here | [v0.1 glossary](../docs/gui_workbench_glossary_naming_v0_1.md). |
