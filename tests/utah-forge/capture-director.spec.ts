import { expect, test } from "@playwright/test";
import {
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
} from "./capture-director-helpers";

test("Capture Director smoke opens the focused split suite entry point", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);

  await expect(page.getByTestId("capture-director-toolbar")).toHaveCount(0);
  await openCaptureDirector(page);
  await expect(page.getByTestId("capture-realtime-panel")).toBeVisible();
  await expect(page.getByTestId("capture-render-panel")).toBeVisible();
  await expect(page.getByTestId("capture-still-panel")).toBeVisible();
  await expect(page.getByTestId("capture-camera-path-panel")).toBeVisible();
  await expectNoCaptureDirectorPageErrors(diagnostics);
});
