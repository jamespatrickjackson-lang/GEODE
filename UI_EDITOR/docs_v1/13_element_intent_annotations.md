# v1 Element Intent Annotations

## 1. Goal

Every element produced or imported in the workbench (Frame, Container, Component, Library Entry) can carry structured metadata describing **what it is**, **what it's for**, and **how it should work**. This metadata is the single most important payload the workbench hands to downstream implementing agents — far more useful than a layout diagram alone.

Without intent annotations, the AI-Agent Brief degenerates into "implement these shapes in React." With them, the brief becomes "implement this button that authors a page-level layer-style override, fires the existing `SET_PAGE_LAYER_OVERRIDE` action, and remains disabled while the page is in transition."

## 2. Annotation schema

Six optional fields on every Frame, Container, and Component. Every Library Entry (Component, Container, Swatch, Icon, Token) carries the first four. All optional; absent fields render as "—" in spec.md.

```ts
export interface IntentAnnotations {
  // Short human-readable name. Distinct from the kebab-case stable `id`.
  // Used in the Layers Panel, spec.md, and ai_agent_brief.md.
  name?: string;

  // One paragraph: WHY this element exists. The user need it serves, the
  // workflow it supports, the absence-cost of removing it.
  intent?: string;

  // One paragraph: HOW it should work when interacted with. State changes,
  // events emitted, animations, transitions, edge cases. Imperative voice.
  behaviour?: string;

  // What app state this element reads from and writes to. Free text but
  // conventionally: "reads X, writes Y". Used by downstream agents to map
  // the element to the host app's data flow.
  dataBinding?: string;

  // Other element ids this element depends on (visibility, data, behaviour).
  // Empty array = no declared dependencies.
  dependsOn?: string[];

  // Free-form notes the author wants to preserve. Anything that doesn't fit
  // the four structured fields. Not rendered in ai_agent_brief by default
  // (only in spec.md) so they can be candid notes for human reviewers.
  authorNotes?: string;
}
```

Schema integration:

- `Component`, `Container`, `Frame` in [07_package_format.md](07_package_format.md) each gain `intent?: IntentAnnotations`.
- `ComponentLibraryEntry`, `ContainerLibraryEntry`, `ColourLibraryEntry`, `IconLibraryEntry`, `TokenLibraryEntry` in [05_libraries.md](05_libraries.md) each gain `intent?: Pick<IntentAnnotations, "name" | "intent" | "behaviour" | "dataBinding">`.
- The existing `rationale?: string` on Container / Component is **superseded** by `intent.intent`. v1 readers tolerate `rationale` for backward compat and migrate it into `intent.intent` on load with a Suggestion-level finding (`migration.rationale-to-intent`).

## 3. Authoring UX

### 3.1 Properties Inspector

When a single element is selected, the Properties Inspector renders an **Intent** section near the top, above archetype props:

```text
┌─ Intent ─────────────────────────────────────────────────────────────┐
│ Name        [ pill button — accent swatch                         ] │
│ Intent      [ Lets the author change the page accent colour.       │
│              The colour drives every per-page chrome (row, accent  │
│              dot, focus glyph). Without it, accent colour is        │
│              palette-cycled with no override.                    ] │
│ Behaviour   [ Click opens a native <input type="color">. On        │
│              change, dispatch SET_PAGE_FIELD with                  │
│              { accentColor: newHex }. No confirm; live.          ] │
│ Data        [ reads page.accentColor; writes page.accentColor       │
│   binding   via SET_PAGE_FIELD                                   ] │
│ Depends on  [ container-page-row                                  ] │
│             [ + add reference ]                                     │
│ Author      [ author notes (not rendered to downstream agents)   ] │
│   notes                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

Each field is a multi-line text input. `dependsOn` is a chip list — clicking `+ add reference` opens a filtered element picker (search by name or id).

### 3.2 Multi-selection

When multiple elements are selected:
- `name` and `intent` and `behaviour` fields show "Multiple values" if elements disagree, else show the shared value.
- `dataBinding` and `authorNotes` always show "Multiple values" with a Set button to broadcast a value to all selected elements.
- `dependsOn` shows the **union** of all elements' dependencies, with chips visually distinct for "all selected have this" vs "only some have this".

### 3.3 Library Panel

In Component / Container Library views, each entry's row shows `name` if present, falling back to `id`. Hovering an entry surfaces a tooltip with `intent` and `behaviour`.

### 3.4 Layers Panel

Each row shows `name` if present, falling back to `id`. If the element has `intent` set, a small tag icon appears next to the row name (clickable → focuses the Properties Inspector Intent section).

### 3.5 Canvas

Hovering an element on the Canvas (no click) shows a 250 ms-delayed tooltip with `name` (first line) and `intent` (truncated to 240 chars).

## 4. Propagation to outputs

### 4.1 `docs/spec.md` (Implementation Brief)

Every element with at least one `intent.*` field rendered in spec.md as:

```markdown
### container-page-row — page list row

