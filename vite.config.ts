import { promises as fs } from "node:fs";
import { relative, resolve } from "node:path";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";
import { authorWritePlugin } from "./plugins/vite-plugin-author-write";

// publicDir is set to ./data so the Woodjam data files are served at the root
// during dev (e.g. fetch("/drills.geojson") -> data/drills.geojson). When
// week 5 adds the projects/<name>/ layout, the loader path strategy will
// change.
//
// authorWritePlugin (#022) registers /api/write-file, /api/read-file, and
// /api/delete-file dev endpoints scoped to projects/. apply: "serve" means
// it's not present in `vite build` output -- shipped artifacts have no
// write capability.
//
// server.watch.ignored excludes authoring and generated verification outputs
// from HMR. Those files can change while the app is open, but the editor and
// transition matrix keep in-memory state as truth; reloads during those writes
// invalidate the current page/transition state.
function copyRuntimeDataPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "copy-runtime-data",
    apply: "build",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async closeBundle() {
      const source = resolve(config.root, "data");
      const destination = resolve(config.root, config.build.outDir);
      const entries = await fs.readdir(source, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === "source" || entry.name === "desktop.ini") {
          continue;
        }
        await fs.cp(resolve(source, entry.name), resolve(destination, entry.name), {
          recursive: true,
        });
      }
    },
  };
}

const FFMPEG_CORE_PACKAGE = "@ffmpeg/core";
// @ffmpeg/ffmpeg 0.12.x runs a module worker (`type=module`) that loads the
// core with dynamic `import()`. The UMD build is not an ES module and fails to
// import ("failed to import ffmpeg-core.js"), so the ESM core build is served.
const FFMPEG_CORE_ASSET_DIR = ["node_modules", "@ffmpeg", "core", "dist", "esm"];
const FFMPEG_CORE_ASSET_OUTPUT_DIR = ["runtime", "ffmpeg"];
const FFMPEG_CORE_ASSET_FILES = [
  "ffmpeg-core.js",
  "ffmpeg-core.wasm",
  "ffmpeg-core.worker.js",
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function copyFfmpegCoreAssetsPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "copy-ffmpeg-core-assets",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url?.split("?")[0] ?? "";
        if (!rawUrl.startsWith("/runtime/ffmpeg/")) {
          next();
          return;
        }
        const filename = decodeURIComponent(rawUrl.split("/").pop() ?? "");
        if (!FFMPEG_CORE_ASSET_FILES.includes(filename)) {
          next();
          return;
        }
        const sourcePath = resolve(
          server.config.root,
          ...FFMPEG_CORE_ASSET_DIR,
          filename,
        );
        if (!(await fileExists(sourcePath))) {
          // Known FFmpeg core filename but no file on disk (e.g. the
          // single-threaded core ships no ffmpeg-core.worker.js). Return 404
          // rather than falling through to the SPA index.html, which would hand
          // the loader a misleading 200 text/html response.
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Cache-Control", "no-store, max-age=0");
        if (filename.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        } else {
          res.setHeader("Content-Type", "text/javascript");
        }
        res.end(await fs.readFile(sourcePath));
      });
    },
    async closeBundle() {
      if (!config) return;
      const destination = resolve(
        config.root,
        config.build.outDir,
        ...FFMPEG_CORE_ASSET_OUTPUT_DIR,
      );
      await fs.mkdir(destination, { recursive: true });
      for (const filename of FFMPEG_CORE_ASSET_FILES) {
        const sourcePath = resolve(config.root, ...FFMPEG_CORE_ASSET_DIR, filename);
        if (!(await fileExists(sourcePath))) {
          continue;
        }
        await fs.copyFile(sourcePath, resolve(destination, filename));
      }
    },
  };
}

function noStoreProjectAssetsPlugin(): Plugin {
  return {
    name: "geosee-project-assets-no-store",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (url.startsWith("/projects/")) {
          res.setHeader("Cache-Control", "no-store, max-age=0");
        }
        next();
      });
    },
  };
}

