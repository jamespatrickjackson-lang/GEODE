# Superseded Docs - Parked Package Workbench Model

This folder contains historical docs for the abstract React/Vite package
workbench. They are preserved for reference only.

**Superseded means the documents are no longer current instructions. It does
not mean the React/Vite code has been deleted or disabled.**

The current editor target is:

- `UI_EDITOR/gui-editor.html`
- `UI_EDITOR/docs_v1/EDITOR-SPEC.md`
- `UI_EDITOR/docs_v1/01_scope.md`
- `UI_EDITOR/docs_v1/10_build_phases.md`

## What Is Parked Here

The old model centered on:

- abstract GUI Packages
- `frames.json`
- `containers.json`
- `components.json`
- package import/export
- deterministic validation reports
- change-state workflow
- path-policy/security model for package writes
- generated `ai_agent_brief.md`
- autonomous agent runbooks and cold-start prompts

That model repeatedly pulled work away from the direct-manipulation editor.
Keep it parked until the standalone editor is stable.

## Files

| File | Why it is parked |
| --- | --- |
| `02_architecture.md` | Defines the React/Vite package workbench architecture. |
| `07_package_format.md` | Defines the abstract package model and JSON schema. |
| `08_validation_rules.md` | Defines validation for the package model. |
| `11_agent_automation_runbook.md` | Defines autonomous build orchestration. |
| `12_deferred_to_v2.md` | Scope notes for the old package workbench. |
| `13_element_intent_annotations.md` | Schema-level intent annotation design; current editor keeps plain Notes only. |
| `16_change_state_machine.md` | Draft/Validated/Approved workflow for packages. |
| `17_security_model.md` | Security model for package write tooling. |
| `18_codex_cold_start_prompt.md` | Cold-start prompt for the old autonomous build. |
| `19_known_pitfalls.md` | Failure modes for the old package workbench. |
| `22_mvp_coherence_audit.md` | Audit of the old package workbench. |

## Rule

Do not use these files to guide current GUI Editor work unless a task
explicitly says to resume the package workbench.
