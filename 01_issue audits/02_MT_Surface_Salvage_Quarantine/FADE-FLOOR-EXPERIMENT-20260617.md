# Fade Floor — Experiment v1 (2026-06-17)

This is an experiment, not a spec. Expected to be partly wrong; the point is to
learn where the snap actually lives.

## Principle being tested

Fade is the floor; snap is forbidden. Any entity whose state is not otherwise
determined — or whose specific override fails — degrades to a fade, never a snap.
Specific verbs (clip-hold, move, constant, morph) are overrides on a detected
direct diff, layered on top later. A fade may look slightly off (a constant
self-crossfading); camera motion masks it and strange != wrong, whereas a snap is
human-cognition offensive.

## v1 change (smallest real lever)

Target the one confirmed snap path: late-ready entities that arrive with little
transition time left were applied at full opacity instantly
(`attachReadyTargetLayersDuringActiveTransition`, the
`remainingMs <= READINESS_ENTER_MIN_REMAINING_MS` shortcut, was 150ms).

Change: only a hidden target (opacity 0) applies instantly; any visible late
arrival fades over the remaining time, even when little remains (a sub-frame
remainder degrades to an imperceptible fade, never a snap). The 150ms snap
shortcut and its constant are removed.

## Hypothesis

If the visible snap on `30 -> 31` (iso surfaces popping in) is caused by
late-attach, this removes it. If it still snaps, the cause is elsewhere
(discrete-crossfade commit rebuild, or derived-root attach at full opacity) and
v2 targets that. Either outcome is a learning, not a failure.

## How we will know

- Eye check on 127.0.0.1:42911: `30 -> 31` iso surfaces fade in instead of
  popping. Also scan `20 -> 25` / `25 -> 20` for any new pop.
- Watch for: a 1-frame opacity conflict at commit (tween ending exactly at the
  transition end), or any layer that should have been instant now lingering.
- Source: `tsc -b` clean; protected guard batch green (no regression to the
  fade/opacity owners).

## Result

Reverted. Wrong shape: a floor must be the default of the single applier every
entity flows through, not a patch on the late-attach path. The narrowness was
the lesson. Superseded by the resolver+applier consolidation — inputs: manifest
scope taxonomy (entity vs channel by scope width), container hierarchy as
grouping prior, page-state diff for behavior+bonds; fade is branch zero;
prior-vs-diff conflict falls to fade.

## Reversibility

Single focused change on `claude/mt-surface-salvage`; revert to the Phase 1
commit `8f60677` or the `…-checkpoint @ 5603dda` return node if it regresses.
