import { DEFAULT_PROJECT_SLUG, getProjectBySlug } from "./projectCatalogRuntime";

export interface ProjectPaths {
  slug: string;
  root: string;
  rootUrl: string;
  projectJson: string;
  environmentJson: string;
  pagesDir: string;
  pageJson: (pageId: string) => string;
}

export function appAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const cleanPath = path.replace(/^\/+/, "");
  if (base === "" || base === "/") return `/${cleanPath}`;
  return `${base.replace(/\/?$/, "/")}${cleanPath}`;
}

export function getProjectPaths(
  slug: string = DEFAULT_PROJECT_SLUG,
): ProjectPaths {
  const project = getProjectBySlug(slug);
  if (!project) {
    throw new Error(`Unknown project: ${slug}`);
  }
  const root = project.root;
  const rootUrl = appAssetUrl(root);
  const pagesDir = `${rootUrl}/pages`;
  return {
    slug: project.slug,
    root,
    rootUrl,
    projectJson: `${rootUrl}/project.json`,
    environmentJson: `${rootUrl}/environment.json`,
    pagesDir,
    pageJson: (pageId: string) => `${pagesDir}/${pageId}.json`,
  };
}
