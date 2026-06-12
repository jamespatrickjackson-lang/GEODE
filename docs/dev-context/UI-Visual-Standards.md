# UI Visual Standards

Status: active visual standards for lightweight UI polish

## Purpose

This doc records current UI spacing, legend, slider, and handle rules that
should be easy to find during visual iteration.

Executable values live in source code. This doc describes the intended visual
contract and points to the owning source files. Durable rationale belongs in
`docs/03-decisions.md`.

## Source Of Truth

| Surface | Executable source | Notes |
| --- | --- | --- |
| Viewport legend panel, stack, circular toggles, and row spacing | `src/ui/legendStyles.ts` | Shared legend constants and helpers. |
| Section frame scale axes | `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`, `src/scene/section/sceneSectionController.ts` | Editor controls plus runtime helper generation. |
| Native range slider height, track, thumb, and fill variables | `src/styles/global.css` | App-wide native slider styling. |
| MT resistivity window/opacity-ramp handles | `src/ui/ResistivityLegend.tsx` | Ramp-specific draggable handle sizing. |
| Visual rationale / durable UI choices | `docs/03-decisions.md` | Use decision entries for persistent policy changes. |
| Current visual review loop | `docs/dev-context/Visual-Review-Current.md` | Keep short and current. |

## Editor Reveal And Camera Focus

- Single-clicking a rendered scene element reveals the corresponding editor row
  using stable target ids such as `layer:<layerId>` and
  `product:<layerId>:<productId>`. Seismic scene-section object targets add
  representation identity for current runtime targets, such as
  `product:<layerId>:<productId>:volume` and
  `product:<layerId>:<productId>:section`.
- Reveal opens only the owning top-level workflow and the minimum parent group
  needed to make the row visible. Arrow/disclosure child containers such as
  `Appearance`, `Labels`, and `Provenance` keep their authored state.
- The active editor scroll container aligns the selected row as close to the
  top as available content allows.
- When scrolling settles, a pill-shaped target pulses once. A plain text target
  pulses twice. Pulse effects must not change layout: use box-shadow,
  text-shadow, transform, or opacity only.
- Reduced-motion mode replaces pulse animation with a static highlight and
  snaps camera focus instead of tweening.
- Double-clicking a rendered scene element enters camera object focus at the
  exact picked surface point. The object bounds are used only to compute the fit
  distance.
- Left-clicking empty space is a no-op in focus mode. Right mouse button exits
  focus without snapping the camera back.
- Same-target double-click re-anchors to the newly picked point and uses the
  authored same-target zoom factor.
- `Camera Studio` section order is: `Render Preset`, `Lens Types`,
  and `Camera Focus`.
- `Render Preset` is one apparent authoring surface. It must show the project
  `Project preset` selector in every authoring context and, when a
  presentation page is selected, show that page's `Page preset` override
  directly beside it. Do not hide either selector behind Global Settings-only,
  page-only, or Presentation Presets modes. Preset bodies should open by
  default.
- `Post Processing` follows `Camera Studio` in Cinematics. Its section order is:
  `Depth of Field`, `Tilt-Shift`, `Post Production`, `Image finish`, `Glow`,
  `Film / Optics`, `Motion Trails`, `Composition Guides`,
  `Presentation Frame`, and `Contact Depth`.
- `Camera Focus` owns double-click focus timing only. `Depth of Field` owns
  default-off cinematic blur, including page-target, camera-object,
  manual-distance, and picked-point focus modes. The editor splits DOF into
  `Focus Target`, `Blur Strength`, and `Focus Debug` so focus distance/object
  targeting is not mixed with blur intensity or debug-plane styling.
- Page-local cinematic post overrides use the `main-camera/cinematic-post`
  transition channel; continuous post values blend with page transition easing
  and must not snap at navigation start.
