import * as THREE from "three";

interface PointCloudPreviewPayload {
  schema: string;
  label?: string;
  points: number[];
  source?: Record<string, unknown>;
  sourceBounds?: Record<string, unknown>;
  scenePlacement?: Record<string, unknown>;
  attributes?: {
    observations?: Array<{
      id?: string | number;
      observationCount?: number;
      imageCount?: number;
    }>;
    scalarValues?: number[];
    scalar?: {
      name?: string;
      unit?: string;
      min?: number;
      max?: number;
      displayMin?: number;
      displayMax?: number;
      colorStops?: Array<{
        value: number;
        color: string;
      }>;
    };
  };
}

const LOW_COLOR = new THREE.Color("#42d8ff");
const MID_COLOR = new THREE.Color("#69f0b4");
const HIGH_COLOR = new THREE.Color("#f8dd6d");
const LOW_OBSERVATION_COLOR = new THREE.Color("#ff637a");
const MID_OBSERVATION_COLOR = new THREE.Color("#f8dd6d");
const HIGH_OBSERVATION_COLOR = new THREE.Color("#69f0b4");

function heightColor(t: number): THREE.Color {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const color = new THREE.Color();
  if (clamped < 0.5) {
    color.lerpColors(LOW_COLOR, MID_COLOR, clamped / 0.5);
  } else {
    color.lerpColors(MID_COLOR, HIGH_COLOR, (clamped - 0.5) / 0.5);
  }
  return color;
}

function observationColor(t: number): THREE.Color {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const color = new THREE.Color();
  if (clamped < 0.5) {
    color.lerpColors(LOW_OBSERVATION_COLOR, MID_OBSERVATION_COLOR, clamped / 0.5);
  } else {
    color.lerpColors(MID_OBSERVATION_COLOR, HIGH_OBSERVATION_COLOR, (clamped - 0.5) / 0.5);
  }
  return color;
}

function observationCountsForPayload(
  payload: PointCloudPreviewPayload,
  pointCount: number,
): number[] | null {
  const observations = payload.attributes?.observations;
  if (!observations || observations.length !== pointCount) return null;
  const counts = observations.map((row) =>
    typeof row.observationCount === "number" &&
    Number.isFinite(row.observationCount)
      ? row.observationCount
      : 0,
  );
  return counts.some((count) => count > 0) ? counts : null;
}

function scalarValuesForPayload(
  payload: PointCloudPreviewPayload,
  pointCount: number,
): number[] | null {
  const values = payload.attributes?.scalarValues;
  if (!values || values.length !== pointCount) return null;
  return values.some((value) => Number.isFinite(value)) ? values : null;
}

function safeColor(value: string | undefined, fallback: string): THREE.Color {
  const color = new THREE.Color();
  try {
    color.set(value ?? fallback);
  } catch {
    color.set(fallback);
  }
  return color;
}

function scalarColor(
  value: number,
  displayMin: number,
  displayMax: number,
  stops: Array<{ value: number; color: string }> | undefined,
): THREE.Color {
  const fallbackStops = [
    { value: displayMin, color: "#2cc9ff" },
    { value: displayMin + (displayMax - displayMin) * 0.5, color: "#f8dd6d" },
    { value: displayMax, color: "#ff637a" },
  ];
  const resolvedStops = (stops?.length ? stops : fallbackStops)
    .filter((stop) => Number.isFinite(stop.value))
    .sort((a, b) => a.value - b.value);

  if (resolvedStops.length === 0) {
    return heightColor(0.5);
  }
  if (value <= resolvedStops[0].value) {
    return safeColor(resolvedStops[0].color, "#2cc9ff");
  }
  const last = resolvedStops[resolvedStops.length - 1];
  if (value >= last.value) {
    return safeColor(last.color, "#ff637a");
  }

  for (let index = 1; index < resolvedStops.length; index += 1) {
    const high = resolvedStops[index];
    const low = resolvedStops[index - 1];
    if (value > high.value) continue;
    const range = Math.max(0.000001, high.value - low.value);
    const t = THREE.MathUtils.clamp((value - low.value) / range, 0, 1);
    const color = new THREE.Color();
    color.lerpColors(
      safeColor(low.color, "#2cc9ff"),
      safeColor(high.color, "#ff637a"),
      t,
    );
    return color;
  }

  return safeColor(last.color, "#ff637a");
}

