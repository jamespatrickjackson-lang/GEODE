# Agent instruction consolidation: preservation-first staging plan

**Status:** review-only migration plan. The owner approved **only H01, H02, H03 and H09** in DEC-189 (13 November 2026); this does not authorize merging, Claude router conversion, runtime changes, or resolving the seven remaining holds. **Baseline:** `main` at `29d9c4c7eee77ac1b104289b09b1382c574145d0` (13 November 2026).

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

## Holds identified in Phase 1 — original audit status (current approvals below)

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


## Full self-contained original-to-owner rule-group crosswalk (61 entries)

**Scope and authority:** This matrix is a preservation *inventory*, not a declaration that every clause has already been proven semantically equivalent. It copies the 61 rule-group IDs used in the original audit into this public repository so other coding agents can inspect the source without a Notion connection. Each original is pinned to immutable `29d9c4c` file/line references; GitHub history keeps the source text available when provider files later become routers. The existing owning technical specs remain authoritative for their detailed content. Proposed destinations are **review candidates**, not permission to change priority or resolve the eleven holds.

| ID | Immutable original source | Specific rule and protected content | Candidate owner or existing contract | Preservation condition |
| --- | --- | --- | --- | --- |
| R01 | [AGENTS.md:8-16](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L8-L16) | Selective active-context first read; archived evidence only when needed | `root AGENTS + active router` | No routine full archive reads |
| R02 | [AGENTS.md:18-30](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L18-L30) | Factual handoff/output rail; pronoun restriction and exact exceptions | `root AGENTS [H09]` | Preserve all exceptions; writing scope unresolved |
| R03 | [AGENTS.md:32-43](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L32-L43) | Product/scope/architecture/DEC/verification/manifest route | `root AGENTS + docs AGENTS` | All original routes retained |
| R04 | [AGENTS.md:45-52](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L45-L52) | Old required worktree and auto-switch | `root AGENTS [H01]` | Conflict held; no implicit route to old ancestry |
| R05 | [AGENTS.md:53-55](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L53-L55) | Do not merge UI_EDITOR prototype/packages into main | `root AGENTS` | Only user-scoped standalone package excepted |
| R06 | [AGENTS.md:56-62](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L56-L62) | Check workspace; stage exact paths; protect dirty/excluded user work | `root AGENTS + Verification-Routing` | Distinguish report/commit/broad modes |
| R07 | [AGENTS.md:63-65](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L63-L65) | Manifest approval before editor bar/control changes | `editor AGENTS + manifest owner` | Include hide/move/rename/remove cases |
| R08 | [AGENTS.md:66-71](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L66-L71) | Single render-preset surface; project and page selectors together | `editor AGENTS + UI Visual Standards` | No Global Settings-only or separate mode workaround |
| R09 | [AGENTS.md:72-75](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L72-L75) | Compact quick-legend helpers; no local geometry tuning | `editor AGENTS + UI Visual Standards` | Document explicit exceptions |
| R10 | [AGENTS.md:76-82](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L76-L82) | MT full-density-only mode semantics; 1.5-s scalar mode transition | `UI Visual Standards + transition spec` | Final persistence only scalarLegendVisible and scalarInclusionMode |
| R11 | [AGENTS.md:83-86](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L83-L86) | Cancel/ignore stale RAF mode ticks on page-context change | `transition spec + UI Visual Standards` | Do not repair via authored fixture edits |
| R12 | [AGENTS.md:87-96](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L87-L96) | Global Settings preview preserves page visibility and authored Log10 fields | `UI Visual Standards + transition spec` | No scalarInclusionFilterActive/SCALAR_TRANSITION_STYLE_FIELDS/full-density-scalar mutation |
| R13 | [AGENTS.md:97-102](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L97-L102) | Target authored mode in header; full-density tween drives isolines | `transition spec + UI Visual Standards` | No final-commit target-style replay |
| R14 | [AGENTS.md:103-106](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L103-L106) | Narrow post-settle full-density style refresh only if no tween | `transition spec + UI Visual Standards` | Never replay broad page visibility/styles |
| R15 | [AGENTS.md:107-112](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L107-L112) | Explicit all-off MT boundary flags authoritative (DEC-145) | `UI/transition specs + DEC-145` | Default only if all visibility flags absent |
| R16 | [AGENTS.md:113-119](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L113-L119) | SEG-Y trace-header geometry and Miller CMP fields | `projects scientific owner + source tests` | IBM real CMP_X at byte 189, CMP_Y 193; inline 9-10, crossline 13-14 |
| R17 | [AGENTS.md:120-131](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L120-L131) | L5/L11 unverified registration; enhanced PSDM gate; surrogate exception | `projects scientific owner + DEC-148` | Retain canClaimPreciseRegistration:false, CRC gate, three regression commands |
| R18 | [AGENTS.md:132-135](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L132-L135) | No page- or fixture-specific quick legends or project file edits | `editor AGENTS + UI Visual Standards` | Prohibited pages/overlays/project/environment paths |
| R19 | [AGENTS.md:137-157](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L137-L157) | Bounded search, exclude bulk input/generated/archive directories | `root AGENTS + projects AGENTS` | Explicit subtree searches only when task needs excluded material |
| R20 | [AGENTS.md:159-171](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L159-L171) | Monolith list and symbol-first bounded reads | `root AGENTS + editor/scene AGENTS` | File size estimates historical; not reason to drop read limits |
| R21 | [AGENTS.md:173-178](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L173-L178) | Stop on doc contradiction; append DEC with explicit supersession | `root AGENTS + docs AGENTS [H02]` | Do not overwrite decisions; authority held |
| R22 | [AGENTS.md:180-187](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L180-L187) | Dev-only Vite persistence; no automatic storage rearchitecture | `root AGENTS + projects/editor AGENTS` | Must not replace with IndexedDB/LocalStorage/backend |
| R23 | [AGENTS.md:189-196](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L189-L196) | Raw archive historical provenance and path map | `projects AGENTS + docs provenance` | Historical Windows path informational, not checkout directive |
| R24 | [AGENTS.md:199-201](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L199-L201) | Disposable Utah authoring pages; synthetic app-behavior tests | `transition spec + Verification-Routing` | Deck state checks labeled separately |
| R25 | [AGENTS.md:203-211](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L203-L211) | No page-pair false fixes; reusable behavior families | `transition spec + verification owner` | No live pageOrder as application test proof |
| R26 | [AGENTS.md:213-219](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/AGENTS.md#L213-L219) | Required runtime-transition operating spec pre-read | `root/scene/editor AGENTS + transition specs` | Older audits/matrices evidence, not active runtime contract |
| R27 | [CLAUDE.md:30-42](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/CLAUDE.md#L30-L42) | Claude-only Page-Transitions-And-Section-Frames route | `root/docs AGENTS + transition docs` | Unique route MUST survive conversion to router |
| P01 | [projects/CLAUDE.md:3-13](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/projects/CLAUDE.md#L3-L13) | Four project anchors and mixed authoring/bulk content | `projects/AGENTS.md` | Original ~116MB Utah estimate recorded as historical |
| P02 | [projects/CLAUDE.md:15-28](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/projects/CLAUDE.md#L15-L28) | No blanket grep/glob in scientific data folders | `projects/AGENTS.md` | Binary, raster, coordinate and manifest search hazards; narrow Utah subtree example |
| P03 | [projects/CLAUDE.md:30-35](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/projects/CLAUDE.md#L30-L35) | /api/write-file and Vite disk persistence | `projects/AGENTS.md` | No silent IndexedDB/LocalStorage/backend replacement |
| P04 | [projects/CLAUDE.md:37-41](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/projects/CLAUDE.md#L37-L41) | Upstream local archive and historical source path mapping | `projects/AGENTS.md` | Pin old C:\GeoSee\GeoSee_Archive\ as historical provenance only |
| E01 | [src/editor/CLAUDE.md:3-35](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L3-L35) | R1 split, large editor files, extracted control clusters | `src/editor/AGENTS.md` | Source map preserved; sizes intentionally not assumed current |
| E02 | [src/editor/CLAUDE.md:23-32](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L23-L32) | No new extracted editor file over 800 lines | `src/editor/AGENTS.md` | Exact original hard cap; no discretionary review exception |
| E03 | [src/editor/CLAUDE.md:37-52](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L37-L52) | Small editor components, d-key inspector, pure testable modules | `src/editor/AGENTS.md` | Module map and React-free test subset retained |
| E04 | [src/editor/CLAUDE.md:44-52](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L44-L52) | DevModeInspector not manifest-protected source file | `src/editor/AGENTS.md` | Explicit exception retained |
| E05 | [src/editor/CLAUDE.md:54-62](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L54-L62) | Manifest IDs, add-before-usage, approval for restructure | `src/editor/AGENTS.md + manifest owner` | Preserve ID continuity and allowed removal metadata |
| E06 | [src/editor/CLAUDE.md:63-67](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L63-L67) | Grep and bounded Read; unique patch context for repeated panels | `src/editor/AGENTS.md` | Never full-read monolith to locate edit; do not mutate wrong panel |
| E07 | [src/editor/CLAUDE.md:68-70](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/editor/CLAUDE.md#L68-L70) | save.ts and Vite persistence | `src/editor/AGENTS.md` | Architecture change requires owner |
| S01 | [src/scene/CLAUDE.md:3-19](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/scene/CLAUDE.md#L3-L19) | R2 split and regrown SceneManager/section controller | `src/scene/AGENTS.md [REV-11]` | Record stated 1200-line cap separately from historical file counts |
| S02 | [src/scene/CLAUDE.md:21-32](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/scene/CLAUDE.md#L21-L32) | Extracted scene helper, loader, disposal, diagnostic and terrain map | `src/scene/AGENTS.md` | Specific module paths preserved |
| S03 | [src/scene/CLAUDE.md:34-41](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/scene/CLAUDE.md#L34-L41) | Product-aware opacity/transition code and regression test | `src/scene/AGENTS.md` | Historic commits and mandatory opacity test |
| S04 | [src/scene/CLAUDE.md:42-43](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/scene/CLAUDE.md#L42-L43) | Three.js disposeObjectTree central cleanup | `src/scene/AGENTS.md` | No ad-hoc disposal loops |
| S05 | [src/scene/CLAUDE.md:44-45](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/src/scene/CLAUDE.md#L44-L45) | Register layer kinds via layerLoaderRegistry | `src/scene/AGENTS.md` | No inline registration in SceneManager |
| D01 | [docs/dev-context/Active-Build-Context.md:1-274](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Active-Build-Context.md#L1-L274) | Current work router and engineering source map | `docs/AGENTS.md routes to active owner` | Volatile deck state not a generic runtime invariant |
| D02 | [docs/dev-context/Verification-Routing.md:5-44](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Verification-Routing.md#L5-L44) | Committed, local sketch, excluded work and accepted snapshot evidence modes | `docs/AGENTS.md and existing verification owner` | No broad test result as accepted-deck proof without clean state |
| D03 | [docs/dev-context/Verification-Routing.md:52-56](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Verification-Routing.md#L52-L56) | Human launcher/process safety | `existing Verification-Routing [H07]` | Port mismatch held; do not kill user dev server |
| D04 | [docs/dev-context/Transition-Constitution.md:3-44](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Transition-Constitution.md#L3-L44) | Transition authority claim, visual owner acceptance, page-independent policy | `docs/AGENTS.md routes to transition owner [H03]` | Draft versus active rank unresolved |
| D05 | [docs/dev-context/Transition-Constitution.md:46-53](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Transition-Constitution.md#L46-L53) | Symptom -> fixture -> family -> invariant -> decision -> target -> test -> human | `existing transition owner` | Preserve diagnostic workflow |
| D06 | [docs/dev-context/Transition-Continuity-Contract.md:10-91](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Transition-Continuity-Contract.md#L10-L91) | Resolved graphs, stable identity, per-channel one assignment, idempotent commit | `existing transition owner` | Do not replace with product-name special cases |
| D07 | [docs/dev-context/Transition-Guardrails.md:8-78](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Transition-Guardrails.md#L8-L78) | Tripwires, pre-reads, issue report fields, cheapest tests | `existing transition owner` | No page ID branches, fixture fixes or agent visual signoff |
| D08 | [docs/dev-context/Page-Transitions-And-Section-Frames.md:10-395](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Page-Transitions-And-Section-Frames.md#L10-L395) | Frame/ISO/opacity/MT compatibility and visual regression recipes | `docs/AGENTS.md plus existing transition owner` | Unique former Claude-only route now explicit |
| D09 | [docs/dev-context/Transition-Runtime-Operating-Spec.md:7-289](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Transition-Runtime-Operating-Spec.md#L7-L289) | Detailed transition entities, readiness, opacity, edit gating and final commit | `existing transition owner` | No broad replay or fixture-coupled fixes |
| D10 | [docs/dev-context/UI-Visual-Standards.md:1-595](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/UI-Visual-Standards.md#L1-L595) | Compact legends, global/page presets, visual transitions, handles | `existing UI spec + editor route` | No local quick legend hand-tuning |
| D11 | [docs/dev-context/Editor-Control-Manifest-Policy.md:10-119](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Editor-Control-Manifest-Policy.md#L10-L119) | Protected IDs, page archive, drag-reorder and approval metadata | `existing manifest owner + editor route` | No bypass of approvals and validation |
| D12 | [docs/06-editor-exposure-rules.md:13-146](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/06-editor-exposure-rules.md#L13-L146) | Editor completeness and five-question requirement for user-facing config | `docs/AGENTS.md + editor AGENTS` | Not feature-complete without GUI, persistence, visible human QA |
| D13 | [docs/dev-context/Runtime-Loading-Policy.md:11-197](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Runtime-Loading-Policy.md#L11-L197) | Load-class proposals, source-quality and computed-asset protections | `existing runtime policy + scene/projects` | Proposal marked not yet authorized for implementation |
| D14 | [docs/dev-context/Visual-Review-Current.md:5-115](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Visual-Review-Current.md#L5-L115) | Human visual acceptance distinct from browser/build checks | `existing visual-review owner` | No agent test as final visual acceptance |
| D15 | [docs/dev-context/Current-State.md:3-110](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/dev-context/Current-State.md#L3-L110) | Observed/proposed/unverified distinctions and parked paths | `docs/AGENTS.md routing + historical evidence [H06]` | Do not elevate stale 'current' labels |
| D16 | [docs/00-purpose.md:1](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/00-purpose.md#L1) | Purpose, non-diagnostic alpha and scientific-boundary claims | `docs/AGENTS.md plus product owner` | Do not claim independent GEODE common-spine runtime |
| D17 | [docs/03-decisions.md:1](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/03-decisions.md#L1) | Accepted decision history, explicit supersession and rationale | `docs/AGENTS.md plus DEC owner` | Keep DEC-049/051/145/148/179/184 traceable |
| D18 | [docs/LICENSING.md:1-36](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/docs/LICENSING.md#L1-L36) | Apache-2 software versus third-party data, external rights and sources | `docs/AGENTS.md and projects/AGENTS.md` | Preserve distribution/provenance boundary |

### Gating findings from the independent review

- **No root/Claude routing conversion in this chunk.** The root `AGENTS.md` and root/nested `CLAUDE.md` still have original substance. A provider-neutral root contract and import-only Claude router are pending full clause parity review; never delete original source text on the assumption that an AGENTS filename alone guarantees loading.
- **No automatic nested provider loading guarantee.** Scoping instructions in `src/editor/AGENTS.md`, `src/scene/AGENTS.md`, `projects/AGENTS.md` or `docs/AGENTS.md` does not by itself prove that agents started from the repository root read them before editing nested files. Scope routing and runtime loading tests remain pending; provider-specific adapters must not contain unique engineering rules.
- **Changed-rule corrections recorded:** Editor source says *no new extracted file exceeds 800 lines*, not “except after review”; large editor files remain bounded-read only. Original scene source says a stated 1,200-line controller cap, not merely an optional historic target. Archive root path is preserved as historical provenance and not a working-tree instruction. The missing Page Transitions and Section Frames route was added. Original Claude sources are now linked at immutable baseline revisions rather than current paths which would become routers.
- **CI limitations:** Existing mirror validation checks only `mirror:monoliths`, and `check:agent-drag` does not scan root `AGENTS.md`. Green CI cannot certify parity, full link graph, nested discovery or independent agent execution. No code/runtime test or actual Claude/Codex instruction-loading test was conducted in this phase.

**Status after these corrective edits:** Original existing files and all H01–H11 owner decision holds stay unchanged. Keep the PR in draft. Before an operational agent migration, independently audit every protected negative rule against its final owner, verify provider loading, and resolve/explicitly accept safety and authority blockers.


## Phase 2 review: shared root contract reconciled, Claude routers still held — 13 November 2026

**Branch-only change:** `AGENTS.md` is now titled a **shared engineering contract**, rather than identifying Codex as the sole audience and `CLAUDE.md` as the canonical author. This follows the owner's explicitly approved provider-neutral architecture. **It does not imply that any provider's existing instruction loader has been switched.** Root and nested `CLAUDE.md` files are intentionally unchanged; the 11 preexisting contradictions H01–H11 remain unresolved.

**Semantic comparison at baseline 29d9c4c7eee77ac1b104289b09b1382c574145d0:** Both original root contracts have 12 headings/sections when the intro is counted. The only non-whitespace differences between the baseline root `AGENTS.md` and root `CLAUDE.md` were in their intro, source-of-truth routing and search-hygiene details. All other sections had matching normalized content. The current root `AGENTS.md` preserves **all eight unchanged technical/operational sections exactly byte-for-byte**, including the lengthy MT, seismic, project-fixture and transition special cases.

| Source section | Exact Phase 2 treatment | Preservation result |
| --- | --- | --- |
| Intro / provider policy | Rewrite the provider-specific “CLAUDE is source of truth” statement to describe the requested **shared root**. Clearly state the parallel Claude file is *still substantive* until tested and converted. | Owner's target architecture stated; no premature import switch |
| First Read | Add explicit routing to `projects/AGENTS.md`, `src/editor/AGENTS.md`, `src/scene/AGENTS.md`, `docs/AGENTS.md` for agents launched outside those directories. Retain the original selective-first-read and historical-archive exceptions verbatim. | Original rule plus explicit scoped discovery |
| Source Of Truth | Preserve existing links and add the unique Claude routes: `README.md` as human landing, `docs/START-HERE.md` as stable orientation, and `docs/dev-context/Page-Transitions-And-Section-Frames.md`. Also route editor exposure and licensing to their existing owners. | No previously unique Claude-only route omitted |
| Search Hygiene | Preserve original excluded path list; incorporate Claude's nuance that gitignored build/dependency files may still be reachable through Glob/discovery. | Same bounded-search obligation, stronger explanatory exception |
| Output Rail | **No edit** | Exact original preserved, disputed writing scope remains H09 |
| Workspace Rules | **No edit** | Exact original preserved, unsafe hard-coded working tree remains H01 |
| Decision Discipline | **No edit** | Exact original preserved, code/document authority remains H02 |
| Authoring Persistence | **No edit** | Exact original preserved |
| Working Tree And Archive | **No edit** | Exact original preserved, historical/archive location remains |
| Disposable Page Fixture Rule | **No edit** | Exact original preserved |
| Page-to-page false-fix ban | **No edit** | Exact original preserved |
| Transition Runtime Operating Spec | **No edit** | Exact original preserved |

**Explicit safety warning:** The original root `AGENTS.md` and `docs/dev-context/Active-Build-Context.md` still direct agents into `C:\GeoSee\GeoSee_Dev`. Because this path can refer to an unsanitized internal checkout, do **not** merge PR #2 or declare public-checkout routing safe until the owner approves a source-preserving portable-root strategy (H01). Likewise the original document-vs-code and transition precedence disputes (H02/H03) were not settled.

### Draft future Claude adapter files — NOT WRITTEN OR ENABLED

The proposed future content for each `CLAUDE.md` file is a single import of the same-directory shared `AGENTS.md`. Each is a **candidate snippet for future review, not a tested runtime mechanism**:

| Proposed adapter path | Candidate complete content after verified conversion |
| --- | --- |
| root `CLAUDE.md` | `@AGENTS.md` |
| `projects/CLAUDE.md` | `@AGENTS.md` |
| `src/editor/CLAUDE.md` | `@AGENTS.md` |
| `src/scene/CLAUDE.md` | `@AGENTS.md` |
| `docs/CLAUDE.md` (if required) | `@AGENTS.md` |

**Conversion blockers:** Do not update any of those files until original-to-shared rule parity is independently established, the owner-reviewed holds affecting routing and source-of-truth are addressed, and actual Claude behavior for nested imports is verified. Other providers may require their own tiny adapters rather than treating Claude's syntax as portable. The current `CLAUDE.md` files must remain authoritative for Claude's actual execution until a verified switchover; no partial route-only transition.

**Verification evidence for this phase:** Static comparison establishes preservation of the eight untouched root sections and the previously Claude-only routing/search details. It is not a live Claude/Codex test, not a Windows local-worktree inspection, and not a full semantic equivalence certification of the future thin-router setup. GitHub CI must be inspected at the new branch HEAD separately. Keep this PR in **draft/unmerged** state.


## Phase 3: approved authority/workspace/writing changes — 13 November 2026

**Approved by the owner:** H01, H02, H03 and H09, as recorded in
[`DEC-189`](../../03-decisions.md). This section updates the *status* of
the historical Phase 1 holds table above; the historical table and the 61-group
original-source crosswalk remain preserved for auditing. No unapproved
conflict is resolved by implication.

| Hold | Approved change | Where the draft PR implements it |
| --- | --- | --- |
| H01 | Use the explicitly authorized checkout, find its root with `git rev-parse --show-toplevel`, verify identity/branch, never auto-switch to remembered Windows paths; preserve local archive path as provenance only | Root `AGENTS.md`, root `CLAUDE.md`, `Active-Build-Context.md`, `Visual-Review-Current.md`; `DEC-189` |
| H02 | Separate approved intended requirements from observed source/tests/manifests; record and hold any contradiction instead of automatically treating one as approved truth | Root `AGENTS.md`, root `CLAUDE.md`, `Active-Build-Context.md`, `docs/AGENTS.md`; `DEC-189` |
| H03 | Accepted DEC entries govern transition intent; active Runtime Operating Spec guides implementation; draft Constitution and Continuity Contract have no implicit overriding precedence, including their historical draft ranking | `Active-Build-Context.md`, `Transition-Constitution.md`, `Transition-Continuity-Contract.md`, `Transition-Runtime-Operating-Spec.md`, `docs/AGENTS.md`; `DEC-189` |
| H09 | Keep factual technical handoff style; allow appropriate natural language in README, tutorials, documentation, UX and other human-facing writing | Root `AGENTS.md`, root `CLAUDE.md`, `Active-Build-Context.md`; `DEC-189` |

**Why the root `CLAUDE.md` was narrowly edited:** It still contains a
substantive working contract, and Claude may load it ahead of `AGENTS.md`.
Leaving the old automatic checkout-switch instruction or universal writing
restriction in that active file would contradict the approved decisions.
Its substantive non-approved rules, and all three nested `CLAUDE.md` files,
remain intact. **No file has been converted into an importer or router.**

**Remaining holds (not approved here):**
H04 root mirror CI/provider parity; H05 missing transition evidence register;
H06 stale historical current-state references; H07 human launcher port
mismatch; H08 fixture reproduction versus generic test enforcement;
H10 product-aware adapters versus generic transition policy; H11 actual
cross-provider root/nested instruction discovery. Existing evidence for these
remains unchanged; do not silently fix them in this stage.

**Verification gate:** Review the full GitHub diff, run static documentation
and CI checks, preserve the original 61-row matrix and historical file links,
and leave the PR in **draft/unmerged** state. There are no actual Claude/Codex
loading tests and no application-level behavior changes in this phase.
