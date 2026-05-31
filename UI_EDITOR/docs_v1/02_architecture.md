# v1 Architecture

## 1. Tech stack (locked)

| Concern | Choice | Rationale |
| --- | --- | --- |
| Language | TypeScript 5.x, `strict: true` | Match GeoSee tsconfig discipline. |
| UI | React 18 (function components + hooks) | Match GeoSee. Future v2 embedded mode lifts code in-place. |
| Build | Vite 5.x | Match GeoSee. Fast HMR for canvas iteration. |
| State | React useReducer + Context | Mirrors GeoSee's `EditorContext` pattern. No external state lib. |
| Persistence | Local filesystem via dev-only Vite plugin `vite-plugin-package-write` | Mirrors GeoSee's `vite-plugin-author-write` pattern; same security envelope. |
| Validation | Pure-TS rule engine in `src/core/validation/` | No external lint/validation lib. |
| Canvas rendering | DOM + CSS transforms for v1 (no Canvas2D / WebGL) | Cheapest path to Figma-lite at acceptable scale (~hundreds of elements per Frame). |
| Drag / pointer | Native pointer events; no React DnD lib | Keep dependencies minimal. |
| Tests | Vitest for `core/` only; no shell tests in v1 | Validation engine + edit reducer get unit coverage; UI stays manual. |
| Lint | Inherit GeoSee root if convenient, else minimal Prettier defaults | Avoid yak-shave. |

Versions pinned in `UI_EDITOR/package.json`. Lock file `UI_EDITOR/package-lock.json` committed.

## 2. Folder layout (canonical)

Every path below is mandatory. Agents must not invent alternative locations.

