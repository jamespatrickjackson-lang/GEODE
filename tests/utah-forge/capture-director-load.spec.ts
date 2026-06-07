import { expect, test } from "@playwright/test";
import {
  dispatchCaptureDirectorButton,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
} from "./capture-director-helpers";

test("Capture Director launcher opens the docked panels", async ({ page }) => {
  const diagnostics = await loadCaptureDirector(page);

  const launcher = page.getByTestId("capture-director-launcher");
  await expect(launcher).toBeVisible();
  const launcherBox = await launcher.boundingBox();
  expect(launcherBox).not.toBeNull();
  expect(launcherBox?.width ?? 0).toBeGreaterThan(35);
  expect(launcherBox?.width ?? 0).toBeLessThan(37);
  expect(launcherBox?.height ?? 0).toBeGreaterThan(35);
  expect(launcherBox?.height ?? 0).toBeLessThan(37);
  expect(launcherBox?.x ?? 0).toBeGreaterThan(1000);
  expect(launcherBox?.y ?? 0).toBeGreaterThan(620);
  await expect(page.getByTestId("capture-director-toolbar")).toHaveCount(0);

  await openCaptureDirector(page);
  await expect(page.getByTestId("capture-director-dock")).toBeVisible();
  await expect(page.getByTestId("capture-director-section-stack")).toBeVisible();
  await expect(page.getByTestId("capture-realtime-panel")).toContainText(
    "Realtime Capture",
  );
  await expect(page.getByTestId("capture-render-panel")).toContainText(
    "Render Out",
  );
  for (const testId of [
    "capture-realtime-header",
    "capture-render-header",
    "capture-still-header",
    "capture-camera-path-header",
  ]) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
  await expect(page.getByTestId("capture-path-row")).toHaveCount(0);
  await expect(page.getByTestId("capture-path-transition")).toHaveCount(0);

  await dispatchCaptureDirectorButton(
    page,
    "capture-director-launcher",
    "Close Capture Director",
  );
  await expect(page.getByTestId("capture-director-toolbar")).toHaveCount(0);
  await expectNoCaptureDirectorPageErrors(diagnostics);
});
