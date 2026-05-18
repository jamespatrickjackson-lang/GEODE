# Source Register

## Purpose

Track deterministic/local/project records: data, files, outputs, manifests, app files, project configs, source docs, and intentionally preserved verification artifacts. This register records what exists or what a source directly states. Interpretation belongs in `Inference-Register.md`.

## Register

| source_id | project | type | path | observed_status | authority / basis | deterministic_or_derived | review_required | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-001 | Dev context | Control-plane docs folder | `docs/dev-context/` | Observed | Local filesystem | Deterministic local files | Yes | Lab-book/control-plane records exist; meaning and authority still require human review. |
| SRC-002 | Dev context | Verification artifact | `docs/dev-context/Verification-Receipts/VER-2026-05-15-001-no-git-diff-available.md` | Observed | Local filesystem and preserved receipt | Intentionally preserved verification artifact | Yes | Records that git diff/status were unavailable and filesystem modified-time check was the fallback. |
| SRC-003 | All projects | Project folder root | `projects/` | Observed | Local filesystem | Deterministic local files | Yes | Contains project folders; source-control boundary is unresolved because this workspace is not a git repo. |
| SRC-004 | All projects | Project manifests | `projects/*/project.json` | Observed | Local filesystem; manifest files parsed/read in prior context pass | Deterministic local config files | Yes | Project manifests are runtime source records; interpretation of active/current intent still needs review where docs conflict. |
| SRC-005 | Woodjam | Project folder | `projects/woodjam/` | Observed | Local filesystem and `projects/woodjam/project.json` | Deterministic local project files | Yes | Woodjam is present as a project folder and reference project; current demo obligation still needs human review. |
| SRC-006 | Shahbazi / Case Study B | Project folder and data refs | `projects/case-study-b/` | Observed | Local filesystem and `projects/case-study-b/project.json` | Deterministic plus derived preview artifacts | Yes | Contains raw/processed Shahbazi data rails and future targets; production readiness remains outside this row. |
| SRC-007 | Utah FORGE | Project folder and data/docs | `projects/utah-forge/` | Observed | Local filesystem, manifest, environment, project-local docs | Deterministic plus derived processed outputs | Yes | Contains active-looking MT/seismic/public-context records and contradictory docs; needs reconciliation. |
| SRC-008 | Base GUI | Template project folder | `projects/base-gui/` | Observed | Local filesystem and `projects/base-gui/project.json` | Deterministic local project files | Yes | Template project exists; not real project data. |
| SRC-009 | App source | Runtime/editor source files | `src/` | Observed | Local filesystem | Deterministic local source files | Yes | App implementation exists; not modified in this register-shaping pass. |
| SRC-010 | Prep | Data preparation scripts | `prep/` | Observed | Local filesystem | Deterministic local scripts | Yes | Prep scripts exist; not modified in this register-shaping pass. |

## Entry Template

| source_id | project | type | path | observed_status | authority / basis | deterministic_or_derived | review_required | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-000 | Project or cross-project area | File/data/report/test/config/doc | `path/or/url` | Observed / missing / contradictory / unavailable | Local filesystem / manifest / test / receipt / human-supplied file | Deterministic / derived / intentionally preserved artifact | Yes / No | Concise source-only note |

## Rules

- Source rows may be observed, deterministic, or derived.
- Source rows should record what local files or preserved records directly support.
- Do not add conclusions such as "should," "likely," "stale," or "accepted" here.
- Put interpretation in `Inference-Register.md`.
- Put human-promoted state in `Acceptance-Register.md`.
