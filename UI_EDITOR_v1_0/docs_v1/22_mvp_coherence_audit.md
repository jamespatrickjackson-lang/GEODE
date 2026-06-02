# v1 MVP Coherence Audit

## 1. Purpose

Walk the whole pack end-to-end as a tester would. Surface the gaps in logic, data flow, architecture, tools, runtime UI, and systems that would stop a user from completing real tasks. Specify the fix for each gap and the doc that absorbs the fix. Add a deep runtime UI spec for the Standalone Shell. Add an MVP test plan a tester (or the agent automation) can execute to certify v1 done.

This doc is the **last gate** before handoff to Codex. After this doc closes its open items, the pack is internally consistent and the build can run unattended.

## 2. v1 product story (one paragraph)

A standalone Figma-lite editor that loads a GUI Package from disk, renders its Frames on a Canvas with rulers / snapping / anchors, lets the author lay out Containers and Components using a 13-Tool palette plus shape primitives, applies Styles + Tokens + Effects from a 5-kind Library, validates against a Desktop Technical Editing rule pack, supports group/ungroup with cascade selection, captures intent annotations per element, runs a Draft → Validated → Approved state machine with explicit Error acknowledgement, and exports a portable folder + JSON package plus a human-readable spec + an AI-Agent Brief carrying intent and validation findings. Standalone-only in v1; embedded mode and the live Host-App Adapter are designed in v1 (interface only) and implemented in v2.

## 3. Pending docs (forward refs)

| Doc | Status | Notes |
| --- | --- | --- |
| 21_interactive_overlays_and_primitives | **NOT YET WRITTEN.** Scope approved (Tier 1 + Tier 2 per a prior decision). | Adds: per-side padding, tooltip / modal / tabs / dropdown-menu / carousel Component archetypes, toggle / segmented button states, loading button state. The audit below assumes doc 21 lands; gaps that depend on it are flagged inline. |

The audit covers v1 **as intended** (including doc 21 scope). If doc 21 is descoped, the §5 gap list grows by the items annotated as "depends on doc 21."

## 4. Use cases

Eight representative user journeys. Each walks the workbench end-to-end. Per-step: what's specified (✅), what's a gap (⚠️), severity if missing (🔥 / ⚠️ / 🪤 per [19_known_pitfalls.md](19_known_pitfalls.md) scale).

### UC-1: First-time user creates a new empty package

**Goal:** author opens the workbench fresh, creates a brand-new package (not the bundled straw subject), adds a Frame, adds a few Components, saves, exports.

| Step | Status |
| --- | --- |
| Author launches workbench | ✅ [02](02_architecture.md) §5 |
| Workbench shows Package Browser with `geosee_editor_sidebar` | ✅ [10](10_build_phases.md) Phase 3 |
| Author clicks "New Package" → enters id, name, target host app | ⚠️ 🔥 **GAP: no "New Package" flow specified.** Doc 07 §14 covers Load and Save but not Create. Doc 02 §3.2 wireframe TopBar has Save / Validate / Export but no New. |
| New package appears in browser; auto-selected; empty Canvas | ⚠️ 🔥 **GAP** — empty-package state ([15](15_ui_states_and_feedback.md) §2 row "Loaded — empty package") exists but the *creation* path doesn't. |
| Author clicks "New Frame" in TopBar → empty Frame placed on Canvas | ⚠️ 🪤 [03](03_canvas_engine.md) §17 covers Add Frame but "non-overlapping Canvas position" algorithm not specified. |
| Author uses Container Tool to draw a Container | ✅ [04](04_toolkit.md) §3.4 |
| Author drags `component-pill-button` from Library Panel into Container | ✅ [05](05_libraries.md) §6.1 |
| Author edits button label via Properties Inspector | ✅ [15](15_ui_states_and_feedback.md) §10 acceptance 19 — commit on blur / Enter |
| Author clicks Save | ✅ [07](07_package_format.md) §14.2 |
| Manifest written; change log appended | ✅ |
| Author clicks Export | ✅ [07](07_package_format.md) §14.3 |
| spec.md + ai_agent_brief.md generated | ✅ |

**UC-1 verdict:** unblocked except for the "New Package" creation flow. **Must close.**

### UC-2: Open straw subject, edit a label, save

**Goal:** simplest editing roundtrip.

