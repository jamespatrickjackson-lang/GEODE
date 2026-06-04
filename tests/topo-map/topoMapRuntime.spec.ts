import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { applyTopoGraticuleStyle } from "../../src/topoMap/graticuleRuntime";
import {
  publicSurfaceClipBox,
  publicSurfaceClipPlanes,
} from "../../src/topoMap/publicSurfaceClipRuntime";
import { TopoMapBrandingRuntime } from "../../src/topoMap/brandingRuntime";
import {
  topoImageUtmBoundsToSceneBounds,
  type TerrainEdgeFadeState,
} from "../../src/topoMap/surfaceRuntime";
import { buildTerrainMaterial } from "../../src/scene/terrainMaterial";

function makeGraticuleLine(
  role: "interior" | "interior-dashed" | "leader" | "leader-dashed",
): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions([]);
  const material = new LineMaterial({
    color: "#d7d1c7",
    linewidth: 4,
    transparent: true,
    opacity: 0.62,
  });
  material.userData.topoGraticuleLineMaterial = true;
  const line = new LineSegments2(geometry, material);
  line.userData.topoGraticuleLineRole = role;
  return line;
}

function makeGraticuleGroup(): THREE.Group {
  const group = new THREE.Group();
  group.userData.topoGraticule = true;
  group.userData.topoGraticuleSourceLines = [
    {
      kind: "lon",
      value: -112,
      preference: "north",
      candidates: [
        {
          position: new THREE.Vector3(0, -20, 0),
          tangent: new THREE.Vector3(0, 1, 0),
        },
        {
          position: new THREE.Vector3(0, 0, 0),
          tangent: new THREE.Vector3(0, 1, 0),
        },
        {
          position: new THREE.Vector3(0, 20, 0),
          tangent: new THREE.Vector3(0, 1, 0),
        },
      ],
    },
  ];
  group.add(makeGraticuleLine("interior"));
  group.add(makeGraticuleLine("interior-dashed"));
  group.add(makeGraticuleLine("leader"));
  group.add(makeGraticuleLine("leader-dashed"));
  const label = new THREE.Object3D();
  label.userData.topoGraticuleLabel = true;
  label.userData.topoGraticuleLineKind = "lon";
  label.userData.topoGraticuleLineValue = -112;
  label.userData.topoGraticuleLabelPreference = "north";
  label.userData.topoGraticuleLabelAspect = 2.4;
  label.userData.topoGraticuleBaseScale = new THREE.Vector3(1, 1, 1);
  group.add(label);
  return group;
}

function edgeState(fadeDistanceM: number): TerrainEdgeFadeState {
  return {
    boundsMin: new THREE.Vector2(-10, -10),
    boundsMax: new THREE.Vector2(10, 10),
    shape: "square",
    fadeDistanceM,
    insetM: 0,
    cornerRadiusM: 0,
  };
}

test("topo graticule runtime rebuilds edge-aware interior and leader segments", () => {
  const group = makeGraticuleGroup();
  const clipBox = publicSurfaceClipBox({});

  applyTopoGraticuleStyle({
    group,
    style: {
      graticuleEdgeLabelOffsetM: 3,
      graticuleEdgeLabelGapM: 1,
      graticuleLabelSizeM: 9000,
    },
    clipBox,
    clipPlanes: [],
    terrainEdge: edgeState(2),
  });

  expect(group.userData.topoGraticuleInteriorSegmentCount).toBeGreaterThan(0);
  expect(group.userData.topoGraticuleLeaderSegmentCount).toBeGreaterThan(0);
  expect(group.userData.topoGraticuleInnerTrimInsideDistance).toBe(2);
  const label = group.children.find(
    (child) => child.userData.topoGraticuleLabel === true,
  );
  expect(label?.visible).toBe(true);
  expect(label?.position.y).toBeGreaterThan(10);
  expect(label?.userData.topoGraticuleLabelHasLeader).toBe(true);
});

test("topo graticule runtime keeps hard clipping when edge awareness is disabled", () => {
  const group = makeGraticuleGroup();
  const clipBox = publicSurfaceClipBox({
    publicSurfaceClipEnabled: true,
    publicSurfaceClipSizeX: 100,
    publicSurfaceClipSizeY: 100,
    publicSurfaceClipSizeZ: 100,
  });
  const clipPlanes = publicSurfaceClipPlanes(clipBox);

  applyTopoGraticuleStyle({
    group,
    style: { graticuleEdgeFadeAware: false },
    clipBox,
    clipPlanes,
    terrainEdge: edgeState(0),
  });

  const line = group.children.find(
    (child) => child.userData.topoGraticuleLineRole === "interior",
  ) as LineSegments2 | undefined;
  const material = line?.material as LineMaterial | undefined;
  expect(material?.clippingPlanes).toBe(clipPlanes);
  expect(group.userData.topoGraticuleLeaderSegmentCount).toBe(0);
});

