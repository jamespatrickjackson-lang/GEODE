# Synthetic page and transition invariance tests

Scope: issues #18 and #19. Synthetic, source-level and pure-unit checks only.
No new application runtime behavior, real dataset, authored page, browser, dev
writer, package script, CI workflow or existing W1-W4 branch was modified.

## Baseline and contract

- Parent main: a8df8211db350b195c89cedcfc39192c48382cb8
- Authority: GEODE Notion agent-entry manifest and approved Transition Runtime Operating Spec
- Fixture: synthetic-project.json has invented numeric samples and placeholder
  provenance only. It is NOT a loadable real geoscience project.
- Execution uses actual checked-in TS policy/allocator/plan/section/commit
  source compiled in memory by TypeScript, never a copied implementation.
- Any test called "source receipt" is a bounded static assertion, not browser
  behavior or an executed persistence transaction.

## Expected before a future production fix

| Case | Expected status | Scope |
| --- | --- | --- |
| PI-004 deleted saved last page ID reallocated before save | RED | Actual production newPageId function plus tombstone simulation |
| PI-004 deleted unsaved page ID reallocated before save | RED | Same allocator and pending tombstone |
| PI-004 save path writes then deletes pending page paths | PASS | Source-order receipt, not a disk save |
| PI-A/H deletion does not edit manifest layer specs | PASS | DELETE_PAGE reducer static guard |
| PI-005 last-page deletion guard | PASS | Existing behavior, product policy unresolved |
| PI-B/E permutations/overrides retain fixture scientific identities | PASS | Fixture contract only, not reducer runtime |
| PI-F/H scientific data write-path guard | PASS | Restricted source slice; no writer invoked |
| TR identity permutation, scalar/opacity, material color | PASS | Pure classifier and plan |
| TR section compatibility/dissolve, Section ISO | PASS | Pure section/plan |
| TR delayed target readiness | PASS | Pure plan |
| TR-01 live source at multiple progress fractions | PASS | Pure classifier receives explicitly supplied live state |
| TR-01 real PageController interruption continuity | NOT RUN | Requires instrumented isolated browser/render graph |
| TR-02 measured-vs-target comparator and unknown coverage | PASS | Pure comparison with synthetic measured samples |
| TR-02 SceneManager post-commit measured-graph contract | RED | Source guard: known unmeasured committedGraph projection |
| TR-02 real pre/post-commit visible channel continuity | NOT RUN | Requires renderer sampling in W4-approved isolation |
| Scientific loader availability on fresh/deleted/reordered pages | NOT RUN | Requires real synthetic project runtime |
| Save/reopen and injected writer failure/asset hash survival | NOT RUN | Requires separately owned writer environment |
| MT scalar/cloud, seismic, ISO geometry, PNG or released product | NOT RUN | Separate W4 acceptance, not claimed |

A RED assertion is intentional and must not be skipped, converted to a TODO,
softened, or labelled a passing regression. Full CI is expected to be RED until
a distinct authorized source fix and complete independent proof.

## Safe focused commands

After an independent clean checkout and npm ci:

    node --test tests/tools/page-transition-invariance-pages.test.mjs
    node --test tests/tools/page-transition-invariance-transitions.test.mjs

The project's existing \`npm run test:tools\` aggregator discovers these files.
No preview, Playwright, localhost server or write endpoint is needed for them.

## Remaining browser dependencies

W4-ENV issue #9 must first show its own successful exact-SHA independent clone,
clean root, exclusive loopback port, owned child process, isolated browser profile,
static-production build/preview, rejected dev write route, unchanged pre/post
scientific-data and fixture hashes, and safe teardown. Only then can a separate
owner-approved synthetic project and browser runner measure full TR-01 visual
continuity, TR-02 real committed channel values, new-page scientific
capabilities and safe persistence. Existing GDR-034 remains open.

## Later fix priority (separate PRs and owner approval)

1. PI-004 reserve or reconcile deleted page IDs and tombstones before persistence.
2. PI save/delete transaction and failure propagation, writer allowlisting.
3. TR-01 coherent live source capture across section/environment/ISO channels.
4. TR-02 measure terminal and committed render graph independently.
5. TR-03 channel writer ownership and late-readiness/Section ISO parity.
6. Full page lifecycle and transition behavior in accepted W4 isolated browser.

No zero-page support is assumed; that remains a W3 product decision.
