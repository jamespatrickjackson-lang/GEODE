# GUI Workbench
## Use-Case + User Roles Brief

**Document status:** v0.1 working draft  
**Purpose:** Define who the GUI Workbench is for, what each user group needs, and the major use cases the system should support.

---

# 1. Purpose

The GUI Workbench is intended for more than one user type.

This document defines likely users, their needs, and the use cases the workbench should support.

The goal is to prevent the product from being designed only for one perspective, such as developer convenience, visual design, or GOC-specific needs.

The workbench should support a broader product pattern:

```text
people with interface intent
→ structured GUI creation
→ validation
→ documentation
→ implementation or embedded refinement
```

---

# 2. Primary User Groups

The GUI Workbench should serve:

1. Software developers
2. Designers and UX contributors
3. Product leads and technical founders
4. Domain experts
5. AI-assisted development teams
6. Embedded app administrators or internal editors
7. GOC-specific project users
8. Future non-GOC software teams

---

# 3. Software Developers

## 3.1 Role

Developers implement final app interfaces, integrate GUI definitions, maintain code quality, and protect core app logic.

## 3.2 Developer Problems

Developers often receive GUI requests that are:

- vague
- visual but not implementation-ready
- missing states
- missing edge cases
- missing device assumptions
- missing interaction assumptions
- missing acceptance criteria
- too broad for AI-agent delegation
- unclear about what should not change

## 3.3 What Developers Need

Developers need:

- clear panel/component hierarchy
- precise control list
- layout intent
- state expectations
- validation findings
- implementation constraints
- app no-touch boundaries
- reusable component mappings
- AI-agent briefs with boundaries
- versionable package outputs

## 3.4 Developer Use Cases

### Receive an Implementation Brief

A developer receives a workbench-generated brief describing a panel, its components, behaviours, validation findings, and implementation constraints.

### Map GUI Package to App Components

A developer uses the host-app adapter to map workbench components to actual app components.

### Review Safe GUI Changes

A developer reviews embedded-workbench changes before they are promoted to an app default.

### Prepare AI-Agent Task

A developer uses the AI-agent brief to delegate a tightly scoped GUI implementation task.

---

# 4. Designers and UX Contributors

## 4.1 Role

Designers and UX contributors shape interface structure, readability, interaction patterns, visual hierarchy, and usability.

## 4.2 Designer Problems

Designers may struggle when:

- mockups do not translate well into implementation
- design tools are too broad or detached from app logic
- device-specific constraints are not visible early
- validation is informal
- reusable panel patterns are not documented
- app-specific GUI surfaces are hard to update after release

## 4.3 What Designers Need

Designers need:

- guided GUI creation
- visual editing
- reusable components
- reusable container archetypes
- device/display previews
- input-method previews
- background stress testing
- validation findings
- project override controls
- documentation exports

## 4.4 Designer Use Cases

### Create a Panel from an Archetype

A designer selects a container archetype and modifies it visually.

### Test Device Fit

A designer previews the same panel on desktop, tablet, boardroom TV, and large touchscreen profiles.

### Validate Against Touch Constraints

A designer checks whether buttons, sliders, spacing, and edge clearance are suitable for touch use.

### Refine an Existing App Surface

A designer uses embedded mode to tune safe GUI surfaces inside an existing app.

---

# 5. Product Leads and Technical Founders

## 5.1 Role

Product leads and founders define product intent, workflows, stakeholder value, and interface priorities.

## 5.2 Product Problems

Product leads often need to:

- test ideas before committing engineering effort
- communicate interface concepts to developers
- convert stakeholder needs into GUI structures
- run quick iterations
- capture rationale
- avoid overbuilding
- prepare user-testing material
- prevent design intent from being lost

## 5.3 What Product Leads Need

Product leads need:

- simple guided creation
- non-code interface shaping
- quick previewing
- rationale capture
- validation warnings
- documentation generation
- project-specific overrides
- clear handoff material

## 5.4 Product Lead Use Cases

### Turn a Rough Tool Idea into a Panel

A product lead describes a tool panel and uses the wizard to create a first draft.

### Create a Stakeholder Presentation Mode

A product lead defines a simplified interface mode for client, investor, or boardroom review.

### Generate a Product/Implementation Brief

A product lead exports a human-readable GUI specification and AI-agent brief.

---

# 6. Domain Experts

## 6.1 Role

Domain experts understand the subject matter better than the software interface.

In GOC, domain experts may include people with expertise in:

- geology
- mining
- geophysics
- drillhole data
- exploration workflows
- investor communication
- regulatory/stakeholder communication
- field review

## 6.2 Domain Expert Problems

Domain experts may know what a tool needs to do but may not know how to specify a GUI.

They may struggle with:

- expressing interface needs in developer language
- choosing the right control types
- understanding device constraints
- translating domain workflow into panel structure
- reviewing static mockups
- describing what should be visible in presentation mode versus technical mode

## 6.3 What Domain Experts Need

Domain experts need:

- guided questions
- plain-language options
- domain-relevant container archetypes
- quick previews
- ability to annotate intent
- ability to describe data/control needs
- validation that catches obvious usability issues
- documentation that developers can act on

## 6.4 Domain Expert Use Cases

### Define a Seismic Tool Panel

A geophysics-aware user selects a seismic container archetype and identifies the required controls.

### Define a Drillhole Inspector

A domain expert specifies what information should appear for a selected drillhole.

### Review a Project-Specific Presentation Layout

A domain expert checks whether a stakeholder-facing panel shows the right controls and hides unnecessary technical clutter.

---

# 7. AI-Assisted Development Teams

## 7.1 Role

