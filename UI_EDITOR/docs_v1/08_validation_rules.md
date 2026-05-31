# v1 Validation Rules — Desktop Technical Editing Rule Pack

## 1. Goal

Provide a deterministic, predictable rule set that an agent can evaluate against any v1 GUI Package and obtain a stable list of `ValidationFinding` objects. The v1 pack covers the **Desktop Technical Editing** profile (mouse + keyboard, ≥1080p monitor). Additional packs (touch, tablet, projector, a11y-strict) are explicitly deferred to v2 — see [12_deferred_to_v2.md](12_deferred_to_v2.md).

## 2. Finding shape

`src/core/schema/validation.ts`:

```ts
export type Severity = "info" | "suggestion" | "warning" | "error" | "blocker";

export interface ValidationFinding {
  ruleId: string;                  // e.g. "component.touch-target-min"
  severity: Severity;
  location: {
    packageId: string;
    frameId?: string;
    containerId?: string;
    componentId?: string;
    libraryEntryId?: string;
    propertyPath?: string;         // e.g. "rect.w", "props.label"
  };
  message: string;                 // human-readable
  currentValue?: unknown;
  suggestedValue?: unknown;
  profileId: string;               // which Profile triggered the rule
  acknowledged?: {
    by?: string;
    at?: string;                   // ISO-8601 UTC
    rationale: string;
  };
  advisory?: {                     // reserved for v2 AI-Assisted Review attachment
    by: string;
    text: string;
  };
}
```

`Severity` order is the v0.1 strict ladder: Info < Suggestion < Warning < Error < Blocker. Agents computing "worst severity" must use this ordering.

## 3. Rule pack: Desktop Technical Editing

`src/core/validation/rulePacks/desktopTechnicalEditing.ts`:

```ts
export const DESKTOP_TECHNICAL_EDITING: ValidationRulePack = {
  id: "desktop-technical-editing",
  version: 1,
  description: "Default rule pack for mouse + keyboard on ≥1080p monitors used for technical authoring.",
  triggerProfile: {
    deviceId: "desktop-1080p",
    inputId: "mouse-keyboard",
    useCaseId: "technical-editing",
  },
  rules: [
    /* see §4 below */
  ],
};
```

The rule pack is a single object the engine walks. Each rule is a pure function `(pkg, context) => ValidationFinding[]`. The engine concatenates results.

## 4. Rule catalogue

All rules below ship in v1. Thresholds are concrete; agents implementing v1 must use these exact numbers.

### 4.1 Component-level rules

| Rule id | Severity | Threshold | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `component.touch-target-min` | Suggestion (desktop is mouse-primary; size is advisory) | min(w, h) ≥ 24 px | Any clickable Component (button, icon-button, checkbox, swatch). | "Touch target is {currentValue} px; suggested minimum is 24 px even on desktop." |
| `component.button.label-non-empty` | Warning | `props.label.length > 0` | pill-button, footer-action-button (icon-only buttons exempt) | "Button has empty label." |
| `component.text.font-size-min` | Warning | font-size ≥ 11 px | text, inline-editable-text, numeric-label | "Font size {currentValue} px is below the 11 px desktop minimum for body text." |
| `component.text.font-size-suggested` | Suggestion | font-size ≥ 13 px | text, inline-editable-text | "Font size {currentValue} px is below the 13 px suggested minimum for sustained reading." |
| `component.disabled-state-defined` | Info | Component archetype with disabled state has `state: "disabled"` definition in props if `disabled: true` | All interactive components | "Disabled state is not defined for {componentId}." |
| `component.hover-only-affordance.warning` | Warning | Component does not depend on hover for critical affordances | Any Component with `props.hoverOnly: true` | "Hover-only affordances fail on touch profiles; consider an always-visible variant." |

### 4.2 Container-level rules

| Rule id | Severity | Threshold | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `container.section.edge-clearance-min` | Warning | edge clearance ≥ 8 px from Container boundary | Containers with archetype `section` or descendants | "Element {childId} is within {currentValue} px of Container edge; suggested clearance is 8 px." |
| `container.padding.tokenised` | Suggestion | `padding.x` and `padding.y` should be `tokenRef`-based, not literal | All Containers | "Padding is a literal value; consider applying a Token from the active Token Library." |
| `container.fill.contrast-with-background` | Warning | Contrast ratio (WCAG) ≥ 3:1 against the active background | Containers with semi-transparent fill | "Container {id} achieves a contrast ratio of {currentValue} against background `{backgroundId}`; suggested minimum is 3:1." |