| Step | Status |
| --- | --- |
| Author clicks `geosee_editor_sidebar` in Package Browser | ✅ |
| Package loads; 16 Frames rendered | ✅ |
| Author zooms to `frame-page-manager` | ✅ [03](03_canvas_engine.md) §3 |
| Author Select-Tool clicks "Global Settings" label | ✅ [04](04_toolkit.md) §3.1 |
| Properties Inspector renders props | ✅ [13](13_element_intent_annotations.md) §3.1 |
| Author changes label text | ✅ |
| Esc reverts? Doc 15 §10 acceptance 19/20 covers `inline-editable-text` Component reversion; what about Properties Inspector field edits? | ⚠️ 🪤 **GAP: Esc-revert semantics in Properties Inspector not specified.** Inline-edit components have it; Inspector fields do not. |
| Click Save | ✅ |
| Change Log appends `component_property_changed` | ✅ [09](09_glossary.md) §5.6 |

**UC-2 verdict:** functional. Minor gap on Inspector field-edit reversion.

### UC-3: Apply and edit a Style

**Goal:** Materials roundtrip (doc 20).

| Step | Status |
| --- | --- |
| Author multi-selects 3 layer cards | ✅ [03](03_canvas_engine.md) §12 |
| Author clicks Style Library tab in Library Panel | ✅ [20](20_materials_and_shapes.md) §2.4 |
| Author drags `style-card-vibrancy` onto first card | ✅ [20](20_materials_and_shapes.md) §2.2 |
| Style applies; `styleRef` set on first card | ✅ |
| Author wants to apply same Style to all 3 selected — drag-onto-one only updates one. Multi-select Style application path? | ⚠️ ⚠️ **GAP: multi-select Style application not specified.** Implied via Inspector Style dropdown ([20](20_materials_and_shapes.md) §2.3) but not as a drag affordance. |
| Author opens Style edit form | ✅ |
| Author changes Style's fill colour | ✅ |
| All references update live | ✅ [20](20_materials_and_shapes.md) §2.5 |
| Renderer caches Style resolution? Recomputes every render? | ⚠️ 🪤 **GAP: Style resolution caching strategy not specified.** Per-render lookup is fine at v1 scale but should be explicit. |

**UC-3 verdict:** mostly functional. Two minor gaps.

### UC-4: Group, ungroup, drill into a group

**Goal:** Grouping roundtrip (doc 20 §3).

| Step | Status |
| --- | --- |
| Author selects 3 sibling Components | ✅ |
| Author presses Ctrl+G | ✅ [20](20_materials_and_shapes.md) §3.3 |
| Group wraps them; child rects translated to group-local | ✅ [20](20_materials_and_shapes.md) §3.2 |
| Layers Panel shows the group with collapse caret | ✅ [02](02_architecture.md) §2 folder layout `LayersPanel` |
| Author clicks a child of the group on Canvas → cascade selects the group | ✅ [20](20_materials_and_shapes.md) §3.4 |
| Author double-clicks the group → enters edit-inside mode | ✅ |
| Edit-inside outline drawn around group | ✅ |
| Author clicks the child → child selected (no cascade) | ✅ |
| Author presses Esc → exits edit-inside | ✅ |
| Author presses Ctrl+Shift+G → group dissolved; children lifted; Selection becomes the lifted children | ✅ |
| Selection set is consistent after lift | ⚠️ 🪤 **GAP: which children get re-selected?** All of them per [20](20_materials_and_shapes.md) §3.2 step 4, but specifying "all lifted children" vs "just the former group's first child" matters. Confirmed by re-reading — "former children" is implied to mean all. OK. |

**UC-4 verdict:** functional.

### UC-5: Draw shapes with effects

**Goal:** Shape + Effects roundtrip (doc 20 §4, §5).

| Step | Status |
| --- | --- |
| Author presses `o` to activate Ellipse Tool | ✅ |
| Drags out a circle with Shift held | ✅ |
| Author opens Properties Inspector → Effects section | ✅ [20](20_materials_and_shapes.md) §5.1 |
| Author adds a Shadow with offsetY 4, blur 12, colour black 0.3 | ✅ |
| Renderer applies via CSS `box-shadow` | ✅ [20](20_materials_and_shapes.md) §5.2 |
| Author switches to Line Tool (`l`), draws line at 30° with Shift snap → 30°? 45°? | ⚠️ 🪤 **GAP: Shift behaviour on Line Tool is "snap angle to nearest 15° increment" per [20](20_materials_and_shapes.md) §4.3.** So 30° works; 22° snaps to 15°. Confirmed; no gap. |
| Author groups the ellipse + line | ✅ [20](20_materials_and_shapes.md) §3 |
| Author re-resizes the group → children scale per Constraints | ⚠️ ⚠️ **GAP: group resize behaviour underspecified.** Children's individual Constraints apply, OR does the group apply uniform scale? Need explicit rule. Recommendation: children's Constraints apply (so a "left-pinned" child stays left even within the group). |

**UC-5 verdict:** mostly functional. One real gap on group resize semantics.

### UC-6: Validation, acknowledge, advance to Approved