```text
UI_EDITOR/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── README.md                              # one-line pointer to docs_v1/00_README.md
├── plugins/
│   └── vite-plugin-package-write.ts       # dev-only write endpoint
├── src/
│   ├── main.tsx                           # React mount
│   ├── shell/                             # Standalone Shell (the UI)
│   │   ├── ShellRoot.tsx
│   │   ├── state/
│   │   │   ├── shellReducer.ts            # the single root reducer
│   │   │   ├── shellState.ts              # the ShellState type
│   │   │   ├── shellActions.ts            # the ShellAction union
│   │   │   └── ShellContext.tsx           # context + hook (useShell)
│   │   ├── canvas/                        # the Canvas surface
│   │   │   ├── CanvasRoot.tsx
│   │   │   ├── CanvasViewport.tsx         # pan + zoom container
│   │   │   ├── FrameLayer.tsx             # renders one Frame
│   │   │   ├── ElementLayer.tsx           # renders Containers/Components inside a Frame
│   │   │   ├── SelectionLayer.tsx         # selection rectangles + transform handles
│   │   │   ├── GuidesLayer.tsx            # user Guides + Smart Guides
│   │   │   ├── SnapIndicatorLayer.tsx     # the snap-active visual feedback
│   │   │   ├── RulerHorizontal.tsx
│   │   │   ├── RulerVertical.tsx
│   │   │   ├── SafeAreaOverlay.tsx
│   │   │   ├── BackgroundStressOverlay.tsx
│   │   │   └── canvasMath.ts              # screen↔canvas coord helpers, snap math
│   │   ├── toolkit/                       # tool palette
│   │   │   ├── ToolkitBar.tsx
│   │   │   ├── tools/
│   │   │   │   ├── selectTool.ts
│   │   │   │   ├── moveTool.ts
│   │   │   │   ├── resizeTool.ts
│   │   │   │   ├── containerTool.ts
│   │   │   │   ├── textTool.ts
│   │   │   │   ├── dividerTool.ts
│   │   │   │   ├── eyedropperTool.ts
│   │   │   │   ├── colourTool.ts
│   │   │   │   ├── alignTool.ts
│   │   │   │   └── distributeTool.ts
│   │   │   └── toolTypes.ts               # Tool interface
│   │   ├── layersPanel/
│   │   │   ├── LayersPanel.tsx
│   │   │   ├── LayerRow.tsx
│   │   │   └── layersOrdering.ts
│   │   ├── libraryPanel/
│   │   │   ├── LibraryPanel.tsx
│   │   │   ├── ComponentLibraryView.tsx
│   │   │   ├── ColourLibraryView.tsx
│   │   │   ├── IconLibraryView.tsx
│   │   │   └── TokenLibraryView.tsx
│   │   ├── propertiesInspector/
│   │   │   ├── PropertiesInspector.tsx
│   │   │   ├── PropertyEditors/           # one editor per property type
│   │   │   │   ├── NumberEditor.tsx
│   │   │   │   ├── TextEditor.tsx
│   │   │   │   ├── ColourEditor.tsx
│   │   │   │   ├── VariantEditor.tsx
│   │   │   │   ├── AnchorEditor.tsx
│   │   │   │   └── ConstraintEditor.tsx
│   │   │   └── inspectorActions.ts
│   │   ├── validationPanel/
│   │   │   ├── ValidationPanel.tsx
│   │   │   ├── FindingRow.tsx
│   │   │   └── severityIcons.tsx
│   │   ├── backgroundStress/
│   │   │   ├── BackgroundStressBar.tsx
│   │   │   └── backgroundCatalog.ts
│   │   ├── packageBrowser/
│   │   │   ├── PackageBrowser.tsx
│   │   │   └── packageList.ts
│   │   ├── topBar/
│   │   │   ├── TopBar.tsx                 # save / export / undo (deferred) / validate
│   │   │   └── menus.tsx                  # View / Edit / Help menus
│   │   └── styles/
│   │       └── theme.ts                   # workbench's own visual tokens
│   ├── core/                              # Workbench Core (portable, host-agnostic)
│   │   ├── schema/
│   │   │   ├── package.ts                 # PackageManifest, PackageState
│   │   │   ├── component.ts               # Component, ComponentVariant, ComponentState
│   │   │   ├── container.ts               # Container, ContainerArchetype
│   │   │   ├── frame.ts                   # Frame, FrameBackground
│   │   │   ├── panel.ts                   # Panel, Section
│   │   │   ├── tokens.ts                  # DesignToken, TokenCategory
│   │   │   ├── library.ts                 # Library kinds and entries
│   │   │   ├── swatch.ts                  # Swatch
│   │   │   ├── icon.ts                    # IconLibraryEntry
│   │   │   ├── anchor.ts                  # AnchorKind, ConstraintKind
│   │   │   ├── guide.ts                   # Guide
│   │   │   ├── profiles.ts                # DeviceProfile, InputProfile, UseCaseProfile
│   │   │   ├── validation.ts              # ValidationRule, ValidationFinding, Severity
│   │   │   └── changeLog.ts               # ChangeRecord, ChangeState
│   │   ├── editing/
│   │   │   ├── safeEdits.ts               # canonical list of v1 edit operations
│   │   │   ├── applyEdit.ts               # pure: (package, edit) => nextPackage
│   │   │   ├── editTypes.ts               # the EditOperation union
│   │   │   └── changeRecord.ts            # build ChangeRecord from edit + diff
│   │   ├── geometry/
│   │   │   ├── rect.ts                    # Rect, intersect, union, contains
│   │   │   ├── snap.ts                    # snap math (pixel grid, anchors, guides)
│   │   │   ├── anchorsForFrame.ts         # compute anchors at runtime
│   │   │   ├── smartGuides.ts             # detect smart-guide alignments
│   │   │   ├── transform.ts               # move / resize transforms, constraint application
│   │   │   └── distribute.ts              # align + distribute math
│   │   ├── packageIO/
│   │   │   ├── readPackage.ts
│   │   │   ├── writePackage.ts
│   │   │   ├── packageWriteClient.ts      # the HTTP client to the dev plugin
│   │   │   └── pathPolicy.ts              # filesystem path validation
│   │   ├── validation/
│   │   │   ├── runValidation.ts           # entry: (package, frameId, profile) => findings
│   │   │   ├── findingLocation.ts         # stable refs to elements
│   │   │   ├── contrast.ts                # WCAG contrast math
│   │   │   ├── ruleEngine.ts              # walk rules; collect findings
│   │   │   └── rulePacks/
│   │   │       └── desktopTechnicalEditing.ts
│   │   ├── libraries/
│   │   │   ├── instantiateComponent.ts    # library entry → live Component on Frame
│   │   │   ├── applySwatch.ts             # Swatch → element fill
│   │   │   ├── applyToken.ts              # Token → element property
│   │   │   └── libraryMerge.ts            # how multiple libraries combine in a package
│   │   ├── export/
│   │   │   ├── exportSpec.ts              # produces docs/spec.md
│   │   │   ├── exportAiAgentBrief.ts      # produces docs/ai_agent_brief.md
│   │   │   ├── exportValidationReport.ts  # produces validation/report.json
│   │   │   └── exportChangeLog.ts         # serialises change log
│   │   └── util/
│   │       ├── ids.ts                     # newId, isValidId
│   │       ├── clone.ts                   # structuredClone wrapper
│   │       └── invariant.ts               # invariant(cond, msg)
│   ├── adapter/                           # Host-App Adapter contract (interface only in v1)
│   │   ├── HostAppAdapter.ts              # the interface v2 implements
│   │   └── geoSeeAdapter.stub.ts          # type-checked stub; throws at runtime
│   └── shared/                            # types used by both shell and core (rare)
│       └── ids.ts                         # branded id types
└── packages/                              # GUI Package storage
    └── geosee_editor_sidebar/             # bundled straw-subject sample
        ├── manifest.json
        ├── frames.json
        ├── containers.json
        ├── components.json
        ├── tokens.json
        ├── libraries.json
        ├── guides.json
        ├── validation/
        │   ├── rule_pack.json             # references the active rule pack id
        │   └── findings.json              # last computed findings (Draft state)
        ├── change_log.json
        ├── docs/
        │   ├── spec.md                    # generated
        │   └── ai_agent_brief.md          # generated
        └── assets/
            └── backgrounds/
                ├── plain_dark.png
                ├── plain_light.png
                ├── noise_low_contrast.png
                └── terrain_capture.png
```

