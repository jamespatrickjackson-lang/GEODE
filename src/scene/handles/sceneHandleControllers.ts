import * as THREE from "three";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { Pose, SceneProperties } from "../../pages/types";
import { disposeObjectTree } from "../disposeObjectTree";
import { clampRange } from "../styles/styleUtils";

type PresentationLightSource = NonNullable<
  NonNullable<SceneProperties["lighting"]>["sources"]
>[number];
type PresentationLightType = NonNullable<PresentationLightSource["type"]>;
export type LightingHandleKind = "position" | "target";
export type LightingHandleMode = "plane" | "height";
export type OrbitCenterHandleMode = "plane" | "x" | "y" | "z";

export interface LightingStudioRuntime {
  type: PresentationLightType;
  light: THREE.Object3D;
  target?: THREE.Object3D;
  helper?: THREE.Object3D;
}

export interface LightingHandleRuntime {
  sourceId: string;
  kind: LightingHandleKind;
  group: THREE.Group;
  pickables: THREE.Object3D[];
}

export interface OrbitCenterHandleRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  directionArrow: THREE.Object3D;
}

export interface PageCameraMarkerRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  line: THREE.Line;
  label: THREE.Sprite;
  targetLocal: THREE.Vector3;
  labelBaseWidth: number;
  labelBaseHeight: number;
  labelLift: number;
}

interface PageCameraMarkerSpec {
  id: string;
  title: string;
  pose: Pose;
  color: string;
}

const STUDIO_HANDLE_SCREEN_SCALE_DISTANCE_M = 4200;
const STUDIO_HANDLE_MIN_SCALE = 0.55;
const STUDIO_HANDLE_MAX_SCALE = 7.5;
const ORBIT_CENTER_HANDLE_SCREEN_SCALE_DISTANCE_M = 5200;
const ORBIT_CENTER_HANDLE_MIN_SCALE = 0.65;
const ORBIT_CENTER_HANDLE_MAX_SCALE = 1;

let rectAreaLightsReady = false;

function presentationLightGain(type: PresentationLightType): number {
  switch (type) {
    case "point":
      return 220000;
    case "spot":
      return 140000;
    case "area":
      return 160;
    case "directional":
    default:
      return 1;
  }
}

function ensureRectAreaLights(): void {
  if (rectAreaLightsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightsReady = true;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hardenStudioHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

function hardenStudioHelperTree(obj: THREE.Object3D): void {
  obj.renderOrder = 4500;
  obj.traverse((child) => {
    child.renderOrder = 4500;
    const mesh = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[];
    };
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) hardenStudioHelperMaterial(mat);
  });
}

export function setStudioSceneElementsVisibleImpl(this: any, enabled: boolean): void {
    this.studioSceneElementsVisible = enabled;
    if (this.envLightHelperGroup) {
      this.envLightHelperGroup.visible = this.editorMode && enabled;
    }
  }

export function clearLightingStudioSourcesImpl(this: any): void {
    for (const light of this.envCustomLights) {
      this.scene.remove(light);
      (light as { dispose?: () => void }).dispose?.();
    }
    for (const target of this.envCustomLightTargets) {
      this.scene.remove(target);
    }
    this.envCustomLights = [];
    this.envCustomLightTargets = [];
    this.envLightRuntimes.clear();
    this.envLightHandles.clear();
    this.envLightHandlePickables = [];
    if (this.envLightHelperGroup) {
      this.scene.remove(this.envLightHelperGroup);
      disposeObjectTree(this.envLightHelperGroup);
      this.envLightHelperGroup = null;
    }
  }

