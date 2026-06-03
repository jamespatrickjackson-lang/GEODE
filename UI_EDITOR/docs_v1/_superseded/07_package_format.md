# SUPERSEDED - NOT CURRENT EDITOR GUIDANCE

This historical package-workbench document is preserved for reference only.
Current work is governed by `../EDITOR-SPEC.md` and targets
`UI_EDITOR/gui-editor.html`.

# v1 GUI Package Format

## 1. Goal

A GUI Package is the portable, versionable, on-disk representation of a GUI Project. v1 commits to a **folder + JSON** format. Every file under a Package Folder has a known purpose and a known schema; agents read / write this layout deterministically.

## 2. Folder layout (canonical)

```text
packages/<package-id>/
├── manifest.json                # package metadata + schema/workbench version
├── frames.json                  # all Frames in the package, ordered
├── containers.json              # all Containers, keyed by id
├── components.json              # all Components, keyed by id
├── tokens.json                  # Design Tokens used in this package
├── libraries.json               # the four Libraries (components, colours, icons, tokens)
├── guides.json                  # user-drawn Guides, per Frame
├── validation/
│   ├── rule_pack.json           # references the active Validation Rule Pack id
│   └── findings.json            # last-computed findings (cached)
├── change_log.json              # append-only Change Records
├── docs/                        # generated outputs (overwritten on every export)
│   ├── spec.md                  # Implementation Brief / human-readable spec
│   └── ai_agent_brief.md        # AI-Agent Brief
└── assets/                      # bundled binary / text assets
    ├── backgrounds/             # Background Stress Test images
    │   ├── plain_dark.png
    │   ├── plain_light.png
    │   ├── noise_low_contrast.png
    │   └── terrain_capture.png
    └── thumbnails/              # optional Component thumbnails referenced from libraries.json
```

All `.json` files are UTF-8, two-space indented, with `\n` line endings. Trailing newline present.

`<package-id>` is the same as `manifest.json` `id`. v1's bundled sample uses `geosee_editor_sidebar`.

## 3. `manifest.json` schema

```ts
export interface PackageManifest {
  id: string;                          // snake_case folder id
  name: string;                        // human-readable
  description?: string;
  schemaVersion: 1;                    // v1 schema is fixed at 1
  workbenchVersion: string;            // e.g. "1.0.0"
  packageState: ChangeState;           // see [09_glossary.md](09_glossary.md) §1
  createdAt: string;                   // ISO-8601 UTC
  updatedAt: string;                   // ISO-8601 UTC
  author?: string;                     // free-text; defaults to git config user.name if available
  targetHostApp: {
    name: string;                      // e.g. "geosee"
    version?: string;                  // optional; not enforced in v1
    adapterId?: string;                // reserved for v2 adapter identity
  };
  profileDefaults: {
    deviceId: string;                  // e.g. "desktop-1080p"
    inputId: string;                   // e.g. "mouse-keyboard"
    useCaseId: string;                 // e.g. "technical-editing"
  };
  rulePackId: string;                  // e.g. "desktop-technical-editing"
}
```

Required fields enforced by `core/packageIO/readPackage.ts` at load. Missing required fields produce a Blocker finding and refuse to load.

`schemaVersion` is the agent's hard compatibility gate: v1 readers reject `schemaVersion > 1`; values `< 1` do not exist (v1 is the initial schema).

## 4. `frames.json` schema

```ts
export interface FramesFile {
  schemaVersion: 1;
  frames: Frame[];
  activeFrameId: string | null;        // last-active Frame; on load, the workbench focuses this Frame
}

export interface Frame {
  id: string;                          // kebab-case
  name: string;
  positionOnCanvas: { x: number; y: number };   // canvas-space top-left
  size: { w: number; h: number };
  safeArea: { left: number; top: number; right: number; bottom: number } | null;
  background: {
    fill?: { hex: string; alpha: number } | { tokenRef: string };
    stressTestAssetId?: string;        // path inside assets/backgrounds/, set when an author has pinned a background to this Frame
  };
  containerIds: string[];              // top-level Containers in this Frame, Z-order ascending
  componentIds: string[];              // top-level Components in this Frame, Z-order ascending
  hostSurface?: string;                // v2-reserved (e.g. "src/editor/PagePanel.tsx")
}
```

A Frame's children are referenced by id; the actual Container / Component definitions live in `containers.json` / `components.json`. This indirection keeps individual files manageable and supports content-addressable diffs.

## 5. `containers.json` schema

