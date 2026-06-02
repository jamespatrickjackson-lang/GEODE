# v1.1 Direction — Component / Assembly / Product Hierarchy

**Status:** v1.1 scope addendum. Reframes v1.0 in light of usage feedback.
v1.0 docs (00–22) describe the canvas / toolkit / package format primitives
and remain authoritative for the schema, validation engine, and persistence.
This doc supersedes the "GeoSee editor sidebar straw subject" framing
(doc 06) and the flat Component/Container split as the primary authoring
model.

## 1. Why this exists

v1.0 shipped a workbench that loads and round-trips a `geosee_editor_sidebar`
sample package and exposes containers, components, libraries, validation,
and export. In practice it is **not usable for actual authoring**: the
canvas does not give the author a fluent way to build containers, place
text + buttons, align elements, add padding, and layer container types
together. The GeoSee editor sidebar as a "straw subject" was the wrong
forcing function — it is a reconstruction target, not a thing the author
actually wants to compose from scratch.

v1.1 replaces the sidebar straw subject with an authoring model the author
will use for real work, and tightens the canvas so the core
container-place-align-pad-layer loop is the first-class experience.

## 2. The three-tier authoring model

v1.1 organises authored work into three nested tiers. Each tier is itself
a thing the author can create, edit, save to a library, and drop into a
larger tier.

| Tier | What it is | Examples | Made of |
| --- | --- | --- | --- |
| **Component** | An atomic interface element with no internal layout responsibility beyond its own chrome. | Text, dial, shape (rectangle / ellipse / line), icon, swatch, raw input. | Schema primitives. No children. |
| **Assembly** | A small composite that bundles 2–N components into a recognisable interface unit. | A button (icon + label), a labelled slider (slider + label + value readout), a labelled numeric input, a colour pip with hex readout, a row of two toggles + divider. | Components, plus a layout Container that holds them. |
| **Product** | A full surface — what the host app actually exposes to its users. | A page-manager sidebar, a camera-studio panel, a layer-card stack, a tool palette. | Assemblies + raw Components + Containers. |

### 2.1 Same primitives, three named scopes

All three tiers are built from the same v1.0 schema primitives:
`Container`, `Component`, and the existing archetypes. The tier is a
**named scope** that determines:

- Which library the saved thing lands in (`components`, `assemblies`,
  `products`).
- Default size, validation defaults, and downstream-agent treatment.
- The "publish unit" — the smallest atomic thing the author can drop
  into a higher tier.

No new runtime entity types are required. v1.1 introduces a `tier`
discriminator on `ComponentLibraryEntry` so the library panel can split
by tier:

```ts
export interface ComponentLibraryEntry {
  // ...existing fields...
  tier?: "component" | "assembly" | "product";
}
```

Missing `tier` is treated as `"component"` for backward compatibility
with v1.0 packages.

### 2.2 Nesting rules

- **Products** may contain Assemblies, Components, and bare Containers.
- **Assemblies** may contain Components and bare Containers — but not
  other Assemblies in v1.1. (Allow nested Assemblies in v1.2 once a
  v1.1 pack proves the basics.)
- **Components** are leaves. No children.

Group / ungroup behaviour from doc 20 §3 still applies inside any tier.

### 2.3 Authoring the tier of a new thing

When the author clicks "Save to library" on the current Selection (or on
an entire Frame), the workbench asks which tier the saved entry should
belong to and writes the entry into the matching library array.

When the author drags a library entry onto the canvas, the entry is
instantiated as a Container (for assemblies and products) or a Component
(for components), with its children instantiated recursively. The
instantiated copy carries a `derivedFrom: <libraryEntryId>` reference so
future "update library entry from this instance" flows can attribute back.

(Reverse propagation — edit the library entry and have all instances
update — is deferred to v1.2.)

## 3. AI Note (intent) on every tier

Every saved Component / Assembly / Product carries an **AI Note**: a
short description of what the thing is for, written for downstream AI
implementing agents. v1.0's `IntentAnnotations` shape already covers
this; v1.1 makes it a first-class promoted field on library entries:

```ts
export interface ComponentLibraryEntry {
  // ...existing fields...
  tier?: "component" | "assembly" | "product";
  aiNote?: {
    name?: string;           // human label distinct from `id`
    intent: string;          // required — WHY this thing exists
    behaviour?: string;      // HOW it should behave when used
    dataBinding?: string;    // what state it reads / writes
    notes?: string;          // free-form author notes (not exported to
                             // downstream-agent briefs by default)
  };
}
```

On instantiation, `aiNote` is copied into the instance's
`intent` field (doc 13) as the **default**, with a trailing
placeholder the author refines per use.

Spec.md and ai_agent_brief.md export the `aiNote` per library entry +
the per-instance intent overrides, so a downstream agent can see both
"what this archetype is for in general" and "what this specific use of
it is for on this Frame".

## 4. What v1.1 changes vs. v1.0

| Area | v1.0 | v1.1 |
| --- | --- | --- |
| Authoring target | Reconstruct GeoSee editor sidebar | Author Components, Assemblies, and Products against a small "Starter Pack" subject (see §6) |
| Library panel | Single flat list per kind | Tabs split by tier within Components: Components / Assemblies / Products |
| Save flow | Edit-in-place only | "Save to library as Component / Assembly / Product" affordance |
| AI Note | Per-instance only (`intent` field) | First-class on every library entry; copied to instances on drop |
| Canvas usability | Pan/zoom/select/move/resize work; drawing tools and alignment are observably weak | Drawing tools, alignment, distribute, snap, padding, drag-to-layer must all work fluently against the §5 acceptance |
| Validation | Same rule pack | Same rule pack, plus per-tier rules in §7 |