### 2.1 Layering invariants

- `src/core/` may not import from `src/shell/` or `src/adapter/`.
- `src/shell/` may import from `src/core/` and `src/shared/`. May not import from `src/adapter/` (the adapter is a v2 surface).
- `src/adapter/` may import from `src/core/schema/`, `src/core/util/`, `src/shared/`. May not import from `src/shell/`.
- `src/shared/` may not import from any of the above. It is leaf-level.
- The `plugins/` directory is build-time only; never imported by runtime code in `src/`.

An agent must verify these invariants with a directed grep before declaring any phase complete. See [10_build_phases.md](10_build_phases.md) §"Per-phase acceptance".

## 3. Module contracts

### 3.1 Workbench Core (`src/core/`)

**Purpose:** the portable engine. Knows nothing about GeoSee, three.js, React layout details, or any host-specific concern.

**Public API surface (what `src/shell/` may import):**

- All types in `src/core/schema/*`.
- `applyEdit(pkg, edit)` from `src/core/editing/applyEdit.ts`.
- `runValidation(pkg, frameId, profile)` from `src/core/validation/runValidation.ts`.
- `readPackage(path)` / `writePackage(path, pkg)` from `src/core/packageIO/`.
- `exportSpec(pkg)`, `exportAiAgentBrief(pkg)` from `src/core/export/`.
- Geometry helpers: `Rect`, `snapToPixelGrid`, `snapToAnchors`, `computeSmartGuides`, `applyMove`, `applyResize`, `alignSelection`, `distributeSelection` from `src/core/geometry/`.
- Library helpers: `instantiateComponent`, `applySwatch`, `applyToken` from `src/core/libraries/`.