- `Motion Trails`, `Presentation Frame`, `Composition Guides`, and DOF
  debug-style controls must remain toggleable and default off; do not leave
  guide overlays, matte bars, focus planes, or trail effects enabled as
  diagnostics. Composition guide and presentation-frame strokes default to
  `lineThickness: 0.25`, which is half the previous width, and render through
  the lens-grade shader with a `0.0003` minimum.
- Lens presets write `scene.camera.lensPreset` and the matching FOV value, but
  page poses still own camera position, target, and up vector.
- Pages may persist `cameraObjectFocus`. A page with saved focus re-engages the
  lock after its normal camera transition. A page without saved focus releases
  any existing lock at navigation start.

## Viewport Legend Containers

- Viewport legends are lightweight transparent overlays unless a specific tool
  requires a card/backplate.
- Shared panel width is `282px`.
- Shared panel padding is `14px`, unless a specific legend has an explicit
  reviewed exception.
- Viewport legends align to the standard page-edge margin:
  `LEGEND_PAGE_EDGE_MARGIN_PX = 16px`.
- The bottom-most visible legend container sits
  `LEGEND_BOTTOM_EDGE_OFFSET_PX = 100px` above the viewport bottom.
- Stacked viewport legend containers use `LEGEND_STACK_GAP_PX`.
- Current reviewed stack gap is `14px`.
- Inter-legend stack spacing should stay centralized in `src/ui/legendStyles.ts`
  rather than hand-tuned per legend.

## Legend Toggle Rows

Circular checkbox/swatch rows should use `legendControlRowStyle()` from
`src/ui/legendStyles.ts`.

Viewport legend text colors should resolve through
`resolveLegendTextColors()` from `src/ui/legendStyles.ts`:

- Heading text uses Overlay box text `Heading color` (`gui.overlay.textColor`).
- Subtitle/supporting text uses Overlay box text `Subtext color`
  (`gui.overlay.secondaryTextColor`).
- Body/control text uses Overlay box text `Body color`
  (`gui.overlay.bodyTextColor`), falling back to heading color.
- Generic active state circles use the resolved heading color.

Current reviewed row tokens:

| Token | Value |
| --- | ---: |
| Checkbox/swatch circle size | `13px` |
| Box column width | `16px` |
| Row inset under heading | `4px` |
| Box-to-label gap | `14px` |
| Heading-to-first-row gap | `11.475px` |
| Subsequent row gap | `9px` |

Generic legend state circles:

- Shape: circle.
- Outline: none.
- Off state: gray circle.
- On state: resolved heading-color circle.
- Tick marks: none.

Color swatch toggles:

- Shape: circle.
- Outline: none.
- On state: tied layer/axis/boundary color.
- Off state: gray circle.
- Tick marks: none.

Current color swatch toggle examples:

- Section plane rows: `X Section`, `Y Section`, `Z Section`.
- MT surface boundary rows under `MT Threshold Boundaries`.

## Compact quick legend geometry

- Scene Section, Section ISO, Borehole logs, MT threshold boundary, and
  Seismic amplitude quick legends use the shared compact quick-legend helpers in
  `src/ui/legendStyles.ts`.
- Primary pills are centered compact buttons; icon buttons are centered compact
  circles. Do not hand-tune local quick-legend widths, alignment, font sizes, or
  icon centering without adding a documented exception.
- Inactive quick-legend buttons use the shared inactive gray. Active parent
  rows keep full color; unavailable child actions may dim only through the
  shared inactive/transparent state.
- Controls opener buttons use row availability, not popout-open state.
- Borehole logs use compact text-only buttons. The quick legend exposes the
  layer toggle plus working gamma track toggles only; non-working spine,
  resistivity, and lithology controls do not appear in the quick legend.
- `MT Resistivity Cells` uses the same compact quick-legend geometry. Its title
  toggles only `utah-forge-mt-resistivity-full-density`; volume, slices, QA
  preview, Section ISO, scene sections, and threshold products stay under their
  own owners. The MT Cells controls opener sits immediately after the MT Cells
  title pill, before the All Valid Cells and Log10 Resistivity Window mode
  buttons.
