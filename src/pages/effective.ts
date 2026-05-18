import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  SceneOverlayDef,
} from "./types";
import {
  activeRenderPresetIdForPage,
  contourStylePatchForLayer,
  projectRenderPresets,
  publicContextStylePatchForLayer,
} from "./renderPresets";

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
  const merged = { ...base, ...presetPatch, ...contourPatch, ...override };
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
  return merged;
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