export function addLightingStudioHandleImpl(this: any, sourceId: string, kind: LightingHandleKind, position: THREE.Vector3, color: THREE.Color, helperGroup: THREE.Group): void {
    const group = new THREE.Group();
    group.name = `lighting-handle-${kind}-${sourceId}`;
    group.position.copy(position);
    group.renderOrder = 4500;

    const pickables: THREE.Object3D[] = [];
    const scale = kind === "target" ? 0.68 : 1;
    const axisLength = 720 * scale;
    const coneLength = 150 * scale;
    const axisRadius = 16 * scale;
    const ringRadius = 360 * scale;
    const coreRadius = 120 * scale;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius, 18, 12),
      this.makeLightingHandleMaterial(color, kind === "target" ? 0.45 : 0.55),
    );
    this.markLightingPickable(core, sourceId, kind, "plane", pickables);
    group.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 9 * scale, 8, 72),
      this.makeLightingHandleMaterial("#ffffff", 0.72),
    );
    this.markLightingPickable(ring, sourceId, kind, "plane", pickables);
    group.add(ring);

    const addAxis = (
      axis: "x" | "y" | "z",
      axisColor: THREE.ColorRepresentation,
    ) => {
      const mode: LightingHandleMode = axis === "z" ? "height" : "plane";
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 12),
        this.makeLightingHandleMaterial(axisColor, 0.88),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(48 * scale, coneLength, 18),
        this.makeLightingHandleMaterial(axisColor, 0.92),
      );
      if (axis === "x") {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = axisLength / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = axisLength + coneLength / 2;
      } else if (axis === "z") {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = axisLength / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = axisLength + coneLength / 2;
      } else {
        shaft.position.y = axisLength / 2;
        head.position.y = axisLength + coneLength / 2;
      }
      this.markLightingPickable(shaft, sourceId, kind, mode, pickables);
      this.markLightingPickable(head, sourceId, kind, mode, pickables);
      group.add(shaft, head);
    };

    addAxis("x", "#ff4f4f");
    addAxis("y", "#4ddf9a");
    addAxis("z", "#58a6ff");

    const labelColor = kind === "target" ? "#ffcc66" : "#ffffff";
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(185 * scale, 7 * scale, 8, 48),
      this.makeLightingHandleMaterial(
        labelColor,
        kind === "target" ? 0.85 : 0.35,
      ),
    );
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.z = 8 * scale;
    this.markLightingPickable(targetRing, sourceId, kind, "plane", pickables);
    group.add(targetRing);

    helperGroup.add(group);
    hardenStudioHelperTree(group);
    const runtime: LightingHandleRuntime = { sourceId, kind, group, pickables };
    this.envLightHandles.set(this.lightingHandleKey(sourceId, kind), runtime);
    this.envLightHandlePickables.push(...pickables);
  }

export function createPageCameraLabelImpl(this: any, text = "Camera", accentColor = "rgba(48, 48, 48, 0.22)", fillColor = "rgba(255, 255, 255, 0.92)"): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 104;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fillColor;
      roundRect(ctx, 12, 12, 488, 70, 18);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 7;
      roundRect(ctx, 12, 12, 488, 70, 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
      let fontSize = 27;
      const fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      while (fontSize > 17 && ctx.measureText(text).width > 420) {
        fontSize -= 1;
        ctx.font = `700 ${fontSize}px ${fontFamily}`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, 47);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(material);
    const sprite = new THREE.Sprite(material);
    sprite.name = "page-camera-label";
    sprite.renderOrder = 4540;
    return sprite;
  }

