import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  SceneProperties,
  SceneOverlayDef,
} from "./types";
import {
  activeRenderPresetIdForPage,
  contourStylePatchForLayer,
  projectRenderPresets,
  publicContextStylePatchForLayer,
} from "./renderPresets";

type SceneSectionAxis = "x" | "y" | "z";

const SCENE_SECTION_AXES: readonly SceneSectionAxis[] = ["x", "y", "z"];

export function normalizeMtBoundaryVisibilityStyle(
  style: EditableStyle,
): EditableStyle {
  const boundaries = style.mtSurfaceBoundariesById;
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

function sceneSectionAxisFromBuiltInFrameId(
  id: unknown,
): SceneSectionAxis | null {
  if (id === "axis:x") return "x";
  if (id === "axis:y") return "y";
  if (id === "axis:z") return "z";
  return null;
}

function validSceneSectionAxis(axis: unknown): axis is SceneSectionAxis {
  return axis === "x" || axis === "y" || axis === "z";
}

export function normalizeEffectiveSceneSectionStyle(
  style: EditableStyle,
): EditableStyle {
  const hasSceneSectionState =
    style.sceneSectionActiveAxis !== undefined ||
    style.sceneSectionActiveFrameId !== undefined ||
    style.sceneSectionPlanes !== undefined ||
    style.sceneSectionFrames !== undefined ||
    style.sceneSectionFrameByAxis !== undefined;
  if (!hasSceneSectionState) return style;

  let next: EditableStyle | null = null;
  const mutable = (): EditableStyle => {
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
      const normalizedAxis =
        entry.axis === frameAxis ? entry.axis : frameAxis;
      const normalizedPlane = plane
        ? {
            ...(entry.plane ?? {}),
            ...plane,
          }
        : entry.plane;
      if (
        normalizedAxis === entry.axis &&
        normalizedPlane === entry.plane
      ) {
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

// Pure helpers that compose environment base + presentation-page deltas
// into the effective state the renderer should show.
//
// The composition rules (#023):
//   visibility:  start with env.defaultVisibleLayers; for each entry in
//                page.visibilityOverrides, force-show on true / force-hide
//                on false; missing entries inherit.
//   styling:     shallow-merge env.layerStyles[id] then page.layerOverrides[id]
//                so override fields win and unspecified fields inherit.

export function effectiveStyle(
  environment: EnvironmentSetup,
  page: PresentationPage,
  layerId: string,
): EditableStyle {
  const base = environment.layerStyles[layerId] ?? {};
  const presetPatch =
    publicContextStylePatchForLayer(
      layerId,
      activeRenderPresetIdForPage(environment, page),
      projectRenderPresets(environment),
    ) ?? {};
  const contourPatch =
    contourStylePatchForLayer(
      layerId,
      activeRenderPresetIdForPage(environment, page),
      projectRenderPresets(environment),
    ) ?? {};
  const override = page.layerOverrides?.[layerId] ?? {};
  let merged = { ...base, ...presetPatch, ...contourPatch, ...override };
  // Page layer overrides should still win over preset-derived contour mode
  // values. These contourPreset* fields are internal line-material patches, so
  // clear them when an explicit page color/opacity/width override is present.
  if (Object.prototype.hasOwnProperty.call(override, "color")) {
    delete merged.contourPresetColor;
  }
  if (Object.prototype.hasOwnProperty.call(override, "opacity")) {
    delete merged.contourPresetOpacity;
  }
  if (Object.prototype.hasOwnProperty.call(override, "lineWidth")) {
    delete merged.contourPresetLineWidth;
  }
  merged = normalizeMtBoundaryVisibilityStyle(merged);
  return normalizeEffectiveSceneSectionStyle(merged);
}

export function effectiveVisibility(
  environment: EnvironmentSetup,
  page: PresentationPage,
): Set<string> {
  const set = new Set(environment.defaultVisibleLayers);
  const overrides = page.visibilityOverrides ?? {};
  for (const [id, vis] of Object.entries(overrides)) {
    if (vis) set.add(id);
    else set.delete(id);
  }
  return set;
}

export function mergeSceneProperties(
  base: Partial<SceneProperties> | undefined,
  patch: Partial<SceneProperties> | undefined,
): SceneProperties {
  const next: SceneProperties = { ...(base ?? {}), ...(patch ?? {}) };
  if (!patch) return next;
  if (patch.fog) next.fog = { ...(base?.fog ?? {}), ...patch.fog };
  if (patch.bloom) next.bloom = { ...(base?.bloom ?? {}), ...patch.bloom };
  if (patch.camera) next.camera = { ...(base?.camera ?? {}), ...patch.camera };
  if (patch.terrain) {
    next.terrain = { ...(base?.terrain ?? {}), ...patch.terrain };
  }
  if (patch.ambientOcclusion) {
    next.ambientOcclusion = {
      ...(base?.ambientOcclusion ?? {}),
      ...patch.ambientOcclusion,
    };
  }
  if (patch.colorGrade) {
    next.colorGrade = { ...(base?.colorGrade ?? {}), ...patch.colorGrade };
  }
  if (patch.vignette) {
    next.vignette = { ...(base?.vignette ?? {}), ...patch.vignette };
  }
  if (patch.depthOfField) {
    next.depthOfField = {
      ...(base?.depthOfField ?? {}),
      ...patch.depthOfField,
    };
  }
  if (patch.tiltShift) {
    next.tiltShift = { ...(base?.tiltShift ?? {}), ...patch.tiltShift };
  }
  if (patch.lensEffects) {
    next.lensEffects = {
      ...(base?.lensEffects ?? {}),
      ...patch.lensEffects,
    };
  }
  if (patch.motionTrails) {
    next.motionTrails = {
      ...(base?.motionTrails ?? {}),
      ...patch.motionTrails,
    };
  }
  if (patch.presentationFrame) {
    next.presentationFrame = {
      ...(base?.presentationFrame ?? {}),
      ...patch.presentationFrame,
    };
  }
  if (patch.compositionGuides) {
    next.compositionGuides = {
      ...(base?.compositionGuides ?? {}),
      ...patch.compositionGuides,
    };
  }
  if (patch.sun) next.sun = { ...(base?.sun ?? {}), ...patch.sun };
  if (patch.topoDetails) {
    next.topoDetails = { ...(base?.topoDetails ?? {}), ...patch.topoDetails };
  }
  if (patch.gui) {
    next.gui = {
      ...(base?.gui ?? {}),
      ...patch.gui,
      labels: {
        ...(base?.gui?.labels ?? {}),
        ...(patch.gui.labels ?? {}),
      },
      editor: {
        ...(base?.gui?.editor ?? {}),
        ...(patch.gui.editor ?? {}),
      },
    };
  }
  if (patch.lighting) {
    next.lighting = {
      ...(base?.lighting ?? {}),
      ...patch.lighting,
      hemisphere: {
        ...(base?.lighting?.hemisphere ?? {}),
        ...(patch.lighting.hemisphere ?? {}),
      },
      directional: {
        ...(base?.lighting?.directional ?? {}),
        ...(patch.lighting.directional ?? {}),
      },
      fill: {
        ...(base?.lighting?.fill ?? {}),
        ...(patch.lighting.fill ?? {}),
      },
      rim: {
        ...(base?.lighting?.rim ?? {}),
        ...(patch.lighting.rim ?? {}),
      },
    };
  }
  return next;
}

function applyPageSceneOverrides(
  environment: EnvironmentSetup,
  page: PresentationPage,
): EnvironmentSetup {
  if (!page.sceneOverrides) return environment;
  return {
    ...environment,
    scene: mergeSceneProperties(environment.scene, page.sceneOverrides),
  };
}

export function resolveEnvironmentForPage(
  environment: EnvironmentSetup,
  pages: readonly PresentationPage[],
  page: PresentationPage,
): EnvironmentSetup {
  const isSubMaster =
    page.envSnapshot != null &&
    (!page.parentMasterId || page.parentMasterId === "global");
  if (isSubMaster) return applyPageSceneOverrides(page.envSnapshot!, page);

  if (page.parentMasterId && page.parentMasterId !== "global") {
    const parent = pages.find((candidate) => candidate.id === page.parentMasterId);
    if (parent?.envSnapshot) {
      return applyPageSceneOverrides(parent.envSnapshot, page);
    }
  }

  return applyPageSceneOverrides(environment, page);
}

export function effectiveStyleForPage(
  environment: EnvironmentSetup,
  pages: readonly PresentationPage[],
  page: PresentationPage,
  layerId: string,
): EditableStyle {
  return effectiveStyle(resolveEnvironmentForPage(environment, pages, page), page, layerId);
}

export function effectiveVisibilityForPage(
  environment: EnvironmentSetup,
  pages: readonly PresentationPage[],
  page: PresentationPage,
): Set<string> {
  return effectiveVisibility(resolveEnvironmentForPage(environment, pages, page), page);
}

// Whether a specific style field on a layer is currently overridden by
// the page. Used by the LayerPanel to decide between "inherited" and
// "overridden" UI states. Membership-checks the override map; ignores
// the actual override value.
export function isStyleFieldOverridden(
  page: PresentationPage,
  layerId: string,
  field: keyof EditableStyle,
): boolean {
  const o = page.layerOverrides?.[layerId];
  if (!o) return false;
  return field in o;
}

export function isVisibilityOverridden(
  page: PresentationPage,
  layerId: string,
): boolean {
  return page.visibilityOverrides?.[layerId] !== undefined;
}

// ---- Scene overlays ------------------------------------------------------
//
// Scene overlays are environment-defined and per-page activated. Resolution
// rules (Week 5):
//   - Iterate every overlay registered in env.sceneOverlays.
//   - If the page lists an overlay (matching id), apply its visible/opacity
//     overrides; visible defaults to true, opacity falls back to the env's
//     defaultOpacity then to 0.85.
//   - If the page does NOT list an overlay, it's hidden (opacity treated as
//     0; visible:false). The renderer animates this to a fade-out.
//
// Returns one entry per registered overlay so the renderer always knows the
// full set of meshes; the `visible` flag drives whether to fade in or out.

export interface ResolvedSceneOverlay {
  id: string;
  def: SceneOverlayDef;
  visible: boolean;
  opacity: number;
  /** Effective hex tint multiplier; "#ffffff" if unset everywhere. */
  tint: string;
}

export function effectiveSceneOverlays(
  environment: EnvironmentSetup,
  page: PresentationPage,
): ResolvedSceneOverlay[] {
  const registry = environment.sceneOverlays ?? {};
  const refs = page.sceneOverlays ?? [];
  const refById = new Map(refs.map((r) => [r.id, r]));
  const out: ResolvedSceneOverlay[] = [];
  for (const [id, def] of Object.entries(registry)) {
    const tint = def.tint ?? "#ffffff";
    // Env-level disable wins over any per-page reference.
    if (def.enabled === false) {
      out.push({ id, def, visible: false, opacity: 0, tint });
      continue;
    }
    const ref = refById.get(id);
    if (!ref) {
      out.push({ id, def, visible: false, opacity: 0, tint });
      continue;
    }
    const visible = ref.visible !== false;
    const opacity =
      typeof ref.opacity === "number"
        ? ref.opacity
        : (def.defaultOpacity ?? 0.85);
    const refTint = ref.tint ?? tint;
    out.push({
      id,
      def,
      visible,
      opacity: visible ? opacity : 0,
      tint: refTint,
    });
  }
  return out;
}
