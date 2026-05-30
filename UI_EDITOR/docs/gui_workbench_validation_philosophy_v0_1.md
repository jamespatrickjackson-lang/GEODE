# GUI Workbench
## Validation Philosophy Note

**Document status:** v0.1 working draft  
**Purpose:** Define the validation philosophy for the GUI Workbench before detailed rule design or implementation planning begins.

---

# 1. Purpose

The GUI Workbench should not only help users create interface structures. It should help users test whether those structures are suitable for their intended context.

Validation is therefore a first-class part of the product.

This document defines the philosophy behind validation, including deterministic checks, AI-assisted review, severity levels, device/use-case profiles, background stress testing, and human judgement.

---

# 2. Core Validation Principle

Validation should be split into two layers:

1. **Deterministic software validation**
2. **AI-assisted review**

The deterministic layer is the foundation.

The AI layer is advisory.

The final decision remains human.

The governing principle:

```text
Rules catch measurable failures.
AI catches contextual weakness.
Humans make final decisions.
```

---

# 3. Why Validation Matters

Interface problems often appear late because teams do not test early against real usage conditions.

Common failures:

- controls too small for touch
- labels too small for boardroom viewing
- panels overflow on tablet
- layouts rely on hover where touch is used
- transparent panels fail over complex backgrounds
- technical panels are too dense for presentation mode
- project-specific overrides break base consistency
- AI-generated implementations miss use-case constraints

The workbench should catch these problems before implementation or release.

---

# 4. Deterministic Validation

Deterministic validation checks measurable conditions.

It should be:

- predictable
- repeatable
- explainable
- profile-driven
- inspectable
- independent of AI opinion

Examples:

- button below minimum size
- touch target below threshold
- edge clearance too small
- panel overflow
- text truncation
- font below selected profile threshold
- contrast below target
- hover-only behaviour in touch profile
- missing disabled state
- destructive action without confirmation
- transparent panel unreadable over selected background

The deterministic validator should say what failed, why it failed, and what profile caused the finding.

---

# 5. AI-Assisted Review

AI-assisted review may be useful for contextual judgement.

It may comment on:

- visual hierarchy
- density
- clarity
- terminology
- use-case fit
- likely user confusion
- mismatch between device and layout
- presentation suitability
- potential simplification
- implementation handoff quality

AI review should not:

- replace deterministic validation
- override rule-based findings
- silently mark failed checks as passed
- apply changes without review
- become the final authority

AI is a reviewer, not the judge.

---

# 6. Human Judgement

Some interface decisions cannot be fully automated.

Examples:

- whether density is acceptable for expert users
- whether terminology fits the domain
- whether a warning can be accepted
- whether a project override is appropriate
- whether a panel should prioritize speed, clarity, or completeness
- whether a boardroom mode should hide technical controls

The workbench should support human judgement by making constraints and findings visible.

It should not pretend every design decision can be reduced to pass/fail.

---

# 7. Severity Levels

Validation findings should use severity levels.

## Info

A neutral observation.

## Suggestion

A low-risk improvement.

## Warning

A meaningful issue that should be reviewed.

## Error

A serious issue that should block normal application unless explicitly overridden.

## Blocker

A critical issue that should block application by default.

---

# 8. Profile-Driven Validation

Validation should depend on selected profiles.

A control may be valid in one context and invalid in another.

Example:

```text
32 px button height
→ acceptable for dense desktop editing
→ warning for tablet review
→ error for large touchscreen use
```

Therefore, validation must consider:

- use-case profile
- device/display profile
- input method profile
- mode profile
- host-app rules
- project override context

---

# 9. Use-Case Profiles

Use-case profiles describe why the interface is being used.

Examples:

- technical editing
- field review
- internal review
- client presentation
- investor presentation
- boardroom walkthrough
- public/community explanation
- data import/checking
- released-product configuration

Each use case changes the expected density, clarity, and control availability.

---

# 10. Device / Display Profiles

Device/display profiles describe where the interface will be viewed.

Examples:

- phone
- tablet/iPad
- laptop
- desktop monitor
- ultrawide monitor
- field laptop
- large touchscreen
- boardroom TV
- projector
- multi-screen setup