### 4.3 Frame-level rules

| Rule id | Severity | Threshold | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `frame.size.matches-device-profile` | Suggestion | Frame size matches Device Profile's preferred dimensions | All Frames | "Frame size {currentValue} does not match Device Profile `{deviceId}` ({preferred} px)." |
| `frame.background.contrast-text-min` | Warning | Worst-case text contrast ≥ 4.5:1 over the active background | All Frames | "Worst-case text contrast on Frame {id} is {currentValue}; WCAG AA requires 4.5:1." |

### 4.4 Layout rules

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `layout.element-overlap.warning` | Warning | Two sibling elements' rects intersect | Any sibling pair under the same parent | "Element {a} overlaps element {b}." |
| `layout.element-outside-safe-area.forbidden` | Error | Element rect is entirely outside the Frame's Safe Area | All Containers / Components | "Element {id} sits outside the Safe Area for Device Profile `{deviceId}`." |
| `layout.element-outside-frame.blocker` | Blocker | Element rect is entirely outside its Frame | All Containers / Components | "Element {id} sits outside its Frame's bounds (rect={rect}, frame={frameSize})." |
| `layout.element-zero-size.warning` | Warning | w === 0 or h === 0 | All elements | "Element {id} has a zero dimension (w={w}, h={h}); it cannot be selected on the Canvas." |
| `layout.element-negative-rect.blocker` | Blocker | w < 0, h < 0, x < 0 with parentId === null | All elements | "Element {id} has invalid rect ({rect}); this would not render correctly." |

### 4.5 Token / Library rules

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `library.unresolved-token-ref` | Warning | A property has `{ tokenRef }` referencing a missing Token id | All properties | "Element {id} references Token `{tokenId}` which is not in the package's Token Library." |
| `library.duplicate-id` | Error | Two Library entries share an id within the same Library kind | All Libraries | "Library kind `{kind}` has duplicate id `{id}`." |
| `library.unused-token` | Info | A Token in the Token Library is not referenced by any element | All Tokens | "Token `{id}` is not used anywhere in the package; consider removing it." |
| `library.swatch-low-contrast.warning` | Warning | A Swatch with `semanticRole: "text"` has contrast < 4.5:1 against any Swatch with `semanticRole: "fill"` used as a background in the package | All Swatches | "Text Swatch `{swatchId}` achieves {currentValue} contrast against fill Swatch `{otherSwatchId}`; pair fails WCAG AA." |

### 4.6 Restricted Surface rules

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `restricted.locked-property-mutated.blocker` | Blocker | An EditOperation targets a property on a `locked: true` element | Any EditOperation | "Edit refused: element `{id}` is locked; property `{propertyPath}` cannot be modified in v1." |
| `restricted.archetype-mutated.blocker` | Blocker | An EditOperation attempts to change `archetype` | Any EditOperation | "Edit refused: changing an element's archetype is not supported in v1." |
| `restricted.delete-locked-element.blocker` | Blocker | A delete EditOperation targets a `locked: true` element | Any EditOperation | "Edit refused: element `{id}` is locked; deletion is not permitted." |
| `restricted.id-rename-attempted.blocker` | Blocker | An EditOperation attempts to mutate `id` | Any EditOperation | "Edit refused: element id renaming is not supported in v1." |

Restricted Surface rules are special: they run **at edit time** as a gate inside `core/editing/applyEdit.ts`. If a Blocker is returned, the edit is refused, no Change Record is appended, and the shell surfaces the finding to the user immediately. This is why these rules are categorised separately.

### 4.7 Intent annotation rules (DEC: doc 13)

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `intent.missing.suggestion` | Suggestion | Element has no `intent.intent` value | Any element | "{name} lacks an intent annotation. Downstream agents will not know why this element exists." |
| `intent.behaviour-missing.suggestion` | Suggestion | Element has `intent.intent` but no `intent.behaviour` | Any element | "{name} has intent but no behaviour. Downstream agents will not know how it should work." |
| `intent.unresolved-dependency.warning` | Warning | `intent.dependsOn` references an element id that does not exist in the package | Any element | "{name} depends on `{missingId}` which is not in this package." |
| `intent.depends-on-self.error` | Error | An element lists itself in `intent.dependsOn` | Any element | "{name} cannot depend on itself." |

