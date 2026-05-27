import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { EditableStyle, Vec3 } from "../../pages/types";
import { SCENE_ORIGIN } from "../../constants";
import {
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { getHeightSampler } from "../heightSampler";
import type { TerrainMaterialHandle } from "../terrainMaterial";
import { disposeObjectTree } from "../disposeObjectTree";
import { clamp01, styleNumber } from "../styles/styleUtils";

function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

function styleFogDensity(style: EditableStyle, fallback: number): number {
  return styleNumber(style, "fogDensity", fallback, 0, 0.004);
}

export function applyTerrainCompositeOpacityImpl(this: any, layerId: string, opacity: number): void {
    if (
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return;
    terrainGroup.traverse((obj: THREE.Object3D) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "hydrography-lakes":
          handle.setLakeOpacity(opacity);
          break;
        case "three-firs-target":
          handle.setTargetOpacity("target-three-firs", opacity);
          break;
        case "great-plains-target":
          handle.setTargetOpacity("target-great-plains", opacity);
          break;
        case "claim-boundary":
          handle.setClaimOpacity(opacity);
          break;
        case "bedrock-geology":
          handle.setGeologyOpacity(opacity);
          break;
        case "trees-vri":
          handle.setForestFillOpacity(opacity);
          handle.setForestOutlineOpacity(opacity);
          break;
      }
    });
    if (layerId === "hydrography-lakes") {
      this.applyStreamLakeOcclusion(opacity > 0.001);
    }
  }

export function applyTerrainFogStyleImpl(this: any, layerId: string, affectedByFog: boolean, fogDensity: number): void {
    if (
      !this.isTopoSurfaceLayerId(layerId) &&
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return;
    const enabled = this.envFogEnabled && affectedByFog;
    terrainGroup.traverse((obj: THREE.Object3D) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case this.topoSurfaceLayerId():
          handle.setTerrainFogEnabled(enabled);
          handle.setTerrainFogDensity(fogDensity);
          break;
        case "hydrography-lakes":
          handle.setLakeFogEnabled(enabled);
          handle.setLakeFogDensity(fogDensity);
          break;
        case "three-firs-target":
          handle.setTargetFogEnabled("target-three-firs", enabled);
          handle.setTargetFogDensity("target-three-firs", fogDensity);
          break;
        case "great-plains-target":
          handle.setTargetFogEnabled("target-great-plains", enabled);
          handle.setTargetFogDensity("target-great-plains", fogDensity);
          break;
        case "claim-boundary":
          handle.setClaimFogEnabled(enabled);
          handle.setClaimFogDensity(fogDensity);
          break;
        case "bedrock-geology":
          handle.setGeologyFogEnabled(enabled);
          handle.setGeologyFogDensity(fogDensity);
          break;
        case "trees-vri":
          handle.setForestFogEnabled(enabled);
          handle.setForestFogDensity(fogDensity);
          break;
      }
    });
  }

export function isSiteSurfaceGuideLayerIdImpl(this: any, id: string): boolean {
    return (
      id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID ||
      id === UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID
    );
  }

export function siteSurfaceGuideOriginImpl(this: any, group?: THREE.Object3D): {
    easting: number;
    northing: number;
    elevation: number;
  } {
    const parseOrigin = (
      value: unknown,
    ): { easting: number; northing: number; elevation: number } | null => {
      if (Array.isArray(value) && value.length >= 2) {
        const [easting, northing, elevation = 0] = value;
        return typeof easting === "number" &&
          Number.isFinite(easting) &&
          typeof northing === "number" &&
          Number.isFinite(northing) &&
          typeof elevation === "number" &&
          Number.isFinite(elevation)
          ? { easting, northing, elevation }
          : null;
      }
      if (!value || typeof value !== "object") return null;
      const record = value as Record<string, unknown>;
      const easting = record.easting ?? record.easting_m;
      const northing = record.northing ?? record.northing_m;
      const elevation = record.elevation ?? record.elevation_m ?? 0;
      return typeof easting === "number" &&
        Number.isFinite(easting) &&
        typeof northing === "number" &&
        Number.isFinite(northing) &&
        typeof elevation === "number" &&
        Number.isFinite(elevation)
        ? { easting, northing, elevation }
        : null;
    };

    const terrainMetadata = this.layerSpecFor(this.topoSurfaceLayerId())
      ?.metadata as Record<string, unknown> | undefined;
    const terrainTransform = terrainMetadata?.geoTransform as
      | Record<string, unknown>
      | undefined;
    let sourceProps = group?.userData?.sourceProperties as
      | Record<string, unknown>
      | undefined;
    let source = group?.userData?.source as Record<string, unknown> | undefined;
    group?.traverse((child) => {
      sourceProps ??= child.userData?.sourceProperties as
        | Record<string, unknown>
        | undefined;
      source ??= child.userData?.source as Record<string, unknown> | undefined;
    });
    const sourceTransform = source?.geoTransform as
      | Record<string, unknown>
      | undefined;

    return (
      parseOrigin(terrainTransform?.sceneOriginUtm) ??
      parseOrigin(sourceProps?.sceneOriginUtm) ??
      parseOrigin(sourceTransform?.sceneOriginUtm) ?? {
        easting: SCENE_ORIGIN.easting,
        northing: SCENE_ORIGIN.northing,
        elevation: SCENE_ORIGIN.elevation,
      }
    );
  }

