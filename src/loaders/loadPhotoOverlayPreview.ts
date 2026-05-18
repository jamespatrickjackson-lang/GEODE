import * as THREE from "three";
import {
  PHOTO_OVERLAY_PREVIEW_POLICY,
  SURFACE_RENDER_ORDER,
  createPhotoOverlayMaterial,
} from "./surfaceRenderPolicy";

interface PhotoOverlayManifest {
  schema: "geosee.photo-overlay-preview.v1";
  label?: string;
  source?: Record<string, unknown>;
  processing?: Record<string, unknown>;
  photos: PhotoOverlayPhoto[];
}

interface PhotoOverlayPhoto {
  id: string;
  imageId: number;
  label: string;
  texture: string;
  sourceImage?: string;
  previewSizePx?: [number, number];
  camera?: Record<string, unknown>;
  projection: {
    gridCols: number;
    gridRows: number;
    vertices: number[];
    uvs: number[];
    indices: number[];
    hitCount: number;
    sampleCount: number;
    hitRatio: number;
    footprintAreaM2?: number;
    surfaceHits?: Record<string, number>;
  };
}

function textureUrl(manifestUrl: string, texturePath: string): string {
  const resolvedManifestUrl = new URL(manifestUrl, window.location.href);
  return new URL(texturePath, resolvedManifestUrl).toString();
}

function makePhotoGeometry(photo: PhotoOverlayPhoto): THREE.BufferGeometry | null {
  const { vertices, uvs, indices } = photo.projection;
  if (
    vertices.length < 9 ||
    vertices.length % 3 !== 0 ||
    uvs.length !== (vertices.length / 3) * 2 ||
    indices.length < 3 ||
    indices.length % 3 !== 0
  ) {
    return null;
  }

  const positions = new Float32Array(vertices);
  for (let i = 2; i < positions.length; i += 3) {
    positions[i] += PHOTO_OVERLAY_PREVIEW_POLICY.surfaceClearanceM;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export async function loadPhotoOverlayPreview(
  manifestUrl: string,
): Promise<THREE.Group> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch photo overlay manifest ${manifestUrl}: ${response.status}`,
    );
  }

  const manifest = (await response.json()) as PhotoOverlayManifest;
  if (
    manifest.schema !== "geosee.photo-overlay-preview.v1" ||
    !Array.isArray(manifest.photos)
  ) {
    throw new Error(`Invalid photo overlay manifest: ${manifestUrl}`);
  }

  const group = new THREE.Group();
  group.name = manifest.label ?? "Photo overlay preview";
  group.userData.displayName = manifest.label ?? "Photo overlay preview";
  group.userData.source = manifest.source;
  group.userData.processing = manifest.processing;

  const loader = new THREE.TextureLoader();
  const entries = await Promise.all(
    manifest.photos.map(async (photo) => {
      const geometry = makePhotoGeometry(photo);
      if (!geometry) return null;

      const texture = await loader
        .loadAsync(textureUrl(manifestUrl, photo.texture))
        .catch((error) => {
          console.error(
            `Failed to load Shahbazi photo overlay texture ${photo.texture}:`,
            error,
          );
          return null;
        });
      if (!texture) return null;

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;

      const material = createPhotoOverlayMaterial(texture);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = photo.label;
      mesh.renderOrder = SURFACE_RENDER_ORDER.photoOverlayPreview;
      mesh.userData = {
        displayName: photo.label,
        sourceImage: photo.sourceImage,
        imageId: photo.imageId,
        previewSizePx: photo.previewSizePx,
        camera: photo.camera,
        projection: photo.projection,
        photoOverlayPreview: true,
        surfaceRenderPolicy: PHOTO_OVERLAY_PREVIEW_POLICY.name,
        frontFacePolicy: PHOTO_OVERLAY_PREVIEW_POLICY.frontFace,
      };
      return mesh;
    }),
  );

  for (const entry of entries) {
    if (entry) group.add(entry);
  }

  return group;
}