**Goal:** State machine roundtrip (doc 16).

| Step | Status |
| --- | --- |
| Author clicks Validate in TopBar | ✅ |
| `runValidation` runs against current package | ✅ [08](08_validation_rules.md) §6 |
| Findings rendered in Validation Panel grouped by Container | ✅ |
| One Error finding: an element outside Safe Area | ✅ [08](08_validation_rules.md) §4.4 |
| Author selects that element; Inspector highlights | ✅ |
| Author moves element back inside Safe Area | ✅ |
| Re-validation triggered? Doc 01 §2.6 says incremental on edit. | ⚠️ ⚠️ **GAP: incremental validation precise scope unclear.** "Per touched element" — does it re-run all rules scoped to that element, or only the rules that previously fired against it? Need explicit definition. |
| Error finding clears | ✅ |
| Author clicks Validate again to do full run | ✅ |
| All Errors cleared; package promotes to Validated | ✅ [16](16_change_state_machine.md) §4 |
| Author clicks Approve | ✅ |
| Modal asks to type "approve" | ✅ [16](16_change_state_machine.md) §7 |
| Author types "approve"; state becomes Approved | ✅ |
| Author makes any subsequent edit → state demotes to Draft | ✅ [16](16_change_state_machine.md) §4 |

**UC-6 verdict:** mostly functional. One real gap on incremental-validation scope.

### UC-7: Export and downstream agent handoff

**Goal:** export the package; verify spec.md + ai_agent_brief.md contain what a downstream agent needs.

| Step | Status |
| --- | --- |
| Package is at Approved state | ✅ |
| Author clicks Export | ✅ |
| Save runs; validation refreshes; docs regenerate | ✅ [07](07_package_format.md) §14.3 |
| `docs/spec.md` lists every Frame, every archetype, every Token, every Style, every Effect, every annotated intent | ✅ [07](07_package_format.md) §12.1 + [13](13_element_intent_annotations.md) §4.1 |
| `docs/ai_agent_brief.md` opens with "Approved export — ..." per state | ✅ [16](16_change_state_machine.md) §10 |
| Per-element entries lead with intent annotations | ✅ [13](13_element_intent_annotations.md) §4.2 |
| `authorNotes` excluded from brief | ✅ [13](13_element_intent_annotations.md) §4.2 |
| Validation findings carried as acceptance criteria | ✅ |
| No-touch list rendered | ✅ [07](07_package_format.md) §12.2 |
| Author sends package folder to a downstream agent | ✅ implicitly — folder is portable per [07](07_package_format.md) §1 |
| Downstream agent reads brief and implements in target host app | ⚠️ 🪤 **GAP: no explicit cross-link from brief to the v0.1 Boundary Charter's "Restricted Surface" list.** The brief mentions no-touch per package, but doesn't enumerate the system-wide restrictions a downstream agent should honour by default. Recommend including the GeoSee no-touch list as a default appendix when `targetHostApp.name === "geosee"`. |

**UC-7 verdict:** functional. One minor gap on brief content.

### UC-8: Reload after crash

**Goal:** workbench recovery semantics.

| Step | Status |
| --- | --- |
| Author is editing; workbench crashes (or browser closes) | ✅ |
| Author relaunches workbench | ✅ |
| Last-package id read from localStorage | ✅ [15](15_ui_states_and_feedback.md) §8 |
| Last-package auto-loads | ✅ |
| Active Frame restored | ✅ [15](15_ui_states_and_feedback.md) §8 |
| Unsaved edits lost (no autosave in v1) | ✅ — v1 is save-or-discard per [02](02_architecture.md) §8 |
| Author wants to discard since-last-save changes (Revert action) | ⚠️ ⚠️ **GAP: no Revert action.** Author can only switch packages (which triggers the unsaved-changes prompt) or accept the dirty state and continue. Recommend adding "Revert to last save" affordance. |

**UC-8 verdict:** crash recovery works. Revert gap is a real UX hole.

## 5. Gap catalogue (categorised)

Eighteen gaps identified across six categories. Each carries a fix and a doc to patch.

