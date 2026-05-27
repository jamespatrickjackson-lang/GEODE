# Agent Handoff — 2026-05-26 AI-Slowness Audit + Phase 1 Remediation

Cold-start handoff for the next agent (Claude Code or Codex CLI) picking
up the work that began with the 2026-05-26 audit of why AI coding
agents felt slow inside GeoSee_Dev.

## Original Ask

The user reported AI agents (both Claude Code and Codex CLI) were
noticeably slow while working in this repo and asked for a full audit
to find the cause, plus a ranked list of any other improvement
opportunities.

## What Landed In This Session

Six commits on `main`, in this order:

| Commit | Scope |
|---|---|
| `cbf8011` | Phase 1 — agent-context guardrails: Search Hygiene section in `CLAUDE.md`, new root `AGENTS.md` for Codex, nested `CLAUDE.md` in `src/editor/`, `src/scene/`, `projects/`, Inactive/Historical Reference Docs section in `Active-Build-Context.md`, new `agent-instructions` category in `tools/check-workspace-state.mjs`, plus `core.untrackedCache=true` and `--no-renames` flags on the git status call inside that script. |
| `ce9ea03` | `docs/dev-context/Source-Monolith-Split-Plan.md` — planning doc that defines target module layout, extraction order, and per-PR verification gates for the R1 (`LayerPanel.tsx`) and R2 (`SceneManager.ts`) refactors. |
| `3d9322a` | `DEC-051` in `docs/03-decisions.md` — records the new `agent-instructions` commit-policy category. |
| `5d8b9af` | R1 step 1 — `src/editor/layerControls/style/StyleControls.tsx` (9 components) + `src/editor/layerControls/labelKindOptions.ts`. LayerPanel.tsx: 14,326 → 13,298 lines (−1,028). |
| `72a272e` | R9 — CHANGELOG.md trimmed from 772 to 76 lines; the two large 2026-05-11/12 "Kept Change Log" digests moved to `CHANGELOG-Archive.md`. |
| `87e0eb8` | R1 step 2 — `src/editor/layerControls/scalar/ScalarControls.tsx` (3 components) + `src/editor/layerControls/scalarSourceRange.ts`. LayerPanel.tsx: 13,298 → 12,527 lines (−771). |

Off-repo: 9 memory files seeded at
`C:\Users\james\.claude\projects\c--GeoSee-GeoSee-Dev\memory\` (Claude
Code memory dir). Codex CLI does not read this dir; Codex relies on
`AGENTS.md`.

## Where Things Stand (Numbers)

- `src/editor/LayerPanel.tsx` — **12,527 lines** (was 14,326).
  Plan target ≤ 2,500.
- `src/scene/SceneManager.ts` — **11,961 lines** (untouched this
  session). Plan target ≤ 3,500.
- `src/editor/layerControls/style/StyleControls.tsx` — 1,047 lines.
- `src/editor/layerControls/scalar/ScalarControls.tsx` — 804 lines.
- `CHANGELOG.md` — 76 lines (was 772).
- `tools/check-workspace-state.mjs` — `check:workspace` baseline ~414 ms
  → ~342–359 ms after Phase 1 tweaks.

## What's Left

### R1 — LayerPanel.tsx extraction (6 of 8 PRs remaining)

Plan target: `LayerPanel.tsx` ≤ 2,500 lines. Currently 12,527. Need
to move ~10,000 more lines across the remaining six PRs.

| Next | Cluster | Est. lines | Risk |
|---|---|---|---|
| Step 3 | `mt/` — `SurfaceGradientControls`, `MtTopSurfaceControls`, `IsobandControls`, `MtVolumeControls`, `MtThresholdSurfaceControls`, `MtStationQcControls`, `ResistivitySliceControls` | ~1,400 | low–medium |
| Step 4 | `env/` + `page/` rows | ~600 | low |
| Step 5 | `overlays/` | ~440 | low |
| Step 6 | `layout/` group + drilling assay + topo distance | ~900 | medium |
| Step 7 | `seismic/` | ~3,000 | medium |
| Step 8 | `workingArea/` + `geology/` | ~900 | medium |

Find current line numbers with:
```
Grep ^function (Mt|Scene|Working|Page|Env)
  --path src/editor/LayerPanel.tsx --output_mode content --n true
