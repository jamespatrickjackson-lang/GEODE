import type {
  EnvironmentSetup,
  PresentationPage,
  ProjectManifest,
} from "./types";
import { DEFAULT_PROJECT_SLUG } from "../projects/projectCatalogRuntime";
import { getProjectPaths } from "../projects/projectPathsRuntime";
import { debugLog } from "../utils/debugLog";

// Project metadata loader. We fetch project.json / environment.json /
// pages/*.json directly via the dev-only static-serve route on the
// authoring plugin (#022) rather than using Vite's import.meta.glob.
//
// Why: vite.config.ts sets server.watch.ignored: ["**/projects/**"] (so
// auto-saves don't trigger HMR full-page reloads while the user edits).
// The side effect is that Vite ALSO never invalidates its own module
// cache for files under projects/. After the editor or our own writes
// modify those files, import.meta.glob keeps returning the stale snapshot
// it bundled at first request. fetch with cache: "no-store" goes through
// the static-serve middleware and reads disk on every load, which is
// what loadProject needs.

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface LoadedProject {
  projectSlug: string;
  projectRoot: string;
  manifest: ProjectManifest;
  environment: EnvironmentSetup;
  pages: PresentationPage[];
}

export async function loadProject(
  projectSlug: string = DEFAULT_PROJECT_SLUG,
): Promise<LoadedProject> {
  const paths = getProjectPaths(projectSlug);
  const [manifest, environment] = await Promise.all([
    fetchJson<ProjectManifest>(paths.projectJson),
    fetchJson<EnvironmentSetup>(paths.environmentJson),
  ]);

  // Fetch each page named in pageOrder. We don't try to enumerate the pages
  // directory -- pageOrder is the source of truth for what pages exist
  // (per the schema), and missing pages are warned about below.
  const pageResults = await Promise.allSettled(
    manifest.pageOrder.map((id) =>
      fetchJson<PresentationPage>(paths.pageJson(id)),
    ),
  );
  const pages: PresentationPage[] = [];
  pageResults.forEach((r, i) => {
    const id = manifest.pageOrder[i];
    if (r.status === "fulfilled") {
      pages.push(r.value);
    } else {
      console.warn(
        `[loadProject] page "${id}" in pageOrder but fetch failed:`,
        r.reason,
      );
    }
  });

  if (pages.length === 0) {
    throw new Error("loadProject: no pages resolved from pageOrder");
  }
  debugLog(
    `[loadProject] ${manifest.id}: ${pages.length} pages, ` +
      `${manifest.layers.length} layers`,
  );
  return {
    projectSlug: paths.slug,
    projectRoot: paths.root,
    manifest,
    environment,
    pages,
  };
}
