import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { loadCameraFlightPath } from "../loaders/loadCameraFlightPath";
import { loadCameraFrustums } from "../loaders/loadCameraFrustums";
import { loadClaim } from "../loaders/loadClaim";
import { loadCollars2024 } from "../loaders/loadCollars2024";
import { loadMegatonDcipAnomaly } from "../loaders/loadDcipAnomaly";
import { loadDemoQuarry } from "../loaders/loadDemoQuarry";
import { loadDrills } from "../loaders/loadDrills";
import { loadEzGamma } from "../loaders/loadEzGamma";
import { loadGeochemSoils } from "../loaders/loadGeochemSoils";
import { loadGeology } from "../loaders/loadGeology";
import { loadStreams, loadLakes } from "../loaders/loadHydrography";
import { loadHyperspectralCoverage } from "../loaders/loadHyperspectralCoverage";
import { loadImageryLidarAoi } from "../loaders/loadImageryLidarAoi";
import { loadIpSurveyLines } from "../loaders/loadIpSurveyLines";
import { loadLineStrings } from "../loaders/loadLineStrings";
import { loadMeshPreview } from "../loaders/loadMeshPreview";
import { loadNaipTileDiagnostics } from "../loaders/loadNaipTileDiagnostics";
import { loadPhotoOverlayPreview } from "../loaders/loadPhotoOverlayPreview";
import { loadPointCloudPreview } from "../loaders/loadPointCloudPreview";
import { loadPointMarkers } from "../loaders/loadPointMarkers";
import { loadPowerLines } from "../loaders/loadPowerLines";
import { loadPropertyNeighbors } from "../loaders/loadPropertyNeighbors";
import { loadRoads } from "../loaders/loadRoads";
import { loadScalarVolume } from "../loaders/loadScalarVolume";
import { loadSeismicBrowser } from "../loaders/loadSeismicBrowser";
import {
  loadGreatPlainsTarget,
  loadThreeFirsTarget,
} from "../loaders/loadTargets";
import { loadTerrain } from "../loaders/loadTerrain";
import { loadTopoGraticule } from "../loaders/loadTopoGraticule";
import { loadTiledPointCloudPreview } from "../loaders/loadTiledPointCloudPreview";
import { loadTreesVri } from "../loaders/loadTreesVri";
import { loadUtahForgeDemoBoreholes } from "../loaders/loadUtahForgeDemoBoreholes";
import { SURFACE_RENDER_ORDER } from "../loaders/surfaceRenderPolicy";
import { geoTransformOptionsFromMetadata } from "../loaders/geoTransform";
import type { ProjectLayerSpec } from "../pages/types";
import { registerBaseGuiLoaders } from "../projectModules/baseGui/registerBaseGuiLoaders";
import { registerUtahForgeReferenceLoaders } from "../projectModules/utahForge/registerUtahForgeReferenceLoaders";
import { UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID } from "../projectModules/utahForge/layerIds";
import { isTopoMapGraticuleLayer } from "../topoMap/settings";
import { appAssetUrl } from "../projects/projectPathsRuntime";
import { SceneManager } from "./SceneManager";
import {
  createLayerLoaderRegistry,
  type LayerLoadContext,
  type LayerLoaderHandler,
} from "./layerLoaderRegistry";

export function resolveDataPath(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return appAssetUrl(clean.startsWith("data/") ? clean.slice(5) : clean);
}

function loadObject(
  context: LayerLoadContext,
  label: string,
  promise: Promise<THREE.Object3D>,
): void {
  promise
    .then(context.onLoaded)
    .catch((error) => console.error(`${label} failed:`, error));
}

function layerDataPath(context: LayerLoadContext, file: string): string {
  return context.resolveDataPath(file);
}

function layerFiles(spec: ProjectLayerSpec): Record<string, string> {
  return spec.previewFiles ?? spec.files ?? {};
}

function fileOrLegacyPath(
  spec: ProjectLayerSpec,
  fileKey: string,
  fallback: string,
): string {
  return (
    layerFiles(spec)[fileKey] ?? (spec as { path?: string }).path ?? fallback
  );
}

function layerGeoTransform(spec: ProjectLayerSpec) {
  return geoTransformOptionsFromMetadata(spec.metadata);
}

