import path from "node:path";

export const REPO_ROOT = process.cwd();

export const UTAH_FORGE_PROJECT_ROOT = path.join(REPO_ROOT, "projects", "utah-forge");
export const UTAH_FORGE_DATA_ROOT = path.join(UTAH_FORGE_PROJECT_ROOT, "data");
export const UTAH_FORGE_CLIENT_PREPROCESSED_ROOT = path.join(
  UTAH_FORGE_DATA_ROOT,
  "client_preprocessed",
);
export const UTAH_FORGE_GEOSEE_PROCESSED_ROOT = path.join(
  UTAH_FORGE_DATA_ROOT,
  "geosee_processed",
);

export const UTAH_FORGE_PHASE3_MT_CLIENT_ROOT = path.join(
  UTAH_FORGE_CLIENT_PREPROCESSED_ROOT,
  "utah_forge_phase_3",
  "electrical_resistivity",
);
export const UTAH_FORGE_PHASE3_MT_PROCESSED_ROOT = path.join(
  UTAH_FORGE_GEOSEE_PROCESSED_ROOT,
  "utah_forge_phase_3",
  "electrical_resistivity",
);

export const DERIVED_DATE = process.env.GEOSEE_DERIVED_DATE || "2026-05-12";