### 4.8 Migration rules

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `migration.rationale-to-intent` | Suggestion | Element has the legacy `rationale` field but no `intent.intent` | Any element | "{name} carries a legacy `rationale` field. The migrated value has been copied into `intent.intent`; consider editing it to capture full intent." |

### 4.9 Materials, Grouping, Shapes, Effects rules (see [20_materials_and_shapes.md](20_materials_and_shapes.md))

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `library.unresolved-style-ref` | Warning | An element has `styleRef` referencing a missing Style id | All elements | "{name} references Style `{styleId}` which is not in the package's Style Library." |
| `library.unused-style` | Info | A Style in the Style Library is not referenced by any element | Style Library | "Style `{id}` is not used anywhere in the package; consider removing it." |
| `group.empty.warning` | Warning | A `container-group` has zero children | Group containers | "Group `{id}` is empty; ungroup or add children." |
| `group.cycle.blocker` | Blocker | A `container-group` directly or transitively contains itself | Group containers | "Group `{id}` contains itself; this is structurally invalid." |
| `group.depth-excessive.warning` | Warning | Group nesting depth > 4 | Group containers | "Group `{id}` is nested {currentValue} levels deep; depth > 4 is suspect." |
| `effects.shadow-no-colour.warning` | Warning | A Shadow has `colour: undefined` or `colour.alpha: 0` | Any element's `effects.shadows[]` | "{name} has a shadow with no visible colour; it contributes nothing to rendering." |
| `effects.opacity-out-of-range.error` | Error | `effects.opacity < 0` or `> 1` | Any element's `effects.opacity` | "{name} has opacity {currentValue}; valid range is [0, 1]." |
| `effects.blur-excessive.suggestion` | Suggestion | `effects.blur > 32` | Any element's `effects.blur` | "{name} has blur {currentValue} px; values above 32 px are usually unintentional." |

### 4.10 Change Log integrity rules

| Rule id | Severity | Condition | Applies to | Message template |
| --- | --- | --- | --- | --- |
| `changelog.save-without-record.warning` | Warning | `manifest.updatedAt` advances without a corresponding new Change Record | Change Log | "Save advanced `updatedAt` to {newTs} without appending a Change Record; expected at least one record." |
| `changelog.orphan-record.info` | Info | A Change Record references an element id that no longer exists | Change Log | "Record `{recordId}` references deleted element `{elementId}`; this is informational only." |

## 5. AI-Assisted Review boundary

v1 ships **no AI review**. The `advisory?` field on `ValidationFinding` (§2) is reserved for v2:

- v2's AI review may attach an `advisory` to any finding without modifying the deterministic Severity or message.
- v2's AI review may NOT silently mutate the finding list (cannot remove findings; cannot upgrade / downgrade Severity).
- v2's AI review attaches advisories during a separate pass; the deterministic engine remains the authority on pass / fail.

This guarantee preserves the v0.1 Validation Philosophy's principle: "Rules catch measurable failures. AI catches contextual weakness. Humans make final decisions."

## 6. Engine wiring

`src/core/validation/runValidation.ts`:

```ts
export function runValidation(
  pkg: Package,
  frameId: string | null,            // null = validate all frames
  profile: ProfileSelection,
): ValidationFinding[];
```

Behaviour:

1. Resolve the active rule pack from `profile`. v1 has only one pack (`desktop-technical-editing`); profile mismatch returns an empty finding list with one Info finding `validation.no-rule-pack-for-profile`.
2. Walk every rule in the pack; concatenate results.
3. Sort findings by (severity descending, ruleId ascending, location order ascending).
4. Persist to `validation/findings.json` (caller decides whether to persist).
5. Return.

Incremental validation: shell may call `runValidation(pkg, frameId, profile)` per-Frame after a focused edit. v1's engine is fast enough for ~1 ms per Frame on the straw-subject scale; full-package re-validation costs ~10 ms.

