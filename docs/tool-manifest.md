# GeoSee Tool Manifest

Status: reference doc - describes all user-facing editor tools grouped by category.

Implementation constraint: field-level editor sidebar control identity is owned
by `docs/dev-context/editor-control-manifest.json`; editor changes must follow
`docs/dev-context/Editor-Control-Manifest-Policy.md`.

Scope: all projects unless noted. "Project-specific" entries carry a scope tag.

---

## Presentation Structure

Tools that define and manage the presentation sequence.

| Tool | Description |
| --- | --- |
| **Pages** | Create, select, reorder, show/hide, duplicate, and delete presentation pages. Each page carries its own camera pose, layer visibility, environment, and overlay copy. |
| **Page Color** | Per-page accent hue/saturation, used in the presenter UI chrome. |
| **Page Render Override** | Per-page cinematic quality preset inside Cinematics that overrides the project-wide default for that page only. |
| **Cards** | Per-page text editor. Controls page title, subtitle, markdown body, inset images, and fade/gap/easing timing for the text animation. |

---

## Scene & Rendering

Tools that control how the 3D scene looks globally.

| Tool | Description |
| --- | --- |
| **Cinematics** | Top-level container for global rendering, UI, and page camera controls. Houses the sub-tools below. |
| **Cinematic Render Preset** | Project-wide render quality selector. Save and update named presets. Drives antialiasing, shadow quality, AO, bloom, and related passes. |
| **Environment** | Cinematic scene atmosphere and world-building controls that are not owned by a more specific tool. Topo map atmosphere, clouds, sun, and map fog live under Topo Environment. |
| **Local Atmosphere Volume** | Environmental `atmosphere-volume` layer model for local mist/fog/cloud volumes. In the editor, user-facing cloud authoring lives under `Topo > Environment > Clouds`. |
| **Lighting Studio** | Sun azimuth and elevation, plus key/fill/rim light intensities. Supports movable source lights for accent and shadow control. |
| **Camera Studio** | Global cinematic camera controls: render presets, lens type/FOV, and double-click camera focus timing. |
| **Post Processing** | Cinematic post stack controls: object/distance-aware depth of field, tilt-shift, post-production grade, image finish, glow, film/optics, motion trails, composition guides, presentation frame/matte, and contact depth. DOF is split into Focus Target, Blur Strength, and Focus Debug controls. |
| **Terrain Grid** | Toggles hillshade and contour overlay on the terrain surface. Controls contour visibility and line styling. |

---

## UI

Tools that configure the client-facing chrome and branding.

| Tool | Description |
| --- | --- |
| **Editor** | Controls editor-sidebar chrome variables: panel size and margins, header sizing, section spacing, bar shape, page-list indent, scroll padding, and slider geometry. |
| **Client Logo** | Upload a client logo image and set its screen position and anchor point. |
| **GUI Styles** | Controls overlay panel appearance: background color and alpha, border, backdrop blur, shadow, and corner radius. |

---

## Camera

Tools that control how the camera behaves per page.

| Tool | Description |
| --- | --- |
| **Camera Dynamics** | Per-page camera pose, transition timing, shot templates, and timed dolly/truck/crane/handheld motion inside Cinematics. |
| **Camera Pose** | Capture and store the current camera view as the page's recorded pose. Supports a numbered pose history. |
| **Camera Transition** | Duration, easing curve, and hold time for the animated move into this page's pose from the previous one. |
| **Cinematic Post Transition** | Runtime transition channel that blends page-local grade, DOF, tilt-shift, lens, motion-trail, guide thickness, and presentation-frame scene overrides using the page transition duration/easing. |
| **Dynamic Movement** | Master toggle for orbit and zoom motion that plays while a page is active. |
| **Shot Templates** | Per-page starting points for push-in, pull-back, truck, and crane moves. |
| **Camera Orbit** | Configures continuous orbit: speed, direction, distance, height, path-aware blend, and ramp-in/out timing. |
| **Camera Zoom** | Configures a timed FOV push: delta degrees, start/end ms offsets, and zoom curve. |
| **Camera Dolly** | Moves camera and target together along the camera-local forward axis with shared shot timing. |
| **Camera Truck** | Moves camera and target together along the camera-local right axis. |
| **Camera Crane** | Moves camera and target together along the page up axis. |
| **Handheld Polish** | Adds subtle page-local handheld drift and camera roll for presentation shots. |
| **Camera Target** | Screen-pick or manual XYZ entry for the orbit center point. |