function projectBundleDevPlugin(): Plugin {
  return {
    name: "geosee-project-bundle-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        if (!rawUrl.startsWith("/api/project-bundle")) {
          next();
          return;
        }

        try {
          const url = new URL(rawUrl, "http://localhost");
          const slug = url.searchParams.get("project") ?? "";
          if (!/^[a-z0-9-]+$/i.test(slug)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid project slug" }));
            return;
          }

          const root = resolve(server.config.root, "projects", slug);
          const manifestPath = resolve(root, "project.json");
          const environmentPath = resolve(root, "environment.json");
          if (
            !manifestPath.startsWith(resolve(server.config.root, "projects")) ||
            !environmentPath.startsWith(resolve(server.config.root, "projects"))
          ) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid project path" }));
            return;
          }

          const [manifest, environment] = await Promise.all([
            fs.readFile(manifestPath, "utf8").then(JSON.parse),
            fs.readFile(environmentPath, "utf8").then(JSON.parse),
          ]);
          const pageIds = Array.isArray(manifest.pageOrder)
            ? manifest.pageOrder.filter((id: unknown): id is string => typeof id === "string" && id !== "")
            : [];
          const archivedPageIds = Array.isArray(manifest.archivedPageOrder)
            ? manifest.archivedPageOrder.filter(
                (id: unknown): id is string => typeof id === "string" && id !== "",
              )
            : [];
          const readPage = async (pageId: string) => {
            const pagePath = resolve(root, "pages", `${pageId}.json`);
            return JSON.parse(await fs.readFile(pagePath, "utf8"));
          };
          const [pages, archivedPages] = await Promise.all([
            Promise.all(pageIds.map(readPage)),
            Promise.all(archivedPageIds.map(readPage)),
          ]);

          manifest.pageOrder = pageIds;
          manifest.archivedPageOrder = archivedPageIds;
          res.statusCode = 200;
          res.setHeader("Cache-Control", "no-store, max-age=0");
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              manifest,
              environment,
              pages,
              archivedPages,
            }),
          );
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Project bundle failed",
            }),
          );
        }
      });
    },
  };
}

type ProjectManifestForBuild = {
  archivedPageOrder?: unknown;
  [key: string]: unknown;
};

function archivedPageIdsFromManifest(manifest: ProjectManifestForBuild): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(manifest.archivedPageOrder)) return ids;
  for (const pageId of manifest.archivedPageOrder) {
    if (typeof pageId === "string" && pageId.trim() !== "") {
      ids.add(pageId);
    }
  }
  return ids;
}

function sanitizeProjectManifestForBuild(
  manifest: ProjectManifestForBuild,
): ProjectManifestForBuild {
  const { archivedPageOrder: _archivedPageOrder, ...sanitized } = manifest;
  return sanitized;
}

function omitArchiveOnlyPageJsonFromBuild(
  parts: string[],
  archivedPageIdsByProject: Map<string, Set<string>>,
): boolean {
  if (parts.length < 3 || parts[1] !== "pages") return false;
  if (parts[2] === "_archive") return true;
  if (parts.length !== 3 || !parts[2].endsWith(".json")) return false;
  const pageId = parts[2].replace(/\.json$/i, "");
  return archivedPageIdsByProject.get(parts[0])?.has(pageId) === true;
}

async function readArchivedPageIdsByProject(
  projectsDir: string,
): Promise<Map<string, Set<string>>> {
  const archivedPageIdsByProject = new Map<string, Set<string>>();
  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const manifestPath = resolve(projectsDir, entry.name, "project.json");
    try {
      const manifest = JSON.parse(
        await fs.readFile(manifestPath, "utf8"),
      ) as ProjectManifestForBuild;
      archivedPageIdsByProject.set(
        entry.name,
        archivedPageIdsFromManifest(manifest),
      );
    } catch {
      archivedPageIdsByProject.set(entry.name, new Set());
    }
  }
  return archivedPageIdsByProject;
}