## 7. Acceptance criteria for the Validation phase

The Validation phase is complete when all these tests pass. Add them to `src/core/validation/__tests__/`.

| # | Test | Expected outcome |
| --- | --- | --- |
| 1 | Empty package | 0 findings. |
| 2 | Package with one valid Frame, one valid Container, one valid Component | 0 findings. |
| 3 | Component with `w: 6, h: 6` | 1 finding `component.touch-target-min` (Suggestion). |
| 4 | Pill-button with `label: ""` | 1 finding `component.button.label-non-empty` (Warning). |
| 5 | Text Component with `font-size: 9` | 1 finding `component.text.font-size-min` (Warning) AND 1 finding `component.text.font-size-suggested` (Suggestion). |
| 6 | Two siblings with overlapping rects | 1 finding `layout.element-overlap.warning` (Warning). |
| 7 | Element with `rect.x: -50` and `parentId: null` | 1 finding `layout.element-negative-rect.blocker` (Blocker). |
| 8 | Element wholly outside Safe Area | 1 finding `layout.element-outside-safe-area.forbidden` (Error). |
| 9 | Property `{ tokenRef: "space.does-not-exist" }` | 1 finding `library.unresolved-token-ref` (Warning). |
| 10 | Library has two Tokens with the same id | 1 finding `library.duplicate-id` (Error). |
| 11 | Text Swatch contrast 2.0:1 against a fill Swatch used as a Container background | 1 finding `library.swatch-low-contrast.warning` (Warning). |
| 12 | Attempt to edit a locked Component | `applyEdit` returns `{ refused: true, finding: { ruleId: "restricted.locked-property-mutated.blocker", severity: "blocker" } }`. No mutation occurs. |
| 13 | Run validation on the bundled straw-subject package | Findings list is non-empty (intentional: the straw subject seeds some Info / Suggestion findings to exercise UI) but contains 0 Blockers and 0 Errors. |
| 14 | Run validation against a profile with no rule pack | 1 finding `validation.no-rule-pack-for-profile` (Info); rest of pack not run. |
| 15 | Findings are sorted | Worst severity first; within severity, ruleId alphabetical. |
| 16 | `findings.json` round-trips | Save findings to disk; reload; parsed object equals original. |
| 17 | Acknowledged Error does not block Validated state | Mark an Error `acknowledged: { rationale: "intentional density" }`; package may advance to `Validated` if no unacknowledged Errors remain. |
| 18 | Unacknowledged Blocker refuses state advance | Try to advance state to `Validated` with an unresolved Blocker; refused. |

## 8. Edit-time rule integration

`core/editing/applyEdit.ts` runs Restricted Surface rules synchronously before mutating the package:

```ts
export function applyEdit(
  pkg: Package,
  edit: EditOperation,
): { ok: true; pkg: Package; change: ChangeRecord }
 | { ok: false; refused: true; findings: ValidationFinding[] };
```

If any Restricted Surface rule produces a Blocker for `edit`, `applyEdit` refuses. The shell renders the refusal in the Validation Panel and as a transient toast near the action source (e.g. near the attempted Resize handle).

Non-Blocker rule findings are NOT computed at edit time. They are computed on the next full `runValidation` pass (manual Validate button or save).

## 9. Performance budget

- v1 package size: ~10–50 Frames, ~50–500 Containers, ~100–1500 Components.
- Full `runValidation` on the straw-subject scale: target ≤ 20 ms on a modern dev laptop.
- Per-frame `runValidation`: target ≤ 5 ms.

If the engine exceeds budget after Phase 8 (validation), the rule engine is suspect. Profile in `core/validation/__tests__/perf.bench.ts` before optimising; document any optimisation in a Change Record commit.

## 10. Adding a new rule (post-v1, but design-stable)

The interface is stable. To add a rule in v2:

1. Implement the rule function in `src/core/validation/rules/<ruleId>.ts` returning `ValidationFinding[]`.
2. Append it to the appropriate rule pack export.
3. Add a unit test in `src/core/validation/__tests__/<ruleId>.test.ts`.
4. Update [09_glossary.md](09_glossary.md) §5.5 if a new naming pattern is introduced.

No engine changes required.
