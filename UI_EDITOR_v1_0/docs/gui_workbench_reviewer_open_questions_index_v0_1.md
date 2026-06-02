# GUI Workbench
## Reviewer Open Questions Index

**Document status:** v0.1 working draft  
**Purpose:** Provide a single review point for unresolved questions, with context and references to the relevant project documents.

---

# 1. Purpose

This document centralizes unresolved questions for reviewer input.

It is intended to help a reviewer understand:

- what is unresolved
- why it matters
- where the question appears in the document set
- what kind of answer is needed
- whether the answer affects product definition, architecture, validation, embedded use, GOC scope, or future planning

This document should be used as the single open-question review index before moving into detailed build planning.

---

# 2. Source Document References

The current supporting document set is:

| Reference ID | Document |
|---|---|
| FOUNDATION | `gui_workbench_project_outline_foundation_v0_1.md` |
| PRD-ARCH | `gui_workbench_prd_architecture_v0_1.md` |
| GLOSSARY | `gui_workbench_glossary_naming_v0_1.md` |
| USERS | `gui_workbench_use_cases_user_roles_v0_1.md` |
| BOUNDARY | `gui_workbench_safe_editing_boundary_charter_v0_1.md` |
| PACKAGE | `gui_workbench_gui_package_concept_note_v0_1.md` |
| VALIDATION | `gui_workbench_validation_philosophy_v0_1.md` |
| GOC-CONTEXT | `gui_workbench_goc_first_context_brief_v0_1.md` |
| QUESTIONS | `gui_workbench_reviewer_open_questions_index_v0_1.md` |

---

# 3. Review Priority Legend

| Priority | Meaning |
|---|---|
| P0 | Must resolve before build planning |
| P1 | Should resolve before architecture planning |
| P2 | Can remain open through early concept planning |
| P3 | Later product/implementation decision |

---

# 4. Open Questions

---

## Q-001: What is the product name for internal use?

**Question:** Should the project continue as **GUI Workbench**, or should it shift to **Interface Workbench**, **Panel Foundry**, or another name?

**Context:** The current default is GUI Workbench because it is plain and descriptive. Alternate names may better support future open-source/product identity.

**Why it matters:** Naming affects documentation, repo structure, future public positioning, and conceptual clarity.

**References:** GLOSSARY Section 2; FOUNDATION Summary; PRD-ARCH Product Statement.

**Priority:** P2

**Reviewer input needed:** Confirm internal name for now; optionally flag preferred external/product name.

---

## Q-002: What should the public identity emphasize?

**Question:** Should the public framing emphasize design-system workbench, GUI authoring, embedded app editing, validation, or AI-agent handoff?

**Context:** The project has multiple values. Public positioning may need one lead idea.

**Why it matters:** A broad description may be accurate but weak. A narrow description may overconstrain the concept.

**References:** FOUNDATION Sections 3–6; PRD-ARCH Product Thesis; GLOSSARY Preferred Language.

**Priority:** P2

**Reviewer input needed:** Choose lead framing and secondary supporting claims.

---

## Q-003: What is the boundary between standalone and embedded modes?

**Question:** Are standalone and embedded modes equally first-class, or should one be treated as primary?

**Context:** The user clarified that both matter. Standalone supports concept/design/export. Embedded supports live app refinement.

**Why it matters:** This affects architecture, package design, permission model, and adapter design.

**References:** FOUNDATION Sections 8–9; PRD-ARCH Deployment Modes; BOUNDARY Entire Document.

**Priority:** P0

**Reviewer input needed:** Confirm both modes are first-class and identify any asymmetry in priority.

---

## Q-004: What should the host-app adapter be responsible for?

**Question:** What responsibilities belong to the generic workbench core versus the host-app adapter?

**Context:** The adapter is the boundary between portable core and specific apps such as GOC.

**Why it matters:** Poor separation will either overfit the core to GOC or make embedded mode unsafe.

**References:** GLOSSARY Host-App Adapter; BOUNDARY Sections 3, 11, 12; PACKAGE Section 10; GOC-CONTEXT Section 13.

**Priority:** P0

**Reviewer input needed:** Confirm adapter responsibilities and no-touch boundary.

---

## Q-005: Which GUI surfaces should GOC expose first?

**Question:** Which GOC surfaces are the strongest initial candidates for embedded or standalone workbench definition?

**Context:** Candidate surfaces include layer controls, lighting controls, camera/navigation, data import, map overlays, drillhole inspector, seismic/geophysical tool containers, and presentation controls.

**Why it matters:** Surface selection affects first proof of value and reviewer focus.

**References:** GOC-CONTEXT Sections 5–6; FOUNDATION GOC Context; USERS GOC-Specific Users.

**Priority:** P1

