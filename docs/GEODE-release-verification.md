# GEODE release verification

Verification performed on 12 November 2026. Source baseline: `76e6bf47d2be144049f61ed390879996022cb19c`.
Verification ran in an isolated clone of the recovery bundle, not in the active development working tree.

## Current result

The README, publication manifest, verification report and machine-readable exclusion proof form an explicitly scoped release documentation commit. The historical-content gate was resolved by the owner-approved removal of two browser-debug directories from an isolated public-history copy. The [publication manifest](GEODE-publication-manifest.md) and [exclusion proof](GEODE-history-exclusion-proof.json) record the exact scope. This report records pre-publication verification; remote publication and GitHub Actions results are recorded separately after pushing.

## Runtime and checks

| Command / environment | Result | Meaning |
| --- | --- | --- |
| `npm ci`, Node 24.22.2 / npm 11.19.1 | PASS | Fresh dependency install in isolated clone |
| `npm run build`, Node 24 | PASS | TypeScript and Vite build; large-chunk warning remains |
| `npm run check:gate`, Node 24 | PASS | Workspace, editor manifest, context/route/mirror checks |
| `npm run check:pages`, Node 24 | PASS | Project/page wiring |
| `npm run check:runtime-assets`, Node 24 | PASS | Runtime asset references |
| `npm run check:seismic-source-gates`, Node 24 | PASS | Seismic source gating |
| `npm run test:tools`, initial Node 24 environment | FAIL: 670 passed, 9 failed | Environment failure: Windows App Execution Alias resolved `python` without an installed interpreter on PATH |
| `npm run test:tools`, Node 24 with Python 3.14.4 on process PATH | PASS: 679/679 | All nine failures resolved without changing application/test source |
| `npm ci`, Node 20.20.2 / npm 10.9.10 | PASS | Separate compatibility run using an isolated portable Node/npm installation |
| Build, gate, pages and runtime-assets, Node 20 | PASS | Existing CI's Node major verified on Windows |
| `npm run test:tools`, Node 20 / Python 3.14.4 | PASS: 679/679 | Source contracts plus runtime/unit/ingestion tests; not full browser acceptance |
| `npm run check:visual-qa-clean`, before browser testing | PASS | No dirty project/page/overlay fixtures in candidate |
| `npm audit --json` | 10 advisories: 1 low, 3 moderate, 6 high | Known dependency debt; no forced or major-version upgrade applied |

The first portable npm 10 invocation used an invalid package-local Windows shim path and failed before installation. The release-local shim was corrected to invoke npm's CLI with the portable Node binary; the successful compatibility results above are from the rerun. Neither the system Node installation nor global PATH was changed.

Python is necessary for the Phase 2C shapefile and borehole-ingestion fixtures. An available Python 3 executable must be discoverable as `python` for the full source suite. Ordinary Node build/runtime checks do not require Python.

## Browser smoke

Targeted smoke used a fresh browser context and a separate loopback Vite server on an allocated free port. No active developer service was reused or terminated.

| Target | Observed result | Browser / qualification |
| --- | --- | --- |
| Landing catalog | PASS | Chromium 148.0.7778.96 |
| Utah FORGE | PASS: 1440×900 canvas, enter presenter and return to editor; no page errors, HTTP failures or console errors | Chromium 148 with software rendering |
| Base GUI | PASS: canvas and editor/presenter round trip; no observed errors | Chromium 148 with software rendering |
| Woodjam | PASS: 1280×720 canvas and editor/presenter round trip; no observed errors | Installed Chrome 157.0.8103.38 |
| Shahbazi | Functional smoke PASS: loaded scene, audience selection, presenter/editor round trip; screenshot inspected | Installed Chrome 157; strict console gate remains FAIL for a single missing `/favicon.ico` (404), classified nonblocking |

The bundled headless Chromium run timed out while evaluating Woodjam's canvas; an independent run in installed Chrome completed successfully. This demonstrates browser/environment sensitivity, not universal browser acceptance.

The first Shahbazi test incorrectly expected immediate preview without selecting its audience lens. Source inspection confirmed the intended audience-selection step; the corrected test exercised that step successfully. The remaining console 404 was traced specifically to `/favicon.ico`, not a scientific dataset. There were no uncaught page errors or scientific asset response failures in that final run. Diagnostic state listed 10 loaded layer IDs and visible prepared survey/photography layers. The screenshot showed the quarry surface, contour/flight geometry, photographic patches and editor controls; this is visual smoke evidence, not survey-accuracy acceptance.

Requests observed as POST were the application's `/api/read-file` reads. The post-test workspace guard confirmed no modified project/page/overlay fixtures. These checks cover project opening and editor/presenter mode transitions, not exhaustive authored-page navigation, layer combinations, editing persistence, cross-browser regression or cinematic encoding.

## Portability and external files

