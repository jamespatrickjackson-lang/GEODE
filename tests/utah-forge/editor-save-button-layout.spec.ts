import { expect, test } from "@playwright/test";

test("editor save button is docked at the bottom of the panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });

  const panel = page.locator(
    '[data-dev-note^="sidebarStyle controls the floating editor panel shell"]',
  );
  const header = page.locator(
    '[data-dev-note^="headerStyle controls the draggable top strip"]',
  );
  const cardsButton = page.getByRole("button", { name: "Cards" });
  const pagesButton = page.getByRole("button", { name: "Pages" });
  const stack = page.locator('[data-dev-container-type="editor-section-stack"]');
  const saveFooter = page.locator(
    '[data-dev-container-type="editor-save-footer"]',
  );
  const saveButton = page.getByRole("button", {
    name: /^(Saved|Saving|Save \d+ pending edits?)$/,
  });

  await expect(panel).toBeVisible();
  await expect(header).toBeVisible();
  await expect(stack).toBeVisible();
  await expect(saveFooter).toBeVisible();
  await expect(pagesButton).toBeVisible();
  await expect(cardsButton).toBeVisible();
  await expect(saveButton).toBeVisible();
  await expect(
    header.getByRole("button", {
      name: /^(Saved|Saving|Save \d+ pending edits?)$/,
    }),
  ).toHaveCount(0);

  const [panelBox, stackBox, pagesBox, cardsBox, saveFooterBox, saveButtonBox] =
    await Promise.all([
    panel.boundingBox(),
    stack.boundingBox(),
    pagesButton.boundingBox(),
    cardsButton.boundingBox(),
    saveFooter.boundingBox(),
    saveButton.boundingBox(),
  ]);

  expect(panelBox).not.toBeNull();
  expect(stackBox).not.toBeNull();
  expect(pagesBox).not.toBeNull();
  expect(cardsBox).not.toBeNull();
  expect(saveFooterBox).not.toBeNull();
  expect(saveButtonBox).not.toBeNull();

  const saveButtonBottom = saveButtonBox!.y + saveButtonBox!.height;
  const cardsBottom = cardsBox!.y + cardsBox!.height;
  const panelBottom = panelBox!.y + panelBox!.height;
  const topGap = pagesBox!.y - stackBox!.y;
  const bottomGap = saveFooterBox!.y - cardsBottom;

  expect(saveButtonBox!.y).toBeGreaterThan(cardsBottom);
  expect(saveButtonBottom).toBeLessThanOrEqual(panelBottom - 8);
  expect(bottomGap).toBeGreaterThanOrEqual(0);
  expect(Math.abs(bottomGap - topGap)).toBeLessThanOrEqual(2);
});
