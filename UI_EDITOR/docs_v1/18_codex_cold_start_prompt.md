# v1 Codex Cold-Start Prompt

## 1. Purpose

The exact text to paste into Codex (or any equivalent autonomous coding agent) to kick off the v1 build end-to-end. This is the human's single touch point with the build run. After pasting, the agent executes the full sequence in [11_agent_automation_runbook.md](11_agent_automation_runbook.md) without further intervention.

## 2. Pre-flight (human runs before pasting)

```bash
# From C:\GeoSee\GeoSee_Dev\
git status                                        # confirm clean tree
git checkout -b ui-editor-v1-build                # dedicated branch
node --version                                    # confirm ≥ 20.x
npm --version                                     # confirm ≥ 10.x
ls UI_EDITOR/docs_v1/ | wc -l                     # confirm 20 docs (00-19 + this one if added)
git log --oneline -1 -- UI_EDITOR/docs_v1/        # capture docs pack commit sha for the prompt
```

If any pre-flight step fails, do not proceed — fix the environment first.

## 3. The cold-start prompt

Copy everything between the rules below into Codex as one message. Substitute `<DOCS_PACK_SHA>` with the value from `git log --oneline -1 -- UI_EDITOR/docs_v1/` above. Substitute `<BRANCH>` with the branch name (default `ui-editor-v1-build`).

---

