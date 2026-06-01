# Transition Page Fixture Evidence Register - 2026-05-31

Status: evidence register only.

This file records page/environment content edits that were temporarily made
during transition cleanup and then removed. They are not accepted fixes.
Use these entries only to plan global validation, save normalization, editor
authoring, and transition ownership rules.

## Rule

Pages are disposable fixtures. Do not repair transition behavior by editing
fixture JSON, fixture indexes, fixture IDs, fixture titles, or fixture
adjacency.
If a fixture exposes a mismatch, the implementation target is the reusable
runtime/editor/save rule that allowed the mismatch.

## Removed Fixture-Level Edits

The following content edits were removed from the worktree by restoring the
affected project JSON files to the repository baseline.

| File | Removed edit | Planning evidence |
| --- | --- | --- |
| `projects/utah-forge/environment.json` | Set `sceneSectionPlanes.x.enabled` from `false` to `true` in the environment style locations. | Environment/default scene-section state can disagree with effective frame intent. Fix via global effective-state normalization and validation, not by changing current content. |
| `projects/utah-forge/pages/04_mt_high_resistivity_seismic.json` | Flipped legacy `mtThresholdSurfaceVisibility.conductive-le-30-ohm-m` from `false` to `true`. | Legacy MT threshold visibility can disagree with the canonical boundary visibility model. Fix via canonical write/read normalization. |
| `projects/utah-forge/pages/05_mt_threshold_focus.json` | Flipped legacy `mtThresholdSurfaceVisibility.conductive-le-10-ohm-m` from `true` to `false`. | Same MT boundary legacy/canonical mismatch evidence. |
| `projects/utah-forge/pages/06_mt_low_resistivity_seismic.json` | Flipped legacy `conductive-le-10-ohm-m` from `true` to `false` and `resistive-ge-1000-ohm-m` from `false` to `true`. | Same MT boundary legacy/canonical mismatch evidence. |
| `projects/utah-forge/pages/08_mt_threshold_surfaces.json` | Flipped legacy `conductive-le-10-ohm-m` from `true` to `false` and `resistive-ge-1000-ohm-m` from `false` to `true`. | Same MT boundary legacy/canonical mismatch evidence. |
| `projects/utah-forge/pages/45_resistivity_isosurfaces.json` | Flipped legacy `conductive-le-10-ohm-m` from `true` to `false`. | Same MT boundary legacy/canonical mismatch evidence. |
| `projects/utah-forge/pages/51_mt_marching_cubes_focused.json` | Flipped legacy `conductive-le-10-ohm-m` from `true` to `false` and `resistive-ge-1000-ohm-m` from `false` to `true`. | Same MT boundary legacy/canonical mismatch evidence. |
| `projects/utah-forge/pages/52_mt_marching_cubes_full_extent.json` | Flipped legacy `conductive-le-10-ohm-m` from `true` to `false`. | Same MT boundary legacy/canonical mismatch evidence. |
| `projects/utah-forge/pages/99_unresolved_missing_tools.json` | Injected `sceneSectionFrames`; flipped legacy `conductive-le-30-ohm-m` from `false` to `true`. | Scene-section frames and legacy MT visibility can be incomplete or mismatched in fixture content. Fix via runtime/effective normalization and validation. |
| `projects/utah-forge/pages/100_page.json` | Injected `sceneSectionActiveFrameId` and `sceneSectionFrames`; flipped legacy threshold visibility values and added `bank-ge-5461-ohm-m`. | Scene-section frame state and MT boundary visibility need canonical global handling. |
| `projects/utah-forge/pages/101_page.json` | Injected `sceneSectionFrames`; flipped legacy threshold visibility values and added `bank-ge-5461-ohm-m`. | Same scene-section and MT boundary canonical-state evidence. |
| `projects/utah-forge/pages/102_page.json` | Injected `sceneSectionActiveFrameId` and `sceneSectionFrames`; flipped legacy threshold visibility values and added `bank-ge-5461-ohm-m`. | Same scene-section and MT boundary canonical-state evidence. |
| `projects/utah-forge/pages/103_page.json` | Injected `sceneSectionFrames`; flipped legacy threshold visibility values and added `bank-ge-5461-ohm-m`. | Same scene-section and MT boundary canonical-state evidence. |
| `projects/utah-forge/pages/104_page.json` | Injected `sceneSectionFrames`; flipped legacy threshold visibility values and added `bank-ge-5461-ohm-m`. | Same scene-section and MT boundary canonical-state evidence. |

## Forward Use

- Keep source code fixes page-agnostic.
- Keep validation rules generic and project-data driven.
- Let random future page edits break fixtures if the global logic is wrong.
- Use this register to decide what canonical state rules need stronger tests,
  not to reapply these values to current pages.

## Validation Boundary

