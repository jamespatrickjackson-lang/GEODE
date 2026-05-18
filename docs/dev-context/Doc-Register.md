# Doc Register

Last populated: 2026-05-15

## Purpose

Inventory documents that may carry current-state, architecture, scope, decision, handoff, data-intake, verification, SRI/Processware, or DHF-like meaning. This register does not move files or declare scope.

## Status Legend

| Status | Meaning |
| --- | --- |
| active | Appears useful as current working reference, still subject to human review. |
| candidate stale | Contains or may contain claims contradicted by newer docs/files. Do not rely on it alone. |
| stale | Clearly outdated or superseded by explicit evidence. Use sparingly. |
| unknown | Needs review before authority can be assigned. |

## Register

| path | observed role | likely category | active / stale / candidate stale / unknown | confidence | proposed future home | human review required? | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `README.md` | Root project overview and Woodjam alpha framing | active current-state | candidate stale | High | Keep root README, refresh after review | Yes | Says app shell TBD and Woodjam presentation is the artifact; newer docs/code show React multi-project app. |
| `CLAUDE.md` | Original Claude routing and locked decisions | AI agent instructions | candidate stale | High | Keep root agent guide, mark historical/refresh after review | Yes | Contains useful guardrails, but Woodjam-demo emphasis conflicts with current multi-project state. |
| `CHANGELOG.md` | Running kept-change record and verification notes | changelog / receipt | active | Medium | Keep root changelog; cross-link from dev-context | Yes | Strong evidence of later Utah/Seismic/MT work, but not a complete current-state authority by itself. |
| `docs/00-purpose.md` | Product purpose and current build description | active current-state | candidate stale | High | Keep in docs, reconcile Utah sections | Yes | Says Utah FORGE awaited briefing/real ingest while newer files show active data outputs. |
| `docs/01-scope.md` | Current scope and out-of-scope notes | scope | candidate stale | High | Keep in docs, reconcile Utah sections | Yes | Useful scope boundaries, but Utah foundation/no-real-data wording appears behind current manifests. |
| `docs/02-architecture.md` | App architecture and runtime flow | architecture | candidate stale | Medium | Keep in docs, reconcile loader/data status | Yes | Runtime flow remains useful; Utah foundation-only section may be outdated. |
| `docs/03-decisions.md` | Root decision log | decision | active | Medium | Keep in docs; append-only after review | Yes | Locked decisions are important; later Utah/seismic state may need superseding entries, not silent edits. |
| `docs/04-build-sequence.md` | Current-state build sequence and queue | build / verification | candidate stale | High | Keep in docs, reconcile current queue | Yes | Still useful, but Utah foundation/no-real-data entries conflict with newer files. |
| `docs/START-HERE.md` | New developer/agent orientation | active current-state | active | Medium | Keep in docs; make primary only after review | Yes | More current than older docs on Utah MT, but still must be reconciled with project-local seismic/default-state contradictions. |
| `docs/handover-for-claude.md` | Session handoff/bootstrap | handoff | candidate stale | High | Historical/archive candidate after review | Yes | Says it replaces older handover, but Utah state is now behind newer docs/project files. |
| `docs/SESSION-CHANGES-2026-05-01.md` | Old session-change note refreshed through May 12 | historical / archive candidate | candidate stale | High | Historical/archive candidate after review | Yes | Useful chronology, but explicit old-session framing and Utah foundation claims need classification. |
| `docs/schemas/project.json.md` | Project schema documentation | architecture | unknown | Medium | Keep in docs/schemas | Yes | Schema docs may still be useful; current manifest fields should be checked before relying on details. |
| `docs/schemas/page.json.md` | Page schema documentation | architecture | unknown | Medium | Keep in docs/schemas | Yes | Needs schema-vs-code check. |
| `docs/schemas/sources.json.md` | Source schema documentation | architecture | unknown | Medium | Keep in docs/schemas | Yes | Needs schema-vs-current-source-model check. |
| `docs/woodjam/content-brief.md` | Woodjam narrative brief | active current-state | unknown | Medium | Keep in docs/woodjam | Yes | Currentness unknown after multi-project shift; likely important for Woodjam story. |
| `docs/woodjam/data-manifest.md` | Woodjam data manifest and source notes | data intake | unknown | Medium | Keep in docs/woodjam | Yes | Important source/data reference; may include old deferred items. |
| `docs/woodjam/ARIS Digital Data Disclaimer.txt` | ARIS data disclaimer | data intake | active | Medium | Keep with Woodjam source docs | Yes | Source/disclaimer artifact, preserve carefully. |
| `docs/woodjam/ARIS Digital Data Files too large for download.txt` | ARIS size/download note | data intake | active | Medium | Keep with Woodjam source docs | Yes | Source/download limitation note, preserve carefully. |
| `docs/woodjam/Appendix C - ZTEM Survey Data/2023 ZTEM/Preliminary/GDB/ZTEM_Channels_ReadMe_30Hz.txt` | ZTEM source readme | data intake | unknown | Medium | Keep with Woodjam source docs | Yes | Technical source note; not a control-plane doc. |
| `docs/woodjam/Appendix E - IP Survey Data/IP Survey 2023/DataFiles/2357GPS_All.txt` | IP survey GPS/data text | data intake | unknown | Low | Keep with Woodjam source docs | Yes | Looks more like source data than narrative doc; inventory only. |
| `docs/dev-context/HOME.md` | Dev-context entry and governing model | DHF-esque / control-plane | active | High | Keep in docs/dev-context | Yes | States lab-book/control-plane intent and non-DHF boundary. |
| `docs/dev-context/Current-State.md` | Current-state snapshot with contradictions | active current-state | active | High | Keep in docs/dev-context | Yes | Control-plane snapshot, not accepted scope. |
| `docs/dev-context/Open-Loops.md` | Unresolved questions and review queue | DHF-esque / control-plane | active | High | Keep in docs/dev-context | Yes | Current loop register. |
| `docs/dev-context/Scope-Refinement.md` | Proposed NOW/NEXT/PARK/REJECT classification | scope | active | High | Keep in docs/dev-context | Yes | Proposed only, not locked scope. |
| `docs/dev-context/GeoVox-Spine.md` | Product/data/control-plane spine | SRI / Processware probe | active | High | Keep in docs/dev-context | Yes | Conceptual spine; acceptance remains separate. |
| `docs/dev-context/Code-Map.md` | Observed code structure and hotspots | architecture | active | High | Keep in docs/dev-context | Yes | Observational map only. |
| `docs/dev-context/Dataset-Map.md` | Observed project/data map | data intake | active | High | Keep in docs/dev-context | Yes | Notes Utah contradictions. |
| `docs/dev-context/Source-Register.md` | Deterministic/local source register | SRI / Processware probe | active | High | Keep in docs/dev-context | Yes | Starter rows only; authority level needs review. |
| `docs/dev-context/Inference-Register.md` | Proposed inference register | SRI / Processware probe | active | High | Keep in docs/dev-context | Yes | Proposal register, not acceptance. |
| `docs/dev-context/Acceptance-Register.md` | Human acceptance register | SRI / Processware probe | active | High | Keep in docs/dev-context | Yes | No accepted items from recent passes. |
| `docs/dev-context/Doc-Register.md` | Documentation inventory | DHF-esque / control-plane | active | High | Keep in docs/dev-context | Yes | This file. |
| `docs/dev-context/Bot-Operating-Rules.md` | Agent operating rules | AI agent instructions | active | High | Keep in docs/dev-context | Yes | Governs register discipline. |
| `docs/dev-context/Verification-Receipts/VER-2026-05-15-001-no-git-diff-available.md` | No-git verification limitation receipt | build / verification | active | High | Keep in verification receipts | Yes | Preserve carefully because git history is unavailable. |
| `docs/dev-context/Change-Receipts/TEMPLATE.md` | Change receipt template | DHF-esque / control-plane | active | Medium | Keep in docs/dev-context | Yes | Template only. |
| `docs/dev-context/Verification-Receipts/TEMPLATE.md` | Verification receipt template | build / verification | active | Medium | Keep in docs/dev-context | Yes | Template only. |
| `docs/dev-context/DHF-Links/TEMPLATE.md` | DHF-link template | DHF-esque / control-plane | active | Medium | Keep in docs/dev-context | Yes | Explicitly not official DHF unless promoted. |
| `docs/dev-context/Prompts/README.md` | Prompt registry starter | AI agent instructions | active | Medium | Keep in docs/dev-context | Yes | Prompt-control template. |
| `projects/case-study-b/data/README.md` | Case Study B data folder notes | data intake | unknown | Medium | Keep with project data | Yes | Source/currentness should be checked against project manifest. |
| `projects/case-study-b/data/raw/shahbazi_gravel_pit/README.md` | Shahbazi raw source notes | data intake | active | Medium | Keep with raw data | Yes | Preserve with source data. |
| `projects/case-study-b/data/processed/shahbazi_gravel_pit/README.md` | Shahbazi processed preview output notes | data intake | active | Medium | Keep with processed data | Yes | Important preview-vs-production record. |
| `projects/case-study-b/data/processed/shahbazi_gravel_pit/photo_overlay_preview/README.md` | Photo overlay preview note | data intake | active | Medium | Keep with processed data | Yes | Short source-derived preview note. |
| `projects/case-study-b/data_refs/README.md` | Case Study B data refs index | data intake | unknown | Medium | Keep with data_refs | Yes | Index currentness needs check. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/README.md` | Shahbazi data refs overview | data intake | active | Medium | Keep with data_refs | Yes | Project source/provenance context. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/ACQUISITION_BRIEF.md` | Acquisition/source brief | data intake | active | Medium | Keep with data_refs | Yes | Preserve carefully; source/provenance context. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/INGEST_PIPELINE_BRIEF.md` | Ingest pipeline brief | data intake | active | Medium | Keep with data_refs | Yes | Important pipeline guidance, not app automation. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/TRIAGE_CHECKLIST.md` | Data triage checklist | data intake | unknown | Medium | Keep with data_refs | Yes | Checklist needs review for currentness. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/PROCESSING_TODO.md` | Processing todo | historical / archive candidate | unknown | Medium | Keep for now; archive candidate after review | Yes | Todo may be partially complete. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/CHAPTER_AND_DEMO_FLOW_NOTES.md` | Demo/story flow notes | scope | unknown | Medium | Keep with data_refs or future story docs after review | Yes | Contains narrative sequencing ideas. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/SYNTHETIC_OVERLAY_SCHEMA.md` | Synthetic overlay schema note | architecture | unknown | Medium | Keep with data_refs unless promoted to docs/schemas | Yes | Candidate future schema doc, not moved now. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/AUTHOR_CONTACT_TEMPLATE.md` | Author/contact outreach template | data intake | unknown | Low | Keep with data_refs or archive later | Yes | Operational template. |
| `projects/case-study-b/data_refs/shahbazi_gravel_pit/paper_extracted_images/README.md` | Extracted image folder note | data intake | unknown | Low | Keep with extracted images | Yes | Support note. |
| `projects/utah-forge/AI_NEXT_AGENT_START_HERE.md` | Utah next-agent handoff | AI agent instructions | candidate stale | High | Historical/handoff archive candidate after review | Yes | Says seismic remains blocked, while current manifest/environment/test show seismic browser records. |
| `projects/utah-forge/AI_FUTURE_DATA_INPUT_PLAYBOOK.md` | Future Utah data input playbook | data intake | unknown | Medium | Keep with Utah docs; maybe promote to data-intake guide after review | Yes | Useful pattern guidance; currentness depends on Utah state reconciliation. |
| `projects/utah-forge/Utah_Forge_Decisions.md` | Utah-specific decisions | decision | candidate stale | High | Keep with Utah docs; append/supersede after review | Yes | Strong MT decision record, but seismic-blocking statements conflict with newer active seismic evidence. |
| `projects/utah-forge/Utah_Forge_DevPlan.md` | Utah implementation roadmap | architecture | candidate stale | High | Keep with Utah docs; reconcile after review | Yes | Contains useful Stage 2 plan and blocked-seismic statements. |
| `projects/utah-forge/Utah_Forge_Data_Intake_Checklist.md` | Utah data intake checklist | data intake | candidate stale | Medium | Keep with Utah docs; reconcile after review | Yes | Current for MT in places, but future/seismic state needs review. |
| `projects/utah-forge/Utah_Forge_Next_Stage_Gates.md` | Utah stage gates | build / verification | unknown | Medium | Keep with Utah docs; update after review | Yes | Gate language likely useful; active-state assumptions need check. |
| `projects/utah-forge/Stage 2 - Phase 3 MT resistivity.md` | Stage 2 MT contract | build / verification | candidate stale | Medium | Keep with Utah docs; reconcile default-visible/seismic notes | Yes | MT contract useful; default-visible expectations differ from current environment. |
| `projects/utah-forge/Rendering issues.txt` | Rendering/performance issue note | build / verification | candidate stale | Medium | Historical/rendering archive candidate after review | Yes | Mentions 90k preview vs full-density; may be superseded by current full-density work. |
| `projects/utah-forge/Gated Chunks.txt` | Gated implementation chunks | build / verification | unknown | Medium | Historical/archive candidate after review | Yes | Chunk plan may be partially completed. |
| `projects/utah-forge/data/Geovox_James_Handoff (1).md` | Imported handoff context | handoff | unknown | Medium | Historical/handoff archive candidate after review | Yes | Preserve; unclear source/currentness. |
| `projects/utah-forge/data/README.md` | Utah data folder state | data intake | candidate stale | High | Keep with data folder; reconcile seismic status | Yes | Says seismic not active while manifests/tests show seismic browser records. |
| `projects/utah-forge/data_refs/README.md` | Utah data references overview | data intake | unknown | Medium | Keep with data_refs | Yes | Needs check against current processed outputs. |
| `projects/utah-forge/data/geosee_processed/README.md` | GeoSee-processed outputs overview | data intake | candidate stale | Medium | Keep with processed data; reconcile active families | Yes | Says inactive families reserved, but current seismic artifacts/manifest exist. |
| `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/README.md` | Phase 3 MT processed output notes | data intake | candidate stale | High | Keep with processed data; reconcile seismic/default state | Yes | Strong MT facts; says no seismic output active. |
| `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/source_inventory.md` | Phase 3 MT source inventory | data intake | active | Medium | Keep with MT intake | Yes | Preserve as source/provenance support. |
| `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/crs_origin_note.md` | Phase 3 MT CRS/origin note | data intake | active | Medium | Keep with MT intake | Yes | Preserve as source/provenance support. |
| `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/README.md` | Phase 3 seismic processed output note | data intake | candidate stale | High | Keep with seismic output folder; reconcile active state | Yes | Says no seismic output active despite seismic browser files and manifest references. |
| `projects/utah-forge/data/client_preprocessed/*/README.md` | Utah source/client data placement notes | data intake | unknown | Medium | Keep beside source data | Yes | Grouped row for multiple source-folder README files; preserve with source packages. |
| `projects/utah-forge/data/client_preprocessed/*/Data_staging/README (1).md` | Submission staging README | data intake | unknown | Medium | Keep beside source data | Yes | Grouped row for staged submission notes; preserve. |
| `projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/seismic_analysis/source/from_submission_1141/readme_metadata_seismic (1).txt` | Seismic metadata readme | data intake | active | Medium | Keep beside seismic source data | Yes | Source metadata, not a control-plane decision doc. |
| `prep/raw/bc_digital_geology/current_version_readme.txt` | Raw public geology source readme | data intake | unknown | Low | Keep with raw prep source data | Yes | Prep/source data note; not app docs. |

## Notes

- Inventory excludes large raw data `.txt` files that appear to be source payloads rather than documentation, except where a README/metadata role is clear.
- `candidate stale` means "do not rely on without review," not "delete" or "move."
- Proposed future homes are classification ideas only. No files were moved by this pass.