---

## Sections

Tools that define authored spatial cuts and site-of-interest cropping. Currently Utah FORGE only.

| Tool | Description | Scope |
| --- | --- | --- |
| **Sections** | Top-level editor container for section planes, crop/focus controls, and the Phase 3 working-area boundary. | Utah FORGE |
| **Scene Section Planes** | Virtual cross-section tool. Selects the target geophysical product and controls plane position along each axis. | Utah FORGE |
| **Phase 3 Working Area** | Visibility and style control for the required Phase 3 working-area boundary. | Utah FORGE |
| **Working Area Focus** | Targets a layer as the focal zone; reduces outside-zone opacity and boosts inside-zone brightness for client presentations. | Utah FORGE |

---

## Geographic Context

Tools for the public topographic map surface and associated cartographic layers.

| Tool | Description |
| --- | --- |
| **Topo** | Global toolset container for the topographic surface, graticule, title block, and reference layers. Present when the project has topo-tagged layers. |
| **Topo Settings** | Terrain material preset and elevation gradient controls, including the named Utah high-desert/topo preset, low/mid/high color stops, midpoint position, contrast, and blend mode. |
| **Topo Environment** | Cloud-icon section under Topo for scene atmosphere, clouds, sun, and fog. |
| **Clouds** | Add, duplicate, delete, select, show/hide, page-override, move, size, and style `atmosphere-volume` cloud banks. Controls subtype, color, opacity, density, softness, puff count/scale, bounds, falloff, seed, drift, depth test, render order, and optional on-screen bounds handles. |
| **Sun** | Controls whether the sun is a light source, a visible sky image/orb, both, or neither. Exposes azimuth, elevation, camera lock, orb color/opacity/size/distance, edge blur, halo color/opacity/scale, source marker, light color/intensity, terrain relief, shadow edge/tint, projected shadows, shadow opacity/softness/bias. |
| **Fog** | Scene fog and map/layer fog controls, including fog color, density/reach, terrain fog gradient, and layer fog participation. |
| **Longitude / Latitude Grid** | Graticule appearance: line spacing, color, width, opacity, and label distance from the surface. |
| **Title Block** | Upload and position a map title or branding image on the topo surface. Supports anchor and XY offset. |
| **Reference Layers** | Fine cartographic detail layers (roads, streams, etc.). Controls distance fade near/far, far-plane scale, far opacity, and surface lift. |

---

## Site & Spatial

Tools for spatial framing and site-level orientation. Currently Utah FORGE only.

| Tool | Description | Scope |
| --- | --- | --- |
| **Site Boundary** | Visibility and style control for the site polygon boundary layer. | Utah FORGE |
| **Demo Boreholes** | Controls for well trajectory visualization (16A injection, 16B production), priority source-location markers, label visibility, optional always-on-top rendering, and optional rendered-topo alignment. Line style, path treatment, top rings, source marker modes, and color remain visual presentation controls only. | Utah FORGE |

---

## MT Resistivity

Tools for magnetotelluric resistivity data. Utah FORGE only. These are the second toolset being aligned to the global-tool pattern (after Topo).