```
Line numbers shift after every extraction — always re-grep.

### R2 — SceneManager.ts split (entirely unstarted)

Plan recommends **Option A (helper classes composed by SceneManager)**.
The user has not confirmed Option A yet; that confirmation is the first
gate before any R2 code moves. See `Source-Monolith-Split-Plan.md` →
"Open Architectural Decision".

### Other deferred remediations

- Move historical audit-style docs (`Loader-Project-Module-Audit.md`,
  `Working-Area-Focus-Clip-Audit.md`,
  `Topo-Graticule-Edge-Fade-Audit.md`) into
  `docs/dev-context/Archive/`. Deferred because the Archive dir is
  gitignored, so moves would silently drop tracked content. The
  Inactive Docs routing note in `Active-Build-Context.md` already
  steers agents away from these.
- Optional: classify `CHANGELOG-Archive.md` under `docs` (currently
  falls to `other`) by tweaking the classifier in
  `tools/check-workspace-state.mjs`. Low impact.
- Optional: split `StyleControls.tsx` (1,047 lines) into per-component
  files matching the plan's per-file layout. Not needed for
  correctness; only matters if reading the file becomes inconvenient.

## Tactical Lessons (Read Before Continuing R1)

1. **Search hygiene for cross-cluster constants.** Before extracting a
   cluster, grep every module-level constant the cluster uses with
   `output_mode: content` + `-n true` to see ALL usage sites in
   LayerPanel.tsx. R1 step 2 had to ship a fix-up because
   `SCALAR_SOURCE_MIN/MAX` looked cluster-local on the initial pass but
   were used in seven other LayerPanel sites. Caught by tsc before
   commit. Pattern: constants used both inside and outside the cluster
   move to a small shared file under
   `src/editor/layerControls/<name>.ts` (see `labelKindOptions.ts`,
   `scalarSourceRange.ts` for examples).

2. **Anchor-based removal works for large chunks.** When removing a
   function body too large to comfortably paste as `old_string`, anchor
   the removal on the **next** function's signature, an `interface`
   declaration, or a `// -----` section comment. Match
   `function <Removed>(...){...all body...}\n\nfunction <NextKept>(`
   and replace with just `function <NextKept>(`. This is how the style
   cluster (1,026 lines) and the scalar cluster's ScalarRampControls
   (660 lines) were removed cleanly.

3. **Do not use placeholder functions to "shrink" a removal.** R1 step
   2 briefly tried replacing only the function signature with a
   `function __REMOVED__()` stub, leaving the body in place. Result:
   the orphan body referenced variables that no longer existed, breaking
   tsc. Either remove the entire function in one Edit, or do not start.
   Restoring takes the same effort as doing it right.

4. **Typecheck every extraction before committing.** Run
   `npx --no-install tsc -p . --noEmit` after each cluster extraction
   and before staging. Zero output = clean.

5. **Single-file-per-cluster is fine for first extractions.** The plan
   shows nine separate files under `layerControls/style/`. The actual
   step-1 commit shipped them as one `StyleControls.tsx` (1,047 lines).
   No regressions, much simpler diff, easier to revert. Subdivide only
   if the file becomes inconvenient.

6. **`SurfaceGradientColorInput` is used by both the mt cluster
   (`SurfaceGradientControls`, line ~7,500) and the scalar cluster
   (`ScalarRampControls`, now extracted).** It now lives in
   `StyleControls.tsx` and gets imported back into both consumers.
   When the mt cluster ships next, just re-import
   `SurfaceGradientColorInput` from `../style/StyleControls` in the
   new `mt/MtControls.tsx`.

7. **Workspace policy gotcha.** The classifier in
   `tools/check-workspace-state.mjs` now recognises `CLAUDE.md` /
   `AGENTS.md` / `Active-Build-Context.md` /
   `Verification-Routing.md` as `agent-instructions`. New nested
   `CLAUDE.md` files anywhere in the tree are automatically grouped.
   Cluster extraction commits stay in `app-code` (single category,
   PASS). Doc-only commits stay in `docs`. Mixing the two triggers
   WARN (still allowed). Mixing three or more, or mixing snapshot-
   sensitive with anything, FAILs.

8. **User WIP is sacred.** At session start the working tree had these
   dirty paths that are user work and must never be staged:
   `docs/dev-context/Current-State.md`,
   `projects/utah-forge/data/README.md`, `docs/tool-manifest.md`,
   `projects/utah-forge/DATA_LAYER_STATUS.md`. The
   `.claude/settings.local.json` file is harness-managed and also
   must not be staged.