### 5.1 Logic gaps

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| L1 | New Package creation flow undocumented. | Add "Create new package" action to TopBar. Modal asks: id (kebab-case), name, target host app, profile defaults. Reducer dispatches `PACKAGE_CREATE`; core writes the minimal manifest + empty schema files; package appears in browser; auto-selected. | [07](07_package_format.md) new §14.4; [15](15_ui_states_and_feedback.md) §2 new row; [22](22_mvp_coherence_audit.md) §7.2 |
| L2 | Properties Inspector field-edit Esc-revert semantics not specified. | Esc in an Inspector field reverts the field to its pre-edit value (the value when the field gained focus). Same as inline-editable-text. Enter or blur commits. | [11](10_build_phases.md) §3 Phase 11; [15](15_ui_states_and_feedback.md) §10 new acceptance |
| L3 | Save with unresolved Blockers policy not explicit. | Save **always succeeds** at the file level (writes regardless of findings). The state machine is what gates Draft → Validated. The author can save a Blocker-laden Draft to disk; they cannot advance state. | [07](07_package_format.md) §14.2 add explicit note; [16](16_change_state_machine.md) §6 cross-link |
| L4 | Group resize behaviour underspecified. | When a `container-group` is resized, its children's individual `constraints` apply (so a `left-pinned` child stays left within the group; a `stretch` child grows). The group itself is just a parent — Constraints work the same. | [20](20_materials_and_shapes.md) §3.1 add note |
| L5 | Incremental validation precise scope unclear. | "Incremental" = re-run **only the rules applicable to the affected element** (per archetype + cross-cutting layout rules that reference the element). Cross-element rules (overlap, contrast against background) re-run for the affected element and its current-Frame siblings within 1 ring of the affected element. Full-package re-run still happens on Save and on Validate button. | [08](08_validation_rules.md) §6 add subsection |
| L6 | Multi-select edit broadcast semantics. | Setting a value in the Inspector while multiple elements are selected broadcasts that value to ALL selected elements via one `applyEdit` call per element (or a `MULTI_EDIT` action carrying a list). Change Log records one Change Record per element, batched by timestamp. | [11](10_build_phases.md) §3 Phase 11 acceptance; [15](15_ui_states_and_feedback.md) §10 acceptance |
| L7 | Frame deletion cascade for Guides + Selection. | Deleting a Frame removes: every Container/Component with `frameId === deleted`, every Guide with `frameId === deleted`, and clears Selection if any selected element was on the Frame. | [03](03_canvas_engine.md) §17 expand bullet |
| L8 | Active Frame switching when clicking elements on a non-active Frame. | Clicking a Canvas element on a non-active Frame **switches the active Frame** to that Frame and selects the element. This is the "click anywhere to engage" rule. | [03](03_canvas_engine.md) new §17.1 |

### 5.2 Data flow gaps

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| D1 | `runValidation` needs `backgroundAssetId` to compute contrast against the active background. | Extend signature: `runValidation(pkg, frameId, profile, activeBackgroundId?)`. Shell passes its `state.activeBackgroundId`. Background asset content loaded via the Asset Cache (see D2). | [08](08_validation_rules.md) §6 update signature |
| D2 | Asset loading and cache layer not in folder layout. | Add `src/shell/assets/AssetCache.ts` exporting `loadBackground(id, pkgPath) → Promise<ImageBitmap>` with in-memory cache keyed by id. Validation contrast helper takes an `ImageBitmap` parameter (computed inside the shell, passed into core). | [02](02_architecture.md) §2 folder layout |
| D3 | `tokenRef` / `styleRef` resolution helpers not named. | Add `src/core/util/resolve.ts` with: `resolveColour(value, pkg)`, `resolveSpacing(value, pkg)`, `resolveStyle(styleRef, pkg)`. All pure. Renderer + validation engine consume them. | [02](02_architecture.md) §2 folder layout |
| D4 | Style resolution caching not specified. | v1 resolves per-render (no cache). Acceptable at v1 scale. Note explicitly to set expectations. | [20](20_materials_and_shapes.md) §2.5 add note |
| D5 | Cross-Frame snap exclusion. | Snap targets are **scoped to the active Frame only**. Anchors / smart guides do not pull from non-active Frames. | [03](03_canvas_engine.md) §6.1 add explicit note |
| D6 | External file modifications not detected. | v1 does not watch the filesystem. Author must reload (close+reopen package) to pick up out-of-band changes. Document explicitly. | [15](15_ui_states_and_feedback.md) §2 new row; [17](17_security_model.md) cross-ref |

