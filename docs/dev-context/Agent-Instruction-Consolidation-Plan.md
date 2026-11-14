# Agent instruction consolidation: preservation-first staging plan

**Status:** review-only migration plan; no authorization to merge, remove original instructions, alter runtime behavior or resolve conflicting policies. **Baseline:** `main` at `29d9c4c7eee77ac1b104289b09b1382c574145d0` (13 November 2026).

**Owner intent:** GEODE is a multi-provider engineering project. Shared engineering knowledge must not be owned exclusively by Claude. `AGENTS.md` is the proposed common instruction interface. A provider file such as `CLAUDE.md` should eventually be a *thin importer/router only*, never an alternate source of substantive policy. Existing unique workflows and regression safeguards must survive migration without being flattened.

## Phase boundary and current changes

This **first non-destructive chunk** adds four scoped shared instruction candidates:

| Added file | Preserve and expose | Original source kept unchanged |
| --- | --- | --- |
| `projects/AGENTS.md` | Project/data search limits, project map, persistence endpoint, raw-source provenance, project/deck-test boundaries | `projects/CLAUDE.md` |
| `src/editor/AGENTS.md` | R1 extraction, large-file reading, Dev Mode Inspector map, editor-control manifest and IDs, save and editor exposure, transition guardrails | `src/editor/CLAUDE.md` |
| `src/scene/AGENTS.md` | R2 extraction, scene helper map, product-aware opacity, mandated regression test, centralized disposal and loader registration | `src/scene/CLAUDE.md` |
| `docs/AGENTS.md` | Documentation provenance, evidence status, DEC append/supersede, scientific/public claims, human visual acceptance, active spec routing | `docs/` existing technical contracts |

**Not changed:** root `AGENTS.md`, root `CLAUDE.md`, all three nested `CLAUDE.md`, app code, data, source preparation, snapshots, Git history, existing decisions and user-authored project content. No `docs/CLAUDE.md` was introduced. **Agent-runtime discovery has not been tested or certified.** This staged branch is not the completed provider-neutral migration.

## Existing root contract: preservation crosswalk before any edits

The root files remain the source of their original wording during this review. Each category below must be reconciled into the common contract or a clearly linked owning document before shrinking `CLAUDE.md`.

| Original lines (`AGENTS.md` unless noted) | Rules and distinct exceptions | Potential durable owner |
| --- | --- | --- |
| 8–16 | Selective active-context first read; receipt/archive exception for audits | Shared root |
| 18–30 | Factual output rail, prose restrictions and quoted/UI/API exceptions | Shared root; style scope **held** |
| 32–43; `CLAUDE.md` 30–42 | Purpose/scope/architecture/DEC/verification/editor docs; Claude-only page-transition source link | Shared root router and documentation owner |
| 45–52, 189–196 | Old canonical working tree, stale root, external archive map | **Held:** unsafe worktree authority; preserve historical provenance |
| 53–62 | UI_EDITOR separation, exact-path staging, workspace check, protect excluded dirty user files | Shared root |
| 63–75 | Manifest approval and stable IDs; project/page preset access; compact legend helpers | Editor owner and existing visual/manifest contracts |
| 76–82 | MT full-density-only modes, 1.5-second animation, exact two persisted fields | Existing MT/visual and transition owners |
| 83–86 | Ignore/cancel stale RAF ticks on page-context change | Existing transition owner |
| 87–96 | Global Settings preview retains visibility and MT Log10 fields; forbidden mutation-based false fixes | Existing MT/visual contract |
| 97–106 | Target-mode header, transition-time isolines, narrow post-settle refresh without broad replay | Existing MT/transition contract |
| 107–112 | Explicit MT all-off boundary maps authoritative; DEC-145 supersession | Existing technical contract and decision log |
| 113–131 | SEG-Y custom CMP byte offsets, 2D/3D geometry, L5/L11 registration caveat, CRC source gate, surrogate permission, three tests | Scientific project/source contract |
| 132–157 | No page-specific legend fixes, no project-page edits for app behavior, bounded search and excluded large paths | Shared search method and scoped scientific/transition owners |
| 159–171 | Large files: symbol-first limited reads; dated line-count list | Shared method and scoped editor/scene maps |
| 173–178 | Stop on doc contradiction; preserve DEC history and explicit supersession | Shared root + docs; precedence **held** |
| 180–187 | Dev-only Vite project persistence and no unilateral storage re-architecture | Shared root plus editor/projects |
| 199–211 | Disposable page fixtures, synthetic generic tests, deck-state distinction, reusable transition families | Transition + verification contracts |
| 213–219 | Required transition runtime specification and historical evidence distinction | Shared task routing + transition owner |