**Reviewer input needed:** Rank the first 3–5 GOC GUI surfaces.

---

## Q-006: What should remain permanently locked from embedded editing?

**Question:** Which app surfaces should never be editable by the embedded GUI Workbench?

**Context:** Proposed no-touch areas include renderer internals, data pipelines, permissions, destructive behaviour, authentication, state architecture, and external integrations.

**Why it matters:** This is central to safety and trust in embedded mode.

**References:** BOUNDARY Sections 5, 13; GOC-CONTEXT Section 7; PRD-ARCH Safe Editing Boundaries.

**Priority:** P0

**Reviewer input needed:** Confirm locked areas and add missing no-touch categories.

---

## Q-007: What is the first formal definition of a GUI Package?

**Question:** Should the GUI Package be treated as a folder, a single file, or both?

**Context:** The package concept is defined, but not the technical format.

**Why it matters:** Package shape affects version control, portability, embedded import/export, asset handling, and documentation generation.

**References:** PACKAGE Entire Document; PRD-ARCH GUI Package Format; GLOSSARY GUI Package.

**Priority:** P1

**Reviewer input needed:** Choose preferred package concept direction or defer to later schema work.

---

## Q-008: Should package data be JSON, YAML, or another format?

**Question:** What primary human-readable structure should GUI Packages use?

**Context:** JSON is strict and tooling-friendly. YAML is readable but can be ambiguous. Other formats may be possible later.

**Why it matters:** This affects validation, source control, AI-agent readability, and app adapter implementation.

**References:** PACKAGE Sections 16, 18; PRD-ARCH Output Requirements.

**Priority:** P2

**Reviewer input needed:** Provide preferred default or constraints.

---

## Q-009: How should package compatibility be declared?

**Question:** How should a GUI Package declare compatibility with a host app and adapter?

**Context:** A package may be generic, but host apps may not support all fields.

**Why it matters:** Prevents accidental import into incompatible app versions.

**References:** PACKAGE Sections 10–11; PRD-ARCH Architecture; BOUNDARY Host-App Responsibilities.

**Priority:** P1

**Reviewer input needed:** Identify minimum compatibility metadata.

---

## Q-010: What validation rule packs should exist first?

**Question:** Which validation rule packs should be defined first?

**Context:** Candidate profile-driven packs include desktop, tablet, large touchscreen, boardroom/projector, touch input, and background readability.

**Why it matters:** Validation is one of the product’s core differentiators.

**References:** VALIDATION Sections 4, 8–12, 20; GOC-CONTEXT Sections 8–10; PRD-ARCH Validation Requirements.

**Priority:** P1

**Reviewer input needed:** Select first validation profiles and rule-pack categories.

---

## Q-011: What values should be used for touch target, font, contrast, and edge clearance?

**Question:** What measurable thresholds should deterministic validation use?

**Context:** The documents define validation philosophy but not numeric thresholds.

**Why it matters:** Rule-based validation needs concrete values or at least configurable defaults.

**References:** VALIDATION Sections 4, 7, 8, 10, 11; PRD-ARCH Validation Requirements.

**Priority:** P2

**Reviewer input needed:** Decide whether thresholds are fixed, configurable, profile-based, or deferred.

---

## Q-012: How should contrast/readability be handled over complex backgrounds?

**Question:** Should background readability validation be manual, automated, or hybrid?

**Context:** GOC panels may appear over terrain, maps, satellite imagery, geology overlays, and moving scenes.

**Why it matters:** Plain contrast checks may not catch real readability failures over complex backgrounds.

**References:** VALIDATION Section 12; GOC-CONTEXT Section 10; FOUNDATION Background Stress Testing.

**Priority:** P1

**Reviewer input needed:** Decide whether early validation is visual/manual, rule-based, or mixed.

---

## Q-013: What is the role of AI review?

**Question:** Where should AI-assisted review sit in the product?

**Context:** Current principle: deterministic validation first, AI review second, human judgement final.

**Why it matters:** Prevents AI critique from being mistaken for rule-based validation or final judgement.

**References:** VALIDATION Sections 2, 5, 18–19; BOUNDARY Section 10; PRD-ARCH AI Architecture Boundary.

**Priority:** P0

**Reviewer input needed:** Confirm AI review is advisory only and identify allowed AI outputs.

---

## Q-014: How should AI-agent briefs be constrained?

**Question:** What minimum information must be included in AI-agent briefs to prevent broad or unrelated implementation changes?

**Context:** AI-agent handoff is a key use case but requires boundaries.

**Why it matters:** Poorly scoped AI-agent briefs can damage unrelated code or miss intent.

**References:** USERS Section 7; PACKAGE Section 13; BOUNDARY AI Review Boundary; FOUNDATION Output System.

