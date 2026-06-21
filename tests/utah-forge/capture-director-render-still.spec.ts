import { expect, test } from "@playwright/test";
import {
  captureDirectorEvents,
  dispatchCaptureDirectorButton,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
  openRealtimeRecordPopout,
  openScreenCaptureOptions,
  openVideoRecordPopout,
  resetCaptureDirectorEvents,
} from "./capture-director-helpers";

test("Capture Director render settings expose page-range export controls", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await openRealtimeRecordPopout(page);
  await openVideoRecordPopout(page);

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
  // Page-agnostic: the page-range controls must populate from the live deck, but
  // the exact option count is deck state (the deck may hold a single page). The
  // rest of this test uses options[0] for both start and end, so >= 1 is the
  // app-behavior assertion (page-to-page false-fix ban).
  expect(pageRangeOptions.length).toBeGreaterThanOrEqual(1);
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

  // Optional supersample + capture grade selectors (DEC-176/178).
  await page.getByTestId("capture-render-supersample-select").selectOption("2");
  await expect(
    page.getByTestId("capture-render-supersample-select"),
  ).toHaveValue("2");
  await page.getByTestId("capture-render-grade-mode-select").selectOption("baked");
  await expect(
    page.getByTestId("capture-render-grade-mode-select"),
  ).toHaveValue("baked");
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

test("Capture Director still capture saves preview output", async ({
  page,
}) => {
  // Headless software GL renders the full-fidelity still slowly; give the whole
  // test room beyond the default budget.
  test.setTimeout(90_000);
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);

  // Still capture is driven entirely from the Still Capture popout (its own
  // resolution select), not the Video Capture render resolution. Save at the
  // default grade/supersample so the output stays at the 1920x1080 target.
  await resetCaptureDirectorEvents(page);
  await openScreenCaptureOptions(page);
  await page
    .getByTestId("capture-still-resolution-select")
    .selectOption("preview-1080");
  await page.getByTestId("capture-screen-type-select").selectOption("webp");
  await page.getByTestId("capture-screen-quality-input").fill("0.74");
  await expect(page.getByTestId("capture-screen-capture-run")).toBeEnabled();
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
  // The still loads full-resolution capture-fidelity assets (incl. the heavier
  // Lanczos NAIP basemap) before encoding; under headless software GL this can
  // take well over the default poll window, so allow 30s (verified ~3s on a real
  // GPU).
  await expect
    .poll(
      async () => {
        const events = await captureDirectorEvents(page);
        return events.some(
          (event) =>
            event.kind === "canvas-to-blob" &&
            event.width === 1920 &&
            event.height === 1080 &&
            event.type === "image/webp",
        );
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        const events = await captureDirectorEvents(page);
        return events.some(
          (event) =>
            event.kind === "save-file-write" &&
            typeof event.bytes === "number" &&
            event.bytes > 0 &&
            event.type === "image/webp",
        );
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(page.getByTestId("capture-error")).toHaveCount(0);
  await expect(page.getByTestId("capture-external-still-job-download")).toHaveCount(
    0,
  );
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

test("Capture Director still capture exposes resolution, supersample, and grade controls", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);

  // Selector presence/value checks in a fresh popout (no save, so the optional
  // supersample / capture grade settings — DEC-176/178 — don't alter an output).
  await resetCaptureDirectorEvents(page);
  await openScreenCaptureOptions(page);
  await page
    .getByTestId("capture-still-resolution-select")
    .selectOption("preview-1080");
  await page.getByTestId("capture-screen-type-select").selectOption("png");
  await expect(page.getByTestId("capture-screen-quality-input")).toBeDisabled();
  await page.getByTestId("capture-still-supersample-select").selectOption("2");
  await expect(
    page.getByTestId("capture-still-supersample-select"),
  ).toHaveValue("2");
  await page.getByTestId("capture-still-grade-mode-select").selectOption("clean");
  await expect(
    page.getByTestId("capture-still-grade-mode-select"),
  ).toHaveValue("clean");
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

// An 8K still on a GPU-limited device (maxTextureSize 4096) must route to an
// external still job. The provider preflight now rejects the size and publishes
// the external job BEFORE any in-browser render, so the fallback surfaces
// deterministically without churning/hanging the main thread. The bounded
// timeout on the job-download assertion is the anti-wedge proof.
test(
  "Capture Director still capture falls back to an external job at 8K",
  async ({ page }) => {
    await loadCaptureDirector(page);
    await openCaptureDirector(page);
    await resetCaptureDirectorEvents(page, {
      __captureDirectorCapabilitiesOverride: {
        maxTextureSize: 4096,
        maxRenderbufferSize: 4096,
      },
    });
    await openScreenCaptureOptions(page);
    await page
      .getByTestId("capture-still-resolution-select")
      .selectOption("render-8k");
    await page.getByTestId("capture-screen-type-select").selectOption("png");
    await expect(page.getByTestId("capture-screen-capture-run")).toBeEnabled();
    await dispatchCaptureDirectorButton(
      page,
      "capture-screen-capture-run",
      "Save Still",
    );
    await expect(page.getByTestId("capture-screen-download")).toHaveCount(0);
    // Surfaces promptly (no doomed in-browser render): bound the wait so a
    // regression that re-introduces the main-thread churn fails here.
    await expect(
      page.getByTestId("capture-external-still-job-download"),
    ).toHaveAttribute(
      "download",
      /utah-forge-.*-8k-external-still-\d{8}T\d{6}Z\.json/,
      { timeout: 10_000 },
    );
    await expect(
      page.getByTestId("capture-external-still-job-command"),
    ).toContainText("node tools\\render-capture-still-job.mjs");
  },
);
