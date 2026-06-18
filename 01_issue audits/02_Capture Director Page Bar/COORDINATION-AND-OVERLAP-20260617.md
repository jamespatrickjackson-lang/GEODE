# Page Bar Fix — Coordination & Overlap Map

Date: 2026-06-17
Purpose: sequence the Page-Bar-drives-runtime fix against in-flight Capture
Director work so the two do not collide.

## In-flight work surface (observed)

- `main` is at `61cbcda`; the last six commits are all capture-director changes
  (pill headers, timeline-lane centering, icon transports, page-range render
  plan, panel material).
- Active worktrees (`git worktree list`):
  - `C:/GeoSee/Claude_WT/GeoSee_Dev/CODEX_ScrollDirector_000` — scroll-director
    branch. Branch tip `bf1b792` is already merged into `main` (main +32 / branch
    +0), so any live work there is UNCOMMITTED in that worktree.
  - `claude/festive-faraday-8564a9`, `claude/goofy-bhaskara-7da722`,
    `claude/mt-surface-salvage`, `claude/reverent-torvalds-e40a9c`,
    `claude/strange-jones-025dd5` — other active worktrees.
- Per workspace rules, uncommitted work in other worktrees is treated as parallel
  user/agent work and is not inspected from this tree.

## Overlap surface with the fix plan

Files the decouple plan edits, ranked by collision risk with capture-director
churn:

- HIGH: `src/capture/CaptureDirectorProvider.tsx` — `buildScrollRecordPlan`,
  preview drivers, idle-scrub effect. Large shared file; the most likely conflict.
- HIGH: `src/capture/CameraPathTimeline.tsx` — recently churned for layout; the
  plan does not need to edit it, but rebases may still touch nearby lines.
- MEDIUM: `src/capture/captureScrollTimeline.ts` — sampler is stable; plan may add
  a page-bar-duration helper here.
- MEDIUM: `src/pages/PageController.tsx` — `previewCapturePageSource`,
  `applyCapturePageSourceNow` (camera fallback). Less likely to be in capture
  layout work.
- LOW: `src/scene/SceneManager.ts` — freeze parity (Phase 4); isolated method.

## Recommended sequencing

1. Confirm which worktree/branch holds the active capture-director work and its
   scope (operator or owning agent). If it touches `buildScrollRecordPlan`, the
   scroll timeline, or `previewCapturePageSource`, merge the decouple WITH it.
2. Let the in-flight work land on `main` first. Branch the decouple off the
   updated `main` in a dedicated worktree (the `Claude_WT/` pattern).
3. Keep the decouple in the commit slices from the fix plan (Phases 1-3, then 4,
   then 5) so a mid-stream rebase only has to reconcile one concern at a time.

## Structural note for testability (set-up-for-success)

The gating logic to change (`buildScrollRecordPlan`: clock = `max(pageBar,
path)`, camera-source resolution, removal of the "extends beyond" reject) lives
inside the `CaptureDirectorProvider` React component and is not unit-testable
today. Recommended during implementation: extract that math into a pure module
(e.g., `src/capture/captureScrollPlan.ts`) consumed by the provider, so the
decouple decision points get synthetic-fixture coverage like the rest of
`src/capture/`. The current characterization locks cover the pure substrate the
provider relies on (sampler clamp, camera-source-independent page sampling,
path-free clock validity) but not the provider's plan assembly itself.

## Prep gates (commands)

- Capture runtime + characterization locks: `node tests/tools/capture-director-runtime.test.mjs`
- Capture source/contract parity: `node tests/tools/capture-director-source.test.mjs`
- Transition opacity regression (Phase 4 gate): `node tests/tools/transition-entity-opacity-executor.test.mjs`
- Page-agnostic source guard: `node tests/tools/transition-page-agnostic-source.test.mjs`
- Workspace: `npm run check:workspace`
