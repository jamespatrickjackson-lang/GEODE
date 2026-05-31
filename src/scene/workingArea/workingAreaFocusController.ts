import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type {
  EditableStyle,
  EnvironmentSetup,
  EasingName,
  PresentationPage,
} from "../../pages/types";
import { effectiveStyle } from "../../pages/effective";
import {
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import {
  WORKING_AREA_FOCUS_DEFAULT_BOUNDS,
  WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY,
  WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS,
} from "../../projectModules/utahForge/workingAreaFocus";
import {
  applyWorkingAreaFocusBuiltInMaterial,
  setWorkingAreaFocusShaderUniforms,
} from "../shaders/workingAreaFocusShader";
import { clamp01 } from "../styles/styleUtils";

const WORKING_AREA_FOCUS_RENDER_ORDER = 4575;

export interface WorkingAreaFocusRuntime {
  group: THREE.Group;
  line: LineSegments2;
}

export interface WorkingAreaFocusState {
  enabled: boolean;
  mode: "inside-only" | "outside-context";
  boundsLayerId: string;
  boundsMin: THREE.Vector3;
  boundsMax: THREE.Vector3;
  targetLayerIds: Set<string>;
  outsideOpacityByLayerId: Map<string, number>;
  helperVisible: boolean;
}

export function workingAreaFocusTargetLayerIdsImpl(this: any, style: EditableStyle): Set<string> {
    const configured = Array.isArray(style.workingAreaFocusTargetLayerIds)
      ? style.workingAreaFocusTargetLayerIds.filter(
          (id) => typeof id === "string",
        )
      : [];
    return new Set(
      configured.length > 0
        ? configured
        : Array.from(WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS),
    );
  }

export function workingAreaFocusOutsideOpacityImpl(this: any, style: EditableStyle, layerId: string): number {
    if (style.workingAreaFocusEnabled !== true) return 1;
    if (style.workingAreaFocusMode === "inside-only") return 0;
    const map = style.workingAreaFocusOutsideOpacityByLayerId ?? {};
    const value = map[layerId];
    return typeof value === "number" && Number.isFinite(value)
      ? clamp01(value)
      : WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY;
  }

export function cleanWorkingAreaFocusVectorImpl(this: any, value: unknown): THREE.Vector3 | null {
    if (Array.isArray(value) && value.length >= 3) {
      const [x, y, z] = value;
      return typeof x === "number" &&
        typeof y === "number" &&
        typeof z === "number" &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z)
        ? new THREE.Vector3(x, y, z)
        : null;
    }
    const vector = value as { x?: unknown; y?: unknown; z?: unknown } | null;
    if (
      vector &&
      typeof vector.x === "number" &&
      typeof vector.y === "number" &&
      typeof vector.z === "number" &&
      Number.isFinite(vector.x) &&
      Number.isFinite(vector.y) &&
      Number.isFinite(vector.z)
    ) {
      return new THREE.Vector3(vector.x, vector.y, vector.z);
    }
    return null;
  }

export function resolveWorkingAreaFocusBoundsImpl(this: any, boundsLayerId: string): {
    min: THREE.Vector3;
    max: THREE.Vector3;
  } {
    const layer = this.layers.get(boundsLayerId);
    const candidates: unknown[] = [];
    if (layer?.userData?.sceneBounds)
      candidates.push(layer.userData.sceneBounds);
    layer?.traverse((obj: THREE.Object3D) => {
      if (obj.userData?.sceneBounds) candidates.push(obj.userData.sceneBounds);
    });
    for (const candidate of candidates) {
      const bounds = candidate as { min?: unknown; max?: unknown };
      const min = this.cleanWorkingAreaFocusVector(bounds.min);
      const max = this.cleanWorkingAreaFocusVector(bounds.max);
      if (min && max) return { min, max };
    }
    return {
      min: WORKING_AREA_FOCUS_DEFAULT_BOUNDS.min.clone(),
      max: WORKING_AREA_FOCUS_DEFAULT_BOUNDS.max.clone(),
    };
  }