| Tool | Description |
| --- | --- |
| **MT Stations** | Marker visibility for the 122 physical MT station locations. Supports a QC data panel and color/size styling. |
| **MT Station Topo Alignment** | Optional rendered-topo alignment for station markers and labels. Uses the active topo surface height for presentation placement and falls back to source elevation when the surface is unavailable. |
| **MT Full-Density Points** | Tiled scalar point cloud from the full 1,094,624-point resistivity model. Scalar ramp controls (color gradient, blend range, display range, contrast). |
| **MT Volume** | 3D scalar volume renderer. Product selector, raymarch or slice mode, opacity, density, sample step, transfer function, threshold min/max, scalar ramp, and section isoband overlay. |
| **MT Threshold Surfaces** | Isosurfaces extracted from the scalar volume at user-defined resistivity boundaries. Product selector, boundary definitions editor, per-boundary opacity, wireframe toggle, roughness/metalness, smooth normals, and emissive boost. |
| **MT Top Surface** | Observed top-envelope mesh derived from the top-most full-density cell-center point per XY column. Surface lift, wireframe, roughness, metalness. |
| **MT Top Contact Surface** | Full-extent top-contact support-grid surface retained as a technical provenance endpoint. Same controls as MT Top Surface. |
| **MT Authored Slices** | Horizontal and vertical resistivity slice planes derived from the full uncropped model. Slice ID selector, orientation, position slider, and scalar ramp. |
| **MT QA Point Subset** | 90,000-point QA/support subset for context checks only. Scalar ramp controls. Not a computational substitute for full-density data. |

---

## Seismic Analysis

Tools for the Phase 3 seismic browser. Utah FORGE only.

| Tool | Description |
| --- | --- |
| **Seismic Analysis** | Container for the Phase 3 seismic browser. Hosts capability-product rows and review workflows. |
| **Capability Product Rows** | One control row per seismic product. Supports per-product visibility and product-specific slice/volume state. |
| **Raymarch Volume Products** | Four 3D-capable products expose volume visibility, sample density, opacity, amplitude, colormap, and synced slice-through-volume controls. |
| **Section Products** | Section-only products expose slice visibility, active section selection, position, amplitude, palette, and time-scale controls. |
| **Figure Annotations** | Section-attached presentation overlay for source-domain axis ticks, distance scale bar, direction labels, caption box, optional well trace, and optional horizon polyline. Time products keep TWT as the primary vertical axis; depth products use metres below datum. |
| **Display Cleanup** | Shared cleanup controls for white-background removal, amplitude windowing, time-scale, and global navigation visibility. |
| **Survey Navigation** | Source, receiver, line, and integrated-geophysics visibility controls for technical review pages. |
| **Theatre / Comparison** | Presentation workflows for 2D theatre, side-by-side product comparison, data-room review, export layout, and MT coexistence. |

---

## Layer Data Controls

Universal per-layer controls available on every data layer regardless of type.

| Control | Description |
| --- | --- |
| **Visibility Toggle** | Show or hide the layer in the 3D scene. Supports global and per-page overrides. |
| **Opacity Slider** | 0-100% layer transparency. Supports global and per-page overrides. |
| **Fog Inclusion** | Whether the layer participates in scene fog. Supports global and per-page overrides. |
| **Page Environment Override** | Per-page overrides for fog density, exposure, and bloom that apply when this page is active. |
| **Local Atmosphere Volume Style** | For `atmosphere-volume` environmental layers, controls subtype, color, opacity, density, softness, puff count/scale, scale jitter, vertical falloff, edge fade, seed, drift, depth test, and render order through `environment.layerStyles` or page-local `layerOverrides`; these controls do not mutate `project.json` layer metadata. |

---

## Audience

Tools for runtime audience segmentation. Case Study B only.

| Tool | Description | Scope |
| --- | --- | --- |
| **Audience Lens** | Grid of audience perspective presets. Each lens adjusts zone opacity levels to emphasize what is relevant for that audience type. Presenter-mode-only; no editor state change. | Case Study B |

---

## Workflow

Controls for save state and mode switching.

| Control | Description |
| --- | --- |
| **Save** | Writes current project edits to disk through the dev-only Vite plugin endpoint. Shows an unsaved-change counter and save status (saving / error / clean). |
| **Enter Preview** | Floating toggle that switches from editor to presenter view. |
| **Exit Preview** | Returns from presenter view to editor. |
