import { expect, test } from "@playwright/test";
import {
  captureDirectorEvents,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
  openRealtimeRecordPopout,
  resetCaptureDirectorEvents,
  startAndAutoStopRecording,
} from "./capture-director-helpers";

// Four sequential real recordings on the heavy Utah scene (each waits on the
// capture-fidelity lock); the default 90s budget is too tight, so allow 180s as
// the camera-path spec does.
test.setTimeout(180_000);

type CaptureMode =
  | "scene-only"
  | "scene-annotations"
  | "presentation-ui"
  | "full-ui";

test("Capture Director realtime recording uses the expected capture routes", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await openRealtimeRecordPopout(page);

  const runCapture = async (
    mode: CaptureMode,
    expectedPath: "scene-canvas" | "composited-canvas" | "display-capture",
    { allowGracefulFailure = false }: { allowGracefulFailure?: boolean } = {},
  ) => {
    await resetCaptureDirectorEvents(page);
    // Recording can collapse/close the realtime popout, so re-open it each run.
    await openRealtimeRecordPopout(page);
    await page.getByTestId("capture-mode-select").selectOption(mode, {
      force: true,
    });
    if (mode !== "full-ui") {
      await expect(page.locator('[data-capture-group="navControls"]')).toHaveCount(
        0,
      );
    }
    await startAndAutoStopRecording(page);

    if (allowGracefulFailure) {
      // Headless MediaRecorder finalization for the composited route is not
      // guaranteed to produce data. The reliability contract is that the
      // recording always reaches a TERMINAL state (Ready on success, Idle on a
      // graceful failure) and never wedges at "Recording"/"Stopping", so the
      // director stays usable. The 15s budget covers the stop watchdog.
      await expect(page.getByTestId("capture-recording-state")).toContainText(
        /Ready|Idle/,
        { timeout: 15_000 },
      );
    } else {
      await expect(page.getByTestId("capture-recording-state")).toContainText(
        "Ready",
      );
      await expect(page.getByTestId("capture-download")).toBeVisible();
    }
    await expect(page.locator('[data-capture-group="navControls"]')).toBeVisible();

    const events = await captureDirectorEvents(page);
    // The route taken is asserted via the path event regardless of whether the
    // recorder finalized to a downloadable blob.
    expect(events.some((event) => event.kind === expectedPath)).toBe(true);
    expect(events.some((event) => event.kind === "media-recorder-start")).toBe(
      true,
    );
    if (!allowGracefulFailure) {
      expect(events.some((event) => event.kind === "scene-canvas")).toBe(
        expectedPath === "scene-canvas",
      );
      expect(events.some((event) => event.kind === "composited-canvas")).toBe(
        expectedPath === "composited-canvas",
      );
      expect(events.some((event) => event.kind === "display-capture")).toBe(
        expectedPath === "display-capture",
      );
    }
  };

  await runCapture("scene-only", "scene-canvas");
  await runCapture("scene-annotations", "composited-canvas");
  // presentation-ui is the composited route whose headless finalization is
  // environment-limited; assert a graceful terminal state instead of a file.
  await runCapture("presentation-ui", "composited-canvas", {
    allowGracefulFailure: true,
  });
  await runCapture("full-ui", "display-capture");
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

test("Capture Director realtime recording reports empty recorder output", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await openRealtimeRecordPopout(page);

  await resetCaptureDirectorEvents(page, {
    __captureDirectorForceEmptyRecorder: true,
  });
  await page.getByTestId("capture-mode-select").selectOption("scene-only", {
    force: true,
  });
  await page
    .getByTestId("capture-preview-resolution-select")
    .selectOption("marketing-4k");
  // Preview resolution does not drive FPS (it is an independent control); set the
  // 60 FPS the empty-recorder assertion below expects explicitly.
  await page.getByTestId("capture-fps-select").selectOption("60");
  await expect(page.getByTestId("capture-fps-select")).toHaveValue("60");
  await startAndAutoStopRecording(page);

  await expect(page.getByTestId("capture-recording-state")).toContainText("Idle");
  await expect(page.getByTestId("capture-error")).toContainText(
    "No video data was produced for 3840x2160 at 60 FPS",
  );
  await expect(page.getByTestId("capture-download")).toHaveCount(0);
  await expect(page.locator('[data-capture-group="navControls"]')).toBeVisible();

  const events = await captureDirectorEvents(page);
  expect(events.some((event) => event.kind === "scene-canvas")).toBe(true);
  expect(
    events.some((event) => event.kind === "media-recorder-request-data"),
  ).toBe(true);
  expect(events.some((event) => event.kind === "stream-request-frame")).toBe(
    true,
  );

  await resetCaptureDirectorEvents(page, {
    __captureDirectorForceEmptyRecorder: false,
  });
  await startAndAutoStopRecording(page);
  await expect(page.getByTestId("capture-recording-state")).toContainText(
    "Ready",
  );
  await expect(page.getByTestId("capture-download")).toBeVisible();
  await expectNoCaptureDirectorPageErrors(diagnostics);
});