**Intent.** Lets the author change the page accent colour. The colour drives
every per-page chrome (row, accent dot, focus glyph). Without it, accent
colour is palette-cycled with no override.

**Behaviour.** Click opens a native `<input type="color">`. On change,
dispatch `SET_PAGE_FIELD` with `{ accentColor: newHex }`. No confirm; live.

**Data binding.** reads `page.accentColor`; writes `page.accentColor` via
`SET_PAGE_FIELD`.

**Depends on.** [`container-page-row`](#container-page-row).

**Author notes.** _(this section omitted from ai_agent_brief.md by design.)_
the colour picker is a native input for two reasons: (a) cross-OS palette
parity, (b) avoids re-implementing colour-picker UI. Do not replace.
```

Elements with no intent annotations render only their archetype + dimensions + variants.

### 4.2 `docs/ai_agent_brief.md` (AI-Agent Brief)

The AI-Agent Brief is the load-bearing downstream artefact. Intent annotations dominate.

```markdown
## Element: `container-page-row` (page list row)

**Implement this element with the following intent:**

Lets the author change the page accent colour. The colour drives every
per-page chrome (row, accent dot, focus glyph). Without it, accent colour
is palette-cycled with no override.

**Required behaviour:**

Click opens a native `<input type="color">`. On change, dispatch
`SET_PAGE_FIELD` with `{ accentColor: newHex }`. No confirm; live.

**Data flow:**

This element reads from `page.accentColor`. On user interaction, it writes
to `page.accentColor` via the host app's `SET_PAGE_FIELD` action.

**Dependencies:**

This element depends on `container-page-row`. Implement `container-page-row`
first or ensure it is already present.

**Layout:**

Archetype `pill-button`, default size 24×24 px, surface `tinted`, fill
follows the active accent Swatch.

**Validation:**

This element is subject to validation rule
`component.touch-target-min` (Suggestion) — current value 24 px meets the
threshold.

**Do not:**

- Replace the native `<input type="color">` with a custom picker.
- Add a confirm step on colour change.
- Mutate any field other than `page.accentColor`.
```

Author notes are **never** included in the AI-Agent Brief. They are author-only.

### 4.3 Selective omission

If a downstream consumer wants the brief without intent annotations (e.g. a layout-only export), the export call accepts an option:

```ts
exportAiAgentBrief(pkg, { includeIntent: true })  // default
exportAiAgentBrief(pkg, { includeIntent: false }) // layout-only
```

v1 always defaults to `includeIntent: true`. The toggle exists for forward compat.

## 5. Validation rules

Three new rules added to `desktop-technical-editing` rule pack (see [08_validation_rules.md](08_validation_rules.md) §4 — append):

| Rule id | Severity | Condition | Message template |
| --- | --- | --- | --- |
| `intent.missing.suggestion` | Suggestion | Element exists in package but has no `intent.intent` set | "{name} lacks an intent annotation. Downstream agents will not know why this element exists." |
| `intent.behaviour-missing.suggestion` | Suggestion | Element has `intent.intent` but no `intent.behaviour` | "{name} has intent but no behaviour. Downstream agents will not know how it should work." |
| `intent.unresolved-dependency.warning` | Warning | `intent.dependsOn` references an element id that does not exist in the package | "{name} depends on `{missingId}` which is not in this package." |
| `intent.depends-on-self.error` | Error | An element lists itself in `intent.dependsOn` | "{name} cannot depend on itself." |

`intent.missing.suggestion` and `intent.behaviour-missing.suggestion` are Suggestions — never blocking — so authors can ship packages incrementally without annotations.

## 6. Library-level annotations

Library Entries carry intent too. This means the bundled `geosee_editor_sidebar` Library Panel surfaces, for each archetype, a one-paragraph description of what that archetype is for. Authors instantiating from the library inherit the entry's intent as the **default** annotation on the new element, with placeholder substitution:

```text
ComponentLibraryEntry intent: "A small accent button. Used to surface a
per-element colour pick or a focus / interest cue."

→ Instantiated Component intent (default, editable):
"A small accent button. Used to surface a per-element colour pick or a
focus / interest cue. Specific use on this instance: <author fills in>."
```

The author then refines the trailing placeholder for the instance.

## 7. Workflow recommendations (for the author, not enforced)

The pack does not force any authoring order, but recommends:

1. **Capture intent first**, before pixel positioning. The Properties Inspector intent section comes first so authoring naturally begins with WHY.
2. **One sentence per field**, prose paragraphs only for genuinely complex elements.
3. **Reference behaviour, not implementation**, in `behaviour`. ("Saves the page" not "calls `commitPending`".)
4. **Use `dataBinding` for state contracts**, not implementation. ("reads `page.accentColor`; writes via `SET_PAGE_FIELD`".)
5. **Use `dependsOn` sparingly**, only for hard dependencies (e.g. "this row is meaningless without its parent container"). Don't list every parent / child relationship.
6. **Reserve `authorNotes` for warnings to future authors** ("don't replace this with a custom picker — we tried; bad").

## 8. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Schema extended | `Component`, `Container`, `Frame`, all Library entries have `intent?: IntentAnnotations`. tsc clean. |
| 2 | Properties Inspector renders Intent section | Select element; section visible above props. |
| 3 | Inspector edits flow through `applyEdit` | Type into `intent.intent`; commit; Change Record `intent_edited` appended. |
| 4 | Multi-selection behaviour | Select 2 elements with different `intent.name`; field shows "Multiple values". |
| 5 | Library entry intent surfaces in Library Panel | Hover entry; tooltip shows `intent` + `behaviour`. |
| 6 | Instantiation inherits intent | Drag archetype onto Canvas; new element's intent defaults to archetype's intent + placeholder. |
| 7 | spec.md renders intent | After export, spec.md has the "**Intent.**" / "**Behaviour.**" / etc. structure for each annotated element. |
| 8 | ai_agent_brief.md renders intent | After export, ai_agent_brief.md per-element sections lead with intent. |
| 9 | `authorNotes` excluded from ai_agent_brief.md | After export with `authorNotes: "secret"`, ai_agent_brief.md does NOT contain "secret". |
| 10 | Backward compat | Load a package with `rationale: "..."` and no `intent`; `intent.intent` set to migrated value; Suggestion `migration.rationale-to-intent` appears. |
| 11 | New validation rules fire | Element without `intent.intent` triggers `intent.missing.suggestion`. Element depending on self triggers `intent.depends-on-self.error`. |
| 12 | Canvas tooltip | Hover element with intent; tooltip appears at 250 ms with name + truncated intent. |

## 9. v2 hooks

- The Host-App Adapter (`src/adapter/HostAppAdapter.ts`) is the v2 path for `dataBinding` resolution. v1 keeps `dataBinding` as free text; v2's adapter can validate that referenced actions/state-fields exist in the host app.
- AI-Assisted Review (deferred to v2) attaches `advisory` notes that may critique intent quality (e.g. "this intent is too vague to be actionable").
- Project Override layering (deferred to v2) may override `intent` per project; v1 stores intent at the base layer only.