export function createPageCameraMarkerImpl(this: any, pose: Pose, opts: {
      id: string;
      kind: "current" | "global";
      label: string;
      color?: string;
      fillColor?: string;
      labelBaseWidth?: number;
      labelBaseHeight?: number;
      labelLift?: number;
    }): PageCameraMarkerRuntime {
    const group = new THREE.Group();
    group.name = `__page_camera_marker_${opts.kind}_${opts.id}__`;
    group.visible = this.editorMode;
    group.renderOrder = 4540;

    const pickables: THREE.Object3D[] = [];
    const labelStroke =
      opts.kind === "global"
        ? (opts.color ?? "rgba(48, 48, 48, 0.22)")
        : "rgba(48, 48, 48, 0.22)";
    const label = this.createPageCameraLabel(
      opts.label,
      labelStroke,
      opts.fillColor,
    );
    this.markPageCameraPickable(label, pickables, opts.id, opts.kind);
    group.add(label);

    const lineMaterial = new THREE.LineDashedMaterial({
      color: opts.color ?? "#ffffff",
      transparent: true,
      opacity: 0.82,
      dashSize: 120,
      gapSize: 72,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(lineMaterial);
    const line = new THREE.Line(new THREE.BufferGeometry(), lineMaterial);
    line.name = "page-camera-to-target-line";
    line.renderOrder = 4538;
    group.add(line);

    this.scene.add(group);
    const runtime = {
      group,
      pickables,
      line,
      label,
      targetLocal: new THREE.Vector3(),
      labelBaseWidth: opts.labelBaseWidth ?? 520,
      labelBaseHeight: opts.labelBaseHeight ?? 106,
      labelLift: opts.labelLift ?? 250,
    };
    this.updatePageCameraMarkerPose(runtime, pose);
    return runtime;
  }

export function updatePageCameraMarkerLineImpl(this: any, marker: PageCameraMarkerRuntime): void {
    const start = marker.label.position;
    const end = marker.targetLocal;
    const positionAttribute = marker.line.geometry.getAttribute("position");
    if (
      positionAttribute instanceof THREE.BufferAttribute &&
      positionAttribute.count >= 2
    ) {
      positionAttribute.setXYZ(0, start.x, start.y, start.z);
      positionAttribute.setXYZ(1, end.x, end.y, end.z);
      positionAttribute.needsUpdate = true;
      marker.line.geometry.computeBoundingSphere();
    } else {
      marker.line.geometry.dispose();
      marker.line.geometry = new THREE.BufferGeometry().setFromPoints([
        start.clone(),
        end.clone(),
      ]);
    }
    marker.line.computeLineDistances();
  }

export function updatePageCameraMarkerPoseImpl(this: any, marker: PageCameraMarkerRuntime, pose: Pose): void {
    const position = new THREE.Vector3(...pose.position);
    const target = new THREE.Vector3(...pose.target);
    marker.group.position.copy(position);
    marker.label.position.set(0, 0, marker.labelLift);
    marker.targetLocal.copy(target.sub(position));
    this.updatePageCameraMarkerLine(marker);
    hardenStudioHelperTree(marker.group);
  }

export function updatePageCameraMarkerVisibilityImpl(this: any): void {
    for (const marker of this.globalPageCameraMarkers.values()) {
      marker.group.visible = false;
    }
    if (this.pageCameraMarker) {
      this.pageCameraMarker.group.visible = false;
    }
  }

export function createOrbitCenterHandleImpl(this: any, position: THREE.Vector3): OrbitCenterHandleRuntime {
    const group = new THREE.Group();
    group.name = "__dynamic_camera_orbit_center__";
    group.position.copy(position);
    group.visible = this.editorMode;
    group.renderOrder = 4520;

    const pickables: THREE.Object3D[] = [];
    const ringRadius = 150;
    const innerRadius = 78;
    const axisLength = 260;
    const coneLength = 60;
    const axisRadius = 6;
    const ringZ = 16;

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 5, 8, 72),
      this.makeOrbitCenterMaterial("#ffffff", 0.8),
    );
    halo.position.z = ringZ;
    this.markOrbitCenterPickable(halo, "plane", pickables);

    const directionArrow = new THREE.Mesh(
      new THREE.ConeGeometry(18, 38, 3),
      this.makeOrbitCenterMaterial("#ffffff", 0.8),
    );
    directionArrow.position.set(ringRadius, 0, ringZ);
    this.markOrbitCenterPickable(directionArrow, "plane", pickables);

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(innerRadius, 4, 8, 64),
      this.makeOrbitCenterMaterial("#34d5ff", 0.8),
    );
    inner.position.z = 18;
    this.markOrbitCenterPickable(inner, "plane", pickables);

    const addAxis = (
      axis: OrbitCenterHandleMode,
      axisColor: THREE.ColorRepresentation,
    ) => {
      if (axis === "plane") return;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 12),
        this.makeOrbitCenterMaterial(axisColor, 0.8),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(22, coneLength, 18),
        this.makeOrbitCenterMaterial(axisColor, 0.8),
      );
      if (axis === "x") {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = axisLength / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = axisLength + coneLength / 2;
      } else if (axis === "z") {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = axisLength / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = axisLength + coneLength / 2;
      } else {
        shaft.position.y = axisLength / 2;
        head.position.y = axisLength + coneLength / 2;
      }
      this.markOrbitCenterPickable(shaft, axis, pickables);
      this.markOrbitCenterPickable(head, axis, pickables);
      group.add(shaft, head);
    };

    addAxis("x", "#ff4f4f");
    addAxis("y", "#4ddf9a");
    addAxis("z", "#58a6ff");

    const cameraIcon = new THREE.Group();
    cameraIcon.name = "dynamic-camera-orbit-center-camera-icon";
    cameraIcon.position.set(0, -205, 122);
    const iconMaterial = this.makeOrbitCenterMaterial("#ffffff", 0.8);
    const iconBody = new THREE.Mesh(
      new THREE.BoxGeometry(8, 58, 34),
      iconMaterial,
    );
    const iconPrism = new THREE.Mesh(
      new THREE.BoxGeometry(8, 24, 12),
      iconMaterial,
    );
    iconPrism.position.set(0, -8, 23);
    const iconLens = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, 8, 24),
      this.makeOrbitCenterMaterial("#34d5ff", 0.8),
    );
    iconLens.rotation.z = Math.PI / 2;
    iconLens.position.set(-6, 8, 0);
    cameraIcon.add(iconBody, iconPrism, iconLens);

    group.add(halo, directionArrow, inner, cameraIcon);
    hardenStudioHelperTree(group);
    this.scene.add(group);
    return { group, pickables, directionArrow };
  }

