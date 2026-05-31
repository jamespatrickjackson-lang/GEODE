# v1 Known Pitfalls

## 1. Purpose

Pre-warn the executing agent about the failure modes most likely to halt the build, with the diagnostic shortcut for each. Read this before any acceptance check fails — and definitely before declaring "the docs are wrong." Many "the docs are wrong" reports trace back to one of the patterns below.

Organised by phase + by category. Severity rank: 🔥 likely to halt the run; ⚠️ likely to waste an hour; 🪤 subtle, easy to ship without noticing.

## 2. Pitfalls by phase

### Phase 0 — Scaffolding

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Vite picks port 5173 (collision with GeoSee dev server) | `npm run dev` fails or runs on 5174 silently | `cat UI_EDITOR/vite.config.ts \| grep port` | Set `server: { port: 5174, strictPort: true }` in `vite.config.ts`. |
| ⚠️ tsconfig extends a path that does not exist | `npm run check` reports cannot find `extends` | `cat UI_EDITOR/tsconfig.json` | Either remove the `extends` field or point at `../tsconfig.json` only if confirmed present. Default to no `extends`; ship full config. |
| ⚠️ React JSX runtime not set | First .tsx file fails to compile | tsc error mentions `'react/jsx-runtime'` | Set `"jsx": "react-jsx"` in tsconfig `compilerOptions`. |

### Phase 1 — Core schema + util

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Discriminated union missing the `archetype` literal in branches | Type narrowing fails downstream | Compiler can't narrow `ComponentProps` from a string | Each branch in the union MUST start with `archetype: "literal"` as a tag property. |
| 🪤 `IntentAnnotations` placed on Component but not on Container or Frame | Inspector shows intent on one but not the other | Grep `IntentAnnotations` in `src/core/schema/` | Add `intent?: IntentAnnotations` to all three: `Component`, `Container`, `Frame`. Library entry variants per [13](13_element_intent_annotations.md) §2. |
| 🪤 `clone<T>` uses `JSON.parse(JSON.stringify(v))` and silently drops `undefined` fields | Edits seem to apply but properties go missing | Add a unit test: `clone({ a: undefined })` round-trips with `a` present | Use `structuredClone` (Node 17+, available in browser ≥97) or a recursive deep-clone that preserves `undefined`. |

### Phase 2 — Package IO + plugin

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Path policy regex too loose | Symlink or `..` traversal slips through | Run the §12 acceptance check 3 in [17](17_security_model.md) | The regex in [17](17_security_model.md) §4.1 is the canonical source; copy it verbatim. Plus run `fs.realpath` and compare. |
| 🔥 Plugin registered in production (`apply` missing) | `npm run build` ships the plugin endpoints | `vite build && grep -r "geosee-workbench-package-write" dist/` | Set `apply: "serve"` in the plugin factory return. |
| ⚠️ `writePackage` writes files non-atomically | Mid-save crash leaves a partial package on disk | Force a write failure mid-batch; check for `.tmp` files | Use temp-rename strategy per [17](17_security_model.md) §7. Delete all `.tmp` files in the same batch if any fail. |
| 🪤 JSON key ordering non-deterministic | Round-trip diff non-empty | Run `roundTrip.test.ts` (Phase 1 unit test) | Sort object keys alphabetically before `JSON.stringify`. Strip trailing zeros from decimals. Use lowercase hex. 2-space indent. |
| 🪤 `manifest.updatedAt` not advanced on save | Change Log integrity rule fires | Save twice; check `updatedAt` differs | Reducer must set `updatedAt = new Date().toISOString()` inside the save flow, BEFORE the write batch is sent. |

### Phase 3 — State + Shell skeleton

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Reducer mutates state instead of returning new state | React doesn't re-render after an edit | Inspect with React DevTools; state ref unchanged | Reducer must be pure. Use spread or `structuredClone` for any nested mutation. |
| 🪤 `ShellContext` value re-created every render | Whole subtree re-renders unnecessarily | Performance Monitor shows lag | Wrap the context value in `useMemo` with proper deps. |
| 🪤 Wrong port on the package IO client | API calls 404 | Browser network tab shows wrong origin | `packageWriteClient.ts` should call `/api/package/*` relatively (no hostname), letting Vite proxy. |

