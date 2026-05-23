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

Stack rationale lives in `docs/02-architecture.md` and `docs/03-decisions.md`.

## Repo layout

    C:\GeoSee\GeoSee_Dev\
      CLAUDE.md             # agent rules and routing
      README.md             # this file
      docs/                 # all design / scope / decision docs
      src/                  # the application code
      projects/             # individual presentation projects (content)
        woodjam/            # original reference project
        case-study-b/        # Shahbazi quarry case study
        utah-forge/          # geothermal/geophysics case study

## Working with this repo

This README is the human repo landing page. Entry points are intentionally
separated:

- `CLAUDE.md` is the agent operating contract and routing doc.
- `docs/dev-context/Active-Build-Context.md` is the active software-work entry.
- `docs/START-HERE.md` is stable product/system orientation.

Large raw/source buckets are not kept in the active repo. If a prep script,
provenance file, or generated metadata points at an old source path, check
`docs/archive-map.md` and `docs/archive-manifest.json`; the source system of
record is `C:\GeoSee\GeoSee_Archive`.

Executable commands live in `package.json`. Verification routing for agents
lives in `docs/dev-context/Active-Build-Context.md`.

The most important stable docs are:

- `docs/00-purpose.md` — what this exists to test
- `docs/01-scope.md` — what is in and out for alpha
- `docs/03-decisions.md` — the running decision log

- `docs/dev-context/Global-Toolset-Structure.md` records the current global toolset pattern.

## Building Case Studies

GeoSee is the tool being tested and sharpened. Each project under `projects/`
is a case study for market feedback and architecture learning. Woodjam remains
the original reference project, while Shahbazi and Utah FORGE exercise different
data, rendering, provenance, and workflow needs.

Current architecture work is moving tool behavior into reusable GeoSee toolsets
while keeping project folders as data/provenance/authored-diff instances. The
public topo map is the first implemented pattern; other toolsets will align
incrementally as they are touched.

## Contact

Internal GeoSee project. Not for external distribution.