Root `AGENTS.md` is 220 lines; root `CLAUDE.md` is 217. They are largely equivalent but not identical. The current mirror check validates only the `mirror:monoliths` section, **not overall parity**. Do not replace root `CLAUDE.md` with an import until the Claude-only document reference and all current obligations are verifiably represented.

## Nested original-to-shared preservation crosswalk

| Original | Unique preserved content | New scoped owner |
| --- | --- | --- |
| `projects/CLAUDE.md` 3–13 | Mixed small authoring state versus bulk project data; four project navigational anchors | `projects/AGENTS.md` / structure |
| `projects/CLAUDE.md` 15–28 | Huge GeoJSON, binary, raster and manifest search hazard; specific Utah resistivity subtree example | `projects/AGENTS.md` / search |
| `projects/CLAUDE.md` 30–35 | Exact `/api/write-file` endpoint and Vite on-disk persistence; no IndexedDB/backend substitution | `projects/AGENTS.md` / persistence |
| `projects/CLAUDE.md` 37–41 | External upstream origin and archive provenance resolution | `projects/AGENTS.md` / upstream |
| `src/editor/CLAUDE.md` 3–35 | R1 monolith extraction, extracted clusters, constants and **800-line new-extraction cap** | `src/editor/AGENTS.md` / navigation |
| `src/editor/CLAUDE.md` 37–52 | Historically smaller files; `d` inspector; pure-unit-test modules; `DevModeInspector.tsx` protected-file exception | `src/editor/AGENTS.md` / navigation |
| `src/editor/CLAUDE.md` 54–62 | Manifest gate, stable control IDs, new-ID sequencing and approval metadata for moves/hides/renames/removals | `src/editor/AGENTS.md` / protected controls |
| `src/editor/CLAUDE.md` 63–67 | Targeted reads and unique edit context in repeated large-panel markup | `src/editor/AGENTS.md` / edits |
| `src/editor/CLAUDE.md` 68–70 | `save.ts`, Vite endpoint and preserved persistence architecture | `src/editor/AGENTS.md` / persistence |
| `src/scene/CLAUDE.md` 3–19 | R2 split and re-grown monoliths; section-controller historic 1,200-line cap | `src/scene/AGENTS.md` / source map |
| `src/scene/CLAUDE.md` 21–32 | Specific scene helper, shader, diagnostics, loader, disposal and focus module map | `src/scene/AGENTS.md` / source map |
| `src/scene/CLAUDE.md` 34–41 | Product-aware transition/opacity context, historic commits and mandatory regression test | `src/scene/AGENTS.md` / edits |
| `src/scene/CLAUDE.md` 42–43 | Mandatory centralized disposal through `disposeObjectTree.ts`; no ad-hoc loops | `src/scene/AGENTS.md` / disposal |
| `src/scene/CLAUDE.md` 44–45 | New layer kinds via `layerLoaderRegistry.ts`, never inline manager registration | `src/scene/AGENTS.md` / registration |

Vendor-specific historical tool verbs (such as `Read` with `offset`/`limit`, `Grep` and `Edit` with unique `old_string`) are preserved in the unmodified Claude originals. The new shared instructions express the same safety requirements in provider-neutral terms: search first, inspect limited ranges, patch with unambiguous context. Current line counts should be measured, not copied from stale estimates.

## Existing documentation knowledge must remain in owning specifications

