import * as THREE from "three";
import type { EditableStyle, SceneProperties } from "../pages/types";
import type { TerrainMaterialHandle } from "../scene/terrainMaterial";
import {
  LIGHT_MODE_TERRAIN_RAMP_HIGH,
  LIGHT_MODE_TERRAIN_RAMP_LOW,
  LIGHT_MODE_TERRAIN_RAMP_MID,
  assetUrl,
  styleNumber,
} from "./runtimeUtils";
import {
  normalizeTopoEdgeFadeShape,
  type TopoEdgeFadeShape,
} from "./edgeFade";

interface TerrainGridHandle {
  update(params?: NonNullable<SceneProperties["terrain"]>): void;
  updateCameraVisibility(camera: THREE.Camera): void;
}

interface TerrainLodHandle {
  updateCameraLod(camera: THREE.Camera): void;
}

export interface TerrainEdgeFadeState {
  boundsMin: THREE.Vector2;
  boundsMax: THREE.Vector2;
  shape: TopoEdgeFadeShape;
  fadeDistanceM: number;
  insetM: number;
  cornerRadiusM: number;
}

export interface TopoSurfaceRuntimeOptions {
  resolveAssetPath(path: string): string;
  maxAnisotropy(): number;
}

export interface TopoSurfaceEnvironmentParams {
  terrainGroup: THREE.Group | undefined;
  terrain: NonNullable<SceneProperties["terrain"]>;
  sunDirection: THREE.Vector3;
  fogColor: THREE.Color;
  fogDensity: number;
  lightMode: boolean;
}

export interface TopoSurfaceFogFrameParams {
  terrainGroup: THREE.Group | undefined;
  fogColor: THREE.Color;
  fogDensity: number;
}

export interface TopoSurfaceLiftParams {
  layerId: string;
  style: EditableStyle;
  surfaceLayerId: string;
  publicLayerIds: string[];
  getLayerGroup(id: string): THREE.Group | undefined;
  isSurfaceLayerId(id: string): boolean;
  getLayerStyle(id: string): EditableStyle;
}

export function topoImageUtmBoundsToSceneBounds({
  terrainUtmBounds,
  terrainSceneBounds,
  imageUtmBounds,
}: {
  terrainUtmBounds: [number, number, number, number];
  terrainSceneBounds: [number, number, number, number];
  imageUtmBounds: [number, number, number, number];
}): [number, number, number, number] {
  const [terrainMinX, terrainMinY] = terrainUtmBounds;
  const [sceneMinX, sceneMinY] = terrainSceneBounds;
  const [imageMinX, imageMinY, imageMaxX, imageMaxY] = imageUtmBounds;
  return [
    imageMinX - (terrainMinX - sceneMinX),
    imageMinY - (terrainMinY - sceneMinY),
    imageMaxX - (terrainMinX - sceneMinX),
    imageMaxY - (terrainMinY - sceneMinY),
  ];
}

type TerrainSettings = NonNullable<SceneProperties["terrain"]>;
type TopoImageDetailOverlay = NonNullable<
  NonNullable<TerrainSettings["topoImageMaterialSources"]>[number]["detailOverlays"]
>[number];

