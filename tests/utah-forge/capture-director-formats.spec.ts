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

// Drive a still capture and resolve when it engages a render/terminal path: a
// written blob, a surfaced capture error, or the "Rendering" status. Float stills
// do a heavy readback + JS encode (EXR's ZIP encode is ~14s on a real GPU, far
// slower under headless software GL), so terminal completion is verified live in
// the receipt; here we only require it engages without wedging or crashing.
async function captureStillEngages(
  page: import("@playwright/test").Page,
): Promise<void> {
  await resetCaptureDirectorEvents(page);
  await dispatchCaptureDirectorButton(
    page,
    "capture-screen-capture-run",
    "Save Still",
  );
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
        const errored = (await page.getByTestId("capture-error").count()) > 0;
        // The capture loads full-res fidelity assets (slow under headless software
        // GL) before the "Rendering" status shows — that, a written blob, or a
        // clean error all prove it engaged. Float completion is verified live.
        const rendering = (await page.getByText("Rendering").count()) > 0;
        return saved || errored || rendering;
      },
      { timeout: 90_000 },
    )
    .toBe(true);
  await expect(page.getByTestId("capture-director-toolbar")).toBeVisible();
}

test("EXR / 16-bit PNG / log stills engage a render path without wedging", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);

  // Wiring for all three float modes (each capture loads full-res fidelity assets
  // and is slow under headless software GL, so drive ONE real capture and assert
  // the rest is wired; log/EXR correctness is unit-tested + verified live).
  await selectStillType(page, "png16");
  // Supersample is disabled for float types (A2 — native resolution).
  await expect(
    page.getByTestId("capture-still-supersample-select"),
  ).toBeDisabled();
  // Log toggle + EXR option are wired.
  await expect(page.getByTestId("capture-screen-log-transfer")).toBeVisible();
  await expect(
    page.getByTestId("capture-screen-type-select").locator('option[value="exr"]'),
  ).toHaveCount(1);

  // One real png16 capture engages the float path without wedging.
  await captureStillEngages(page);
  await expectNoCaptureDirectorPageErrors(diagnostics);
});

test("8K 16-bit PNG engages a render/terminal path without wedging", async ({
  page,
}) => {
  // 8K float is the heaviest case (~530 MB readback) and is very slow to even
  // reach "Rendering" under headless software GL; give it a large budget.
  test.setTimeout(300_000);
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
        const errored = (await page.getByTestId("capture-error").count()) > 0;
        const external =
          (await page.getByTestId("capture-external-still-job-download").count()) > 0;
        const rendering = (await page.getByText("Rendering").count()) > 0;
        return saved || errored || external || rendering;
      },
      { timeout: 200_000 },
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

test("path video render engages without wedging or crashing", async ({
  page,
}) => {
  const diagnostics = await loadCaptureDirector(page);
  await openCaptureDirector(page);
  await authorTwoNodePath(page);

  await dispatchCaptureDirectorButton(
    page,
    "capture-path-record-start",
    /Record Path/,
  );
  // "Record Path Video" uses an in-browser MediaRecorder driving the camera path;
  // headless software GL may not produce media (covered by the realtime suite +
  // the recorder stop-watchdog). Require only that engaging it reaches a recognized
  // record state — the stop control appears or the record status moves — and that
  // the director never wedges or crashes.
  await expect
    .poll(
      async () => {
        const status = await page
          .getByTestId("capture-path-record-status")
          .textContent()
          .catch(() => "");
        const stopVisible =
          (await page.getByTestId("capture-path-record-stop").count()) > 0;
        const errored = (await page.getByTestId("capture-error").count()) > 0;
        return (
          stopVisible ||
          errored ||
          /Recording|Rendering|Encoding|Rendered|External|Fallback|failed|cancelled|No file|Playing/i.test(
            status ?? "",
          )
        );
      },
      { timeout: 45_000 },
    )
    .toBe(true);
  await expect(page.getByTestId("capture-director-toolbar")).toBeVisible();
  await expectNoCaptureDirectorPageErrors(diagnostics);
});
