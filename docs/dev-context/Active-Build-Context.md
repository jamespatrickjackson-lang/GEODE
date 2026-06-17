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

Standalone `UI_EDITOR` prototype/package history stays separate from the active
GeoSee app. Do not merge or resurrect `UI_EDITOR/` or `UI_EDITOR_v1_0/` content
into `main` unless a request explicitly scopes that package.

## Current App Shape

GeoSee is a Vite + React + TypeScript + Three.js internal authoring and presentation app.

Core runtime/project surfaces:

- `projects/*/project.json`: layer registry, project metadata, `pageOrder`,
  and staff archive order (`archivedPageOrder`)
- `projects/*/environment.json`: default scene and layer style state
- `projects/*/pages/*.json`: page-local camera, visibility, transition, and layer overrides
- `projects/*/overlays/<page_id>/text.md`: overlay copy
- `src/scene/SceneManager.ts`: scene, layer, style, material, transition, runtime visual state
- `src/editor/EditorRoot.tsx`: editor shell and top-level tool/workflow section tree
- `src/editor/PagePanel.tsx`: Pages, page selection/actions, and exported Cinematics tool panels
- `src/editor/LayerPanel.tsx`: project data layer controls that have not yet moved into tool modules
- `src/editor/topoMap/TopoMapPanel.tsx`: public topo map, Topo Extents, and Topo Environment tool editor
- `src/editor/layerControls/atmosphere/AtmosphereVolumeControls.tsx`: local cloud/mist volume controls
- `src/scene/atmosphere/`: procedural local atmosphere volume runtime, generated texture, editor bounds helpers, and drift
- `src/scene/environment/sunVisual.ts`: visible sun orb, halo, and source marker runtime
- `src/mtResistivity/`: global MT resistivity tool contract and slice product metadata
- `src/pages/PageController.tsx`: page navigation and camera/page transitions
- `src/scene/SceneManager.ts`: also owns the current product-aware transition
  envelope, section-window interpolation, and render-entity opacity handling

Treat current project/source files as the authority over older prose.

## Current Utah FORGE Reality

Current Utah FORGE work includes active Phase 3 MT, seismic browser products, public topo/terrain controls, graticule/topo controls, working-area focus work, product pages, overlays, legends, and visual QA.

Do not assume Utah FORGE is the product standard. It is one case study probing MT/seismic/public-context/geophysics architecture and presentation needs.

Current Utah FORGE authoring savepoint: the active deck front block starts with
pages `156_page`, `157_page`, `158_page`, then the duplicated MT/section review
pages `159_page`, `166_page`, `167_page`, `160_page`, `164_page`, followed by
the reordered resistivity, section, and context pages in `project.json`
`pageOrder`.
`165_page` is the current staff Page Archive entry through
`archivedPageOrder`; `pages/_archive/166_page.json` is delete-recovery storage,
not staff archive state.

Current editor/toolset work is an iteration toward a cleaner global-tool
structure. It is not a shipped endpoint. Preserve current behavior while moving
tool defaults, runtime behavior, editor panels, and style tokens out of
project-specific branches when each toolset is touched.

Current Cinematics render-preset authoring has one apparent mode:
`Camera Studio` -> `Render Preset` shows project render preset controls in
every authoring context and shows the selected page override alongside it when
a page is selected. Do not reintroduce a Global Settings-only project preset
path or hide page/project presets behind separate Presentation Presets modes.

Current MT resistivity work follows the same rule: all slices, sections,
volumes, and threshold surfaces must trace back to the full authoritative MT
cell-center model unless they are explicitly labeled presentation crops.

Current transition work is product-aware and page-agnostic. Page navigation
should treat visible render entities as `layer id + product/object id + section
state`, not just layer ids. Product-owned shader opacity such as MT
scalar-volume source opacity, seismic section/volume source opacity, and
Section ISO overlay opacity must be composed with layer/page fade opacity, not
overwritten by it. This prevents hidden section sources from appearing during
camera/page transitions and keeps ISO overlays from changing color or
brightness mid-transition. Section ISO overlay roots also crossfade as derived
transition-scene entities when bands/lines enter, exit, or change geometry.

