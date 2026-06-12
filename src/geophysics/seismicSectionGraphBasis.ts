export type SeismicGraphVec3 = [number, number, number];

export type SeismicSectionGraphBasisKind =
  | "trace-path-curtain"
  | "sample-plane"
  | "legacy-rectangular";

export type SeismicGraphObjectKind =
  | "2d-section-line"
  | "3d-section-plane"
  | "3d-volume"
  | "survey-geometry"
  | "comparison"
  | "figure-annotation";

export type SeismicSurveyGeometryRole =
  | "navigation"
  | "lines"
  | "sources"
  | "receivers";

export interface SeismicGraphSampleDomain {
  kind?: string;
  unit?: string;
  min: number;
  max: number;
  verticalScaleMPerUnit?: number;
}

export interface SeismicGraphSurfaceGrid {
  corners?:
    | SeismicGraphVec3[]
    | Partial<Record<"sw" | "nw" | "ne" | "se", SeismicGraphVec3>>;
  points?: SeismicGraphVec3[];
  width?: number;
  height?: number;
  columns?: number;
  rows?: number;
}

export interface SeismicSectionGraphBasisInput {
  id?: string;
  axis?: string;
  path?: SeismicGraphVec3[];
  surfaceGrid?: SeismicGraphSurfaceGrid;
  sampleDomain?: SeismicGraphSampleDomain;
  datumM?: number;
  sceneBounds?: {
    min?: SeismicGraphVec3;
    max?: SeismicGraphVec3;
  };
  width?: number;
  height?: number;
}

export interface SeismicGraphProductInput {
  id?: string;
  domainKind?: string;
  domainUnit?: string;
  surveyKind?: string;
}

export interface SeismicSectionGraphDisplayState {
  layerId: string;
  objectKind?: SeismicGraphObjectKind;
  objectId?: string;
  verticalDatumMode?: string;
  verticalDatumOffsetM?: number;
  verticalScaleMPerUnit?: number;
}

interface SeismicSectionGraphBasisBase {
  kind: SeismicSectionGraphBasisKind;
  layerId: string;
  productId: string;
  sectionId: string;
  objectKind: SeismicGraphObjectKind;
  objectId: string;
  entityKey: string;
  representationKey: string;
  sampleDomain: SeismicGraphSampleDomain;
  datumM: number;
  verticalScaleMPerUnit: number;
  verticalDatumMode: string;
  verticalDatumOffsetM: number;
  sampleToZ(sample: number): number;
}

export interface TracePathCurtainGraphBasis
  extends SeismicSectionGraphBasisBase {
  kind: "trace-path-curtain" | "legacy-rectangular";
  tracePath: SeismicGraphVec3[];
  topPolyline: SeismicGraphVec3[];
  bottomPolyline: SeismicGraphVec3[];
  pathDistanceM: number;
  pathDistancesM: number[];
}

export interface SamplePlaneGraphBasis extends SeismicSectionGraphBasisBase {
  kind: "sample-plane";
  surfaceGrid: SeismicGraphSurfaceGrid;
  surfacePoints: SeismicGraphVec3[];
  fixedSampleValue: number;
  planeElevationM: number;
  horizontalFootprintAxes: {
    origin: SeismicGraphVec3;
    u: SeismicGraphVec3;
    v: SeismicGraphVec3;
  };
}

export type SeismicSectionGraphBasis =
  | TracePathCurtainGraphBasis
  | SamplePlaneGraphBasis;

export interface SectionFaceFrameBasis {
  sourceKind: "seismic-trace-path" | "seismic-sample-plane";
  frameId: string;
  sectionId: string;
  productId: string;
  center: SeismicGraphVec3;
  normal: SeismicGraphVec3;
  axisAVector: SeismicGraphVec3;
  axisBVector: SeismicGraphVec3;
  signedDistanceM: number;
  minAM: number;
  maxAM: number;
  minBM: number;
  maxBM: number;
  axisAHeading: string;
  axisBHeading: string;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function vec3(value: unknown): SeismicGraphVec3 | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const x = value[0];
  const y = value[1];
  const z = value[2];
  return finiteNumber(x) && finiteNumber(y) && finiteNumber(z)
    ? [x, y, z]
    : null;
}