test("topo branding runtime removes old groups before rebuilding", () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          font: "",
          clearRect: () => {},
          fillText: () => {},
          measureText: (text: string) => ({ width: text.length * 48 }),
          set textAlign(_value: string) {},
          set textBaseline(_value: string) {},
          set fillStyle(_value: string) {},
        }),
      };
      return canvas;
    },
  } as unknown as Document;
  try {
    const scene = new THREE.Scene();
    const runtime = new TopoMapBrandingRuntime({
      scene,
      resolveAssetPath: (path) => `/${path}`,
    });
    const params = {
      terrainStyle: {},
      terrainEdge: edgeState(2),
    };
    runtime.rebuild({
      ...params,
      sceneProperties: {
        terrain: {
          topoMapBranding: {
            visible: true,
            heading: "First",
          },
        },
      },
    });
    const firstGroup = scene.children.find(
      (child) => child.userData.topoMapBranding === true,
    );

    runtime.rebuild({
      ...params,
      sceneProperties: {
        terrain: {
          topoMapBranding: {
            visible: true,
            heading: "Second",
          },
        },
      },
    });

    const brandingGroups = scene.children.filter(
      (child) => child.userData.topoMapBranding === true,
    );
    expect(firstGroup?.parent).toBeNull();
    expect(brandingGroups).toHaveLength(1);
    expect(brandingGroups[0]).not.toBe(firstGroup);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("topo image material bounds are converted from UTM into scene space", () => {
  const bounds = topoImageUtmBoundsToSceneBounds({
    terrainUtmBounds: [-356385.9, 3703652, 1039320.6, 4843097],
    terrainSceneBounds: [-697853.25, -569722.5, 697853.25, 569722.5],
    imageUtmBounds: [231115.8, 4220376, 385650, 4279999.8],
  });
  expect(bounds[0]).toBeCloseTo(-110351.55, 4);
  expect(bounds[1]).toBeCloseTo(-52998.5, 4);
  expect(bounds[2]).toBeCloseTo(44182.65, 4);
  expect(bounds[3]).toBeCloseTo(6625.3, 4);
});

test("terrain material exposes selected image, edge outline, shine, and vertical controls", () => {
  const handle = buildTerrainMaterial({});
  const uniforms = handle.material.uniforms;
  handle.setParams({
    verticalExaggeration: 2.5,
    edgeOutlineEnabled: true,
    edgeOutlineOffsetM: 4000,
    edgeOutlineThicknessM: 1500,
    edgeOutlineColor: "#ffeecc",
    edgeOutlineOpacity: 0.42,
    edgeTopShine: 0.25,
    edgeCornerShine: 0.35,
    edgeBottomShine: 0.15,
  });
  handle.setOrthoPhotoBounds([-10, -20], [30, 40]);
  handle.setTopoImageDetailOverlay(
    new THREE.Texture(),
    [-5, -15],
    [10, 15],
    0.8,
    250,
  );
  handle.setCameraPosition(new THREE.Vector3(1, 2, 3));

  expect(uniforms.uVerticalExaggeration.value).toBe(2.5);
  expect(uniforms.uEdgeOutlineEnabled.value).toBe(1);
  expect(uniforms.uEdgeOutlineOffset.value).toBe(4000);
  expect(uniforms.uEdgeOutlineThickness.value).toBe(1500);
  expect(uniforms.uEdgeOutlineColor.value.getHexString()).toBe("ffeecc");
  expect(uniforms.uEdgeOutlineOpacity.value).toBe(0.42);
  expect(uniforms.uEdgeTopShine.value).toBe(0.25);
  expect(uniforms.uEdgeCornerShine.value).toBe(0.35);
  expect(uniforms.uEdgeBottomShine.value).toBe(0.15);
  expect(uniforms.uOrthoPhotoBoundsMin.value.x).toBe(-10);
  expect(uniforms.uOrthoPhotoBoundsMin.value.y).toBe(-20);
  expect(uniforms.uOrthoPhotoBoundsMax.value.x).toBe(30);
  expect(uniforms.uOrthoPhotoBoundsMax.value.y).toBe(40);
  expect(uniforms.uTopoImageDetailEnabled.value).toBe(1);
  expect(uniforms.uTopoImageDetailBoundsMin.value.x).toBe(-5);
  expect(uniforms.uTopoImageDetailBoundsMax.value.y).toBe(15);
  expect(uniforms.uTopoImageDetailOpacity.value).toBe(0.8);
  expect(uniforms.uTopoImageDetailEdgeFeather.value).toBe(250);
  expect(uniforms.uCameraPosition.value.toArray()).toEqual([1, 2, 3]);
});

test("terrain material layers selected image and detail overlay before procedural fallback", () => {
  const handle = buildTerrainMaterial({});
  const shader = handle.material.fragmentShader;
  expect(shader).toContain("orthoSample = texture2D(uOrthoPhotoMap, orthoUv)");
  expect(shader).toContain("float photoCoverage = 0.0");
  expect(shader).toContain("uOrthoPhotoOpacity * orthoSample.a");
  expect(shader).toContain("surface = mix(surface, outsideSurface, outsideSurfaceAlpha)");
  expect(shader).toContain("topoImageSurface(orthoSample, litAmount)");
  expect(shader).toContain("uTopoImageDetailMap");
  expect(shader).toContain("vec4 detailSample = texture2D(uTopoImageDetailMap, detailUv)");
  expect(shader).toContain("uTopoImageDetailOpacity * detailSample.a * edgeWeight");
  expect(shader).not.toContain("uBaseOrthoPhoto");
});