Background and fog are page-transition environment-scene channels. Renderer
background, scene fog color/density, topo fog uniforms, layer fog density, and
fog-driven post tint blend through the environment-scene transition owner;
terrain light-mode ramps, lighting, sun visuals, material preset identity,
textures, public clip, edge fade, shaders, and geometry remain discrete unless
a later decision expands that owner.

Scene section masks are transition-scene channels. Compatible frame changes
interpolate numeric section values; incompatible section-frame, target, or
enable-state changes use dual-mask alpha blending on the target page
transition clock. Section helper geometry is rebuilt only at tween start/final
commit, while transition frames update material uniforms and helper opacity.
Seismic scene-section object ids include representation type for current
runtime targets: raymarch volumes use `:volume`, rendered section-image curtains
use `:section`, and legacy product-only ids remain fallback authored state.
Helper snapshots are active-to-active only, so source section-frame controls do
not bleed into inactive/unrelated target pages. Section-frame outlines and
push/pull control cones are studio controls and render above scene content in
editor/studio views.

Pages are disposable fixtures for testing the global transition runtime. Do not
repair transition behavior with fixture-id, fixture-index, fixture-title,
source/target fixture path, or Utah-FORGE-only conditionals. Before touching
transition runtime, editor/save transition gating, show/hide, legends, matrix
tooling, or section-frame helper visuals, read:

