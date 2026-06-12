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
  archivedPages: PresentationPage[];
}

interface ProjectBundlePayload {
  manifest: ProjectManifest;
  environment: EnvironmentSetup;
  pages: PresentationPage[];
  archivedPages: PresentationPage[];
}

function normalizedPageIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id !== "")
    : [];
}

function pagesFromResults(
  ids: readonly string[],
  results: PromiseSettledResult<PresentationPage>[],
  listName: "pageOrder" | "archivedPageOrder",
): PresentationPage[] {
  const pages: PresentationPage[] = [];
  results.forEach((result, index) => {
    const id = ids[index];
    if (result.status === "fulfilled") {
      pages.push(result.value);
    } else {
      console.warn(
        `[loadProject] page "${id}" in ${listName} but fetch failed:`,
        result.reason,
      );
    }
  });
  return pages;
}

export async function loadProject(
  projectSlug: string = DEFAULT_PROJECT_SLUG,
): Promise<LoadedProject> {
  const paths = getProjectPaths(projectSlug);
  if (import.meta.env.DEV) {
    try {
      const bundle = await fetchJson<ProjectBundlePayload>(
        `/api/project-bundle?project=${encodeURIComponent(paths.slug)}`,
      );
      bundle.manifest.pageOrder = normalizedPageIds(bundle.manifest.pageOrder);
      bundle.manifest.archivedPageOrder = normalizedPageIds(
        bundle.manifest.archivedPageOrder,
      );
      debugLog(
        `[loadProject] ${bundle.manifest.id}: ${bundle.pages.length} pages, ` +
          `${bundle.archivedPages.length} archived pages, ${bundle.manifest.layers.length} layers`,
      );
      return {
        projectSlug: paths.slug,
        projectRoot: paths.root,
        manifest: bundle.manifest,
        environment: bundle.environment,
        pages: bundle.pages,
        archivedPages: bundle.archivedPages,
      };
    } catch (error) {
      console.warn("[loadProject] project bundle failed; falling back:", error);
    }
  }

  const [manifest, environment] = await Promise.all([
    fetchJson<ProjectManifest>(paths.projectJson),
    fetchJson<EnvironmentSetup>(paths.environmentJson),
  ]);

  const pageOrder = normalizedPageIds(manifest.pageOrder);
  const archivedPageOrder = normalizedPageIds(manifest.archivedPageOrder);
  manifest.pageOrder = pageOrder;
  manifest.archivedPageOrder = archivedPageOrder;

  // Fetch pages named in manifest lists. We don't enumerate the pages directory:
  // pageOrder and archivedPageOrder are the source of truth for authored pages.
  const [pageResults, archivedPageResults] = await Promise.all([
    Promise.allSettled(
      pageOrder.map((id) => fetchJson<PresentationPage>(paths.pageJson(id))),
    ),
    Promise.allSettled(
      archivedPageOrder.map((id) =>
        fetchJson<PresentationPage>(paths.pageJson(id)),
      ),
    ),
  ]);
  const pages = pagesFromResults(pageOrder, pageResults, "pageOrder");
  const archivedPages = pagesFromResults(
    archivedPageOrder,
    archivedPageResults,
    "archivedPageOrder",
  );

  if (pages.length === 0) {
    throw new Error("loadProject: no pages resolved from pageOrder");
  }
  debugLog(
    `[loadProject] ${manifest.id}: ${pages.length} pages, ` +
      `${archivedPages.length} archived pages, ${manifest.layers.length} layers`,
  );
  return {
    projectSlug: paths.slug,
    projectRoot: paths.root,
    manifest,
    environment,
    pages,
    archivedPages,
  };
}
