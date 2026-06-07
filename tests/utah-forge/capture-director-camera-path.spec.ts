import { expect, test } from "@playwright/test";
import {
  cameraPathOverlayState,
  clickPathControlIfEnabled,
  closeCaptureDirector,
  dispatchCaptureDirectorButton,
  ensureCameraPathOpen,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  mediaRecordingStarted,
  openCaptureDirector,
  resetCaptureDirectorEvents,
  setRangeInputValue,
} from "./capture-director-helpers";

test.setTimeout(180_000);

test("Capture Director camera path rows can play, scrub, and lock focus", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await ensureCameraPathOpen(page);

  const pathRows = page.getByTestId("capture-path-row");
  const pathTransitions = page.getByTestId("capture-path-transition");
  await expect(pathRows).toHaveCount(0);
  await expect(pathTransitions).toHaveCount(0);
  await expect(page.getByTestId("capture-path-play")).toBeDisabled();
  await expect(page.getByTestId("capture-path-record-start")).toBeDisabled();
  await expect(page.getByTestId("capture-path-playback-warning")).toContainText(
    /at least two active camera views/i,
  );
  await resetCaptureDirectorEvents(page);
  expect(await clickPathControlIfEnabled(page, "capture-path-play")).toBe(false);
  expect(await mediaRecordingStarted(page)).toBe(false);

  await expect(page.getByTestId("capture-timeline-bar")).toBeVisible();
  const timelineScrubber = page.getByTestId("capture-timeline-scrubber");
  await expect(timelineScrubber).toBeVisible();
  await expect(page.getByTestId("capture-timeline-ruler")).toBeVisible();
  await expect(page.getByTestId("capture-timeline-playhead")).toBeVisible();
  await expect(page.getByTestId("capture-timeline-timecode")).toContainText(
    "0:00",
  );
  await expect(page.getByTestId("capture-path-options-panel")).toBeVisible();
  await setRangeInputValue(page.getByTestId("capture-path-track-color"), "#00ff88");
  await setRangeInputValue(page.getByTestId("capture-path-line-size"), "8");
  await page
    .getByTestId("capture-path-preview-monitor-mode")
    .selectOption("scrub-time");

  await resetCaptureDirectorEvents(page);
  await dispatchCaptureDirectorButton(
    page,
    "capture-keyframe-add",
    "Add Current Camera",
  );
  await expect(pathRows).toHaveCount(1);
  await expect(pathRows.nth(0)).toHaveAttribute("data-node-id", /.+/);
  await expect(
    pathRows.nth(0).getByTestId("capture-path-row-number"),
  ).toContainText("01");
  await expect(page.getByTestId("capture-path-play")).toBeDisabled();

  await dispatchCaptureDirectorButton(
    page,
    "capture-keyframe-add",
    "Add Current Camera",
  );
  await expect(pathRows).toHaveCount(2);
  await expect(pathTransitions).toHaveCount(1);
  await expect(
    pathRows.nth(1).getByTestId("capture-path-row-number"),
  ).toContainText("02");
  await expect(pathTransitions.first()).toHaveAttribute("data-segment-id", /.+/);
  await expect(
    pathTransitions.first().getByTestId("capture-path-transition-label"),
  ).toContainText(/01.*02/);
  await expect(page.getByTestId("capture-path-play")).toBeEnabled();
  await expect(page.getByTestId("capture-path-record-start")).toBeEnabled();

  const firstNodeId = (await pathRows.nth(0).getAttribute("data-node-id")) ?? "";
  const secondNodeId = (await pathRows.nth(1).getAttribute("data-node-id")) ?? "";
  const segmentId =
    (await pathTransitions.first().getAttribute("data-segment-id")) ?? "";
  expect(firstNodeId).toBeTruthy();
  expect(secondNodeId).toBeTruthy();
  expect(segmentId).toBeTruthy();

  await pathRows.nth(1).getByTestId("capture-path-row-number").click();
  await expect(
    page.getByText(`Selected keyframe ${secondNodeId}`),
  ).toBeVisible();
  await page
    .getByTestId("capture-path-transition-duration")
    .first()
    .fill("3.5");
  await expect(
    page.getByTestId("capture-path-transition-duration").first(),
  ).toHaveValue("3.5");
  await expect(
    page.getByTestId("capture-timeline-transition-block").first(),
  ).toHaveAttribute("data-block-id", `transition:${segmentId}`);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("capture-timeline-scrubber").getAttribute("max")),
    )
    .toBeGreaterThan(3.4);

  await pathRows.nth(1).getByTestId("capture-path-row-hidden").setChecked(false);
  await expect(
    pathRows.nth(1).getByTestId("capture-path-row-hidden"),
  ).not.toBeChecked();
  await expect
    .poll(async () => {
      const state = await cameraPathOverlayState(page);
      return (
        state.visible &&
        state.keyframeIds.includes(firstNodeId) &&
        !state.keyframeIds.includes(secondNodeId)
      );
    })
    .toBe(true);
  await pathRows.nth(1).getByTestId("capture-path-row-hidden").setChecked(true);
  await expect(pathRows.nth(1).getByTestId("capture-path-row-hidden")).toBeChecked();
  await expect
    .poll(async () => {
      const state = await cameraPathOverlayState(page);
      return (
        state.visible &&
        state.keyframeIds.includes(firstNodeId) &&
        state.keyframeIds.includes(secondNodeId) &&
        state.segmentIds.includes(segmentId)
      );
    })
    .toBe(true);

  await setRangeInputValue(timelineScrubber, "0.2");
  await expect(page.getByTestId("capture-path-preview-monitor")).toBeVisible();
  await pathRows.nth(0).getByTestId("capture-path-row-number").click();
  await expect(
    page.getByText(`Selected keyframe ${firstNodeId}`),
  ).toBeVisible();
  await dispatchCaptureDirectorButton(
    page,
    "capture-path-focus-binding",
    "Pick Focus",
  );
  await page
    .getByTestId("capture-path-look-mode")
    .selectOption("focus-point-lock");
  await expect(
    pathRows.nth(0).getByTestId("capture-path-focus-point"),
  ).toContainText(`focus-${firstNodeId}`);
  await expect(page.getByTestId("capture-path-look-mode")).toHaveValue(
    "focus-point-lock",
  );
  await expect(page.getByTestId("capture-timeline-focus-marker")).toHaveCount(1);
  await expect(page.getByTestId("capture-path-preview-monitor")).toContainText(
    "focus locked",
  );

  await setRangeInputValue(timelineScrubber, "0");
  const scrubBeforePlay = Number(await timelineScrubber.inputValue());
  await dispatchCaptureDirectorButton(page, "capture-path-play", "Play Path");
  await expect
    .poll(async () => Number(await timelineScrubber.inputValue()), {
      timeout: 5_000,
    })
    .toBeGreaterThan(scrubBeforePlay);
  await dispatchCaptureDirectorButton(page, "capture-path-pause", "Pause");
  await setRangeInputValue(timelineScrubber, "0.1");
  await expect(page.getByTestId("capture-path-preview-monitor")).toBeVisible();

  await resetCaptureDirectorEvents(page);
  await dispatchCaptureDirectorButton(
    page,
    "capture-path-record-start",
    "Record Path Video",
  );
  await expect.poll(() => mediaRecordingStarted(page)).toBe(true);
  await expect(page.getByTestId("capture-path-video-download")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("capture-path-record-status")).toContainText(
    "Path video ready",
  );

  await closeCaptureDirector(page);
  await expect(page.getByTestId("capture-path-preview-monitor")).toHaveCount(0);
  await expect
    .poll(async () => {
      const state = await cameraPathOverlayState(page);
      return !state.visible && state.childCount === 0;
    })
    .toBe(true);
  await expectNoCaptureDirectorPageErrors(diagnostics);
});
