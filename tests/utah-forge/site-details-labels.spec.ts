import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { chooseLabelAnchors } from "../../src/ui/SceneLabels";

function namedObject(
  displayName: string,
  userData: Record<string, unknown> = {},
): THREE.Object3D {
  const obj = new THREE.Object3D();
  obj.userData = { displayName, ...userData };
  return obj;
}

test("structured scene labels ignore unmanaged display names when anchors exist", () => {
  const structured = new THREE.Group();
  structured.add(namedObject("Raw well root", { sceneLabelEligible: false }));
  structured.add(namedObject("Raw collar mesh"));
  structured.add(namedObject("16A injection", { labelAnchor: true }));
  structured.add(
    namedObject("FORGE orientation block", { sceneLabelEligible: true }),
  );

  expect([...chooseLabelAnchors(structured).keys()].sort()).toEqual([
    "16A injection",
    "FORGE orientation block",
  ]);

  const legacy = new THREE.Group();
  legacy.add(namedObject("Legacy display label"));

  expect([...chooseLabelAnchors(legacy).keys()]).toEqual([
    "Legacy display label",
  ]);
});

test("Site Details exposes every authorable scene label in one inventory", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);

  const forgeData = page.getByRole("button", { name: "FORGE Data" }).first();
  await expect(forgeData).toBeVisible({ timeout: 30_000 });
  if ((await forgeData.getAttribute("aria-expanded")) !== "true") {
    await forgeData.click();
  }

  const siteDetails = page.getByRole("button", { name: "Site Details" }).first();
  await expect(siteDetails).toBeVisible({ timeout: 30_000 });
  if ((await siteDetails.getAttribute("aria-expanded")) !== "true") {
    await siteDetails.click();
  }

  await expect(page.getByText("Site Labels").first()).toBeVisible({
    timeout: 30_000,
  });

  const expectedRows = [
    "site-details-label-16a-78-32-collar",
    "site-details-label-16a-78-32-toe",
    "site-details-label-16b-78-32-collar",
    "site-details-label-16b-78-32-toe",
    "site-details-label-orientation-block",
  ];
  for (const testId of expectedRows) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
});
