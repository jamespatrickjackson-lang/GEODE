import * as THREE from "three";

export const SURFACE_RENDER_ORDER = {
  meshPreview: 11.8,
  outerMeshPreview: 11.6,
  contourLine: 12.9,
  boundaryLine: 13.1,
  depthOccluder: 12.7,
  photoOverlayPreview: 13.2,
  sectionIsoOverlay: 13.4,
} as const;

export const SURFACE_PREVIEW_DEPTH_POLICY = {
  name: "depth-occluding-transparent-surface-preview",
  material: {
    opacity: 0.52,
    roughness: 0.72,
    metalness: 0.02,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  },
  occluder: {
    polygonOffsetFactor: 8,
    polygonOffsetUnits: 8,
  },
} as const;

export const PHOTO_OVERLAY_PREVIEW_POLICY = {
  name: "projected-image-alignment-preview",
  frontFace: "uav-camera-facing",
  // Geometric clearance lift above the substrate; the drape relies on this plus
  // renderOrder + depthTest (no polygonOffset) so it is depth-convention-robust.
  surfaceClearanceM: 0.12,
  opacity: 0.58,
} as const;

export const MT_THRESHOLD_SURFACE_POLICY = {
  name: "solid-mt-threshold-surface-preview",
  opaqueOpacityThreshold: 0.999,
  material: {
    opacity: 0.86,
    roughness: 0.64,
    metalness: 0,
    emissiveIntensity: 0.08,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  },
} as const;

export function applyMtThresholdSurfaceMaterialOpacity(
  material: THREE.Material,
  opacity: number,
  wireframe: boolean,
  preserveBase: boolean,
): void {
  const next = THREE.MathUtils.clamp(
    Number.isFinite(opacity) ? opacity : MT_THRESHOLD_SURFACE_POLICY.material.opacity,
    0,
    1,
  );
  // R10: a feathered surface carries per-vertex alpha that the opaque fast-path
  // would discard (transparent=false drops vertex alpha), so it must stay
  // transparent regardless of the layer opacity.
  const feathered = material.userData.mtThresholdSurfaceFeathered === true;
  const opaque =
    !feathered &&
    !wireframe &&
    next >= MT_THRESHOLD_SURFACE_POLICY.opaqueOpacityThreshold;
  material.opacity = opaque ? 1 : next;
  material.transparent = !opaque;
  material.depthTest = true;
  // Feathered surfaces are mostly opaque (only the sparsest rind fades), so keep
  // depth writes on to avoid see-through ghosting of the solid bulk.
  material.depthWrite = opaque || feathered;
  material.userData.preserveMaterialOpacity = true;
  material.userData.mtThresholdSurfaceEffectiveOpacity = material.opacity;
  material.userData.mtThresholdSurfaceOpaque = opaque;
  if (preserveBase) {
    material.userData.preserveMaterialOpacityBase = material.opacity;
  }
  material.needsUpdate = true;
}

export const SECTION_ISO_OVERLAY_POLICY = {
  name: "section-iso-overlay",
  liftM: 18,
  lineWidthMPerPx: 45,
  renderOrder: SURFACE_RENDER_ORDER.sectionIsoOverlay,
  material: {
    bandDepthTest: true,
    lineDepthTest: false,
    depthWrite: false,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  },
} as const;

export function createSurfacePreviewMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: SURFACE_PREVIEW_DEPTH_POLICY.material.opacity,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    roughness: SURFACE_PREVIEW_DEPTH_POLICY.material.roughness,
    metalness: SURFACE_PREVIEW_DEPTH_POLICY.material.metalness,
    polygonOffset: true,
    polygonOffsetFactor:
      SURFACE_PREVIEW_DEPTH_POLICY.material.polygonOffsetFactor,
    polygonOffsetUnits:
      SURFACE_PREVIEW_DEPTH_POLICY.material.polygonOffsetUnits,
  });
  material.userData.forceTransparent = true;
  material.userData.preserveVertexColors = true;
  material.userData.surfaceRenderPolicy = SURFACE_PREVIEW_DEPTH_POLICY.name;
  return material;
}

export function createMtThresholdSurfaceMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: MT_THRESHOLD_SURFACE_POLICY.material.opacity,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: MT_THRESHOLD_SURFACE_POLICY.material.roughness,
    metalness: MT_THRESHOLD_SURFACE_POLICY.material.metalness,
    emissive: 0xffffff,
    emissiveIntensity: MT_THRESHOLD_SURFACE_POLICY.material.emissiveIntensity,
    polygonOffset: true,
    polygonOffsetFactor:
      MT_THRESHOLD_SURFACE_POLICY.material.polygonOffsetFactor,
    polygonOffsetUnits:
      MT_THRESHOLD_SURFACE_POLICY.material.polygonOffsetUnits,
  });
  material.userData.preserveVertexColors = true;
  material.userData.surfaceRenderPolicy = MT_THRESHOLD_SURFACE_POLICY.name;
  applyMtThresholdSurfaceMaterialOpacity(
    material,
    MT_THRESHOLD_SURFACE_POLICY.material.opacity,
    false,
    true,
  );
  return material;
}

export function createSurfaceDepthOccluderMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor:
      SURFACE_PREVIEW_DEPTH_POLICY.occluder.polygonOffsetFactor,
    polygonOffsetUnits:
      SURFACE_PREVIEW_DEPTH_POLICY.occluder.polygonOffsetUnits,
  });
  material.userData.ignoreLayerStyle = true;
  material.userData.ignoreLayerFog = true;
  material.userData.surfaceRenderPolicy = SURFACE_PREVIEW_DEPTH_POLICY.name;
  return material;
}

export function createPhotoOverlayMaterial(
  texture: THREE.Texture,
): THREE.MeshBasicMaterial {
  // Reverse-Z interim fix (Gravel Pit Reverse-Z Surface Regression issue
  // audit): the projected image drape sits on the gravel-pit
  // ground surface via its geometric clearance lift (surfaceClearanceM, applied
  // in makePhotoGeometry) plus renderOrder, depth-tested against the now-opaque
  // substrate. The previous load-bearing polygonOffset was silently inverted by
  // the global reverse-Z depth buffer (pushing the image behind the surface and
  // tearing it), so it is removed here. This function is gravel-pit-exclusive
  // (only loadPhotoOverlayPreview uses it); Utah FORGE is unaffected.
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: PHOTO_OVERLAY_PREVIEW_POLICY.opacity,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: true,
  });
  material.userData.preserveMaterialColor = true;
  material.userData.surfaceRenderPolicy = PHOTO_OVERLAY_PREVIEW_POLICY.name;
  material.userData.frontFacePolicy = PHOTO_OVERLAY_PREVIEW_POLICY.frontFace;
  return material;
}
