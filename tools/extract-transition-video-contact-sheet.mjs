import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const artifactDir = process.argv[2];
const videoArg = process.argv[3];
const options = new Map();
for (const arg of process.argv.slice(4)) {
  const match = /^--([^=]+)=(.*)$/.exec(arg);
  if (match) options.set(match[1], match[2]);
}

if (!artifactDir) {
  console.error(
    "Usage: node tools/extract-transition-video-contact-sheet.mjs <artifact-dir> [video-file] [--start=seconds] [--end=seconds] [--frames=count] [--out=filename]",
  );
  process.exit(1);
}

const artifactPath = path.resolve(artifactDir);
const videoPath = path.resolve(
  videoArg ??
    path.join(
      artifactPath,
      "videos",
      "page@fa2b15c751c5bed20e02225ee0a18006.webm",
    ),
);
const outputName = options.get("out") ?? "video-review-contact-sheet.png";
const outputPath = path.join(artifactPath, outputName);
const htmlPath = path.join(
  artifactPath,
  outputName.replace(/\.[^.]+$/, ".html"),
);
const requestedStart = Number(options.get("start") ?? 0);
const requestedEnd = Number(options.get("end") ?? Number.NaN);
const requestedFrameCount = Math.max(
  2,
  Math.floor(Number(options.get("frames") ?? 16)),
);

await mkdir(artifactPath, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1800, height: 1500 },
  deviceScaleFactor: 1,
});

await writeFile(htmlPath, `<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        background: #111;
        color: #eee;
        font-family: Arial, sans-serif;
      }
      .meta {
        font-size: 20px;
        padding: 12px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        padding: 12px;
      }
      .cell {
        background: #222;
        border: 1px solid #444;
      }
      .label {
        font-size: 18px;
        padding: 5px 8px;
      }
      canvas {
        display: block;
        width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div id="meta" class="meta"></div>
    <div id="grid" class="grid"></div>
  </body>
</html>`);
await page.goto(pathToFileURL(htmlPath).href);

const result = await page.evaluate(async ({ src, requestedStart, requestedEnd, requestedFrameCount }) => {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.preload = "auto";

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("video load failed"));
  });

  const duration = video.duration;
  const start = Number.isFinite(requestedStart)
    ? Math.min(Math.max(requestedStart, 0), duration)
    : 0;
  const end = Number.isFinite(requestedEnd)
    ? Math.min(Math.max(requestedEnd, start), duration)
    : duration;
  const frameCount = requestedFrameCount;
  const times = Array.from({ length: frameCount }, (_, index) =>
    end <= start ? start : start + ((end - start) * index) / (frameCount - 1),
  );
  const grid = document.getElementById("grid");
  const meta = document.getElementById("meta");
  if (!grid || !meta) throw new Error("contact sheet DOM missing");
  meta.textContent = `${frameCount} sampled frames from ${start.toFixed(
    2,
  )}s to ${end.toFixed(2)}s of ${duration.toFixed(
    2,
  )}s video`;

  const seek = async (time) => {
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error(`seek timeout at ${time}`)),
        5000,
      );
      video.onseeked = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.currentTime = Math.min(
        Math.max(time, 0),
        Math.max(duration - 0.05, 0),
      );
    });
  };

  for (const time of times) {
    await seek(time);
    const cell = document.createElement("div");
    cell.className = "cell";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = `t=${time.toFixed(2)}s`;
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas context missing");
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    cell.appendChild(label);
    cell.appendChild(canvas);
    grid.appendChild(cell);
  }

  return { duration, frameCount, start, end };
}, {
  src: pathToFileURL(videoPath).href,
  requestedStart,
  requestedEnd,
  requestedFrameCount,
});

await page.screenshot({ path: outputPath, fullPage: true });
await browser.close();

console.log(JSON.stringify({ outputPath, videoPath, ...result }, null, 2));