- Seismic amplitude uses the same compact quick-legend row. The header shows a
  `Seismic Amp` name pill, then the visible palette dropdown with no separate
  `Palette` text label, then a controls opener, then an information opener with
  an `i` icon. The visible legend body owns only the amplitude ramp and numeric
  ticks. The controls popout owns the slice axis buttons, slice slider, and
  secondary controls including the `Presentation-enhanced PSDM surrogate` panel.
  The information popout owns source, product, provenance, velocity reference,
  datum, and context readouts.
- The `Seismic Amp` name pill toggles the seismic browser layer visibility.
  `seismicPresentationBarVisible` only opts a visible seismic layer into the
  compact presentation legend; it must not keep the compact legend body or scene
  content visible when the seismic layer is off.
- When compact Seismic amplitude is visible, the legacy seismic amplitude panel
  is suppressed; its ramp and values belong in the compact Seismic amplitude
  legend, while slice controls belong in the compact controls popout.
- `All Valid Cells` and `Log10 Resistivity Window` are exclusive MT Resistivity
  Cells modes. All Valid Cells hides the compact log10 resistivity window body
  and shows every valid inversion cell center; Log10 Resistivity Window shows
  the log10(Ohm-m) window/fade controls and enables filtering by log10
  resistivity. Mode changes use the 1.5s slider-style scalar transition and
  must preserve authored scalar values for the next Log10 Resistivity Window
  use.
- All Valid Cells display suppresses resistivity isoline overlays while preserving
  authored isoline settings. Final mode persistence writes only
  `scalarLegendVisible` and `scalarInclusionMode`.
- Local MT Resistivity Cells mode animations are app-level view transitions. They
  must be scoped to the current effective page context and canceled/ignored when
  navigation changes that context, so a stale animation cannot overwrite an
  already-windowed page with an old All Valid Cells style.
- When the editor is on Global Settings/page 00, `previewEnvironmentBase` may
  strip unrelated page deltas, but it must preserve MT Resistivity Cells authored
  Log10 Resistivity Window fields for the full-density MT inversion cell
  centers. A Log10 Resistivity Window-authored page must load with its
  log10 resistivity window and isoline detail without requiring an All Valid
  Cells/Log10
  Resistivity Window click. Fix this through the Utah FORGE preview field map,
  not through page fixtures or transition internals such as
  `scalarInclusionFilterActive`, `SCALAR_TRANSITION_STYLE_FIELDS`, or
  `full-density-scalar`.
- During page transitions, the MT Resistivity Cells header state is the target
  authored mode. Interpolated scalar style may drive the ramp and handles only.
  Log10 Resistivity Window pages with line controls on must use transition-time
  scalar tween ownership: register the full-density scalar tween at transition
  setup so isoline overlays rebuild through the page-transition clock.
  Do not use a final-commit replay of target visibility or styles to make
  missing lines appear; that creates a visible jump.
- Once a page is settled, a suppressed target-page reapply may refresh only the
  full-density MT inversion cell-center style so page-load Log10 Resistivity
  Window isolines build. That narrow refresh must skip active scalar tweens
  and must not replay full page visibility/styles.
- No page-id, page-index, fixture-title, project page, or environment fixture
  special cases are allowed for viewport quick legends. Do not edit
  `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`,
  or `projects/*/environment.json` for quick-legend behavior.

## Legend Copy Rules

- Keep viewport legend copy compact and technical.
- Avoid explanatory helper prose inside legends when the control label is
  enough.
- Section plane legend:
  - Heading: `Section Planes`
  - Rows: `Z Section`, `X Section`, `Y Section`
  - Off rows render every row button in the shared inactive gray.
  - `Z Section` does not reserve a blank ground-trace slot; its Control frame
    button moves left into the gap.
- Section ISO legend:
  - Heading: `Section ISO`
  - Main toggle: `ISO overlay`
  - Volume-cut groups also show `Show volume`
  - `Options` is a circular toggle row at the bottom of the quick-control stack.
  - Dataset selector belongs in `Options`, not in the main legend body.
  - Do not show selected-target count subtitles such as `2/2 ...`