export function sourceSiteGuideLinesImpl(this: any, group: THREE.Object3D): Vec3[][] {
    const rawLines: unknown[] = [];
    group.traverse((child) => {
      const lines = child.userData?.sourceLineStrings;
      if (Array.isArray(lines)) rawLines.push(...lines);
    });
    return rawLines
      .map((line) =>
        Array.isArray(line)
          ? line.filter(
              (point): point is Vec3 =>
                Array.isArray(point) &&
                point.length >= 3 &&
                point.every(
                  (entry) =>
                    typeof entry === "number" && Number.isFinite(entry),
                ),
            )
          : [],
      )
      .filter((line) => line.length >= 2);
  }

export function resampleSiteGuideLineImpl(this: any, line: Vec3[], stepM: number): Vec3[] {
    if (line.length <= 1) return line;
    const resampled: Vec3[] = [line[0]];
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const dz = end[2] - start[2];
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(distance / stepM));
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        resampled.push([
          start[0] + dx * t,
          start[1] + dy * t,
          start[2] + dz * t,
        ]);
      }
    }
    return resampled;
  }

export function siteGuideSurfaceZImpl(this: any, x: number, y: number, sampleHeight: (easting: number, northing: number) => number, origin: { easting: number; northing: number; elevation: number }, liftM: number): number {
    return (
      sampleHeight(origin.easting + x, origin.northing + y) -
      origin.elevation +
      liftM
    );
  }