function surfaceGridPoints(
  surfaceGrid: SeismicGraphSurfaceGrid | undefined,
): SeismicGraphVec3[] | null {
  if (!surfaceGrid) return null;
  const direct = surfaceGrid.points?.map(vec3).filter((point): point is SeismicGraphVec3 => !!point);
  if (direct && direct.length >= 4) return direct;
  const corners = surfaceGrid.corners;
  if (Array.isArray(corners)) {
    const points = corners.map(vec3).filter((point): point is SeismicGraphVec3 => !!point);
    return points.length >= 4 ? points : null;
  }
  if (corners?.sw && corners.nw && corners.ne && corners.se) {
    return [corners.sw, corners.nw, corners.ne, corners.se]
      .map(vec3)
      .filter((point): point is SeismicGraphVec3 => !!point);
  }
  return null;
}

function sampleDomainFor(
  section: SeismicSectionGraphBasisInput,
  product: SeismicGraphProductInput,
  displayState: SeismicSectionGraphDisplayState,
): SeismicGraphSampleDomain {
  const source = section.sampleDomain;
  const min = finiteNumber(source?.min) ? source.min : 0;
  const max = finiteNumber(source?.max) ? source.max : min;
  const verticalScale =
    displayState.verticalScaleMPerUnit ??
    (finiteNumber(source?.verticalScaleMPerUnit)
      ? source.verticalScaleMPerUnit
      : 1);
  return {
    kind:
      typeof source?.kind === "string"
        ? source.kind
        : typeof product.domainKind === "string"
          ? product.domainKind
          : undefined,
    unit:
      typeof source?.unit === "string"
        ? source.unit
        : typeof product.domainUnit === "string"
          ? product.domainUnit
          : undefined,
    min,
    max,
    verticalScaleMPerUnit: verticalScale,
  };
}

function representationKeyFor(kind: SeismicGraphObjectKind): string {
  return `seismic:${kind}`;
}

export function seismicGraphEntityKey(input: {
  layerId: string;
  productId: string;
  objectKind: SeismicGraphObjectKind;
  objectId: string;
}): string {
  return `layer:${input.layerId}:product:${input.productId}:object:${input.objectKind}:${input.objectId}`;
}

export function seismicFigureAnnotationEntityKey(input:
  | { sectionEntityKey: string }
  | {
      layerId: string;
      productId: string;
      objectKind: Exclude<
        SeismicGraphObjectKind,
        "survey-geometry" | "comparison" | "figure-annotation"
      >;
      objectId: string;
    },
): string {
  const sectionEntityKey =
    "sectionEntityKey" in input
      ? input.sectionEntityKey
      : seismicGraphEntityKey(input);
  return `${sectionEntityKey}:figure-annotation`;
}

export function seismicSurveyGeometryEntityKey(input: {
  layerId: string;
  role: SeismicSurveyGeometryRole;
}): string {
  return `layer:${input.layerId}:object:survey-geometry:${input.role}`;
}

export function sampleToSceneZ(
  sample: number,
  datumM: number,
  verticalScaleMPerUnit: number,
  verticalDatumOffsetM = 0,
): number {
  return datumM + verticalDatumOffsetM - sample * verticalScaleMPerUnit;
}

function sampleToLocalZ(
  sample: number,
  datumM: number,
  verticalScaleMPerUnit: number,
): number {
  return datumM - sample * verticalScaleMPerUnit;
}

export function distanceAlongTracePath(path: readonly unknown[]): number {
  let distance = 0;
  let previous: SeismicGraphVec3 | null = null;
  for (const raw of path) {
    const current = vec3(raw);
    if (!current) continue;
    if (previous) {
      distance += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    }
    previous = current;
  }
  return distance;
}

function cumulativePathDistances(path: SeismicGraphVec3[]): number[] {
  const distances = new Array<number>(path.length).fill(0);
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    distances[index] =
      distances[index - 1] +
      Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  }
  return distances;
}

function dot(a: SeismicGraphVec3, b: SeismicGraphVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: SeismicGraphVec3, b: SeismicGraphVec3): SeismicGraphVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(value: SeismicGraphVec3): SeismicGraphVec3 {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 0) return [1, 0, 0];
  return [value[0] / length, value[1] / length, value[2] / length];
}