**Inputs:** a `Package` object, an `EditOperation`, profile selections.
**Outputs:** pure values (new Package, finding arrays, exported strings, serialised package files).

**Invariants:**
- All functions are pure (no side effects beyond `packageIO/` which mediates the filesystem).
- All types match the schema in `07_package_format.md`.
- Validation rule outputs include both `currentValue` and (where computable) `suggestedValue`.

### 3.2 Standalone Shell (`src/shell/`)

**Purpose:** the visible UI.

**Top-level layout:**

```text
┌─────────────────────────────────────────────────────────────┐
│ TopBar       [ Save ] [ Validate ] [ Export ]               │
├─────┬───────────────────────────────────────────┬───────────┤
│     │                                           │           │
│ Pkg │     Canvas                                │ Library   │
│ Br  │     ┌─Ruler horizontal──────────┐         │ Panel     │
│ ow  │     │  ┌────────────────────┐   │         │           │
│ se  │ R   │  │ Frame              │   │         │           │
│ r   │ V   │  │  containers /      │   │         │           │
│     │     │  │  components        │   │         │ Props     │
│     │     │  │  (Selection,       │   │         │ Insp.     │
│     │     │  │   transform,       │   │         │           │
│     │     │  │   smart guides)    │   │         │           │
│     │     │  └────────────────────┘   │         │           │
│     │     └──────────────────────────┘         │           │
├─────┴────────────────────────────────────────────┴───────────┤
│ Toolkit    [Select][Move][Resize][Container][Text]...        │
├─────────────────────────────────────────────────────────────┤
│ Validation Panel — findings ◯ Info  △ Warn  ✕ Error  ⛔ Blk  │
└─────────────────────────────────────────────────────────────┘
```