```ts
export interface ContainersFile {
  schemaVersion: 1;
  containers: Record<string, Container>;
}

export interface Container {
  id: string;
  name: string;
  archetype: string;                   // references a Container archetype id in libraries.json
  parentId: string | null;             // null = root of a Frame; otherwise another Container's id
  frameId: string;                     // which Frame this Container lives in (denormalised for fast lookup)
  rect: { x: number; y: number; w: number; h: number };  // Frame-space
  constraints: Constraints;            // see core/schema/anchor.ts
  containerIds: string[];              // child Containers, Z-order ascending
  componentIds: string[];              // child Components, Z-order ascending
  locked: boolean;
  hidden: boolean;
  fill?: { hex: string; alpha: number } | { tokenRef: string } | null;
  border?: {
    width: number;
    colour: { hex: string; alpha: number } | { tokenRef: string };
    radius?: number | { tokenRef: string };
    sides?: ("left" | "top" | "right" | "bottom")[];     // omitted = all 4
  } | null;
  padding?: {
    x: number | { tokenRef: string };
    y: number | { tokenRef: string };
  };
  // Optional Style reference; resolves at render time per [20_materials_and_shapes.md](20_materials_and_shapes.md) §2.
  styleRef?: string;
  // Optional effects (shadow / blur / opacity); see [20_materials_and_shapes.md](20_materials_and_shapes.md) §5.
  effects?: Effects;
  hostRef?: string;                    // v2-reserved
  rationale?: string;
  intent?: IntentAnnotations;          // see [13_element_intent_annotations.md](13_element_intent_annotations.md)
}

// Effects shape — re-exported from src/core/schema/effects.ts.
export interface Shadow {
  offsetX: number | { tokenRef: string };
  offsetY: number | { tokenRef: string };
  blur: number | { tokenRef: string };
  spread?: number | { tokenRef: string };
  colour: { hex: string; alpha: number } | { tokenRef: string };
  inset?: boolean;
}

export interface Effects {
  shadows?: Shadow[];                  // multiple stacked shadows allowed
  blur?: number | { tokenRef: string };// CSS filter blur in px
  opacity?: number;                    // 0..1
}
```

## 6. `components.json` schema

```ts
export interface ComponentsFile {
  schemaVersion: 1;
  components: Record<string, Component>;
}

export interface Component {
  id: string;
  name: string;
  archetype: string;                   // references a Component archetype id in libraries.json
  parentId: string | null;             // null = root of a Frame; otherwise a Container's id
  frameId: string;
  rect: { x: number; y: number; w: number; h: number };  // Frame-space
  constraints: Constraints;
  locked: boolean;
  hidden: boolean;
  // Archetype-specific props live under a discriminated union keyed on archetype:
  props: ComponentProps;
  // Variants (e.g. "pill-button — surface: tinted") and States are flattened into props in v1.
  variant?: string;                    // current Variant id within the archetype
  state?: "default" | "hover" | "active" | "focus" | "disabled";
  // Optional Style reference; resolves at render time per [20_materials_and_shapes.md](20_materials_and_shapes.md) §2.
  styleRef?: string;
  // Optional effects (shadow / blur / opacity); see [20_materials_and_shapes.md](20_materials_and_shapes.md) §5.
  effects?: Effects;
  hostRef?: string;                    // v2-reserved
  rationale?: string;
  intent?: IntentAnnotations;          // see [13_element_intent_annotations.md](13_element_intent_annotations.md)
}

// Discriminated union, one branch per Component archetype.
export type ComponentProps =
  | PillButtonProps
  | IconButtonProps
  | InlineEditableTextProps
  | DirtyDotProps
  | LetterGlyphProps
  | NumericLabelProps
  | ColourSwatchProps
  | SliderProps
  | NumericInputProps
  | SelectDropdownProps
  | CheckboxProps
  | NativeDetailsProps
  | AriaExpandedRowProps
  | DividerProps
  | IconProps
  | TextProps
  // Shape primitives — see [20_materials_and_shapes.md](20_materials_and_shapes.md) §4 and
  // [14_component_archetype_reference.md](14_component_archetype_reference.md) §3.18 – §3.21.
  | RectangleProps
  | EllipseProps
  | LineProps
  | ImagePlaceholderProps;

export interface PillButtonProps {
  archetype: "pill-button";
  label: string;
  fill?: { hex: string; alpha: number } | { tokenRef: string };
  text?: { hex: string; alpha: number } | { tokenRef: string };
  surface: "dark" | "tinted";
  onClickAction?: string;              // free-text action name for the spec (no execution in v1)
}

// (One props interface per archetype follows the same pattern; see src/core/schema/component.ts for the full set.)
```