### 5.3 Architecture gaps

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| A1 | Render dispatcher (schema Component → React element) not named. | Add `src/shell/canvas/elements/RenderDispatcher.tsx` exporting `<RenderElement element={...} />` that switches on `archetype` and renders the corresponding `<{Archetype}/>` component. Per-archetype files at `src/shell/canvas/elements/<archetype>.tsx`. | [02](02_architecture.md) §2 folder layout; [14](14_component_archetype_reference.md) §7 cross-ref |
| A2 | Selection cascade logic location not named. | Add `src/shell/canvas/selection/selectionLogic.ts` with `topmostGroupAncestor(elementId, pkg)` and `applyClickCascade(selectionState, clickedId, modifiers, pkg)`. | [02](02_architecture.md) §2 folder layout; [20](20_materials_and_shapes.md) §3.4 cross-ref |
| A3 | Reducer scale — 30+ action types in one file. | Acceptable for v1 (single source of truth, easy to grep). v2 may split. Note as a v2 refactor candidate. | [12](12_deferred_to_v2.md) new row |
| A4 | Keyboard event routing not explicit. | Add `src/shell/keyboard/KeyboardManager.tsx` mounted at `ShellRoot`. Owns global shortcut map (Tool shortcuts, Ctrl+G, Esc, etc.) and consults focus context (input focused → ignore typing shortcuts; modal open → ignore everything else). | [02](02_architecture.md) §2 folder layout; [04](04_toolkit.md) §2 cross-ref |
| A5 | Inline-edit lifecycle ownership. | Each inline-edit-capable Component owns its own edit lifecycle internally. Esc emits an `INLINE_EDIT_CANCEL` event; blur / Enter emits `INLINE_EDIT_COMMIT`. Shell reducer consumes the commit event and runs `applyEdit`. | [14](14_component_archetype_reference.md) §3.4 expand |

### 5.4 Tool gaps

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| T1 | Eyedropper one-mode-only — samples NEW Swatch only, can't apply an EXISTING Swatch by clicking its preview. | v2 expansion. Document deferred behaviour. | [12](12_deferred_to_v2.md) new row |
| T2 | No dedicated Hand Tool for explicit pan. | Space+drag covers it. Document the convention; defer dedicated Tool. | [04](04_toolkit.md) §3 add note |
| T3 | No Zoom Tool. | Mouse wheel + shortcuts cover it. Document the convention; defer dedicated Tool. | [04](04_toolkit.md) §3 add note |
| T4 | Comment / annotation tool absent. | v2 (requires multi-user / review surface). | Already deferred [12](12_deferred_to_v2.md) §9 |

### 5.5 Runtime UI gaps

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| U1 | Shell layout authoritative spec is rough (only ASCII wireframe). | Deep spec in §7 below. TopBar full button set, status indicators, menus, state pill, profile picker, package title display, save status. | [22](22_mvp_coherence_audit.md) §7 new |
| U2 | No in-app keyboard reference / Help menu. | Add Help menu in TopBar with: "Keyboard reference" (modal listing all shortcuts), "About" (workbench version, link to docs_v1/00_README.md). | [22](22_mvp_coherence_audit.md) §7.6 |
| U3 | No Revert affordance (since-last-save discard). | Add "Revert to last save" in File menu. Confirms before discarding. Disabled when not dirty. | [15](15_ui_states_and_feedback.md) §2 new row + §3 new modal pattern |
| U4 | First-launch behaviour — does the workbench auto-load the bundled sample? | First launch: Package Browser open; no auto-load; cursor parked on the "Open packages directory" link or on the sole bundled package entry. Subsequent launches: auto-load last package per localStorage. | [15](15_ui_states_and_feedback.md) §2 row "Boot" expand |
| U5 | No visible state pill in TopBar for Draft / Validated / Approved. | Add a pill chip in TopBar showing current `packageState` with the canonical colours from [16](16_change_state_machine.md) §2. | [22](22_mvp_coherence_audit.md) §7.4 |

### 5.6 Systems gaps

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| S1 | Synchronous validation may stall the main thread on large packages. | Acceptable at v1 scale (~1500 elements). Validation budget is ~20 ms per full pack. Document the limit. | [08](08_validation_rules.md) §9 already covers — cross-ref here |
| S2 | No worker / off-main-thread execution. | Same as S1. v1 fine. | Same |
| S3 | No autosave. | v1 is save-or-discard. Note explicitly. Revert (U3) is the recovery path. | [15](15_ui_states_and_feedback.md) §2 |

### 5.7 Docs gaps (forward references)

| # | Gap | Fix | Doc to patch |
| --- | --- | --- | --- |
| X1 | Doc 21 (interactive overlays + primitives) not yet written. Per-side padding, tabs, modals, tooltips, dropdown menus, carousels, toggle, segmented, loading state. | Write doc 21 before Codex handoff. Until then, the v1 scope is the 17 Components + 11 Containers in [14](14_component_archetype_reference.md), not the extended set. | [00](00_README.md) §5 + [12](12_deferred_to_v2.md) row if descoped |
| X2 | Doc 21 affects [10](10_build_phases.md) Phase 5/6/9/11 scope; phase budgets need adjustment when 21 lands. | When 21 is written, patch [10](10_build_phases.md) per [20](20_materials_and_shapes.md) §8 pattern. | [10](10_build_phases.md) |

## 6. Gap closure summary

Eighteen gaps. Distribution by severity:

- 🔥 Must-fix before Codex handoff: 2 (L1 new package, X1 doc 21).
- ⚠️ Should-fix before handoff: 10 (L2-L8, D1-D6, A1-A5, U1, U3, U5).
- 🪤 Subtle / future-friendly: 4 (D4, U2, T1-T4, S1-S3).

The closure pattern: §5 already names which doc absorbs each fix. Doc 22 patches don't need to land in every doc tonight — §7 below carries the runtime UI deepening (U1, U5), §8 carries the test plan, and the §5 table is itself the punch list for cross-doc patches.

## 7. Runtime UI deepening

Authoritative spec for the Standalone Shell's layout, chrome, menus, and indicators.

### 7.1 Shell overall layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ TopBar (44px tall)                                                           │
│ [Logo] [File ▾] [Edit ▾] [View ▾] [Help ▾]  <pkg-title>  [<state-pill>]     │
│                                              [Profile ▾] [Validate] [Save]   │
│                                                          [Export]            │
├─────┬──────────────────────────────────────────────────┬─────────────────────┤
│     │                                                  │  Library Panel      │
│ Pkg │                  Canvas                          │  ├─ Components      │
│ Br  │  (rulers along top + left)                       │  ├─ Colours         │
│ ow  │                                                  │  ├─ Icons           │
│ se  │  [active Frame outlined; other Frames dimmed]    │  ├─ Tokens          │
│ r   │                                                  │  └─ Styles          │
│ 240 │                                                  │  240px              │
│ px  │                                                  ├─────────────────────┤
│     │                                                  │  Properties Insp.   │
│     │                                                  │  - Intent           │
│     │                                                  │  - Style            │
│     │                                                  │  - Props            │
│     │                                                  │  - Effects          │
├─────┴──────────────────────────────────────────────────┴─────────────────────┤
│ BackgroundStressBar (32px) [Dark][Light][Noise][Terrain] [Cycle]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Toolkit (44px)                                                               │
│ [Select v][Move m][Resize s][Rect r][Ellipse o][Line l][Container c]         │
│ [Text t][Divider d][Eyedrop i][Colour k][Align a][Distribute ⇧a]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Validation Panel (collapsible; 200px when open)                              │
│ Filter: [All ▾] [Severity ≥ Suggestion ▾]                                    │
│ ◯ Info: 2  ⓘ Sugg: 5  △ Warn: 1  ✕ Error: 0  ⛔ Blocker: 0                  │
│ [grouped finding list]                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Vertical regions, top to bottom: TopBar / [PackageBrowser + Canvas + (Library + Inspector stacked)] / BackgroundStressBar / Toolkit / ValidationPanel.

### 7.2 TopBar — full button + menu set

| Region | Contents |
| --- | --- |
| Far left | Workbench logo (text "GUI Workbench") — clicking opens About modal. |
| Menus | File / Edit / View / Help dropdowns (§7.6 below). |
| Centre | Current package title + Frame indicator (`<package-name>` / `<active-frame-name>`). Title click renames; Frame indicator click opens Package Browser to a Frame picker. |
| Right cluster | `<state-pill>` (§7.5) ⊳ `<profile-picker>` (§7.3) ⊳ Validate button ⊳ Save button (shows dirty dot when dirty; spinner while saving) ⊳ Export button (opens confirm dialog explaining the export). |

### 7.3 Profile picker

Dropdown showing the active Device / Input / Use-Case profile combo. Clicking opens a 3-column picker:

| Device | Input | Use case |
| --- | --- | --- |
| Desktop 1080p ✓ | Mouse + keyboard ✓ | Technical editing ✓ |
| Tablet portrait (deferred) | Touch (deferred) | Client presentation (deferred) |

v1 ships one combo selectable; others are listed greyed-out as v2 placeholders. Changing a profile triggers the banner from [15](15_ui_states_and_feedback.md) §2 "Profile change."

### 7.4 State pill

A coloured chip showing `packageState`:

- Draft: yellow (`rgba(240, 200, 100, 0.9)`)
- Validated: green (`rgba(120, 200, 140, 0.9)`)
- Approved: blue (`rgba(120, 180, 220, 0.9)`)

Tooltip on hover: full state name + "Last validated <ts>" (or "Never validated").

Click: opens the Change Log in a side panel showing the most recent 50 records.

### 7.5 Save / Validate / Export buttons

| Button | Idle state | In-flight state | Post-action state |
| --- | --- | --- | --- |
| Save | "Save" + dirty dot if dirty | spinner + "Saving..." | "Saved" for 1 s |
| Validate | "Validate" | spinner + "Validating..." | "Validated" or finding count for 2 s |
| Export | "Export" | spinner + "Exporting..." | "Exported" for 1 s, then Toast with path |