export async function loadPointCloudPreview(url: string): Promise<THREE.Points> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch point-cloud preview ${url}: ${response.status}`);
  }

  const payload = (await response.json()) as PointCloudPreviewPayload;
  if (
    payload.schema !== "geosee.pointcloud-preview.v1" ||
    !Array.isArray(payload.points) ||
    payload.points.length % 3 !== 0
  ) {
    throw new Error(`Invalid point-cloud preview payload: ${url}`);
  }

  const positions = new Float32Array(payload.points);
  const colors = new Float32Array(positions.length);
  const observationCounts = observationCountsForPayload(
    payload,
    positions.length / 3,
  );
  const scalarValues = scalarValuesForPayload(payload, positions.length / 3);
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 2; i < positions.length; i += 3) {
    minZ = Math.min(minZ, positions[i]);
    maxZ = Math.max(maxZ, positions[i]);
  }

  const zRange = Math.max(1, maxZ - minZ);
  const minObservation = observationCounts
    ? Math.min(...observationCounts)
    : 0;
  const maxObservation = observationCounts
    ? Math.max(...observationCounts)
    : 1;
  const observationRange = Math.max(1, maxObservation - minObservation);
  const finiteScalars = scalarValues?.filter((value) => Number.isFinite(value));
  const scalarMin =
    typeof payload.attributes?.scalar?.displayMin === "number"
      ? payload.attributes.scalar.displayMin
      : finiteScalars?.length
        ? Math.min(...finiteScalars)
        : 0;
  const scalarMax =
    typeof payload.attributes?.scalar?.displayMax === "number"
      ? payload.attributes.scalar.displayMax
      : finiteScalars?.length
        ? Math.max(...finiteScalars)
        : 1;
  const scratch = new THREE.Color();
  for (let i = 0; i < positions.length; i += 3) {
    if (scalarValues) {
      scratch.copy(
        scalarColor(
          scalarValues[i / 3] ?? scalarMin,
          scalarMin,
          scalarMax,
          payload.attributes?.scalar?.colorStops,
        ),
      );
    } else if (observationCounts) {
      const count = observationCounts[i / 3] ?? 0;
      scratch.copy(
        observationColor((count - minObservation) / observationRange),
      );
    } else {
      scratch.copy(heightColor((positions[i + 2] - minZ) / zRange));
    }
    colors[i] = scratch.r;
    colors[i + 1] = scratch.g;
    colors[i + 2] = scratch.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (scalarValues) {
    geometry.userData.scalarValues = new Float32Array(scalarValues);
    geometry.userData.scalar = {
      ...(payload.attributes?.scalar ?? {}),
      displayMin: scalarMin,
      displayMax: scalarMax,
    };
    geometry.userData.scalarColorMode = "scalar";
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: scalarValues ? 2.6 : observationCounts ? 2.1 : 4.25,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: scalarValues ? 0.68 : observationCounts ? 0.58 : 0.96,
    depthWrite: false,
  });
  material.userData.preserveVertexColors = true;
  material.userData.forceTransparent = true;

  const points = new THREE.Points(geometry, material);
  points.name = payload.label ?? "Point-cloud preview";
  points.renderOrder = 12;
  points.userData = {
    displayName: payload.label ?? "Point-cloud preview",
    source: payload.source,
    sourceBounds: payload.sourceBounds,
    scenePlacement: payload.scenePlacement,
    attributes: payload.attributes,
    colorMode: scalarValues ? "scalar" : observationCounts ? "observation-count" : "height",
    pointCloudPreview: true,
  };

  return points;
}