- MT resistivity legend:
  - Live MT inversion cell bar label: `MT Cells`.
  - The title button is full-density cell-center visibility only.
  - `All Valid Cells` and `Log10 Resistivity Window` are exclusive mode buttons.
  - The MT color gradient bar and numeric ticks stay visible in both modes.
    `All Valid Cells` hides only Log10 window handles and isoline controls.
  - Volume is handled by a separate owner, not this legend.
- MT threshold boundaries legend:
  - Heading: `MT Threshold Boundaries`
  - No subtitle.

## Legend Behavior Baseline

- MT threshold surface boundary buttons are the top-most Utah FORGE viewport
  quick legend whenever they are visible.
- Stacked Utah FORGE viewport legends keep MT resistivity as the bottom legend,
  with Seismic amplitude directly above it whenever the seismic presentation
  legend is visible.
- Section ISO quick legends stack above Scene Section quick legends whenever
  both are visible.
- During page transitions, individual legend containers move in sequenced
  straight-line phases.
- Exiting legend containers first slide left at full row height.
- After exiting containers are out, their rows collapse and remaining rows move
  vertically to close the gap.
- Entering legend containers first reserve/open their target row space.
- After the space is open, entering containers slide in from the left.
- Stable legend containers remain horizontally fixed and only shift vertically
  during the row resize phase.
- Entering and exiting containers must be fully off-canvas before row resize is
  visible; those containers should not visibly move up or down.
- Section plane rows use their circles as show/hide controls for X/Y/Z section
  planes.
- `P Controle` shows/hides section clipping outlines and push/pull cones. It
  defaults on in editor mode and off in presenter mode unless overridden.
- Section frame scale axes are independent from `P Controle`; when an axis
  frame has scale axes enabled, they remain visible in presenter mode even if
  clipping outlines and push/pull cones are hidden.
- Floating labels follow scene-section clipping by testing each label anchor
  against active section planes; clipped anchors are hidden with their source
  feature.
- Surface boundary rows use their color circles as show/hide controls for each
  MT threshold boundary. Hidden rows stay listed while the boundary opacity is
  non-zero so they can be restored from the legend.
- MT threshold boundary all-off maps are treated as empty/stale visibility
  state. If the threshold-boundary layer is visible and no canonical or legacy
  boundary is active, the resolver inherits default boundary visibility so
  page-to-page navigation does not land on a visible line product with no lines.
  Hide the threshold-boundary layer to hide all boundary lines; do not repair
  this with page-level fixture edits.
- Section ISO keeps quick controls in the main legend as one stack: `ISO
  overlay`, optional `Show volume`, then `Options` at the bottom.
- Section ISO dataset selection and detailed line/band controls live in the
  `Options` popout.
- MT resistivity volume fine controls are hidden in the viewport legend.

## Seismic Figure Annotations

- Seismic figure annotations attach to the visible section plane, not to a
  floating screen overlay.
- The annotation frame is a presentation aid for source-domain metrics:
  section title, direction labels, horizontal distance scale, vertical
  source-domain ticks, caption, optional well trace, and optional horizon
  polyline.
- Time-domain products use TWT in ms/s as the primary vertical axis.
  Depth-domain products use metres below the seismic datum. Velocity products
  need a separate m/s value legend when shown as value products.
- Caption boxes use a compact dark translucent backplate so white labels remain
  legible over textured seismic sections.
- Authored well traces and horizon polylines are visual annotation marks unless
  a later source-backed validation workflow promotes them to registered control
  geometry.

## Topo-Aligned Site Overlays

- Site Details and MT station marker alignment to topo is a visual presentation
  mode. It samples the rendered topo surface and does not change source
  coordinates.
- Alignment falls back to source elevation when the topo surface is hidden or
  the height sampler is unavailable.
