import { expect, type Locator, type Page } from "@playwright/test";

type CaptureDirectorEvent = Record<string, unknown> & { kind?: string };

export type CaptureDirectorDiagnostics = {
  consoleMessages: string[];
  pageErrors: string[];
};

declare global {
  interface Window {
    __captureDirectorEvents?: CaptureDirectorEvent[];
    __captureDirectorFfmpegModule?: unknown;
    __captureDirectorDeterministicDurationSeconds?: number;
    __captureDirectorForceEmptyRecorder?: boolean;
    __captureDirectorCapabilitiesOverride?: {
      maxTextureSize?: number;
      maxRenderbufferSize?: number;
    };
    showSaveFilePicker?: (options?: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (blob: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  }
}

export function attachCaptureDirectorDiagnostics(
  page: Page,
): CaptureDirectorDiagnostics {
  const diagnostics: CaptureDirectorDiagnostics = {
    consoleMessages: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    const location = message.location();
    diagnostics.consoleMessages.push(
      `${message.type()}: ${message.text()} (${location.url}:${location.lineNumber})`,
    );
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(error.stack ?? error.message);
  });

  return diagnostics;
}

function diagnosticSuffix(diagnostics?: CaptureDirectorDiagnostics): string {
  if (!diagnostics) return "";
  const consoleTail = diagnostics.consoleMessages.slice(-8).join("\n");
  const errorTail = diagnostics.pageErrors.slice(-8).join("\n");
  return [
    errorTail ? `Recent page errors:\n${errorTail}` : "",
    consoleTail ? `Recent console messages:\n${consoleTail}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function installCaptureDirectorMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__captureDirectorEvents = [];
    window.__captureDirectorDeterministicDurationSeconds = 0.04;

    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported(type: string) {
        return [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
        ].includes(type);
      }

      mimeType: string;
      state: "inactive" | "recording" = "inactive";

      constructor(_stream: unknown, options: { mimeType?: string } = {}) {
        super();
        this.mimeType = options.mimeType ?? "video/webm";
        window.__captureDirectorEvents?.push({
          kind: "media-recorder",
          mimeType: this.mimeType,
        });
      }

      start() {
        this.state = "recording";
        window.__captureDirectorEvents?.push({ kind: "media-recorder-start" });
      }

      requestData() {
        window.__captureDirectorEvents?.push({
          kind: "media-recorder-request-data",
        });
        this.dispatchData();
      }

      stop() {
        // Real MediaRecorder emits a final dataavailable only on the active->
        // inactive transition, but a repeat stop() must still resolve any
        // pending stop awaiter. Always emit "stop" (idempotent: the app's
        // recorder attaches it `once` and guards completion), and only emit the
        // final dataavailable when transitioning out of the recording state.
        const wasActive = this.state !== "inactive";
        this.state = "inactive";
        if (wasActive) this.dispatchData();
        window.setTimeout(() => {
          this.dispatchEvent(new Event("stop"));
        }, 0);
      }

      private dispatchData() {
        const blob = new Blob(
          window.__captureDirectorForceEmptyRecorder
            ? []
            : ["capture-director-smoke"],
          { type: this.mimeType },
        );
        const dataEvent = new Event("dataavailable");
        Object.defineProperty(dataEvent, "data", { value: blob });
        this.dispatchEvent(dataEvent);
      }
    }

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });

    HTMLCanvasElement.prototype.captureStream = function captureStream(
      fps?: number,
    ) {
      window.__captureDirectorEvents?.push({
        kind:
          this.dataset.captureCompositedCanvas === "true"
            ? "composited-canvas"
            : "scene-canvas",
        fps,
        width: this.width,
        height: this.height,
      });
      let requestFrameLogged = false;
      const track = {
        requestFrame: () => {
          if (!requestFrameLogged) {
            requestFrameLogged = true;
            window.__captureDirectorEvents?.push({
              kind: "stream-request-frame",
            });
          }
        },
        stop: () => {
          window.__captureDirectorEvents?.push({ kind: "stream-track-stop" });
        },
      };
      return {
        getTracks: () => [track],
        getVideoTracks: () => [track],
      } as unknown as MediaStream;
    };

    HTMLCanvasElement.prototype.toBlob = function toBlob(
      callback: BlobCallback,
      type?: string,
    ) {
      window.__captureDirectorEvents?.push({
        kind: "canvas-to-blob",
        width: this.width,
        height: this.height,
        type,
      });
      callback(new Blob(["screen-capture"], { type: type ?? "image/png" }));
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getDisplayMedia: async () => {
          window.__captureDirectorEvents?.push({ kind: "display-capture" });
          return {
            getTracks: () => [
              {
                stop: () => {
                  window.__captureDirectorEvents?.push({
                    kind: "display-track-stop",
                  });
                },
              },
            ],
          } as unknown as MediaStream;
        },
      },
    });

    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async (options?: unknown) => {
        window.__captureDirectorEvents?.push({
          kind: "show-save-file-picker",
          options,
        });
        return {
          createWritable: async () => ({
            write: async (blob: Blob) => {
              window.__captureDirectorEvents?.push({
                kind: "save-file-write",
                bytes: blob.size,
                type: blob.type,
              });
            },
            close: async () => {
              window.__captureDirectorEvents?.push({
                kind: "save-file-close",
              });
            },
          }),
        };
      },
    });

    class FakeFFmpeg {
      files = new Map<string, Uint8Array>();

      async load(options?: unknown) {
        window.__captureDirectorEvents?.push({ kind: "ffmpeg-load", options });
      }

      async writeFile(path: string, data: Uint8Array) {
        window.__captureDirectorEvents?.push({
          kind: "ffmpeg-write",
          path,
          bytes: data.byteLength,
        });
        this.files.set(path, data);
      }

      async exec(args: string[]) {
        window.__captureDirectorEvents?.push({
          kind: "ffmpeg-exec",
          args,
        });
        const outputPath = args[args.length - 1];
        this.files.set(outputPath, new Uint8Array([1, 2, 3, 4]));
        return 0;
      }

      async readFile(path: string) {
        window.__captureDirectorEvents?.push({ kind: "ffmpeg-read", path });
        return this.files.get(path) ?? new Uint8Array([9, 9, 9]);
      }

      async deleteFile(path: string) {
        window.__captureDirectorEvents?.push({ kind: "ffmpeg-delete", path });
        this.files.delete(path);
      }

      terminate() {
        window.__captureDirectorEvents?.push({ kind: "ffmpeg-terminate" });
      }
    }

    window.__captureDirectorFfmpegModule = {
      FFmpeg: FakeFFmpeg,
    };
  });
}

export async function waitForCaptureDirectorReady(
  page: Page,
  diagnostics?: CaptureDirectorDiagnostics,
): Promise<void> {
  try {
    await Promise.all([
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("canvas")).some((canvas) => {
            const rect = canvas.getBoundingClientRect();
            const style = window.getComputedStyle(canvas);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          }),
        { timeout: 60_000 },
      ),
      expect(page.getByTestId("capture-director-launcher")).toBeVisible({
        timeout: 60_000,
      }),
    ]);
  } catch (error) {
    const details = diagnosticSuffix(diagnostics);
    const message =
      error instanceof Error ? error.message : "Capture Director wait failed";
    throw new Error(details ? `${message}\n\n${details}` : message);
  }
}

export async function loadCaptureDirector(
  page: Page,
): Promise<CaptureDirectorDiagnostics> {
  const diagnostics = attachCaptureDirectorDiagnostics(page);
  await installCaptureDirectorMocks(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?project=utah-forge", { waitUntil: "domcontentloaded" });
  await waitForCaptureDirectorReady(page, diagnostics);
  return diagnostics;
}

export async function expectNoCaptureDirectorPageErrors(
  diagnostics: CaptureDirectorDiagnostics,
): Promise<void> {
  expect(diagnostics.pageErrors).toEqual([]);
}

export async function dispatchCaptureDirectorButton(
  page: Page,
  testId: string,
  name: string | RegExp,
): Promise<void> {
  const byTestId = page.locator(`[data-testid="${testId}"]`).first();
  const target =
    (await byTestId.count()) > 0
      ? byTestId
      : page.getByRole("button", { name }).first();
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  await target.dispatchEvent("click");
}

export async function openCaptureDirector(page: Page): Promise<void> {
  await dispatchCaptureDirectorButton(
    page,
    "capture-director-launcher",
    "Open Capture Director",
  );
  await expect(page.getByTestId("capture-director-toolbar")).toBeVisible();
}

export async function closeCaptureDirector(page: Page): Promise<void> {
  await dispatchCaptureDirectorButton(
    page,
    "capture-director-launcher",
    "Close Capture Director",
  );
  await expect(page.getByTestId("capture-director-toolbar")).toHaveCount(0);
}

export async function startAndAutoStopRecording(page: Page): Promise<void> {
  const start = page.locator('[data-testid="capture-start"]').first();
  await expect(start).toBeVisible();
  await expect(start).toBeEnabled();
  await start.evaluate((button) => {
    (button as HTMLButtonElement).click();
    const stopWhenReady = () => {
      const stop = document.querySelector(
        '[data-testid="capture-stop"]',
      ) as HTMLButtonElement | null;
      if (stop && !stop.disabled) {
        stop.click();
        return;
      }
      window.setTimeout(stopWhenReady, 50);
    };
    window.setTimeout(stopWhenReady, 50);
  });
}

// The toolbar sections (realtime/render/still/camera-path) are independent
// collapsibles, all collapsed on open. Expand one via its header (idempotent,
// driven by aria-expanded) before reaching its controls. Multiple may be open.
export async function expandCaptureSection(
  page: Page,
  headerTestId: string,
): Promise<void> {
  const header = page.getByTestId(headerTestId).first();
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") {
    await header.dispatchEvent("click");
  }
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

// Expand the Still Capture section. The actual controls (resolution, screen
// capture) live inside the Still Record popout (capture-still-record), so this
// only guarantees the section is expanded and the record button is present.
export async function ensureStillCaptureOpen(page: Page): Promise<void> {
  await expandCaptureSection(page, "capture-still-header");
  await expect(page.getByTestId("capture-still-record")).toBeVisible();
}

// Realtime/Video/Still controls each live inside a Record popout that must be
// opened (after the section is expanded) before the selects are present.
export async function openRealtimeRecordPopout(page: Page): Promise<void> {
  await expandCaptureSection(page, "capture-realtime-header");
  if ((await page.getByTestId("capture-mode-select").count()) === 0) {
    await dispatchCaptureDirectorButton(page, "capture-realtime-record", /Record/);
  }
  await expect(page.getByTestId("capture-mode-select")).toBeVisible();
}

export async function openVideoRecordPopout(page: Page): Promise<void> {
  await expandCaptureSection(page, "capture-render-header");
  if ((await page.getByTestId("capture-render-resolution-select").count()) === 0) {
    await dispatchCaptureDirectorButton(page, "capture-render-record", /Record/);
  }
  await expect(page.getByTestId("capture-render-resolution-select")).toBeVisible();
}

export async function openStillRecordPopout(page: Page): Promise<void> {
  await ensureStillCaptureOpen(page);
  if ((await page.getByTestId("capture-still-resolution-select").count()) === 0) {
    await dispatchCaptureDirectorButton(page, "capture-still-record", /Record/);
  }
  await expect(page.getByTestId("capture-still-resolution-select")).toBeVisible();
}

export async function openScreenCaptureOptions(page: Page): Promise<void> {
  await openStillRecordPopout(page);
  if ((await page.getByTestId("capture-screen-capture-options").count()) === 0) {
    await dispatchCaptureDirectorButton(
      page,
      "capture-screen-capture",
      "Screen Capture",
    );
  }
  await expect(page.getByTestId("capture-screen-capture-options")).toBeVisible();
}

export async function ensureCameraPathOpen(page: Page): Promise<void> {
  const playPathButton = page.getByTestId("capture-path-play");
  if ((await playPathButton.count()) === 0) {
    await dispatchCaptureDirectorButton(
      page,
      "capture-camera-path-header",
      /Camera Path/,
    );
  }
  await expect(playPathButton).toBeVisible();
}

// Add Current Camera now opens a Keyframe/Transition kind popover; pick the kind
// to actually add the node (a bare add click only opens the popover).
export async function addCameraView(
  page: Page,
  kind: "keyframe" | "transition" = "keyframe",
): Promise<void> {
  await dispatchCaptureDirectorButton(
    page,
    "capture-keyframe-add",
    "Add Current Camera",
  );
  await dispatchCaptureDirectorButton(
    page,
    `capture-camera-add-kind-${kind}`,
    new RegExp(kind, "i"),
  );
}

// The horizontal scrub slider was removed for a click-to-place playhead. Click the
// Camera Path lane content at the given 0..1 x-fraction to place the playhead.
// (Deliberately not the frame ruler, which lives in the Pages lane and would
// select the Pages track as a side effect.)
export async function scrubTimelineToFraction(
  page: Page,
  fraction: number,
): Promise<void> {
  const lane = page.getByTestId("capture-timeline-camera-path-content").first();
  await expect(lane).toBeVisible();
  const box = await lane.boundingBox();
  if (!box) {
    throw new Error("capture-timeline-camera-path-content has no bounding box");
  }
  const clamped = Math.max(0, Math.min(1, fraction));
  // Offset slightly inside the lane to avoid the leading "Camera Path" label.
  const x = box.x + Math.max(48, box.width * clamped);
  await page.mouse.click(Math.min(x, box.x + box.width - 2), box.y + box.height / 2);
}

// The timeline diagnostic lanes (continuity / gd / aim / focus markers) render
// only when captureTimeline.diagnosticsVisible is set; enable it via the wired
// camera-path options toggle so those lanes are reachable.
export async function enableTimelineDiagnostics(page: Page): Promise<void> {
  const toggle = page.getByTestId("capture-path-show-diagnostics");
  await expect(toggle).toBeVisible();
  if (!(await toggle.isChecked())) {
    await toggle.setChecked(true);
  }
  await expect(toggle).toBeChecked();
}

export async function resetCaptureDirectorEvents(
  page: Page,
  values: Record<string, unknown> = {},
): Promise<void> {
  await page.evaluate((nextValues) => {
    window.__captureDirectorEvents = [];
    Object.assign(window, nextValues);
  }, values);
}

export async function captureDirectorEvents(
  page: Page,
): Promise<CaptureDirectorEvent[]> {
  return page.evaluate(() => window.__captureDirectorEvents ?? []);
}

export async function mediaRecordingStarted(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    (window.__captureDirectorEvents ?? []).some(
      (event) => event.kind === "media-recorder-start",
    ),
  );
}

export async function clickPathControlIfEnabled(
  page: Page,
  testId: string,
): Promise<boolean> {
  const control = page.getByTestId(testId).first();
  if ((await control.count()) === 0) return false;
  try {
    return await control.evaluate((element) => {
      const button = element as HTMLButtonElement;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") {
        return false;
      }
      button.click();
      return true;
    });
  } catch {
    return false;
  }
}

export async function setRangeInputValue(
  locator: Locator,
  value: string,
): Promise<void> {
  await locator.evaluate((input, nextValue) => {
    const element = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(element, nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

export async function cameraPathOverlayState(page: Page): Promise<{
  visible: boolean;
  childCount: number;
  keyframeIds: string[];
  segmentIds: string[];
  targetIds: string[];
  focusIds: string[];
}> {
  return page.evaluate(() => {
    type OverlayNode = {
      userData?: Record<string, unknown>;
      visible?: boolean;
      traverse?: (visitor: (node: OverlayNode) => void) => void;
    };
    const scene = (
      window as unknown as {
        __scene?: {
          scene?: {
            getObjectByName?: (name: string) => OverlayNode | undefined;
          };
        };
      }
    ).__scene?.scene;
    const overlay = scene?.getObjectByName?.("__capture_camera_path_overlay__");
    const keyframeIds: string[] = [];
    const segmentIds: string[] = [];
    const targetIds: string[] = [];
    const focusIds: string[] = [];
    let childCount = 0;
    overlay?.traverse?.((node) => {
      if (node !== overlay) childCount += 1;
      const data = node.userData ?? {};
      if (typeof data.captureCameraPathKeyframeId === "string") {
        keyframeIds.push(data.captureCameraPathKeyframeId);
      }
      if (typeof data.captureCameraPathSegmentId === "string") {
        segmentIds.push(data.captureCameraPathSegmentId);
      }
      if (typeof data.captureCameraPathTargetKeyframeId === "string") {
        targetIds.push(data.captureCameraPathTargetKeyframeId);
      }
      if (typeof data.captureCameraPathFocusKeyframeId === "string") {
        focusIds.push(data.captureCameraPathFocusKeyframeId);
      }
    });
    return {
      visible: overlay?.visible === true,
      childCount,
      keyframeIds,
      segmentIds,
      targetIds,
      focusIds,
    };
  });
}
