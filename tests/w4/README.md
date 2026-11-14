# W4-ENV #9 | isolated verification infrastructure

**Scope:** infrastructure and synthetic guard tests only. No Gate A/B browser acceptance, scientific validation, project edits, CI/package changes or public deployment.

## 1. Run safe unit/negative tests (no existing browser/server)

```sh
node --test tests/w4/w4-env-guard.test.mjs
```

These tests create only self-owned small Git repositories under OS temp. They do not clone GEODE, use original project files or attach to any browser process. The tests deliberately demonstrate failed commands and mutation detection inside synthetic repositories.

## 2. Future real-repository preflight (needs actual independent clone)

Only from an authorized machine with network access and a clean terminal, and only after verifying the path is not an active user workspace:

```sh
node tools/w4/create-sandbox.mjs
# Read its printed SANDBOX directory. Clone into the *new* SANDBOX/checkout only.
git clone https://github.com/jamespatrickjackson-lang/GEODE.git SANDBOX/checkout
cd SANDBOX/checkout
git switch --create test/w4-env-isolated-preflight --track origin/test/w4-env-isolated-preflight
# Confirm expected SHA from the dedicated W4 branch before running:
git rev-parse HEAD
node tools/w4/verify-isolated-checkout.mjs SANDBOX SANDBOX/checkout EXACT_SHA
npm ci
npm run build
node tools/w4/allocate-strict-port.mjs
# Set W4_SANDBOX, W4_CHECKOUT, W4_EXPECTED_SHA, W4_PORT in the environment.
# Only authorized, separately reviewed smoke specs may be run:
# npx playwright test -c playwright.w4.config.ts
node tools/w4/check-worktree-integrity.mjs SANDBOX SANDBOX/checkout
```

`SANDBOX`, `EXACT_SHA` and env vars are *placeholders*, not literal commands. Use the dedicated branch SHA, not main. Unit tests can run without cloning, but clean-clone/build/preview requires the actual source, dependencies, disposable checkout and exclusive port.

## 3. Guardrails and evidence

- `create-sandbox` creates a **new** temp directory with `.w4-env-owned.json` and an evidence directory. It never assumes ownership of an existing directory. Checkout must be an exact `checkout` child and branch `test/w4-env-isolated-preflight`. The marker is not permission to use a remembered local path.
- `verify-isolated-checkout` verifies Git root, origin URL, branch, exact SHA, cleanliness, synthetic fixture manifest and all tracked source SHA-256 digests. It writes `evidence/baseline.json` outside tracked source and refuses to overwrite it.
- `allocate-strict-port` checks localhost port availability, never terminates another listener. Its probe **releases** the port; Vite `--strictPort` must also fail closed if another process takes it. Reserved 5173, 5194, 5273 are prohibited.
- `playwright.w4.config.ts` uses a single isolated browser worker, production build preview, `reuseExistingServer:false`, and evidence outside checkout. `run-static-preview` launches Vite directly as a child process it owns, binds `127.0.0.1`, records PID and terminates only that child. It is equivalent to `npm run preview -- --host 127.0.0.1 --port W4_PORT --strictPort`.
- Dev authoring routes are **not** tested or invoked. Future static tests must treat any unexpected dev-write HTTP 2xx response, including an SPA-index fallback, as a fail; `assertStaticWriteRejected` supplies a strict status predicate. This W4-ENV does not prove the actual hosted origin rejects these routes until the static smoke is executed.
- `check-worktree-integrity` compares remote/branch/SHA, clean Git status and SHA-256 digest of **all** tracked files, including real project manifests, to the original baseline. It fails on any change, does not revert or reset. Retain artifacts after failure; never recursively clean a directory without separate explicit verification of ownership. A symlink in tracked content is rejected rather than followed.
- No automatic sandbox cleanup is performed because such deletion could remove diagnostic evidence. Operators may remove *only* a specific separately verified owned disposable sandbox after retaining needed receipts. Do not use `kill-port`, broad process termination, `git reset --hard`, or cleanup commands against an unknown workspace.

## 4. Unverified until full disposable checkout is available

This first branch contains no Gate A/B tests. Its synthetic guard tests may pass without a full GEODE checkout. Actual `npm ci`, production build, full 679 existing source tests, static production preview, browser version, process lifecycle, before/after tracked hashes on **real GEODE** and any HTTP API response still need separate exact-SHA execution receipts. No configuration here establishes scientific accuracy or release acceptance.