- Always-on-top Site Details rendering is allowed for presentation clarity, but
  should remain distinguishable from validated subsurface geometry.

## Section Frame Scale Axes

Section frame controls live inside each `X Section frame`, `Y Section frame`,
and `Z Section frame` editor subsection:

| Control | Style field | Range | Default |
| --- | --- | ---: | ---: |
| Show | `sceneSectionPlanes.<axis>.enabled` | on/off | off |
| Flip side | `sceneSectionPlanes.<axis>.invert` | on/off | off |
| Controls | `sceneSectionFrameByAxis.<axis>.controlsVisible` | on/off | legacy/global fallback |
| Active handle | `sceneSectionActiveAxis` | X/Y/Z | Z |
| Cut position | `sceneSectionPlanes.<axis>.positionM` | axis bounds | project default |
| Frame crop | `sceneSectionFrameByAxis.<axis>.enabled` | on/off | legacy/global fallback |
| Ground trace | `sceneSectionFrameByAxis.<axis>.groundTraceVisible` | on/off | legacy/global fallback |
| Ground line width | `sceneSectionFrameByAxis.<axis>.groundTraceWidthM` | `30m` to `2000m` | `360m` |
| Scale axes | `sceneSectionFrameByAxis.<axis>.axesVisible` | on/off | legacy/global fallback |
| Alignment | `sceneSectionFrameByAxis.<axis>.axisAlignment` | `utm`, `cardinal` | `utm` |
| Datum | `sceneSectionFrameByAxis.<axis>.axisDatum` | `utm`, `local`, `latlon` | `utm` |
| Local datum easting | `sceneSectionFrameByAxis.<axis>.axisDatumOriginEastingM` | UTM metres | frame center |
| Local datum northing | `sceneSectionFrameByAxis.<axis>.axisDatumOriginNorthingM` | UTM metres | frame center |
| Lat/Lon decimals | `sceneSectionFrameByAxis.<axis>.axisDatumLatLonDecimals` | `0` to `6` | `3` |
| Axis interval | `sceneSectionFrameByAxis.<axis>.axisIntervalM` | `0.1km` to `50km` | `5km` |
| Text size | `sceneSectionFrameByAxis.<axis>.axisTextScale` | `0.4x` to `100x` | `1x` |
| Text padding | `sceneSectionFrameByAxis.<axis>.axisTextPaddingM` | `0km` to `10km` | `0.42km` |
| A heading | `sceneSectionFrameByAxis.<axis>.axisAHeading` | text | `<axis name> (km)` |
| B heading | `sceneSectionFrameByAxis.<axis>.axisBHeading` | text | `<axis name> (km)` |
| Heading padding | `sceneSectionFrameByAxis.<axis>.axisHeadingPaddingM` | `0km` to `20km` | `1.1km` |
| Heading color | `sceneSectionFrameByAxis.<axis>.axisHeadingColor` | color | section axis color |
| Heading size | `sceneSectionFrameByAxis.<axis>.axisHeadingScale` | `0.4x` to `100x` | `1.2x` |

- Axis interval has both slider and numeric inputs per frame, displayed in
  kilometers. For example, `0.1` means 100m and `1` means 1km.
- Alignment and datum are independent per frame. `utm` alignment keeps the
  current grid-axis section geometry. `cardinal` alignment rotates only the
  section frame and its helpers by local UTM convergence around the frame
  center. Scene data, saved cameras, terrain, MT volumes, drillholes, and topo
  graticules are not globally reprojected or rotated.
- Datum changes scale-axis tick/readout behavior only. `utm` keeps absolute
  easting/northing labels, `local` uses the frame's local datum origin for
  distance ticks, and `latlon` shows decimal-degree longitude/latitude.
  Elevation labels remain absolute elevation in kilometres.
- Show, flip side, controls, and active-handle controls are compact header
  controls on each X/Y/Z frame; there is no separate `X Section active` /
  `Y Section` / `Z Section` editor subsection.
