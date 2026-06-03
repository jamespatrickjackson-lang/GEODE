# SUPERSEDED - NOT CURRENT EDITOR GUIDANCE

This historical package-workbench document is preserved for reference only.
Current work is governed by `../EDITOR-SPEC.md` and targets
`UI_EDITOR/gui-editor.html`.

# v1 Agent Automation Runbook

## 1. Goal

This is the entry-point document for an autonomous coding agent (Codex, Claude Code, or similar) tasked with building v1 end-to-end without human intervention. The runbook drives the [10_build_phases.md](10_build_phases.md) sequence to completion overnight.

The runbook is **prescriptive**: the agent runs the steps exactly as written, in order, without improvising scope. Improvisation belongs in `git commit` time when a phase needs adapter fixes that the docs did not anticipate.

## 2. Preconditions

Before invoking the runbook:

| # | Precondition | Verification |
| --- | --- | --- |
| 1 | Repo is at `C:\GeoSee\GeoSee_Dev\` with a clean working tree on `main` (or a designated feature branch). | `git status --porcelain` is empty. |
| 2 | `UI_EDITOR/docs_v1/` contains all 23 docs (00 – 22) referenced by this runbook. | `ls UI_EDITOR/docs_v1/` shows `00_README.md` through `22_mvp_coherence_audit.md` (23 files total). |
| 3 | `UI_EDITOR/docs/` (the v0.1 concept pack) is untouched. | `git status` shows no modifications to `UI_EDITOR/docs/`. |
| 4 | Node.js ≥ 20.x available; npm ≥ 10.x available. | `node --version && npm --version`. |
| 5 | Agent has read [00_README.md](00_README.md), [09_glossary.md](09_glossary.md), [01_scope.md](01_scope.md), [02_architecture.md](02_architecture.md), [10_build_phases.md](10_build_phases.md) in full. | Agent must self-verify before step 0. |
| 6 | Agent operates from `C:\GeoSee\GeoSee_Dev\` as the working directory. All paths in this doc are relative to that root. | `pwd` returns the repo root. |

If any precondition fails, the agent must stop and surface to the human author rather than improvise.

## 3. Operating principles

These bind for the entire run:

1. **Trust the docs over instinct.** Where this pack conflicts with the agent's own model of "good design", the pack wins.
2. **One phase, one commit.** No combined commits. No empty commits.
3. **No `--no-verify`.** No `--amend` on a phase that has been committed.
4. **Stop on red.** If a phase's acceptance fails after two diagnose-and-fix passes, halt and emit a structured failure report (§9 below).
5. **CLAUDE.md applies.** No first/second-person pronouns in commit messages, doc edits, or code comments. Search hygiene (no Grep into `projects/*/data/**`, `dist*/**`, `node_modules/**`, etc.). No imports from outside `UI_EDITOR/` into `UI_EDITOR/src/`.
6. **No external network calls** during the build. All dependencies must come from npm registry resolution via `npm install`; no curl, no fetch to unknown hosts.
7. **No new tools beyond Read / Write / Edit / Bash / Glob / Grep.** v1 build does not need browser automation, image processing, or external services.
8. **Quote ranges in commit messages**, not exact line numbers (line numbers drift across phases).
9. **The agent may not modify docs_v1/** during the run. If a doc is wrong, surface to the human; do not silently rewrite.
10. **The agent may not modify ../src/, ../projects/, ../docs/, ../tests/, ../plugins/, or any GeoSee root config.** v1 work is isolated to `UI_EDITOR/`.

## 4. Run procedure

### 4.1 Phase 0 — Scaffolding

```text
1. Read 10_build_phases.md §3 "Phase 0".
2. Create files per the Phase 0 spec.
3. cd UI_EDITOR && npm install.
4. npm run check.    # expect exit 0
5. npm run dev &     # start dev server in background
6. curl -sI http://localhost:5174 | head -1   # expect HTTP/1.1 200 OK
7. Kill dev server.
8. git status --porcelain | head           # list files to stage
9. git add UI_EDITOR/package.json UI_EDITOR/package-lock.json \
           UI_EDITOR/tsconfig.json UI_EDITOR/vite.config.ts \
           UI_EDITOR/index.html UI_EDITOR/README.md \
           UI_EDITOR/src/main.tsx
10. git commit -m "Phase 0: scaffold UI_EDITOR with Vite + React + TS, Hello Workbench shell

Co-Authored-By: <agent>"
11. git log --oneline -1   # verify the commit
```

### 4.2 Phases 1–13 — repeat per phase

For each phase N in `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]`:

```text
1. Re-read 10_build_phases.md §3 "Phase N".
2. Re-read the linked detail doc(s) referenced by the phase spec.
3. Create / edit files per the spec. Use Edit for existing files; Write for new.
4. After all edits:
   - cd UI_EDITOR && npm run check          # tsc clean
   - npm run test (if test files exist for the phase)
   - Run the phase's acceptance check list (cited in the phase spec).
5. If any acceptance fails:
   - Diagnose. Re-read the relevant detail doc.
   - Fix and re-run acceptance.
   - If still failing after a second pass, STOP and emit failure report (§9).
6. git status --porcelain   # confirm only intended files modified
7. git add <exact phase files>
8. git commit -m "Phase N: <summary from 10_build_phases.md §3>

Co-Authored-By: <agent>"
9. git log --oneline -1
```

### 4.3 Phase 14 — End-to-end smoke

```text
1. Re-read 10_build_phases.md §3 "Phase 14".
2. Update UI_EDITOR/README.md to point at docs_v1/00_README.md.
3. Clean checkout simulation:
   - rm -rf UI_EDITOR/node_modules UI_EDITOR/dist
   - cd UI_EDITOR && npm install
   - npm run check
   - npm run test
   - npm run dev &
   - Run a scripted interaction smoke (see §6 below).
   - Kill dev server.
4. Run every acceptance check from every prior phase as a final pass. Record results.
5. Verify the 16 Definition-of-Done items in 01_scope.md §4 all hold.
6. git add UI_EDITOR/README.md   # only file modified in this phase
7. git commit -m "Phase 14: v1 end-to-end smoke; documentation lint clean

Co-Authored-By: <agent>"
8. Emit final success report (§8 below).
```

## 5. Per-phase agent prompt template

When the orchestrating layer spawns a sub-agent for a single phase, it uses this prompt template:

```text
You are executing Phase N of the GUI Workbench v1 build.

Read the following docs IN FULL before doing anything:
  - C:/GeoSee/GeoSee_Dev/UI_EDITOR/docs_v1/10_build_phases.md (§3 "Phase N")
  - <every doc cross-referenced by that phase>

Then:
  - Create / edit only the files listed in the phase spec.
  - Do not modify files outside UI_EDITOR/.
  - Do not modify UI_EDITOR/docs_v1/.
  - Do not modify UI_EDITOR/docs/.
  - Run `npm run check` and `npm run test` from UI_EDITOR/ after editing.
  - Run the phase's acceptance checks.
  - If all green, stage exact paths and commit with the message from the phase spec.
  - Surface failure with a structured report if acceptance fails after two fix passes.

CLAUDE.md applies. No first/second-person pronouns in any output.
```

The orchestrating layer reads the sub-agent's output, verifies the commit exists, and proceeds to the next phase.

## 6. Phase 14 smoke interactions

The Phase 14 smoke is an automated sequence the agent runs against a freshly-launched dev server. Each interaction is observable via DOM inspection; no browser automation tool is needed (v1 acceptance is manual-able). The agent may scripts these via direct DOM access in the dev console or via a small Node script that hits the Vite plugin endpoints.

Minimum smoke sequence:

1. Launch workbench; verify package browser lists `geosee_editor_sidebar`.
2. Click `geosee_editor_sidebar`; verify all 16 Frames appear on Canvas.
3. Activate Select Tool; click a Component on `frame-page-manager`; verify Layers Panel highlights matching row + Properties Inspector renders props.
4. Activate Move Tool; arrow-key nudge the Selection; verify position updates.
5. Activate Resize Tool; drag a corner handle; verify resize honours snap.
6. Drag a Swatch from Colour Library onto the Selection; verify fill updates.
7. Click Validate button; verify finding list populates.
8. Switch active background to `noise_low_contrast`; verify contrast rule re-evaluates.
9. Click Save; verify `manifest.json` `updatedAt` advances; verify `change_log.json` has new record.
10. Click Export; verify `docs/spec.md` and `docs/ai_agent_brief.md` regenerated; verify both files non-empty.
11. Re-import the package; verify Frame layout identical.
12. Instantiate the GeoSeeAdapterStub; verify it throws.

Each step must pass before declaring Phase 14 done.

## 7. Time budget (rough)

- Phases 0 – 3 (scaffolding + schema + IO + shell skeleton): ~2 hours.
- Phase 4 (Canvas Engine): ~6 hours — the deepest single phase.
- Phase 5 (Toolkit): ~3 hours.
- Phase 6 (Libraries): ~3 hours.
- Phase 7 (straw-subject package): ~4 hours (hand-modelling sidebar).
- Phase 8 (Validation): ~3 hours.
- Phase 9 (Editing): ~2 hours.
- Phase 10 (Background): ~1 hour.
- Phase 11 (Inspector): ~3 hours.
- Phase 12 (Export): ~2 hours.
- Phase 13 (Adapter contract): ~30 minutes.
- Phase 14 (Smoke): ~1 hour.

Total: **~30 hours of agent time** for a single sequential agent. Achievable overnight if the agent runs continuously and the docs prevent backtracking (which is the entire point of this pack).

## 8. Success report template

On Phase 14 completion, emit:

```text
v1 BUILD SUCCESS

Phases committed: 0 → 14 (15 commits).
Final commit: <sha> "Phase 14: v1 end-to-end smoke; documentation lint clean"

Definition-of-Done checks (01_scope.md §4):
  1. Workbench launches: PASS
  2. Bundled package auto-loads: PASS
  3. Canvas interactions work: PASS
  4. Rulers + snapping correct: PASS
  5. Anchors + smart guides: PASS
  6. Toolkit complete: PASS
  7. Libraries complete: PASS
  8. Validation correct: PASS
  9. Background Stress Test: PASS
 10. Package round-trip: PASS
 11. Spec + brief exports: PASS
 12. Change Log integrity: PASS
 13. tsc clean: PASS
 14. No GeoSee imports: PASS
 15. Adapter contract present: PASS
 16. Automation runbook runs end-to-end: PASS

Working tree: clean.
Suggested next: hand off to human author for visual review.
```

## 9. Failure report template

When acceptance fails after two fix passes, emit the structured report below and halt. The report is the only output the human reviewer sees; make it information-dense and decision-ready.

```text
v1 BUILD HALTED AT PHASE N

═══════════════════════════════════════════════════════════════════════
Summary
═══════════════════════════════════════════════════════════════════════
Last successful phase: <N-1>           Commit: <sha>
Failing phase:         <N>             Time spent: <minutes>
Root cause hypothesis: <one sentence — the agent's best guess>

═══════════════════════════════════════════════════════════════════════
Failing acceptance check(s)
═══════════════════════════════════════════════════════════════════════
- [<id>] <title from the relevant phase doc>
  Expected: <one line>
  Observed: <one line>
  Reproduce: <exact command or DOM action>

- [<id>] ...

═══════════════════════════════════════════════════════════════════════
Diagnosis attempts
═══════════════════════════════════════════════════════════════════════
Attempt 1:
  Hypothesis: <one sentence>
  Action:     <files changed; commands run>
  Result:     <what changed in the failing acceptance>

Attempt 2:
  Hypothesis: <one sentence>
  Action:     <files changed; commands run>
  Result:     <what changed in the failing acceptance>

═══════════════════════════════════════════════════════════════════════
Environment snapshot
═══════════════════════════════════════════════════════════════════════
node --version:    <output>
npm --version:     <output>
git rev-parse HEAD:<sha>
git status --porcelain (truncated to 50 lines):
  <output>

UI_EDITOR/package.json critical deps:
  react:        <version>
  vite:         <version>
  typescript:   <version>

═══════════════════════════════════════════════════════════════════════
Suspected file(s)
═══════════════════════════════════════════════════════════════════════
- <path>           — <why the agent suspects it>
- <path>           — <why the agent suspects it>

═══════════════════════════════════════════════════════════════════════
Suggested human action
═══════════════════════════════════════════════════════════════════════
Priority 1: <the most likely correction; cite the relevant docs_v1 section>
Priority 2: <alternative if Priority 1 is wrong>
Priority 3: <docs_v1 revision candidates — if the doc itself is wrong>

═══════════════════════════════════════════════════════════════════════
Working tree state
═══════════════════════════════════════════════════════════════════════
Uncommitted changes from the failed phase: PRESENT
Last clean commit: <sha> "<message>"
To roll back: git checkout -- .
To inspect:   git diff <sha>..HEAD
```

### 9.1 Failure modes and templated diagnoses

When the failure matches a known mode, populate the "Root cause hypothesis" with the matching template:

| Failure mode | Hypothesis template |
| --- | --- |
| `tsc` reports new errors after a new schema field added | "Type union update in `core/schema/` is incomplete; consumer in `<file>` did not absorb the new field." |
| Acceptance check 1 fails: workbench does not launch | "Vite config or entry point misconfigured; check `vite.config.ts` plugin order and `index.html` mount point." |
| Snap test fails: positions land 1 px off | "Snap math returns Frame-space delta but caller applies Screen-space delta (or vice versa); recheck `canvasMath.ts`." |
| Drag-to-instantiate fails silently | "HTML5 drag-and-drop dataTransfer payload mis-keyed; check `LibraryPanel` `dragstart` handler." |
| Save returns 403 from Vite plugin | "Path policy allowlist regex does not match the path being written; check `pathPolicy.ts` against `07_package_format.md` §2." |
| Validation finding has wrong severity | "`SEVERITY_ORDER` array out of sync with `09_glossary.md` §2 strict ladder." |
| Change Log entries missing for an edit | "Reducer dispatched the edit but did not append; check the `applyEdit` consumer in `shellReducer.ts`." |
| Round-trip diff non-empty | "Canonicalisation rule violation; check JSON serialiser key ordering and decimal precision in `writePackage.ts`." |
| Adapter stub type-check fails | "`HostAppAdapter.ts` interface drifted; recompare against `02_architecture.md` §3.3." |
| `npm install` fails | "Lockfile version mismatch with Node version; capture `node --version` in the report and surface to human." |

If the failure mode is novel (not in this table), populate the hypothesis with a freeform best guess and flag "novel mode" in the report.

### 9.2 Quick triage commands

The agent runs these and includes the output in the report:

```bash
# State
git status --porcelain | head -50
git log --oneline -10
git diff --stat HEAD

# Build / lint
cd UI_EDITOR && npm run check 2>&1 | tail -40
cd UI_EDITOR && npm run test 2>&1 | tail -40

# Filesystem
find UI_EDITOR/src -type f | wc -l
ls -la UI_EDITOR/packages/geosee_editor_sidebar/ 2>&1

# Env
node --version
npm --version
```

Output of each goes into the "Environment snapshot" / "Working tree state" sections of the report.

## 10. Resumption

If the run is interrupted (power loss, agent timeout, manual halt) mid-phase but before commit, the agent on resume must:

1. Inspect `git status --porcelain` to see what is uncommitted.
2. Read the failing phase doc.
3. Compare uncommitted state to the phase deliverable.
4. Either: discard the uncommitted work (`git checkout -- ...`) and re-run the phase from scratch, OR: complete the phase from the partial state if the partial state is recognisable.
5. Resume the runbook from §4.2 step 1 of the failing phase.

If the run is interrupted AFTER commit (mid-next-phase), resume from §4.2 of the next phase.

## 11. Idempotence

The runbook is **not** idempotent across re-runs. Re-running on top of an already-built `UI_EDITOR/` will fail at Phase 0 (files already exist). To re-run cleanly:

```bash
git checkout main
git branch -D ui-editor-v1-build  # if branch exists
git switch -c ui-editor-v1-build
rm -rf UI_EDITOR/node_modules UI_EDITOR/dist UI_EDITOR/src UI_EDITOR/plugins UI_EDITOR/packages
# (Keep UI_EDITOR/docs/ and UI_EDITOR/docs_v1/ — those are sources, not build output.)
# Then invoke the runbook from Phase 0.
```

The runbook never edits `docs_v1/`; rerunning is safe with respect to documentation.

## 12. Hand-off

On successful run, the agent emits the success report (§8) and stops. It does NOT:

- Push to remote (the human controls when to push).
- Open a pull request.
- Modify CLAUDE.md or any GeoSee-root file.
- Modify the docs_v1 pack.
- Begin v2 work.

The human reviewer takes it from here.
