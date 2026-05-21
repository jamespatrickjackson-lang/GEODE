# Agent Drift Anchors

## Primary Anchor

Future architecture can be remembered without becoming build pressure.

## Meaning

A concept may be documented as FUTURE, HOLD, DEFERRED, or NOT FOR MVP without authorizing implementation.

Documentation is not permission to build.

## Cognitive Ecology Rule

High-context agents should route, inhibit, and preserve state. They should not improvise broad mutations just because they understand the larger system.

Low-context runners are safer for bounded mutation because they have less room to drift inventively. They can still fail, but their failures should be simple, local, and easy to verify.

The working rule is:

```text
least context
least authority
least initiative
maximum trace
```

Short form: least context, least authority, least initiative, maximum trace.

## Agent Rule

If a concept is marked HOLD, FUTURE, DEFERRED, or NOT FOR MVP, agents must not:

- implement it
- scaffold it
- create runtime schemas for it
- create UI for it
- add it to product scope
- infer it as a backlog item
- turn it into build work
- route current implementation toward it

## Sealed HOLD Area

Some future/HOLD notes are intentionally placed behind a stop-before-ingest barrier:

`docs/dev-context/Future-Holds/DO-NOT-INGEST-UNLESS-HUMAN-RESURFACES/`

Agents should stop at that folder's README during ordinary exploration. Do not ingest sealed HOLD files, summarize them, infer build work from them, or let them shape current implementation unless the human explicitly resurfaces a specific file or releases a specific HOLD item.

## Controller / Runner Separation

Future agent architecture, if ever released from HOLD, should separate roles:

- controller: reads trailhead context, selects route, preserves boundaries, and dispatches small work
- runner: performs a narrow low-context task inside an explicit route
- validator: checks shape, boundary, and post-state
- scribe: records what happened

The controller should not become the worker. The runner should not invent the route.

## Release Condition

A HOLD item may only become implementation work if a future explicit instruction releases it from HOLD.

For the current warning-dismissal concept, the release phrase is:

> Release warning-dismissal logging from HOLD for implementation.

Until then, it remains documentation only.

## Why This Exists

GeoSee contains future system ideas that are useful to remember but dangerous to build too early. Capturing a future idea without this anchor can cause agent drift, scope creep, or false product architecture.

The correct behavior is:

```text
remember the concept
preserve the boundary
continue current build only
```