function subtract(
  a: SeismicGraphVec3,
  b: SeismicGraphVec3,
): SeismicGraphVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(value: SeismicGraphVec3, scalar: number): SeismicGraphVec3 {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function add(a: SeismicGraphVec3, b: SeismicGraphVec3): SeismicGraphVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function extentsFor(
  points: readonly SeismicGraphVec3[],
  axis: SeismicGraphVec3,
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const value = dot(point, axis);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

function centerFromBasis(
  normal: SeismicGraphVec3,
  signedDistanceM: number,
  axisAVector: SeismicGraphVec3,
  minAM: number,
  maxAM: number,
  axisBVector: SeismicGraphVec3,
  minBM: number,
  maxBM: number,
): SeismicGraphVec3 {
  return add(
    add(
      scale(normal, signedDistanceM),
      scale(axisAVector, (minAM + maxAM) * 0.5),
    ),
    scale(axisBVector, (minBM + maxBM) * 0.5),
  );
}

function legacyPathFromBounds(
  section: SeismicSectionGraphBasisInput,
  sampleToZ: (sample: number) => number,
  sampleMin: number,
): SeismicGraphVec3[] {
  const min = section.sceneBounds?.min;
  const max = section.sceneBounds?.max;
  if (min && max) {
    const z = sampleToZ(sampleMin);
    if (section.axis === "crossline") {
      const x = min[0] + (max[0] - min[0]) * (section.width ? 0.5 : 0.5);
      return [
        [x, min[1], z],
        [x, max[1], z],
      ];
    }
    return [
      [min[0], min[1], z],
      [max[0], min[1], z],
    ];
  }
  return [
    [0, 0, sampleToZ(sampleMin)],
    [1, 0, sampleToZ(sampleMin)],
  ];
}

function objectKindFor(
  section: SeismicSectionGraphBasisInput,
  product: SeismicGraphProductInput,
  displayState: SeismicSectionGraphDisplayState,
): SeismicGraphObjectKind {
  if (displayState.objectKind) return displayState.objectKind;
  if (section.axis === "line" || product.surveyKind === "2d" || product.surveyKind === "legacy-2d") {
    return "2d-section-line";
  }
  return "3d-section-plane";
}

function baseFor(
  section: SeismicSectionGraphBasisInput,
  product: SeismicGraphProductInput,
  displayState: SeismicSectionGraphDisplayState,
  kind: SeismicSectionGraphBasisKind,
): SeismicSectionGraphBasisBase {
  const sampleDomain = sampleDomainFor(section, product, displayState);
  const datumM = finiteNumber(section.datumM) ? section.datumM : 0;
  const verticalScaleMPerUnit =
    displayState.verticalScaleMPerUnit ??
    sampleDomain.verticalScaleMPerUnit ??
    1;
  const productId =
    typeof product.id === "string" && product.id.trim()
      ? product.id
      : "unknown-product";
  const sectionId =
    typeof section.id === "string" && section.id.trim()
      ? section.id
      : "unknown-section";
  const objectKind = objectKindFor(section, product, displayState);
  const objectId =
    typeof displayState.objectId === "string" && displayState.objectId.trim()
      ? displayState.objectId
      : sectionId;
  const entityKey = seismicGraphEntityKey({
    layerId: displayState.layerId,
    productId,
    objectKind,
    objectId,
  });
  return {
    kind,
    layerId: displayState.layerId,
    productId,
    sectionId,
    objectKind,
    objectId,
    entityKey,
    representationKey: representationKeyFor(objectKind),
    sampleDomain: {
      ...sampleDomain,
      verticalScaleMPerUnit,
    },
    datumM,
    verticalScaleMPerUnit,
    verticalDatumMode:
      typeof displayState.verticalDatumMode === "string"
        ? displayState.verticalDatumMode
        : "source",
    verticalDatumOffsetM: finiteNumber(displayState.verticalDatumOffsetM)
      ? displayState.verticalDatumOffsetM
      : 0,
    sampleToZ(sample: number) {
      return sampleToLocalZ(sample, datumM, verticalScaleMPerUnit);
    },
  };
}

function buildSamplePlaneBasis(
  section: SeismicSectionGraphBasisInput,
  product: SeismicGraphProductInput,
  displayState: SeismicSectionGraphDisplayState,
): SamplePlaneGraphBasis | null {
  if (section.axis !== "sample") return null;
  const points = surfaceGridPoints(section.surfaceGrid);
  if (!points || points.length < 4 || !section.surfaceGrid) return null;
  const base = baseFor(section, product, displayState, "sample-plane");
  const fixedSampleValue = base.sampleDomain.min;
  const planeElevationM = base.sampleToZ(fixedSampleValue);
  const origin = points[0];
  const uPoint = points[3] ?? points[1];
  const vPoint = points[1] ?? points[3];
  return {
    ...base,
    kind: "sample-plane",
    surfaceGrid: section.surfaceGrid,
    surfacePoints: points,
    fixedSampleValue,
    planeElevationM,
    horizontalFootprintAxes: {
      origin,
      u: [uPoint[0] - origin[0], uPoint[1] - origin[1], uPoint[2] - origin[2]],
      v: [vPoint[0] - origin[0], vPoint[1] - origin[1], vPoint[2] - origin[2]],
    },
  };
}

export function buildSeismicSectionGraphBasis(
  section: SeismicSectionGraphBasisInput,
  product: SeismicGraphProductInput,
  displayState: SeismicSectionGraphDisplayState,
): SeismicSectionGraphBasis {
  const samplePlane = buildSamplePlaneBasis(section, product, displayState);
  if (samplePlane) return samplePlane;

  const base = baseFor(
    section,
    product,
    displayState,
    section.path && section.path.length >= 2
      ? "trace-path-curtain"
      : "legacy-rectangular",
  );
  const tracePath =
    section.path?.map(vec3).filter((point): point is SeismicGraphVec3 => !!point) ??
    [];
  const path =
    tracePath.length >= 2
      ? tracePath
      : legacyPathFromBounds(section, base.sampleToZ, base.sampleDomain.min);
  const topZ = base.sampleToZ(base.sampleDomain.min);
  const bottomZ = base.sampleToZ(base.sampleDomain.max);
  const topPolyline = path.map<SeismicGraphVec3>((point) => [point[0], point[1], topZ]);
  const bottomPolyline = path.map<SeismicGraphVec3>((point) => [
    point[0],
    point[1],
    bottomZ,
  ]);
  const pathDistancesM = cumulativePathDistances(path);

  return {
    ...base,
    kind: base.kind === "legacy-rectangular" ? "legacy-rectangular" : "trace-path-curtain",
    tracePath: path,
    topPolyline,
    bottomPolyline,
    pathDistanceM: pathDistancesM[pathDistancesM.length - 1] ?? 0,
    pathDistancesM,
  };
}

export function sectionFaceFrameFromGraphBasis(
  basis: SeismicSectionGraphBasis,
): SectionFaceFrameBasis {
  if (basis.kind === "sample-plane") {
    const origin = basis.horizontalFootprintAxes.origin;
    const axisAVector = normalize(basis.horizontalFootprintAxes.u);
    const axisBVector = normalize(basis.horizontalFootprintAxes.v);
    const normal = normalize(cross(axisAVector, axisBVector));
    const signedDistanceM = dot(origin, normal);
    const [minAM, maxAM] = extentsFor(basis.surfacePoints, axisAVector);
    const [minBM, maxBM] = extentsFor(basis.surfacePoints, axisBVector);
    return {
      sourceKind: "seismic-sample-plane",
      frameId: `source:seismic:${basis.sectionId}`,
      sectionId: basis.sectionId,
      productId: basis.productId,
      center: centerFromBasis(
        normal,
        signedDistanceM,
        axisAVector,
        minAM,
        maxAM,
        axisBVector,
        minBM,
        maxBM,
      ),
      normal,
      axisAVector,
      axisBVector,
      signedDistanceM,
      minAM,
      maxAM,
      minBM,
      maxBM,
      axisAHeading: "Easting",
      axisBHeading: "Northing",
    };
  }

  const first = basis.tracePath[0] ?? [0, 0, basis.sampleToZ(basis.sampleDomain.min)];
  const last = basis.tracePath[basis.tracePath.length - 1] ?? [
    first[0] + 1,
    first[1],
    first[2],
  ];
  const axisAVector = normalize(subtract(last, first));
  const axisBVector: SeismicGraphVec3 = [0, 0, 1];
  const normal = normalize(cross(axisAVector, axisBVector));
  const pathPoints = [...basis.topPolyline, ...basis.bottomPolyline];
  const signedDistanceM = pathPoints.length
    ? pathPoints.reduce((sum, point) => sum + dot(point, normal), 0) /
      pathPoints.length
    : dot(first, normal);
  const [minAM, maxAM] = extentsFor(pathPoints, axisAVector);
  const [minBM, maxBM] = extentsFor(pathPoints, axisBVector);
  return {
    sourceKind: "seismic-trace-path",
    frameId: `source:seismic:${basis.sectionId}`,
    sectionId: basis.sectionId,
    productId: basis.productId,
    center: centerFromBasis(
      normal,
      signedDistanceM,
      axisAVector,
      minAM,
      maxAM,
      axisBVector,
      minBM,
      maxBM,
    ),
    normal,
    axisAVector,
    axisBVector,
    signedDistanceM,
    minAM,
    maxAM,
    minBM,
    maxBM,
    axisAHeading: "Trace distance",
    axisBHeading: "Elevation",
  };
}