The discriminated union pattern means TypeScript's exhaustiveness check guides agents implementing new archetypes: adding a new archetype requires adding its branch.

## 7. `tokens.json` schema

```ts
export interface TokensFile {
  schemaVersion: 1;
  tokens: Record<string, TokenLibraryEntry>;     // see 05_libraries.md §4
}
```

`tokens.json` mirrors the Token Library in `libraries.json` but is split out for ergonomic access during validation (rules often read tokens; reading the whole `libraries.json` to get a token value is wasteful). v1 keeps both files in sync on write; on read, `tokens.json` is the authoritative source.

## 8. `libraries.json` schema

See [05_libraries.md](05_libraries.md) §4 for the full interface. File shape:

```ts
export interface LibrariesFile {
  schemaVersion: 1;
  libraries: Libraries;
}
```

## 9. `guides.json` schema

```ts
export interface GuidesFile {
  schemaVersion: 1;
  guides: Guide[];
}
```

`Guide` defined in [03_canvas_engine.md](03_canvas_engine.md) §9. Guides are per-Frame; the file holds them all flat keyed by `frameId`.

## 10. `validation/rule_pack.json` and `validation/findings.json`

```ts
export interface RulePackFile {
  schemaVersion: 1;
  rulePackId: string;                 // references a Rule Pack id in core
  rulePackVersion: number;            // pinned at the time of last validation run
  configOverrides?: Record<string, unknown>; // future per-package rule tweaks (v2)
}

export interface FindingsFile {
  schemaVersion: 1;
  generatedAt: string;
  rulePackId: string;
  rulePackVersion: number;
  findings: ValidationFinding[];
}
```

`ValidationFinding` shape per [08_validation_rules.md](08_validation_rules.md) §2.

## 11. `change_log.json` schema

```ts
export interface ChangeLogFile {
  schemaVersion: 1;
  records: ChangeRecord[];
}

export interface ChangeRecord {
  id: string;                          // ULID or sequential ulid-like id
  timestamp: string;                   // ISO-8601 UTC
  author?: string;
  kind: ChangeRecordKind;              // snake_case verb; see 09_glossary.md §5.6
  packageStateBefore: ChangeState;
  packageStateAfter: ChangeState;
  affected: {
    frameId?: string;
    containerIds?: string[];
    componentIds?: string[];
    swatchIds?: string[];
    tokenIds?: string[];
    libraryEntryIds?: string[];
  };
  summary: string;                     // one-line human-readable
  rationale?: string;                  // optional author input
  validation?: {
    findingCountBefore: number;
    findingCountAfter: number;
    worstSeverityBefore?: Severity;
    worstSeverityAfter?: Severity;
  };
  diff?: unknown;                      // optional structured diff; v1 leaves shape open
}
```

Append-only. v1 readers never rewrite earlier records.

## 12. `docs/` generated outputs

### 12.1 `docs/spec.md` (Implementation Brief)

Markdown. Sections:

1. Package metadata (id, name, version, target host app, package state).
2. Per-Frame summary (name, size, Component / Container count).
3. Per-Frame detail:
   - Container tree with archetype names, sizes, key props.
   - Component flat list with archetype names, sizes, key props.
4. Tokens used in the package (id, value, category).
5. Libraries shipped with the package.
6. Validation status (rule pack id, finding counts by Severity).
7. Restricted Surfaces (the locked properties).
8. Change Log summary (last 20 records).

Regenerated by `core/export/exportSpec.ts` on every package export.

### 12.2 `docs/ai_agent_brief.md` (AI-Agent Brief)

Markdown. Constrained for downstream AI coding agents. Sections:

1. **Target package**: id, target host app.
2. **Build instruction** (the canonical phrase: "Implement the GUI surfaces described below as React components in `<target file or directory>`. No other GUI changes are in scope.").
3. **Per-Frame implementation hints**: list of Containers / Components by archetype, with default props.
4. **Tokens to honour**: every token id used in the package; the agent must apply these values.
5. **Validation acceptance criteria**: the rule pack id and the unresolved findings (Errors / Blockers cause the brief to refuse generation; Warnings are listed as known issues).
6. **No-touch areas**: explicit list of Restricted Surfaces from the package + the GeoSee CLAUDE.md no-touch list (renderer, data, permissions, state, auth).
7. **Acceptance test sketch**: `tsc --noEmit` clean; visual smoke (list specific Frames the agent should manually verify); validation rule re-run produces the same finding count.
8. **Out-of-scope**: explicit list of what the implementing agent must NOT do (modify other panels, change the data pipeline, add network calls, etc.).

