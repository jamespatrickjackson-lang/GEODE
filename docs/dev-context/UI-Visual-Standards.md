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
| Native range slider height, track, thumb, and fill variables | `src/styles/global.css` | App-wide native slider styling. |
| MT resistivity ramp trim/feather handles | `src/ui/ResistivityLegend.tsx` | Ramp-specific draggable handle sizing. |
| Visual rationale / durable UI choices | `docs/03-decisions.md` | Use decision entries for persistent policy changes. |
| Current visual review loop | `docs/dev-context/Visual-Review-Current.md` | Keep short and current. |

## Viewport Legend Containers

- Viewport legends are lightweight transparent overlays unless a specific tool
  requires a card/backplate.
- Shared panel width is `282px`.
- Shared panel padding is `14px`, unless a specific legend has an explicit
  reviewed exception.
- Viewport legends align to the standard page-edge margin:
  `LEGEND_PAGE_EDGE_MARGIN_PX = 16px`.
- The bottom-most visible legend container sits
  `LEGEND_BOTTOM_EDGE_OFFSET_PX = 50px` above the viewport bottom.
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
- Surface boundary rows use their color circles as show/hide controls for each
  MT threshold boundary. Hidden rows stay listed while the boundary opacity is
  non-zero so they can be restored from the legend.
- Section ISO keeps quick controls in the main legend as one stack: `ISO
  overlay`, optional `Show volume`, then `Options` at the bottom.
- Section ISO dataset selection and detailed line/band controls live in the
  `Options` popout.
- MT resistivity volume fine controls are hidden in the viewport legend.

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

## Change Discipline

- Change executable tokens first.
- Update this doc when a UI rule is meant to persist beyond one visual pass.
- Add or update a `docs/03-decisions.md` entry when the change is a durable
  product or architecture policy, not just a current value adjustment.
- Keep `docs/dev-context/Visual-Review-Current.md` short; link here for details
  instead of duplicating full token lists.