export function setPageCameraMarkerImpl(this: any, pose: Pose | null): void {
    if (!pose) {
      if (this.pageCameraMarker) {
        this.scene.remove(this.pageCameraMarker.group);
        disposeObjectTree(this.pageCameraMarker.group);
        this.pageCameraMarker = null;
      }
      return;
    }
    if (!this.pageCameraMarker) {
      this.pageCameraMarker = this.createPageCameraMarker(pose, {
        id: "__current_page_camera__",
        kind: "current",
        label: "Camera",
        color: "#ffffff",
      });
      this.updatePageCameraMarkerVisibility();
      return;
    }
    this.updatePageCameraMarkerPose(this.pageCameraMarker, pose);
    this.updatePageCameraMarkerVisibility();
  }

export function setGlobalPageCameraMarkersImpl(this: any, markers: PageCameraMarkerSpec[] | null): void {
    for (const marker of this.globalPageCameraMarkers.values()) {
      this.scene.remove(marker.group);
      disposeObjectTree(marker.group);
    }
    this.globalPageCameraMarkers.clear();
    if (!markers || markers.length === 0) {
      this.updatePageCameraMarkerVisibility();
      return;
    }
    for (const marker of markers) {
      const runtime = this.createPageCameraMarker(marker.pose, {
        id: marker.id,
        kind: "global",
        label: marker.title,
        color: marker.color,
        fillColor: marker.color,
        labelBaseWidth: 760,
        labelBaseHeight: 154,
        labelLift: 270,
      });
      this.globalPageCameraMarkers.set(marker.id, runtime);
    }
    this.updatePageCameraMarkerVisibility();
  }

export function listPageCameraMarkerPickablesImpl(this: any): THREE.Object3D[] {
    if (!this.editorMode) return [];
    const pickables: THREE.Object3D[] = [];
    if (this.pageCameraMarker?.group.visible) {
      pickables.push(...this.pageCameraMarker.pickables);
    }
    for (const marker of this.globalPageCameraMarkers.values()) {
      if (marker.group.visible) pickables.push(...marker.pickables);
    }
    return pickables;
  }

