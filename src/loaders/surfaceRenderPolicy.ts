import * as THREE from "three";

export const SURFACE_RENDER_ORDER = {
  meshPreview: 11.8,
  outerMeshPreview: 11.6,
  contourLine: 12.9,
  boundaryLine: 13.1,
  depthOccluder: 12.7,
  photoOverlayPreview: 13.2,
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
  surfaceClearanceM: 0.12,
  opacity: 0.58,
  polygonOffsetFactor: -16,
  polygonOffsetUnits: -16,
} as const;

export const MT_THRESHOLD_SURFACE_POLICY = {
  name: "solid-mt-threshold-surface-preview",
  material: {
    opacity: 0.86,
    roughness: 0.64,
    metalness: 0,
    emissiveIntensity: 0.08,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
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
    depthWrite: true,
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
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: PHOTO_OVERLAY_PREVIEW_POLICY.opacity,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: PHOTO_OVERLAY_PREVIEW_POLICY.polygonOffsetFactor,
    polygonOffsetUnits: PHOTO_OVERLAY_PREVIEW_POLICY.polygonOffsetUnits,
    toneMapped: true,
  });
  material.userData.preserveMaterialColor = true;
  material.userData.surfaceRenderPolicy = PHOTO_OVERLAY_PREVIEW_POLICY.name;
  material.userData.frontFacePolicy = PHOTO_OVERLAY_PREVIEW_POLICY.frontFace;
  return material;
}
