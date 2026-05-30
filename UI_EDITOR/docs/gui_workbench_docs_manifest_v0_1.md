# GUI Workbench
## Documentation Manifest and Review Status

**Document status:** v0.1 orientation manifest  
**Purpose:** Provide a single index for the GUI Workbench document set, including document purpose, maturity, reviewer use, and whether each document is foundational, exploratory, or a candidate input toward a future Version 1 definition.

---

# 1. Status Notice

This document set is an **initial concept sketch** for probing, clarifying, and refining the GUI Workbench idea.

No final product, architecture, build, validation, package-format, embedded-integration, permission, or Version 1 decisions have been made.

These documents should not be treated as implementation directives.

Where a document uses terms such as “requirements,” “architecture,” “package,” “adapter,” “validation,” or “Version 1,” those terms describe **candidate thinking** and **areas for review**, not approved development instructions.

Before any build planning begins, the relevant open questions should be reviewed, resolved, deferred, or deliberately converted into decisions.

---

# 2. How to Read This Document Set

The current documents fall into three broad categories.

## 2.1 Foundational / Orientation Documents

These explain the idea, language, users, intent, and context.

They are meant to help reviewers understand the concept.

They are not build instructions.

## 2.2 Concept-Control / Guardrail Documents

These define important boundaries and principles, such as safety, validation philosophy, package concept, and host-app separation.

They are stronger than general introductions, but still not final specifications.

They should be reviewed before detailed planning.

## 2.3 Candidate Version 1 Definition Inputs

These documents move closer to product or architecture definition.

They may contain early requirement language, architectural structures, or candidate system models.

They should be treated as **inputs to a future Version 1 definition**, not as approved Version 1 itself.

---

# 3. Classification Legend

| Classification | Meaning |
|---|---|
| Foundational | Provides orientation, purpose, language, context, or conceptual framing. |
| Concept-Control | Defines guardrails, boundaries, principles, or constraints that should inform later decisions. |
| Candidate V1 Input | Contains early product/architecture/requirements thinking that may inform a future Version 1 definition. |
| Reviewer Index | Centralizes unresolved questions and points reviewers to relevant context. |
| Package Orientation | Helps a reader understand the document set and how to use it. |

---

# 4. Decision Status Legend

| Status | Meaning |
|---|---|
| Exploratory | Idea is being developed; not a decision. |
| Provisional | Good current framing, but subject to review. |
| Candidate | Possible input to future Version 1 definition. |
| Guardrail Candidate | Proposed boundary or principle that should be reviewed before planning. |
| Unresolved | Requires reviewer decision, deferral, or clarification. |
| Informational | Helps orient the reader but does not define the product. |

---

# 5. Document Manifest Table

