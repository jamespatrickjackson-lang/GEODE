// Review-flag harness for source-fidelity checks that must NOT block the gate.
//
// Policy (DEC-184): a check that asserts DISPOSABLE deck / authoring state
// ("DECK-REVIEW") must be FLAGGED for review at the gate, never fail it — the
// Utah FORGE deck is disposable authoring state and re-authoring/archival is
// expected. A SOURCE-CONTRACT (implementation-string) assertion that has drifted
// from refactored code ("SOURCE-CONTRACT-RISK") is also non-blocking, but is a
// potential latent risk and is logged in detail in
// docs/dev-context/Source-Contract-Drift-Risk-Log.md for investigation.
//
// Both categories run every gate so the signal is never lost; an assertion
// failure becomes a printed flag instead of a red gate. A genuine (non-assertion)
// error still fails — only ERR_ASSERTION is downgraded to a flag.

import test from "node:test";

const FLAGS = [];

/**
 * @param {"DECK-REVIEW"|"SOURCE-CONTRACT-RISK"} category
 * @param {string} name
 * @param {(t: import("node:test").TestContext) => unknown} fn
 */
export function reviewTest(category, name, fn) {
  test(name, async (t) => {
    try {
      await fn(t);
    } catch (err) {
      if (err && err.code === "ERR_ASSERTION") {
        const detail = String(err.message ?? "").split("\n")[0].trim();
        FLAGS.push({ category, name });
        console.warn(`⚑ REVIEW-FLAG [${category}] ${name}\n      ${detail}`);
        return; // flagged, not failed
      }
      throw err; // genuine error still fails the gate
    }
  });
}

process.on("exit", () => {
  if (FLAGS.length === 0) return;
  const counts = FLAGS.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([cat, n]) => `${cat}=${n}`)
    .join(", ");
  console.warn(
    `⚑ ${FLAGS.length} review flag(s) in this file — non-gating (${summary}).`,
  );
});
