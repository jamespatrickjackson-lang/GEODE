import path from "node:path";

export const ROOT = process.cwd();

export const CASE_STUDY_B_ROOT = path.join(ROOT, "projects", "case-study-b");
export const SHAHBAZI_RAW_DIR = path.join(
  CASE_STUDY_B_ROOT,
  "data",
  "raw",
  "shahbazi_gravel_pit",
);
export const SHAHBAZI_PROCESSED_DIR = path.join(
  CASE_STUDY_B_ROOT,
  "data",
  "processed",
  "shahbazi_gravel_pit",
);

export const SHAHBAZI_DERIVED_DATE =
  process.env.GEOSEE_SHAHBAZI_DERIVED_DATE ?? "2026-05-11";

export const SHAHBAZI_SCENE_Z_LIFT_M = numberFromEnv(
  "GEOSEE_SHAHBAZI_SCENE_Z_LIFT_M",
  115,
);

export const SHAHBAZI_CITATION =
  "Shahbazi, Menard, Sohn, Theau (2019), Data in Brief 25, 103962, DOI 10.1016/j.dib.2019.103962";

export const SHAHBAZI_FULL_CITATION =
  "Shahbazi, Menard, Sohn, Theau (2019), Unmanned aerial image dataset: Ready for 3D reconstruction. Data in Brief 25, 103962. DOI 10.1016/j.dib.2019.103962";

export const SHAHBAZI_CRS = {
  label: "NAD83 / MTM Zone 7",
  epsg: 32187,
  status:
    "from article source-data table; confirm against full processing outputs before GIS overlay use",
};

export function rawPath(...parts) {
  return path.join(SHAHBAZI_RAW_DIR, ...parts);
}

export function processedPath(...parts) {
  return path.join(SHAHBAZI_PROCESSED_DIR, ...parts);
}

export function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be numeric; received "${raw}"`);
  }
  return value;
}
