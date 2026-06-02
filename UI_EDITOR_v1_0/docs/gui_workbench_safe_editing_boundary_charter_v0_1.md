# GUI Workbench
## Safe Editing Boundary Charter

**Document status:** v0.1 working draft  
**Purpose:** Define what the embedded GUI Workbench may safely edit, what must remain locked, and how host applications should control boundaries, permissions, and change application.

---

# 1. Purpose

The GUI Workbench may run as an embedded in-app module.

Embedded mode is powerful because it allows teams to adjust and refine GUI surfaces from inside a live product.

That same power creates risk.

This charter defines the safety boundaries for embedded GUI editing.

The goal is to allow useful interface refinement without turning the workbench into an uncontrolled mutation surface.

---

# 2. Core Principle

The embedded GUI Workbench may edit **interface presentation surfaces** that the host app explicitly exposes.

It must not edit:

- core application logic
- data processing logic
- renderer behaviour
- permissions
- security boundaries
- destructive action logic
- authentication
- project file handling
- external integrations
- host app state architecture

The host app decides what is exposed. The workbench does not assume authority.

---

# 3. Boundary Model

Embedded mode requires a Host-App Adapter.

The adapter defines:

```text
editable surfaces
locked surfaces
allowed tokens
allowed components
allowed save targets
permissions
validation rules
project override rules
apply behaviour
change-log behaviour
```

The adapter is the boundary layer.

The workbench asks:

```text
What may I edit?
What must I not touch?
Where may I save changes?
Who may apply them?
What validation applies?
```

The host app answers through the adapter.

---

# 4. Safe Edit Surfaces

Safe edit surfaces are GUI properties that can usually be changed without altering core app behaviour.

## 4.1 Text and Labels

- button labels
- section titles
- panel titles
- tooltip text
- helper text
- status labels
- presentation-mode wording

## 4.2 Layout and Spacing

- padding
- gaps
- section spacing
- panel width
- container stacking
- vertical/horizontal layout
- collapsed/expanded defaults
- toolbar grouping
- section order

## 4.3 Component Presentation

- component variant
- button style
- slider display style
- icon visibility
- badge style
- warning display style
- disabled appearance
- active/selected appearance

## 4.4 Visibility of Optional Controls

- show/hide optional controls
- show/hide advanced sections
- presentation-mode simplification
- project-specific tool visibility
- stakeholder-facing view reduction

## 4.5 Theme and Tokens

- font size within allowed ranges
- panel colour
- control colour
- opacity
- border radius
- shadow
- icon size
- safe spacing tokens

## 4.6 Project-Specific Defaults

- default open/closed panels
- default visible sections
- project-specific terminology
- default presentation mode
- default layer-control visibility
- project-specific panel ordering

---

# 5. Restricted Surfaces

Restricted surfaces must remain locked unless deliberately and explicitly exposed by the host app.

## 5.1 Application Logic

- tool calculation logic
- data transformation logic
- state transitions
- business rules
- command execution logic
- save/load logic
- undo/redo logic

## 5.2 Data and Pipeline Logic

- geospatial data ingestion
- mining data processing
- seismic processing
- drillhole data transformation
- assay calculation
- file parsing
- database writes
- external data requests

## 5.3 Rendering and Scene Logic

- 3D renderer internals
- terrain rendering
- camera engine
- lighting engine internals
- geometry processing
- layer rendering pipeline
- shader logic
- performance-critical rendering logic

## 5.4 Security and Permissions

- authentication
- authorization
- user roles
- project access control
- permission checks
- security settings
- encryption
- signing or trust logic

## 5.5 Destructive Behaviour

- delete actions
- overwrite actions
- irreversible project changes
- external publishing
- file export behaviour
- destructive confirmation logic
- data purge operations

## 5.6 External Integrations

- API credentials
- cloud sync
- external data services
- analytics
- payment systems
- email integrations
- file-sharing integrations

## 5.7 Host App Architecture

- routing
- app-level state architecture
- dependency injection
- build configuration
- package configuration
- deployment configuration
- plugin security model

---

# 6. Permission Levels

Embedded mode should support permission levels.

## 6.1 View Only

User can inspect GUI structure but cannot change it.

## 6.2 Draft Only

User can make changes and save drafts, but cannot apply them to the app.

