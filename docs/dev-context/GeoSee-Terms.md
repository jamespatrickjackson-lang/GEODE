# GeoSee Terms

Status: active operating vocabulary

Use these terms to keep agent routing and verification evidence aligned.

## Product And Project Terms

- Case study: a project used to probe one part of the GeoSee architecture with real or representative data and human feedback. No case study is the product standard by itself.
- Project: a loadable app bundle under `projects/<project_id>/` with project config, environment state, pages, overlays, runtime artifacts, and project-local documentation.
- Global toolset: a reusable GeoSee capability whose defaults, presets, editor behavior, runtime behavior, and compatibility adapters live in source code rather than inside one project.
- Tool instance: the project-specific use of a global tool, represented by layer metadata, data inputs, provenance, visibility, page overrides, and authored diffs from global defaults.
- Sketch: exploratory project, page, environment, branding, or visual state work that is useful for investigation but has not been accepted as repo truth.
- Snapshot: an exact saved visual or project state used as a comparison point. A snapshot is evidence for the state it was taken from, not a permanent product promise.
- Accepted snapshot: a snapshot intentionally committed as the current reference for a project or check.

## Workspace Terms

- Committed repo state: the last committed tree plus any staged paths intended for the current commit.
- Local sketch state: uncommitted sketch files, often including project environment, page, overlay, branding, or image changes.
- Excluded user work: dirty files intentionally left out of the current task. Agents must not stage, rewrite, delete, or normalize these while doing unrelated work.

## Data Terms

- Runtime artifact: a file the app can load or render directly, such as project data, generated geometry, metadata, overlays, pages, or environment state.
- Provenance: source and processing references that explain where a runtime artifact came from. Provenance may include historical repo-relative source names that now resolve through the archive map.
- Archive/source system of record: raw or source-only inputs stored outside the active repo at `C:\GeoSee\GeoSee_Archive`, mapped by `docs/archive-map.md` and `docs/archive-manifest.json`.
