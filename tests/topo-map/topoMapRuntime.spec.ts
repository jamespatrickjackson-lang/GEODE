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
import type { TerrainEdgeFadeState } from "../../src/topoMap/surfaceRuntime";

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