**State:** a single root reducer (`src/shell/state/shellReducer.ts`) plus React Context (`ShellContext`). The reducer is shaped per [§4 State model](#4-state-model).

**Invariants:**
- Shell never mutates schema objects directly. Every change flows through `core/editing/applyEdit.ts`.
- Shell never reads / writes the filesystem directly. All filesystem traffic goes via `core/packageIO/`.
- Shell never imports the adapter.

### 3.3 Host-App Adapter (`src/adapter/`)

**Designed in v1; implemented in v2.** v1 ships `HostAppAdapter.ts` as a TypeScript interface plus a `geoSeeAdapter.stub.ts` that satisfies the interface but throws on every method call at runtime.

```ts
// src/adapter/HostAppAdapter.ts
import type {
  Package,
  ChangeRecord,
  ValidationRule,
  ValidationFinding,
} from "../core/schema/package";
import type { Component } from "../core/schema/component";
import type { Container } from "../core/schema/container";

export type Permission =
  | "view"
  | "draft"
  | "save_project_override"
  | "apply_to_current_project"
  | "promote_to_app_default"
  | "edit_base_design_system"
  | "export_package"
  | "run_validation"
  | "run_ai_review";

export type PermissionSet = ReadonlySet<Permission>;

export interface EditableSurface {
  id: string;                              // host-side stable id of the surface
  workbenchPath: string;                   // path inside the package (e.g. "containers/container-page-row")
  permission: Permission[];                // permissions required to edit this surface
  safeEditFields: ReadonlyArray<string>;   // field names the host considers safe
}

export interface ComponentMapping {
  workbenchComponentId: string;            // id from the package
  hostComponentRef: string;                // host's stable identifier (e.g. a TS symbol name)
  mappingNotes?: string;
}

export interface ProjectOverride {
  projectId: string;
  packageId: string;
  patch: Record<string, unknown>;
}

export interface ApplyResult {
  ok: boolean;
  changeRecord: ChangeRecord;
  hostError?: string;
}

export interface ChangeLogSink {
  append(record: ChangeRecord): Promise<void>;
}

export interface HostAppAdapter {
  // What the host considers editable.
  listEditableSurfaces(): EditableSurface[];

  // Map generic workbench components to host-side counterparts.
  componentMappings(): ComponentMapping[];

  // Project override lifecycle.
  loadProjectOverrides(): ProjectOverride[];
  saveProjectOverride(override: ProjectOverride): Promise<void>;

  // Additional validation rules the host wants applied on top of the core rule packs.
  hostValidationRules(): ValidationRule[];

  // Persistence.
  saveDraft(pkg: Package): Promise<void>;
  applyToHost(pkg: Package, permission: Permission): Promise<ApplyResult>;

  // Permission gate.
  permissions(): PermissionSet;

  // Change log destination.
  changeLogSink(): ChangeLogSink;
}
```

**Invariants:**
- v1 does not modify this interface after first commit. v2 must satisfy it as-is.
- v1's stub adapter throws `Error("HostAppAdapter not implemented in v1 — embedded mode is v2+")` from every method.
- The stub's existence is a type-check anchor: any breaking change to the interface flags the stub at compile time.

## 4. State model

The single root reducer holds:

```ts
// src/shell/state/shellState.ts
import type { Package } from "../../core/schema/package";
import type { ValidationFinding } from "../../core/schema/validation";
import type { ToolId } from "../toolkit/toolTypes";

export interface ShellState {
  // Loaded package + filesystem path.
  pkg: Package | null;
  pkgPath: string | null;

  // Which Frame is active on the Canvas.
  activeFrameId: string | null;

  // Selection: ids of Containers / Components selected on the active Frame.
  selection: ReadonlyArray<{ kind: "container" | "component"; id: string }>;

  // Active Tool from the Toolkit.
  activeToolId: ToolId;

  // Canvas viewport state.
  viewport: {
    panX: number;
    panY: number;
    zoom: number;     // 1.0 = 100 %
  };

  // Snapping config.
  snap: {
    pixelGridSize: 1 | 2 | 4 | 8;
    thresholdPx: number;        // default 4
    snapToAnchors: boolean;     // default true
    snapToGuides: boolean;      // default true
    snapToSmartGuides: boolean; // default true
  };

  // Background Stress Test.
  activeBackgroundId: string | null;

  // Validation cache.
  findings: ReadonlyArray<ValidationFinding>;
  lastValidatedAt: number | null;

  // Active profiles (drive validation).
  profile: {
    deviceId: string;       // e.g. "desktop-1080p"
    inputId: string;        // e.g. "mouse-keyboard"
    useCaseId: string;      // e.g. "technical-editing"
  };

  // Dirty bit.
  dirty: boolean;

  // Save status indicator.
  saveStatus: "idle" | "saving" | "error";
  saveError: string | null;
}
```

All actions (in `shellActions.ts`) follow the discriminated-union pattern. Every action that mutates `pkg` produces a `ChangeRecord` and appends to the in-memory change log; on save the entire change log flushes to `change_log.json`.

## 5. Build + run

| Command | Effect |
| --- | --- |
| `npm install` | Install dependencies (React, Vite, TS, Vitest). |
| `npm run dev` | Vite dev server on `http://localhost:5174`. |
| `npm run build` | Production build into `UI_EDITOR/dist/`. v1 does not deploy this; build is a sanity check only. |
| `npm run check` | `tsc --noEmit`. Must exit 0 for any phase to count as complete. |
| `npm run test` | Vitest, scoped to `src/core/**`. v1 acceptance does not require shell tests. |

`UI_EDITOR/package.json` defines exactly these four script entries. No others in v1.

## 6. What lives outside the agent's edit surface

- Anything in `..\src\`, `..\projects\`, `..\docs\`, `..\tests\`, `..\plugins\` (GeoSee's plugins folder).
- `..\vite.config.ts`, `..\package.json`, `..\tsconfig.json` at the GeoSee root.
- The v0.1 docs in `..\UI_EDITOR\docs\` (read-only; never edited from v1 work).
- The Reviews / Archive subfolders in v0.1 docs.

## 7. Workbench theme

The workbench's own UI uses a dark frosted aesthetic visually consistent with GeoSee's editor sidebar but **does not copy code or tokens from GeoSee**. The workbench's tokens live in `src/shell/styles/theme.ts` and are independent.

Concrete v1 theme values (Codex implements these exactly):

| Token | Value |
| --- | --- |
| Background, shell body | `rgba(18, 21, 24, 1.0)` |
| Background, panel | `rgba(28, 32, 36, 1.0)` |
| Background, panel raised | `rgba(38, 42, 46, 1.0)` |
| Background, field | `rgba(18, 21, 24, 0.4)` |
| Foreground, primary text | `rgba(244, 240, 232, 1.0)` |
| Foreground, secondary text | `rgba(244, 240, 232, 0.72)` |
| Foreground, tertiary text | `rgba(244, 240, 232, 0.46)` |
| Accent, active tool / selected | `rgba(120, 180, 220, 0.8)` |
| Severity colour, Info | `rgba(120, 180, 220, 0.9)` |
| Severity colour, Suggestion | `rgba(160, 200, 240, 0.9)` |
| Severity colour, Warning | `rgba(240, 200, 100, 0.9)` |
| Severity colour, Error | `rgba(240, 120, 100, 0.9)` |
| Severity colour, Blocker | `rgba(220, 60, 60, 1.0)` |
| Border, hairline | `1px solid rgba(255, 255, 255, 0.08)` |
| Border, panel outline | `1px solid rgba(255, 255, 255, 0.16)` |
| Radius, panel | `8px` |
| Radius, control | `6px` |
| Radius, pill | `999px` |
| Font, UI | `system-ui, -apple-system, "Segoe UI", sans-serif` at 13 px / 1.4 line-height |
| Font, mono | `"SFMono-Regular", Consolas, "Liberation Mono", monospace` at 12 px |
| Spacing scale | 4, 8, 12, 16, 20, 24, 32, 48 (px) |

Frosted material (backdrop-filter blur 20 px + saturate 145 %) is applied to: shell body, panel raised backgrounds, modal backdrops. Where the browser does not support `backdrop-filter`, fall back to the solid colours above.

## 8. Browser support

v1 supports:

| Browser | Min version | Notes |
| --- | --- | --- |
| Chrome | 120+ | Primary dev target. |
| Edge | 120+ | Chromium-based; equivalent to Chrome. |
| Firefox | 120+ | `backdrop-filter` supported as of 103; works. |
| Safari | 17+ | Backdrop-filter via `-webkit-` prefix. |

Touch input on Canvas: supported via Pointer Events (covers touch, stylus, mouse uniformly). Touch-specific UX (long-press menus, two-finger gestures beyond pinch-zoom) is deferred to v2 along with the touch rule pack.

Mobile / phone form factors: not supported in v1. The workbench layout assumes ≥1280×800 viewport. Smaller viewports render but layout breaks acceptably (validation may not pass against `desktop-1080p`).

## 9. Cross-references

| For details on… | Read… |
| --- | --- |
| Canvas math, snap rules, anchor semantics | [03_canvas_engine.md](03_canvas_engine.md) |
| Per-tool behaviour | [04_toolkit.md](04_toolkit.md) |
| Library schemas and instantiation | [05_libraries.md](05_libraries.md) |
| Package on-disk shape | [07_package_format.md](07_package_format.md) |
| Validation rule details | [08_validation_rules.md](08_validation_rules.md) |
| Phased build order | [10_build_phases.md](10_build_phases.md) |
| One-shot Codex orchestration | [11_agent_automation_runbook.md](11_agent_automation_runbook.md) |
| Element intent annotations | [13_element_intent_annotations.md](13_element_intent_annotations.md) |
| Per-archetype props / variants / states | [14_component_archetype_reference.md](14_component_archetype_reference.md) |
| UI states (loading / empty / error / toast / modal) | [15_ui_states_and_feedback.md](15_ui_states_and_feedback.md) |
| Change State machine and transitions | [16_change_state_machine.md](16_change_state_machine.md) |
| Vite plugin threat model and lockdown | [17_security_model.md](17_security_model.md) |
