# Global Transition Human Review Checklist - 2026-05-31

Visual acceptance is user-reviewed. This pass intentionally avoids new matrix,
video, and long Playwright visual runs.

## Scope Rule

Transition fixes are global runtime/editor/save rules. Page numbers, page IDs,
page titles, matrix case IDs, and visible page paths are disposable
reproduction fixtures only. Do not implement or approve a fixture-path-specific
fix, page-index conditional, page-title conditional, or Utah-FORGE-only
runtime branch.

When reporting visual feedback, name the affected transition family and use the
page path only as reproduction evidence. Examples of families:

- Already-visible product ownership.
- Section ISO bands and isolines.
- Scene-section helpers: ground trace, reference axes, frame outline, and crop box.
- MT volume / threshold boundary handoffs.
- Camera path and end-of-transition commit timing.
- Legend/show-hide authoring state and saved page/environment normalization.

## Global Review Checks

- Already-visible products
  - Check that products visible in both source and target states do not fade
    out and back in just because navigation occurred.
  - Reproduction fixtures may include MT threshold boundary or section ISO
    pages, but the fix target is the shared transition ownership rule.

- Section ISO continuity
  - Check bands and lines for transparency drift, first-frame snap, or
    end-of-transition opacity snap.
  - If visible, classify it as a Section ISO transition-envelope or authored
    opacity ownership issue, not as a fixture-path issue.

- Scene-section helper continuity
  - Check ground trace, reference axes, frame outline, and crop box for
    disappearing, snapping, or changing opacity during compatible transitions.
  - If visible, classify it as a scene-section helper/reference-layer policy
    issue. Page numbers such as the current screen examples are disposable
    reproduction details.

- Camera path continuity
  - Check for camera stall, large per-frame jump, or path discontinuity,
    especially near the end when editor selection reaches its final visual
    state.
  - Record the reproduction path and approximate playback time, then fix the
    global camera duration/path/commit policy.

## Approval Gates

- Do not change contour cadence, contour LOD, opacity, or line simplification until
  the section ISO appearance is reviewed.
- Do not change camera duration/path policy until the camera jump risk is visually
  confirmed or rejected.
- If show/hide or legend controls still disagree with saved page state, route
  that control through the canonical authoring target and validation rules
  before changing transition visuals.
- Every future transition refinement must name the global rule it changes and
  must explain why the change will apply to newly created or deleted pages
  without special-casing existing fixtures.