### Phase 4 — Canvas Engine 🔥 (highest complexity phase)

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Coordinate system mix-up (screen vs canvas vs frame) | Drag lands ~10-100 px off | Place an element at (50, 30); drag it; observe end position | Use the three explicit helpers from [03](03_canvas_engine.md) §2; never inline coordinate math. Document which space each variable is in (`mouseScreen`, `mouseCanvas`, `mouseFrame`). |
| 🔥 Snap threshold computed in canvas-space but threshold is screen-px | Snap behaviour wrong at non-unity zoom | Snap to 4 px; zoom to 200%; should still feel 4 screen-px | Divide `thresholdPx` by `zoom` when comparing against canvas-space distances. See [03](03_canvas_engine.md) §7. |
| ⚠️ Anchor computation includes the element being dragged | Element snaps to its own old position | Drag a single element; it doesn't move smoothly | Pass `excludeIds` containing the dragged element's id to `anchorsForFrame`. |
| ⚠️ Smart guides persist after pointer release | Visual clutter | Drag stops; alignment lines linger | `GuidesLayer` consumes smart guides from a ref that clears on pointerup. |
| 🪤 Hidden elements counted in Anchor set | Snap to invisible element's edge | Hide an element; drag a sibling near where it was | Filter `hidden === true` out of `anchorsForFrame`'s input. |
| 🪤 Resize doesn't honour min size | Element shrinks to 0×0 | Drag a corner inward through the centre | `applyResize` clamps both dimensions to `minSize`. Default `8×8`. |
| 🪤 Aspect-ratio lock only works on one corner | Shift held on NE handle works, on SW doesn't | Test all 4 corners | `applyResize` must check `handle in {ne,nw,se,sw}` for lock eligibility, then preserve initial w/h ratio. |
| 🪤 Marquee selection counts partially-enclosed elements | Too many elements selected | Marquee that grazes an element's edge | Selection rule per [03](03_canvas_engine.md) §12: "wholly enclosed" — use `rect.contains(elementRect)`. |
| 🪤 Constraints applied before snap | Element resists snap when parent is fixed-size | Resize an element pinned-stretch | Snap first, then constraint clamp. |

### Phase 5 — Toolkit

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Tool keyboard shortcut fires while typing in inline text edit | Tool switches mid-edit | Click a `inline-editable-text`; type "v" | Wrap key handlers with `if (document.activeElement?.tagName === "INPUT") return;`. |
| 🪤 Cursor stuck after pointer-up (e.g. NW-resize cursor persists) | UX feels broken | Resize an element; release | Reset cursor to Tool's base `cursorCss` in pointerup. |
| ⚠️ Eyedropper reads wrong colour (CSS computed colour vs rendered pixel) | Swatch sampled doesn't match what user sees | Sample over a transparent element | Use `document.elementFromPoint` + `getComputedStyle(...).backgroundColor`. Composite with parents if `transparent` returned. For background asset reads, use a pre-loaded ImageBitmap. |
| 🪤 Align Tool with 1 element aligns to Selection (no-op) instead of Frame | Author confused | Single-select; click Align Centre | Per [04](04_toolkit.md) §3.9 reference rule: Selection size = 1 → align to Frame bounds. |

### Phase 6 — Libraries

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Drag-and-drop dataTransfer payload uses wrong format | Drop silently does nothing | Browser devtools → check `event.dataTransfer.getData(...)` | Use `setData("application/x-workbench-library-entry", JSON.stringify({ libraryKind, entryId }))`. Match key in handler. |
| 🪤 Token `{ tokenRef }` not resolved at render time | Tokens edit but elements don't reflect change | Edit `space.md`; check Component padding | Renderer must resolve `tokenRef` → token value at every render, not just at instantiation. |
| 🪤 Removing a Library entry leaves orphan `tokenRef` references | Elements break silently | Remove a Swatch in use | Validation rule `library.unresolved-token-ref` (Warning) catches; do not auto-remove references. Surface the count in the remove confirm. |

### Phase 7 — Straw-subject package

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Hand-modelling skipped because "the schema isn't ready yet" | Phase 7 not done; Phase 8/9/etc. lack a real package to validate | Check `packages/geosee_editor_sidebar/frames.json` for ≥16 Frames | Phases 1–6 must produce the schema and IO and libraries; Phase 7 then assembles the package using them. Do not skip. |
| ⚠️ Background assets generated non-deterministically | Round-trip test fails | Re-run asset generator; bytes differ | Seed all random generators with the constants from [03](03_canvas_engine.md) §16.1. |
| 🪤 Hand-modelled positions snap to wrong gridsize | Layout looks off by 1 px throughout | Inspect any element's `rect.x` | Default pixel grid is 1 px; if author switched to 8 during modelling, positions round to multiples of 8 — fine, but be consistent. |

