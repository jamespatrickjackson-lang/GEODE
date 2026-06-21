import { expect, test } from "@playwright/test";

import {
  addCameraView,
  captureDirectorEvents,
  dispatchCaptureDirectorButton,
  ensureCameraPathOpen,
  expandCaptureSection,
  expectNoCaptureDirectorPageErrors,
  loadCaptureDirector,
  openCaptureDirector,
  openScreenCaptureOptions,
  resetCaptureDirectorEvents,
} from "./capture-director-helpers";

// The new capture formats/flows (EXR / 16-bit PNG / log stills, scroll record,
// path video) are heavy and partly GPU-feature dependent. Under headless software
// GL the float readback (HalfFloat -> FLOAT) and the per-frame renders may not run
// to completion, so these assert a GRACEFUL terminal state (saved OR a clean error,
// never a wedge), tolerant of headless limits — mirroring the realtime suite.
test.setTimeout(180_000);

async function selectStillType(page: import("@playwright/test").Page, type: string) {
  await openScreenCaptureOptions(page);
  await page
    .getByTestId("capture-still-resolution-select")
    .selectOption("preview-1080");
  await page.getByTestId("capture-screen-type-select").selectOption(type);
}

// Drive a still capture and resolve when it reaches a terminal state: a written
// blob, or a surfaced capture error. The poll itself is the no-wedge proof — a
// wedged capture would never reach either and the poll would time out. (The run
// button lives in the options popout, which closes on run, so it is not a stable
// post-capture signal.)
async function captureStillTerminal(
  page: import("@playwright/test").Page,
): Promise<"saved" | "error"> {
  await resetCaptureDirectorEvents(page);
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
  let outcome: "saved" | "error" = "error";
  await expect
    .poll(
      async () => {
        const events = await captureDirectorEvents(page);
        const saved = events.some(
          (event) =>
            event.kind === "save-file-write" &&
            typeof event.bytes === "number" &&
            event.bytes > 0,
        );
        if (saved) {
          outcome = "saved";
          return true;
        }
        if ((await page.getByTestId("capture-error").count()) > 0) {
          outcome = "error";
          return true;
        }
        return false;
      },
      { timeout: 90_000 },
    )
    .toBe(true);
  return outcome;
}

test("EXR / 16-bit PNG / log stills reach a terminal state without wedging", async ({
  page,
}) => {
  await loadCaptureDirector(page);
  await openCaptureDirector(page);

  // 16-bit PNG (linear), then with log encoding, then EXR.
  await selectStillType(page, "png16");
  // Supersample is disabled for float types (A2 — native resolution).
  await expect(
    page.getByTestId("capture-still-supersample-select"),
  ).toBeDisabled();
  await captureStillTerminal(page);

  await selectStillType(page, "png16");
  const logToggle = page.getByTestId("capture-screen-log-transfer");
  await expect(logToggle).toBeVisible();
  await logToggle.check();
  await captureStillTerminal(page);

  // EXR: the EXRExporter ZIP encode is heavy (~14s on a real GPU, far slower under
  // headless software GL), so assert the float path ENGAGES (status -> Rendering)
  // rather than wait for the encode to finish. Terminal EXR completion is verified
  // live in the receipt.
  await selectStillType(page, "exr");
  await resetCaptureDirectorEvents(page);
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
  await expect(page.getByTestId("capture-still-panel")).toContainText("Rendering", {
    timeout: 30_000,
  });
});

test("8K 16-bit PNG engages a render/terminal path without wedging", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await openScreenCaptureOptions(page);
  await page.getByTestId("capture-still-resolution-select").selectOption("render-8k");
  await page.getByTestId("capture-screen-type-select").selectOption("png16");
  await resetCaptureDirectorEvents(page);
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
  // 8K float is heavy (530 MB readback) and may render, OOM-guard to a clean error,
  // or route to the external job — any is a non-wedged terminal/started path. (The
  // device-limited external-fallback route is covered by render-still.spec.)
  await expect
    .poll(
      async () => {
        const events = await captureDirectorEvents(page);
        const saved = events.some((e) => e.kind === "save-file-write");
        const rendering = await page
          .getByTestId("capture-still-panel")
          .textContent();
        const errored = (await page.getByTestId("capture-error").count()) > 0;
        const external =
          (await page.getByTestId("capture-external-still-job-download").count()) > 0;
        return (
          saved || errored || external || /Rendering/i.test(rendering ?? "")
        );
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

// Author a minimal 2-node camera path (two distinct poses) so the scroll/path
// renders have a valid camera spine.
async function authorTwoNodePath(page: import("@playwright/test").Page) {
  await ensureCameraPathOpen(page);
  await addCameraView(page);
  await page.evaluate(() => {
    const scene = (window as unknown as { __scene?: { camera: { position: { set: (x: number, y: number, z: number) => void; x: number; y: number; z: number } }; controls: { update: () => void } } }).__scene;
    if (scene) {
      const c = scene.camera.position;
      scene.camera.position.set(c.x * 0.6 + 1200, c.y * 0.6 + 1600, c.z * 0.6 + 1200);
      scene.controls.update();
    }
  });
  await addCameraView(page);
}

test("scroll record triggers the in-browser render (Accept and Render)", async ({
  page,
}) => {
  await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await authorTwoNodePath(page);

  await expandCaptureSection(page, "capture-scroll-header");
  if ((await page.getByTestId("capture-scroll-record-popout-shell").count()) === 0) {
    await dispatchCaptureDirectorButton(page, "capture-scroll-record", /Record/);
  }
  await page.getByTestId("capture-scroll-quality-select").selectOption("1440p");
  const pngSeq = page.getByTestId("capture-scroll-format-png-sequence");
  if (!(await pngSeq.isChecked())) await pngSeq.check();

  await dispatchCaptureDirectorButton(
    page,
    "capture-scroll-accept-render",
    /Accept and Render/,
  );

  // The corrected trigger starts the in-browser frame render (or surfaces a
  // validation error) — never silently stuck at "Ready 0/120".
  await expect
    .poll(
      async () => {
        const progress = await page
          .getByTestId("capture-scroll-render-progress-label")
          .textContent();
        const errors = await page
          .getByTestId("capture-scroll-record-validation-errors")
          .count();
        return /Rendering scroll package/i.test(progress ?? "") || errors > 0;
      },
      { timeout: 60_000 },
    )
    .toBe(true);
});

test("path video render reaches a terminal state without wedging", async ({
  page,
}) => {
  await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await authorTwoNodePath(page);

  await dispatchCaptureDirectorButton(
    page,
    "capture-path-record-start",
    /Record Path/,
  );
  await expect
    .poll(
      async () => {
        const status = await page
          .getByTestId("capture-path-render-status")
          .textContent();
        return /Rendering|Encoding|Rendered|External|Fallback|failed|cancelled/i.test(
          status ?? "",
        );
      },
      { timeout: 60_000 },
    )
    .toBe(true);
});
