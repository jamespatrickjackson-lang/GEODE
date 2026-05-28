import { expect, test, type Page } from "@playwright/test";
import { selectForgePageRow } from "./shared";

async function ensureTopLevelOpen(page: Page, title: string): Promise<void> {
  const button = page.getByRole("button", { name: title }).first();
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") {
    await button.click();
  }
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

test("Utah FORGE editor elevates Sections & Cropping before Public Topo Map", async ({
  page,
}) => {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await selectForgePageRow(page, "01.");

  const topLevelButtons = page.locator(
    '[data-dev-source="src/editor/styles.ts:180"][role="button"]',
  );
  await expect(
    topLevelButtons.filter({ hasText: "Sections & Cropping" }),
  ).toHaveCount(1);

  const titles = await topLevelButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
  );
  const cameraIndex = titles.findIndex((title) => title === "Camera Dynamics");
  const sectionsIndex = titles.findIndex(
    (title) => title === "Sections & Cropping",
  );
  const topoIndex = titles.findIndex((title) => title === "Public Topo Map");

  expect(cameraIndex).toBeGreaterThan(-1);
  expect(sectionsIndex).toBeGreaterThan(cameraIndex);
  expect(topoIndex).toBeGreaterThan(sectionsIndex);

  await ensureTopLevelOpen(page, "Sections & Cropping");
  const sectionsBlock = page
    .locator('[data-dev-source="src/editor/CollapsibleSection.tsx:35"]')
    .filter({
      has: page.getByRole("button", { name: "Sections & Cropping" }),
    });
  await expect(sectionsBlock).toContainText("Scene section planes");
  await expect(sectionsBlock).toContainText("Phase 3 working area");
  await expect(sectionsBlock).toContainText("Working area focus");
  await expect(page.getByTestId("scene-section-planes-container")).toBeVisible();
  await expect(page.getByTestId("working-area-focus-container")).toBeVisible();

  await ensureTopLevelOpen(page, "FORGE Data");
  const forgeDataBlock = page
    .locator('[data-dev-source="src/editor/CollapsibleSection.tsx:35"]')
    .filter({ has: page.getByRole("button", { name: "FORGE Data" }) });
  await expect(forgeDataBlock).not.toContainText("Scene section planes");
  await expect(forgeDataBlock).not.toContainText(
    "Phase 3 working area",
  );
  await expect(forgeDataBlock).not.toContainText("Working area focus");
});
