import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { SceneProperties } from "../../pages/types";
import { DEFAULT_ASSAY_COLOR_STOPS } from "../../loaders/assayPalette";
import { setDistanceAttenuatedLineWidth } from "../../loaders/topoLineMaterial";

const TOPO_DISTANCE_LINE_LAYER_IDS = [
  "hydrography-streams",
  "transport-roads",
  "power-lines",
] as const;

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function applyDrillingAssayDisplay(
  layers: Map<string, THREE.Group>,
  sp: SceneProperties,
): void {
  const drillGroup = layers.get("drillholes-2023");
  const assayGroup = layers.get("assay-samples");
  const groups = [drillGroup, assayGroup].filter(
    (group): group is THREE.Group => !!group,
  );
  if (groups.length === 0) return;
  const assays = sp.drilling?.assays ?? {};
  const traceMode = assays.traceMode ?? "assay";
  const showBoreLine = assays.showBoreLine ?? true;
  const boreLineColor = assays.boreLineColor ?? "#e7dcc4";
  const boreWidth = clampRange(assays.boreLineWidthPx ?? 3.25, 0.5, 12);
  const boreLineOpacity = clampRange(assays.boreLineOpacity ?? 0.72, 0, 1);
  const boreLineRenderOrder = clampRange(
    assays.boreLineRenderOrder ?? 6.8,
    0,
    20,
  );
  const showBoreTube = assays.showBoreTube ?? true;
  const boreTubeColor = assays.boreTubeColor ?? "#d8ccb2";
  const boreTubeOpacity = clampRange(assays.boreTubeOpacity ?? 0.88, 0, 1);
  const boreTubeRoughness = clampRange(
    assays.boreTubeRoughness ?? 0.64,
    0,
    1,
  );
  const boreTubeMetalness = clampRange(
    assays.boreTubeMetalness ?? 0.08,
    0,
    1,
  );
  const boreTubeEmissiveColor = assays.boreTubeEmissiveColor ?? "#8d826f";
  const boreTubeEmissive = clampRange(
    assays.boreTubeEmissive ?? 0.012,
    0,
    0.4,
  );
  const boreTubeRenderOrder = clampRange(
    assays.boreTubeRenderOrder ?? 5.4,
    0,
    20,
  );
  const assayWidth =
    boreWidth * clampRange(assays.assayWidthMultiplier ?? 2.6, 1, 10);
  const lithologyWidth =
    boreWidth * clampRange(assays.lithologyWidthMultiplier ?? 2.45, 1, 12);
  const lithologyOpacity = clampRange(assays.lithologyOpacity ?? 0.56, 0, 1);
  const showAssaySides = assays.showAssaySides ?? true;
  const showAssayCaps = assays.showAssayCaps ?? true;
  const assaySideOpacity = clampRange(assays.assaySideOpacity ?? 1, 0, 1);
  const assayCapOpacity = clampRange(assays.assayCapOpacity ?? 1, 0, 1);
  const capThicknessM = clampRange(assays.assayCapThicknessM ?? 1.6, 0.2, 20);
  const sideRoughness = clampRange(assays.assaySideRoughness ?? 0.46, 0, 1);
  const capRoughness = clampRange(assays.assayCapRoughness ?? 0.74, 0, 1);
  const metalness = clampRange(assays.assayMetalness ?? 0.02, 0, 1);
  const sideEmissive = clampRange(assays.assaySideEmissive ?? 0.018, 0, 0.4);
  const capEmissive = clampRange(assays.assayCapEmissive ?? 0.012, 0, 0.4);
  const sideRenderOrder = clampRange(assays.assaySideRenderOrder ?? 6, 0, 20);
  const capRenderOrder = clampRange(assays.assayCapRenderOrder ?? 6, 0, 20);
  const showBoreLens = assays.showBoreLens ?? true;
  const boreLensColor = assays.boreLensColor ?? "#e9dec4";
  const boreLensOpacity = clampRange(assays.boreLensOpacity ?? 0.16, 0, 1);
  const colorStops = new Map(
    DEFAULT_ASSAY_COLOR_STOPS.map((stop) => [stop.id, stop]),
  );
  for (const stop of assays.colorStops ?? []) {
    if (
      typeof stop.id === "string" &&
      typeof stop.color === "string" &&
      typeof stop.label === "string"
    ) {
      colorStops.set(stop.id, stop);
    }
  }

  for (const group of groups) {
    group.traverse((obj) => {
      const traceRole = (obj.userData as { drillTraceRole?: string })
        .drillTraceRole;
      if (traceRole === "assay") {
        const assayVisible = traceMode === "assay" || traceMode === "both";
        const isCap = obj.userData?.drillTubeCap === true;
        const isSide = obj.userData?.drillTubeSegment === true;
        obj.visible =
          assayVisible &&
          (!isCap || showAssayCaps) &&
          (!isSide || showAssaySides);
      } else if (traceRole === "lithology") {
        obj.visible = traceMode === "lithology" || traceMode === "both";
      } else if (traceRole === "bore") {
        obj.visible = true;
      }

      if (traceRole === "bore" && obj.userData?.drillBoreTube === true) {
        obj.visible = showBoreTube;
        const segmentLength =
          typeof obj.userData.segmentLength === "number"
            ? obj.userData.segmentLength
            : obj.scale.y;
        const radiusPerPixel =
          typeof obj.userData.radiusPerPixel === "number"
            ? obj.userData.radiusPerPixel
            : 1.6;
        const radius = boreWidth * radiusPerPixel;
        obj.scale.set(radius, segmentLength, radius);
        obj.renderOrder = boreTubeRenderOrder;
      }

      if (traceRole === "bore" && obj.userData?.drillBoreLens === true) {
        obj.userData.lensEnabled =
          showBoreLens && (traceMode === "assay" || traceMode === "both");
        const center = Array.isArray(obj.userData.capCenter)
          ? obj.userData.capCenter
          : null;
        const axis = Array.isArray(obj.userData.capAxis)
          ? obj.userData.capAxis
          : null;
        const radiusPerPixel =
          typeof obj.userData.radiusPerPixel === "number"
            ? obj.userData.radiusPerPixel
            : 2.1;
        const radius = boreWidth * radiusPerPixel;
        obj.scale.set(radius, radius, 1);
        if (center && axis) {
          const offset = capThicknessM * 0.52 + 0.05;
          obj.position.set(
            Number(center[0]) + Number(axis[0]) * offset,
            Number(center[1]) + Number(axis[1]) * offset,
            Number(center[2]) + Number(axis[2]) * offset,
          );
        }
        const lensMat = (obj as THREE.Mesh).material;
        const lensMats = Array.isArray(lensMat) ? lensMat : [lensMat];
        for (const lensMaterial of lensMats) {
          if (!(lensMaterial instanceof THREE.MeshBasicMaterial)) continue;
          lensMaterial.color.set(boreLensColor);
          lensMaterial.opacity = boreLensOpacity;
          lensMaterial.transparent = true;
          lensMaterial.toneMapped = true;
          lensMaterial.needsUpdate = true;
        }
        obj.renderOrder = capRenderOrder + 0.25;
      }

      if (
        traceRole === "assay" &&
        (obj.userData?.drillTubeSegment === true ||
          obj.userData?.drillTubeCap === true)
      ) {
        const isCap = obj.userData?.drillTubeCap === true;
        const segmentLength = isCap
          ? capThicknessM
          : typeof obj.userData.segmentLength === "number"
            ? obj.userData.segmentLength
            : obj.scale.y;
        const radiusPerPixel =
          typeof obj.userData.radiusPerPixel === "number"
            ? obj.userData.radiusPerPixel
            : 2.5;
        const radius = assayWidth * radiusPerPixel;
        obj.scale.set(radius, segmentLength, radius);
        obj.renderOrder = isCap ? capRenderOrder : sideRenderOrder;
      }

      const mat = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        const role = m.userData?.drillAssayRole;
        if (!(m instanceof LineMaterial)) {
          if (role === "bore" && m instanceof THREE.MeshStandardMaterial) {
            m.color.set(boreTubeColor);
            m.emissive.set(boreTubeEmissiveColor);
            m.emissiveIntensity = boreTubeEmissive;
            m.roughness = boreTubeRoughness;
            m.metalness = boreTubeMetalness;
            m.opacity = boreTubeOpacity;
            m.transparent = true;
            m.toneMapped = true;
            m.needsUpdate = true;
          }
          if (role === "assay") {
            const surface =
              m.userData?.drillAssaySurface === "cap" ? "cap" : "side";
            const stopId = m.userData?.assayColorStopId;
            const stop =
              typeof stopId === "string" ? colorStops.get(stopId) : undefined;
            const colored = m as THREE.Material & { color?: THREE.Color };
            if (stop?.color && colored.color) {
              const nextColor = new THREE.Color(stop.color);
              colored.color.copy(nextColor);
              if (m instanceof THREE.MeshStandardMaterial) {
                m.emissive.copy(nextColor);
                m.emissiveIntensity =
                  surface === "cap" ? capEmissive : sideEmissive;
                m.roughness =
                  surface === "cap" ? capRoughness : sideRoughness;
                m.metalness = metalness;
              }
            }
            m.opacity =
              surface === "cap" ? assayCapOpacity : assaySideOpacity;
            m.transparent = true;
            (m as THREE.MeshStandardMaterial).toneMapped = true;
            m.needsUpdate = true;
          }
          continue;
        }
        if (role === "bore") {
          m.color.set(boreLineColor);
          m.linewidth = boreWidth;
          m.opacity = boreLineOpacity;
          m.transparent = true;
          (obj as THREE.Object3D).visible = showBoreLine;
          obj.renderOrder = boreLineRenderOrder;
        } else if (role === "assay") {
          m.linewidth = assayWidth;
        } else if (role === "lithology") {
          m.linewidth = lithologyWidth;
          m.opacity = lithologyOpacity;
          m.transparent = true;
        } else {
          continue;
        }
        if (role === "bore") {
          m.blending = THREE.NormalBlending;
          m.toneMapped = true;
        } else if (role === "lithology") {
          m.blending = THREE.NormalBlending;
          m.toneMapped = true;
        } else {
          // Assay bands are data colour first. Additive blending made distant
          // stacked intervals bleach toward white, so keep the Cu/Au bins as
          // ordinary transparent colour even when the old Glow toggle is on.
          m.blending = THREE.NormalBlending;
          m.toneMapped = true;
        }
        m.needsUpdate = true;
      }
    });
  }
}

export function applyTopoDetailDistanceDisplay(
  layers: Map<string, THREE.Group>,
  sp: SceneProperties,
): void {
  const topo = sp.topoDetails ?? {};
  const near = clampRange(topo.distanceFadeNear ?? 5000, 0, 500000);
  const far = clampRange(topo.distanceFadeFar ?? 19000, near + 250, 750000);
  const minScale = clampRange(topo.farLineScale ?? 0.67, 0.01, 1);
  const minAlpha = clampRange(topo.farOpacity ?? 0.2, 0, 1);

  for (const id of TOPO_DISTANCE_LINE_LAYER_IDS) {
    const group = layers.get(id);
    if (!group) continue;
    group.traverse((obj) => {
      const mat = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (!(m instanceof LineMaterial)) continue;
        if (m.userData.distanceAttenuatedLineWidth !== true) continue;
        setDistanceAttenuatedLineWidth(m, {
          near,
          far,
          minScale,
          minAlpha,
        });
      }
    });
  }
}
