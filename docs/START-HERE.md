# Start Here: GeoSee Stable Product/System Orientation

This document is stable product/system orientation. It explains what GeoSee is,
why it exists, and how the app/data model is shaped. It is not the active-work
router.

For active software work, use `docs/dev-context/Active-Build-Context.md`. For
agent operating rules, use `CLAUDE.md`. For the repo landing page, use
`README.md`.

## Product Frame

GeoSee is a service-first visual communication tool that turns complex mining,
geoscience, geothermal, and spatial project material into guided 3D
presentations for different audiences.

The working thesis:

> One project spine can support multiple audience-tuned readings, as long as
> the app stays honest about what is measured, derived, preview-only,
> synthetic, or still pending.

## What The App Is

GeoSee is an internal authoring and presentation app built with Vite, React,
TypeScript, and Three.js. It lets a small team load a project, tune a 3D scene,
edit pages and overlays, preview a guided presentation, and keep project data
and provenance organized for later publishing.

GeoSee is not a public SaaS product, not a final modelling/GIS/engineering
tool, and not a place to present uncertain or placeholder data as measured
truth.

## Who It Is For

GeoSee is designed around technical projects that need to be explained to
multiple audiences:

- investors
- public/community stakeholders
- government/planning audiences
- regulatory or technical reviewers
- internal executives and project teams

The same project can be shown through different lenses, but the underlying
source/provenance story must remain clear.

## Project Roles

The app is multi-project. Current project folders include Woodjam, Shahbazi /
Case Study B, Utah FORGE, and Base GUI.

- Woodjam is the preserved real/reference project and regression guard.
- Shahbazi / Case Study B probes high-fidelity quarry data, source-derived
  previews, placeholders, and future production targets.
- Utah FORGE probes geothermal/geophysics architecture, MT/seismic/public
  context, and presentation needs.
- Base GUI is a blank/default editing project for shared GUI, overlay,
  navigator, label, lighting, and environment defaults.

Current project facts live in project files, project-local data READMEs, and
active maps such as `docs/dev-context/Dataset-Map.md` and
`docs/dev-context/Computed-Artifact-Pipeline.md`.

## Core Runtime Flow

The app flow is:

```text
Landing page
  -> choose project
  -> load project.json
  -> load environment.json
  -> load pages/*.json
  -> load overlay markdown/assets
  -> mount Three.js scene
  -> register layer groups
  -> load layers through the loader registry
  -> mount editor/presenter chrome
```

## Project Folder Model

Each project is meant to be mostly self-contained:

```text
projects/<slug>/
  project.json
  environment.json
  pages/
  overlays/
  data/
  data_refs/
```

`project.json` owns project metadata, layer manifest, page order, active
preview file references, and future target references.

`environment.json` owns default visibility, global layer styles, scene
settings, lighting/environment defaults, and GUI/presenter style defaults.

`pages/*.json` owns page title/subtitle, camera pose, overlay path, and
page-level visibility/style/environment overrides.

`overlays/*` owns page markdown and local overlay assets.

`data/` owns project-local runtime data, processed previews, generated browser
artifacts, and status/provenance-adjacent files. Large source/raw buckets may
live outside the active repo and be referenced through `docs/archive-map.md`.

`data_refs/` owns citations, source notes, acquisition notes, processing
briefs, and provenance records where a project keeps those separately.

## Data Honesty Model

GeoSee separates data into stages:

```text
source/reference notes
  -> raw or archived source data
  -> processed browser-ready previews
  -> active project layer references
  -> future production targets
```

For each dataset, keep these questions explicit:

1. What is the source?
2. What license/permission applies?
3. What files are actually present?
4. What coordinate system or local frame is used?
5. What has been processed?
6. What is active in GeoSee?
7. What is still future/pending?
8. Is this measured, derived, preview-only, synthetic, or placeholder?

`previewFiles` are active browser-ready files currently used by the app.
`futureTargets` are planned production outputs that should not be treated as
available.

## Stable Implementation Model

Layer loading is centralized in `src/scene/layerLoaders.ts`; layers should not
be hardwired in `src/scene.ts`.

`src/scene/SceneManager.ts`, `src/editor/LayerPanel.tsx`, and
`src/editor/EditorContext.tsx` are large, high-blast-radius surfaces. Use
`docs/dev-context/Architecture-Hotspots.md` before modifying them.

The editor is an internal authoring shell. Project edits are persisted through
the dev-only author-write plugin described in `CLAUDE.md` and
`docs/dev-context/Active-Build-Context.md`.

## Working Safely

- Use `C:\GeoSee\GeoSee_Dev` as the active repo root for current work.
  `C:\GeoSee_Dev` is obsolete/stale and should not be used as a working tree.
- Read local files before editing.
- Prefer existing patterns.
- Keep changes scoped.
- Do not remove user work.
- Do not claim data is real unless the repo proves it.
- Use `docs/dev-context/Verification-Routing.md` for workspace and verification
  rules.

## Where To Read Next

- Product purpose: `docs/00-purpose.md`
- Scope: `docs/01-scope.md`
- Architecture: `docs/02-architecture.md`
- Decisions: `docs/03-decisions.md`
- Active work router: `docs/dev-context/Active-Build-Context.md`
- Dataset map: `docs/dev-context/Dataset-Map.md`
- Computed artifact pipeline: `docs/dev-context/Computed-Artifact-Pipeline.md`

For current project-specific data context, read:

```text
projects/<slug>/project.json
projects/<slug>/environment.json
projects/<slug>/data/README.md
projects/<slug>/data_refs/
```

## Current North Star

GeoSee should make technical spatial projects easier to understand without
flattening the truth of the data.

The app wins when a viewer can understand the project story, a technical
reviewer can trace the data status, and the authoring team can keep building
without turning the codebase into a pile of one-off hacks.