## How To Resume R1 — Step 3 (mt/ cluster)

1. Re-grep current line numbers:
   ```
   Grep ^function (SurfaceGradientControls|MtTopSurfaceControls|IsobandControls|MtVolumeControls|MtThresholdSurfaceControls|MtStationQcControls|ResistivitySliceControls)
     --path src/editor/LayerPanel.tsx --output_mode content --n true
   ```
   The interfaces at the start of the cluster
   (`MtStationQcVariant`, `MtStationQcStation`, `MtStationQcPayload`)
   move with the cluster.

2. Find every module-level constant the mt cluster references but that
   is **also** used elsewhere in LayerPanel.tsx. Use
   `output_mode: content` + `-n true`, not `files_with_matches`.
   Candidates to vet: any `MT_*` constants, surface-gradient defaults
   already moved into `StyleControls.tsx`, MT layer-id imports already
   at the top of LayerPanel.tsx.

3. Create `src/editor/layerControls/mt/MtControls.tsx`. Import
   `SurfaceGradientColorInput` from `../style/StyleControls`.
   Import shared helpers (`styleString`, `styleNumber`, etc.) from
   `../../styleControls`. Move any cluster-only constants into the
   new file. Move cross-used constants into a small sibling
   `src/editor/layerControls/<name>.ts` (see existing examples).

4. Edit LayerPanel.tsx:
   - Add the new import block.
   - Remove the cluster's module-level constants (only ones the
     cluster uses exclusively).
   - Remove the seven function declarations + the three interfaces,
     anchored on the **next** thing in the file.

5. Verify:
   ```
   npx --no-install tsc -p . --noEmit
   ```
   Expect empty output.

6. Stage and commit:
   ```
   git add src/editor/LayerPanel.tsx src/editor/layerControls/
   npm run check:workspace -- --commit
   ```
   Should PASS as single-category `app-code`.

7. Commit message template (matches recent commit style; no
   first/second-person pronouns per the operating contract):
   ```
   Extract layerControls/mt cluster from LayerPanel

   R1 step 3 from the Source Monolith Split Plan. Moves seven
   mt-control sub-components ... LayerPanel.tsx drops from <X> to
   <Y> lines (-<Z>). tsc passes.

   Co-Authored-By: ...
   ```

## How To Resume R2

Do not start R2 until the user confirms **Option A** (helper-class
composition) from `Source-Monolith-Split-Plan.md`. The architectural
choice changes every subsequent step. Open the plan, read the "Open
Architectural Decision" section, ask the user which option, then
proceed in the listed order (shaders first — they have no class-state
coupling and are the safest first cut).

## Operating Contract Reminders

- `CLAUDE.md` defines the output rail: no first/second-person pronouns
  in agent prose. The trailer `Co-Authored-By:` in commit messages is
  metadata, not prose, and is allowed.
- Run `npm run check:workspace -- --commit` before every commit. The
  policy gate enforces single-or-two-category commits.
- Stage exact paths. Never `git add .` or `git add -A`.
- Treat dirty files outside the current task as user work.
- `npm run dev` is launched by the user — never auto-launched by agents
  (the IDE `Launch GeoSee.bat` is forbidden per
  `Active-Build-Context.md`).

## Key Files To Open First

- `docs/dev-context/Source-Monolith-Split-Plan.md` — the master
  extraction plan.
- `docs/dev-context/Active-Build-Context.md` — current routing.
- `CLAUDE.md` / `AGENTS.md` — operating contracts (mirror each other).
- `src/editor/CLAUDE.md` / `src/scene/CLAUDE.md` — per-dir guardrails
  with current file size warnings.
- `src/editor/layerControls/` — examples of the extraction pattern
  (step 1 + step 2 results).
- This file.

## Memory Pointers (Claude Code Only)

`C:\Users\james\.claude\projects\c--GeoSee-GeoSee-Dev\memory\MEMORY.md`
indexes nine seeded memories: user tools, workspace paths, monolith
list, search no-go list, canonical docs, the audit + this handoff,
search hygiene feedback, output rail feedback. Codex CLI does not read
this dir — Codex must rely on `AGENTS.md` only.
