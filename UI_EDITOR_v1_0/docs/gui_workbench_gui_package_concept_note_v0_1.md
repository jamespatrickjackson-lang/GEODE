# GUI Workbench
## GUI Package Concept Note

**Document status:** v0.1 working draft  
**Purpose:** Define the conceptual role of a GUI Package before detailed schema or implementation planning begins.

---

# 1. Purpose

The GUI Package is the portable object produced, edited, imported, exported, or consumed by the GUI Workbench.

This document defines what a GUI Package is, what it is not, what it should contain, how it travels between standalone and embedded modes, and how it supports documentation, validation, AI-agent handoff, and project overrides.

This is not yet a technical schema.

It is a concept note.

---

# 2. Definition

A **GUI Package** is a portable representation of interface intent.

It captures the structured definition of application GUI surfaces such as:

- panels
- containers
- components
- controls
- design tokens
- use-case profiles
- device/display profiles
- input profiles
- validation rules
- validation findings
- project overrides
- documentation outputs
- reference assets

A GUI Package can be used as:

- a standalone workbench file
- an implementation handoff artifact
- a host-app import package
- a project-specific override
- a validation record
- an AI-agent context package
- a documentation bundle
- a versionable interface snapshot

---

# 3. What the GUI Package Is

The GUI Package is:

- portable
- inspectable
- versionable
- structured
- documentation-friendly
- validation-aware
- app-adapter compatible
- useful in standalone and embedded workflows

It is a way of carrying GUI intent between people, tools, apps, and agents.

---

# 4. What the GUI Package Is Not

The GUI Package is not:

- the full app
- the renderer
- the data pipeline
- the business logic
- the permission system
- the authentication system
- an unrestricted code patch
- a guarantee that the host app can consume every field
- a replacement for host-app implementation
- a magical import format that works without an adapter

A GUI Package describes interface intent. The host app decides what it can safely consume.

---

# 5. Why It Matters

The package solves a recurring problem:

Interface intent is often trapped in conversation, screenshots, mockups, or code.

The GUI Package makes that intent portable and structured.

It allows:

- early GUI work before coding
- documentation without rewriting the interface manually
- validation reports tied to actual interface structure
- AI-agent handoffs with better context
- project-specific GUI overrides
- standalone-to-embedded transfer
- embedded-to-standalone export
- host-app-specific adapter mapping
- version control of interface changes

---

# 6. Core Contents

A GUI Package may include the following categories.

## 6.1 Manifest

The manifest identifies the package.

It may include:

- package name
- package version
- created date
- author/tool
- target app
- target project
- compatibility notes
- package type
- schema version
- validation status

## 6.2 Design Tokens

Reusable interface variables:

- typography
- spacing
- colour
- panel width
- button height
- slider dimensions
- opacity
- shadows
- border radius
- icon size
- safe-area spacing
- touch target minimums

## 6.3 Components

Reusable GUI elements:

- buttons
- sliders
- toggles
- dropdowns
- text inputs
- tabs
- badges
- headers
- warnings
- control groups

Each component may include:

- type
- variant
- state
- label
- size
- rationale
- validation tags
- implementation notes

## 6.4 Containers and Panels

Higher-level interface structures:

- panel name
- panel role
- layout structure
- section order
- component hierarchy
- width/height assumptions
- stacking behaviour
- scroll behaviour
- collapsed/expanded defaults
- responsive behaviour
- rationale

## 6.5 Profiles

Profiles describe the context in which the GUI must work.

Profile types:

- use-case profiles
- device/display profiles
- input method profiles
- mode profiles
- project profiles

## 6.6 Validation Rules and Findings

The package may contain:

- selected rule packs
- validation settings
- validation findings
- severity levels
- unresolved warnings
- validation timestamp
- validation result summary

## 6.7 Project Overrides

Project-specific changes layered over a base GUI system.

Examples:

- visible tools
- panel defaults
- terminology
- presentation mode settings
- project-specific screen profiles
- stakeholder-facing simplifications

## 6.8 Assets

Assets may include:

- reference screenshots
- preview backgrounds
- background stress-test images
- reference videos
- thumbnails
- preview exports

Assets should support interface testing, not become hidden application dependencies.

## 6.9 Documentation Outputs

Generated documentation may include:

- GUI specification
- validation report
- implementation brief
- AI-agent brief
- user-testing scaffold
- change log
- project override summary

---

# 7. Package Modes

A GUI Package may appear in different modes.