export function workingAreaFocusStateImpl(this: any, style: EditableStyle): WorkingAreaFocusState {
    const boundsLayerId =
      typeof style.workingAreaFocusBoundsLayerId === "string"
        ? style.workingAreaFocusBoundsLayerId
        : UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID;
    const bounds = this.resolveWorkingAreaFocusBounds(boundsLayerId);
    const targetLayerIds = this.workingAreaFocusTargetLayerIds(style);
    const outsideOpacityByLayerId = new Map<string, number>();
    for (const layerId of targetLayerIds) {
      outsideOpacityByLayerId.set(
        layerId,
        this.workingAreaFocusOutsideOpacity(style, layerId),
      );
    }
    return {
      enabled: style.workingAreaFocusEnabled === true,
      mode:
        style.workingAreaFocusMode === "inside-only"
          ? "inside-only"
          : "outside-context",
      boundsLayerId,
      boundsMin: bounds.min,
      boundsMax: bounds.max,
      targetLayerIds,
      outsideOpacityByLayerId,
      helperVisible: style.workingAreaFocusHelperVisible !== false,
    };
  }

export function workingAreaFocusSegmentPositionsImpl(this: any, min: THREE.Vector3, max: THREE.Vector3): number[] {
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
    ];
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ] as const;
    return edges.flatMap(([a, b]) => [
      corners[a].x,
      corners[a].y,
      corners[a].z,
      corners[b].x,
      corners[b].y,
      corners[b].z,
    ]);
  }

export function ensureWorkingAreaFocusRuntimeImpl(this: any): WorkingAreaFocusRuntime {
    if (this.workingAreaFocusRuntime) return this.workingAreaFocusRuntime;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions([]);
    const material = new LineMaterial({
      color: 0x69f0ff,
      linewidth: 2,
      worldUnits: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
      dashed: false,
    });
    material.fog = false;
    material.userData.forceTransparent = true;
    material.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    const line = new LineSegments2(geometry, material);
    line.name = "Working area focus box";
    line.renderOrder = WORKING_AREA_FOCUS_RENDER_ORDER;
    line.userData.workingAreaFocusHelper = true;
    const group = new THREE.Group();
    group.name = "__working_area_focus_box__";
    group.visible = false;
    group.userData.workingAreaFocusHelper = true;
    group.add(line);
    this.scene.add(group);
    this.workingAreaFocusRuntime = { group, line };
    return this.workingAreaFocusRuntime;
  }

export function rebuildWorkingAreaFocusHelperImpl(this: any, state: WorkingAreaFocusState): void {
    const runtime = this.ensureWorkingAreaFocusRuntime();
    runtime.group.visible =
      this.editorMode && state.enabled && state.helperVisible;
    if (!state.enabled) return;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(
      this.workingAreaFocusSegmentPositions(state.boundsMin, state.boundsMax),
    );
    runtime.line.geometry.dispose();
    runtime.line.geometry = geometry;
    runtime.line.computeLineDistances();
  }

export function setKnownShaderWorkingAreaFocusImpl(this: any, material: THREE.ShaderMaterial, enabled: boolean, state: WorkingAreaFocusState, outsideOpacity: number): boolean {
    const uniforms = material.uniforms as Record<string, { value: unknown }>;
    if (!uniforms.uWorkingAreaFocusEnabled) return false;
    setWorkingAreaFocusShaderUniforms(
      uniforms,
      enabled,
      state.boundsMin,
      state.boundsMax,
      outsideOpacity,
    );
    material.needsUpdate = true;
    return true;
  }

export function applyWorkingAreaFocusMaterialImpl(this: any, material: THREE.Material, enabled: boolean, state: WorkingAreaFocusState, outsideOpacity: number): void {
    if (material.userData?.workingAreaFocusHelper === true) return;
    if (material instanceof THREE.ShaderMaterial) {
      if (
        this.setKnownShaderWorkingAreaFocus(
          material,
          enabled,
          state,
          outsideOpacity,
        )
      ) {
        return;
      }
      material.userData.workingAreaFocusUnsupported = enabled;
      return;
    }
    applyWorkingAreaFocusBuiltInMaterial(
      material,
      enabled,
      state.boundsMin,
      state.boundsMax,
      outsideOpacity,
    );
  }