Buttons disable themselves during in-flight states. Validate is always enabled if a package is loaded.

### 7.6 Menus

**File menu:**
- New Package... (Ctrl+N) — opens the New Package modal (L1 fix).
- Open Package... (Ctrl+O) — focuses Package Browser.
- Save (Ctrl+S).
- Export (Ctrl+E).
- Revert to last save — disabled when not dirty; otherwise opens confirm modal (U3 fix).
- (separator)
- Quit — closes browser tab.

**Edit menu:**
- Undo (Ctrl+Z) — disabled in v1 (Undo deferred). Tooltip explains.
- Redo (Ctrl+Shift+Z) — disabled.
- (separator)
- Select All (Ctrl+A) — runs Selection-All.
- Deselect (Esc).
- (separator)
- Group (Ctrl+G).
- Ungroup (Ctrl+Shift+G).

**View menu:**
- Zoom In (Ctrl++)
- Zoom Out (Ctrl+-)
- Zoom to 100% (Ctrl+0)
- Fit Active Frame (Ctrl+1)
- (separator)
- Pixel Grid Size ▸ 1 ✓ / 2 / 4 / 8
- Show Rulers ✓
- Show Smart Guides ✓
- Show Safe Area ✓

**Help menu:**
- Keyboard reference (Ctrl+/) — opens modal listing every shortcut (rendered from a static table in `src/shell/help/shortcuts.ts`).
- About — opens modal showing Workbench Version + a link to `docs_v1/00_README.md`.
- Open docs folder — opens `UI_EDITOR/docs_v1/` in the OS file manager (best-effort via `window.open` / dev tooling; OK to no-op gracefully in v1).

### 7.7 Indicators and ambient feedback

- **Dirty indicator:** dot next to package title in TopBar AND on Save button.
- **Save status:** Save button label transitions per §7.5.
- **Active Tool indicator:** Toolkit highlights active Tool's button.
- **Active Frame indicator:** the active Frame's outline is full-saturation; other Frames are dimmed (0.4 opacity overlay).
- **Selection indicator:** standard Figma-like selection rectangle with 8 handles when Resize Tool active.
- **Edit-inside mode indicator:** dashed outline around the group + a "Editing inside <group-name> (Esc to exit)" pill in the top-centre of Canvas.

## 8. MVP test plan

A tester (human or agent) runs these to certify v1 ships. Designed to be runnable end-to-end by the Phase 14 smoke routine in [11](11_agent_automation_runbook.md) §6.

### 8.1 Setup

```bash
cd UI_EDITOR
rm -rf node_modules dist
npm install
npm run check                                 # exit 0
npm run test                                  # all green (core unit tests)
npm run dev &                                 # http://localhost:5174
```

### 8.2 Use-case coverage matrix

Each row is one UC from §4. Each cell is a yes / no whether v1 supports the step.

| UC | Steps in §4 | Expected pass count | Acceptance |
| --- | --- | --- | --- |
| UC-1 New package | 11 | 11 once L1 closes | A new package id appears in `packages/` |
| UC-2 Edit label | 9 | 9 | manifest `updatedAt` advances, change log has entry |
| UC-3 Apply + edit Style | 9 | 9 once D4 closes | Style edit propagates to all references |
| UC-4 Group / ungroup / drill | 9 | 9 | Layers Panel reflects group; Esc exits drill |
| UC-5 Shapes + effects | 7 | 7 once L4 closes | Effects render via CSS; group resize respects children's Constraints |
| UC-6 Validate + approve | 10 | 10 once L5 closes | State pill cycles Draft → Validated → Approved → Draft after edit |
| UC-7 Export | 10 | 10 once U7 closes | spec.md and ai_agent_brief.md present, non-empty, lead with intent |
| UC-8 Reload after crash | 7 | 7 once U3 closes | Last package auto-loads; Revert offered when dirty |

### 8.3 Targeted smoke (gap-closing checks)

| Check | How to verify |
| --- | --- |
| New Package modal opens | File → New Package → modal appears with id / name / target / profile fields |
| Per-side padding works | Open `frame-page-manager`; select a Container; set `padding.left: 24` only; right/top/bottom unchanged |
| Esc reverts Inspector field | Focus a numeric Input field; type new value; Esc; field shows previous value |
| Save with Blocker present | Force a Blocker (e.g. negative rect); click Save; file written; state stays Draft |
| Multi-select broadcast | Select 3 elements; in Inspector set `padding.x = 16`; all 3 update; Change Log shows 3 batched records |
| Active Frame switch | Click an element on a non-active Frame; Frame becomes active; element selected |
| Cross-Frame snap exclusion | Place an element near a non-active Frame's edge; no snap; no smart guide |
| Revert to last save | Make edit; File → Revert; confirm; package reloads from disk |
| First-launch | Clear localStorage `workbench.lastPackageId`; reload; Package Browser open; no auto-load |
| State pill | Loaded package shows pill matching its `packageState` |
| Keyboard reference modal | Help → Keyboard reference; modal lists every shortcut |
| Profile picker | TopBar profile chip → picker; only `desktop-1080p` selectable |
| BackgroundStressBar position | Bottom of Canvas, above Toolkit, 32 px tall |
| Help → About | Modal shows "Workbench Version 1.0.0" |

