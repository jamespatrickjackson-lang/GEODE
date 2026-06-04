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
  test.setTimeout(120_000);
  await openPagesPanel(page);

  const rows = pageRows(page);
  await expect(rows.nth(2)).toBeVisible({ timeout: 30_000 });
  const firstTitle = (await pageRowTitle(rows.nth(0)).innerText()).trim();
  const secondTitle = (await pageRowTitle(rows.nth(1)).innerText()).trim();
  const thirdTitle = (await pageRowTitle(rows.nth(2)).innerText()).trim();
  const grip = rows.nth(0).getByRole("button", {
    name: "Drag page to reorder",
  });
  const gripBox = await grip.boundingBox();
  const secondBox = await rows.nth(1).boundingBox();
  expect(gripBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  const buttonRects = await rows
    .nth(0)
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          name: button.getAttribute("aria-label"),
          right: rect.right,
        };
      }),
    );
  const gripRect = buttonRects.find(
    (button) => button.name === "Drag page to reorder",
  );
  expect(gripRect).toBeTruthy();
  expect(gripRect!.right).toBe(
    Math.max(...buttonRects.map((button) => button.right)),
  );
  const rowActionBackgrounds = await rows
    .evaluateAll((rowElements) =>
      rowElements.slice(0, 13).flatMap((row) =>
        Array.from(row.querySelectorAll("button"))
          .filter((button) => {
            const label = button.getAttribute("aria-label") ?? "";
            return (
              label === "Hide page" ||
              label === "Show page" ||
              label === "Drag page to reorder"
            );
          })
          .map((button) => getComputedStyle(button).backgroundColor),
      ),
    );
  expect(new Set(rowActionBackgrounds)).toEqual(new Set(["rgb(32, 36, 40)"]));

  await page.mouse.move(
    gripBox!.x + gripBox!.width / 2,
    gripBox!.y + gripBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    secondBox!.x + secondBox!.width / 2,
    secondBox!.y + secondBox!.height * 0.75,
    { steps: 6 },
  );
  await expect(page.getByTestId("page-drag-preview")).toBeVisible();
  await expect(page.getByTestId("page-drop-indicator")).toBeVisible();
  const dragSourceStyles = await rows.nth(0).evaluate((row) => {
    const styles = getComputedStyle(row);
    return {
      opacity: styles.opacity,
      visibility: styles.visibility,
    };
  });
  expect(dragSourceStyles).toEqual({
    opacity: "0.5",
    visibility: "visible",
  });
  const previewStyles = await page
    .getByTestId("page-drag-preview")
    .evaluate((preview) => {
      const styles = getComputedStyle(preview);
      return {
        backgroundColor: styles.backgroundColor,
        borderBottomColor: styles.borderBottomColor,
        borderBottomWidth: styles.borderBottomWidth,
        borderLeftColor: styles.borderLeftColor,
        borderLeftWidth: styles.borderLeftWidth,
        borderRightColor: styles.borderRightColor,
        borderRightWidth: styles.borderRightWidth,
        borderTopColor: styles.borderTopColor,
        borderTopWidth: styles.borderTopWidth,
        color: styles.color,
        fontFamily: styles.fontFamily,
      };
    });
  expect(previewStyles.backgroundColor).toBe("rgba(18, 21, 24, 0.53)");
  expect(previewStyles.color).toBe("rgb(244, 240, 232)");
  expect(previewStyles.fontFamily).toContain("Consolas");
  expect(previewStyles.borderTopColor).toBe(previewStyles.borderRightColor);
  expect(previewStyles.borderTopColor).toBe(previewStyles.borderBottomColor);
  expect(previewStyles.borderTopColor).toBe(previewStyles.borderLeftColor);
  expect(previewStyles.borderTopWidth).toBe(previewStyles.borderRightWidth);
  expect(previewStyles.borderTopWidth).toBe(previewStyles.borderBottomWidth);
  expect(previewStyles.borderTopWidth).toBe(previewStyles.borderLeftWidth);
  await page.mouse.up();

  await expect(page.getByTestId("page-drag-preview")).toHaveCount(0);
  await expect(page.getByTestId("page-drop-indicator")).toHaveCount(0);
  await expect(pageRowTitle(rows.nth(0))).toHaveText(secondTitle);
  await expect(pageRowTitle(rows.nth(1))).toHaveText(firstTitle);

  const thirdGrip = rows.nth(2).getByRole("button", {
    name: "Drag page to reorder",
  });
  const thirdGripBox = await thirdGrip.boundingBox();
  const firstAfterMoveBox = await rows.nth(1).boundingBox();
  expect(thirdGripBox).not.toBeNull();
  expect(firstAfterMoveBox).not.toBeNull();

  await page.mouse.move(
    thirdGripBox!.x + thirdGripBox!.width / 2,
    thirdGripBox!.y + thirdGripBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    firstAfterMoveBox!.x + firstAfterMoveBox!.width / 2,
    firstAfterMoveBox!.y + firstAfterMoveBox!.height * 0.25,
    { steps: 6 },
  );
  await expect(page.getByTestId("page-drag-preview")).toBeVisible();
  await expect(page.getByTestId("page-drop-indicator")).toBeVisible();
  await page.mouse.up();

  await expect(page.getByTestId("page-drag-preview")).toHaveCount(0);
  await expect(page.getByTestId("page-drop-indicator")).toHaveCount(0);
  await expect(pageRowTitle(rows.nth(0))).toHaveText(secondTitle);
  await expect(pageRowTitle(rows.nth(1))).toHaveText(thirdTitle);
  await expect(pageRowTitle(rows.nth(2))).toHaveText(firstTitle);
});

test("Pages footer converts a page to master and duplicates it as a child", async ({
  page,
}) => {
  await openPagesPanel(page);

  const rows = pageRows(page);
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const makeMaster = page.getByRole("button", { name: "Make Master" });
  const makeChild = page.getByRole("button", { name: "Make Child" });
  const deletePage = page.getByRole("button", { name: "Delete selected page" });
  await makeMaster.scrollIntoViewIfNeeded();
  await expect(makeMaster).toHaveText("M");
  await expect(makeChild).toHaveText("C");
  const makeMasterBox = await makeMaster.boundingBox();
  const makeChildBox = await makeChild.boundingBox();
  const deleteBox = await deletePage.boundingBox();
  expect(makeMasterBox).not.toBeNull();
  expect(makeChildBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  const rowCenterY = makeMasterBox!.y + makeMasterBox!.height / 2;
  expect(
    Math.abs(rowCenterY - (makeChildBox!.y + makeChildBox!.height / 2)),
  ).toBeLessThan(3);
  expect(
    Math.abs(rowCenterY - (deleteBox!.y + deleteBox!.height / 2)),
  ).toBeLessThan(3);
  expect(makeMasterBox!.x).toBeLessThan(makeChildBox!.x);
  expect(makeChildBox!.x).toBeLessThan(deleteBox!.x);

  await rows.first().click();

  await page.getByRole("button", { name: "Make Master" }).click();
  await expect(rows.first()).toHaveAttribute("data-page-role", "subMaster");

  await page.getByRole("button", { name: "Make Child" }).click();
  await expect(rows.nth(1)).toHaveAttribute(
    "data-page-role",
    "subMasterChild",
  );
});