function configureTopoTexture(
  texture: THREE.Texture,
  maxAnisotropy: number,
): void {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  const powerOfTwo =
    THREE.MathUtils.isPowerOfTwo(width) && THREE.MathUtils.isPowerOfTwo(height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.minFilter = powerOfTwo
    ? THREE.LinearMipmapLinearFilter
    : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = powerOfTwo;
  texture.needsUpdate = true;
}

export class TopoSurfaceRuntime {
  private terrain: NonNullable<SceneProperties["terrain"]> = {};
  private orthoPhotoTexturePath: string | null = null;
  private orthoPhotoTexture: THREE.Texture | null = null;
  private orthoPhotoTextureSeq = 0;
  private topoImageDetailTexturePath: string | null = null;
  private topoImageDetailTexture: THREE.Texture | null = null;
  private topoImageDetailTextureSeq = 0;

  constructor(private readonly options: TopoSurfaceRuntimeOptions) {}

  setTerrain(terrain: NonNullable<SceneProperties["terrain"]>): void {
    this.terrain = terrain;
  }

  dispose(): void {
    this.clearOrthoPhotoTexture(undefined);
    this.clearTopoImageDetailOverlay(undefined);
  }

  disposeOrthoPhotoTexture(terrainGroup: THREE.Group | undefined): void {
    this.clearOrthoPhotoTexture(terrainGroup);
  }

  applySunDirection(
    terrainGroup: THREE.Group | undefined,
    sunDirection: THREE.Vector3,
  ): void {
    terrainGroup?.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      handle?.setSunDirection(sunDirection);
    });
  }

  applyEnvironment(params: TopoSurfaceEnvironmentParams): void {
    const { terrainGroup, terrain, sunDirection, fogColor, fogDensity, lightMode } =
      params;
    this.terrain = terrain;
    if (terrainGroup) {
      terrainGroup.traverse((obj) => {
        const userData = (obj as THREE.Mesh).userData;
        const handle = userData?.terrainHandle as
          | TerrainMaterialHandle
          | undefined;
        if (!handle) return;
        handle.setSunDirection(sunDirection);
        handle.setParams(terrain);
        const gridHandle = userData?.terrainGridHandle as
          | TerrainGridHandle
          | undefined;
        gridHandle?.update(terrain);
        if (lightMode) {
          handle.setParams({
            rampLow: LIGHT_MODE_TERRAIN_RAMP_LOW,
            rampMid: LIGHT_MODE_TERRAIN_RAMP_MID,
            rampHigh: LIGHT_MODE_TERRAIN_RAMP_HIGH,
          });
        }
        handle.setParams({
          fogColor: "#" + fogColor.getHexString(),
          fogNear: 0,
          fogFar: 3 / Math.max(fogDensity, 0.000001),
        });
      });
    }
    this.applyOrthoPhotoBounds(terrainGroup, terrain);
    this.applyOrthoPhotoTexture(terrainGroup, terrain);
    this.applyTopoImageDetailOverlay(terrainGroup, terrain);
  }

  applyFogFrame({
    terrainGroup,
    fogColor,
    fogDensity,
  }: TopoSurfaceFogFrameParams): void {
    terrainGroup?.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData
        ?.terrainHandle as TerrainMaterialHandle | undefined;
      if (!handle) return;
      handle.setParams({
        fogColor: "#" + fogColor.getHexString(),
        fogNear: 0,
        fogFar: 3 / Math.max(fogDensity, 0.000001),
      });
    });
  }

  updateGridCameraVisibility(
    terrainGroup: THREE.Group | undefined,
    camera: THREE.Camera,
  ): void {
    terrainGroup?.traverse((obj) => {
      const lodHandle = (obj as THREE.Object3D).userData?.terrainLodHandle as
        | TerrainLodHandle
        | undefined;
      lodHandle?.updateCameraLod(camera);
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      handle?.setCameraPosition(camera.position);
      const gridHandle = (obj as THREE.Mesh).userData?.terrainGridHandle as
        | TerrainGridHandle
        | undefined;
      gridHandle?.updateCameraVisibility(camera);
    });
  }

  applyLiftStyle(params: TopoSurfaceLiftParams): void {
    const {
      layerId,
      style,
      surfaceLayerId,
      publicLayerIds,
      getLayerGroup,
      isSurfaceLayerId,
      getLayerStyle,
    } = params;
    if (!isSurfaceLayerId(layerId) && !publicLayerIds.includes(layerId)) {
      return;
    }
    const terrainStyle =
      layerId === surfaceLayerId ? style : getLayerStyle(surfaceLayerId);
    const liftM = styleNumber(
      terrainStyle,
      "meshSurfaceLiftM",
      0,
      -12000,
      12000,
    );
    for (const publicLayerId of publicLayerIds) {
      const group = getLayerGroup(publicLayerId);
      if (!group) continue;
      if (publicLayerId === surfaceLayerId) {
        group.traverse((obj) => {
          const terrainMesh = obj as THREE.Mesh;
          if (!terrainMesh.userData?.terrainHandle) return;
          const baseZ =
            typeof terrainMesh.userData.terrainBaseZ === "number"
              ? terrainMesh.userData.terrainBaseZ
              : terrainMesh.position.z;
          terrainMesh.userData.terrainBaseZ = baseZ;
          terrainMesh.position.z = baseZ;
        });
      }
      const baseZ =
        typeof group.userData.publicSurfaceBaseZ === "number"
          ? group.userData.publicSurfaceBaseZ
          : group.position.z;
      group.userData.publicSurfaceBaseZ = baseZ;
      group.position.z = baseZ + liftM;
      group.updateMatrixWorld(true);
    }
  }

  applyVerticalExaggeration({
    terrain,
    publicLayerIds,
    getLayerGroup,
  }: {
    terrain: TerrainSettings;
    publicLayerIds: string[];
    getLayerGroup(id: string): THREE.Group | undefined;
  }): void {
    const exaggeration = THREE.MathUtils.clamp(
      terrain.verticalExaggeration ?? 1,
      0.05,
      20,
    );
    for (const layerId of publicLayerIds) {
      const group = getLayerGroup(layerId);
      if (!group) continue;
      const baseScaleZ =
        typeof group.userData.topoVerticalBaseScaleZ === "number"
          ? group.userData.topoVerticalBaseScaleZ
          : group.scale.z;
      group.userData.topoVerticalBaseScaleZ = baseScaleZ;
      group.scale.z = baseScaleZ * exaggeration;
      group.updateMatrixWorld(true);
    }
  }

  resolveEdgeFadeState(
    terrainGroup: THREE.Group | undefined,
  ): TerrainEdgeFadeState | null {
    let boundsMin: THREE.Vector2 | null = null;
    let boundsMax: THREE.Vector2 | null = null;
    terrainGroup?.traverse((obj) => {
      if (boundsMin && boundsMax) return;
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      const uniforms = handle?.material.uniforms as
        | Record<string, { value: unknown }>
        | undefined;
      const min = uniforms?.uTerrainBoundsMin?.value as
        | THREE.Vector2
        | undefined;
      const max = uniforms?.uTerrainBoundsMax?.value as
        | THREE.Vector2
        | undefined;
      if (min && max) {
        boundsMin = min.clone();
        boundsMax = max.clone();
      }
    });
    if (!boundsMin || !boundsMax) return null;
    return {
      boundsMin,
      boundsMax,
      shape: normalizeTopoEdgeFadeShape(this.terrain.edgeFadeShape),
      fadeDistanceM: Math.max(0, this.terrain.edgeFadeDistanceM ?? 0),
      insetM: Math.max(0, this.terrain.edgeFadeInsetM ?? 0),
      cornerRadiusM: Math.max(0, this.terrain.edgeFadeCornerRadiusM ?? 0),
    };
  }

  private setOrthoPhotoTexture(
    terrainGroup: THREE.Group | undefined,
    texture: THREE.Texture | null,
  ): void {
    terrainGroup?.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      handle?.setOrthoPhotoTexture(texture);
    });
  }

  private setTopoImageDetailOverlay(
    terrainGroup: THREE.Group | undefined,
    texture: THREE.Texture | null,
    sceneBounds?: [number, number, number, number],
    overlay?: TopoImageDetailOverlay,
  ): void {
    terrainGroup?.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (texture && sceneBounds) {
        handle?.setTopoImageDetailOverlay(
          texture,
          [sceneBounds[0], sceneBounds[1]],
          [sceneBounds[2], sceneBounds[3]],
          overlay?.opacity ?? 1,
          overlay?.edgeFeatherM ?? 0,
        );
      } else {
        handle?.setTopoImageDetailOverlay(null);
      }
    });
  }

  private terrainSceneBounds(
    handle: TerrainMaterialHandle,
  ): [number, number, number, number] | null {
    const uniforms = handle.material.uniforms as
      | Record<string, { value: unknown }>
      | undefined;
    const sceneMin = uniforms?.uTerrainBoundsMin?.value as
      | THREE.Vector2
      | undefined;
    const sceneMax = uniforms?.uTerrainBoundsMax?.value as
      | THREE.Vector2
      | undefined;
    if (!sceneMin || !sceneMax) return null;
    return [sceneMin.x, sceneMin.y, sceneMax.x, sceneMax.y];
  }

  private terrainMaterialContext(
    terrainGroup: THREE.Group | undefined,
  ): { terrainObject: THREE.Object3D; handle: TerrainMaterialHandle } | null {
    const groupHandle = terrainGroup?.userData?.terrainHandle as
      | TerrainMaterialHandle
      | undefined;
    if (terrainGroup && groupHandle) {
      return { terrainObject: terrainGroup, handle: groupHandle };
    }
    let context:
      | { terrainObject: THREE.Object3D; handle: TerrainMaterialHandle }
      | null = null;
    terrainGroup?.traverse((obj) => {
      if (context) return;
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (handle) context = { terrainObject: obj, handle };
    });
    return context;
  }

  private sceneBoundsForImageUtmBounds(
    terrainObject: THREE.Object3D,
    handle: TerrainMaterialHandle,
    imageUtmBounds: [number, number, number, number],
  ): [number, number, number, number] | null {
    const terrainUtmBounds = terrainObject.userData?.terrainUtmBounds as
      | [number, number, number, number]
      | undefined;
    const terrainSceneBounds = this.terrainSceneBounds(handle);
    if (!terrainUtmBounds || !terrainSceneBounds) return null;
    return topoImageUtmBoundsToSceneBounds({
      terrainUtmBounds,
      terrainSceneBounds,
      imageUtmBounds,
    });
  }

  private applyTopoImageDetailBounds(
    terrainGroup: THREE.Group | undefined,
    overlay: TopoImageDetailOverlay,
    texture: THREE.Texture | null,
    opacity: number = overlay.opacity ?? 1,
  ): void {
    terrainGroup?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const handle = mesh.userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      const sceneBounds = this.sceneBoundsForImageUtmBounds(
        mesh,
        handle,
        overlay.bounds,
      );
      if (texture && sceneBounds) {
        handle.setTopoImageDetailOverlay(
          texture,
          [sceneBounds[0], sceneBounds[1]],
          [sceneBounds[2], sceneBounds[3]],
          opacity,
          overlay.edgeFeatherM ?? 0,
        );
      } else {
        handle.setTopoImageDetailOverlay(null);
      }
    });
  }

  private applyOrthoPhotoBounds(
    terrainGroup: THREE.Group | undefined,
    terrain: NonNullable<SceneProperties["terrain"]>,
  ): void {
    const bounds = terrain.orthoPhotoBounds;
    if (!Array.isArray(bounds) || bounds.length !== 4) return;
    const [imageMinX, imageMinY, imageMaxX, imageMaxY] = bounds;
    if (
      !Number.isFinite(imageMinX) ||
      !Number.isFinite(imageMinY) ||
      !Number.isFinite(imageMaxX) ||
      !Number.isFinite(imageMaxY) ||
      imageMaxX <= imageMinX ||
      imageMaxY <= imageMinY
    ) {
      return;
    }
    const context = this.terrainMaterialContext(terrainGroup);
    if (!context) return;
    const sceneBounds = this.sceneBoundsForImageUtmBounds(
      context.terrainObject,
      context.handle,
      [imageMinX, imageMinY, imageMaxX, imageMaxY],
    );
    if (!sceneBounds) return;
    context.handle.setOrthoPhotoBounds(
      [sceneBounds[0], sceneBounds[1]],
      [sceneBounds[2], sceneBounds[3]],
    );
  }

  private clearOrthoPhotoTexture(terrainGroup: THREE.Group | undefined): void {
    this.orthoPhotoTextureSeq += 1;
    this.orthoPhotoTexturePath = null;
    if (this.orthoPhotoTexture) {
      this.orthoPhotoTexture.dispose();
      this.orthoPhotoTexture = null;
    }
    this.setOrthoPhotoTexture(terrainGroup, null);
  }

  private selectedTopoImageDetailOverlay(
    terrain: NonNullable<SceneProperties["terrain"]>,
  ): TopoImageDetailOverlay | null {
    const preset = terrain.materialPreset;
    if (typeof preset !== "string" || !preset.startsWith("image:")) return null;
    const sourceId = preset.slice("image:".length);
    const source = (terrain.topoImageMaterialSources ?? []).find(
      (candidate) => candidate.id === sourceId,
    );
    return source?.detailOverlays?.[0] ?? null;
  }

  private texturePathForBudget(
    source: {
      texturePath?: string;
      texture4096Path?: string;
      texture8192Path?: string;
      textureBudget?: 4096 | 8192;
    },
    terrain: NonNullable<SceneProperties["terrain"]>,
  ): string | undefined {
    const budget =
      terrain.orthoPhotoTextureBudget === 8192
        ? 8192
        : terrain.orthoPhotoTextureBudget === 4096
          ? 4096
          : source.textureBudget === 8192
            ? 8192
            : 4096;
    return budget === 8192
      ? source.texture8192Path ?? source.texturePath
      : source.texture4096Path ?? source.texturePath;
  }

  private clearTopoImageDetailOverlay(
    terrainGroup: THREE.Group | undefined,
  ): void {
    this.topoImageDetailTextureSeq += 1;
    this.topoImageDetailTexturePath = null;
    if (this.topoImageDetailTexture) {
      this.topoImageDetailTexture.dispose();
      this.topoImageDetailTexture = null;
    }
    this.setTopoImageDetailOverlay(terrainGroup, null);
  }

  private applyTopoImageDetailOverlay(
    terrainGroup: THREE.Group | undefined,
    terrain: NonNullable<SceneProperties["terrain"]>,
  ): void {
    const overlay = this.selectedTopoImageDetailOverlay(terrain);
    const path = overlay ? this.texturePathForBudget(overlay, terrain)?.trim() : "";
    const materialOpacity =
      typeof terrain.orthoPhotoOpacity === "number" ? terrain.orthoPhotoOpacity : 1;
    const opacity =
      (overlay && typeof overlay.opacity === "number" ? overlay.opacity : 1) *
      materialOpacity;
    if (!overlay || !path || opacity <= 0.001) {
      if (this.topoImageDetailTexturePath || this.topoImageDetailTexture) {
        this.clearTopoImageDetailOverlay(terrainGroup);
      } else {
        this.setTopoImageDetailOverlay(terrainGroup, null);
      }
      return;
    }

    if (this.topoImageDetailTexturePath === path) {
      this.applyTopoImageDetailBounds(
        terrainGroup,
        overlay,
        this.topoImageDetailTexture,
        opacity,
      );
      return;
    }

    this.clearTopoImageDetailOverlay(terrainGroup);
    this.topoImageDetailTexturePath = path;
    const seq = ++this.topoImageDetailTextureSeq;
    const url = assetUrl(path, this.options.resolveAssetPath);
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (
          seq !== this.topoImageDetailTextureSeq ||
          this.topoImageDetailTexturePath !== path
        ) {
          texture.dispose();
          return;
        }
        configureTopoTexture(texture, this.options.maxAnisotropy());
        this.topoImageDetailTexture = texture;
        this.applyTopoImageDetailBounds(terrainGroup, overlay, texture, opacity);
      },
      undefined,
      (error) => {
        if (seq === this.topoImageDetailTextureSeq) {
          console.error(
            `[TopoMapRuntime] topo image detail texture failed: ${url}`,
            error,
          );
          this.clearTopoImageDetailOverlay(terrainGroup);
        }
      },
    );
  }

  private applyOrthoPhotoTexture(
    terrainGroup: THREE.Group | undefined,
    terrain: NonNullable<SceneProperties["terrain"]>,
  ): void {
    const opacity =
      typeof terrain.orthoPhotoOpacity === "number"
        ? terrain.orthoPhotoOpacity
        : 0;
    const path = opacity > 0.001 ? terrain.orthoPhotoPath?.trim() : "";
    if (!path) {
      if (this.orthoPhotoTexturePath || this.orthoPhotoTexture) {
        this.clearOrthoPhotoTexture(terrainGroup);
      } else {
        this.setOrthoPhotoTexture(terrainGroup, null);
      }
      return;
    }

    if (this.orthoPhotoTexturePath === path) {
      if (this.orthoPhotoTexture) {
        this.setOrthoPhotoTexture(terrainGroup, this.orthoPhotoTexture);
      }
      return;
    }

    this.clearOrthoPhotoTexture(terrainGroup);
    this.orthoPhotoTexturePath = path;
    const seq = ++this.orthoPhotoTextureSeq;
    const url = assetUrl(path, this.options.resolveAssetPath);
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (
          seq !== this.orthoPhotoTextureSeq ||
          this.orthoPhotoTexturePath !== path
        ) {
          texture.dispose();
          return;
        }
        configureTopoTexture(texture, this.options.maxAnisotropy());
        this.orthoPhotoTexture = texture;
        this.setOrthoPhotoTexture(terrainGroup, texture);
      },
      undefined,
      (error) => {
        if (seq === this.orthoPhotoTextureSeq) {
          console.error(`[TopoMapRuntime] ortho photo texture failed: ${url}`, error);
          this.clearOrthoPhotoTexture(terrainGroup);
        }
      },
    );
  }
}
