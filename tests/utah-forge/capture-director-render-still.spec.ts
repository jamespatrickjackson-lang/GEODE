import { expect, test } from "@playwright/test";
import {
  captureDirectorEvents,
  dispatchCaptureDirectorButton,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
  openScreenCaptureOptions,
  resetCaptureDirectorEvents,
} from "./capture-director-helpers";

test("Capture Director render settings expose page-range export controls", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);

  await page
    .getByTestId("capture-mode-select")
    .selectOption("scene-annotations", { force: true });
  await expect(page.getByTestId("capture-mode-select")).toHaveValue(
    "scene-annotations",
  );
  await page
    .getByTestId("capture-preview-resolution-select")
    .selectOption("preview-1080");
  await page
    .getByTestId("capture-render-resolution-select")
    .selectOption("preview-1080");
  await expect(page.getByTestId("capture-fps-select")).toHaveValue("30");
  await page.getByTestId("capture-scope-select").selectOption("page-range");

  const pageRangeOptions = await page
    .getByTestId("capture-page-range-start")
    .locator("option")
    .evaluateAll((options) => options.map((option) => option.value));
  expect(pageRangeOptions.length).toBeGreaterThan(1);
  await page
    .getByTestId("capture-page-range-start")
    .selectOption(pageRangeOptions[0]);
  await page
    .getByTestId("capture-page-range-end")
    .selectOption(pageRangeOptions[0]);
  await page
    .getByTestId("capture-page-range-timing")
    .selectOption("equal-holds");
  await page.getByTestId("capture-page-range-equal-hold").fill("0.1");
  await page.getByTestId("capture-render-fps-select").selectOption("24");
  await expect(page.getByTestId("capture-page-range-summary")).toContainText(
    "pages",
  );
  await page.getByTestId("capture-export-format-select").selectOption("mp4");
  await expect(page.getByTestId("capture-export-mp4")).toBeEnabled();
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

test("Capture Director still capture saves preview output and falls back for 8K", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);

  await resetCaptureDirectorEvents(page);
  await page
    .getByTestId("capture-render-resolution-select")
    .selectOption("preview-1080");
  await openScreenCaptureOptions(page);
  await page.getByTestId("capture-screen-type-select").selectOption("webp");
  await page.getByTestId("capture-screen-quality-input").fill("0.74");
  await expect(page.getByTestId("capture-screen-capture-run")).toBeEnabled();
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
  await expect
    .poll(async () => {
      const events = await captureDirectorEvents(page);
      return events.some(
        (event) =>
          event.kind === "canvas-to-blob" &&
          event.width === 1920 &&
          event.height === 1080 &&
          event.type === "image/webp",
      );
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const events = await captureDirectorEvents(page);
      return events.some(
        (event) =>
          event.kind === "save-file-write" &&
          typeof event.bytes === "number" &&
          event.bytes > 0 &&
          event.type === "image/webp",
      );
    })
    .toBe(true);
  await expect(page.getByTestId("capture-error")).toHaveCount(0);
  await expect(page.getByTestId("capture-external-still-job-download")).toHaveCount(
    0,
  );

  await resetCaptureDirectorEvents(page, {
    __captureDirectorCapabilitiesOverride: {
      maxTextureSize: 4096,
      maxRenderbufferSize: 4096,
    },
  });
  await page
    .getByTestId("capture-render-resolution-select")
    .selectOption("render-8k");
  await openScreenCaptureOptions(page);
  await page.getByTestId("capture-screen-type-select").selectOption("png");
  await expect(page.getByTestId("capture-screen-capture-run")).toBeEnabled();
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
  await expect(page.getByTestId("capture-screen-download")).toHaveCount(0);
  await expect(
    page.getByTestId("capture-external-still-job-download"),
  ).toHaveAttribute(
    "download",
    /utah-forge-.*-8k-external-still-\d{8}T\d{6}Z\.json/,
  );
  await expect(
    page.getByTestId("capture-external-still-job-command"),
  ).toContainText("node tools\\render-capture-still-job.mjs");

  await resetCaptureDirectorEvents(page);
  await page.evaluate(() => {
    delete window.__captureDirectorCapabilitiesOverride;
    delete window.showSaveFilePicker;
  });
  await page
    .getByTestId("capture-render-resolution-select")
    .selectOption("preview-1080");
  await openScreenCaptureOptions(page);
  await page.getByTestId("capture-screen-type-select").selectOption("png");
  await expect(page.getByTestId("capture-screen-quality-input")).toBeDisabled();
  await expect(page.getByTestId("capture-screen-capture-run")).toBeEnabled();
  await expectNoCaptureDirectorPageErrors(diagnostics);
});
