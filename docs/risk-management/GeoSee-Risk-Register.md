# GeoSee Risk Register

Status: active draft foundation. This register is intentionally conservative
and may receive new risks without prior approval.

## High-Priority Unresolved Risks

### R-001: Client data intake process is not yet approved

Risk: active or upcoming client/project data could enter GeoSee before the
client-visible informed-consent process, QA/RA review, and authority sign-off
exist.

Mitigation: use stale, complete, open, or explicitly approved datasets for
development. Block client-side data intake until the process is reviewed and
approved.

Status: unresolved, high priority.

### R-002: Confidentiality and data handling

Risk: screenshots, renders, logs, diagnostics, generated files, recipes, issue
text, docs, or agent context could disclose upcoming or active project material.

Mitigation: active material is confidential by default. Use redacted risk
language, local handling, direct handoff, and explicit approval before public
release or broader distribution.

Status: unresolved, high priority.

### R-003: Unsupported engineering inference

Risk: supplied data could be collated, joined, categorized, labeled,
correlated, or summarized into new engineering claims not present in given
tables/source records or approved transforms.

Mitigation: given tables, source records, manifests, and explicit transform
rules are the truth boundary. Missing relationships remain missing inputs or
review questions.

Status: active guard.

### R-004: Implied metrology

Risk: visual scale/context helpers or future UI could imply actionable
measurement where GeoSee has no calibrated measurement subsystem.

Mitigation: no ruler, distance, scale, volume, grade, coordinate-pick,
clearance, measurement, or engineering-action controls. Existing scale/context
helpers are orientation aids only.

Status: active guard.

### R-005: Page/project persistence contamination

Risk: temporary visual setup, camera choreography, Capture Director state, or
runtime debug state could be written into `projects/**` and become project
truth.

Mitigation: page/project/environment/overlay writes belong only to explicit
editor authoring. Capture Director remains recipe/session/output state and must
not write project fixtures, page cameras, visual presets, browser storage, or
editor dirty state.

Status: active guard; write firewall remains a recommended follow-up.

### R-006: Stale authority replay

Risk: visual fixes can appear correct in runtime, then stale page,
environment, preset, cache, or transition-settle authority reasserts the old
state.

Mitigation: important visual facts need a traceable authority chain from source
data through processed asset, manifest, environment, page override, preset,
runtime resolver, scene manager, material, geometry, camera, and output.

Status: active investigation class.

## Controlled Output Rules

- Public demos use stale, complete, open, or explicitly approved material.
- Active-data presentations are controlled handoff artifacts for signed-off
  authorities, not public self-serve data products.
- Capture Director outputs are marketing/communication artifacts and must not
  become project truth.
- External render jobs consume recipes and must not repair or mutate project
  fixtures.

## Pre-Client-Data Checklist

- Intake process reviewed by QA/RA.
- Client-visible informed-consent language approved.
- Confidentiality handling path defined.
- Repository/storage segregation defined.
- Public-release status recorded.
- Handoff authority identified.
- Non-inference and non-metrology boundaries acknowledged.
- Risk notes included with controlled handoff.
