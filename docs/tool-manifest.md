# GeoSee Tool Manifest

Status: reference doc - describes all user-facing editor tools grouped by category. Does not constrain implementation.

Scope: all projects unless noted. "Project-specific" entries carry a scope tag.

---

## Presentation Structure

Tools that define and manage the presentation sequence.

| Tool | Description |
| --- | --- |
| **Page Manager** | Create, select, reorder, show/hide, duplicate, and delete presentation pages. Each page carries its own camera pose, layer visibility, environment, and overlay copy. The pseudo-page "Global Settings" routes to scene-wide controls without entering a real page. |
| **Page Color** | Per-page accent hue/saturation, used in the presenter UI chrome. |
| **Page Render Override** | Per-page cinematic quality preset that overrides the project-wide default for that page only. |
| **Overlay Box Manager** | Per-page text editor. Controls page title, subtitle, markdown body, inset images, and fade/gap/easing timing for the text animation. |

---

## Scene & Rendering

Tools that control how the 3D scene looks globally.

| Tool | Description |
| --- | --- |
| **Visual Studio** | Top-level container for global rendering controls. Houses the sub-tools below. |
| **Cinematic Render Preset** | Project-wide render quality selector. Save and update named presets. Drives antialiasing, shadow quality, AO, bloom, and related passes. |
| **Environment** | Scene atmosphere: background color/sky, fog density, ambient occlusion, tone mapping, and exposure. |
| **Lighting Studio** | Sun azimuth and elevation, plus key/fill/rim light intensities. Supports movable source lights for accent and shadow control. |
| **Camera Studio** | Global camera field of view, near/far clipping planes, and orbit control settings. |
| **Terrain Grid** | Toggles hillshade and contour overlay on the terrain surface. Controls contour visibility and line styling. |

---

## Client UI

Tools that configure the client-facing chrome and branding.

| Tool | Description |
| --- | --- |
| **Client Logo** | Upload a client logo image and set its screen position and anchor point. |
| **GUI Styles** | Controls overlay panel appearance: background color and alpha, border, backdrop blur, shadow, and corner radius. |

---

## Camera

Tools that control how the camera behaves per page.

| Tool | Description |
| --- | --- |
| **Camera Dynamics** | Per-page container for camera pose and transition controls. Houses the sub-tools below. |
| **Camera Pose** | Capture and store the current camera view as the page's recorded pose. Supports a numbered pose history. |
| **Camera Transition** | Duration, easing curve, and hold time for the animated move into this page's pose from the previous one. |
| **Dynamic Movement** | Master toggle for orbit and zoom motion that plays while a page is active. |
| **Camera Orbit** | Configures continuous orbit: speed, direction, distance, height, path-aware blend, and ramp-in/out timing. |
| **Camera Zoom** | Configures a timed FOV push: delta degrees, start/end ms offsets, and zoom curve. |
| **Camera Target** | Screen-pick or manual XYZ entry for the orbit center point. |

---

## Sections & Cropping

Tools that define authored spatial cuts and site-of-interest cropping. Currently Utah FORGE only.

| Tool | Description | Scope |
| --- | --- | --- |
| **Sections & Cropping** | Top-level editor container for section planes, crop/focus controls, and the Phase 3 working-area boundary. | Utah FORGE |
| **Scene Section Planes** | Virtual cross-section tool. Selects the target geophysical product and controls plane position along each axis. | Utah FORGE |
| **Phase 3 Working Area** | Visibility and style control for the required Phase 3 working-area boundary. | Utah FORGE |
| **Working Area Focus** | Targets a layer as the focal zone; reduces outside-zone opacity and boosts inside-zone brightness for client presentations. | Utah FORGE |

---

## Geographic Context

Tools for the public topographic map surface and associated cartographic layers.

| Tool | Description |
| --- | --- |
| **Public Topo Map** | Global toolset container for the topographic surface, graticule, title block, and reference layers. Present when the project has topo-tagged layers. |
| **Topo Settings** | Elevation gradient: low/mid/high color stops, midpoint position, contrast, and blend mode. |
| **Longitude / Latitude Grid** | Graticule appearance: line spacing, color, width, opacity, and label distance from the surface. |
| **Title Block** | Upload and position a map title or branding image on the topo surface. Supports anchor and XY offset. |
| **Reference Layers** | Fine cartographic detail layers (roads, streams, etc.). Controls distance fade near/far, far-plane scale, far opacity, and surface lift. |

---

## Site & Spatial

Tools for spatial framing and site-level orientation. Currently Utah FORGE only.

| Tool | Description | Scope |
| --- | --- | --- |
| **Site Boundary** | Visibility and style control for the site polygon boundary layer. | Utah FORGE |
| **Demo Boreholes** | Controls for well trajectory visualization (16A injection, 16B production). Line style (solid/dashed), path treatment (survey/smoothed/normalized), and color. | Utah FORGE |

---

## MT Resistivity

Tools for magnetotelluric resistivity data. Utah FORGE only. These are the second toolset being aligned to the global-tool pattern (after Public Topo Map).

| Tool | Description |
| --- | --- |
| **MT Stations** | Marker visibility for the 122 physical MT station locations. Supports a QC data panel and color/size styling. |
| **MT Full-Density Points** | Tiled scalar point cloud from the full 1,094,624-point resistivity model. Scalar ramp controls (color gradient, blend range, display range, contrast). |
| **MT Volume** | 3D scalar volume renderer. Product selector, raymarch or slice mode, opacity, density, sample step, transfer function, threshold min/max, scalar ramp, and section isoband overlay. |
| **MT Threshold Surfaces** | Isosurfaces extracted from the scalar volume at user-defined resistivity boundaries. Product selector, boundary definitions editor, per-boundary opacity, wireframe toggle, roughness/metalness, smooth normals, and emissive boost. |
| **MT Top Surface** | Observed top-envelope mesh derived from the top-most full-density cell-center point per XY column. Surface lift, wireframe, roughness, metalness. |
| **MT Top Contact Surface** | Full-extent top-contact support-grid surface retained as a technical provenance endpoint. Same controls as MT Top Surface. |
| **MT Authored Slices** | Horizontal and vertical resistivity slice planes derived from the full uncropped model. Slice ID selector, orientation, position slider, and scalar ramp. |
| **MT Point Preview** | Low-resolution 90,000-point preview for QA context only. Scalar ramp controls. Not a computational substitute for full-density data. |

---

## Seismic Analysis

Tools for the Phase 3 seismic browser. Utah FORGE only.

| Tool | Description |
| --- | --- |
| **Seismic Analysis** | Container for the Phase 3 seismic browser. Hosts capability-product rows and review workflows. |
| **Capability Product Rows** | One control row per seismic product. Supports per-product visibility and product-specific slice/volume state. |
| **Raymarch Volume Products** | Four 3D-capable products expose volume visibility, sample density, opacity, amplitude, colormap, and synced slice-through-volume controls. |
| **Section Products** | Section-only products expose slice visibility, active section selection, position, amplitude, palette, and time-scale controls. |
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