- The quick viewport section legend mirrors the same per-axis page state: X, Y,
  and Z rows are always listed when the section legend is visible, with Show,
  Flip, Controls, and Scale axes controls. Ground trace is shown only for X/Y
  rows because Z frames do not render ground traces.
- Controls hides section outlines and push/pull handles only. It does not
  disable the section cut, ground trace, or scale axes. Built-in X/Y/Z frames
  must not use `sceneSectionFrames[].legendVisible`; stale values are migrated
  to `sceneSectionFrameByAxis.<axis>.controlsVisible`.
- Text size has both slider and numeric inputs per frame, displayed as a scale
  factor.
- Axis interval and text-size numeric fields render `km` / `x` as
  non-editable suffixes inside the edit field, not as separate row text.
- Scale-axis labels are derived from the active frame axis and datum: UTM
  easting/northing/elevation, local distance, or decimal longitude/latitude.
- Ground trace trims generated X/Y section volume-cut overlays above the
  sampled terrain surface; Z frames do not render ground traces. Ground line
  width is authored per frame.
- Ground-trace trim is a hard geometry mask for Section ISO bands and contour
  ribbons so generated ISO output does not protrude past the ground boundary.
- When Section ISO is enabled, section frame intersections draw white dashed
  traces where two enabled section frames overlap. These traces use the same
  dash, opacity, and depth behavior as ground traces. MT threshold boundaries
  do not create these traces.
- Axis labels stay flat to the section plane and flip to face the camera when
  viewed from the opposite side.
- Axis headings align to their scale axis. Default heading copy includes the
  measurement type in brackets, for example `Northing (km)`.
- X/Y/Z section frames can all draw scale axes; ground trace remains X/Y only.

## Scene Overlay And Transition Rendering

Canonical contract: `docs/dev-context/Page-Transitions-And-Section-Frames.md`.
The directives doc names the helper-stability rules and the transition-kind
registry. The bullets below are the visual standards (numeric ranges,
defaults, depth/compositing rules) that the contract enforces.

- Public topo material presets are reusable authoring choices, not hidden
  environment-only edits. The `Utah` preset is the default Utah FORGE public
  topo look: khaki high-desert lows, muted sage/tree greens through the middle
  elevations, darker forested relief, and warm snow/rock peak tones at the
  highest elevations. It remains a five-stop terrain shader ramp and does not
  imply terrain reprojection, new raster data, or geophysical product changes.
- Camera far-plane clipping is not a visual crop. Topo imagery, terrain
  context, and graticules must remain inside the camera frustum at presentation
  overview zoom; authored public surface crop and scene-section tools own
  intentional trimming.
- Topo graticule lines are CAD/reference lines on the terrain context. They
  depth-test against terrain and scene geometry and keep `depthWrite: false`.
- Longitude/latitude grid edge awareness clips interior grid lines near the topo
  boundary. It must not blend interior grid color toward white/gray edge colors
  or apply a directional edge-gradient fade. White edge leaders are short
  boundary cues; they attach to the same boundary-side crossing used by the edge
  label, are capped to boundary-tick length rather than label-offset length, and
  must stay clipped to the public surface clip rather than crossing the page.
- Targeted topo context follows scene-section clipping by default. This
  includes terrain/topomap pixels, satellite imagery sampled by the terrain
  shader, terrain-composited overlays, longitude/latitude graticule lines and
  labels, legends, and branding.
- Terrain underside grid helpers use camera-side hysteresis. The grid appears
  only when the camera is clearly below terrain and hides only after returning
  clearly above terrain; it also stays hidden outside terrain XY bounds.
- Section ISO overlay opacity is composed, not overwritten. Effective opacity
  equals authored overlay opacity multiplied by page/layer transition opacity
  and the threshold-surface occlusion attenuation.
- Section ISO bands and lines crossfade by overlay root during page transitions.
  Entering roots fade in, exiting roots fade out, and geometry/identity changes
  crossfade source and target roots rather than snapping at final commit.
