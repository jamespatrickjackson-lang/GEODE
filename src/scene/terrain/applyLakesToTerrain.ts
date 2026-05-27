import * as THREE from "three";
import type { EnvironmentSetup, EditableStyle, PresentationPage } from "../../pages/types";
import { effectiveStyle, effectiveVisibility } from "../../pages/effective";
import type { TerrainMaterialHandle } from "../terrainMaterial";
import { clampRange } from "../styles/styleUtils";

function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

function styleFogDensity(style: EditableStyle, fallback: number): number {
  return typeof style.fogDensity === "number" && Number.isFinite(style.fogDensity)
    ? clampRange(style.fogDensity, 0.000001, 0.002)
    : fallback;
}

export function applyLakesToTerrain(this: any, 
  environment: EnvironmentSetup,
  page: PresentationPage,
  opacityOverrides: ReadonlyMap<string, number> = new Map(),
): void {
  const terrainGroup = this.topoSurfaceGroup();
  if (!terrainGroup) return;
  const visibleSet = effectiveVisibility(environment, page);

  const lakeStyle = effectiveStyle(environment, page, "hydrography-lakes");
  const lakeFillOpacity =
    typeof lakeStyle.fillOpacity === "number"
      ? lakeStyle.fillOpacity
      : typeof lakeStyle.opacity === "number"
        ? lakeStyle.opacity
        : 1;
  const lakeOp =
    opacityOverrides.get("hydrography-lakes") ??
    (visibleSet.has("hydrography-lakes") ? 1 : 0) * lakeFillOpacity;
  this.applyStreamLakeOcclusion(lakeOp > 0.001);

  const tfStyle = effectiveStyle(environment, page, "three-firs-target");
  const tfOp =
    opacityOverrides.get("three-firs-target") ??
    (visibleSet.has("three-firs-target") ? 1 : 0) *
      (typeof tfStyle.opacity === "number" ? tfStyle.opacity : 1);

  const gpStyle = effectiveStyle(environment, page, "great-plains-target");
  const gpOp =
    opacityOverrides.get("great-plains-target") ??
    (visibleSet.has("great-plains-target") ? 1 : 0) *
      (typeof gpStyle.opacity === "number" ? gpStyle.opacity : 1);

  const claimStyle = effectiveStyle(environment, page, "claim-boundary");
  const claimOp =
    opacityOverrides.get("claim-boundary") ??
    (visibleSet.has("claim-boundary") ? 1 : 0) *
      (typeof claimStyle.opacity === "number" ? claimStyle.opacity : 1);

  const geologyStyle = effectiveStyle(environment, page, "bedrock-geology");
  const geologyOp =
    opacityOverrides.get("bedrock-geology") ??
    (visibleSet.has("bedrock-geology") ? 1 : 0) *
      (typeof geologyStyle.opacity === "number"
        ? geologyStyle.opacity
        : 0.28);

  const forestStyle = effectiveStyle(environment, page, "trees-vri");
  const forestOpacity =
    typeof forestStyle.opacity === "number" ? forestStyle.opacity : 0.4;
  const forestOp =
    opacityOverrides.get("trees-vri") ??
    (visibleSet.has("trees-vri") ? 1 : 0);

  terrainGroup.traverse((obj: THREE.Object3D) => {
    const handle = (obj as THREE.Mesh).userData?.terrainHandle as
      | TerrainMaterialHandle
      | undefined;
    if (!handle) return;
    if (typeof lakeStyle.color === "string")
      handle.setLakeColor(lakeStyle.color);
    handle.setLakeFogEnabled(styleAffectedByFog(lakeStyle));
    handle.setLakeFogDensity(styleFogDensity(lakeStyle, this.envFogDensity));
    handle.setLakeOpacity(lakeOp);
    if (typeof tfStyle.color === "string")
      handle.setTargetColor("target-three-firs", tfStyle.color);
    handle.setTargetFogEnabled(
      "target-three-firs",
      styleAffectedByFog(tfStyle),
    );
    handle.setTargetFogDensity(
      "target-three-firs",
      styleFogDensity(tfStyle, this.envFogDensity),
    );
    handle.setTargetOpacity("target-three-firs", tfOp);
    if (typeof gpStyle.color === "string")
      handle.setTargetColor("target-great-plains", gpStyle.color);
    handle.setTargetFogEnabled(
      "target-great-plains",
      styleAffectedByFog(gpStyle),
    );
    handle.setTargetFogDensity(
      "target-great-plains",
      styleFogDensity(gpStyle, this.envFogDensity),
    );
    handle.setTargetOpacity("target-great-plains", gpOp);
    if (typeof claimStyle.color === "string")
      handle.setClaimColor(claimStyle.color);
    handle.setClaimFogEnabled(styleAffectedByFog(claimStyle));
    handle.setClaimFogDensity(
      styleFogDensity(claimStyle, this.envFogDensity),
    );
    handle.setClaimOpacity(claimOp);
    handle.setGeologyFogEnabled(styleAffectedByFog(geologyStyle));
    handle.setGeologyFogDensity(
      styleFogDensity(geologyStyle, this.envFogDensity),
    );
    handle.setGeologyOpacity(geologyOp);
    if (typeof forestStyle.color === "string") {
      handle.setForestColor(forestStyle.color);
      handle.setForestOutlineColor(forestStyle.color);
    }
    handle.setForestFogEnabled(styleAffectedByFog(forestStyle));
    handle.setForestFogDensity(
      styleFogDensity(forestStyle, this.envFogDensity),
    );
    handle.setForestEdge(
      typeof forestStyle.forestEdgeThreshold === "number"
        ? forestStyle.forestEdgeThreshold
        : 0.5,
      typeof forestStyle.forestEdgeSoftness === "number"
        ? forestStyle.forestEdgeSoftness
        : 0.035,
    );
    handle.setForestFillOpacity(forestOp * forestOpacity);
    handle.setForestOutlineOpacity(forestOp * forestOpacity);
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
          typeof forestStyle.forestEmbossHeight === "number"
            ? forestStyle.forestEmbossHeight
            : 0,
        );
        if (typeof forestStyle.color === "string")
          wallMat.uniforms.uColor.value.set(forestStyle.color);
        wallMat.uniforms.uFogEnabled.value = styleAffectedByFog(forestStyle)
          ? 1
          : 0;
        wallMat.uniforms.uFogFar.value =
          3 /
          Math.max(styleFogDensity(forestStyle, this.envFogDensity), 0.00001);
      }
    }
  });

  // Geology rebuild: per-unit visibility / colour are env-level
  // sparse maps stashed on the bedrock-geology layer style. Forward
  // them to the loader's rebuild() each apply tick. Cheap (single
  // 2048² fillRect-ish pass for ~65 polygons) -- no need to diff
  // overrides against a previous snapshot.
  if (this.geologyHandle) {
    const colorMap =
      (geologyStyle as { geologyColorMap?: Record<string, string> })
        .geologyColorMap ?? {};
    const unitOverrides =
      (
        geologyStyle as {
          geologyUnitOverrides?: Record<
            string,
            { visible?: boolean; opacity?: number }
          >;
        }
      ).geologyUnitOverrides ?? {};
    this.geologyHandle.rebuild({ colorMap, unitOverrides });
  }
}