Regenerated by `core/export/exportAiAgentBrief.ts` on every package export.

## 13. Persistence mechanism

A dev-only Vite plugin `plugins/vite-plugin-package-write.ts` exposes three endpoints over the Vite dev server:

| Endpoint | Method | Body | Effect |
| --- | --- | --- | --- |
| `/api/package/read` | POST | `{ packageId: string }` | Returns the full Package object (all files merged). |
| `/api/package/write` | POST | `{ packageId: string, files: Record<string, string> }` | Writes the listed files atomically. Validates each path against `pathPolicy.ts`. |
| `/api/package/list` | POST | `{}` | Returns list of package ids under `UI_EDITOR/packages/`. |

`pathPolicy.ts` enforces:
- Paths must start with `packages/<id>/`.
- No `..` segments.
- No symlinks (resolved real path must stay inside `packages/<id>/`).
- Write allowlist: only files matching the canonical layout in §2 above. Anything outside the allowlist returns 403.

The plugin is **dev-only**: it does not register in production builds. Production builds of v1 are not used (v1 is dev-time tooling).

## 14. Loading and saving lifecycle

### 14.1 Load (`core/packageIO/readPackage.ts`)

1. POST `/api/package/read` with the package id.
2. Server reads all files in §2 layout, merges into a `Package` object.
3. Client validates the `schemaVersion` of every file against v1's `schemaVersion: 1`.
4. If any schema version mismatches, the load is rejected with a Blocker finding.
5. The merged `Package` is handed to the shell reducer via `{ type: "PACKAGE_LOADED", pkg, pkgPath }`.

### 14.2 Save (`core/packageIO/writePackage.ts`)

1. Shell flushes the current `pkg` to file contents (one per file in §2 layout).
2. Re-runs validation; updates `validation/findings.json`.
3. Appends `change_log.json` with a `package_saved` record.
4. Regenerates `docs/spec.md` and `docs/ai_agent_brief.md`.
5. Updates `manifest.json` `updatedAt`.
6. POST `/api/package/write` with all updated files.
7. On success, shell dispatches `{ type: "SAVE_SUCCEEDED" }` and clears `dirty`.

Save is atomic at the plugin level: either all files write or none do. The plugin uses a temp-rename strategy (write each file to `<path>.tmp`, then rename atomically). On partial failure, the plugin rolls back (deletes any `.tmp` files written so far) and returns an error.

### 14.3 Export

Export = Save + an additional regeneration step that ensures `docs/spec.md` and `docs/ai_agent_brief.md` are always fully rewritten (rather than the lazy "only if changed" behaviour on Save). Export also advances `packageState` from `Draft` → `Validated` if the validation pass produces no Errors / Blockers (and the author has acknowledged any Errors).

Export does NOT advance to `Approved`. That state is set explicitly via a TopBar action that requires the author to type a one-line confirmation.

### 14.4 Create (`core/packageIO/createPackage.ts`)

Closes gap L1 from [22_mvp_coherence_audit.md](22_mvp_coherence_audit.md) §5.1. The "Create new package" flow the shell invokes from `File → New Package…` (per [22_mvp_coherence_audit.md](22_mvp_coherence_audit.md) §7.6).

```ts
export interface NewPackageInput {
  id: string;                          // kebab-case; must match /^[a-z0-9_]+$/
  name: string;                        // human-readable
  description?: string;
  targetHostApp: { name: string; version?: string };
  profileDefaults?: {
    deviceId?: string;                 // default "desktop-1080p"
    inputId?: string;                  // default "mouse-keyboard"
    useCaseId?: string;                // default "technical-editing"
  };
  rulePackId?: string;                 // default "desktop-technical-editing"
  author?: string;                     // free text; defaults to git config user.name if available
}

export interface NewPackageResult {
  ok: boolean;
  packageId: string;                   // echo of input id on success
  manifestPath: string;                // absolute disk path of the new manifest.json
  error?: { code: string; message: string };
}

export async function createPackage(
  input: NewPackageInput,
): Promise<NewPackageResult>;
```

**Behaviour:**

1. Validate `input.id` against `^[a-z0-9_]+$`. If invalid, return `{ ok: false, error: { code: "id_invalid", message: "id must be lower-case alphanumeric with underscores" } }`.
2. Validate that `packages/<id>/` does not already exist. If it does, return `{ ok: false, error: { code: "id_taken", message: "..." } }`.
3. Compose a minimal `PackageManifest`:
   - `id`, `name`, `description` from input.
   - `schemaVersion: 1`, `workbenchVersion` = current workbench version.
   - `packageState: "Draft"`.
   - `createdAt` / `updatedAt` = current ISO-8601 UTC.
   - `author` from input or git config or absent.
   - `targetHostApp` from input.
   - `profileDefaults` merged with the defaults above.
   - `rulePackId` from input or `"desktop-technical-editing"`.