### Phase 8 — Validation

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Severity ordering wrong | "Worst severity" returns Warning when Blocker exists | Run validation; check sort order | Use the exact array `["info", "suggestion", "warning", "error", "blocker"]` for `SEVERITY_ORDER`. Per [09](09_glossary.md) §2 strict ladder. |
| 🪤 Contrast rule does not factor in alpha | Semi-transparent fill on dark background scores wrong | Run on a `rgba(255,255,255,0.3)` over `#000` | Composite the foreground over the background before computing WCAG contrast. Implementer reference: `srgb.alpha-compose`. |
| 🪤 Restricted Surface rules run on every validation pass instead of at edit time | Validation panel cluttered with "edit refused" findings that don't apply | Run validation on a stable package | Per [08](08_validation_rules.md) §8: §4.6 Restricted Surface rules run inside `applyEdit` only, never in `runValidation`. |
| 🪤 Intent rules listed as Blockers | Author can't save anything | Add a new Component with no intent; try to save | Per [13](13_element_intent_annotations.md) §5: intent rules are all Suggestion / Warning / Error (never Blocker). |

### Phase 9 — Editing + Change Log

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Edits applied directly without `applyEdit` gate | Restricted Surfaces become mutable | Try to mutate a locked element's property via the Inspector | Every property write path must call `applyEdit`. No direct reducer state mutation outside `applyEdit`'s return value. |
| ⚠️ Change Records appended for ephemeral edits (pan/zoom/select) | Change log floods | Pan the canvas; check `change_log.json` after save | Check `editClass: "schema" \| "ephemeral"` on `applyEdit` return; only schema edits append. |
| 🪤 `editClass` field missing on `applyEdit` result | `state_demoted_to_draft` never fires (or always fires) | State transitions wrong | Add `editClass` per [16](16_change_state_machine.md) §5. |

### Phase 10 — Background Stress Test

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Asset load happens on every render | Frame chugs when switching backgrounds | Switch backgrounds repeatedly; observe lag | Load assets once into a `Map<id, ImageBitmap>` cached at the shell level. |
| 🪤 Contrast rule does not re-evaluate on background swap | Findings list stale | Swap dark→light; rerun Validate | Rule reads `state.activeBackgroundId`; full validation re-run on swap (or incremental for the contrast rule only). |

### Phase 11 — Properties Inspector

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Multi-selection shows the first element's properties (instead of "Multiple values") | Author edits one element thinking they edit all | Select 2 with different `name`; check field | Per [15](15_ui_states_and_feedback.md) §2 row "Selection — multiple": Inspector shows shared properties only; differing fields show "Multiple values". |
| 🪤 Inspector commits on every keystroke | Change log floods + perf issues | Type in a text field | Commit on blur or Enter only. Live-update local state (preview), but only dispatch `applyEdit` on commit. |
| 🪤 Locked property field is editable | Restricted Surface bypassed via Inspector | Select a locked element; try to edit a locked field | Inspector renders the field disabled with a tooltip. The `applyEdit` gate would still refuse, but UX should not let the author try. |

