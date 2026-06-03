# Superseded docs — DO NOT BUILD FROM THESE

These docs described an **abstract JSON "Package" modeler** (frames.json /
containers.json / components.json + a validation rule engine + a change-state
machine + a security model + an agent automation pipeline). That framing made
the editor get built as a renderer of JSON boxes instead of a real
direct-manipulation tool — repeatedly wasting time.

**The real spec is `docs_v1/EDITOR-SPEC.md`.** It wins over everything here.

Why each was moved (the actual cause of the wrong builds):

| Doc | Why it misled |
| --- | --- |
| `02_architecture.md` | Defined a React+Vite+core/schema/validation/adapter app around the abstract package — not the real single-file editor. |
| `07_package_format.md` | The root culprit: containers/components as JSON records rendered as grey boxes, not real nested DOM. |
| `08_validation_rules.md` | A validation engine for the abstract package. The editor needs none. |
| `11_agent_automation_runbook.md` | A pipeline to auto-build the wrong app. |
| `12_deferred_to_v2.md` | Scope of the wrong app. |
| `13_element_intent_annotations.md` | Intent-as-schema machinery. The *idea* (an AI note per container) survives in EDITOR-SPEC §2.3; the schema does not. |
| `16_change_state_machine.md` | Draft/Validated/Approved states — irrelevant to a live DOM editor. |
| `17_security_model.md` | Threat model for the write-server plugin the real editor doesn't have. |
| `18_codex_cold_start_prompt.md` | Kickoff prompt to build the wrong app. |
| `19_known_pitfalls.md` | Pitfalls of building the wrong app. |
| `22_mvp_coherence_audit.md` | Audit of the wrong app. |

Kept active (still useful): `03` (snap/ruler/guide math), `04` (tool list),
`05`/`14`/`20`/`21` (the *menu of container kinds* for the Kind picker),
`09` (glossary), `23`/`24` (tier idea + GeoSee inventory), `00`/`01`/`06`/`10`/
`15`.
