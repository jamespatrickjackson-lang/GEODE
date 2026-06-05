import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

test("render-stack inspector reports runtime topo authority and post stack", () => {
  const output = execFileSync(
    process.execPath,
    [
      "tools/inspect-effective-state.mjs",
      "--project",
      "projects/utah-forge",
      "--page",
      "42_resistivity_volume_overview",
      "--render-stack",
      "--json",
    ],
    { encoding: "utf8" },
  );
  const report = JSON.parse(output);

  assert.equal(report.renderStack.activeRenderPreset.id, report.activeRenderPreset.id);
  assert.equal(
    report.renderStack.topoAuthority.effectiveTerrain.materialPreset,
    "image:naip-2024-aerial",
  );
  assert.match(
    report.renderStack.topoAuthority.textureUrl,
    /naip_2024_regional_8192\.webp\?v=/,
  );
  assert.deepEqual(report.renderStack.topoAuthority.bounds, [
    229069.2,
    4094688,
    598806,
    4414308,
  ]);
  assert.equal(report.renderStack.topoAuthority.edgeFade.shape, "rounded-square");
  assert.equal(report.renderStack.topoAuthority.edgeOutline.enabled, false);
  assert.deepEqual(report.renderStack.postProcessing.stack, [
    "RenderPass",
    "SSAOPass",
    "BokehPass",
    "UnrealBloomPass",
    "TiltShiftPass",
    "AfterimagePass",
    "LensGradePass",
    "SMAAPass",
    "OutputPass",
  ]);
  assert.equal(
    report.renderStack.cinematicTransitions.transitionChannel,
    "main-camera/cinematic-post",
  );
  assert.deepEqual(
    report.renderStack.cinematicTransitions.policies
      .filter((policy) => policy.transitionKind === "timed-shot")
      .map((policy) => policy.key),
    [
      "dynamicCamera.dolly",
      "dynamicCamera.truck",
      "dynamicCamera.crane",
      "dynamicCamera.handheld",
    ],
  );
  assert.ok(
    report.renderStack.cinematicTransitions.policies.some(
      (policy) =>
        policy.key === "depthOfField" &&
        policy.transitionKind === "continuous",
    ),
  );
});
