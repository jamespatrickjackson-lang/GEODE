# GUI Workbench

A standalone Figma-lite visual editor for application GUI panels. Builds
**Components → Assemblies → Products** (the three-tier authoring model),
validates them against a deterministic rule pack, and exports a portable
GUI Package plus a human spec and an AI-agent brief.

See `docs_v1/00_README.md` for the full v1 build context, and
`docs_v1/23_v1_1_direction.md` for the v1.1 tier model.

## Run it

- **Windows:** double-click `Launch UI Editor.cmd` (in this folder). It
  installs dependencies on first run, starts Vite, and opens the browser.
- **Any OS / terminal:**

  ```bash
  cd UI_EDITOR
  npm install      # first run only
  npm run dev      # http://localhost:5174/
  ```

A second root-level launcher (`..\Editor App.cmd`) does the same thing from
the repo root; either works.

## Scripts

| Command | Effect |
| --- | --- |
| `npm run dev` | Vite dev server on `http://localhost:5174`. |
| `npm run build` | Production build (sanity check only; v1 is dev-time tooling). |
| `npm run check` | `tsc --noEmit`. |
| `npm run test` | Vitest, scoped to `src/core/**` + `src/adapter/**`. |

## Layout

- `src/core/` — portable engine: schema, geometry, validation, editing,
  package IO, export. Knows nothing about GeoSee.
- `src/shell/` — the React UI (canvas, toolkit, library panel, inspector).
- `src/adapter/` — Host-App Adapter **contract only** (v1). The GeoSee
  adapter is implemented in v2; the stub throws at runtime.
- `packages/` — GUI Package storage. Ships `geosee_editor_sidebar`.
- `docs_v1/` — the build contract (do not edit during an agent build run).

## Status

v1.0 phases 0–14 are complete. v1.1 adds the three-tier model
(Component / Assembly / Product), first-class AI Notes, machine-readable
composition recipes, and tier validation rules. The frozen v1.0 snapshot
lives at `..\UI_EDITOR_v1_0\`.
