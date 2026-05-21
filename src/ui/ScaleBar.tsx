import { useEffect, useState } from "react";
import * as THREE from "three";
import { useEditor } from "../editor/EditorContext";
import { vibrancyLabel } from "../editor/styles";
import type { SceneHandle } from "../scene";

interface ScaleState {
  label: string;
  widthPx: number;
}

const TARGET_WIDTH_PX = 118;
const MIN_WIDTH_PX = 74;
const MAX_WIDTH_PX = 168;
const BAR_HEIGHT_PX = 7;
const BAR_MIN_WORLD_M = 0.001;
const LOCAL_REFERENCE_DISTANCE_M = 1;

const rootBaseStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 18,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
  pointerEvents: "none",
  fontFamily: "system-ui, sans-serif",
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const rgbMatch = clean.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i,
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(246, 246, 246, ${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function niceDistance(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  const exponent = Math.floor(Math.log10(meters));
  const base = 10 ** exponent;
  const normalized = meters / base;
  const nice =
    normalized >= 5
      ? 5
      : normalized >= 2
        ? 2
        : normalized >= 1
          ? 1
          : 0.5;
  return nice * base;
}

function candidateDistances(meters: number): number[] {
  if (!Number.isFinite(meters) || meters <= 0) return [1, 2, 5, 10];
  const exponent = Math.floor(Math.log10(meters));
  const values: number[] = [];
  for (let e = exponent - 2; e <= exponent + 2; e += 1) {
    const base = 10 ** e;
    values.push(1 * base, 2 * base, 5 * base);
  }
  return values.filter((value) => value > 0);
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${Number.isInteger(km) ? km.toFixed(0) : km.toFixed(1)} km`;
  }
  if (meters >= 10) return `${Math.round(meters)} m`;
  if (meters >= 1) return `${Number.isInteger(meters) ? meters.toFixed(0) : meters.toFixed(1)} m`;
  return `${Math.round(meters * 100)} cm`;
}

function isScaleSurfaceCandidate(obj: THREE.Object3D): obj is THREE.Mesh {
  if (!(obj instanceof THREE.Mesh)) return false;
  const material = obj.material;
  const materials = Array.isArray(material) ? material : [material];
  if (materials.every((m) => m.visible === false)) return false;

  const name = obj.name.toLowerCase();
  return (
    obj.userData?.scaleReferenceSurface === true ||
    obj.userData?.meshPreview === true ||
    obj.userData?.terrainHandle !== undefined ||
    name === "terrain" ||
    name === "case-study-b-demo-surface" ||
    name === "case-study-b-demo-surrounding-ground"
  );
}

function scaleSurfaceMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const preferred: THREE.Mesh[] = [];
  const fallback: THREE.Mesh[] = [];
  scene.traverseVisible((obj) => {
    if (!isScaleSurfaceCandidate(obj)) return;
    if (obj.userData?.scaleReferenceSurface === true) {
      preferred.push(obj);
    } else {
      fallback.push(obj);
    }
  });
  return preferred.length > 0 ? preferred : fallback;
}

function surfacePointAtScreen(
  sceneHandle: SceneHandle,
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, sceneHandle.camera);
  const hits = raycaster.intersectObjects(
    scaleSurfaceMeshes(sceneHandle.scene),
    false,
  );
  return hits[0]?.point ?? null;
}

function rayAtScreen(
  sceneHandle: SceneHandle,
  clientX: number,
  clientY: number,
): THREE.Ray | null {
  const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, sceneHandle.camera);
  return raycaster.ray.clone();
}

function fallbackPointAtScreen(
  sceneHandle: SceneHandle,
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const ray = rayAtScreen(sceneHandle, clientX, clientY);
  if (!ray) return null;
  const horizontal = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const point = ray.intersectPlane(horizontal, new THREE.Vector3());
  if (point) return point;

  const cameraDistance =
    sceneHandle.camera instanceof THREE.PerspectiveCamera
      ? Math.max(100, sceneHandle.camera.position.length() * 0.35)
      : 1000;
  return ray.at(cameraDistance, new THREE.Vector3());
}

function surfaceReferencePoint(
  sceneHandle: SceneHandle,
  insetPx: number,
): THREE.Vector3 | null {
  const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
  const x0 = rect.left + insetPx;
  const y0 = rect.bottom - insetPx;
  const candidates: Array<[number, number]> = [
    [x0 + TARGET_WIDTH_PX * 0.5, y0 - 28],
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.55],
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.45],
    [rect.left + rect.width * 0.35, rect.top + rect.height * 0.55],
    [rect.left + rect.width * 0.65, rect.top + rect.height * 0.55],
    [rect.left + rect.width * 0.5, rect.top + rect.height * 0.7],
  ];
  for (const [x, y] of candidates) {
    const point = surfacePointAtScreen(sceneHandle, x, y);
    if (point) return point;
  }
  for (const [x, y] of candidates) {
    const point = fallbackPointAtScreen(sceneHandle, x, y);
    if (point) return point;
  }
  return null;
}

function projectToScreenPx(
  sceneHandle: SceneHandle,
  point: THREE.Vector3,
): THREE.Vector2 | null {
  const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
  const projected = point.clone().project(sceneHandle.camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
    return null;
  }
  return new THREE.Vector2(
    rect.left + ((projected.x + 1) / 2) * rect.width,
    rect.top + ((1 - projected.y) / 2) * rect.height,
  );
}

function localPixelsPerMeter(
  sceneHandle: SceneHandle,
  reference: THREE.Vector3,
): number | null {
  const cameraRight = new THREE.Vector3()
    .setFromMatrixColumn(sceneHandle.camera.matrixWorld, 0);
  cameraRight.z = 0;
  if (cameraRight.lengthSq() < 1e-8) cameraRight.set(1, 0, 0);
  cameraRight.normalize();

  const a = projectToScreenPx(sceneHandle, reference);
  const b = projectToScreenPx(
    sceneHandle,
    reference
      .clone()
      .addScaledVector(cameraRight, LOCAL_REFERENCE_DISTANCE_M),
  );
  if (!a || !b) return null;

  const pixels = a.distanceTo(b);
  if (!Number.isFinite(pixels) || pixels <= 0) return null;
  return pixels / LOCAL_REFERENCE_DISTANCE_M;
}

function pickDisplayDistance(
  targetMeters: number,
  pixelsPerMeter: number,
): number {
  const candidates = candidateDistances(targetMeters);
  const usable = candidates.filter((distance) => {
    const width = distance * pixelsPerMeter;
    return width >= MIN_WIDTH_PX && width <= MAX_WIDTH_PX;
  });
  const pool = usable.length > 0 ? usable : candidates;
  return pool.reduce((best, distance) => {
    const bestScore = Math.abs(best * pixelsPerMeter - TARGET_WIDTH_PX);
    const score = Math.abs(distance * pixelsPerMeter - TARGET_WIDTH_PX);
    return score < bestScore ? distance : best;
  }, pool[0] ?? niceDistance(targetMeters));
}

function measureScale(sceneHandle: SceneHandle, insetPx: number): ScaleState | null {
  const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const reference = surfaceReferencePoint(sceneHandle, insetPx);
  if (!reference) return null;

  const localScale = localPixelsPerMeter(sceneHandle, reference);
  if (
    !localScale ||
    !Number.isFinite(localScale) ||
    localScale < BAR_MIN_WORLD_M
  ) {
    return null;
  }

  const pixelsPerMeter = localScale;
  const targetMeters = TARGET_WIDTH_PX / pixelsPerMeter;
  const distance = pickDisplayDistance(targetMeters, pixelsPerMeter);
  const widthPx = distance * pixelsPerMeter;
  return {
    label: formatDistance(distance),
    widthPx,
  };
}

export function ScaleBar({ sceneHandle }: { sceneHandle: SceneHandle }) {
  const { state } = useEditor();
  const [scale, setScale] = useState<ScaleState | null>(null);
  const gui = state.environment.scene?.gui ?? {};
  const guiOverlay = gui.overlay ?? {};
  const guiNavigator = gui.navigator ?? {};
  const navigatorOverride = guiNavigator.useOverride === true;
  const inset = navigatorOverride ? guiNavigator.bottom ?? 16 : 16;
  const textColor = navigatorOverride
    ? guiNavigator.textColor ?? guiOverlay.textColor ?? vibrancyLabel
    : guiOverlay.textColor ?? vibrancyLabel;
  const borderSource = navigatorOverride
    ? guiNavigator.borderColor ?? guiOverlay.borderColor ?? "#ffffff"
    : guiOverlay.borderColor ?? "#ffffff";

  useEffect(() => {
    let previous = "";
    const update = () => {
      const next = measureScale(sceneHandle, inset);
      const signature = next ? `${next.label}:${next.widthPx.toFixed(2)}` : "";
      if (signature !== previous) {
        previous = signature;
        setScale(next);
      }
    };
    update();
    const offTick = sceneHandle.onTick(update);
    window.addEventListener("resize", update);
    return () => {
      offTick();
      window.removeEventListener("resize", update);
    };
  }, [sceneHandle, inset]);

  if (!scale) return null;

  const scaleLineColor = hexToRgba(borderSource, 0.86);
  const rootStyle: React.CSSProperties = {
    ...rootBaseStyle,
    left: inset,
    bottom: inset,
    color: textColor,
  };
const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const lineStyle: React.CSSProperties = {
    position: "relative",
    width: scale.widthPx,
    height: BAR_HEIGHT_PX,
    borderLeft: `1px solid ${scaleLineColor}`,
    borderRight: `1px solid ${scaleLineColor}`,
    borderBottom: `1px solid ${scaleLineColor}`,
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1,
    fontWeight: 650,
    letterSpacing: 0,
    textShadow: "0 1px 2px rgba(0,0,0,0.28)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={rootStyle} aria-label={`Scale ${scale.label}`}>
      <div style={rowStyle}>
        <div style={labelStyle}>{scale.label}</div>
        <div style={lineStyle} />
      </div>
    </div>
  );
}
