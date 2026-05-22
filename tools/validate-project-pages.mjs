import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const projectsDir = path.join(rootDir, "projects");
const errors = [];

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(rootDir, filePath)}: invalid JSON (${error.message})`);
    return null;
  }
}

function isExternalOrRootedAssetPath(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|data:|#|\/|[a-zA-Z]:[\\/])/.test(value);
}

function assertProjectAssetExists(projectDir, projectName, pageId, assetPath, field) {
  if (typeof assetPath !== "string" || assetPath.trim() === "") return;
  const normalized = assetPath.replace(/\\/g, "/").split("#")[0].split("?")[0];
  if (!normalized || isExternalOrRootedAssetPath(normalized)) return;
  const absolutePath = path.join(projectDir, normalized);
  if (!existsSync(absolutePath)) {
    errors.push(
      `${projectName}:${pageId}: ${field} points to missing ${normalized}`,
    );
  }
}

for (const entry of readdirSync(projectsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

  const projectDir = path.join(projectsDir, entry.name);
  const manifestPath = path.join(projectDir, "project.json");
  if (!existsSync(manifestPath)) continue;

  const manifest = readJson(manifestPath);
  if (!manifest) continue;

  const pageOrder = Array.isArray(manifest.pageOrder) ? manifest.pageOrder : [];
  for (const pageId of pageOrder) {
    if (typeof pageId !== "string" || pageId.trim() === "") {
      errors.push(`${entry.name}: pageOrder contains a non-string page id`);
      continue;
    }
    if (pageId.includes("_untitled")) {
      errors.push(`${entry.name}: active pageOrder contains ${pageId}`);
    }

    const pagePath = path.join(projectDir, "pages", `${pageId}.json`);
    if (!existsSync(pagePath)) {
      errors.push(`${entry.name}: pageOrder page missing pages/${pageId}.json`);
      continue;
    }

    const page = readJson(pagePath);
    if (!page) continue;

    if (page.id !== pageId) {
      errors.push(
        `${entry.name}:${pageId}: page id ${JSON.stringify(page.id)} does not match filename/pageOrder`,
      );
    }

    if (page.title === "Untitled page" || /\s+copy$/i.test(page.title ?? "")) {
      errors.push(`${entry.name}:${pageId}: active page title is no-function text`);
    }

    assertProjectAssetExists(
      projectDir,
      entry.name,
      pageId,
      page.overlay?.contentFile,
      "overlay.contentFile",
    );

    for (const image of page.overlay?.images ?? []) {
      assertProjectAssetExists(projectDir, entry.name, pageId, image?.file, "overlay.images[].file");
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Project page wiring OK");
}