- ISO line attenuation through MT threshold surfaces remains `0.8^surfaceCount`,
  with short-frame smoothing so camera motion does not cause flicker.
- Compatible section-frame transitions interpolate numeric frame geometry by
  stable frame id: plane position, crop bounds, scale interval, label/heading
  sizing and padding, and ground trace width.
- Incompatible section-frame transitions crossfade helpers. Frame identity,
  orientation, enable state, flip state, target membership state, and added or
  removed frame ids are discrete for helper geometry. Helper crossfades are
  active-to-active only; section-frame studio controls must not fade into
  inactive/unrelated target pages.
- Sectioned render content uses transition-aware section masks. Compatible
  section changes interpolate numeric values; incompatible target/frame changes
  blend source and target mask alpha on the page transition clock.
- Section-frame outlines and push/pull control cones are editor/studio
  controls. They render above terrain, topo/satellite imagery, Section ISO, and
  transparent data products so the handles stay usable while authoring.
- Section ISO and MT/seismic cut identities include section frame id so multiple
  same-orientation section frames do not overwrite one another during page
  transitions.

## Topo Environment

`Topo > Environment` is the visual authoring home for scene-level public topo
environment controls. `Topo > Extents` owns map-edge and topo-surface extent
controls, including satellite opacity and map/topo fog.

- Environment group order: Scene atmosphere, Clouds, Sun, Scene fog.
- Use a cloud icon for the Environment section.
- Clouds get their own container. It includes add, duplicate, delete, layer
  selection, visibility, page override state, appearance, puffs, bounds, falloff,
  drift, and render controls.
- Cloud on-screen bounds helpers are optional, explicitly toggleable, and
  default off. They may show an outline plus move/scale handles, but they must
  not remain active as diagnostic clutter unless the author enabled them.
- Single-puff clouds must remain visually valid. Avoid random placement or
  jitter that can make a one-cloud review fixture disappear.
- Sun controls must distinguish the light source from the visible sky image.
  Authors can hide the orb/halo/marker while keeping terrain light, or show a
  fake visual sun without using it as the terrain light source.
- Scene fog controls include scene fog density/reach and scene fog colors. Map
  fog participation, map fog density/reach, and terrain fog gradient live under
  `Topo > Extents`. Local clouds do not mutate global `scene.fog`.

## Sliders

Native range sliders inherit app-wide sizing from `src/styles/global.css`:

| Variable | Value |
| --- | ---: |
| `--editor-control-height` | `20px` |
| `--editor-slider-track-height` | `8px` |
| `--editor-slider-thumb-size` | `20px` |

MT resistivity volume fine controls:

- Do not render `Opac`, `Dens`, `Steps`, or their sliders in the viewport
  legend.
- Volume opacity, density, and sample-step tuning remains available through the
  editor controls.

## MT Resistivity Ramp Handles

The MT resistivity ramp uses four draggable log10 resistivity handles:

| Handle kind | Internal ids | Size |
| --- | --- | ---: |
| Window | `focusMin`, `focusMax` | `5px x 16px` |
| Opacity ramp | `blendMin`, `blendMax` | `5px x 14px` |

- Window and opacity-ramp handles stay bottom-aligned on the ramp.
- Handle dimensions live in `src/ui/ResistivityLegend.tsx`.

## Sub Master Page Rows And Staff Archive (DEC-079, DEC-094, DEC-095)

The page list distinguishes three row roles:

- **Global child** — uses the existing `pageAccentRgbPalette` cycled by
  position among Global children. Label is `XX.` (zero-padded slot number
  + trailing dot).
- **Sub Master** — uses a reserved `subMasterRgbPalette` cycled by
  `subMasterOrdinal`. Row carries a `4px` solid left border in the
  saturated hue (`subMasterRowBorderStyle`). Label is `XX.M.00` where
  `XX` is the slot the master occupies if Sub Masters were counted as
  Global children, and `M` is the ordinal.
