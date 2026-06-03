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
| MT resistivity ramp trim/feather handles | `src/ui/ResistivityLegend.tsx` | Ramp-specific draggable handle sizing. |
| Visual rationale / durable UI choices | `docs/03-decisions.md` | Use decision entries for persistent policy changes. |
| Current visual review loop | `docs/dev-context/Visual-Review-Current.md` | Keep short and current. |

## Editor Reveal And Camera Focus

- Single-clicking a rendered scene element reveals the corresponding editor row
  using stable target ids such as `layer:<layerId>` and
  `product:<layerId>:<productId>`.
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
  diagnostics. Composition guide strokes default to `lineThickness: 0.25`,
  which is half the previous presentation-frame guide width, and render through
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

## Legend Copy Rules

- Keep viewport legend copy compact and technical.
- Avoid explanatory helper prose inside legends when the control label is
  enough.
- Section plane legend:
  - Heading: `Section Planes`
  - Rows: `X Section`, `Y Section`, `Z Section`
  - Helper visibility row: `P Controle`
- Section ISO legend:
  - Heading: `Section ISO`
  - Main toggle: `ISO overlay`
  - Volume-cut groups also show `Show volume`
  - `Options` is a circular toggle row at the bottom of the quick-control stack.
  - Dataset selector belongs in `Options`, not in the main legend body.
  - Do not show selected-target count subtitles such as `2/2 ...`
- MT resistivity legend:
  - Heading and subtitle render in one horizontal header row.
  - Volume subtitle: `Scalar - log10`
  - Volume opacity, density, and sample-step fine controls are hidden in the
    viewport legend.
- MT threshold boundaries legend:
  - Heading: `MT Threshold Boundaries`
  - No subtitle.

## Legend Behavior Baseline

- Stacked Utah FORGE viewport legends keep MT resistivity as the bottom legend.
- During page transitions, individual legend containers move in sequenced
  straight-line phases.
- Exiting legend containers first slide left at full row height.
- After exiting containers are out, their rows collapse and remaining rows move
  vertically to close the gap.
- Entering legend containers first reserve/open their target row space.
- After the space is open, entering containers slide in from the left.
- Stable legend containers remain horizontally fixed and only shift vertically
  during the row resize phase.
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
- Section ISO keeps quick controls in the main legend as one stack: `ISO
  overlay`, optional `Show volume`, then `Options` at the bottom.
- Section ISO dataset selection and detailed line/band controls live in the
  `Options` popout.
- MT resistivity volume fine controls are hidden in the viewport legend.

## Section Frame Scale Axes

Section frame controls live inside each `X Section frame`, `Y Section frame`,
and `Z Section frame` editor subsection:

| Control | Style field | Range | Default |
| --- | --- | ---: | ---: |
| Section enable | `sceneSectionPlanes.<axis>.enabled` | on/off | off |
| Flip side | `sceneSectionPlanes.<axis>.invert` | on/off | off |
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
- Section enable, flip side, and active-handle controls are compact header
  controls on each X/Y/Z frame; there is no separate `X Section active` /
  `Y Section` / `Z Section` editor subsection.
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
- Topo graticule lines and edge labels are terrain/reference context and are not
  affected by scene-section clipping planes.
- Terrain underside grid helpers use camera-side hysteresis. The grid appears
  only when the camera is clearly below terrain and hides only after returning
  clearly above terrain; it also stays hidden outside terrain XY bounds.
- Section ISO overlay opacity is composed, not overwritten. Effective opacity
  equals authored overlay opacity multiplied by page/layer transition opacity
  and the threshold-surface occlusion attenuation.
- ISO line attenuation through MT threshold surfaces remains `0.8^surfaceCount`,
  with short-frame smoothing so camera motion does not cause flicker.
- Compatible section-frame transitions interpolate numeric frame geometry by
  stable frame id: plane position, crop bounds, scale interval, label/heading
  sizing and padding, and ground trace width.
- Incompatible section-frame transitions crossfade helpers. Frame identity,
  orientation, enable state, flip state, object visibility target state, and
  added or removed frame ids are discrete.
- Section ISO and MT/seismic cut identities include section frame id so multiple
  same-orientation section frames do not overwrite one another during page
  transitions.

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

The MT resistivity ramp uses four draggable spectral handles:

| Handle kind | Internal ids | Size |
| --- | --- | ---: |
| Trim | `focusMin`, `focusMax` | `5px x 16px` |
| Feather | `blendMin`, `blendMax` | `5px x 14px` |

- Trim and feather handles stay bottom-aligned on the ramp.
- Handle dimensions live in `src/ui/ResistivityLegend.tsx`.

## Sub Master Page Rows (DEC-079)

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

The `+` button on the Global Settings row creates a new Sub Master at the
end of `pageOrder`. The `+` button on each Sub Master row adds a child
under that Sub Master, preserving group contiguity. The `↻` button on
each Sub Master row arms a `Re-snapshot from Global` confirm (two-click
inline confirm; auto-cancel after 5 seconds). Deleting a Sub Master shows
a confirm dialog that names the child count and cascade-deletes the
entire group.

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
