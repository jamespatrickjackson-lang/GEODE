# GeoSee Alpha

This repo is an **alpha prototype** built to gather market feedback from
mining companies. It is NOT a v1 product. Architecture is intentionally
disposable. Optimize for speed to a learnable artifact.

## Why this exists — the 5 questions we're testing

Every feature, decision, and PR should help answer at least one of:

1. **Does the format work?** (page-based walkthrough vs. free explore vs. linear video)
2. **Is the visual quality good enough?**
3. **Are we showing the right things?** (drillholes, geophysics, targets, vs. something else)
4. **Would they pay for this, and roughly how much?**
5. **Who in their org would actually use it?** (IR, CEO, exploration, board)

If a proposed feature does not ladder to one of these, push back before building.

## The deliverable is the Woodjam demo, not the tool

The tool can be rough where it does not show. The Woodjam presentation must be
visually impressive, narratively tight, and data-backed. Spend disproportionate
effort on demo polish, not tool polish.

## Before you do X, read Y

Default current-work path: for normal software work, start with
`docs/dev-context/Active-Build-Context.md`, then open only the docs and
source files directly relevant to the task.

Avoid loading historical receipts, screenshots, archived intake material, or
old root docs by default. Use them only when the user asks for audit history,
verification evidence, intake/drop review, or visual QA evidence.

| Doing this | Read this first |
|---|---|
| Normal runtime/editor/visualization work | `docs/dev-context/Active-Build-Context.md` |
| Changing scope or proposing a new feature | `docs/01-scope.md` |
| Any architecture or library decision | `docs/02-architecture.md` + `docs/03-decisions.md` |
| Editing `project.json`, `page.json`, or `sources.json` schemas | `docs/schemas/` |
| Adding scene/editor/render settings, app feature config, or project/page config fields | `docs/06-editor-exposure-rules.md` |
| Changing the build plan or weekly priorities | `docs/04-build-sequence.md` |
| Working on demo content or scenes | `docs/woodjam/` |
| Understanding why this project exists | `docs/00-purpose.md` |

## Locked decisions — do not re-litigate without explicit ask

These have been considered and chosen. If you want to change one, surface it
explicitly to the user before acting; do not silently propose alternatives.

- **Renderer:** Three.js (not Cesium, not Unreal)
- **App shell framework:** React (not Svelte) — chosen for Claude Code's stronger React proficiency
- **Build tool:** Vite
- **Language:** TypeScript
- **Hosting:** self-hosted static builds (no Cesium ion, no Google 3D Tiles)
- **Project model:** single project per build; duplicate-and-edit for variants
- **Provenance:** manual JSON sidecar + printable PDF (no workflow engine)
- **Charts:** images in alpha; data model designed to support rendered charts later
- **Video export:** headless Chromium screen recording → MP4 (no offline cinematic pipeline)
- **Audience modes:** none in alpha; one project = one audience
- **Data formats:** CSV, GeoJSON, glTF, GeoTIFF only
- **CRS handling:** one CRS per project, fixed at creation

Full reasoning for each lives in `docs/03-decisions.md`.

## Decision discipline

- If you are about to make a decision that contradicts anything in `/docs`,
  STOP and surface it. Do not silently override.
- New decisions get appended to `docs/03-decisions.md`. Never modify previous
  entries — only add new ones with a "supersedes #N" note if the new decision
  replaces an older one.
- When the user makes a verbal decision in a Claude Code session that should
  persist across sessions, append it to `03-decisions.md` before the session
  ends. Claude Code is stateless across sessions; if it is not written down,
  it is lost.

## What this alpha is NOT

- Not a SaaS platform — no multi-tenancy, no user accounts, no billing
- Not a v1 product — do not build durable architecture; build throwaway-grade
- Not a geological modeling tool — no measurements, no engineering use
- Not for end-client editing — internal GeoSee staff are the only authors

Every published output is watermarked "Not for engineering use" by default.

## Maintenance habits

- Append to `03-decisions.md` after every real choice, even small ones
- Update `04-build-sequence.md` at the end of each working week
- When findings come back from market-feedback meetings, log them in
  `docs/05-findings.md` (create when first finding arrives)

## Operator notes for future Claude Code sessions

- **Agent fast path.** For current software-build work, use
  `docs/dev-context/Active-Build-Context.md` as the first read. Do not route
  through old receipt archives, screenshot folders, staged-intake records, or
  older root docs unless the task explicitly needs that history.
  Avoid full `npm run test:utah-forge` during iteration; prefer `npm run build`
  and targeted Playwright checks.
- **Authoring persistence (Week 3+).** The editor auto-saves edits to
  `projects/<project>/` via a dev-only Vite plugin endpoint
  (`/api/write-file`, `/api/read-file`, `/api/delete-file`) registered
  in `vite.config.ts`. State lives on disk; closing the tab is safe.
  The plugin is dev-only — `vite build` produces a static artifact with
  no write capability, by design (per #022). If you find yourself
  reaching for IndexedDB / LocalStorage / a backend service to persist
  authoring state, stop: the dev plugin is the right answer and already
  exists at `plugins/vite-plugin-author-write.ts`.
- **Working tree.** Per #021, the working tree is `C:\GeoSee\GeoSee_Dev\`,
  not the Drive copy. `npm install` against Drive will fail with EPERM.
