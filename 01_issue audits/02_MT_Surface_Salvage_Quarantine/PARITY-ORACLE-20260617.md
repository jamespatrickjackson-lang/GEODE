# Parity Oracle — validation + protocol (2026-06-17)

> CORRECTION (2026-06-17): the regression baseline deliverable is REMOVED. A
> regression baseline is only meaningful for an invariant. The only invariant is
> the MT cloud (full-density points), which is carved out of the system and
> handled separately; a user-held saved known-good ("perfect") version is its
> restore point — no capture from here. Everything else is being rebuilt, so it
> is verified FORWARD (intended behavior + eye on 42911), not diffed against a
> baseline. The oracle tooling notes below are retained as reference only; they
> are not a required deliverable.

Phase 2 preflight (C). DECK-STATE / REPRODUCTION EVIDENCE tool — NOT app-health
proof; kept out of the app-health guard batch (per the tool's own header and the
contract).

## Feasibility: VALIDATED

- `tools/capture-transition-matrix.mjs` imports `@playwright/test` (chromium) and
  drives a headless browser to capture per-case `source` / `mid` / `end`
  PNG + JSON (plus optional video/trace).
- Playwright chromium IS installed on this machine:
  `C:\Users\james\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe`
  (exists). The junctioned `node_modules` resolves `@playwright/test`.
- Server: the tool reads `GEOSEE_BASE_URL` (default `http://127.0.0.1:5173`).
  Point it at the quarantine server `127.0.0.1:42911`.
- So the oracle is runnable here. It gives deterministic mid-transition frames —
  the exact thing needed to judge fade-vs-snap / exterior-reveal without
  frame-perfect live screenshots.

## Ready-to-run protocol (run at foundation-parity time)

```
# quarantine dev server up on 42911 (launch.json config "quarantine")
GEOSEE_BASE_URL=http://127.0.0.1:42911 \
TRANSITION_MATRIX_VIDEO=0 \
TRANSITION_MATRIX_TRACE=0 \
TRANSITION_MATRIX_OUT="01_issue audits/02_MT_Surface_Salvage_Quarantine/parity-baseline/<label>" \
node tools/capture-transition-matrix.mjs
```

- Video/trace OFF to keep artifacts small.
- Capture the verb-representative cases (constant, fade, clip-exit, clip-enter,
  move, working-area, full-density).
- After capture, `git status` MUST show no `projects/**` change; restore any
  page dirt the persistence plugin wrote during navigation before committing.

## Decision: golden binary capture DEFERRED (not blocked)

The oracle is validated and the command is ready, but the golden binary baseline
is intentionally NOT captured/committed in this preflight, to:

- keep the quarantine free of heavy PNG/video binaries until they are consumed;
- avoid `projects/**` deck-dirt risk during analysis-only preflight.

The baseline is captured at the start of the consolidation-foundation step (the
first parity gate), from the clean `52e08fd`/`8f60677` state, using the protocol
above. This is the "validated + protocol documented, capture deferred" outcome,
within the preflight's accepted options.

## Manual fallback (if the tool ever fails in this setup)

Eye-check on `127.0.0.1:42911` for each verb case, before vs after, watching for:
fade-vs-snap, exterior-reveal on clipped exits, unclipped flash on clipped
enters, and any constant that self-crossfades. Slightly-off fades are acceptable
(camera masks; strange != wrong); a snap is not.
