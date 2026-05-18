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
- **App shell:** TBD (Svelte or React)
- **Data:** CSV, GeoJSON, glTF, GeoTIFF
- **Hosting:** static builds, self-hosted, password-gated
- **Video export:** headless Chromium recording → MP4

## Repo layout

    Dev_files_V1/
      CLAUDE.md             # routing doc for Claude Code sessions
      README.md             # this file
      docs/                 # all design / scope / decision docs
      src/                  # the application code
      projects/             # individual presentation projects (content)
        woodjam/            # the alpha demo

## Working with this repo

Start every Claude Code session by letting it read `CLAUDE.md`. That doc
routes to whatever else is relevant. The most important docs are:

- `docs/00-purpose.md` — what this exists to test
- `docs/01-scope.md` — what is in and out for alpha
- `docs/03-decisions.md` — the running decision log

## Building the Woodjam demo

The Woodjam presentation is the artifact we take to market-feedback
meetings. Its content lives in `projects/woodjam/`. The brief and data
manifest live in `docs/woodjam/`.

## Contact

Internal GeoSee project. Not for external distribution.