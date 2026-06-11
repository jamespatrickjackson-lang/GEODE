# Transition Guardrails

Status: draft operational guardrails.

Read before every transition-related pass. Audit the intended work against this
file before editing and again before reporting.

## Immediate Fail Tripwires

- Runtime code branches on a numbered page, page id, page title, page index, or
  matrix case id.
- Tooling selects a remediation case by fixed page-order index instead of a
  feature-family predicate.
- A page JSON or environment JSON edit is presented as a transition fix.
- A fixture path is used as proof that a global transition family is fixed.
- Top-level transition policy branches on a named tool, editor panel, product
  family, or case-study renderer instead of the generic entity/channel
  contract. Renderer adapters may expose identity, compatibility, and channel
  capability, but must not define separate base visibility semantics.
- A visual-policy change is made without naming the global rule it changes.
- Agent-run visual automation is used as final acceptance after the user has
  reserved visual verification.

## Required Pre-Work Read

- `docs/dev-context/Transition-Constitution.md`
- `docs/dev-context/Transition-Continuity-Contract.md`
- `docs/dev-context/Transition-Decision-Log.md`
- `docs/dev-context/Transition-Page-Fixture-Evidence-Register-2026-05-31.md`
- Relevant entries in `docs/dev-context/Transition-Implementation-Changelog.md`

## Required Framing

Every report or implementation note should name:

- Symptom.
- Reproduction fixture, if any.
- Transition family.
- Violated or missing invariant.
- Decision-log entry used or needed.
- Test/guard used.
- Whether human visual review is required.

## Source Guards

Run the page-agnostic guard after transition runtime/tooling edits:

```powershell
node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"
```

The guard currently audits:

- `src/editor`
- `src/pages`
- `src/scene`
- `tools/capture-transition-matrix.mjs`

## Non-Visual Verification Defaults

Use the cheapest relevant set, then expand only when the changed surface needs
it:

```powershell
node node_modules\typescript\bin\tsc --noEmit --pretty false
npm run check:pages
npm run build
git diff --check
```

Do not run full transition matrix, long Playwright visual specs, browser
captures, or video capture unless explicitly requested.

## Allowed Fixture Use

Fixtures may be used to reproduce, observe, and record evidence. Fixture details
must stay in evidence registers, generated artifacts, or content-regression
tests. They must not become runtime branches or remediation criteria.

## Transition Runtime Operating Spec

Before transition runtime, editor/save transition gating, scene-section, Section ISO, working-area focus, opacity, or page-navigation work, read:

docs/dev-context/Transition-Runtime-Operating-Spec.md

This spec is the active operating contract for current transition work. Older audits and matrix logs are evidence only.

