# Client Data Intake Process Draft

Status: draft foundation, not an approved SOP.

This process defines the gate that must exist before client-side data enters
GeoSee work. It is intentionally conservative until QA/RA review and the
relevant client authority sign-off are complete.

## Intake Boundary

GeoSee development uses stale, complete, open, or explicitly approved datasets
by default. Active or upcoming client/project material is confidential by
default and must not enter GeoSee work until the client-visible intake process
is reviewed, approved, and understood by the relevant authority.

Before any client data is accepted, the intake record must identify:

- the supplying organization and signed-off authority;
- the data classes being supplied;
- public, stale, active, confidential, or controlled status;
- intended GeoSee use;
- allowed outputs and recipients;
- prohibited outputs;
- handling and storage expectations;
- review and handoff path;
- public-release status.

## Non-Inference Rule

GeoSee may present supplied engineering material and approved transforms. It
must not infer engineering facts, joins, categories, relationships, quantities,
measurements, or claims from proximity, layer coexistence, visual fit, or agent
interpretation.

Any relationship not present in a supplied source record or approved transform
remains a missing input or review question.

## Non-Metrology Rule

GeoSee is a communication and illustration layer. It does not provide actionable
metrology. Do not add or expose ruler, distance, scale, volume, grade,
coordinate-pick, clearance, measurement, or engineering-action controls unless
a future calibrated measurement subsystem is separately approved.

Existing visual scale/context helpers are orientation aids only.

## Confidentiality Handling

Upcoming and active project material is confidential by default. The following
must stay inside approved handling paths unless explicitly cleared:

- source values and tables;
- client/project names;
- screenshots and preview renders;
- logs and diagnostics;
- generated files;
- recipes, camera paths, and external render jobs;
- issue/PR text and docs;
- prompt/context material.

Risk entries should describe risk classes or use redacted placeholders when the
disclosure path is not approved.

## Development And Handoff

Tool and workflow development should use analogous public or stale datasets.
If client data is needed to confirm a workflow, use isolated local handling,
direct client review, and explicit authority sign-off. Public demo pages,
public builds, public repositories, and public marketing packages from active
data require explicit public-release approval.

Controlled handoff should include risk notes and acceptance by the client head
of engineering or equivalent authority.

## Open Items

- QA/RA review of this draft.
- Client-visible informed-consent wording.
- Repository and storage segregation standard for client data.
- Handoff/sign-off template.
- Redaction standard for logs, screenshots, diagnostics, and agent context.
- Decision on any future calibrated measurement subsystem.
