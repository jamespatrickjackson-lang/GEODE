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
  plugins: [
    react(),
    authorWritePlugin(),
    noStoreProjectAssetsPlugin(),
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