Raw page/environment duplicate-state mismatches are evidence. They should not
force a page JSON patch. The runtime-facing contract is the normalized
effective state after global authoring and resolution rules run.

`npm run check:pages` should therefore fail when effective state remains
inconsistent after normalization, but it should not fail merely because a
throwaway fixture contains legacy/canonical duplication that the global
normalizers can resolve.

## Purged Docs Wording - 2026-05-31

The following wording was removed from active docs so future work does not read
transition behavior as fixture-to-fixture logic:

| File | Purged wording pattern | Replacement intent |
| --- | --- | --- |
| `docs/03-decisions.md` | `page-to-page legend membership changes` | `page-transition legend membership changes` |
| `docs/dev-context/Active-Build-Context.md` | `page-id`, `page-index`, `page-title`, `page-pair` as implementation language | `fixture-id`, `fixture-index`, `fixture-title`, and `source/target fixture path` as prohibited examples |
| `docs/dev-context/Page-Transitions-And-Section-Frames.md` | `page-pair conditionals`; `between pages` symptom wording | source/target fixture-path prohibition and source/target resolved-state symptom wording |
| `docs/dev-context/Page-Transition-Orchestration-Audit-2026-05-30.md` | `specific page pairs`; `transition from page B to page C` | fixture-specific path warning and source/target resolved-state wording |
| `docs/dev-context/Transition-Human-Review-Checklist-2026-05-31.md` | `page-pair-specific`; `page-pair issue` | fixture-path-specific wording |
| `docs/dev-context/Visibility-Control-Conflict-Audit-2026-05-31.md` | `page-pair conditionals` | source/target fixture-path conditionals |
| `docs/dev-context/Page-Transition-Fix-Prep-2026-05-30.md` | forward-looking references such as `page 25 -> page 26`, `adjacent page pairs`, and `page-specific fix` | fixture transition, matrix evidence, and global-rule wording |
| `docs/dev-context/Project-Load-Class-Table.md` | `page-specific` content/loading classification labels | `authored-state-scoped`; loading/content usage remains separate from transition logic |
| `docs/dev-context/Runtime-Loading-Policy.md` | `specific page correctly` | authored presentation state wording |
| `docs/dev-context/Artifact-Metadata-Wrapper-Spec.md` | `specific pages` | authored presentation state wording |
| `docs/woodjam/data-manifest.md` | `specific page in chapter 2` | authored chapter-2 presentation state wording |
| `docs/rendering/cinematic-render-presets.md` | `Layer-specific page overrides` | layer-scoped page overrides |

The separate docs audit file
`docs/dev-context/Transition-Page-Specific-Docs-Audit-2026-05-31.md` was
removed after its useful content was folded into this evidence register.

The original captured baseline matrix in
`docs/dev-context/Page-Transition-Fix-Prep-2026-05-30.md` also contained
literal fixture paths and historical fixture positions. Those were purged from
the matrix table and replaced with reproduction families. The original fixture
paths remain recoverable from matrix artifacts and git history if needed, but
they should not appear in forward implementation instructions.

## Code Fixture Boundary Remediation - 2026-05-31

The following code/tooling locations were found during the page-agnostic audit
and remediated or explicitly demoted:

| Location | Prior risk | Remediation |
| --- | --- | --- |
| `tools/capture-transition-matrix.mjs` | Supplemental and interruption cases used fixed page-order indexes and numbered case IDs. | Replaced with feature-family selectors derived from current page/effective layer state. Observed page ids remain artifact evidence only. |
| `tools/analyze-transition-matrix.mjs` | Reports printed source/target page ids and case positions without an explicit fixture boundary. | Added a report-level fixture boundary: ids and positions are evidence only, remediation targets global transition families. |
| `tests/tools/transition-page-agnostic-source.test.mjs` | No automated guard prevented future fixture IDs or fixed page-index cases from entering runtime transition code. | Added a source guard for protected runtime areas and transition matrix fixed-index cases. |
| `tests/utah-forge/transition-orchestration.spec.ts` | Literal Utah FORGE page ids could be mistaken for transition acceptance criteria. | Added a fixture-boundary comment: page ids are disposable regression fixtures only. |
| `tools/validate-utah-presentation-snapshot.mjs` | Snapshot validation contains durable-looking page-order expectations. | Added a fixture-boundary comment: this is content snapshot evidence, not transition acceptance. |
| `docs/dev-context/Page-Transition-Fix-Prep-2026-05-30.md` | Historical matrix IDs and source/target fixture paths could be read as forward implementation instructions. | Added a fixture-boundary banner declaring all historical page/case references evidence only. |

Current boundary after this pass:

- Runtime fixes must not branch on fixture page ids, page indexes, page titles,
  or matrix case ids.
- Matrix and test artifacts may record page ids as evidence, but selected
  remediation cases must be named by feature family.
- Historical docs can retain fixture references only under an evidence boundary.
