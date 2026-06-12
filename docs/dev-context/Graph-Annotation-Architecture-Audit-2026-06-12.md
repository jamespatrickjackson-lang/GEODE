# Graph Annotation Architecture Audit

Status: implemented architecture audit

Date: 2026-06-12

## Finding

The pre-implementation seismic figure annotation controls were layer-scoped,
while the runtime surfaces that need annotation are target-scoped. A single
`seismicFigure*` container cannot safely describe Line 301, Line 302, L5, L11,
3D inline/crossline/sample planes, raymarch volumes, scene-section cuts, and
item/object graphs at the same time.

## Implementation Outcome

The merged implementation makes Section Options the authoring surface for
target-scoped graph annotations. New state is stored in
`graphAnnotationDefaults`, `graphAnnotationProfiles`, and
`graphAnnotationSelectedTargetKey`; legacy `seismicFigure*` fields remain
readable fallback defaults for existing pages.

Static seismic section annotations now derive target identity from graph family,
layer id, product id, object kind, object id, and comparison role. Page ids,
page titles, page order, and fixture paths are not graph identity. Annotation
roots and materials expose transition entity metadata so the exact-key entity
opacity executor can enter/exit figure annotations independently from whole
seismic layer fades.

Verification anchors:

- `node tests/tools/graph-annotation-model.test.mjs`
- `node tests/tools/seismic-figure-annotations.test.mjs`
- `node tests/tools/seismic-section-graph-basis.test.mjs`
- `node tests/tools/seismic-graph-transition-executor.test.mjs`

## Target Matrix

| Target type | Data source | Runtime owner | Required target key | Plane basis | Opacity behavior | Transition behavior |
| --- | --- | --- | --- | --- | --- | --- |
| 2D seismic line section | seismic manifest product section path, sample domain, navigation placement | seismic browser section mesh | layer + product + `2d-section-line` + section id | trace-header path curtain | follows target presence, not amplitude alpha | preserve/move when target key matches; exit/enter on product change |
| 3D seismic section plane | seismic manifest 3D section path or sample surface grid | seismic browser section mesh | layer + product + `3d-section-plane` + section id | inline/crossline path curtain or sample plane grid | follows selected slice/product presence | preserve/move for same product/axis/fraction; crossfade for domain/render-mode change |
| 3D seismic volume | raymarch volume scene bounds, sample domain, value encoding | seismic browser volume mesh | layer + product + `3d-volume` + volume id | axis-aligned volume bounds until trace-grid volume orientation is validated | independent readable annotation opacity, composed with volume presence | enter when volume data ready; late attach at transition envelope |
| MT slice | MT slice manifest, mesh preview, section line metadata | MT slice renderer | layer + slice id + slice kind | horizontal elevation plane or vertical section plane | follows slice presence, not scalar color alpha | preserve/move for same slice id; exit/enter for slice id change |
| MT/scalar volume object | scalar volume/threshold object metadata | scalar/threshold renderers | layer + product/object/surface id | volume bounds or surface bounds | composed with layer/product/section opacity | derived entity follows source object and scene-section masks |
| Scene-section cut | resolved scene-section frame/plane plus targeted object/product ids | scene-section controller | scene-section layer + frame id + target layer/product/object id | resolved frame axis vectors and bounds | follows section target active state and outside opacity | move/interpolate for compatible frame moves; crossfade for incompatible frame/source changes |
| Item/object graph | object userData product/object/surface ids | owning layer renderer | layer + item/object/surface id | object-provided graph plane or bounding plane | follows object visibility and layer transition opacity | preserve by stable item id; discrete when representation changes |
| Processing comparison | primary/comparison product ids and comparison role | seismic browser section meshes | layer + product + comparison role + object id | same as section target, role-qualified | primary and comparison annotations scoped separately | side-by-side offset moves with comparison spacing |

## Current Render-Stack Trace

2D and 3D static seismic section annotations:

- Environment/page source: resolved `EditableStyle` from environment/page layer styles.
- Active asset/cache key: seismic product payload loaded by `loadSeismicBrowser`.
- Runtime owner: `applySeismicBrowserStyle`.
- Mesh geometry: `seismicSectionGraphBasis` from `buildSeismicSectionGraphBasis`.
- Shader/material: seismic section `ShaderMaterial`; figure annotation text is separate plane meshes with double-sided readable shader.
- Opacity stack: section source opacity is assigned to product material; annotation root has independent material opacity and is currently present only when the section mesh is visible.
- Resolved: persisted annotation style is target-keyed through graph annotation
  profiles, with `seismicFigure*` kept as a fallback default source.

3D seismic raymarch volume:

- Environment/page source: same seismic browser layer style.
- Active asset/cache key: raymarch volume file loaded only when `includeVolume` is requested.
- Runtime owner: `applySeismicBrowserStyle`.
- Mesh geometry: `BoxGeometry` from `seismicVolumeCurrentBounds`; current model is explicitly axis-aligned envelope.
- Shader/material: back-side raymarch `ShaderMaterial`.
- Opacity stack: `volumeSourceOpacity = opacity * sectionIsoSourceOpacity`.
- Gap: no annotation root is attached to volume meshes.

Scene-section cuts:

- Environment/page source: resolved scene-section virtual layer style.
- Runtime owner: `sceneSectionController`.
- Geometry: `resolveSceneSectionFrames` and `resolveSceneSectionPlanes`.
- Shader/material: target object materials receive section uniforms; helpers are separate studio roots.
- Opacity stack: section outside opacity is a mask/attenuation channel and helper opacity is transition-owned.
- Gap: graph annotations are not represented as scene-section-derived render entities.

## Implementation Guardrails

- No page id, page index, page title, page order, project page fixture, or Utah page special case may appear in target keys.
- Graph annotation target keys must be centralized and reusable by renderer, editor, and transition graph code.
- Legacy `seismicFigure*` fields remain readable fallback defaults.
- New authoring state uses `graphAnnotationDefaults`, `graphAnnotationProfiles`, and `graphAnnotationSelectedTargetKey`.
- Graph text is plane-locked and back-face-readable. It must not billboard.
- Scene-section helper labels may remain camera-aware studio controls; graph annotations may not reuse that policy.
- Annotation opacity composes with target presence and transition opacity, but does not inherit seismic amplitude/background-removal alpha or raymarch density.