## 7.1 Draft Package

An active work-in-progress package.

Not approved.

May contain unresolved validation issues.

## 7.2 Validated Package

A package that has completed validation.

May still contain acknowledged warnings.

## 7.3 Implementation Handoff Package

A package prepared for developers or AI coding agents.

Includes specification, component hierarchy, and implementation constraints.

## 7.4 Host-App Import Package

A package intended for a specific app adapter.

Should declare host compatibility.

## 7.5 Project Override Package

A package that modifies project-specific GUI defaults without mutating the base design system.

## 7.6 Archive Package

A preserved snapshot for traceability, versioning, or rollback.

---

# 8. Standalone Workflow

In standalone mode, a GUI Package may be created before any host app integration.

Typical flow:

```text
create GUI project
→ select archetype
→ define panels/components
→ select profiles
→ run validation
→ export GUI package
→ hand to developer/app/agent
```

The package acts as a bridge from concept to implementation.

---

# 9. Embedded Workflow

In embedded mode, the host app may load or produce GUI Packages.

Typical flow:

```text
host app exposes editable surfaces
→ workbench edits safe GUI surfaces
→ validation runs
→ package or override is saved
→ host app applies allowed changes
→ change log is recorded
```

The package may represent:

- a draft
- a project override
- an approved applied change
- an exportable snapshot

---

# 10. Package and Host-App Adapter Relationship

A GUI Package is generic.

A host app is specific.

The Host-App Adapter determines which package fields the app can use.

The adapter maps:

```text
generic component intent
→ host app component implementation
```

Example:

```text
workbench primary button
→ GOC Button component with variant="primary"
```

The package should not assume all host apps support all fields.

Compatibility should be explicit.

---

# 11. Compatibility

A GUI Package should declare compatibility information.

Possible compatibility fields:

- package schema version
- workbench version
- target app
- target app adapter version
- required component set
- required validation rule packs
- required asset support
- unsupported features
- migration notes

This prevents accidental import into an incompatible app.

---

# 12. Documentation Role

The GUI Package should be able to generate documentation.

Documentation should not be a separate manual artifact disconnected from the GUI structure.

Documentation should derive from structured package data wherever possible.

This supports:

- consistency
- auditability
- version control
- AI-agent handoff
- implementation clarity
- validation traceability

---

# 13. AI-Agent Handoff Role

The GUI Package can provide structured context for an AI coding agent.

The AI-agent brief should include:

- target app
- target surface
- component hierarchy
- required controls
- layout rules
- state assumptions
- validation findings
- acceptance criteria
- no-touch areas
- implementation notes

The package should help avoid broad, vague prompts.

---

# 14. Validation Role

The GUI Package should carry validation context.

This includes:

- selected use cases
- selected device/display profiles
- selected input methods
- rule packs used
- findings
- severity
- unresolved issues
- acknowledged warnings

Validation should travel with the interface intent.

---

# 15. Project Override Role

A GUI Package can act as a project override.

In this mode, it does not replace the base GUI system.

It layers specific changes over the base.

Example:

```text
Base GUI System
→ GOC Default
→ Woodjam Project Override
```

Overrides should be explicit and reversible.

---

# 16. Version Control

The GUI Package should be easy to track in source control.

Desirable properties:

- human-readable where practical
- structured
- stable ordering
- clear version metadata
- explicit change records
- no hidden binary-only state unless necessary
- assets stored in predictable folders

---

# 17. Package Boundaries

A GUI Package should not contain secrets or sensitive runtime state.

Avoid including:

- API keys
- credentials
- private tokens
- user authentication state
- hidden app state
- confidential datasets unless deliberately attached as reference material
- executable code that mutates the host app directly

The package should remain an interface artifact.

---

# 18. Open Questions

1. Should the package be folder-based, single-file, or both?
2. Should JSON, YAML, or another format be primary?
3. How strict should schema validation be in early versions?
4. How should assets be stored and referenced?
5. How should package compatibility be declared?
6. How should project overrides be represented?
7. How should host-app-specific fields be namespaced?
8. How should change history be stored?
9. Should documentation be stored inside the package or generated on export?
10. How should AI-agent briefs be linked to package objects?

---

# 19. Summary

The GUI Package is the portable object that carries interface intent.

It should support:

- standalone design
- embedded editing
- validation
- documentation
- project overrides
- app-adapter integration
- implementation handoff
- AI-agent briefing
- version control

It should describe GUI structure without pretending to own the whole app.
