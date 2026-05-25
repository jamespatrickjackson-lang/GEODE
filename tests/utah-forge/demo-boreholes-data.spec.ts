import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/demo_boreholes/phase3_demo_boreholes.json";

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as {
    classification: string;
    notForEngineeringUse: boolean;
    orientationBlock: {
      classification: string;
      notForEngineeringUse: boolean;
      centerScene: number[];
      sizeM: number[];
    };
    wells: Array<{
      id: string;
      role: string;
      trajectory: Array<{
        mdFt: number;
        tvdFt: number;
        scene: number[];
        utm: number[];
      }>;
      summary: {
        pointCount: number;
        mdFt: { max: number };
        tvdFt: { max: number };
        sceneBounds: { min: number[]; max: number[] };
      };
    }>;
  };
}

test("Utah FORGE demo borehole manifest has two sourced orientation wells", () => {
  const manifest = readManifest();
  expect(manifest.classification).toBe("demo-orientation");
  expect(manifest.notForEngineeringUse).toBe(true);
  expect(manifest.wells.map((well) => well.id).sort()).toEqual([
    "16A(78)-32",
    "16B(78)-32",
  ]);

  const injection = manifest.wells.find((well) => well.role === "injection");
  const production = manifest.wells.find((well) => well.role === "production");
  expect(injection?.summary.pointCount).toBeGreaterThan(400);
  expect(production?.summary.pointCount).toBeGreaterThan(400);
  expect(injection?.summary.mdFt.max).toBeGreaterThan(10_900);
  expect(production?.summary.mdFt.max).toBeGreaterThan(10_900);
  expect(injection?.summary.tvdFt.max).toBeGreaterThan(8_500);
  expect(production?.summary.tvdFt.max).toBeGreaterThan(8_300);
});

test("Utah FORGE demo boreholes sit inside the Phase 3 working area", () => {
  const manifest = readManifest();
  for (const well of manifest.wells) {
    for (const point of [
      well.trajectory[0],
      well.trajectory[Math.floor(well.trajectory.length / 2)],
      well.trajectory[well.trajectory.length - 1],
    ]) {
      expect(point.scene[0]).toBeGreaterThan(-8041.4);
      expect(point.scene[0]).toBeLessThan(-3841.4);
      expect(point.scene[1]).toBeGreaterThan(-12617.6);
      expect(point.scene[1]).toBeLessThan(-8417.6);
    }
  }

  expect(manifest.orientationBlock.classification).toBe("demo-orientation");
  expect(manifest.orientationBlock.notForEngineeringUse).toBe(true);
  expect(manifest.orientationBlock.centerScene[0]).toBeGreaterThan(-8041.4);
  expect(manifest.orientationBlock.centerScene[0]).toBeLessThan(-3841.4);
  expect(manifest.orientationBlock.sizeM[0]).toBeGreaterThan(50);
  expect(manifest.orientationBlock.sizeM[2]).toBeGreaterThan(10);
});