AI-assisted development teams use AI coding agents to help implement software changes.

## 7.2 AI-Agent Problems

AI agents can fail when prompts are:

- too vague
- too broad
- missing constraints
- missing target files
- missing acceptance criteria
- missing no-touch areas
- missing interface rationale
- disconnected from validation findings

## 7.3 What AI-Assisted Teams Need

They need:

- tightly scoped AI-agent briefs
- explicit target surfaces
- clear acceptance criteria
- explicit no-touch areas
- validation findings
- component hierarchy
- state assumptions
- implementation constraints

## 7.4 AI-Assisted Team Use Cases

### Generate an AI-Agent Brief

The workbench exports a constrained brief for an AI coding agent.

### Prevent Broad Code Changes

The generated brief explicitly states what should not be modified.

### Attach Validation Findings to Implementation

The AI-agent task includes unresolved warnings and acceptance expectations.

---

# 8. Embedded App Administrators / Internal Editors

## 8.1 Role

These users manage safe GUI settings inside a host application.

They may not be developers.

## 8.2 Problems

Released applications often need small interface refinements that do not justify full development cycles.

Examples:

- renaming labels
- changing panel order
- hiding/showing optional controls
- changing project defaults
- adjusting presentation mode
- changing spacing or density
- saving project-specific views

## 8.3 What They Need

They need:

- safe embedded editing
- permission controls
- draft/apply workflow
- validation before saving
- project override support
- change logs
- ability to revert
- clear boundaries

## 8.4 Embedded Editor Use Cases

### Adjust a Project Override

An internal editor changes panel defaults for a specific project without changing the base app.

### Tune Presentation Mode

An internal editor simplifies the interface for boardroom use.

### Save a Draft Change

An editor saves changes as a draft for later review.

---

# 9. GOC-Specific Users

## 9.1 GOC Technical Builder

Uses the workbench to create and refine technical panels for app development.

Needs:

- component structure
- validation
- implementation handoff
- background testing over geology/terrain scenes

## 9.2 GOC Domain Reviewer

Uses the workbench to check whether a panel supports a real mining/geoscience workflow.

Needs:

- plain-language panel structure
- domain-specific archetypes
- preview context
- rationale fields

## 9.3 GOC Presentation Builder

Uses the workbench to shape stakeholder-facing GUI modes.

Needs:

- boardroom display preview
- projector preview
- simplified controls
- large text/contrast checks
- presentation mode presets

## 9.4 GOC Project Configurator

Uses the workbench to define project-specific variants.

Examples:

- Woodjam
- Bingham Canyon
- Utah FORGE
- Kliyul

Needs:

- project override support
- clear distinction between base and project-specific settings
- change traceability

---

# 10. Future Non-GOC Users

The workbench should eventually be useful outside GOC.

Potential users:

- technical visualization products
- engineering software teams
- scientific software teams
- internal tools teams
- dashboard-heavy applications
- B2B software teams
- open-source app developers
- AI-assisted development workflows

Future users need:

- generic component library
- app-agnostic package format
- adapter model
- clear documentation
- host-app integration boundaries
- validation rule packs

---

# 11. Major Use-Case Categories

## 11.1 Greenfield GUI Concepting

A team creates a new app interface or panel before implementation.

## 11.2 Existing Product Refinement

A team imports or reconstructs an existing GUI surface and improves it.

## 11.3 Embedded App Editing

A host app exposes safe GUI surfaces for internal editing.

## 11.4 Project-Specific Overrides

A base GUI system is adapted for a specific project, client, dataset, or presentation need.

## 11.5 Device/Display Validation

A GUI is checked against phone, tablet, desktop, projector, large touchscreen, and boardroom profiles.

## 11.6 Input-Method Validation

A GUI is checked against mouse, trackpad, touch, stylus, keyboard, or remote control assumptions.

## 11.7 Background Stress Testing

Panels and controls are checked over simple, complex, noisy, moving, or domain-specific backgrounds.

## 11.8 AI-Agent Handoff

A structured GUI design is converted into a constrained brief for an AI coding agent.

## 11.9 Documentation Generation

The workbench creates human-readable specifications, validation reports, and test scaffolds.

---

# 12. User Role Matrix

| User Role | Primary Need | Main Workbench Value |
|---|---|---|
| Developer | Clear implementation intent | Specs, mappings, validation, no-touch boundaries |
| Designer / UX | Realistic GUI shaping | Visual editing, previews, reusable components |
| Product Lead | Fast concept-to-brief loop | Wizard, rationale, documentation, validation |
| Domain Expert | Shape domain workflows | Archetypes, plain-language structure, previews |
| AI-Assisted Team | Safer coding prompts | AI-agent briefs, acceptance criteria, constraints |
| Embedded Editor | Safe app refinement | Permissioned editing, drafts, overrides, validation |
| GOC User | Mining/geoscience GUI control | Domain panels, project overrides, background testing |
| Future App Team | Portable GUI system | Core, packages, adapters, validation model |

---

# 13. Priority Needs

Across user groups, the highest-priority needs are:

1. Create usable GUI structures without starting from raw code.
2. Preserve interface intent in a structured form.
3. Validate against real device, input, and use-case conditions.
4. Generate useful documentation.
5. Support safe embedded editing.
6. Support project-specific overrides.
7. Produce constrained AI-agent briefs.
8. Keep the core portable beyond GOC.

---

# 14. Summary

The GUI Workbench should serve as a shared bridge between:

- product intent
- domain knowledge
- design structure
- validation
- developer implementation
- AI-agent handoff
- embedded product refinement

Its strongest value emerges when non-developers can define useful interface structures and developers receive clear, validated, implementation-ready intent.