export function addLightingStudioSourceImpl(this: any, source: PresentationLightSource, helperGroup: THREE.Group): void {
    if (source.enabled === false) return;
    const color = new THREE.Color(source.color ?? "#ffffff");
    const [px, py, pz] = source.position ?? [0, -3500, 2500];
    const [tx, ty, tz] = source.target ?? [0, 0, 0];
    const type = source.type ?? "spot";
    const intensity =
      (source.intensity ?? 1) * (source.gain ?? presentationLightGain(type));

    if (type === "point") {
      const light = new THREE.PointLight(
        color,
        intensity,
        source.distance ?? 9000,
        source.decay ?? 1.6,
      );
      light.position.set(px, py, pz);
      light.castShadow = false;
      light.name = source.label ?? source.id;
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new THREE.PointLightHelper(light, 300, color);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, { type, light, helper });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      return;
    }

    if (type === "area") {
      ensureRectAreaLights();
      const light = new THREE.RectAreaLight(
        color,
        intensity,
        source.width ?? 1600,
        source.height ?? 900,
      );
      light.position.set(px, py, pz);
      light.lookAt(tx, ty, tz);
      light.name = source.label ?? source.id;
      const target = new THREE.Object3D();
      target.position.set(tx, ty, tz);
      target.name = `${source.id}-target`;
      this.scene.add(target);
      this.envCustomLightTargets.push(target);
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new RectAreaLightHelper(light);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, { type, light, target, helper });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      this.addLightingStudioHandle(
        source.id,
        "target",
        target.position,
        color,
        helperGroup,
      );
      return;
    }

    if (type === "directional") {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(px, py, pz);
      light.target.position.set(tx, ty, tz);
      this.scene.add(light.target);
      this.envCustomLightTargets.push(light.target);
      light.target.updateMatrixWorld();
      light.castShadow = false;
      light.name = source.label ?? source.id;
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new THREE.DirectionalLightHelper(light, 650, color);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, {
        type,
        light,
        target: light.target,
        helper,
      });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      this.addLightingStudioHandle(
        source.id,
        "target",
        light.target.position,
        color,
        helperGroup,
      );
      return;
    }

    const light = new THREE.SpotLight(
      color,
      intensity,
      source.distance ?? 12000,
      THREE.MathUtils.degToRad(source.angle ?? 24),
      source.penumbra ?? 0.35,
      source.decay ?? 1.4,
    );
    light.position.set(px, py, pz);
    light.target.position.set(tx, ty, tz);
    this.scene.add(light.target);
    this.envCustomLightTargets.push(light.target);
    light.target.updateMatrixWorld();
    light.castShadow = false;
    light.name = source.label ?? source.id;
    this.scene.add(light);
    this.envCustomLights.push(light);
    const helper = new THREE.SpotLightHelper(light, color);
    helper.update();
    hardenStudioHelperTree(helper);
    helperGroup.add(helper);
    this.envLightRuntimes.set(source.id, {
      type,
      light,
      target: light.target,
      helper,
    });
    this.addLightingStudioHandle(
      source.id,
      "position",
      light.position,
      color,
      helperGroup,
    );
    this.addLightingStudioHandle(
      source.id,
      "target",
      light.target.position,
      color,
      helperGroup,
    );
  }

export function updateLightingStudioElementScaleImpl(this: any, camera: THREE.Camera): void {
    if (!this.envLightHelperGroup || !this.studioSceneElementsVisible) return;
    for (const handle of this.envLightHandles.values()) {
      handle.group.getWorldPosition(this.studioHandleWorldPos);
      const distance = camera.position.distanceTo(this.studioHandleWorldPos);
      const scale = clampRange(
        distance / STUDIO_HANDLE_SCREEN_SCALE_DISTANCE_M,
        STUDIO_HANDLE_MIN_SCALE,
        STUDIO_HANDLE_MAX_SCALE,
      );
      handle.group.scale.setScalar(scale);
    }
  }

