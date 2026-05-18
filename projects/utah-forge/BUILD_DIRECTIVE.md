# Utah FORGE Build Directive

## Trigger command

read build directive

## Purpose

This file is the project-local entrypoint for Codex after files are staged through Add to Project.

## Current mode

intake_review

## Scope

Utah FORGE only.

## Operating rule

Do not process, move, interpret, or wire staged files unless the directive explicitly says to.

## Intelligence Layer Trigger

Manual test trigger:

```text
read build directive
```

For this test, the human manually sends this trigger to Codex. Codex acts as the temporary intelligence layer / API stand-in.

In a future implementation, this may be replaced by an API call or agent event.

Codex must follow:

1. this project-level directive
2. the latest active drop-local `BUILD_DIRECTIVE.md`
3. source/inference/acceptance separation
4. project safety boundaries

## Directive Hierarchy

- The project-level directive is authoritative for safety boundaries.
- The drop-local directive is authoritative for drop-specific mode.
- If there is a conflict, the stricter safety rule wins unless this project-level directive explicitly permits the drop-local mode.
- Project-level permission for a mode is narrow and does not imply general project, page, overlay, data, runtime, or acceptance authority.

## Directive Modes

### source_inventory_only

Allowed outputs:

- `source_inventory.json`
- `source_inventory.md`
- `proposed_next_steps.md`

Forbidden:

- no processing
- no project config changes
- no page creation
- no computed artifacts
- no accepted state

### source_inventory_plus_review_page

Allowed outputs:

- `source_inventory.json`
- `source_inventory.md`
- `proposed_next_steps.md`
- `projects/utah-forge/pages/intake_<dropId>.json`
- `projects/utah-forge/overlays/intake_<dropId>/text.md`
- `project.json` `pageOrder` update only to add `intake_<dropId>`

When the active drop-local mode is `source_inventory_plus_review_page`, Codex may create only:

- `projects/utah-forge/pages/intake_<dropId>.json`
- `projects/utah-forge/overlays/intake_<dropId>/text.md`
- one `pageOrder` entry in `projects/utah-forge/project.json` for `intake_<dropId>`

This permission is review-surface only.

Forbidden:

- no data processing
- no raw file parsing beyond lightweight inventory unless explicitly approved
- no computed artifacts
- no layers from dropped files
- no `data/geosee_processed` writes
- no changes to `environment.json`
- no changes to existing pages
- no changes to existing overlays
- no loader/render/material/camera changes
- no accepted interpretation

## Latest intake drop

Find the latest folder under:

```text
projects/utah-forge/intake_staging/drops/
```

Use filesystem modified time or lexicographic drop ID order if modified times are unavailable.

Ignore drops whose manifest status is:

- `ignored_test`
- `archived`
- `superseded`
- `rejected`

Prefer the latest drop whose manifest status is:

- `staged_unprocessed`
- `inventoried_proposed`
- `review_page_created`

If no active drop exists, report that no active Utah FORGE intake drop is ready for directive-driven review.

## Required next action

Read the drop-local `BUILD_DIRECTIVE.md` in the latest active drop.

Create inventory outputs only if they are missing:

- `source_inventory.json`
- `source_inventory.md`
- `proposed_next_steps.md`

If inventory outputs already exist, summarize and update them rather than duplicating them.

If a review page already exists, do not create a duplicate page. Summarize the existing review page and update lifecycle status only if instructed or required by the active drop directive.

## Hard boundaries

- do not update project.json except for one `pageOrder` entry explicitly allowed by active `source_inventory_plus_review_page` mode
- do not update environment.json
- do not update pages except to create the single proposed `pages/intake_<dropId>.json` explicitly allowed by active `source_inventory_plus_review_page` mode
- do not update overlays except to create the single proposed `overlays/intake_<dropId>/text.md` explicitly allowed by active `source_inventory_plus_review_page` mode
- do not move files into data/geosee_processed
- do not create computed artifacts
- do not run prep scripts
- do not infer geology/geophysics as accepted truth
- do not mark anything accepted

## Expected first output

For a staged drop, Codex should create:

- source_inventory.json
- source_inventory.md
- proposed_next_steps.md

inside that drop folder.

## Acceptance rule

All outputs remain proposed / staged / needs_review until human approval.