Each display context changes expectations for:

- font size
- panel density
- control size
- contrast
- safe area
- edge clearance
- layout stacking

---

# 11. Input Method Profiles

Input profiles describe how the user interacts with the interface.

Examples:

- mouse
- trackpad
- touch
- stylus
- keyboard
- presentation remote
- mixed input

Validation should catch mismatches.

Examples:

- hover-only interactions in touch profiles
- tiny sliders in large touchscreen profiles
- controls too close together for touch
- missing keyboard focus indicators
- overly dense menus for remote/clicker use

---

# 12. Background Stress Testing

Background stress testing checks whether GUI surfaces remain legible over different backgrounds.

This is especially important for GOC because panels may sit over:

- terrain
- geology visualizations
- satellite imagery
- maps
- high-detail technical imagery
- moving scenes

Background types may include:

- plain light
- plain dark
- high-detail image
- low-contrast image
- stripe pattern
- noisy image
- moving background
- transparent panel test background

A panel that passes on a clean background may fail over real visual content.

---

# 13. Validation Findings

A validation finding should include:

- severity
- affected object
- rule ID
- message
- current value
- recommended value or action
- selected profile that caused the issue
- resolved/unresolved state
- whether override is allowed
- rationale or note field

Findings should be traceable.

---

# 14. What Counts as Pass / Fail

Validation should avoid simplistic all-or-nothing thinking.

A package or panel may have:

- passed checks
- acknowledged warnings
- unresolved errors
- blockers
- profile-specific failures

A GUI can be valid for desktop technical editing while invalid for boardroom presentation.

Pass/fail should be profile-specific.

---

# 15. Warning Acknowledgement

Some warnings may be acceptable.

Example:

```text
This panel is dense for tablet review, but the selected user group is expert technical reviewers.
```

The workbench should allow warnings to be acknowledged when permitted.

Acknowledgement should record:

- who acknowledged it
- when
- why
- affected profile
- whether it applies only to a project override or base system

---

# 16. Validation and Project Overrides

Project overrides should be validated against their selected context.

Example:

A Woodjam presentation override may need boardroom validation.

A technical editing default may need desktop validation.

The base system and project override should not be treated as the same thing.

---

# 17. Validation and Embedded Mode

In embedded mode, validation should occur before applying changes.

Default handling:

| Severity | Default Embedded Behaviour |
|---|---|
| Info | Allow |
| Suggestion | Allow |
| Warning | Allow with acknowledgement |
| Error | Block unless override permission exists |
| Blocker | Block |

The host app may define stricter rules.

---

# 18. Validation and AI-Agent Handoff

Validation findings should travel into AI-agent briefs.

An AI-agent brief should not only say what to build. It should include:

- unresolved validation issues
- acceptance criteria
- no-touch areas
- device/use-case targets
- required corrections
- warning acknowledgements where applicable

This reduces ambiguous implementation.

---

# 19. Validation Anti-Patterns

Avoid:

- AI-only validation
- hidden validation rules
- generic validation without profiles
- treating every warning as a blocker
- treating all contexts as equivalent
- ignoring background readability
- letting AI override deterministic failures
- allowing untracked warning acknowledgements
- applying embedded changes without validation

---

# 20. Open Questions

1. What are the first formal rule packs?
2. What minimum touch target values should be used?
3. What font thresholds should apply by display profile?
4. How should contrast be measured over complex backgrounds?
5. Should background stress testing be manual, automated, or both?
6. Which warnings can be acknowledged?
7. Which errors can be overridden?
8. Which findings should block embedded application?
9. How should validation findings be represented in GUI packages?
10. How should AI-assisted review be separated visually from deterministic validation?

---

# 21. Summary

Validation is not an add-on.

It is one of the core reasons the GUI Workbench exists.

The validation philosophy is:

- deterministic checks first
- AI review second
- human judgement final
- profile-specific findings
- visible severity
- traceable acknowledgement
- background readability included
- embedded changes gated by host-app rules

This keeps the workbench practical, inspectable, and safe.
