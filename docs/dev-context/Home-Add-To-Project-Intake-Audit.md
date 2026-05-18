# Home Add to Project Intake Audit

## Purpose

Read-only audit for adding Add to Project intake access from the home/project list. This does not implement UI, process files, update project data, alter rendering, or mark anything accepted.

## Files Inspected

- `src/App.tsx`
- `src/editor/UtahForgeAddToProjectDrop.tsx`
- `src/editor/EditorRoot.tsx`
- `src/projects/projectCatalogRuntime.ts`
- `src/editor/save.ts`
- `plugins/vite-plugin-author-write.ts`
- `docs/dev-context/Intake-Test-1.md`
- `projects/utah-forge/BUILD_DIRECTIVE.md`
- latest drop-level `BUILD_DIRECTIVE.md` under `projects/utah-forge/intake_staging/drops/`
- `projects/utah-forge/intake_staging/README.md`

## Home / Project List Structure

The home screen is rendered in `src/App.tsx`.

Key components:

- `App`
- `ProjectLanding`
- `ProjectOption`
- `ProjectActionOption`

`ProjectLanding` renders the project list:

```tsx
<section style={projectListStyle} aria-label="Available projects">
  {PROJECT_CATALOG.map((project) => (
    <ProjectOption
      key={project.slug}
      project={project}
      onOpen={() => onOpenProject(project.slug)}
    />
  ))}
  <ProjectActionOption label="Add New Project" onOpen={openBaseGui} />
</section>
```

`ProjectOption` currently renders each project row as a real `<button>`:

```tsx
<button
  className="geosee-landing-button geosee-landing-button--project"
  style={projectOptionStyle}
  onClick={onOpen}
>
  <ProjectMapIcon />
  <div style={projectOptionTextStyle}>
    <h2 style={projectNameStyle}>{project.name}</h2>
  </div>
</button>
```

Click-to-open is handled directly by the row button's `onClick={onOpen}`. `onOpenProject(project.slug)` is passed from `ProjectLanding` and calls `openProject(projectSlug)` in `App`.

## Recommended Add to Project Placement

Place the Add to Project affordance visually on the right side of the Utah FORGE project row, aligned with the existing frosted/outlined home-row aesthetic.

Do not nest an Add to Project `<button>` inside the existing row `<button>`. Nested buttons are invalid HTML and will create confusing click/focus behavior.

Lowest-risk placement:

- Keep the existing project row button for open-project behavior.
- Wrap the row in a non-interactive `div` such as `projectOptionWrapStyle`.
- Render the existing row button as the first child.
- Render a right-side Add to Project button as a sibling positioned inside the wrapper.
- Increase row right padding for the Utah FORGE row so text/icon do not collide with the right-side affordance.

Conceptually:

```tsx
<div style={projectOptionWrapStyle}>
  <button onClick={onOpen} style={projectOptionStyle}>...</button>
  {showUtahForgeIntake && (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAddToProject(project);
      }}
    >
      Add to Project
    </button>
  )}
</div>
```

This keeps row-click behavior intact and gives the right-side intake button its own hit target.

## Reuse Strategy

`src/editor/UtahForgeAddToProjectDrop.tsx` can be reused from the home screen.

Evidence:

- It does not call `useEditor`.
- It does not require `EditorProvider`.
- It only needs:
  - `open`
  - `projectRoot`
  - `onClose`
- It uses `writeFilesBatch` directly.
- It is already Utah FORGE-only internally because `canStage` requires `projectRoot === "projects/utah-forge"`.

Lowest-risk Test 1 recommendation:

- Keep the component in `src/editor/UtahForgeAddToProjectDrop.tsx` for now.
- Import it in `src/App.tsx` only if implementation proceeds.
- Pass `projectRoot="projects/utah-forge"` from the home screen.
- Do not rename or move it into `src/intake/` in this slice.

Reason:

Moving or generalizing the component would create extra churn. The component remains Utah FORGE-specific by name and behavior, which matches Test 1.

Future cleanup:

- If additional projects get intake support, move/rename to a neutral component such as `src/intake/ProjectIntakeDrop.tsx`.
- Add explicit `projectSlug`, `projectRoot`, labels, directive generation strategy, and per-project capability checks then.

## Event Bubbling Risk

Risk is real if implementation nests an Add to Project button inside the row button.

Current rows are `<button>` elements, so an inner button must not be used.

Required event handling for a sibling or overlay affordance:

- `onPointerDown={(event) => event.stopPropagation()}`
- `onClick={(event) => { event.preventDefault(); event.stopPropagation(); openIntake(); }}`
- optional `onKeyDown` only if the affordance is not a real button

Keyboard behavior:

- Prefer a real sibling `<button>` for Add to Project so Enter/Space work naturally.
- Keep the existing row `<button>` so Enter/Space on the row still opens the project.
- Avoid a `div role="button"` refactor unless necessary; that would increase accessibility and behavior surface area.

## Project Availability Behavior

Recommended for Test 1:

Show Add to Project only on the Utah FORGE row.

