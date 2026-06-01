import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJson(filePath, rootDir, errors) {
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

function assertProjectAssetExists(
  projectDir,
  projectName,
  pageId,
  assetPath,
  field,
  errors,
) {
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

const SCENE_SECTION_AXES = ["x", "y", "z"];

function sceneSectionAxisFromBuiltInFrameId(id) {
  if (id === "axis:x") return "x";
  if (id === "axis:y") return "y";
  if (id === "axis:z") return "z";
  return null;
}

function validSceneSectionAxis(axis) {
  return axis === "x" || axis === "y" || axis === "z";
}

function normalizeMtBoundaryVisibilityStyle(style) {
  const boundaries = style?.mtSurfaceBoundariesById;
  if (!boundaries) return style;

  let changed = false;
  const visibility = { ...(style.mtThresholdSurfaceVisibility ?? {}) };
  for (const [id, boundary] of Object.entries(boundaries)) {
    if (typeof boundary?.visible !== "boolean") continue;
    if (visibility[id] === boundary.visible) continue;
    visibility[id] = boundary.visible;
    changed = true;
  }

  return changed ? { ...style, mtThresholdSurfaceVisibility: visibility } : style;
}

function normalizeEffectiveSceneSectionStyle(style) {
  const hasSceneSectionState =
    style?.sceneSectionActiveAxis !== undefined ||
    style?.sceneSectionActiveFrameId !== undefined ||
    style?.sceneSectionPlanes !== undefined ||
    style?.sceneSectionFrames !== undefined ||
    style?.sceneSectionFrameByAxis !== undefined;
  if (!hasSceneSectionState) return style;

  let next = null;
  const mutable = () => {
    if (!next) next = { ...style };
    return next;
  };

  const activeAxis = validSceneSectionAxis(style.sceneSectionActiveAxis)
    ? style.sceneSectionActiveAxis
    : null;
  const activeFrameAxis = sceneSectionAxisFromBuiltInFrameId(
    style.sceneSectionActiveFrameId,
  );
  if (activeAxis && activeFrameAxis && activeAxis !== activeFrameAxis) {
    mutable().sceneSectionActiveFrameId = `axis:${activeAxis}`;
  }

  const planes = style.sceneSectionPlanes ?? {};
  const frames = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : null;
  if (frames) {
    let changed = false;
    const normalizedFrames = frames.map((entry) => {
      const frameAxis = sceneSectionAxisFromBuiltInFrameId(entry?.id);
      if (!entry || !frameAxis || !SCENE_SECTION_AXES.includes(frameAxis)) {
        return entry;
      }
      const plane = planes[frameAxis];
      const normalizedAxis = entry.axis === frameAxis ? entry.axis : frameAxis;
      const normalizedPlane = plane
        ? {
            ...(entry.plane ?? {}),
            ...plane,
          }
        : entry.plane;
      if (normalizedAxis === entry.axis && normalizedPlane === entry.plane) {
        return entry;
      }
      changed = true;
      return {
        ...entry,
        axis: normalizedAxis,
        plane: normalizedPlane,
      };
    });
    if (changed) {
      mutable().sceneSectionFrames = normalizedFrames;
    }
  }

  return next ?? style;
}

function normalizeEffectiveStyle(style) {
  return normalizeEffectiveSceneSectionStyle(
    normalizeMtBoundaryVisibilityStyle(style),
  );
}

function validateMtBoundaryVisibility(context, style, issues) {
  const legacyVisibility = style?.mtThresholdSurfaceVisibility;
  const boundaries = style?.mtSurfaceBoundariesById;
  if (!legacyVisibility || !boundaries) return;

  for (const [id, boundary] of Object.entries(boundaries)) {
    if (typeof boundary?.visible !== "boolean") continue;
    if (legacyVisibility[id] === undefined) continue;
    if (legacyVisibility[id] === boundary.visible) continue;
    issues.push(
      `${context}: MT boundary ${id} visibility mismatch: mtThresholdSurfaceVisibility=${legacyVisibility[id]} mtSurfaceBoundariesById.visible=${boundary.visible}`,
    );
  }
}

function validateSceneSectionFrameState(context, style, issues) {
  const frames = Array.isArray(style?.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  if (frames.length === 0) return;

  const activeFrameId = style.sceneSectionActiveFrameId;
  const activeFrame = activeFrameId
    ? frames.find((frame) => frame?.id === activeFrameId)
    : null;
  if (activeFrameId && !activeFrame) {
    issues.push(`${context}: active frame ${activeFrameId} is missing`);
  }
  if (
    activeFrame &&
    style.sceneSectionActiveAxis &&
    activeFrame.axis &&
    style.sceneSectionActiveAxis !== activeFrame.axis
  ) {
    issues.push(
      `${context}: active axis ${style.sceneSectionActiveAxis} does not match active frame axis ${activeFrame.axis}`,
    );
  }

  const legacyPlanes = style.sceneSectionPlanes ?? {};
  for (const frame of frames) {
    if (!frame?.id || !frame.axis || !frame.plane) continue;
    const legacyPlane = legacyPlanes[frame.axis];
    if (!legacyPlane) continue;
    for (const field of ["enabled", "positionM", "invert"]) {
      if (frame.plane[field] === undefined || legacyPlane[field] === undefined) {
        continue;
      }
      if (frame.plane[field] === legacyPlane[field]) continue;
      issues.push(
        `${context}: frame ${frame.id} plane.${field} ${frame.plane[field]} does not match sceneSectionPlanes.${frame.axis} ${legacyPlane[field]}`,
      );
    }
  }
}

function validateLayerStyles(context, layerStyles, issues) {
  if (!layerStyles || typeof layerStyles !== "object") return;
  for (const [layerId, style] of Object.entries(layerStyles)) {
    const styleContext = `${context}:${layerId}`;
    validateMtBoundaryVisibility(styleContext, style, issues);
    validateSceneSectionFrameState(styleContext, style, issues);
  }
}

function mergedLayerStyles(environment, page) {
  const environmentStyles = environment?.layerStyles ?? {};
  const pageStyles = page?.layerOverrides ?? {};
  const layerIds = new Set([
    ...Object.keys(environmentStyles),
    ...Object.keys(pageStyles),
  ]);
  const merged = {};
  for (const layerId of layerIds) {
    merged[layerId] = normalizeEffectiveStyle({
      ...(environmentStyles[layerId] ?? {}),
      ...(pageStyles[layerId] ?? {}),
    });
  }
  return merged;
}

export function validateProjectPages(rootDir = process.cwd()) {
  const projectsDir = path.join(rootDir, "projects");
  const errors = [];
  const warnings = [];

  if (!existsSync(projectsDir)) {
    return {
      ok: false,
      errors: [`${path.relative(rootDir, projectsDir)}: missing projects directory`],
    };
  }

  for (const entry of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const projectDir = path.join(projectsDir, entry.name);
    const manifestPath = path.join(projectDir, "project.json");
    if (!existsSync(manifestPath)) continue;

    const manifest = readJson(manifestPath, rootDir, errors);
    if (!manifest) continue;

    const environmentPath = path.join(projectDir, "environment.json");
    let projectEnvironment = null;
    if (existsSync(environmentPath)) {
      projectEnvironment = readJson(environmentPath, rootDir, errors);
      validateLayerStyles(
        `${entry.name}:environment`,
        projectEnvironment?.layerStyles,
        warnings,
      );
    }

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

      const page = readJson(pagePath, rootDir, errors);
      if (!page) continue;

      if (page.id !== pageId) {
        errors.push(
          `${entry.name}:${pageId}: page id ${JSON.stringify(page.id)} does not match filename/pageOrder`,
        );
      }

      if (page.title === "Untitled page" || /\s+copy$/i.test(page.title ?? "")) {
        errors.push(`${entry.name}:${pageId}: active page title is no-function text`);
      }

      validateLayerStyles(`${entry.name}:${pageId}`, page.layerOverrides, warnings);
      validateLayerStyles(
        `${entry.name}:${pageId}:envSnapshot`,
        page.envSnapshot?.layerStyles,
        warnings,
      );
      const effectiveEnvironment = page.envSnapshot ?? projectEnvironment;
      validateLayerStyles(
        `${entry.name}:${pageId}:effective`,
        mergedLayerStyles(effectiveEnvironment, page),
        errors,
      );

      assertProjectAssetExists(
        projectDir,
        entry.name,
        pageId,
        page.overlay?.contentFile,
        "overlay.contentFile",
        errors,
      );

      for (const image of page.overlay?.images ?? []) {
        assertProjectAssetExists(
          projectDir,
          entry.name,
          pageId,
          image?.file,
          "overlay.images[].file",
          errors,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateProjectPages();
  if (!result.ok) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Project page wiring OK");
  }
}