- `docs/dev-context/Transition-Constitution.md`
- `docs/dev-context/Transition-Continuity-Contract.md`
- `docs/dev-context/Transition-Guardrails.md`
- `docs/dev-context/Transition-Decision-Log.md`
- `docs/dev-context/Transition-Page-Fixture-Evidence-Register-2026-05-31.md`
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`

The constitution and decision log are the source of truth for transition
intent. Historical logs and matrix artifacts are evidence only.

Current MT threshold-surface rendering separates overlay stability from surface
opacity semantics. Section ISO lines are late readability overlays, while MT
threshold surfaces remain editable material surfaces: opacity 1 renders as an
opaque depth-writing solid, and partial master or per-boundary opacity renders
as a transparent non-depth-writing surface.

Current Utah FORGE seismic product names are source-backed labels, not invented
app labels. Product naming follows `2D Line <line> <source-backed product
description>`, using SEG-Y text headers first, filename second, and
folder/submission context only as fallback. Line 301 includes the GDR-1015
migrated-depth product alongside the GDR-1141 migrated/unmigrated/time/depth
variants. Product controls are grouped by line family and processing stage, and
figure annotations are a presentation layer on top of the seismic product rather
than a new data product. Line 95 remains source-gated until a real source product
exists.

Current seismic section geometry is source-data driven. Visible 2D and 3D
sections must use SEG-Y trace-header coordinates and source vertical metadata
before any navigation or envelope fallback. Miller/GDR 1141 custom headers use
CMP_X byte 189 and CMP_Y byte 193 as 4-byte IBM real values, plus inline bytes
9-10 and crossline bytes 13-14 as 2-byte integers. Runtime section meshes
tessellate the stored `path` or `surfaceGrid`; do not collapse them to
first/last endpoints. L5/L11 legacy sections now use plausible transformed
trace-header paths when available, but they remain unvalidated for precise
registration. `Forge3d_ANI_PSDM_Stack_Enh.segy` is a visible source gate only
until a complete CRC-valid source member exists; do not render it or construct
direct GDR download URLs. DEC-148 allows only the explicitly labeled
`psdm-depth-surrogate-showcase`, which renders the unenhanced ANI PSDM source
as a source-derived presentation-enhanced surrogate without claiming the
enhanced SEG-Y is held.

Site Details and `GDR 1255 Station Locations` can align their display Z to the
rendered topo surface. The alignment is display-only: source coordinates,
registration manifests, and authored survey/source Z remain unchanged. Utah
FORGE defaults both alignments on; when terrain is hidden or the topo sampler is
unavailable, the runtime falls back to source-authored Z. Station markers add
their authored marker lift after sampling the rendered topo surface.

Current topo/graticule rendering treats longitude/latitude graticules as
reference geometry on the topo surface. Graticule lines depth-test against
terrain and scene geometry, do not write depth, and should not render as
through-scene white overlays. Edge-aware graticule behavior clips interior grid
lines near the topo boundary; it must not recolor interior grid lines to edge
colors, apply a directional edge-gradient fade, or draw long through-page edge
leaders. Short white edge leaders are allowed as boundary cues, must attach to
the same boundary-side crossing used by the edge label, and remain hard-clipped
to the public surface clip. Edge leaders are capped boundary ticks, not full
label-offset extensions. Scene section planes and section-frame crops now clip
targeted topo context by default per DEC-097, including terrain/topomap pixels,
satellite imagery, graticule lines/labels, legends, and branding. Terrain
underside grid helpers use camera-side hysteresis so they do not chatter during
small camera movements.

The current Utah FORGE public topo surface uses the named `Utah` material
preset: khaki desert lows, muted sage/tree middle elevations, and warm
snow/rock high peaks. This is a reusable five-stop terrain shader preset, not a
new raster or CRS transform.

Topo Environment is now part of the Topo tool, not a loose Cinematics dumping
ground. `Topo > Environment` owns scene atmosphere, Clouds, Sun, and scene fog.
`Topo > Extents` owns public map footprint, satellite opacity, material edge
fade/outline, public surface clip, and map/topo fog controls. Clouds are
`atmosphere-volume` layers with style in `environment.layerStyles` and page
`layerOverrides`; project metadata owns immutable/default placement and
environmental provenance. Sun authoring separates the light source from the
visible sky image/orb/marker, so an author can keep terrain lighting while
hiding the sky image or create a fake visual sun without using it as the light
source.

Topo Extents is a peer container under the Topo tool. `Topo > Extents` owns
public surface clip, visible map footprint, material edge fade, and edge outline
controls; `Topo > Topo Settings` keeps map type, resolution, opacity, transform,
height-map, and surface material controls.

Utah FORGE currently includes an editable one-puff `Topo test cloud`
`atmosphere-volume` layer for Topo Environment review. Its visibility is
authoring-state scoped and should not be forced through page fixtures. Its
runtime debug state should report `textureSource:
generated-canvas`, cache key shape `local-atmosphere:<layerId>:<seed>:<softness>`,
`THREE.SpriteMaterial`, and `THREE.Sprite` geometry. See
`docs/dev-context/Topo-Environment-Clouds-Cinematics-Thread-Update-2026-06-03.md`
for the current thread receipt and render-stack trace.

Camera far-plane clipping is not a visual crop. Topo imagery, terrain context,
and longitude/latitude graticules must remain inside the scene frustum during
normal presentation overview zooms. Use authored public surface crop, scene
sections, or opacity/fade tools for composition instead of relying on the camera
far plane to trim imagery.

Site Details and MT station markers can optionally align their rendered
presentation height to the active public topo surface. The alignment samples the
currently rendered topo height after terrain scale/lift, falls back to source Z
when the topo surface is hidden or unavailable, and reapplies dependent overlays
after topo style/environment changes. These controls are visual presentation
alignment only; they do not change source coordinates or promote CRS/datum
validation.

Seismic sections now include a v1 figure-annotation surface for source-domain
presentation metrics. The runtime derives axis ticks, direction labels,
distance scale bars, captions, optional well traces, and optional horizon
polylines from seismic section metadata and style fields. Time-domain products
must keep TWT as the primary vertical axis; depth-domain products use metres
below the seismic datum. The figure annotation layer is a visual communication
overlay and does not validate seismic CRS, datum, or interpretation accuracy.
Reference figures are layout examples only; never hard-code external example
line numbers, well labels, scale labels, or captions into app output.

Seismic figure graphs now use an explicit data/datum graph basis per DEC-150.
Path-curtain graphs measure full trace-path distance and sample depth/time
against the seismic datum; sample-plane graphs use their surface-grid footprint
and fixed sample/elevation state without inventing a vertical depth axis. Stable
graph identity is `layerId + productId + objectKind + objectId`. Do not derive
graph identity from page ids, page titles, page order, or first-four mesh
vertices. Transition graph handling treats figure annotations as derived
entities with their own opacity/base-opacity composition, and capture modes
gate native seismic graph annotations through the shared capture visibility
profile.

## Focused Routing

- Workspace state and verification tiers: `docs/dev-context/Verification-Routing.md`
- Operating vocabulary: `docs/dev-context/GeoSee-Terms.md`
- Global toolset structure and topo map precedent: `docs/dev-context/Global-Toolset-Structure.md`
- Topo Environment/clouds/sun/cinematics thread receipt: `docs/dev-context/Topo-Environment-Clouds-Cinematics-Thread-Update-2026-06-03.md`
- Topo editor panel field audit: `docs/dev-context/Topo-Editor-Panel-Audit-2026-06-03.md`
- Editor sidebar control manifest and change checklist:
  `docs/dev-context/editor-control-manifest.json`,
  `docs/dev-context/Editor-Control-Manifest-Policy.md`
- Page Archive preimplementation audit:
  `docs/dev-context/Page-Archive-Preimplementation-Audit-2026-06-04.md`
- Page Archive implementation plan:
  `docs/dev-context/Page-Archive-Implementation-Plan-2026-06-04.md`
- Seismic and site-details editor update receipt: `docs/dev-context/Seismic-Site-Details-Editor-Update-2026-06-04.md`
- Current visual review loop: `docs/dev-context/Visual-Review-Current.md`
- UI visual standards and shared legend/slider rules: `docs/dev-context/UI-Visual-Standards.md`
- Large code surfaces and extraction guidance: `docs/dev-context/Architecture-Hotspots.md`
- Data/artifact status maps: `docs/dev-context/Dataset-Map.md`, `docs/dev-context/Computed-Artifact-Pipeline.md`, `docs/dev-context/Layer-Artifact-Classification.md`
- Runtime/project load classes: `docs/dev-context/Project-Load-Class-Table.md`, `docs/dev-context/Runtime-Loading-Policy.md`
- Capture Director (marketing capture, camera path, scroll animation output):
  `docs/capture-director/README.md`; scroll output contract is DEC-174
- User-facing editor tool inventory: `docs/tool-manifest.md`
- Utah FORGE project-local data/layer status: `projects/utah-forge/DATA_LAYER_STATUS.md`
- Source monolith split plan and progress: `docs/dev-context/Source-Monolith-Split-Plan.md`
- Most recent cross-session handoff: `docs/dev-context/Agent-Handoff-2026-06-05.md`

## Inactive / Historical Reference Docs

The following dev-context docs are reference-only or superseded. Do not
pull them into routine exploration; load only when the task explicitly
needs the captured history.

- `docs/dev-context/Archive/Loader-Project-Module-Audit.md` - read-only audit
  feeding `Data-System-App-Refinement-Plan.md`; not a routing entry.
- `docs/dev-context/Archive/Working-Area-Focus-Clip-Audit.md` - historical audit;
  no active routing references.
- `docs/dev-context/Archive/Topo-Graticule-Edge-Fade-Audit.md` - historical
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
- For transition changes, first run the page-agnostic source guard:
  `node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"`.
