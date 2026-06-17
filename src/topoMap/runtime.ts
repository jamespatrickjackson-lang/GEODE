import * as THREE from "three";
import type { EditableStyle, SceneProperties } from "../pages/types";
import { applyTopoGraticuleStyle } from "./graticuleRuntime";
import {
  PublicSurfaceClipRuntime,
  publicSurfaceClipBox,
  publicSurfaceClipPlanes,
} from "./publicSurfaceClipRuntime";
import { TopoMapBrandingRuntime } from "./brandingRuntime";
import { TopoSurfaceRuntime } from "./surfaceRuntime";

export interface TopoMapRuntimeOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  resolveAssetPath(path: string): string;
  getMaxAnisotropy(): number;
  getLayerGroup(id: string): THREE.Group | undefined;
  getLayerStyle(id: string): EditableStyle;
  getSurfaceLayerId(): string;
  getGraticuleLayerIds(): string[];
  getPublicSurfaceLayerIds(): string[];
  isSurfaceLayerId(id: string): boolean;
  isGraticuleLayerId(id: string): boolean;
  getEditorMode(): boolean;
  onPublicSurfaceClippingActive(active: boolean): void;
  updateRendererLocalClipping(): void;
}

export interface ApplyTopoMapEnvironmentParams {
  sceneProperties: SceneProperties;
  sunDirection: THREE.Vector3;
  fogColor: THREE.Color;
  fogDensity: number;
  lightMode: boolean;
}

export interface ApplyTopoMapFogFrameParams {
  fogColor: THREE.Color;
  fogDensity: number;
}

export class TopoMapRuntime {
  private readonly surface: TopoSurfaceRuntime;
  private readonly clip: PublicSurfaceClipRuntime;
  private readonly branding: TopoMapBrandingRuntime;

  constructor(private readonly options: TopoMapRuntimeOptions) {
    this.surface = new TopoSurfaceRuntime({
      resolveAssetPath: options.resolveAssetPath,
      maxAnisotropy: options.getMaxAnisotropy,
    });
    this.clip = new PublicSurfaceClipRuntime(options.scene);
    this.branding = new TopoMapBrandingRuntime({
      scene: options.scene,
      resolveAssetPath: options.resolveAssetPath,
    });
  }

  dispose(): void {
    this.branding.dispose();
    this.clip.dispose();
    this.surface.dispose();
    this.options.onPublicSurfaceClippingActive(false);
    this.options.updateRendererLocalClipping();
  }

  notifyResize(width: number, height: number): void {
    this.clip.notifyResize(width, height);
  }

  isPublicSurfaceClippingActive(): boolean {
    return this.clip.isActive();
  }

  setEditorMode(enabled: boolean): void {
    this.clip.setEditorMode(enabled);
  }

  setCurrentTerrain(
    terrain: NonNullable<SceneProperties["terrain"]> = {},
  ): void {
    this.surface.setTerrain(terrain);
  }

  applySunDirection(sunDirection: THREE.Vector3): void {
    this.surface.applySunDirection(this.surfaceGroup(), sunDirection);
  }

  updateGridCameraVisibility(camera: THREE.Camera): void {
    this.surface.updateGridCameraVisibility(this.surfaceGroup(), camera);
  }

  disposeOrthoPhotoTexture(): void {
    this.surface.disposeOrthoPhotoTexture(this.surfaceGroup());
  }

  setCaptureFullResolution(enabled: boolean): void {
    this.surface.setCaptureFullResolution(this.surfaceGroup(), enabled);
  }

  waitForCaptureFullResolution(): Promise<void> {
    return this.surface.waitForCaptureFullResolution();
  }

  applyEnvironment({
    sceneProperties,
    sunDirection,
    fogColor,
    fogDensity,
    lightMode,
  }: ApplyTopoMapEnvironmentParams): void {
    const terrain = sceneProperties.terrain ?? {};
    this.surface.applyEnvironment({
      terrainGroup: this.surfaceGroup(),
      terrain,
      sunDirection,
      fogColor,
      fogDensity,
      lightMode,
    });
    this.surface.applyVerticalExaggeration({
      terrain,
      publicLayerIds: this.options.getPublicSurfaceLayerIds(),
      getLayerGroup: this.options.getLayerGroup,
    });
  }

  applyFogFrame({
    fogColor,
    fogDensity,
  }: ApplyTopoMapFogFrameParams): void {
    this.surface.applyFogFrame({
      terrainGroup: this.surfaceGroup(),
      fogColor,
      fogDensity,
    });
  }

  applySurfaceLiftStyle(layerId: string, style: EditableStyle): void {
    this.surface.applyLiftStyle({
      layerId,
      style,
      surfaceLayerId: this.options.getSurfaceLayerId(),
      publicLayerIds: this.options.getPublicSurfaceLayerIds(),
      getLayerGroup: this.options.getLayerGroup,
      isSurfaceLayerId: this.options.isSurfaceLayerId,
      getLayerStyle: this.options.getLayerStyle,
    });
  }

  applyPublicSurfaceClipStyle(style: EditableStyle): void {
    this.clip.applyStyle(style, {
      editorMode: this.options.getEditorMode(),
      publicLayerIds: this.options.getPublicSurfaceLayerIds(),
      getLayerGroup: this.options.getLayerGroup,
      getLayerStyle: this.options.getLayerStyle,
      isGraticuleLayerId: this.options.isGraticuleLayerId,
      onActiveChange: this.options.onPublicSurfaceClippingActive,
      updateRendererLocalClipping: this.options.updateRendererLocalClipping,
    });
  }

  applyGraticuleStyle(id: string, style: EditableStyle): void {
    if (!this.options.isGraticuleLayerId(id)) return;
    const group = this.options.getLayerGroup(id);
    if (!group) return;
    const clipBox = publicSurfaceClipBox(
      this.options.getLayerStyle(this.options.getSurfaceLayerId()),
    );
    const clipPlanes = clipBox.enabled ? publicSurfaceClipPlanes(clipBox) : [];
    applyTopoGraticuleStyle({
      group,
      style,
      clipBox,
      clipPlanes,
      terrainEdge: this.resolveTerrainEdgeFadeState(),
    });
  }

  applyAllGraticuleStyles(): void {
    for (const id of this.options.getGraticuleLayerIds()) {
      this.applyGraticuleStyle(id, this.options.getLayerStyle(id));
    }
  }

  rebuildBranding(sceneProperties: SceneProperties): void {
    this.branding.rebuild({
      sceneProperties,
      terrainStyle: this.options.getLayerStyle(this.options.getSurfaceLayerId()),
      terrainEdge: this.resolveTerrainEdgeFadeState(),
    });
  }

  resolveTerrainEdgeFadeState() {
    return this.surface.resolveEdgeFadeState(this.surfaceGroup());
  }

  private surfaceGroup(): THREE.Group | undefined {
    return this.options.getLayerGroup(this.options.getSurfaceLayerId());
  }
}

export function createTopoMapRuntime(
  options: TopoMapRuntimeOptions,
): TopoMapRuntime {
  return new TopoMapRuntime(options);
}
