import { expect, test } from "@playwright/test";
import {
  cameraPathOverlayState,
  captureDirectorEvents,
  closeCaptureDirector,
  dispatchCaptureDirectorButton,
  ensureCameraPathOpen,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
  resetCaptureDirectorEvents,
  setRangeInputValue,
} from "./capture-director-helpers";

test.setTimeout(180_000);

test("Capture Director Camera Path V3 surfacing controls drive timeline and overlay metadata", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await ensureCameraPathOpen(page);

  await dispatchCaptureDirectorButton(
    page,
    "capture-keyframe-add",
    "Add Current Camera",
  );
  await dispatchCaptureDirectorButton(
    page,
    "capture-keyframe-add",
    "Add Current Camera",
  );
  await dispatchCaptureDirectorButton(
    page,
    "capture-keyframe-add",
    "Add Current Camera",
  );

  const rows = page.getByTestId("capture-path-row");
  const transitions = page.getByTestId("capture-path-transition");
  await expect(rows).toHaveCount(3);
  await expect(transitions).toHaveCount(2);

  const firstTransition = transitions.first();
  await firstTransition.click();
  await firstTransition
    .getByTestId("capture-path-time-curve")
    .selectOption("ease-in-out");
  await firstTransition
    .getByTestId("capture-path-continuity")
    .selectOption("G2");
  await firstTransition.getByTestId("capture-path-tension").fill("0.35");
  await firstTransition.getByTestId("capture-path-bias").fill("0");
  await firstTransition.getByTestId("capture-path-auto-handles").setChecked(false);
  await firstTransition.getByTestId("capture-path-gd-out").fill("1.25");
  await firstTransition.getByTestId("capture-path-gd-in").fill("1.5");
  await firstTransition
    .getByTestId("capture-path-lens-mode")
    .selectOption("maintain-focus-size");
  await firstTransition.getByTestId("capture-path-dolly-strength").fill("0.45");

  await page.getByTestId("capture-path-show-equations").setChecked(true);
  await page.getByTestId("capture-path-equations-selected-only").setChecked(true);
  await page.getByTestId("capture-path-show-stack-labels").setChecked(true);
  await page.getByTestId("capture-path-show-temporal-ramp").setChecked(true);
  await page.getByTestId("capture-path-show-tangents").setChecked(true);
  await page.getByTestId("capture-path-show-influence-handles").setChecked(true);
  await page.getByTestId("capture-path-show-curvature-comb").setChecked(true);
  await page.getByTestId("capture-path-show-focus-distance").setChecked(true);
  await page
    .getByTestId("capture-path-preview-monitor-mode")
    .selectOption("scrub-time");
  await firstTransition.getByTestId("capture-path-equation-selected").setChecked(true);

  await expect(
    page.getByTestId("capture-timeline-continuity-marker").first(),
  ).toContainText("G2");
  await expect(page.getByTestId("capture-timeline-equation-marker")).toHaveCount(1);
  await expect(page.getByTestId("capture-timeline-gd-zone").first()).toBeVisible();
  await expect(page.getByTestId("capture-timeline-aim-marker").first()).toBeVisible();

  await resetCaptureDirectorEvents(page);
  await setRangeInputValue(page.getByTestId("capture-timeline-scrubber"), "0.4");
  await expect(page.getByTestId("capture-path-preview-monitor")).toBeVisible();
  await expect
    .poll(async () => {
      const events = await captureDirectorEvents(page);
      return events.some(
        (event) =>
          event.kind === "camera-path-overlay" &&
          Array.isArray(event.equationLabels) &&
          event.equationLabels.some((label) =>
            typeof label === "string" && label.includes("A/T/D/G/Gd"),
          ),
      );
    })
    .toBe(true);

  await expect
    .poll(async () => {
      const state = await cameraPathOverlayState(page);
      return state.visible && state.segmentIds.length > 0;
    })
    .toBe(true);

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
