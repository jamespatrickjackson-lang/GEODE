import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// Review verification item 5.2. An interrupted transition (free-look / cancel
// that cancels the camera tween without firing its completion callback) must
// not leave activeSceneTransitionContext alive with hasFinalized === false --
// that keeps the visibility envelope clamping non-target layers forever. The
// per-frame tick must self-finalize on its own clock after a grace past the
// transition end. This guards that the safety-net path exists and stays gated
// behind a grace so it never preempts the normal same-frame camera finalize.

const runtimeSource = readFileSync(
  "src/scene/transitions/layerTweenRuntime.ts",
  "utf8",
);

test("a finalize-on-interrupt grace constant exists", () => {
  assert.match(
    runtimeSource,
    /INTERRUPT_FINALIZE_GRACE_MS\s*=\s*\d+/,
    "an interrupt finalize grace constant must be declared",
  );
});

test("the tick finalizes on its own clock when the camera callback never finalized", () => {
  // Gated on the clock having elapsed past the grace, with the env/page present.
  assert.match(
    runtimeSource,
    /nowMs\s*-\s*transition\.startMs\s*>=\s*[\s\S]{0,80}INTERRUPT_FINALIZE_GRACE_MS/,
    "self-finalize must require the frame clock to have elapsed past the grace",
  );
  assert.match(
    runtimeSource,
    /finalizePageTransitionCommit\?\.\(\s*[\s\S]{0,80}lastEffectiveEnv[\s\S]{0,80}lastEffectivePage/,
    "self-finalize must call finalizePageTransitionCommit with the landed env/page",
  );
  assert.match(
    runtimeSource,
    /reason:\s*"interrupted:/,
    "the interrupt finalize must record an interrupted reason",
  );
});

test("the normal path still only clears context when already finalized", () => {
  assert.match(
    runtimeSource,
    /if\s*\(!transition\s*\|\|\s*transition\.commitState\?\.hasFinalized\)\s*\{\s*this\.activeSceneTransitionContext\s*=\s*null;/,
    "the existing hasFinalized clear branch must remain first",
  );
});
