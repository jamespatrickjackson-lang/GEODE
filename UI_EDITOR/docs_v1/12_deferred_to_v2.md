# v1 Deferred to v2+

Every item in this doc is **deliberately out of scope** for v1. Each carries the rationale and the v2 readiness state (what v1 leaves in place to make v2 cheap).

## 1. Embedded Mode and the GeoSee Host-App Adapter

**Deferred.**

**Rationale:** standalone is sufficient to prove the schema, validation, package format, and visual editing surface. Embedded mode opens a much larger integration risk (live mutation of a running app's GUI surface, permission gating, change-state semantics, project override layering). Tackling both in v1 would compress the design space dangerously.

**v2 readiness:**
- `src/adapter/HostAppAdapter.ts` interface defined in v1.
- `src/adapter/geoSeeAdapter.stub.ts` type-checks but throws at runtime.
- Every Component / Container / Frame in the schema carries an optional `hostRef?` / `hostSurface?` field reserved for v2 use.
- The Restricted Surface marker scheme is implemented; v2's adapter consumes it as the embedded-mode lockout list.

## 2. AI-Assisted Review Layer

**Deferred.**

**Rationale:** v0.1's Validation Philosophy explicitly orders "rules catch measurable failures; AI catches contextual weakness; humans make final decisions." Building the AI layer before the deterministic engine is mature inverts that order. v1 must prove the deterministic engine first.

**v2 readiness:**
- `ValidationFinding` carries an optional `advisory?` field (already in v1 types).
- The contract for v2: AI may attach advisories to findings; AI may NOT modify Severity or remove findings.
- No structural change to the engine required to add an AI layer in v2.

## 3. Import / Inventory Layer

**Deferred.**

**Rationale:** v0.1 lists screenshots, existing GUI packages, design token files, component inventories, app configs, reference videos, and partial code structures as potential import sources. Each has a unique parser surface. Building all of them in v1 would balloon scope.

**v2 readiness:**
- The package read path (`core/packageIO/readPackage.ts`) is well-defined; an importer is "produce a Package object, then pass to writePackage".
- The schema is rich enough to receive imports without modification.

## 4. Additional Validation Rule Packs

**Deferred:**

- Touch input rule pack (touch target ≥ 44 px, no hover-only affordances, drag-distance thresholds).
- Tablet portrait + landscape Device Profiles with associated rule pack.
- Phone Device Profile.
- Projector / boardroom TV rule pack (font ≥ 24 px, contrast ≥ 7:1).
- Accessibility-strict rule pack (WCAG AAA contrast, full focus-order checks, ARIA attribute checks).
- Presentation-remote input rule pack (focusable navigation, large hit targets, no fine pointing).

**Rationale:** v1 ships the most-used profile (Desktop Technical Editing). Adding rule packs is mechanically simple once the engine exists; deferring them is a scope decision, not a design risk.

**v2 readiness:** the rule pack file shape is documented in [08_validation_rules.md](08_validation_rules.md) §3. Adding a new pack is creating a new file in `src/core/validation/rulePacks/`.

## 5. Project Override Layering

**Deferred.**

**Rationale:** v0.1 envisions four layers (Base GUI System → App Default → Project Override → User / Session Draft). v1 ships only the "Base" layer effectively; one package at a time. Layering is an additive feature, not a foundational one.

**v2 readiness:**
- The Package Manifest's `targetHostApp.adapterId` field is reserved for adapter-driven override resolution.
- The Change Log records every edit, supporting future "promote to base" / "demote to override" actions.

## 6. Wizard-Driven Creation Flow

**Deferred.**

**Rationale:** v0.1's PRD highlights a guided creation wizard ("what are you building? who is it for? where will it be used?") as the preferred entry point. v1's entry is "open an existing package or start from a blank package". Building the wizard requires nailing down the question set, the recommendation engine, and the device/use-case interaction — all of which depend on having a stable schema first.

**v2 readiness:** the schema is the schema. A wizard in v2 is a UI atop the same write path.

## 7. Open-Source Extraction / Distribution

**Deferred.**

**Rationale:** v0.1 mentions open-source as a long-term ambition. v1 lives in the GeoSee monorepo under `UI_EDITOR/`. Splitting into its own repo or publishing as an npm package requires decisions about licensing, governance, public API surface, and contribution model. v1 is in-house tooling.

**v2 readiness:** the Workbench Core / Standalone Shell / Adapter separation in v1 maps directly to a future package split.

## 8. Undo / Redo

**Deferred.**

**Rationale:** v1 is save-or-discard. Undo / redo adds complexity (history stack, inverse-edit derivation, branch/merge semantics) without unlocking new capability for v1's primary user.

**v2 readiness:** `core/editing/applyEdit.ts` returns the new Package; the Change Record records the edit. v2 can implement undo by either (a) keeping an in-memory stack of prior Packages, or (b) deriving inverse edits from the Change Record diff.

## 9. Multi-User Collaboration

**Deferred.**

**Rationale:** single-user local only in v1. Collaboration requires network, sync, conflict resolution, and operational transform or CRDT machinery. None are core to validating the schema.

**v2 readiness:** Change Records are append-only and timestamped; suitable as a future event log for sync. The Package format is text-based and diff-friendly; suitable for git-mediated collaboration in the short term.

## 10. Container Archetype Library Beyond Straw Subject

**Deferred.**

**Rationale:** v1 ships only the archetypes the GeoSee editor sidebar requires (~24 archetypes total across Components and Containers). A broader archetype library (form rows, data tables, breadcrumbs, modals, toasts, etc.) is a v2+ growth task.

**v2 readiness:** the archetype id system is open; adding archetypes is additive.

## 11. User-Testing Scaffold Export

**Deferred.**

**Rationale:** v0.1 lists a user-testing template as a potential output (test objective, participant type, workflow, tasks, observation fields, etc.). v1 export is limited to `spec.md` and `ai_agent_brief.md`. User-testing scaffolds need a stable interaction model before they make sense.

**v2 readiness:** `src/core/export/` accepts new exporters trivially.

## 12. Phone Device Profile

**Deferred.**

**Rationale:** v1 ships `desktop-1080p` and defines (but does not enable) `tablet-portrait`, `phone-portrait`, `projector-1080p`. Phone-specific validation rules (smaller touch targets, vertical-only orientation, swipe gestures) require commitment to a phone Use-Case Profile that GOC does not yet have.

**v2 readiness:** Device Profile shape is general; adding new profiles is additive.

## 13. Presentation Mode Presets

**Deferred.**

**Rationale:** GeoSee's presentation flow has its own complexity that v1 should not absorb. The straw subject captures Camera Studio's Cinematic Render Preset container (per DEC-080) but does not model presentation behaviour.

**v2 readiness:** Frame schema can carry preset-specific state via the existing `props` discriminated union.

## 14. Background Stress Test — Dynamic / Moving Backgrounds

**Deferred.**

**Rationale:** v1 ships four static background images. v0.1 mentions moving / dynamic backgrounds as a future stress mode. Animation playback inside the workbench Canvas is a non-trivial render-loop addition.

**v2 readiness:** `BackgroundStressBar` is a simple swap mechanism; v2 can extend it to play video / canvas-rendered scenes.

## 15. Change State Beyond Draft / Validated / Approved

**Deferred.** v1 uses Draft → Validated → Approved.

**Rationale:** Applied / Rejected / Archived require embedded mode or a multi-package archival workflow. Both are v2 concerns.

**v2 readiness:** the Change State enum already includes all v0.1 states; v1 simply does not transition into the deferred ones.

## 16. Inline Code Generation

**Deferred.**

**Rationale:** v0.1 suggests possible code-skeleton outputs in later versions. v1's AI-Agent Brief is text-only; it instructs a downstream coding agent rather than emitting code itself. Code generation requires committing to a target framework / pattern set (React component shape, Tailwind classes vs CSS-in-JS, naming conventions) that is best left to the downstream agent.

**v2 readiness:** `src/core/export/` accepts new exporters; a code-gen exporter is one such addition.

## 17. Network Calls / Cloud Sync

**Deferred forever (in scope spirit).**

**Rationale:** v1 commits to filesystem-local operation as a security and simplicity property. Any future cloud sync would be a separate project, not a v2 expansion.

## 18. Telemetry

**Deferred.**

**Rationale:** v1 does not emit telemetry, metrics, or analytics. Privacy-by-default. v2 may consider opt-in telemetry for usage research but must not enable it without explicit author consent.

## 19. Internationalisation

**Deferred.**

**Rationale:** v1 is English-only. Workbench UI strings are hard-coded. Authoring packages with non-English content is supported (text props are arbitrary strings) but the workbench chrome itself is not localised.

**v2 readiness:** UI strings can be extracted to a translation table.

## 20. Plugin / Extension Surface

**Deferred.**

**Rationale:** v1 does not expose hooks for third-party extensions to the workbench. The Host-App Adapter is the only extension point, and that targets host-app integration, not workbench feature extension.

**v2 readiness:** future plugin surface would extend `src/core/` exports; the Workbench Core's pure-function shape makes this clean.

---

## Cross-reference

The complete v1 scope is in [01_scope.md](01_scope.md). The complete v1 build sequence is in [10_build_phases.md](10_build_phases.md). Anything not in either of those, and not listed here, has not been considered — surface it to the human author rather than improvise.
