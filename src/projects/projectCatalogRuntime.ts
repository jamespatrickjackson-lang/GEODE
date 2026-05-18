export interface ProjectCatalogEntry {
  slug: string;
  name: string;
  description: string;
  root: string;
  developmentDefault?: boolean;
}

export const WOODJAM_PROJECT: ProjectCatalogEntry = {
  slug: "woodjam",
  name: "Woodjam",
  description: "Reference GeoSee folder project",
  root: "projects/woodjam",
  developmentDefault: true,
};

export const CASE_STUDY_B_PROJECT: ProjectCatalogEntry = {
  slug: "case-study-b",
  name: "Shahbazi Gravel Pit",
  description:
    "High-fidelity quarry demo shell with bench walkthrough and audience lenses",
  root: "projects/case-study-b",
};

export const UTAH_FORGE_PROJECT: ProjectCatalogEntry = {
  slug: "utah-forge",
  name: "Utah FORGE",
  description:
    "Foundation geothermal case study project, ready for briefing and data ingest",
  root: "projects/utah-forge",
};

export const BASE_GUI_PROJECT: ProjectCatalogEntry = {
  slug: "base-gui",
  name: "Base GUI Template",
  description:
    "Empty GeoSee project for editing the shared starter GUI, overlay, and environment defaults",
  root: "projects/base-gui",
};

export const PROJECT_CATALOG: ProjectCatalogEntry[] = [
  WOODJAM_PROJECT,
  CASE_STUDY_B_PROJECT,
  UTAH_FORGE_PROJECT,
];

const PROJECT_LOOKUP: ProjectCatalogEntry[] = [
  ...PROJECT_CATALOG,
  BASE_GUI_PROJECT,
];

export const DEFAULT_PROJECT_SLUG = WOODJAM_PROJECT.slug;

export function getProjectBySlug(
  slug: string,
): ProjectCatalogEntry | undefined {
  return PROJECT_LOOKUP.find((project) => project.slug === slug);
}