You are executing the v1 build of the GUI Workbench, a standalone Figma-lite visual editor for application GUI panels. The complete build contract is in `C:\GeoSee\GeoSee_Dev\UI_EDITOR\docs_v1\`. That folder is pinned at git sha `<DOCS_PACK_SHA>`. You are on branch `<BRANCH>` from `main`. The working tree must be clean before you begin.

Your goal: produce 15 sequential git commits (Phase 0 through Phase 14) implementing the v1 workbench end-to-end. Each commit corresponds to one phase from `docs_v1/10_build_phases.md`. The build is complete when every Definition-of-Done item in `docs_v1/01_scope.md` §4 is observably true.

Read these docs in this order, in full, before writing any code:

1. `docs_v1/00_README.md` — orientation, locked decisions, doc map.
2. `docs_v1/09_glossary.md` — canonical vocabulary; use these terms verbatim.
3. `docs_v1/01_scope.md` — what is in v1, what is out, success criteria.
4. `docs_v1/02_architecture.md` — folder layout, module contracts, tech stack, theme, browser support.
5. `docs_v1/10_build_phases.md` — the 15 sequential phases you will execute.
6. `docs_v1/11_agent_automation_runbook.md` — the operating procedure, per-phase prompt template, success / failure report templates, resumption rules.
7. `docs_v1/19_known_pitfalls.md` — pre-warned failure modes; consult before diagnosing any anomaly.

For each phase, re-read its detail docs before implementing:

| Phase | Required detail docs |
| --- | --- |
| 0 | 02 §5 (build commands), 02 §1 (tech stack pins) |
| 1 | 02 §2 (folder layout), 07 (package format) for schema types, 14 (archetype reference) for per-archetype props |
| 2 | 07 §13 (Vite plugin contract), 17 (security model) for path policy |
| 3 | 02 §3 (module contracts), 02 §4 (state model), 02 §7 (theme) |
| 4 | 03 (canvas engine) — every section |
| 5 | 04 (toolkit) — every section |
| 6 | 05 (libraries) — every section |
| 7 | 06 (straw subject), 03 §16 (background asset specs) |
| 8 | 08 (validation rules), 13 §5 (intent rules), 16 (state machine) for state transitions tied to validation |
| 9 | 02 §3.1 (core public API), 13 (intent annotations) for ChangeRecord shape |
| 10 | 03 §16, 08 §4.3 (frame.background.contrast-text-min) |
| 11 | 13 (intent annotations) §3, 15 (UI states) for selection / multi-select handling |
| 12 | 07 §12 (generated docs), 13 §4 (intent propagation), 16 §10 (export framing by state) |
| 13 | 02 §3.3 (HostAppAdapter interface) |
| 14 | 01 §4 (Definition of Done), 11 §6 (smoke sequence) |

Operating principles, binding for the entire run:

- Trust the docs over instinct. Where the docs conflict with your model of "good design", the docs win.
- One phase, one commit. Commit message format: `Phase NN: <summary from 10_build_phases.md §3>`. Include `Co-Authored-By: <your-agent-id>` footer.
- No `--no-verify`. No `--amend` on already-committed phases.
- Stop on red. If a phase's acceptance check fails after two diagnose-and-fix passes, halt and emit the structured failure report from `docs_v1/11_agent_automation_runbook.md` §9. Do not improvise.
- `CLAUDE.md` at the GeoSee root applies. No first / second-person pronouns in commit messages, doc edits, or code comments. Search hygiene rules apply (do not Grep into `projects/*/data/**`, `dist*/**`, `node_modules/**`, archive subtrees).
- v1 work is isolated to `UI_EDITOR/`. Do not import from `..\src\`, `..\projects\`, or any other GeoSee surface. Do not modify `..\vite.config.ts`, `..\package.json`, `..\tsconfig.json` at the GeoSee root, or anything in `..\docs\`, `..\tests\`, `..\plugins\`.
- Do not modify any file in `UI_EDITOR\docs_v1\` or `UI_EDITOR\docs\`. If a doc is wrong, halt and surface; do not silently rewrite the contract you are executing against.
- No external network calls during the build beyond `npm install` and `git fetch` if needed.
- Use only Read, Write, Edit, Bash, Glob, Grep tools. No browser automation, no image processing libs, no external services.

Procedure for each phase:

1. Re-read `docs_v1/10_build_phases.md` §3 entry for the phase.
2. Re-read every detail doc the phase references (from the table above).
3. Create / edit only the files the phase spec names. Use Edit for existing files, Write for new.
4. Run `cd UI_EDITOR && npm run check` after editing.
5. Run `npm run test` if test files exist for the phase.
6. Run every acceptance check listed in the phase spec (or the referenced detail doc's acceptance section). Each check has a "How to verify" column — perform that verification.
7. If all green: `git add` the exact phase files (no broad `git add .`), commit with the phase format, run `git log --oneline -1` to confirm.
8. If anything red: diagnose using `docs_v1/19_known_pitfalls.md` first. Try one targeted fix. Re-run the failed acceptance. If still red, try a second fix. If still red after the second pass, halt and emit the failure report.

After Phase 14 completes, emit the success report template from `docs_v1/11_agent_automation_runbook.md` §8. Do not push to remote. Do not open a pull request. Do not modify `CLAUDE.md` or any GeoSee-root file. Stop and hand off.

If at any point the documentation is genuinely ambiguous (not "I don't know how to" — that's a coding problem; "the docs say two contradictory things" is a documentation problem), halt and surface to the human. Do not pick one and proceed silently.

Begin with Phase 0.

---

## 4. Optional pre-prompt directives

If the human has constraints not covered by the runbook, prepend them to the cold-start prompt before pasting. Common examples:

- "Use the agent id `codex-2026-05-31` in commit footers."
- "Pause for human approval after every fourth phase."
- "Push to remote after every successful phase commit."
- "Use a specific Node version: `nvm use 20.18.0` first."

These are operational overrides, not scope changes. Scope changes require editing the docs pack and starting over.

## 5. After the agent finishes

Whether success or failure, the human's next actions:

1. Read the agent's final report (success template §8 or failure template §9 from `11_agent_automation_runbook.md`).
2. Run `git log --oneline main..<BRANCH>` and confirm exactly 15 commits with the `Phase NN:` prefix.
3. Run `cd UI_EDITOR && npm run dev` and manually exercise the smoke sequence from `11_agent_automation_runbook.md` §6.
4. If everything passes, the run is accepted. Push the branch (`git push -u origin <BRANCH>`) at the human's discretion.
5. If anything fails post-acceptance, file a follow-up task. Do not re-run the agent on the same branch without first reading the docs pack and identifying what was unspecified.

## 6. Estimated wall-clock time

~30 hours of agent time for a sequential single-agent run. Adjust expectations if running with multiple parallel agents or a different model.

## 7. Why a single prompt

The runbook in doc 11 already specifies the per-phase procedure. This cold-start prompt is the wrapper that names which docs to read first, sets the operating principles, and tells the agent where to find the phase list. Without it, the agent would have to infer "where do I start?" from the docs themselves — possible but wasteful. With this prompt, the human's first message is precise and the agent's first action is to read the right five docs in the right order.