| Doc ID | File | Classification | Role | Decision Status | How to Use | Not To Be Used As |
|---|---|---|---|---|---|---|
| README | `README_gui_workbench_docs_v0_1.md` | Package Orientation | Explains the document set, status, and caution around interpretation. | Informational | Start here before reading the set. | A product decision record or build instruction. |
| FOUNDATION | `gui_workbench_project_outline_foundation_v0_1.md` | Foundational | Introduces the concept, purpose, ethos, deployment modes, GOC context, workflows, and boundaries. | Exploratory / Provisional | Use to understand the idea and shared intent. | A final scope document or implementation plan. |
| PRD-ARCH | `gui_workbench_prd_architecture_v0_1.md` | Candidate V1 Input | Captures early product requirements and technical architecture outline. | Candidate | Use as raw material for future PRD/architecture review. | Approved Version 1 requirements, build plan, or engineering directive. |
| GLOSSARY | `gui_workbench_glossary_naming_v0_1.md` | Foundational | Defines common terms and naming conventions. | Provisional | Use to keep language consistent during review. | A locked taxonomy or public brand decision. |
| USERS | `gui_workbench_use_cases_user_roles_v0_1.md` | Foundational | Defines likely users, needs, and use-case categories. | Exploratory / Provisional | Use to test whether the concept serves the right people. | A finalized market segmentation or product roadmap. |
| BOUNDARY | `gui_workbench_safe_editing_boundary_charter_v0_1.md` | Concept-Control | Defines safe/restricted surfaces for embedded editing. | Guardrail Candidate | Use to review embedded safety, host-app responsibility, and no-touch zones. | Final permission architecture or security specification. |
| PACKAGE | `gui_workbench_gui_package_concept_note_v0_1.md` | Concept-Control | Defines the conceptual role of a GUI Package. | Guardrail Candidate | Use to discuss package purpose, contents, and boundaries. | A final schema or file-format specification. |
| VALIDATION | `gui_workbench_validation_philosophy_v0_1.md` | Concept-Control | Defines the two-layer validation philosophy: deterministic rules first, AI review second, human judgement final. | Guardrail Candidate | Use to review validation posture and prevent AI-overreach. | A final validation rule set or numerical standards document. |
| GOC-CONTEXT | `gui_workbench_goc_first_context_brief_v0_1.md` | Foundational / Concept-Control | Explains how GOC serves as the first proving ground without making the core GOC-specific. | Provisional | Use to review GOC-specific context and adapter boundaries. | A final GOC integration scope or implementation plan. |
| QUESTIONS | `gui_workbench_reviewer_open_questions_index_v0_1.md` | Reviewer Index | Centralizes unresolved questions with references and context. | Unresolved | Use as the main review worksheet before planning. | A decision log or answered requirements list. |
| MANIFEST | `gui_workbench_docs_manifest_v0_1.md` | Package Orientation | Classifies the document set and clarifies maturity/status. | Informational | Use to understand what each document is and is not. | A governance approval record. |

---

# 6. Most Important Interpretation Rule

These documents are **not instructions to build**.

They are a structured concept capture.

They are intended to support review, probing, criticism, correction, and refinement.

A later decision process should explicitly mark which items become:

- accepted
- rejected
- deferred
- revised
- promoted into Version 1
- left as background context

Until then, the documents remain exploratory unless explicitly promoted.

---

# 7. Suggested Reviewer Reading Order

Recommended order:

1. `README_gui_workbench_docs_v0_1.md`
2. `gui_workbench_docs_manifest_v0_1.md`
3. `gui_workbench_project_outline_foundation_v0_1.md`
4. `gui_workbench_glossary_naming_v0_1.md`
5. `gui_workbench_use_cases_user_roles_v0_1.md`
6. `gui_workbench_safe_editing_boundary_charter_v0_1.md`
7. `gui_workbench_validation_philosophy_v0_1.md`
8. `gui_workbench_gui_package_concept_note_v0_1.md`
9. `gui_workbench_goc_first_context_brief_v0_1.md`
10. `gui_workbench_prd_architecture_v0_1.md`
11. `gui_workbench_reviewer_open_questions_index_v0_1.md`

The PRD/architecture outline is intentionally later in the reading order because it is closer to Version 1 definition and should be read after the conceptual foundations and boundaries.

---

# 8. Review Use

A reviewer should use this set to answer:

- Is the idea coherent?
- Is the problem worth solving?
- Are the users correctly identified?
- Are the boundaries clear?
- Is embedded editing safe enough in principle?
- Is the GUI Package concept useful?
- Is the validation philosophy sound?
- Is GOC a good proving ground?
- What is missing, overclaimed, premature, or unclear?
- What should be promoted into a real Version 1 definition later?

---

# 9. What Requires Explicit Promotion Later

The following should not be considered approved until explicitly promoted:

- Version 1 product requirements
- technical architecture
- package schema
- host-app adapter contract
- embedded permission model
- validation rule values
- AI review behaviour
- GOC integration scope
- open-source boundary
- first implementation sequence
- app save/apply behaviour

---

# 10. Summary

This manifest exists to prevent the document set from being misread.

The current GUI Workbench documents are a concept foundation and review pack.

They are not final decisions.

They are not build instructions.

They are a structured basis for thinking, review, and eventual decision-making.