- For visual composition work, get a focused visual state in front of the human before broad automation.
- For clouds, sun, topo material, fog, or other visual-runtime bugs, capture the
  render-stack trace before editing: `environment.scene`, Sub Master
  `envSnapshot`, render preset and `scenePatch`, page `sceneOverrides`, layer
  style, terrain/topo material authority, active texture URL/cache key, public
  clip, edge fade, edge outline, material/shader, and geometry.
- Do not run `Launch GeoSee.bat`; use a scoped dev server on a free port if an agent needs one.

## Page-to-page false-fix ban

Utah FORGE pages are disposable authoring state. App behavior, runtime behavior, editor behavior, tests that claim app behavior, and agent fixes must not depend on current page IDs, page filenames, page numbers, page titles, page order positions, live pageOrder discovery, or source/target page pairs.

App-behavior tests must use synthetic in-memory fixtures or fixture builders. Dynamic selection from live project.json pageOrder is deck-state coupling, not app-behavior proof.

Deck snapshot, deck matrix, and presentation audit tools may inspect live pageOrder only when explicitly named as deck-state tools and excluded from app-health verification.

If a failing behavior is observed on a page pair, the fix must be filed against the reusable behavior family: transition entity matching, effective-state resolution, layer style composition, visibility resolution, camera policy, legend state, save/persistence, or validation. Never fix by targeting the observed page pair.

## Transition Runtime Operating Spec

Before transition runtime, editor/save transition gating, scene-section, Section ISO, working-area focus, opacity, or page-navigation work, read:

docs/dev-context/Transition-Runtime-Operating-Spec.md

This spec is the active operating contract for current transition work. Older audits and matrix logs are evidence only.
