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
  await page.goto("/?project=utah-forge", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toHaveCount(1);

  const pageManager = page.getByRole("button", { name: "Pages" });
  await expect(pageManager).toBeVisible({ timeout: 30_000 });
  if ((await pageManager.getAttribute("aria-expanded")) !== "true") {
    await pageManager.click();
  }

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