export function pointInSiteGuideRingImpl(this: any, x: number, y: number, ring: Vec3[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const denom = yj - yi;
      const intersects =
        yi > y !== yj > y &&
        x <
          ((xj - xi) * (y - yi)) /
            (Math.abs(denom) < 0.000001 ? 0.000001 : denom) +
            xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

export function siteGuideRingImpl(this: any, lines: Vec3[][]): Vec3[] | null {
    const longest = lines.reduce<Vec3[] | null>(
      (best, line) => (!best || line.length > best.length ? line : best),
      null,
    );
    if (!longest || longest.length < 3) return null;
    const ring = longest.slice();
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.hypot(last[0] - first[0], last[1] - first[1]) > 0.001) {
      ring.push(first);
    }
    return ring;
  }

export function buildSiteGuideFillGeometryImpl(this: any, ring: Vec3[], sampleHeight: (easting: number, northing: number) => number, origin: { easting: number; northing: number; elevation: number }): THREE.BufferGeometry {
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const targetStepM = 140;
    const cols = Math.max(1, Math.ceil((maxX - minX) / targetStepM));
    const rows = Math.max(1, Math.ceil((maxY - minY) / targetStepM));
    const stepX = (maxX - minX) / cols;
    const stepY = (maxY - minY) / rows;
    const positions: number[] = [];
    const push = (x: number, y: number) => {
      positions.push(
        x,
        y,
        this.siteGuideSurfaceZ(x, y, sampleHeight, origin, 1.4),
      );
    };

    for (let col = 0; col < cols; col += 1) {
      const x0 = minX + col * stepX;
      const x1 = minX + (col + 1) * stepX;
      for (let row = 0; row < rows; row += 1) {
        const y0 = minY + row * stepY;
        const y1 = minY + (row + 1) * stepY;
        const cx = (x0 + x1) * 0.5;
        const cy = (y0 + y1) * 0.5;
        if (!this.pointInSiteGuideRing(cx, cy, ring)) continue;
        push(x0, y0);
        push(x1, y0);
        push(x1, y1);
        push(x0, y0);
        push(x1, y1);
        push(x0, y1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

export function updateSiteSurfaceGuideImpl(this: any, id: string, group: THREE.Object3D, style: EditableStyle, sampleHeight: (easting: number, northing: number) => number): void {
    const sourceLines = this.sourceSiteGuideLines(group);
    if (sourceLines.length === 0) return;
    const origin = this.siteSurfaceGuideOrigin(group);
    const linePositions: number[] = [];
    for (const sourceLine of sourceLines) {
      const line = this.resampleSiteGuideLine(sourceLine, 90);
      for (let index = 1; index < line.length; index += 1) {
        for (const point of [line[index - 1], line[index]]) {
          linePositions.push(
            point[0],
            point[1],
            this.siteGuideSurfaceZ(point[0], point[1], sampleHeight, origin, 3),
          );
        }
      }
    }

    const fillColor =
      typeof style.color === "string"
        ? style.color
        : id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID
          ? "#ffd84a"
          : "#adadad";
    const fillOpacity =
      typeof style.fillOpacity === "number" ? clamp01(style.fillOpacity) : 0.08;
    const outlineColor =
      typeof style.outlineColor === "string" ? style.outlineColor : fillColor;
    const outlineOpacity =
      typeof style.opacity === "number" ? clamp01(style.opacity) : 1;
    const renderOrder =
      id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID ? 4590 : 4580;

    group.traverse((obj) => {
      if (obj.userData?.terrainDrapedSiteGuideLine !== true) return;
      const line = obj as LineSegments2;
      const geometry = line.geometry as LineSegmentsGeometry | undefined;
      if (geometry?.setPositions) {
        geometry.setPositions(linePositions);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        line.computeLineDistances();
      }
      const material = line.material as LineMaterial | undefined;
      if (material instanceof LineMaterial) {
        material.color.set(outlineColor);
        material.opacity = outlineOpacity;
        material.transparent = true;
        material.depthTest = true;
        material.depthWrite = false;
        material.userData.forceTransparent = true;
        material.userData.lakeOutlineMaterial = true;
        material.needsUpdate = true;
      }
    });

    const ring = this.siteGuideRing(sourceLines);
    let fill = group.children.find(
      (child) => child.userData?.terrainDrapedSiteGuideFill === true,
    ) as THREE.Mesh | undefined;
    if (!ring || fillOpacity <= 0.0001) {
      if (fill) {
        fill.parent?.remove(fill);
        disposeObjectTree(fill);
      }
      return;
    }

    const fillGeometry = this.buildSiteGuideFillGeometry(
      ring,
      sampleHeight,
      origin,
    );
    if (!fill) {
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: fillColor,
        transparent: true,
        opacity: fillOpacity,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      fillMaterial.userData.forceTransparent = true;
      fillMaterial.userData.lakeFillMaterial = true;
      fill = new THREE.Mesh(fillGeometry, fillMaterial);
      fill.name = `${group.name || id} fill`;
      fill.userData = {
        displayName: group.userData?.displayName ?? group.name,
        terrainDrapedSiteGuideFill: true,
      };
      group.add(fill);
    } else {
      fill.geometry.dispose();
      fill.geometry = fillGeometry;
    }
    fill.renderOrder = renderOrder - 0.1;
    const material = fill.material as THREE.MeshBasicMaterial;
    material.color.set(fillColor);
    material.opacity = fillOpacity;
    material.transparent = true;
    material.depthTest = true;
    material.depthWrite = false;
    material.needsUpdate = true;
  }

export function applySiteSurfaceGuideStyleImpl(this: any, id: string, style: EditableStyle): void {
    if (!this.isSiteSurfaceGuideLayerId(id)) return;
    const group = this.layers.get(id);
    if (!group) return;
    void getHeightSampler().then((sampleHeight) => {
      if (this.layers.get(id) !== group) return;
      this.updateSiteSurfaceGuide(id, group, style, sampleHeight);
    });
  }

export function reapplySiteSurfaceGuidesImpl(this: any): void {
    for (const id of [
      UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
      UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
    ]) {
      this.applySiteSurfaceGuideStyle(id, this.styleForLayer(id));
    }
  }

export function applyTerrainLiftStyleImpl(this: any, layerId: string, style: EditableStyle): void {
    this.topoRuntime.applySurfaceLiftStyle(layerId, style);
  }

export function applyTerrainCompositeStyleImpl(this: any, layerId: string, style: EditableStyle): void {
    if (
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return;
    const opacity =
      typeof style.opacity === "number" ? clamp01(style.opacity) : 1;
    const fillOpacity =
      typeof style.fillOpacity === "number"
        ? clamp01(style.fillOpacity)
        : opacity;
    const affectedByFog = styleAffectedByFog(style);
    const fogDensity = styleFogDensity(style, this.envFogDensity);
    terrainGroup.traverse((obj: THREE.Object3D) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "hydrography-lakes":
          if (typeof style.color === "string") handle.setLakeColor(style.color);
          handle.setLakeFogEnabled(affectedByFog);
          handle.setLakeFogDensity(fogDensity);
          handle.setLakeOpacity(fillOpacity);
          break;
        case "three-firs-target":
          if (typeof style.color === "string") {
            handle.setTargetColor("target-three-firs", style.color);
          }
          handle.setTargetFogEnabled("target-three-firs", affectedByFog);
          handle.setTargetFogDensity("target-three-firs", fogDensity);
          handle.setTargetOpacity("target-three-firs", opacity);
          break;
        case "great-plains-target":
          if (typeof style.color === "string") {
            handle.setTargetColor("target-great-plains", style.color);
          }
          handle.setTargetFogEnabled("target-great-plains", affectedByFog);
          handle.setTargetFogDensity("target-great-plains", fogDensity);
          handle.setTargetOpacity("target-great-plains", opacity);
          break;
        case "claim-boundary":
          if (typeof style.color === "string")
            handle.setClaimColor(style.color);
          handle.setClaimFogEnabled(affectedByFog);
          handle.setClaimFogDensity(fogDensity);
          handle.setClaimOpacity(opacity);
          break;
        case "bedrock-geology":
          handle.setGeologyFogEnabled(affectedByFog);
          handle.setGeologyFogDensity(fogDensity);
          handle.setGeologyOpacity(opacity);
          break;
        case "trees-vri":
          if (typeof style.color === "string") {
            handle.setForestColor(style.color);
            handle.setForestOutlineColor(style.color);
          }
          handle.setForestFogEnabled(affectedByFog);
          handle.setForestFogDensity(fogDensity);
          handle.setForestEdge(
            typeof style.forestEdgeThreshold === "number"
              ? style.forestEdgeThreshold
              : 0.5,
            typeof style.forestEdgeSoftness === "number"
              ? style.forestEdgeSoftness
              : 0.035,
          );
          handle.setForestFillOpacity(opacity);
          handle.setForestOutlineOpacity(opacity);
          // Sync wall geometry material (created by loadTreesVri).
          // wallMaterial lives on the inner group returned by the loader,
          // not on the outer wrapper group, so traverse to find it.
          {
            let wallMat: THREE.ShaderMaterial | undefined;
            this.layers.get("trees-vri")?.traverse((child: THREE.Object3D) => {
              if (
                !wallMat &&
                child.userData?.wallMaterial instanceof THREE.ShaderMaterial
              )
                wallMat = child.userData.wallMaterial;
            });
            if (wallMat) {
              wallMat.uniforms.uWallHeight.value = Math.max(
                0,
                typeof style.forestEmbossHeight === "number"
                  ? style.forestEmbossHeight
                  : 0,
              );
              if (typeof style.color === "string")
                wallMat.uniforms.uColor.value.set(style.color);
              wallMat.uniforms.uFogEnabled.value = affectedByFog ? 1 : 0;
              wallMat.uniforms.uFogFar.value =
                3 / Math.max(fogDensity, 0.00001);
            }
          }
          break;
      }
    });
    if (layerId === "hydrography-lakes") {
      this.applyStreamLakeOcclusion(opacity > 0.001);
    }
  }