### Phase 12 — Export

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 `ai_agent_brief.md` includes `authorNotes` | Author's private notes leak to downstream agents | Set `authorNotes: "secret"`; export | Per [13](13_element_intent_annotations.md) §4.2: `authorNotes` excluded from `ai_agent_brief.md`. Render only in `spec.md`. |
| 🪤 Export framing line wrong for state | All exports say "DRAFT export" | Export from Validated state; check first line | Per [16](16_change_state_machine.md) §10: framing depends on `packageState`. |
| 🪤 `spec.md` not regenerated on every export | Stale spec | Edit a label; export; check spec | Export = Save + force-regenerate docs/*. Per [07](07_package_format.md) §14.3. |

### Phase 13 — Adapter contract

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🪤 Stub doesn't throw (returns `undefined` or default values) | Future v2 implementers think v1 is "already wired" | Call any method on the stub | Every method body: `throw new Error("HostAppAdapter not implemented in v1 — embedded mode is v2+")`. |
| 🪤 Interface field added to satisfy a future need without docs update | v2 design drifts | Compare `HostAppAdapter.ts` to [02](02_architecture.md) §3.3 | The interface in [02](02_architecture.md) §3.3 is canonical. Do not add fields without updating that doc; if you would need to, halt and surface. |

### Phase 14 — End-to-end smoke

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 Clean checkout simulation skipped | Build only "works" with warm caches | Run `rm -rf UI_EDITOR/node_modules UI_EDITOR/dist; npm install; npm run dev` from scratch | Phase 14 spec requires the clean-checkout sim. Do not skip. |
| ⚠️ Smoke sequence run with active dev server already up | First few steps misleading | Kill dev server before smoke | Phase 14 procedure: kill any running server first. |
| 🪤 README.md update forgotten | Final commit doesn't include README | `git diff HEAD~1 -- UI_EDITOR/README.md` empty | Phase 14 spec requires updating `UI_EDITOR/README.md` to point at `docs_v1/00_README.md`. |

## 3. Cross-cutting pitfalls

These apply across multiple phases.

| Pitfall | Symptom | Diagnostic | Fix |
| --- | --- | --- | --- |
| 🔥 An edit silently rewrites a doc in `docs_v1/` | Contract drift; agent ends up executing against a different version than committed | `git diff` shows changes to `docs_v1/*.md` you did not intend | The operating principle "no doc modifications during the run" is binding. Revert immediately. |
| 🔥 GeoSee source imports leak into `UI_EDITOR/src/` | Boundary violation | `grep -r "from \"\.\./\.\./src\|from \"\.\./\.\./projects" UI_EDITOR/src` returns results | Remove the import; rewrite using only `UI_EDITOR/src/` resources. |
| ⚠️ Adding a new dependency without lockfile update | Reproducible build broken | `git status` shows `package.json` changed but `package-lock.json` not | Always run `npm install` (no flags); commit both files together. |
| ⚠️ Commit includes files from multiple phases | Phase isolation lost | `git diff --stat HEAD~1` shows files from two phases | Reset the commit; redo with exact-paths `git add`. Use `git add -p` if needed. |
| 🪤 `npm run check` exits 0 but emits warnings | Warnings ignored, accumulate | `npm run check 2>&1 \| tail -20` | tsc warnings are not errors but should be triaged. If a warning is real, fix it; if benign, suppress with a targeted `// @ts-expect-error` + comment. |
| 🪤 Commit message uses first/second-person | CLAUDE.md violation | grep commits for "I ", "we ", "our ", "you " | Rewrite commit message; agents have a pass-by-author footer but the body must be agent-objective. |

## 4. Diagnostic shortcuts

When acceptance fails, run this sequence first before deeper debugging:

```bash
# 1. Is the failure novel or known?
grep -l "<symptom keyword>" UI_EDITOR/docs_v1/19_known_pitfalls.md

# 2. What changed since the last green phase?
git diff HEAD..HEAD~1 --stat
git status --porcelain

# 3. Is tsc green?
cd UI_EDITOR && npm run check 2>&1 | tail -20

# 4. Is the package readable?
cd UI_EDITOR && curl -s -X POST http://localhost:5174/api/package/read \
  -H "Content-Type: application/json" \
  -d '{"packageId":"geosee_editor_sidebar"}' | head -c 500

# 5. Is the failing rule id real?
grep "<rule-id>" UI_EDITOR/docs_v1/08_validation_rules.md
```

If the failure matches an entry in §2, use the suggested fix. If novel, run the full failure-report template from [11](11_agent_automation_runbook.md) §9.

## 5. When the docs are actually wrong

It happens. If after careful reading the docs genuinely contradict themselves or are silent on a required behaviour:

1. Halt the run before committing.
2. Identify the precise contradiction or gap (cite file + section + exact wording).
3. Emit the failure report with `Root cause hypothesis: documentation gap — <gap description>`.
4. Surface to the human. Do NOT edit the docs to "fix" the gap — that breaks the contract pinning.

The human will either patch the docs (and the agent re-runs from the affected phase) or clarify in a follow-up prompt (and the agent proceeds with the clarification recorded in the commit message).

## 6. Pre-flight checklist for the agent

Before starting Phase 0, the agent should verify:

```text
☐ git status is clean
☐ git branch is the dedicated build branch (not main)
☐ Node ≥ 20.x available
☐ npm ≥ 10.x available
☐ Read 00_README, 09_glossary, 01_scope, 02_architecture, 10_build_phases, 11_runbook, 19_pitfalls (this doc) in full
☐ Confirmed the docs pack git sha matches the cold-start prompt
☐ Confirmed no `UI_EDITOR/src/` or `UI_EDITOR/packages/` exists yet (Phase 0 will create)
```

Any unchecked box → halt and surface before writing any code.
