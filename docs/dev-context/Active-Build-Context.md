# Active Build Context

Status: active entry point for software-build work

Canonical active repo root: `C:\GeoSee\GeoSee_Dev`. If a shell opens in
`C:\GeoSee_Dev` or another path that is missing the repo, change to the
canonical root before running project commands.

Entry hierarchy:

- `README.md`: human repo landing page
- `CLAUDE.md`: agent operating contract
- `docs/START-HERE.md`: stable product/system orientation
- `docs/dev-context/Active-Build-Context.md`: active software-work router

## Current Mode

GeoSee is in software-build mode. Start from the requested runtime, editor, visualization, data, or project subsystem and current source files.

Do not route normal work through staged-intake records, old review-route artifacts, historical receipts, generated report folders, or old screenshots unless the task explicitly needs that history.

Large raw/source inputs are archived outside the active repo at `C:\GeoSee\GeoSee_Archive`. When current provenance, prep scripts, or generated metadata mention old repo-relative source paths, resolve them through `docs/archive-map.md` and `docs/archive-manifest.json`.

## Current App Shape

GeoSee is a Vite + React + TypeScript + Three.js internal authoring and presentation app.

Core runtime/project surfaces:

- `projects/*/project.json`: layer registry, project metadata, `pageOrder`
- `projects/*/environment.json`: default scene and layer style state
- `projects/*/pages/*.json`: page-local camera, visibility, transition, and layer overrides
- `projects/*/overlays/<page_id>/text.md`: overlay copy
- `src/scene/SceneManager.ts`: scene, layer, style, material, transition, runtime visual state
- `src/editor/EditorRoot.tsx`: editor shell and top-level tool/workflow section tree
- `src/editor/PagePanel.tsx`: Page Manager, page selection/actions, and exported global tool panels
- `src/editor/LayerPanel.tsx`: project data layer controls that have not yet moved into tool modules
- `src/editor/topoMap/TopoMapPanel.tsx`: public topo map tool editor
- `src/mtResistivity/`: global MT resistivity tool contract and slice product metadata
- `src/pages/PageController.tsx`: page navigation and camera/page transitions
- `src/scene/SceneManager.ts`: also owns the current product-aware transition
  envelope, section-window interpolation, and render-entity opacity handling

Treat current project/source files as the authority over older prose.

## Current Utah FORGE Reality

Current Utah FORGE work includes active Phase 3 MT, seismic browser products, public topo/terrain controls, graticule/topo controls, working-area focus work, product pages, overlays, legends, and visual QA.

Do not assume Utah FORGE is the product standard. It is one case study probing MT/seismic/public-context/geophysics architecture and presentation needs.

Current editor/toolset work is an iteration toward a cleaner global-tool
structure. It is not a shipped endpoint. Preserve current behavior while moving
tool defaults, runtime behavior, editor panels, and style tokens out of
project-specific branches when each toolset is touched.

Current MT resistivity work follows the same rule: all slices, sections,
volumes, and threshold surfaces must trace back to the full authoritative MT
cell-center model unless they are explicitly labeled presentation crops.

Current transition work is product-aware. Page navigation should treat visible
render entities as `layer id + product/object id + section state`, not just
layer ids. Product-owned shader opacity such as MT scalar-volume source opacity
and seismic section/volume source opacity must be multiplied by layer/page fade
opacity, not overwritten by it. This prevents hidden section sources from
appearing during camera/page transitions.

## Focused Routing

- Workspace state and verification tiers: `docs/dev-context/Verification-Routing.md`
- Operating vocabulary: `docs/dev-context/GeoSee-Terms.md`
- Global toolset structure and topo map precedent: `docs/dev-context/Global-Toolset-Structure.md`
- Current visual review loop: `docs/dev-context/Visual-Review-Current.md`
- Large code surfaces and extraction guidance: `docs/dev-context/Architecture-Hotspots.md`
- Data/artifact status maps: `docs/dev-context/Dataset-Map.md`, `docs/dev-context/Computed-Artifact-Pipeline.md`, `docs/dev-context/Layer-Artifact-Classification.md`
- Runtime/project load classes: `docs/dev-context/Project-Load-Class-Table.md`, `docs/dev-context/Runtime-Loading-Policy.md`

## Inactive / Historical Reference Docs

The following dev-context docs are reference-only or superseded. Do not
pull them into routine exploration; load only when the task explicitly
needs the captured history.

- `docs/dev-context/Loader-Project-Module-Audit.md` — read-only audit
  feeding `Data-System-App-Refinement-Plan.md`; not a routing entry.
- `docs/dev-context/Working-Area-Focus-Clip-Audit.md` — historical audit;
  no active routing references.
- `docs/dev-context/Topo-Graticule-Edge-Fade-Audit.md` — historical
  audit; superseded by `Topo-Graticule-Edge-Fade-Implementation-Plan.md`.

Receipt and audit subdirs (`Archive/`, `Change-Receipts/`,
`Verification-Receipts/`, `Generated-Reports/`, `Audits/`, `Backups/`,
`Prompts/`, `DHF-Links/`, `System-Requirements/`, `Future-Holds/`,
`Visual-Review/`) are gitignored and are not part of normal routing.

## Default Guardrails

- Run `npm run check:workspace` before commits or broad verification.
- Follow the output posture in `CLAUDE.md`: system/dev context transfer, not social framing.
- Use the cheapest verification that matches the changed surface.
- Prefer targeted browser checks over full Utah regression during iteration.
- For transition changes, include at least one focused browser check around the
  affected source/target pages; product-level pop-in bugs can pass layer-level
  tests.
- For visual composition work, get a focused visual state in front of the human before broad automation.
- Do not run `Launch GeoSee.bat`; use a scoped dev server on a free port if an agent needs one.