### 8.4 Round-trip integrity

```bash
# From workbench, export the bundled package
# Then re-import
diff -r packages/geosee_editor_sidebar/exported-snapshot/ packages/geosee_editor_sidebar/
# Expected: identical after canonicalisation (no differences in JSON files;
# binary asset hashes match)
```

### 8.5 No-leak verification

```bash
# Confirm v1 stays inside UI_EDITOR/
grep -r "from \"\\.\\./\\.\\./src\\|from \"\\.\\./\\.\\./projects" UI_EDITOR/src/   # empty
grep -r "fetch\\|XMLHttpRequest\\|WebSocket" UI_EDITOR/src/ | grep -v "vite/client" # empty (only HMR)
```

### 8.6 Definition-of-Done (recap from [01](01_scope.md) §4)

All 16 DOD items must hold. The §8.3 + §8.4 + §8.5 checks above re-verify them.

## 9. System invariants recap

The non-negotiable rules of v1, all derived from the pack and now consolidated:

1. **One reducer.** Single root reducer in `ShellRoot`. (A3 deferral noted.)
2. **Pure core.** `src/core/` is side-effect free except for `packageIO/` (the filesystem boundary).
3. **DEC-023 of v0.1 stays in force at the v0.1 layer.** v1 introduces its own state model.
4. **All edits flow through `applyEdit`.** No direct state mutation outside `applyEdit`'s return value.
5. **Restricted Surface rules run at edit time** inside `applyEdit`; never in `runValidation` (per [08](08_validation_rules.md) §8).
6. **Severity ladder is strict** per [09](09_glossary.md) §2.
7. **State transitions are explicit.** Only [16](16_change_state_machine.md) §4 triggers cause transitions.
8. **Schema-mutating edits demote to Draft.** Ephemeral edits don't.
9. **Round-trip stability** is mandatory. Export → re-import must be byte-identical after canonicalisation.
10. **Package format = folder + JSON** per [07](07_package_format.md).
11. **Standalone only** in v1. Host-App Adapter interface defined; stub implementation only.
12. **No external network calls** at runtime (only Vite HMR + the local Vite plugin endpoints).
13. **No imports from outside `UI_EDITOR/`** into `UI_EDITOR/src/`.
14. **Intent annotations propagate** into spec.md and ai_agent_brief.md per [13](13_element_intent_annotations.md) §4.
15. **Frame is the workspace unit.** Active Frame defines the snap / anchor scope.
16. **Group cascade is default click behaviour.** Shift bypasses; double-click drills in.
17. **One Tool active at a time.** Tool changes never modify Selection.
18. **Validation runs on Save, on Validate button, and incrementally per touched element.** Full re-run on Save and on demand only.

## 10. Acceptance criteria for the audit

The audit is "done" when:

| # | Check | How to verify |
| --- | --- | --- |
| 1 | All 18 gaps in §5 have a fix + doc-to-patch column populated | Read §5; no empty cells |
| 2 | Doc 21 status is unambiguous | §3 names doc 21 as pending; §5 X1 carries the fix |
| 3 | Runtime UI is concretely spec'd (TopBar, menus, state pill, profile picker) | §7 readable end-to-end |
| 4 | MVP test plan executable by a tester / agent | §8 has setup + UC matrix + targeted smoke + round-trip + no-leak |
| 5 | System invariants count = 18 | §9 list |
| 6 | Cross-doc patches identified in §5 are applied | After patches commit, all "Doc to patch" entries have been honoured |

When item 6 holds, v1 is shippable to Codex.

## 11. Recommended sequence to handoff

1. **Now:** commit this doc.
2. **Next:** write doc 21 per the prior Tier 1 + Tier 2 decision (closes X1 / X2).
3. **Then:** apply the §5 cross-doc patches (closes L1–L8, D1–D6, A1–A5, U1–U5, S1–S3, T1–T4 as the table prescribes).
4. **Finally:** update the Codex cold-start prompt SHA to the post-patch commit and hand off.

Estimated remaining work: ~10 hours of doc-writing (doc 21 + patches). After that, the v1 pack is internally consistent and Codex can run unattended.