function loadReferenceStage(label: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = label;
  group.userData.displayName = label;

  const floorGeometry = new THREE.CircleGeometry(72, 96);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#75c7ff",
    transparent: true,
    opacity: 0.16,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.name = `${label} floor`;
  floor.userData.displayName = label;
  floor.userData.scaleReferenceSurface = true;
  group.add(floor);

  const ringGeometry = new THREE.RingGeometry(70, 72, 128);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#f4f0e8",
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.name = `${label} ring`;
  group.add(ring);

  return group;
}

type Vec3 = [number, number, number];

function finiteVec3(value: unknown): Vec3 | null {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  ) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

function workingAreaSceneBounds(spec: ProjectLayerSpec): {
  min: Vec3;
  max: Vec3;
} {
  const metadata = spec.metadata as Record<string, unknown>;
  const workingArea =
    metadata.phase3WorkingArea && typeof metadata.phase3WorkingArea === "object"
      ? (metadata.phase3WorkingArea as Record<string, unknown>)
      : null;
  const sceneBounds =
    workingArea?.sceneBounds && typeof workingArea.sceneBounds === "object"
      ? (workingArea.sceneBounds as Record<string, unknown>)
      : null;
  const min = finiteVec3(sceneBounds?.min);
  const max = finiteVec3(sceneBounds?.max);
  if (min && max) return { min, max };
  return {
    min: [-8041.4, -12617.6, -6200],
    max: [-3841.4, -8417.6, 1800],
  };
}

function boxSegmentPositions(min: Vec3, max: Vec3): number[] {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const corners: Vec3[] = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
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
  return edges.flatMap(([a, b]) => [...corners[a], ...corners[b]]);
}

function applyWorkingAreaTopLinePolicy(
  root: THREE.Object3D,
  label: string,
  bounds: { min: Vec3; max: Vec3 },
  source: unknown,
): THREE.Object3D {
  root.name = label;
  root.renderOrder = 4580;
  root.userData = {
    ...root.userData,
    displayName: label,
    phase3WorkingArea: true,
    siteContainerOutline: true,
    terrainDrapedSiteGuide: true,
    sceneBounds: bounds,
  };
  root.traverse((obj) => {
    obj.renderOrder = 4580;
    const line = obj as THREE.Line;
    const material = line.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const m of materials) {
      const lineMaterial = m as THREE.Material & { fog?: boolean };
      m.depthTest = true;
      m.depthWrite = false;
      m.transparent = true;
      lineMaterial.fog = false;
      m.userData.forceTransparent = true;
      m.userData.lakeOutlineMaterial = true;
      if (m instanceof LineMaterial) {
        m.linewidth = 2.4;
      }
      m.needsUpdate = true;
    }
    obj.userData = {
      ...obj.userData,
      displayName: label,
      phase3WorkingArea: true,
      siteContainerOutline: true,
      terrainDrapedSiteGuideLine: true,
      sceneBounds: bounds,
      source,
    };
  });
  return root;
}

function applyForgeSiteBoundaryPolicy(
  root: THREE.Object3D,
  label: string,
  source: unknown,
): THREE.Object3D {
  root.name = label;
  root.renderOrder = 4590;
  root.userData = {
    ...root.userData,
    displayName: label,
    forgeSiteBoundary: true,
    terrainDrapedSiteGuide: true,
  };
  root.traverse((obj) => {
    obj.renderOrder = 4590;
    const line = obj as THREE.Line;
    const material = line.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const m of materials) {
      const lineMaterial = m as THREE.Material & {
        color?: THREE.Color;
        fog?: boolean;
        opacity?: number;
      };
      lineMaterial.color?.set("#ffd84a");
      m.depthTest = true;
      m.depthWrite = false;
      m.transparent = true;
      lineMaterial.opacity = 1;
      lineMaterial.fog = false;
      m.userData.forceTransparent = true;
      m.userData.lakeOutlineMaterial = true;
      if (m instanceof LineMaterial) {
        m.linewidth = 3.2;
      }
      m.needsUpdate = true;
    }
    obj.userData = {
      ...obj.userData,
      displayName: label,
      forgeSiteBoundary: true,
      terrainDrapedSiteGuideLine: true,
      source,
    };
  });
  return root;
}

