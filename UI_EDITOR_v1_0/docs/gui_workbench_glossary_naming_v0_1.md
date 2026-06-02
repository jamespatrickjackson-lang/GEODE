# GUI Workbench
## Glossary + Naming Convention

**Document status:** v0.1 working draft  
**Purpose:** Establish shared language for the GUI Workbench project so future product, architecture, design, validation, and implementation discussions use consistent terms.

---

# 1. Purpose

The GUI Workbench needs stable language before detailed planning begins.

This glossary defines core terms, naming conventions, and conceptual boundaries for the project.

The purpose is to prevent drift between:

- product intent
- architecture language
- design language
- validation language
- app-integration language
- AI-agent handoff language
- GOC-specific usage
- future portable/open-source usage

Terms may evolve, but changes should be deliberate.

---

# 2. Working Product Name

## 2.1 Current Default Name

**GUI Workbench**

Plain, descriptive, and broad enough to cover standalone and embedded use.

## 2.2 Alternate Names

- **Interface Workbench** — broader and more polished, but less specific.
- **Panel Foundry** — strong product-style name, especially for panel/container creation.
- **UI Foundry** — good if the product moves toward reusable interface manufacturing.
- **Design System Workbench** — technically accurate, but more formal/enterprise.

## 2.3 Naming Recommendation

Use **GUI Workbench** internally until product identity is clearer.

---

# 3. Core Terms

## GUI Workbench

A portable and embeddable interface-authoring system for creating, validating, documenting, and exporting application GUI structures.

It can run as:

- a standalone design and validation bench
- an embedded in-app GUI editing module

It focuses on application interface structures, not application business logic or domain data.

## Workbench Core

The shared engine behind the GUI Workbench.

It owns reusable concepts:

- schema system
- design tokens
- components
- panels
- containers
- profiles
- validation rules
- package structure
- documentation generation
- preview state

The Workbench Core should remain app-agnostic.

## Standalone Shell

A complete external version of the GUI Workbench that runs independently of any host app.

Used for early concepting, GUI prototyping, validation, documentation, AI-agent handoff generation, and package export.

## Embedded Shell

An in-app version of the GUI Workbench.

It runs inside a host application and allows safe GUI surfaces to be edited, previewed, validated, and saved from within the product.

The Embedded Shell must operate through a Host-App Adapter.

## Host-App Adapter

The bridge between the generic GUI Workbench and a specific application.

The adapter defines:

- editable GUI surfaces
- locked GUI surfaces
- available components
- available tokens
- component mappings
- save/apply rules
- permissions
- validation rules

The adapter prevents the workbench from becoming an uncontrolled app mutation surface.

## GOC Adapter

The host-app adapter for GOC.

It maps generic GUI Workbench concepts to GOC-specific interface surfaces, components, project overrides, and validation rules.

## GUI Package

A portable package created or consumed by the workbench.

It may contain:

- manifest
- design tokens
- components
- panels
- containers
- use-case profiles
- device/display profiles
- input profiles
- validation rules
- validation reports
- project overrides
- documentation
- AI-agent briefs
- reference assets

A GUI Package is the main transfer object between standalone mode, embedded mode, documentation, and implementation handoff.

## GUI Project

A working project inside the workbench.

It may represent:

- a standalone prototype
- an app-specific panel design
- a project override
- a draft interface exploration
- a GUI package being edited
- a host-app-exposed interface surface

## Design Token

A reusable interface variable.

Examples:

- font size
- spacing
- colour
- panel width
- button height
- border radius
- opacity
- icon size
- control gap
- touch target minimum
- safe-area margin

## Component

A reusable GUI element.

Examples:

- button
- slider
- toggle
- dropdown
- tab
- text input
- number input
- status badge
- warning message
- collapsible section

## Component Variant

A named variation of a component.

Example button variants:

- primary
- secondary
- danger
- ghost
- disabled

## Component State

A condition a component may appear in.

Examples:

- default
- hover
- pressed
- focused
- disabled
- loading
- warning
- error
- active
- selected

## Container

A structured grouping region for GUI components.

Examples:

- vertical stack
- horizontal stack
- grid
- scrollable region
- collapsible group
- toolbar group
- split region

## Panel

A higher-level interface surface composed of containers and components.

Examples:

- Layer Control Panel
- Lighting Control Panel
- Object Inspector
- Data Import Panel
- Presentation Control Panel

## Container Archetype

A reusable starting template for a common interface structure.

Examples:

- layer control container
- tool panel
- inspector panel
- presentation control panel
- data import container
- overlay controller