async function sanitizeCopiedProjectManifests(
  source: string,
  destination: string,
) {
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const sourceManifestPath = resolve(source, entry.name, "project.json");
    const destinationManifestPath = resolve(destination, entry.name, "project.json");
    try {
      const manifest = JSON.parse(
        await fs.readFile(sourceManifestPath, "utf8"),
      ) as ProjectManifestForBuild;
      await fs.writeFile(
        destinationManifestPath,
        `${JSON.stringify(sanitizeProjectManifestForBuild(manifest), null, 2)}\n`,
      );
    } catch {
      // Leave existing build copy behavior unchanged for malformed manifests.
    }
  }
}

function copyProjectsPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "copy-projects",
    apply: "build",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async closeBundle() {
      const source = resolve(config.root, "projects");
      const destination = resolve(config.root, config.build.outDir, "projects");
      const archivedPageIdsByProject = await readArchivedPageIdsByProject(source);
      await fs.cp(source, destination, {
        recursive: true,
        filter(sourcePath) {
          const parts = relative(source, sourcePath).split(/[\\/]+/).filter(Boolean);
          if (omitArchiveOnlyPageJsonFromBuild(parts, archivedPageIdsByProject)) {
            return false;
          }
          const rawIndex = parts.indexOf("raw");
          if (rawIndex > 0 && parts[rawIndex - 1] === "data") {
            return false;
          }
          const clientPreprocessedIndex = parts.indexOf("client_preprocessed");
          if (
            clientPreprocessedIndex > 0 &&
            parts[clientPreprocessedIndex - 1] === "data"
          ) {
            return false;
          }
          if (parts.includes("paper_extracted_images")) {
            return false;
          }
          return true;
        },
      });
      await sanitizeCopiedProjectManifests(source, destination);
    },
  };
}

function sourceManualChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  const srcIndex = normalized.lastIndexOf("/src/");
  if (srcIndex < 0) return undefined;
  const sourcePath = normalized.slice(srcIndex);

  if (sourcePath.includes("/src/loaders/")) {
    return "app-scene-loaders";
  }
  return undefined;
}

export default defineConfig(({ command }) => ({
  base: "./",
  // @ffmpeg/ffmpeg 0.12.x loads its class worker via
  // `new Worker(new URL("./worker.js", import.meta.url))`. Vite's esbuild dep
  // optimizer cannot emit that worker, so the optimized build references a
  // missing `.vite/deps/worker.js` and `ffmpeg.load()` hangs forever. Excluding
  // the package keeps it un-prebundled so the worker URL resolves correctly.
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg"],
  },
  plugins: [
    react(),
    projectBundleDevPlugin(),
    authorWritePlugin(),
    noStoreProjectAssetsPlugin(),
    copyFfmpegCoreAssetsPlugin(),
    copyRuntimeDataPlugin(),
    copyProjectsPlugin(),
  ],
  publicDir: command === "serve" ? "data" : false,
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const sourceChunk = sourceManualChunk(id);
          if (sourceChunk) return sourceChunk;
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/three/build/")) {
            return "vendor-three-core";
          }
          if (id.includes("/three/examples/")) {
            return "vendor-three-extras";
          }
          if (
            id.includes("/geotiff/") ||
            id.includes("/pako/") ||
            id.includes("/lerc/") ||
            id.includes("/pako.esm")
          ) {
            return "vendor-raster";
          }
          if (id.includes("/marked/")) return "vendor-markdown";
          if (id.includes("/@tweenjs/")) return "vendor-animation";
          return "vendor";
        },
      },
    },
  },
  server: {
    watch: {
      ignored: [
        "**/projects/**",
        "**/docs/dev-context/artifacts/**",
        "**/test-results/**",
        "**/playwright-report/**",
      ],
    },
  },
}));