4. Write the full minimal Package Folder layout via `writePackage`:
   - `manifest.json` (the composed manifest).
   - `frames.json` with `{ schemaVersion: 1, frames: [], activeFrameId: null }`.
   - `containers.json` with `{ schemaVersion: 1, containers: {} }`.
   - `components.json` with `{ schemaVersion: 1, components: {} }`.
   - `tokens.json` with `{ schemaVersion: 1, tokens: {} }`.
   - `libraries.json` with `{ schemaVersion: 1, libraries: { components: [], colours: [], icons: [], tokens: [], styles: [] } }`.
   - `guides.json` with `{ schemaVersion: 1, guides: [] }`.
   - `validation/rule_pack.json` referencing the chosen rule pack.
   - `validation/findings.json` with `{ schemaVersion: 1, generatedAt: <now>, rulePackId, rulePackVersion: 1, findings: [] }`.
   - `change_log.json` with a single `package_created` Change Record.
   - `docs/spec.md` and `docs/ai_agent_brief.md` with placeholder content ("Empty package — author has not created any Frames yet.").
   - `assets/backgrounds/` empty directory (asset generation happens on first need).
5. Return `{ ok: true, packageId, manifestPath }`.

**Shell flow:**

- `File → New Package…` opens a modal collecting `id`, `name`, `targetHostApp.name`, and optionally `description`. Profile defaults pre-fill from the active workbench profile.
- On modal Confirm, shell dispatches `{ type: "PACKAGE_CREATE", input }`.
- Reducer awaits `createPackage(input)`; on `ok: true`, loads the new package (`PACKAGE_LOADED`); on `ok: false`, surfaces an Error toast with the returned message.
- Package Browser refreshes to show the new entry; it is auto-selected.

**Acceptance:**

1. `File → New Package` opens a modal with id / name / target / profile fields.
2. Submitting valid input creates the package folder under `packages/<id>/`; all files in §2 layout present.
3. Submitting a duplicate id returns the `id_taken` error visibly in the modal.
4. Submitting an invalid id (uppercase, spaces, special chars) returns `id_invalid` in the modal.
5. The new package's `change_log.json` has exactly one record (`package_created`).
6. The new package's `packageState` is `Draft`.
7. The new package round-trips: re-import produces byte-identical files (after canonicalisation).

## 15. Round-trip guarantee

Export-then-import must produce a byte-identical Package object after canonicalisation (consistent key ordering, consistent decimal precision). v1's writePackage canonicalises by:

- Sorting JSON object keys alphabetically.
- Stripping trailing zeros from decimals (e.g. `1.5` not `1.50`).
- Using lowercase hex in colour values.
- Using exactly 2-space indentation.

A regression test in `src/core/packageIO/__tests__/roundTrip.test.ts` proves this property.

## 16. Acceptance criteria for the Package Format phase

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Sample package is structurally valid | Open `packages/geosee_editor_sidebar/`; every file from §2 is present. |
| 2 | All schemaVersions = 1 | grep each `.json` file; `"schemaVersion": 1` present. |
| 3 | Read works | Workbench startup loads the sample package without errors. |
| 4 | Write works | Edit + save round-trip: file mtimes update; `manifest.json` `updatedAt` advances. |
| 5 | Path policy enforces allowlist | POST a malformed path (e.g. `packages/geosee_editor_sidebar/../../malicious.json`); response is 403; no file written. |
| 6 | Atomic write rollback | Simulate partial write (artificially fail one path mid-batch); no `.tmp` files remain; original files unchanged. |
| 7 | Round-trip byte-identical | Export package; re-import; canonicalised diff is empty. Unit test in `roundTrip.test.ts` passes. |
| 8 | Generated spec.md is non-empty and accurate | After export, `docs/spec.md` lists every Frame and every archetype used in the package. |
| 9 | Generated ai_agent_brief.md is non-empty | After export, `docs/ai_agent_brief.md` includes the no-touch section and validation acceptance criteria. |
| 10 | Change log appends correctly | After 3 saves, `change_log.json` has ≥3 records; none overwritten. |
| 11 | Schema version mismatch refuses load | Manually edit `manifest.json` to `schemaVersion: 2`; reload package; Blocker finding shown; package not loaded into editor state. |
| 12 | Required-fields enforcement | Manually remove `manifest.json` `id`; reload; load rejected with Blocker. |