export function updateDynamicCameraOrbitCenterScaleImpl(this: any, camera: THREE.Camera): void {
    if (!this.orbitCenterHandle) return;
    this.orbitCenterHandle.group.getWorldPosition(this.orbitCenterWorldPos);
    const distance = camera.position.distanceTo(this.orbitCenterWorldPos);
    const scale = clampRange(
      distance / ORBIT_CENTER_HANDLE_SCREEN_SCALE_DISTANCE_M,
      ORBIT_CENTER_HANDLE_MIN_SCALE,
      ORBIT_CENTER_HANDLE_MAX_SCALE,
    );
    this.orbitCenterHandle.group.scale.setScalar(scale);
  }

export function updatePageCameraMarkerScaleImpl(this: any, marker: PageCameraMarkerRuntime, camera: THREE.Camera): void {
    marker.group.getWorldPosition(this.pageCameraMarkerWorldPos);
    const distance = camera.position.distanceTo(this.pageCameraMarkerWorldPos);
    const scale = clampRange(distance / 5200, 0.62, 2.8);
    marker.label.scale.set(
      marker.labelBaseWidth * scale,
      marker.labelBaseHeight * scale,
      1,
    );
    marker.label.position.z = marker.labelLift * scale;
    this.updatePageCameraMarkerLine(marker);
  }

export function updatePageCameraMarkersScaleImpl(this: any, camera: THREE.Camera): void {
    if (this.pageCameraMarker?.group.visible) {
      this.updatePageCameraMarkerScale(this.pageCameraMarker, camera);
    }
    for (const marker of this.globalPageCameraMarkers.values()) {
      if (marker.group.visible)
        this.updatePageCameraMarkerScale(marker, camera);
    }
  }

export function lightingHandleKeyImpl(this: any, sourceId: string, kind: LightingHandleKind): string {
    return `${sourceId}:${kind}`;
  }

export function makeLightingHandleMaterialImpl(this: any, color: THREE.ColorRepresentation, opacity = 0.92): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(mat);
    return mat;
  }

export function markLightingPickableImpl(this: any, obj: THREE.Object3D, sourceId: string, kind: LightingHandleKind, mode: LightingHandleMode, pickables: THREE.Object3D[]): void {
    obj.userData.lightingHandle = true;
    obj.userData.lightingSourceId = sourceId;
    obj.userData.lightingHandleKind = kind;
    obj.userData.lightingHandleMode = mode;
    obj.renderOrder = 4500;
    pickables.push(obj);
  }

export function updateLightingStudioHelpersImpl(this: any): void {
    if (!this.envLightHelperGroup) return;
    this.envLightHelperGroup.traverse((obj: THREE.Object3D) => {
      (obj as { update?: () => void }).update?.();
    });
    hardenStudioHelperTree(this.envLightHelperGroup);
  }

export function makeOrbitCenterMaterialImpl(this: any, color: THREE.ColorRepresentation, opacity = 0.9): THREE.MeshStandardMaterial {
    const tint = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint.clone().multiplyScalar(0.28),
      emissiveIntensity: 0.18,
      roughness: 0.46,
      metalness: 0.08,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    mat.side = THREE.DoubleSide;
    hardenStudioHelperMaterial(mat);
    return mat;
  }

export function markOrbitCenterPickableImpl(this: any, obj: THREE.Object3D, mode: OrbitCenterHandleMode, pickables: THREE.Object3D[]): void {
    obj.userData.dynamicCameraOrbitCenter = true;
    obj.userData.dynamicCameraOrbitCenterMode = mode;
    obj.renderOrder = 4520;
    pickables.push(obj);
  }

export function markPageCameraPickableImpl(this: any, obj: THREE.Object3D, pickables: THREE.Object3D[], id: string, kind: "current" | "global"): void {
    obj.userData.pageCameraMarker = true;
    obj.userData.pageCameraMarkerId = id;
    obj.userData.pageCameraMarkerKind = kind;
    obj.renderOrder = 4540;
    pickables.push(obj);
  }