## 6.3 Save Project Override

User can save changes as a project-specific override.

## 6.4 Apply to Current Project

User can apply changes to the active project only.

## 6.5 Promote to App Default

User can promote a change from project override to app default.

This should require stronger permission or review.

## 6.6 Edit Base Design System

User can edit the base GUI system.

This should be highly restricted.

## 6.7 Export Package

User can export GUI packages, documentation, validation reports, or AI-agent briefs.

## 6.8 Run AI Review

User can request AI-assisted critique or documentation support if enabled.

---

# 7. Change States

Every meaningful embedded edit should have a state:

- Draft
- Validated
- Approved
- Applied
- Rejected
- Archived

A user should never confuse a draft GUI experiment with approved product behaviour.

---

# 8. Project Override vs Base Change

Project overrides should not silently mutate the base GUI system.

A project override may change:

- panel defaults
- section ordering
- terminology
- visible tools
- presentation mode
- project-specific display assumptions

A base change affects the wider app standard and should require stronger permission.

---

# 9. Validation Gate

Before a change is applied, the workbench should run relevant validation.

Validation may check:

- selected device profiles
- selected use cases
- input method assumptions
- component sizing
- spacing
- edge clearance
- contrast
- overflow
- background readability
- restricted-surface violations

Recommended severity handling:

| Severity | Default Handling |
|---|---|
| Info | Record only |
| Suggestion | Record only |
| Warning | Allow with acknowledgement |
| Error | Block unless override permission exists |
| Blocker | Block by default |

---

# 10. AI Review Boundary

AI-assisted review may provide critique, summaries, or implementation guidance.

AI review must not:

- override deterministic validation
- silently mark failed checks as passed
- modify host app code directly
- bypass permissions
- apply changes without user action
- redefine safe/restricted surfaces
- promote project overrides to base defaults

AI may assist with:

- explaining validation findings
- identifying density or hierarchy issues
- generating documentation
- producing AI-agent briefs
- suggesting improvements
- summarizing change rationale

---

# 11. Host-App Responsibilities

The host app must define:

- editable surfaces
- restricted surfaces
- permission levels
- allowed save targets
- app-specific validation rules
- project override behaviour
- change application behaviour
- revert behaviour
- audit/change-log destination
- component mappings
- token mappings
- package compatibility

The host app must not rely on the workbench to infer security boundaries.

---

# 12. Workbench Responsibilities

The GUI Workbench must:

- respect host-app adapter boundaries
- expose only allowed edit surfaces
- distinguish draft from applied state
- run validation before apply/export where required
- preserve change history
- generate readable reports
- preserve rationale fields
- prevent unrestricted code mutation
- distinguish deterministic validation from AI review
- make restricted-surface violations visible

---

# 13. GOC No-Touch Areas

For GOC, the following should be treated as locked unless explicitly exposed later:

- 3D renderer internals
- geological data processing
- geospatial file parsing
- project file save/load logic
- authentication or permissions
- external data integrations
- destructive project actions
- state architecture
- camera/rendering engine behaviour
- mining/geoscience calculation logic

GOC-safe surfaces may include:

- panel labels
- panel layout
- section order
- tool container layout
- button variants
- slider presentation
- default panel states
- project-specific visible controls
- presentation mode layout
- background preview settings

---

# 14. Audit and Traceability

Every applied embedded change should record:

- user
- timestamp
- project
- changed object
- previous value
- new value
- validation status
- unresolved warnings
- rationale
- approval state
- applied state

This allows changes to be reviewed, reverted, and understood later.

---

# 15. Boundary Failure Conditions

The workbench should prevent or flag:

- attempts to edit locked surfaces
- attempts to save invalid structures
- attempts to apply blocker-level findings
- attempts to promote project override to base without permission
- attempts to change destructive behaviours
- attempts to modify external integrations
- attempts to bypass host-app validation
- attempts to run AI-generated changes without review

---

# 16. Summary

The embedded GUI Workbench should be powerful but bounded.

Core boundary:

```text
GUI presentation intent: editable when exposed.
Application logic and safety-critical behaviour: locked by default.
```

The Host-App Adapter defines the boundary.

The workbench respects the boundary, validates changes, preserves traceability, and generates documentation.