export function applyWorkingAreaFocusStyleImpl(this: any, style: EditableStyle): void {
    this.lastWorkingAreaFocusStyle = style;
    this.currentWorkingAreaFocusStyle = style;
    const state = this.workingAreaFocusState(style);
    for (const [layerId, group] of this.layers) {
      const targeted =
        state.enabled &&
        state.targetLayerIds.has(layerId) &&
        layerId !== state.boundsLayerId;
      const outsideOpacity = state.outsideOpacityByLayerId.get(layerId) ?? 1;
      group.traverse((obj: THREE.Object3D) => {
        const material = (
          obj as { material?: THREE.Material | THREE.Material[] }
        ).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          this.applyWorkingAreaFocusMaterial(
            m,
            targeted,
            state,
            outsideOpacity,
          );
        }
      });
    }
    this.rebuildWorkingAreaFocusHelper(state);
  }

export function reapplyWorkingAreaFocusImpl(this: any): void {
    this.applyWorkingAreaFocusStyle(this.lastWorkingAreaFocusStyle);
  }

export function interpolatedWorkingAreaFocusStyleImpl(this: any, fromStyle: EditableStyle, toStyle: EditableStyle, t: number): EditableStyle {
    const targetLayerIds = new Set<string>([
      ...this.workingAreaFocusTargetLayerIds(fromStyle),
      ...this.workingAreaFocusTargetLayerIds(toStyle),
    ]);
    const outsideOpacityByLayerId: Record<string, number> = {};
    for (const layerId of targetLayerIds) {
      const from = this.workingAreaFocusOutsideOpacity(fromStyle, layerId);
      const to = this.workingAreaFocusOutsideOpacity(toStyle, layerId);
      outsideOpacityByLayerId[layerId] = from + (to - from) * t;
    }
    return {
      ...toStyle,
      workingAreaFocusEnabled:
        fromStyle.workingAreaFocusEnabled === true ||
        toStyle.workingAreaFocusEnabled === true,
      workingAreaFocusMode: "outside-context",
      workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
      workingAreaFocusOutsideOpacityByLayerId: outsideOpacityByLayerId,
    };
  }

export function transitionWorkingAreaFocusForPageImpl(this: any, fromEnvironment: EnvironmentSetup, toEnvironment: EnvironmentSetup, fromPage: PresentationPage, toPage: PresentationPage, durationMs: number, easing: EasingName): void {
    const fromStyle =
      Object.keys(this.currentWorkingAreaFocusStyle).length > 0
        ? this.currentWorkingAreaFocusStyle
        : effectiveStyle(
            fromEnvironment,
            fromPage,
            UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
          );
    const toStyle = effectiveStyle(
      toEnvironment,
      toPage,
      UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
    );
    const duration = Math.max(0, durationMs);
    if (duration <= 0) {
      this.workingAreaFocusTween = null;
      this.applyWorkingAreaFocusStyle(toStyle);
      return;
    }
    this.workingAreaFocusTween = {
      fromStyle,
      toStyle,
      startMs: performance.now(),
      durationMs: duration,
      easing,
    };
    this.applyWorkingAreaFocusStyle(
      this.interpolatedWorkingAreaFocusStyle(fromStyle, toStyle, 0),
    );
  }

export function getWorkingAreaFocusDebugStateImpl(this: any): {
    enabled: boolean;
    mode: string;
    boundsLayerId: string;
    targetLayerIds: string[];
    outsideOpacityByLayerId: Record<string, number>;
    helperVisible: boolean;
    helperRenderable: boolean;
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
  } {
    const state = this.workingAreaFocusState(this.currentWorkingAreaFocusStyle);
    return {
      enabled: state.enabled,
      mode: state.mode,
      boundsLayerId: state.boundsLayerId,
      targetLayerIds: Array.from(state.targetLayerIds),
      outsideOpacityByLayerId: Object.fromEntries(
        state.outsideOpacityByLayerId,
      ),
      helperVisible: state.helperVisible,
      helperRenderable: this.workingAreaFocusRuntime?.group.visible === true,
      boundsMin: [state.boundsMin.x, state.boundsMin.y, state.boundsMin.z],
      boundsMax: [state.boundsMax.x, state.boundsMax.y, state.boundsMax.z],
    };
  }
