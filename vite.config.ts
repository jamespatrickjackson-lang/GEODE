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
      await fs.cp(source, destination, {
        recursive: true,
        filter(sourcePath) {
          const parts = relative(source, sourcePath).split(/[\\/]+/);
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
    },
  };
}

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [react(), authorWritePlugin(), copyRuntimeDataPlugin(), copyProjectsPlugin()],
  publicDir: command === "serve" ? "data" : false,
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