function loadUtahForgePhase3WorkingAreaBox(
  spec: ProjectLayerSpec,
): THREE.Object3D {
  const label = spec.label || "Phase 3 working area";
  const bounds = workingAreaSceneBounds(spec);
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(boxSegmentPositions(bounds.min, bounds.max));

  const material = new LineMaterial({
    color: 0xffffff,
    linewidth: 2.4,
    worldUnits: false,
    transparent: true,
    opacity: 0.92,
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

  const outline = new LineSegments2(geometry, material);
  outline.name = `${label} white outline`;
  outline.renderOrder = 4580;
  outline.userData = {
    displayName: label,
    phase3WorkingAreaBoundingBox: true,
    sceneBounds: bounds,
    source: spec.metadata,
  };

  const group = new THREE.Group();
  group.name = label;
  group.userData = {
    displayName: label,
    phase3WorkingArea: true,
    sceneBounds: bounds,
  };
  group.add(outline);
  return group;
}

const layerLoaders: LayerLoaderHandler[] = [
  {
    id: "utah-forge-phase3-working-area",
    matches: (spec) => spec.id === "utah-forge-phase3-working-area",
    load: (context) => {
      const label = context.spec.label || "Phase 3 working area";
      const bounds = workingAreaSceneBounds(context.spec);
      const geojson = layerFiles(context.spec).geojson;
      if (geojson) {
        loadObject(
          context,
          "loadUtahForgePhase3WorkingArea",
          loadLineStrings(layerDataPath(context, geojson)).then((group) =>
            applyWorkingAreaTopLinePolicy(
              group,
              label,
              bounds,
              context.spec.metadata,
            ),
          ),
        );
        return;
      }
      context.onLoaded(loadUtahForgePhase3WorkingAreaBox(context.spec));
    },
  },
  {
    id: "utah-forge-site-boundary",
    matches: (spec) => spec.id === "utah-forge-site-boundary",
    load: (context) => {
      const label = context.spec.label || "FORGE site boundary";
      const geojson = layerFiles(context.spec).geojson;
      if (!geojson) return;
      loadObject(
        context,
        "loadUtahForgeSiteBoundary",
        loadLineStrings(layerDataPath(context, geojson)).then((group) =>
          applyForgeSiteBoundaryPolicy(group, label, context.spec.metadata),
        ),
      );
    },
  },
  {
    id: "topo-map-graticule",
    matches: (spec) => isTopoMapGraticuleLayer(spec),
    load: (context) =>
      loadObject(
        context,
        "loadTopoGraticule",
        loadTopoGraticule(
          context.spec.metadata,
          layerGeoTransform(context.spec),
        ),
      ),
  },
  {
    id: "naip-tile-diagnostics",
    matches: (spec) => spec.id === "naip-2024-tile-diagnostics",
    load: (context) =>
      loadObject(
        context,
        "loadNaipTileDiagnostics",
        loadNaipTileDiagnostics(context.spec, layerGeoTransform(context.spec)),
      ),
  },
  ...registerBaseGuiLoaders(loadReferenceStage),
  ...registerUtahForgeReferenceLoaders(loadReferenceStage),
  {
    id: "seismic-browser",
    matches: (spec) =>
      spec.type === "seismic" && !!layerFiles(spec).seismicManifest,
    load: (context) =>
      loadObject(
        context,
        `loadSeismicBrowser (${context.spec.id})`,
        loadSeismicBrowser(
          layerDataPath(context, context.files.seismicManifest),
        ),
      ),
  },
  {
    id: UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
    matches: (spec) =>
      spec.id === UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID &&
      !!layerFiles(spec).manifest,
    load: (context) =>
      loadObject(
        context,
        `loadUtahForgeDemoBoreholes (${context.spec.id})`,
        loadUtahForgeDemoBoreholes(layerDataPath(context, context.files.manifest)),
      ),
  },
  {
    id: "scalar-volume",
    matches: (spec) =>
      spec.type === "volume" && !!layerFiles(spec).scalarVolumeManifest,
    load: (context) =>
      loadObject(
        context,
        `loadScalarVolume (${context.spec.id})`,
        loadScalarVolume(
          layerDataPath(context, context.files.scalarVolumeManifest),
        ),
      ),
  },
  {
    id: "case-study-b-demo-shell",
    matches: (spec) => spec.id === "case-study-b-demo-shell",
    load: (context) => loadObject(context, "loadDemoQuarry", loadDemoQuarry()),
  },
  {
    id: "pointcloud-preview",
    matches: (spec) => spec.type === "pointcloud" && !!layerFiles(spec).preview,
    load: (context) =>
      loadObject(
        context,
        `loadPointCloudPreview (${context.spec.id})`,
        loadPointCloudPreview(layerDataPath(context, context.files.preview)),
      ),
  },
  {
    id: "pointcloud-preview-tiles",
    matches: (spec) =>
      spec.type === "pointcloud" && !!layerFiles(spec).previewTiles,
    load: (context) =>
      loadObject(
        context,
        `loadTiledPointCloudPreview (${context.spec.id})`,
        loadTiledPointCloudPreview(
          layerDataPath(context, context.files.previewTiles),
        ),
      ),
  },
  {
    id: "shahbazi-split-surface-preview",
    matches: (spec) =>
      spec.id === "shahbazi-tls-surface-preview" &&
      !!layerFiles(spec).outerMeshPreview &&
      !!layerFiles(spec).meshPreview,
    load: (context) => {
      const { spec } = context;
      Promise.all([
        loadMeshPreview(
          layerDataPath(context, context.files.outerMeshPreview),
          {
            depthPolicy: "depth-occluding-preview",
            renderOrder: SURFACE_RENDER_ORDER.outerMeshPreview,
          },
        ),
        loadMeshPreview(layerDataPath(context, context.files.meshPreview), {
          depthPolicy: "depth-occluding-preview",
          renderOrder: SURFACE_RENDER_ORDER.meshPreview,
        }),
      ])
        .then(([outerSurface, tlsSurface]) => {
          const combined = new THREE.Group();
          combined.name = "Shahbazi ground surface preview";
          combined.userData.displayName = "Shahbazi ground surface preview";
          outerSurface.traverse((obj) => {
            if (obj.userData?.meshPreview === true) {
              obj.renderOrder = SURFACE_RENDER_ORDER.outerMeshPreview;
            }
          });
          tlsSurface.traverse((obj) => {
            if (obj.userData?.meshPreview === true) {
              obj.renderOrder = SURFACE_RENDER_ORDER.meshPreview;
            }
          });
          combined.add(outerSurface, tlsSurface);
          context.onLoaded(combined);
        })
        .catch((error) =>
          console.error(`loadMeshPreview (${spec.id}) failed:`, error),
        );
    },
  },
  {
    id: "mesh-preview",
    matches: (spec) => spec.type === "mesh" && !!layerFiles(spec).meshPreview,
    load: (context) =>
      loadObject(
        context,
        `loadMeshPreview (${context.spec.id})`,
        loadMeshPreview(layerDataPath(context, context.files.meshPreview)),
      ),
  },
  {
    id: "shahbazi-tie-point-support",
    matches: (spec) =>
      spec.id === "shahbazi-tie-point-support-isolines" &&
      !!layerFiles(spec).geojson &&
      !!layerFiles(spec).meshPreview,
    load: (context) => {
      const { spec } = context;
      Promise.all([
        loadMeshPreview(layerDataPath(context, context.files.meshPreview)),
        loadLineStrings(layerDataPath(context, context.files.geojson)),
      ])
        .then(([mesh, lines]) => {
          const combined = new THREE.Group();
          combined.name = "Shahbazi tie-point support isolines";
          combined.userData.displayName = "Shahbazi tie-point support isolines";
          combined.add(mesh, lines);
          context.onLoaded(combined);
        })
        .catch((error) =>
          console.error(
            `load tie-point support layer (${spec.id}) failed:`,
            error,
          ),
        );
    },
  },
  {
    id: "shahbazi-split-contours",
    matches: (spec) =>
      spec.id === "shahbazi-tls-contours" && !!layerFiles(spec).geojson,
    load: (context) => {
      const contourFiles = [
        context.files.outerGeojson,
        context.files.geojson,
      ].filter((file): file is string => typeof file === "string");
      Promise.all(
        contourFiles.map((file) =>
          loadLineStrings(layerDataPath(context, file)),
        ),
      )
        .then((lineGroups) => {
          const combined = new THREE.Group();
          combined.name = "Shahbazi ground surface contours";
          combined.userData.displayName = "Shahbazi ground surface contours";
          combined.add(...lineGroups);
          context.onLoaded(combined);
        })
        .catch((error) =>
          console.error(`loadLineStrings (${context.spec.id}) failed:`, error),
        );
    },
  },
  {
    id: "shahbazi-photo-overlay-preview",
    matches: (spec) =>
      spec.id === "shahbazi-photo-overlay-preview" &&
      !!layerFiles(spec).manifest,
    load: (context) =>
      loadObject(
        context,
        `loadPhotoOverlayPreview (${context.spec.id})`,
        loadPhotoOverlayPreview(layerDataPath(context, context.files.manifest)),
      ),
  },
  {
    id: "point-markers",
    matches: (spec) => spec.type === "point" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadPointMarkers (${context.spec.id})`,
        loadPointMarkers(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "shahbazi-camera-poses",
    matches: (spec) =>
      spec.id === "shahbazi-camera-poses" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadCameraFlightPath (${context.spec.id})`,
        loadCameraFlightPath(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "shahbazi-dense-matching-links",
    matches: (spec) =>
      spec.id === "shahbazi-dense-matching-links" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadCameraFlightPath (${context.spec.id})`,
        loadCameraFlightPath(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "shahbazi-camera-frustums",
    matches: (spec) =>
      spec.id === "shahbazi-camera-frustums" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadCameraFrustums (${context.spec.id})`,
        loadCameraFrustums(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "drillholes-2023",
    matches: (spec) =>
      spec.id === "drillholes-2023" && !!layerFiles(spec).geojson,
    load: (context) => {
      const { manager, spec } = context;
      loadDrills(layerDataPath(context, context.files.geojson))
        .then((obj) => {
          const assayLayer = manager.getLayer("assay-samples");
          if (assayLayer) {
            const assayObjects = obj.children.filter(
              (child) =>
                child.userData?.drillTraceRole === "assay" ||
                child.userData?.drillBoreLens === true,
            );
            for (const child of assayObjects) assayLayer.add(child);
          }
          context.onLoaded(obj);
        })
        .catch((error) =>
          console.error(`loadDrills (${spec.id}) failed:`, error),
        );
    },
  },
  {
    id: "empty-editor-layer",
    matches: (spec) =>
      spec.id === "assay-samples" || spec.id === "area-outlines",
    load: () => undefined,
  },
  {
    id: "drillholes-2024-tf",
    matches: (spec) =>
      spec.id === "drillholes-2024-tf" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadCollars2024 (${context.spec.id})`,
        loadCollars2024(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "ez-gamma-2024",
    matches: (spec) =>
      spec.id === "ez-gamma-2024" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadEzGamma (${context.spec.id})`,
        loadEzGamma(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "geochem-soils-2024",
    matches: (spec) =>
      spec.id === "geochem-soils-2024" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadGeochemSoils (${context.spec.id})`,
        loadGeochemSoils(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "ip-survey-lines-2024",
    matches: (spec) =>
      spec.id === "ip-survey-lines-2024" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadIpSurveyLines (${context.spec.id})`,
        loadIpSurveyLines(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "hyperspectral-coverage-2024",
    matches: (spec) =>
      spec.id === "hyperspectral-coverage-2024" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadHyperspectralCoverage (${context.spec.id})`,
        loadHyperspectralCoverage(
          layerDataPath(context, context.files.geojson),
        ),
      ),
  },
  {
    id: "imagery-lidar-aoi-2024",
    matches: (spec) =>
      spec.id === "imagery-lidar-aoi-2024" && !!layerFiles(spec).geojson,
    load: (context) =>
      loadObject(
        context,
        `loadImageryLidarAoi (${context.spec.id})`,
        loadImageryLidarAoi(layerDataPath(context, context.files.geojson)),
      ),
  },
  {
    id: "three-firs-target",
    matches: (spec) => spec.id === "three-firs-target",
    load: (context) =>
      loadObject(context, "loadThreeFirsTarget", loadThreeFirsTarget()),
  },
  {
    id: "great-plains-target",
    matches: (spec) => spec.id === "great-plains-target",
    load: (context) =>
      loadObject(context, "loadGreatPlainsTarget", loadGreatPlainsTarget()),
  },
  {
    id: "megaton-dcip-anomaly",
    matches: (spec) => spec.id === "megaton-dcip-anomaly",
    load: (context) =>
      loadObject(context, "loadMegatonDcipAnomaly", loadMegatonDcipAnomaly()),
  },
  {
    id: "bedrock-geology",
    matches: (spec) => spec.id === "bedrock-geology",
    load: (context) => {
      const path = fileOrLegacyPath(
        context.spec,
        "geojson",
        "/data/bedrock_geology.geojson",
      );
      loadGeology(
        layerDataPath(context, path),
        appAssetUrl("bedrock_geology_colors.json"),
      )
        .then((group) => {
          context.onLoaded(group);
          if (group.geologyHandle)
            context.manager.registerGeology(group.geologyHandle);
        })
        .catch((error) => console.error("loadGeology failed:", error));
    },
  },
  {
    id: "claim-boundary",
    matches: (spec) => spec.id === "claim-boundary",
    load: (context) =>
      loadObject(
        context,
        "loadClaim",
        loadClaim(
          layerDataPath(
            context,
            fileOrLegacyPath(
              context.spec,
              "geojson",
              "/data/claim_boundary.geojson",
            ),
          ),
        ),
      ),
  },
  {
    id: "hydrography-streams",
    matches: (spec) => spec.id === "hydrography-streams",
    load: (context) => {
      const lakeFile =
        context.files.lakesGeojson ??
        context.files.lakes ??
        "data/hydrography_lakes.geojson";
      loadObject(
        context,
        "loadStreams",
        loadStreams(
          layerDataPath(
            context,
            fileOrLegacyPath(
              context.spec,
              "geojson",
              "/data/hydrography_streams.geojson",
            ),
          ),
          layerDataPath(context, lakeFile),
          layerGeoTransform(context.spec),
        ),
      );
    },
  },
  {
    id: "hydrography-lakes",
    matches: (spec) => spec.id === "hydrography-lakes",
    load: (context) =>
      loadObject(
        context,
        "loadLakes",
        loadLakes(
          layerDataPath(
            context,
            fileOrLegacyPath(
              context.spec,
              "geojson",
              "/data/hydrography_lakes.geojson",
            ),
          ),
          layerGeoTransform(context.spec),
        ),
      ),
  },
  {
    id: "transport-roads",
    matches: (spec) => spec.id === "transport-roads",
    load: (context) =>
      loadObject(
        context,
        "loadRoads",
        loadRoads(
          layerDataPath(
            context,
            fileOrLegacyPath(context.spec, "geojson", "/data/roads.geojson"),
          ),
          layerGeoTransform(context.spec),
        ),
      ),
  },
  {
    id: "power-lines",
    matches: (spec) => spec.id === "power-lines",
    load: (context) =>
      loadObject(
        context,
        "loadPowerLines",
        loadPowerLines(
          layerDataPath(
            context,
            fileOrLegacyPath(
              context.spec,
              "geojson",
              "/data/power_lines.geojson",
            ),
          ),
        ),
      ),
  },
  {
    id: "property-neighbors",
    matches: (spec) => spec.id === "property-neighbors",
    load: (context) =>
      loadObject(
        context,
        "loadPropertyNeighbors",
        loadPropertyNeighbors(
          layerDataPath(
            context,
            fileOrLegacyPath(
              context.spec,
              "geojson",
              "/data/property_neighbors.geojson",
            ),
          ),
        ),
      ),
  },
  {
    id: "trees-vri",
    matches: (spec) => spec.id === "trees-vri",
    load: (context) =>
      loadObject(
        context,
        "loadTreesVri",
        loadTreesVri(
          layerDataPath(
            context,
            fileOrLegacyPath(
              context.spec,
              "geojson",
              "/data/trees_vri.geojson",
            ),
          ),
        ),
      ),
  },
  {
    id: "geotiff-terrain",
    matches: (spec) => spec.type === "geotiff" && !!layerFiles(spec).raster,
    load: (context) =>
      loadObject(
        context,
        `loadTerrain (${context.spec.id})`,
        loadTerrain(
          layerDataPath(context, context.files.raster),
          layerGeoTransform(context.spec),
        ),
      ),
  },
];

const layerLoaderRegistry = createLayerLoaderRegistry(layerLoaders);

export function loadLayerInto(
  spec: ProjectLayerSpec,
  manager: SceneManager,
): void {
  if ((spec as { disabled?: boolean }).disabled) return;

  const group = manager.getLayer(spec.id);
  if (!group) {
    console.warn(`[scene] layer "${spec.id}" not registered`);
    return;
  }

  const context: LayerLoadContext = {
    spec,
    manager,
    group,
    files: layerFiles(spec),
    resolveDataPath,
    onLoaded: (obj) => {
      if (obj.userData?.seismicBrowser === true) {
        obj.userData.seismicOnProductsLoaded = () => {
          manager.reapplyCurrentPageState("async-layer-resolve");
        };
        Object.assign(group.userData, obj.userData);
      }
      if (obj.userData?.scalarVolumeLayer === true) {
        Object.assign(group.userData, obj.userData);
      }
      group.add(obj);
      manager.reapplyCurrentPageState("async-layer-resolve");
    },
  };

  const loader = layerLoaderRegistry.find(context);
  if (loader) {
    loader.load(context);
    return;
  }

  console.warn(
    `[scene] no loader matched layer "${spec.id}" (type=${spec.type})`,
  );
}
