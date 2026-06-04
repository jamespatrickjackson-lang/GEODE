import { expect, test } from "@playwright/test";
import {
  isSubMasterPage,
  pageSelectionHasLanded,
  selectedAuthoringPage,
  selectedPageWriteBlocked,
} from "../../src/editor/authoringTarget";
import { ENVIRONMENT_SENTINEL } from "../../src/editor/types";
import type { PresentationPage } from "../../src/pages/types";

function firstEditablePageRow(page: import("@playwright/test").Page) {
  return page
    .locator('[data-dev-note*="panelStyles.pageRow"]')
    .first();
}

async function openPagesPanel(page: import("@playwright/test").Page) {
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);

  const pageManager = page.getByRole("button", { name: "Pages" });
  await expect(pageManager).toBeVisible({ timeout: 30_000 });
  if ((await pageManager.getAttribute("aria-expanded")) !== "true") {
    await pageManager.click();
  }
}

function pageRows(page: import("@playwright/test").Page) {
  return page.locator("[data-page-id]");
}

function pageRowTitle(row: ReturnType<typeof pageRows>) {
  return row.locator('[data-dev-note*="InlineEditableTitle display text"]').first();
}

test("authoring target helper separates Global, Sub Master, and pending page states", () => {
  const normalPage = { id: "page-a", title: "Page A" } as PresentationPage;
  const subMaster = {
    id: "sub-master-a",
    title: "Sub Master A",
    parentMasterId: "global",
    envSnapshot: {},
  } as PresentationPage;

  expect(isSubMasterPage(normalPage)).toBe(false);
  expect(isSubMasterPage(subMaster)).toBe(true);
  expect(
    selectedAuthoringPage({
      selectedPageId: ENVIRONMENT_SENTINEL,
      pages: [normalPage, subMaster],
    }),
  ).toBeNull();
  expect(
    selectedAuthoringPage({
      selectedPageId: subMaster.id,
      pages: [normalPage, subMaster],
    }),
  ).toBe(subMaster);

  expect(
    pageSelectionHasLanded({
      selectedPageIndex: 1,
      currentIndex: 0,
      isTransitioning: true,
      targetIndex: 1,
    }),
  ).toBe(false);
  expect(
    pageSelectionHasLanded({
      selectedPageIndex: 1,
      currentIndex: 1,
      isTransitioning: false,
      targetIndex: null,
    }),
  ).toBe(true);
  expect(
    selectedPageWriteBlocked(
      { selectedPageId: normalPage.id },
      normalPage.id,
      true,
    ),
  ).toBe(true);
  expect(
    selectedPageWriteBlocked(
      { selectedPageId: normalPage.id },
      subMaster.id,
      true,
    ),
  ).toBe(false);
});

test("Pages single-click selects title and double-click edits it", async ({
  page,
}) => {
  await openPagesPanel(page);

  const row = firstEditablePageRow(page);
  await expect(row).toBeVisible({ timeout: 30_000 });
  const title = row
    .locator('[data-dev-note*="InlineEditableTitle display text"]')
    .first();
  const titleInput = row.locator(
    '[data-dev-note*="InlineEditableTitle edit input"]',
  );

  await title.click();
  await expect(titleInput).toHaveCount(0);

  await title.dblclick();
  await expect(titleInput).toBeVisible();
});

test("Pages grip drag reorders rows in memory", async ({ page }) => {
  await openPagesPanel(page);

  const rows = pageRows(page);
  await expect(rows.nth(1)).toBeVisible({ timeout: 30_000 });
  const firstTitle = (await pageRowTitle(rows.nth(0)).innerText()).trim();
  const secondTitle = (await pageRowTitle(rows.nth(1)).innerText()).trim();
  const grip = rows.nth(0).getByRole("button", {
    name: "Drag page to reorder",
  });
  const gripBox = await grip.boundingBox();
  const secondBox = await rows.nth(1).boundingBox();
  expect(gripBox).not.toBeNull();
  expect(secondBox).not.toBeNull();

  await page.mouse.move(
    gripBox!.x + gripBox!.width / 2,
    gripBox!.y + gripBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    secondBox!.x + secondBox!.width / 2,
    secondBox!.y + secondBox!.height / 2,
    { steps: 6 },
  );
  await page.mouse.up();

  await expect(pageRowTitle(rows.nth(0))).toHaveText(secondTitle);
  await expect(pageRowTitle(rows.nth(1))).toHaveText(firstTitle);
});

test("Pages footer converts a page to master and duplicates it as a child", async ({
  page,
}) => {
  await openPagesPanel(page);

  const rows = pageRows(page);
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  await rows.first().click();

  await page.getByRole("button", { name: "Make Master" }).click();
  await expect(rows.first()).toHaveAttribute("data-page-role", "subMaster");

  await page.getByRole("button", { name: "Make Child" }).click();
  await expect(rows.nth(1)).toHaveAttribute(
    "data-page-role",
    "subMasterChild",
  );
});