Core runtime source, Vite plugins and configuration contain no `GeoSee_Archive` dependency found by the scoped inspection. The clean clone's asset and page validators pass using its tracked assets. The original archive was not moved, renamed or modified.

Optional offline preparation and audit scripts do reference `C:/GeoSee/GeoSee_Archive`. Examples include MT volume preparation, seismic preprocessing, MT raw-source audit, and NAIP generation/quality analysis. Some accept `GEOSEE_ARCHIVE_ROOT`; others retain machine-specific defaults. They are separate raw-source regeneration workflows, not evidence that every dataset can be regenerated from a clone without acquiring its inputs.

Vite's build plugins copy prepared project/runtime data and FFmpeg core assets, omitting raw/client-preprocessed source buckets, extracted paper figures and selected archive-only pages. Development authoring endpoints are not present in the production build. A build pass does not verify every static hosting or export route.

## GitHub Actions

Existing workflow: [checks.yml](../.github/workflows/checks.yml).

- Ubuntu runner, Node 20, `npm ci`.
- Blocking steps: routes, mirror, editor controls, agent drag and pages.
- `test:tools` is currently advisory through `continue-on-error: true`, reflecting historical failures.
- The workflow does not currently run the production build, runtime-assets check or full browser suite.
- Local Node 20 compatibility passed. A Linux/GitHub Actions run is **not yet verified** because no candidate has been pushed.

The Windows Git credential path passed `git push --dry-run origin main:main` with interactive prompts disabled. This confirms non-publishing push negotiation, not publication. Windows `gh auth status` independently still reported no authenticated host. The connected GitHub integration can inspect the public destination.

## Failure classification and limits

| Classification | Finding | Release handling |
| --- | --- | --- |
| Resolved publication blocker | Two historical browser minidumps contained process-memory streams | Owner approved excluding both enclosing debug directories in the isolated public history; all 395 commit trees compared, both dump blobs unreachable |
| Resolved environment failure | Python missing from initial test PATH | Located existing Python 3.14.4; all 679 tests pass on Node 20 and 24 |
| Nonblocking for a source-only alpha publication; relevant to deployment | npm dependency advisories | Documented; avoid exposing development server, use trusted project inputs, and schedule separately scoped dependency remediation when authorized |
| Nonblocking | Vite large-chunk warning | Build succeeds; performance work remains |
| Nonblocking browser compatibility limitation | Woodjam canvas evaluation timed out in bundled Chromium; installed Chrome passed | Retain browser versions and do not claim cross-browser acceptance |
| Nonblocking presentation polish | Shahbazi strict console check reports missing favicon (404) | Application flow and scientific assets passed; no runtime changes made |
| Unverified | Remote Linux CI, broad browser regression, all capture/export modes and full scientific accuracy | No corresponding acceptance claim |
| Historical | Earlier saved browser failure markers | Retained as historical evidence, not presented as current results |

Scientific literature comparison and professional review are developer-reported. Numerical registration, metrology, engineering-use validation and medical-device clearance are not established.

## Preservation and recovery

The active repository remains on its original main commit with the original 17 pending entries and unchanged Git index. All 2,964 copied files match their backup hashes. The imported medical ref remains `e86d5bbd95fac95f0d92970e1063b6a2651c38b1`; no medical, offshore or DMT working-tree edits were performed.

Recovery artifacts are outside the active repository at `C:\GeoSee\GEODE-release-20261112\`:

- `all-refs.bundle`: 58 advertised refs including HEAD; bundle verification passed.
- `restore-check.git`: bundle restored as a mirror; refs match and `git fsck --full` passed.
- `working-tree/` and `working-tree-inventory.json`: 2,964 files, 897,245,339 bytes, per-file SHA-256 verification.
- `unstaged.patch`, `staged.patch`, saved index/config/HEAD and before-state inventory.
- `candidate/`: isolated release preparation; original repository is not its working tree.
- Command logs, history scan and preservation receipts.

Bundle SHA-256: `2210eefa4455249493474a260b6d6b668376d0396a66d69c064a299fde0feb0e`.

Dependencies/build output, test-results, temporary directories and media-output directories were excluded from the file-copy backup and remain untouched in the original location; the full ignored-file inventory was recorded. Relevant tracked, untracked and other ignored local files were included.

To recover, restore the bundle into a **new destination**, verify its refs, and restore the saved working files/patches there. Do not overwrite the live working repository as a routine recovery step.

## Alignerr handoff

The privacy/history decision is approved and implemented. Finish the narrowly scoped release commit, push only reviewed main to the existing repository, independently compare remote and local SHAs and inspect CI. Then use the verified repository URL for the Alignerr project-creation flow, identify GeoSee as the implemented geoscience alpha, and cite concrete source/decision/test evidence. Do not submit an empty repository or present the separate medical branch as already public.