- **Sub Master child** — same hue as its master (via the parent's
  ordinal). Row is indented `12px` left (`subMasterChildIndentStyle`).
  Label is `XX.M.NN` where `NN` is the 1-based child rank.

Sub Master rows show an `M` relationship badge at the start of the visible
name. Sub Master child rows show a `C` relationship badge at the same position.
The badge color matches the row/group accent. Clicking `C` reveals and pulses
the tied master row without selecting it, opening the staff Archive first if
the master is archived. Clicking `M` reveals and pulses the first tied child row
without selecting it, preferring active Pages before archived rows.

The `+` button on the Global Settings row creates a new Sub Master at the
end of `pageOrder`. The `+` button on each Sub Master row adds a child
under that Sub Master, preserving group contiguity. The `↻` button on
each Sub Master row arms a `Re-snapshot from Global` confirm (two-click
inline confirm; auto-cancel after 5 seconds). Deleting a Sub Master shows
a confirm dialog that names the child count and cascade-deletes the
entire group.

Page rows use a single right-aligned horizontal three-dot grip for reorder. Dragging a
Sub Master moves its full block, dragging a Global child moves only that
page and skips Sub Master blocks as units, and dragging a Sub Master child
reorders only inside its sibling block. During drag, the source row remains
in its original slot at 50% opacity, a floating row preview follows the
pointer using the editor-panel material and row typography, and a thin
insertion line appears on the target row's before/after edge. The
page row action buttons follow DEC-093 and use the same 28px target, 14px
centered icon, zero padding, and opaque tinted fill as the Global Settings add
button, so identical controls do not shift color over red/orange versus dark
scene content behind the translucent editor shell. The page-manager footer
keeps add / duplicate / reset as the top icon row and places `M` / `C` / trash
on the lower row. `Make Master` converts a selected non-master
page into a Sub Master by freezing its effective visual state into an
`envSnapshot`. `Make Child` is enabled only for a selected Sub Master and
duplicates that master into a child under it; it does not reparent an
arbitrary selected page.

The staff Archive header sits below the Page Manager footer and aligns to the
same three-button footer column. It is a compact container-style button labeled
`Archive` with a disclosure arrow. Clicking the header toggles archived row
reveal/collapse. Dropping a page onto the header archives it and must not toggle
the header. Archived rows render as full page rows, including title, color,
visibility, M/C relationship badge, and drag grip. Dragging an archived row back
to active Pages restores it at the indicated before/after insertion line.

Archived pages stay editable and may preview in the viewport, but they are not
part of presenter next/previous navigation and do not ship in built
client/project output. A Sub Master may be archived while its children remain
active; those children keep `parentMasterId` and continue to inherit from the
archived master's `envSnapshot`. The visible archive is not `pages/_archive/`;
that folder remains delete recovery.

Archived preview is page-id based authoring state. Selecting an active page
after an archived preview must refresh the viewport to that active page even
when the active page index did not change. Scene controls, including light/dark
and atmosphere controls, are scoped to the selected authoring target: Global
Settings writes global `environment.scene`, a selected Sub Master writes
`envSnapshot.scene`, and a selected normal page or child writes page-local
`sceneOverrides`.

The author's per-page `accentColor` override continues to win on any row
kind. Helpers live in [styles.ts](../../src/editor/styles.ts):
`pageAccentForPageWithGroup`, `subMasterAccentForOrdinal`,
`subMasterAccentHexForOrdinal`, `subMasterRowBorderStyle`,
`subMasterChildIndentStyle`. Row metadata for numbering and reorder
bounds is computed once per render by `computePageRowMetas` in
[PagePanel.tsx](../../src/editor/PagePanel.tsx).

## Change Discipline

- Change executable tokens first.
- Update this doc when a UI rule is meant to persist beyond one visual pass.
- Add or update a `docs/03-decisions.md` entry when the change is a durable
  product or architecture policy, not just a current value adjustment.
- Keep `docs/dev-context/Visual-Review-Current.md` short; link here for details
  instead of duplicating full token lists.