**Priority:** P1

**Reviewer input needed:** Define required AI-agent brief sections and no-touch language.

---

## Q-015: What permission levels are required in embedded mode?

**Question:** Which permission levels should embedded mode support?

**Context:** Proposed levels include view only, draft only, save project override, apply to current project, promote to app default, edit base design system, export package, and run AI review.

**Why it matters:** Permission structure controls embedded safety.

**References:** BOUNDARY Section 6; PRD-ARCH Embedded Permission Model.

**Priority:** P1

**Reviewer input needed:** Confirm, simplify, or expand permission levels.

---

## Q-016: How should draft, validated, approved, applied, rejected, and archived states work?

**Question:** What lifecycle states should GUI changes/packages have?

**Context:** Current proposed states are Draft, Validated, Approved, Applied, Rejected, Archived.

**Why it matters:** Prevents draft experiments from being confused with approved app behaviour.

**References:** BOUNDARY Section 7; PRD-ARCH Versioning and Change Control; VALIDATION Section 15.

**Priority:** P1

**Reviewer input needed:** Confirm state model and transitions.

---

## Q-017: How should project overrides be promoted to base standards?

**Question:** What process should allow a project-specific GUI override to become part of the base system?

**Context:** Project overrides should not silently mutate base GUI standards.

**Why it matters:** This protects consistency while allowing useful patterns to be reused.

**References:** PACKAGE Section 15; BOUNDARY Section 8; GOC-CONTEXT Section 11; PRD-ARCH Project Overrides.

**Priority:** P1

**Reviewer input needed:** Define review/promotion concept or defer to governance planning.

---

## Q-018: What should imported screenshots or existing UI references become?

**Question:** Are imported screenshots treated as reference assets, semi-structured inputs, or candidates for future extraction?

**Context:** Import/inventory is important for existing products, but reverse engineering should not be overpromised.

**Why it matters:** Sets realistic expectations for import capability.

**References:** PACKAGE Sections 6.8, 18; FOUNDATION Import and Inventory; PRD-ARCH Import Architecture.

**Priority:** P2

**Reviewer input needed:** Decide initial import role.

---

## Q-019: What should be open sourced first?

**Question:** Should the open-source surface include the core, standalone shell, schemas, adapter model, example app, or all of it?

**Context:** The user is considering making the workbench open source.

**Why it matters:** Open-source boundary affects product identity, repo design, security posture, and GOC-specific separation.

**References:** FOUNDATION Introduction; PRD-ARCH Portable/Open-Source Generalization; GOC-CONTEXT Section 13.

**Priority:** P3

**Reviewer input needed:** Identify likely open-source boundary.

---

## Q-020: How should GOC avoid overfitting the workbench?

**Question:** How should GOC-specific concepts be isolated from the portable core?

**Context:** GOC is the proving ground, but the workbench should remain portable.

**Why it matters:** Overfitting to GOC could reduce broader usefulness.

**References:** GOC-CONTEXT Sections 1, 12, 13; GLOSSARY Workbench Core; PRD-ARCH Architectural Principle.

**Priority:** P0

**Reviewer input needed:** Confirm what belongs in core versus GOC adapter/example packages.

---

## Q-021: Should phone support be included, limited, or excluded early?

**Question:** Should phone be treated as a real target, review-only profile, or future profile?

**Context:** GOC may not need full editing on phone, but review/presentation use may matter.

**Why it matters:** Phone support can strongly affect layout assumptions and validation scope.

**References:** GOC-CONTEXT Sections 4, 8, 14; VALIDATION Device Profiles.

**Priority:** P2

**Reviewer input needed:** Define phone posture for GOC and generic workbench.

---

## Q-022: How should embedded mode save changes?

**Question:** Should embedded changes save as drafts, project overrides, app config, GUI packages, or all of these depending on permission?

**Context:** Embedded mode can be dangerous if save/apply behaviour is unclear.

**Why it matters:** Save model affects safety, usability, and integration.

**References:** BOUNDARY Sections 6–9; PACKAGE Embedded Workflow; PRD-ARCH Embedded Shell.

**Priority:** P0

**Reviewer input needed:** Define allowed save targets and apply conditions.

---

# 5. Reviewer Response Template

For each question, reviewer can answer using:

```text
Question ID:
Decision:
Rationale:
Impact:
Follow-up required:
Related document updates:
```

---

# 6. Summary

The highest-priority unresolved questions before build planning are:

- Q-003: standalone vs embedded priority
- Q-004: host-app adapter responsibility
- Q-006: permanently locked embedded surfaces
- Q-013: AI review boundary
- Q-020: GOC-specific vs portable core separation
- Q-022: embedded save/apply model

These should be resolved before turning the concept into detailed build plans.