| Existing technical owner | Distinctive rule not to flatten |
| --- | --- |
| `docs/03-decisions.md` | Recorded accepted decisions, rationale and superseding history |
| `docs/06-editor-exposure-rules.md` | Every user-facing field must have an editor surface, persistence and visible confirmation; distinct internal-only reasons |
| `docs/dev-context/Editor-Control-Manifest-Policy.md` | Exact manifest ID, page action, reorder and approval mechanics |
| `docs/dev-context/Verification-Routing.md` | Local sketch versus committed-state evidence; targeted checks; human launcher and port safety |
| `docs/dev-context/Transition-Constitution.md` | Synthetic-fixture rule, user visual sign-off, symptom-to-invariant diagnostic funnel |
| `docs/dev-context/Transition-Continuity-Contract.md` | Resolved render-graph diff, stable identity and channel assignment, idempotent final commit |
| `docs/dev-context/Transition-Decision-Log.md` | Specific transition decisions and phased implementation history |
| `docs/dev-context/Transition-Guardrails.md` | Tripwires, issue report fields and limited test budget |
| `docs/dev-context/Transition-Runtime-Operating-Spec.md` | Detailed matching/compatibility/opacity/readiness/derived-entity rules |
| `docs/dev-context/Page-Transitions-And-Section-Frames.md` | Frame compatibility, ISO opacity, visual helper and MT exception detail |
| `docs/dev-context/UI-Visual-Standards.md` | Shared quick-legend geometry, global/page render preset semantics, MT controls |
| `docs/dev-context/Runtime-Loading-Policy.md` | Load-class research/proposals and computed-asset quality prerequisites |
| `docs/dev-context/Visual-Review-Current.md` | Human visual acceptance and bounded browser verification |
| `docs/LICENSING.md` and `docs/GEODE-publication-manifest.md` | Software rights versus third-party scientific sources, claims and provenance |

## Duplications identified for a later semantic merge

1. Root Claude/Codex operating contracts (root pair).
2. Utah FORGE disposable-page rule and page-specific false-fix prohibition (root, transition, verification).
3. Vite `projects/` authoring persistence (root, editor, projects).
4. Manifest changes and stable control IDs (root, editor, manifest policy).
5. MT mode/isoline/tween/page preview behavior (root, UI, transitions).
6. Bounded search and monolith reads (root and each subsystem).
7. SEG-Y source gate, geometric registration and surrogate boundary (root, active context, verification).
8. Transition pre-read documents (root, active context, transition guardrails).
9. Human visual acceptance versus technical evidence (transition, visual review and editor exposure).
10. Dev-server/launcher precautions (verification, visual review, active context).

These are **consolidation candidates**, not instructions to delete the long-form specifications or lose any subcondition.

## Unresolved holds — intentionally not decided in this pass

| Hold | Unresolved issue |
| --- | --- |
| H01 | Old `C:\GeoSee\GeoSee_Dev` automatic routing conflicts with the sanitized public checkout. Do not switch into unsanitized ancestry during release work. |
| H02 | Root `/docs` contradiction stop versus Active-Build current source/project observed-authority statement. |
| H03 | Transition Constitution 'draft source of truth' versus active Runtime Operating Spec and the Active-Build authority description. |
| H04 | Claimed full root mirror versus CI-only monolith-section comparison and Claude-only linked document. |
| H05 | Referenced mandatory Transition Page Fixture Evidence Register missing from the published Git tree. |
| H06 | June historic handoffs labeled 'current' and stale command/source references. |
| H07 | Human launcher port 5194 versus Verification-Routing text naming 5173 (plus separate `.claude/launch.json` 5273). |
| H08 | Observed page-pair visual reproduction versus no page-pair coupling in app-behavior tests. |
| H09 | Root's universal pronoun/writing restriction versus user-audience/editor/public documentation work. |
| H10 | Product-aware runtime adapters versus prohibition on product-name-based top-level transition policy. |
| H11 | How each provider loads root and nested `AGENTS.md` when parallel `CLAUDE.md` files exist; **not tested**. |

Other discovered document-reference errors and stale size estimates remain listed in the canonical audit; they are not silently repaired here.

## Next gated chunks (not performed)

1. Review content parity, especially every unique negative safeguard in the existing `CLAUDE.md` files. Confirm where detailed rules should live, without silently settling H01–H11.
2. Prepare a shared root `AGENTS.md` that preserves both existing root contracts' unique clauses. Only then stage root and nested `CLAUDE.md` as pure provider-specific import/router files, plus any necessary `docs/CLAUDE.md`.
3. Test actual Claude/Codex discovery for root, `projects/`, `src/editor/`, `src/scene/` and `docs/`. Do not assume nested import semantics; use controlled self-reports and static CI checks. Run code tests as applicable and review diffs.
4. Present held contradictions for an owner decision before any substantial policy change or merge.

**Source audit / full rule-by-rule trace:** [GEODE agent-instruction audit, 13 Nov 2026](https://app.notion.com/p/417fb0993276814991e1c7463e20491d). The unchanged GitHub originals remain the verifiable source text. This staged branch must not be merged until agent loading and unresolved authority/safety questions are reviewed.