Do not show disabled buttons for Woodjam, Shahbazi, Base GUI, or Add New Project yet.

Reason:

- lowest clutter
- avoids suggesting generalized support that does not exist
- avoids extra copy and disabled-state styling
- keeps Test 1 visibly bounded to Utah FORGE

Future:

- If more projects are reviewed for intake, add capability metadata to project catalog or a local allowlist.

## Build Directive Rail

`projects/utah-forge/BUILD_DIRECTIVE.md` exists.

The latest observed drop has a drop-local directive:

```text
projects/utah-forge/intake_staging/drops/2026-05-16_01-15-38_15sfd4/BUILD_DIRECTIVE.md
```

The current drop flow creates drop-local `BUILD_DIRECTIVE.md` via `createDropBuildDirective(dropId)` in `src/editor/UtahForgeAddToProjectDrop.tsx`.

Home-screen intake can reuse this same creation logic by reusing the existing modal component. No new directive code should be created in `App.tsx`.

The home-screen flow should not update the project-level directive. The existing project-level directive already instructs Codex to find the latest folder under `projects/utah-forge/intake_staging/drops/`.

The intended post-drop manual command remains:

```text
read build directive
```

## Component Location / Naming

Question: should the modal remain under `src/editor/` if reused from home?

Recommendation for Test 1:

Keep `src/editor/UtahForgeAddToProjectDrop.tsx` where it is.

Rationale:

- It is already implemented, built, and smoke-tested.
- It is Utah FORGE-specific.
- It has no `EditorProvider` dependency.
- Moving it now would be a rename/refactor without functional value for Test 1.

Later, if intake becomes multi-project:

- move to `src/intake/ProjectIntakeDrop.tsx`
- split Utah FORGE directive text from generic staging UI
- add project capability metadata

## Home Row Visual Placement

Use the intended screenshot placement: right side of the existing project row, visually aligned with the red reference area described by the human.

Preserve:

- dark frosted/outlined row style
- current spacing rhythm
- current hover/focus behavior for opening a project
- current project row shape and border radius
- current `Add New Project` row behavior

The right-side affordance should be smaller than the row title, likely matching the editor-header `Add to Project` scale and using the same technical mono style.

## Implementation Touch Map

Smallest safe implementation likely touches:

- `src/App.tsx`
  - import `UtahForgeAddToProjectDrop`
  - add landing-level modal open state
  - pass an `onAddToProject` callback into `ProjectOption`
  - add sibling right-side Add to Project affordance only for Utah FORGE
  - render `UtahForgeAddToProjectDrop` while on landing
- `docs/dev-context/Intake-Test-1.md`
  - note home-row access
- `docs/dev-context/Open-Loops.md`
  - update human review item
- `docs/dev-context/Inference-Register.md`
  - add proposed inference about home access as a safe UX extension
- `docs/dev-context/Change-Receipts/CHG-2026-05-16-030-home-add-to-project-intake.md`
  - implementation receipt if implementation proceeds

Probably avoid touching:

- `src/editor/UtahForgeAddToProjectDrop.tsx`, unless a tiny prop or copy issue appears during implementation
- `src/editor/EditorRoot.tsx`
- `plugins/vite-plugin-author-write.ts`
- project manifests/pages/environments/overlays/data

## Safety Boundaries

Implementation should not:

- update `project.json`
- update `environment.json`
- update pages
- update overlays
- move files into `data/geosee_processed`
- process files
- create computed artifacts
- alter loaders
- alter rendering
- alter materials
- alter camera behavior
- alter MT/seismic/scalar behavior
- mark anything accepted

## Verification Plan

Recommended commands:

```text
npm run build
node tools/validate-artifact-metadata.mjs --project projects/utah-forge
node tools/report-project-artifact-coverage.mjs
```

Recommended dev smoke test:

1. Open home screen.
2. Verify Utah FORGE row has a right-side Add to Project affordance.
3. Verify Woodjam/Shahbazi rows do not show active Add to Project controls.
4. Click the Utah FORGE row body and confirm the project opens.
5. Return home.
6. Click the Utah FORGE Add to Project affordance and confirm the project does not open accidentally.
7. Stage one tiny text file if allowed.
8. Confirm new drop has:
   - `raw/`
   - `intake_manifest.json`
   - `intake_context.md`
   - `BUILD_DIRECTIVE.md`
9. Confirm no project config/page/data/generated artifacts changed except the intended staged drop.

## Go / No-Go Recommendation

Go for a small implementation slice.

Recommended next implementation prompt title:

```text
Home Row Add to Project Intake: Utah FORGE Test 1
```

Files to touch:

- `src/App.tsx`
- `docs/dev-context/Intake-Test-1.md`
- `docs/dev-context/Open-Loops.md`
- `docs/dev-context/Inference-Register.md`
- `docs/dev-context/Change-Receipts/CHG-2026-05-16-030-home-add-to-project-intake.md`

Do not move the modal component or generalize intake yet unless implementation proves reuse impossible.
