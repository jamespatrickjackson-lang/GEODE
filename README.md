# GeoSee Alpha

A page-based 3D presentation tool for mining companies — alpha prototype.

GeoSee turns mining project data (drillholes, geophysics, target areas,
site models) into guided 3D walkthroughs for investor, board, regulator,
and community audiences. This repo is the internal authoring tool the
GeoSee team uses to build those presentations.

## Status

**Alpha — built for market feedback, not production.** Not for client
distribution. Not for engineering decisions. See `docs/00-purpose.md`
for what this exists to test.

## Stack

- **Renderer:** Three.js
- **App shell:** React (Vite, TypeScript)
- **Data:** CSV, GeoJSON, glTF, GeoTIFF
- **Hosting:** static builds, self-hosted, password-gated
- **Video export:** headless Chromium recording → MP4

See `CLAUDE.md` "Locked decisions" for full stack rationale.

## Repo layout

    C:\GeoSee\GeoSee_Dev\
      CLAUDE.md             # routing doc for Claude Code sessions
      README.md             # this file
      docs/                 # all design / scope / decision docs
      src/                  # the application code
      projects/             # individual presentation projects (content)
        woodjam/            # original reference project
        case-study-b/        # Shahbazi quarry case study
        utah-forge/          # geothermal/geophysics case study

## Working with this repo

Start normal Claude Code and Codex software work with
`docs/dev-context/Active-Build-Context.md`, then read only task-specific
docs and source files. `CLAUDE.md` remains the routing doc for scope,
architecture, data-prep, and handoff questions.

Large raw/source buckets are not kept in the active repo. If a prep script,
provenance file, or generated metadata points at an old source path, check
`docs/archive-map.md` and `docs/archive-manifest.json`; the source system of
record is `C:\GeoSee\GeoSee_Archive`.

Avoid loading historical receipts, generated screenshots/reports, old intake
archives, or older root docs by default. Run the full
`npm run test:utah-forge` suite only when the task needs broad regression
coverage; use `npm run build` and targeted checks during iteration.

Use the cheapest verification that matches the changed surface:

- Static page/project wiring: `npm run check:pages`
- Active context-drag markers: `npm run check:agent-drag`
- Utah FORGE artifact metadata: `npm run check:artifacts`
- Project artifact coverage: `npm run check:coverage`
- Code/runtime compile risk: `npm run build`
- Browser/render/editor behavior: targeted Playwright by test name

The most important stable docs are:

- `docs/00-purpose.md` — what this exists to test
- `docs/01-scope.md` — what is in and out for alpha
- `docs/03-decisions.md` — the running decision log

## Building Case Studies

GeoSee is the tool being tested and sharpened. Each project under `projects/`
is a case study for market feedback and architecture learning. Woodjam remains
the original reference project, while Shahbazi and Utah FORGE exercise different
data, rendering, provenance, and workflow needs.

## Contact

Internal GeoSee project. Not for external distribution.
