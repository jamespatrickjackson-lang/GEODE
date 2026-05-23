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

export interface TopoSurfaceLiftParams {
  layerId: string;
  style: EditableStyle;
  surfaceLayerId: string;
  publicLayerIds: string[];
  getLayerGroup(id: string): THREE.Group | undefined;
  isSurfaceLayerId(id: string): boolean;
  getLayerStyle(id: string): EditableStyle;
}

export class TopoSurfaceRuntime {
  private terrain: NonNullable<SceneProperties["terrain"]> = {};
  private orthoPhotoTexturePath: string | null = null;
  private orthoPhotoTexture: THREE.Texture | null = null;
  private orthoPhotoTextureSeq = 0;

  constructor(private readonly options: TopoSurfaceRuntimeOptions) {}

  setTerrain(terrain: NonNullable<SceneProperties["terrain"]>): void {
    this.terrain = terrain;
  }

  dispose(): void {
    this.clearOrthoPhotoTexture(undefined);
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
    this.applyOrthoPhotoTexture(terrainGroup, terrain);
  }

  updateGridCameraVisibility(
    terrainGroup: THREE.Group | undefined,
    camera: THREE.Camera,
  ): void {
    terrainGroup?.traverse((obj) => {
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

  private clearOrthoPhotoTexture(terrainGroup: THREE.Group | undefined): void {
    this.orthoPhotoTextureSeq += 1;
    this.orthoPhotoTexturePath = null;
    if (this.orthoPhotoTexture) {
      this.orthoPhotoTexture.dispose();
      this.orthoPhotoTexture = null;
    }
    this.setOrthoPhotoTexture(terrainGroup, null);
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
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.options.maxAnisotropy();
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
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