An archetype is a strong starting point, not a final fixed design.

## Safe Edit Surface

A GUI area or property that the host app allows the embedded workbench to modify.

Examples:

- label text
- spacing
- panel width
- section order
- component variant
- collapsed default
- project-specific visibility
- theme token

## Restricted Surface

A GUI or app area that the workbench must not modify unless explicitly exposed by the host app.

Examples:

- data pipeline logic
- renderer logic
- permissions
- security logic
- destructive behaviour
- state architecture
- authentication
- external integrations

## Project Override

A project-specific variation on a base GUI system.

A project override changes selected interface details without mutating the base standard.

## Base GUI System

The default design system or interface standard from which app/project variants inherit.

Project overrides should not silently mutate the base system.

## Use-Case Profile

A profile describing how the interface will be used.

Examples:

- technical editing
- field review
- client presentation
- boardroom walkthrough
- data import
- public/community explanation

## Device / Display Profile

A profile describing where the interface will be displayed.

Examples:

- phone
- tablet
- laptop
- desktop monitor
- large touchscreen
- boardroom TV
- projector
- ultrawide monitor

## Input Method Profile

A profile describing how users interact with the interface.

Examples:

- mouse
- trackpad
- touch
- stylus
- keyboard
- presentation remote
- mixed input

## Validation Rule

A deterministic rule that checks a measurable GUI condition.

Examples:

- minimum touch target size
- minimum edge clearance
- minimum font size
- contrast threshold
- panel overflow
- hover dependency warning
- destructive action confirmation requirement

## Validation Rule Pack

A grouped set of validation rules associated with a device, display, input method, use case, host app, or project type.

## Validation Finding

A validation result produced by the workbench.

It should include:

- severity
- affected object
- rule reference
- message
- current condition
- recommended correction
- applicable profile
- resolved/unresolved state

## Severity Level

Recommended levels:

- Info
- Suggestion
- Warning
- Error
- Blocker

## AI-Assisted Review

An optional advisory layer where AI critiques GUI structure, density, hierarchy, clarity, use-case fit, terminology, or implementation handoff.

AI-assisted review should not replace deterministic validation.

## Background Stress Test

A preview condition that tests GUI readability over different visual backgrounds.

Examples:

- terrain
- satellite imagery
- geology visualization
- high-detail technical image
- stripe pattern
- noisy image
- low-contrast background
- moving background

## Implementation Brief

A human-readable document explaining how a GUI structure should be implemented.

## AI-Agent Brief

A constrained implementation brief intended for an AI coding agent.

It should define:

- what to build
- where to build it
- what not to touch
- required controls
- acceptance criteria
- relevant validation findings

---

# 4. Naming Conventions

## 4.1 Document Naming

Use lowercase snake case.

Pattern:

```text
gui_workbench_[document_name]_v0_1.md
```

Examples:

```text
gui_workbench_project_outline_foundation_v0_1.md
gui_workbench_prd_architecture_v0_1.md
gui_workbench_glossary_naming_v0_1.md
```

## 4.2 Package Naming

Pattern:

```text
[project]_[surface_or_scope]_gui_package_v[version]
```

Examples:

```text
goc_lighting_panel_gui_package_v0_1
goc_layer_controls_gui_package_v0_1
woodjam_presentation_gui_override_v0_1
```

## 4.3 Object ID Naming

Use lowercase kebab case.

Examples:

```text
lighting-panel
layer-control-panel
sun-angle-slider
primary-action-button
boardroom-display-profile
tablet-touch-profile
```

## 4.4 Human-Facing Names

Use title case.

Examples:

```text
Lighting Control Panel
Layer Control Container
Boardroom Display Profile
Tablet Touch Profile
```

## 4.5 Validation Rule Naming

Use clear rule names.

Examples:

```text
touch-target-min-size
display-edge-clearance
font-min-boardroom
panel-overflow-check
hover-dependency-touch-warning
transparent-panel-background-readability
```

---

# 5. Preferred Language

Use:

- GUI Workbench
- host app
- host-app adapter
- safe edit surface
- restricted surface
- project override
- GUI package
- deterministic validation
- AI-assisted review
- implementation-ready interface intent

Avoid:

- full Figma
- app builder
- automatic code mutator
- AI decides
- magic importer
- live unrestricted editor

---

# 6. Summary

The most important distinctions are:

- standalone vs embedded
- generic core vs host-app adapter
- safe edit surface vs restricted surface
- deterministic validation vs AI-assisted review
- base GUI system vs project override
- GUI package vs live app implementation