The schema, persistence, validation engine, and export pipeline from
v1.0 are unchanged. The shell adds new affordances; no breaking schema
changes.

## 5. Canvas usability acceptance (the load-bearing change)

v1.1 is "shippable" when the author can do all of the following without
opening the JSON files by hand:

1. Drop a Container Tool box on an empty Frame; resize it; move it.
2. Drop a Text Component inside it; the text inherits the container as
   its parent; moving the container moves the text.
3. Drop an Icon Button inside the same container. Place a second one
   beside it.
4. Multi-select both icon buttons; "Align Top"; both share their
   top edge.
5. With the same multi-select: "Distribute Horizontally" produces equal
   gaps.
6. With one container selected: Properties Inspector "Padding" section
   accepts a per-side value; the container's children visibly shift.
7. Drag a saved Assembly (e.g. "labelled slider") from the library onto
   the Frame; it instantiates inside the parent container; its component
   children are visible and individually selectable.
8. With the Assembly selected, "Save as Assembly" in the Library Panel
   adds it back to `libraries.assemblies` with an editable AI Note
   field; re-dragging it instantiates a fresh copy.
9. Nest a Product (e.g. "page-manager sidebar") on a Frame. Its assemblies
   and components instantiate. The page lists them under the product's
   group in the Layers Panel.
10. Open the saved package's `spec.md`; every Frame, Container, Component,
    Assembly, and Product is listed with its AI Note and intent.

Each of these is a manual smoke step against the bundled Starter Pack
package (§6). They replace the GeoSee-sidebar acceptance in v1.0 doc
06 §9.

## 6. Starter Pack (replaces GeoSee sidebar straw subject)

v1.1 ships a `starter_pack` package as the bundled sample. Its purpose
is to seed the library with one of each tier so the author can
immediately drag-test:

- **Components**: text, icon, dial, rectangle, ellipse, line, swatch,
  divider, plain numeric input.
- **Assemblies**: icon-button (icon + invisible hit area), pill-button
  (text + optional icon), labelled-slider (slider + label +
  value readout), labelled-numeric (label + numeric input + unit),
  colour-pip (swatch + hex readout), toggle-pair (label + toggle),
  segmented-row (label + segmented control).
- **Products**: empty `starter-sidebar` Frame containing one example
  card built from the assemblies above, plus a blank Frame ready for
  the author to compose.

The GeoSee editor sidebar reconstruction is dropped from v1.1 scope.
It can return as a downstream package authored *in* v1.1 once the
authoring loop is genuinely usable.

## 7. New validation rules (v1.1 additions)

| Rule id | Severity | Condition |
| --- | --- | --- |
| `library.assembly-without-ainote.suggestion` | Suggestion | An entry with `tier: "assembly"` has no `aiNote.intent`. |
| `library.product-without-ainote.warning` | Warning | An entry with `tier: "product"` has no `aiNote.intent`. |
| `library.assembly-empty.warning` | Warning | An entry with `tier: "assembly"` resolves to zero children at instantiation time. |
| `library.product-no-frame.warning` | Warning | An entry with `tier: "product"` does not define a containing Frame. |
| `library.tier-mismatch.warning` | Warning | A library entry's `tier` is set but its actual contents violate the §2.2 nesting rules (e.g. assembly contains an assembly). |

All five are advisory-level — never Blocker — so a v1.0 package loads
into v1.1 with no Blocker findings.

## 8. Out of scope for v1.1

- Reverse propagation (library-entry edit → live instances update).
- Sharing libraries between packages.
- Importing real GeoSee panels as Products.
- Conditional / data-driven Products (a Product whose composition
  changes based on host-app state).
- Theming Products against multiple Token Libraries at once.

These wait for v1.2+.

## 9. Migration from v1.0 packages

A v1.0 package loads in v1.1 unchanged:

- All existing library entries default to `tier: "component"`.
- All existing instances have no `derivedFrom` reference (treated as
  "authored in place").
- `aiNote` is missing from every entry; the new validation rules
  suggest but never block.

The author may opt in entry-by-entry: pick a library entry, set its
`tier`, fill in the `aiNote`, save. No bulk migration required.

## 10. Doc edits implied by this addendum

When v1.1 implementation begins, the following v1.0 docs must be patched
to match:

- **00_README.md** — index entry for this doc; note that doc 06 is
  superseded.
- **05_libraries.md** — extend `ComponentLibraryEntry` with `tier` and
  `aiNote`; describe per-tier tabs in the Library Panel.
- **06_straw_subject.md** — superseded by this doc and §6 above.
- **08_validation_rules.md** — append §7 rules above.
- **10_build_phases.md** — Phase 7 (straw-subject) is replaced by
  "Starter Pack build"; Phase 6 (Libraries) is extended with the
  tier-tab + Save-to-library affordance; new Phase 15 (Authoring loop
  smoke) drives the §5 acceptance manually.
- **11_agent_automation_runbook.md** — Phase 15 added to §4.2 sequence.
- **13_element_intent_annotations.md** — `IntentAnnotations` extended
  to mention `aiNote` as the library-entry-level shape; per-instance
  intent fields remain unchanged.
- **22_mvp_coherence_audit.md** — re-audit against §5 acceptance after
  v1.1 lands.

These edits are deferred until the v1.1 implementation work begins.
v1_0 docs (the original `docs_v1/00`–`22`) are frozen in
`UI_EDITOR_v1_0/docs_v1/` as the historical record.
