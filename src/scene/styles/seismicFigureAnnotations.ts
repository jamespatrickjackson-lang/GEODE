import * as THREE from "three";
import {
  buildSeismicFigureAnnotationModel,
  type SeismicFigureSampleDomain,
} from "../../geophysics/seismicFigureAnnotationModel";
import type {
  SeismicSectionGraphBasis,
  TracePathCurtainGraphBasis,
} from "../../geophysics/seismicSectionGraphBasis";
import type { EditableStyle } from "../../pages/types";

const FIGURE_RENDER_ORDER = 4688;

type SectionSpecRecord = {
  sampleDomain?: Partial<SeismicFigureSampleDomain>;
};

type FigureGraphMetadata = {
  entityKey: string;
  representationKey: string;
  basisKind: string;
};

function styleColor(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: string,
): string {
  const value = style[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function graphMetadataFromBasis(
  basis: SeismicSectionGraphBasis,
): FigureGraphMetadata {
  return {
    entityKey: `${basis.entityKey}:figure-annotation`,
    representationKey: "seismic:figure-annotation",
    basisKind: basis.kind,
  };
}

function tagFigureObject(
  object: THREE.Object3D,
  metadata: FigureGraphMetadata,
): void {
  object.userData.seismicFigureAnnotation = true;
  object.userData.seismicGraphEntityKey = metadata.entityKey;
  object.userData.seismicGraphRepresentationKey = metadata.representationKey;
  object.userData.seismicGraphBasisKind = metadata.basisKind;
  object.userData.geoseePickIgnore = true;
}

function materialBaseOpacity(material: THREE.Material): number {
  if (
    material instanceof THREE.ShaderMaterial &&
    typeof material.uniforms.uOpacity?.value === "number" &&
    Number.isFinite(material.uniforms.uOpacity.value)
  ) {
    return clamp(material.uniforms.uOpacity.value, 0, 1);
  }
  return typeof material.opacity === "number" && Number.isFinite(material.opacity)
    ? clamp(material.opacity, 0, 1)
    : 1;
}

function tagFigureMaterial(
  material: THREE.Material,
  metadata: FigureGraphMetadata,
): void {
  const baseOpacity = materialBaseOpacity(material);
  material.userData.forceTransparent = true;
  material.userData.preserveMaterialOpacity = true;
  material.userData.preserveMaterialOpacityBase = baseOpacity;
  material.userData.seismicFigureAnnotation = true;
  material.userData.seismicFigureBaseOpacity = baseOpacity;
  material.userData.seismicGraphEntityKey = metadata.entityKey;
  material.userData.seismicGraphRepresentationKey = metadata.representationKey;
  material.userData.seismicGraphBasisKind = metadata.basisKind;
}

function tagFigureTree(
  root: THREE.Object3D,
  metadata: FigureGraphMetadata,
): void {
  root.traverse((object) => {
    tagFigureObject(object, metadata);
    const material = (
      object as THREE.Object3D & {
        material?: THREE.Material | THREE.Material[];
      }
    ).material;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) tagFigureMaterial(item, metadata);
  });
}

function pointFromAttribute(
  position: THREE.BufferAttribute,
  index: number,
): THREE.Vector3 {
  return new THREE.Vector3(
    position.getX(index),
    position.getY(index),
    position.getZ(index),
  );
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials) {
      const mapped = material as THREE.Material & {
        map?: THREE.Texture | null;
      };
      mapped.map?.dispose();
      const figureTexture = material.userData
        .seismicFigureTextTexture as THREE.Texture | undefined;
      figureTexture?.dispose();
      material.dispose();
    }
  });
}

export function disposeSeismicFigureAnnotations(target: THREE.Object3D): void {
  const root = target.userData.seismicFigureAnnotationRoot as
    | THREE.Object3D
    | undefined;
  if (!root) return;
  root.parent?.remove(root);
  disposeObjectTree(root);
  delete target.userData.seismicFigureAnnotationRoot;
}

function makeLine(
  name: string,
  points: THREE.Vector3[],
  color: string,
  opacity = 1,
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  material.toneMapped = false;
  material.userData.forceTransparent = true;
  const line = new THREE.Line(geometry, material);
  line.name = name;
  line.renderOrder = FIGURE_RENDER_ORDER;
  line.userData.seismicFigureAnnotation = true;
  return line;
}

function makePlaneGeometry(
  center: THREE.Vector3,
  widthVec: THREE.Vector3,
  heightVec: THREE.Vector3,
): THREE.BufferGeometry {
  const halfW = widthVec.clone().multiplyScalar(0.5);
  const halfH = heightVec.clone().multiplyScalar(0.5);
  const p0 = center.clone().sub(halfW).sub(halfH);
  const p1 = center.clone().add(halfW).sub(halfH);
  const p2 = center.clone().sub(halfW).add(halfH);
  const p3 = center.clone().add(halfW).add(halfH);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        p0.x,
        p0.y,
        p0.z,
        p1.x,
        p1.y,
        p1.z,
        p2.x,
        p2.y,
        p2.z,
        p3.x,
        p3.y,
        p3.z,
      ]),
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function makeTextTexture(
  text: string,
  options: {
    multiline?: boolean;
    fontPx?: number;
    weight?: number;
  },
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = options.multiline ? 1024 : 768;
  canvas.height = options.multiline ? 256 : 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontPx = options.fontPx ?? 54;
    const weight = options.weight ?? 700;
    ctx.font = `${weight} ${fontPx}px Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = options.multiline
      ? wrapText(ctx, text, canvas.width - 80).slice(0, 4)
      : [text];
    const lineHeight = fontPx * 1.18;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeReadableTextMaterial(
  texture: THREE.Texture,
  color: string,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.96 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        vec2 readableUv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        vec4 textSample = texture2D(uMap, readableUv);
        gl_FragColor = vec4(uColor * textSample.rgb, textSample.a * uOpacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.toneMapped = false;
  material.userData.forceTransparent = true;
  material.userData.seismicFigureTextTexture = texture;
  return material;
}

function makeTextPlane(
  name: string,
  text: string,
  center: THREE.Vector3,
  widthVec: THREE.Vector3,
  heightVec: THREE.Vector3,
  color: string,
  options: {
    multiline?: boolean;
    fontPx?: number;
    weight?: number;
  } = {},
): THREE.Mesh {
  const texture = makeTextTexture(text, options);
  const geometry = makePlaneGeometry(center, widthVec, heightVec);
  const material = makeReadableTextMaterial(texture, color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = FIGURE_RENDER_ORDER + 2;
  mesh.userData.seismicFigureAnnotation = true;
  mesh.userData.seismicFigureTextPlane = true;
  return mesh;
}

function makeBoxPlane(
  name: string,
  center: THREE.Vector3,
  widthVec: THREE.Vector3,
  heightVec: THREE.Vector3,
  color: string,
  opacity: number,
): THREE.Mesh {
  const geometry = makePlaneGeometry(center, widthVec, heightVec);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.toneMapped = false;
  material.userData.forceTransparent = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = FIGURE_RENDER_ORDER - 1;
  mesh.userData.seismicFigureAnnotation = true;
  return mesh;
}

function sampleDomainFromMesh(mesh: THREE.Mesh): SeismicFigureSampleDomain | null {
  const basis = mesh.userData
    .seismicSectionGraphBasis as SeismicSectionGraphBasis | undefined;
  if (basis?.sampleDomain) {
    const sampleDomain = basis.sampleDomain;
    if (
      typeof sampleDomain.min === "number" &&
      typeof sampleDomain.max === "number" &&
      Number.isFinite(sampleDomain.min) &&
      Number.isFinite(sampleDomain.max) &&
      sampleDomain.max >= sampleDomain.min
    ) {
      return {
        kind: sampleDomain.kind,
        unit: sampleDomain.unit,
        min: sampleDomain.min,
        max: sampleDomain.max,
        verticalScaleMPerUnit: sampleDomain.verticalScaleMPerUnit,
      };
    }
  }
  const section = mesh.geometry.userData.seismicSection as
    | SectionSpecRecord
    | undefined;
  const sampleDomain = section?.sampleDomain;
  if (
    typeof sampleDomain?.min !== "number" ||
    typeof sampleDomain.max !== "number" ||
    !Number.isFinite(sampleDomain.min) ||
    !Number.isFinite(sampleDomain.max) ||
    sampleDomain.max < sampleDomain.min
  ) {
    return null;
  }
  return {
    kind:
      typeof sampleDomain.kind === "string"
        ? sampleDomain.kind
        : typeof mesh.userData.seismicProductDomainKind === "string"
          ? mesh.userData.seismicProductDomainKind
          : undefined,
    unit:
      typeof sampleDomain.unit === "string"
        ? sampleDomain.unit
        : typeof mesh.userData.seismicSampleDomainUnit === "string"
          ? mesh.userData.seismicSampleDomainUnit
          : undefined,
    min: sampleDomain.min,
    max: sampleDomain.max,
    verticalScaleMPerUnit:
      typeof sampleDomain.verticalScaleMPerUnit === "number"
        ? sampleDomain.verticalScaleMPerUnit
        : undefined,
  };
}

function normalizedSectionPoint(
  topLeft: THREE.Vector3,
  topRight: THREE.Vector3,
  bottomLeft: THREE.Vector3,
  bottomRight: THREE.Vector3,
  u: number,
  t: number,
): THREE.Vector3 {
  const top = topLeft.clone().lerp(topRight, u);
  const bottom = bottomLeft.clone().lerp(bottomRight, u);
  return top.lerp(bottom, t);
}

type AnnotationFrame = {
  topLeft: THREE.Vector3;
  topRight: THREE.Vector3;
  bottomLeft: THREE.Vector3;
  bottomRight: THREE.Vector3;
  widthM: number;
  heightM: number;
  drawVerticalAxis: boolean;
};

function vecToThree(point: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2]);
}

function frameFromTraceBasis(
  basis: TracePathCurtainGraphBasis,
): AnnotationFrame | null {
  const topLeftRaw = basis.topPolyline[0];
  const topRightRaw = basis.topPolyline[basis.topPolyline.length - 1];
  const bottomLeftRaw = basis.bottomPolyline[0];
  const bottomRightRaw = basis.bottomPolyline[basis.bottomPolyline.length - 1];
  if (!topLeftRaw || !topRightRaw || !bottomLeftRaw || !bottomRightRaw) {
    return null;
  }
  const topLeft = vecToThree(topLeftRaw);
  const topRight = vecToThree(topRightRaw);
  const bottomLeft = vecToThree(bottomLeftRaw);
  const bottomRight = vecToThree(bottomRightRaw);
  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    widthM: Math.max(basis.pathDistanceM, topLeft.distanceTo(topRight)),
    heightM: topLeft.distanceTo(bottomLeft),
    drawVerticalAxis: true,
  };
}

function frameFromSamplePlaneBasis(
  basis: SeismicSectionGraphBasis,
): AnnotationFrame | null {
  if (basis.kind !== "sample-plane") return null;
  const points = basis.surfacePoints;
  const sw = points[0];
  const nw = points[1];
  const ne = points[2];
  const se = points[3];
  if (!sw || !nw || !ne || !se) return null;
  const topLeft = vecToThree(nw);
  const topRight = vecToThree(ne);
  const bottomLeft = vecToThree(sw);
  const bottomRight = vecToThree(se);
  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    widthM: Math.max(
      topLeft.distanceTo(topRight),
      bottomLeft.distanceTo(bottomRight),
    ),
    heightM: Math.max(
      topLeft.distanceTo(bottomLeft),
      topRight.distanceTo(bottomRight),
    ),
    drawVerticalAxis: false,
  };
}

function legacyFrameFromGeometry(mesh: THREE.Mesh): AnnotationFrame | null {
  const position = mesh.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute) || position.count < 4) {
    return null;
  }
  const legacyCorners = [0, 1, 2, 3].map((index) =>
    pointFromAttribute(position, index),
  );
  return {
    topLeft: legacyCorners[0],
    topRight: legacyCorners[1],
    bottomLeft: legacyCorners[2],
    bottomRight: legacyCorners[3],
    widthM: legacyCorners[0].distanceTo(legacyCorners[1]),
    heightM: legacyCorners[0].distanceTo(legacyCorners[2]),
    drawVerticalAxis: true,
  };
}

function frameFromBasisOrGeometry(mesh: THREE.Mesh): AnnotationFrame | null {
  const basis = mesh.userData
    .seismicSectionGraphBasis as SeismicSectionGraphBasis | undefined;
  if (basis?.kind === "trace-path-curtain" || basis?.kind === "legacy-rectangular") {
    return frameFromTraceBasis(basis);
  }
  if (basis?.kind === "sample-plane") {
    return frameFromSamplePlaneBasis(basis);
  }
  return legacyFrameFromGeometry(mesh);
}

function pointOnTracePathCurtain(
  basis: TracePathCurtainGraphBasis,
  u: number,
  t: number,
): THREE.Vector3 | null {
  if (basis.topPolyline.length === 0 || basis.bottomPolyline.length === 0) {
    return null;
  }
  const distance = clamp(u, 0, 1) * Math.max(0, basis.pathDistanceM);
  const distances = basis.pathDistancesM;
  let segmentIndex = 0;
  while (
    segmentIndex < distances.length - 2 &&
    distances[segmentIndex + 1] < distance
  ) {
    segmentIndex += 1;
  }
  const startDistance = distances[segmentIndex] ?? 0;
  const endDistance = distances[segmentIndex + 1] ?? startDistance;
  const segmentT =
    endDistance > startDistance
      ? (distance - startDistance) / (endDistance - startDistance)
      : 0;
  const topStart = basis.topPolyline[segmentIndex];
  const topEnd = basis.topPolyline[segmentIndex + 1] ?? topStart;
  const bottomStart = basis.bottomPolyline[segmentIndex];
  const bottomEnd = basis.bottomPolyline[segmentIndex + 1] ?? bottomStart;
  if (!topStart || !topEnd || !bottomStart || !bottomEnd) return null;
  const top = vecToThree(topStart).lerp(vecToThree(topEnd), segmentT);
  const bottom = vecToThree(bottomStart).lerp(vecToThree(bottomEnd), segmentT);
  return top.lerp(bottom, clamp(t, 0, 1));
}

function normalizedBasisPoint(
  mesh: THREE.Mesh,
  frame: AnnotationFrame,
  u: number,
  t: number,
): THREE.Vector3 {
  const basis = mesh.userData
    .seismicSectionGraphBasis as SeismicSectionGraphBasis | undefined;
  if (basis?.kind === "trace-path-curtain" || basis?.kind === "legacy-rectangular") {
    const point = pointOnTracePathCurtain(basis, u, t);
    if (point) return point;
  }
  return normalizedSectionPoint(
    frame.topLeft,
    frame.topRight,
    frame.bottomLeft,
    frame.bottomRight,
    u,
    t,
  );
}

function vectorBetween(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  return b.clone().sub(a);
}

function addNormalLift(point: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
  return point.clone().add(normal);
}

export function updateSeismicFigureAnnotations(
  mesh: THREE.Mesh,
  style: EditableStyle,
): void {
  if (style.seismicFigureAnnotationsVisible !== true) {
    disposeSeismicFigureAnnotations(mesh);
    return;
  }
  const frame = frameFromBasisOrGeometry(mesh);
  const sampleDomain = sampleDomainFromMesh(mesh);
  if (!frame || !sampleDomain) {
    disposeSeismicFigureAnnotations(mesh);
    return;
  }

  disposeSeismicFigureAnnotations(mesh);

  const topLeft = frame.topLeft;
  const topRight = frame.topRight;
  const bottomLeft = frame.bottomLeft;
  const bottomRight = frame.bottomRight;
  const across = vectorBetween(topLeft, topRight).normalize();
  const down = vectorBetween(topLeft, bottomLeft).normalize();
  if (across.lengthSq() < 1e-6 || down.lengthSq() < 1e-6) return;
  const normal = new THREE.Vector3().crossVectors(across, down).normalize();
  const widthM = frame.widthM;
  const heightM = frame.heightM;
  const offsetM = clamp(
    styleNumber(style, "seismicFigureOutsideOffsetM", Math.max(160, widthM * 0.06)),
    40,
    1500,
  );
  const labelSizeM = clamp(
    styleNumber(style, "seismicFigureLabelSizeM", Math.max(150, widthM * 0.075)),
    60,
    420,
  );
  const normalLift = normal.multiplyScalar(Math.max(12, labelSizeM * 0.08));
  const textColor = styleColor(style, "seismicFigureTextColor", "#f7f7f2");
  const axisColor = styleColor(style, "seismicFigureAxisColor", "#f7f7f2");
  const captionBoxColor = styleColor(
    style,
    "seismicFigureCaptionBoxColor",
    "#050505",
  );
  const horizonColor = styleColor(
    style,
    "seismicFigureHorizonColor",
    "#ffcc33",
  );
  const wellColor = styleColor(style, "seismicFigureWellColor", "#5875ff");
  const navigation = mesh.userData.seismicNavigationPlacement as
    | { statusLabel?: unknown; reason?: unknown }
    | undefined;
  const basis = mesh.userData
    .seismicSectionGraphBasis as SeismicSectionGraphBasis | undefined;
  const model = buildSeismicFigureAnnotationModel({
    productLabel:
      typeof mesh.userData.seismicProductLabel === "string"
        ? mesh.userData.seismicProductLabel
        : mesh.name,
    lineLabel:
      typeof mesh.userData.seismicProductLineLabel === "string"
        ? mesh.userData.seismicProductLineLabel
        : undefined,
    sourceSubmission:
      typeof mesh.userData.seismicProductSourceSubmission === "string"
        ? mesh.userData.seismicProductSourceSubmission
        : undefined,
    sampleDomain,
    datumM: basis?.datumM,
    sectionStart: [topLeft.x, topLeft.y, topLeft.z],
    sectionEnd: [topRight.x, topRight.y, topRight.z],
    sectionLengthMOverride:
      basis?.kind === "trace-path-curtain" || basis?.kind === "legacy-rectangular"
        ? basis.pathDistanceM
        : widthM,
    navigationStatus:
      typeof navigation?.statusLabel === "string"
        ? navigation.statusLabel
        : typeof navigation?.reason === "string"
          ? navigation.reason
          : undefined,
    titleOverride: style.seismicFigureTitle,
    captionOverride: style.seismicFigureCaption,
    scaleLabelOverride: style.seismicFigureScaleLabel,
    wellLabel: style.seismicFigureWellVisible
      ? style.seismicFigureWellLabel
      : undefined,
    wellPositionT: style.seismicFigureWellVisible
      ? style.seismicFigureWellPosition
      : undefined,
    horizonPoints:
      style.seismicFigureHorizonVisible === true
        ? style.seismicFigureHorizonPoints
        : undefined,
  });

  const root = new THREE.Group();
  root.name = `${mesh.name} figure annotations`;
  root.renderOrder = FIGURE_RENDER_ORDER;
  root.userData.seismicFigureAnnotationRoot = true;
  const graphMetadata = basis
    ? graphMetadataFromBasis(basis)
    : {
        entityKey: `mesh:${mesh.uuid}:figure-annotation`,
        representationKey: "seismic:figure-annotation",
        basisKind: "legacy-geometry",
      };
  root.userData.seismicGraphEntityKey = graphMetadata.entityKey;
  root.userData.seismicGraphRepresentationKey = graphMetadata.representationKey;
  root.userData.seismicGraphBasisKind = graphMetadata.basisKind;

  const leftOffset = across.clone().multiplyScalar(-offsetM);
  const rightOffset = across.clone().multiplyScalar(offsetM);
  const upOffset = down.clone().multiplyScalar(-offsetM);
  const downOffset = down.clone().multiplyScalar(offsetM);
  const horizontalTextHeight = down.clone().multiplyScalar(-labelSizeM * 0.75);
  const topCenter = topLeft.clone().lerp(topRight, 0.5).add(upOffset);
  const titleWidth = across.clone().multiplyScalar(widthM * 0.72);
  root.add(
    makeTextPlane(
      "seismic figure title",
      model.title,
      addNormalLift(topCenter, normalLift),
      titleWidth,
      horizontalTextHeight,
      textColor,
      { fontPx: 54, weight: 800 },
    ),
  );
  root.add(
    makeTextPlane(
      "seismic figure start direction",
      model.directionLabels.start,
      addNormalLift(topLeft.clone().add(leftOffset).add(upOffset), normalLift),
      across.clone().multiplyScalar(labelSizeM * 1.4),
      horizontalTextHeight,
      textColor,
      { fontPx: 58, weight: 800 },
    ),
  );
  root.add(
    makeTextPlane(
      "seismic figure end direction",
      model.directionLabels.end,
      addNormalLift(topRight.clone().add(rightOffset).add(upOffset), normalLift),
      across.clone().multiplyScalar(labelSizeM * 1.4),
      horizontalTextHeight,
      textColor,
      { fontPx: 58, weight: 800 },
    ),
  );

  const scaleFraction = clamp(model.scaleBar.fraction, 0.04, 0.6);
  const scaleStart = topLeft.clone().lerp(topRight, 0.58).add(upOffset);
  const scaleEnd = scaleStart.clone().add(across.clone().multiplyScalar(widthM * scaleFraction));
  root.add(makeLine("seismic figure scale bar", [addNormalLift(scaleStart, normalLift), addNormalLift(scaleEnd, normalLift)], axisColor));
  root.add(
    makeLine("seismic figure scale left tick", [
      addNormalLift(scaleStart.clone().add(down.clone().multiplyScalar(-labelSizeM * 0.25)), normalLift),
      addNormalLift(scaleStart.clone().add(down.clone().multiplyScalar(labelSizeM * 0.25)), normalLift),
    ], axisColor),
  );
  root.add(
    makeLine("seismic figure scale right tick", [
      addNormalLift(scaleEnd.clone().add(down.clone().multiplyScalar(-labelSizeM * 0.25)), normalLift),
      addNormalLift(scaleEnd.clone().add(down.clone().multiplyScalar(labelSizeM * 0.25)), normalLift),
    ], axisColor),
  );
  root.add(
    makeTextPlane(
      "seismic figure scale label",
      model.scaleBar.label,
      addNormalLift(scaleStart.clone().lerp(scaleEnd, 0.5).add(upOffset.clone().multiplyScalar(0.42)), normalLift),
      across.clone().multiplyScalar(labelSizeM * 3.2),
      horizontalTextHeight,
      textColor,
      { fontPx: 48, weight: 800 },
    ),
  );

  if (frame.drawVerticalAxis) {
    const leftAxisTop = topLeft.clone().add(leftOffset);
    const leftAxisBottom = bottomLeft.clone().add(leftOffset);
    const rightAxisTop = topRight.clone().add(rightOffset);
    const rightAxisBottom = bottomRight.clone().add(rightOffset);
    root.add(
      makeLine("seismic figure left axis", [
        addNormalLift(leftAxisTop, normalLift),
        addNormalLift(leftAxisBottom, normalLift),
      ], axisColor),
    );
    root.add(
      makeLine("seismic figure right axis", [
        addNormalLift(rightAxisTop, normalLift),
        addNormalLift(rightAxisBottom, normalLift),
      ], axisColor),
    );
    for (const tick of model.axis.ticks) {
      const leftTick = leftAxisTop.clone().lerp(leftAxisBottom, tick.t);
      const rightTick = rightAxisTop.clone().lerp(rightAxisBottom, tick.t);
      const leftOut = across.clone().multiplyScalar(-labelSizeM * 0.32);
      const rightOut = across.clone().multiplyScalar(labelSizeM * 0.32);
      root.add(
        makeLine("seismic figure left axis tick", [
          addNormalLift(leftTick, normalLift),
          addNormalLift(leftTick.clone().add(leftOut), normalLift),
        ], axisColor),
      );
      root.add(
        makeLine("seismic figure right axis tick", [
          addNormalLift(rightTick, normalLift),
          addNormalLift(rightTick.clone().add(rightOut), normalLift),
        ], axisColor),
      );
      root.add(
        makeTextPlane(
          "seismic figure left tick label",
          tick.label,
          addNormalLift(leftTick.clone().add(leftOut.multiplyScalar(2.15)), normalLift),
          across.clone().multiplyScalar(labelSizeM * 1.55),
          horizontalTextHeight.clone().multiplyScalar(0.78),
          textColor,
          { fontPx: 42, weight: 700 },
        ),
      );
      root.add(
        makeTextPlane(
          "seismic figure right tick label",
          tick.secondaryLabel ?? tick.label,
          addNormalLift(rightTick.clone().add(rightOut.multiplyScalar(2.15)), normalLift),
          across.clone().multiplyScalar(labelSizeM * 2.45),
          horizontalTextHeight.clone().multiplyScalar(0.78),
          textColor,
          { fontPx: 38, weight: 700 },
        ),
      );
    }
    const axisHeadingWidth = down.clone().multiplyScalar(heightM * 0.44);
    const axisHeadingHeight = across.clone().multiplyScalar(labelSizeM * 0.88);
    root.add(
      makeTextPlane(
        "seismic figure left axis heading",
        model.axis.heading,
        addNormalLift(leftAxisTop.clone().lerp(leftAxisBottom, 0.5).add(leftOffset.clone().multiplyScalar(1.2)), normalLift),
        axisHeadingWidth,
        axisHeadingHeight,
        textColor,
        { fontPx: 44, weight: 800 },
      ),
    );
    root.add(
      makeTextPlane(
        "seismic figure right axis heading",
        model.axis.sideHeading ?? model.axis.heading,
        addNormalLift(rightAxisTop.clone().lerp(rightAxisBottom, 0.5).add(rightOffset.clone().multiplyScalar(1.2)), normalLift),
        axisHeadingWidth,
        axisHeadingHeight,
        textColor,
        { fontPx: 44, weight: 800 },
      ),
    );
  }

  if (model.horizonPolyline.length >= 2) {
    const points = model.horizonPolyline.map(([u, t]) =>
      addNormalLift(
        normalizedBasisPoint(mesh, frame, u, t),
        normalLift.clone().multiplyScalar(1.4),
      ),
    );
    root.add(makeLine("seismic figure horizon polyline", points, horizonColor, 1));
  }
  if (model.wellTrace) {
    const u = model.wellTrace.t;
    const traceTop = normalizedBasisPoint(mesh, frame, u, 0);
    const traceBottom = normalizedBasisPoint(mesh, frame, u, 1);
    root.add(
      makeLine("seismic figure well trace", [
        addNormalLift(traceTop, normalLift.clone().multiplyScalar(1.6)),
        addNormalLift(traceBottom, normalLift.clone().multiplyScalar(1.6)),
      ], wellColor),
    );
    root.add(
      makeTextPlane(
        "seismic figure well label",
        model.wellTrace.label,
        addNormalLift(traceTop.clone().add(upOffset.clone().multiplyScalar(0.45)), normalLift),
        across.clone().multiplyScalar(labelSizeM * 2.2),
        horizontalTextHeight,
        wellColor,
        { fontPx: 48, weight: 800 },
      ),
    );
  }

  if (model.caption) {
    const captionHeight = Math.max(labelSizeM * 1.35, 160);
    const captionCenter = bottomLeft
      .clone()
      .lerp(bottomRight, 0.5)
      .add(downOffset.clone().multiplyScalar(1.15));
    const captionWidth = across.clone().multiplyScalar(widthM + offsetM * 2.2);
    const captionHeightVec = down.clone().multiplyScalar(captionHeight);
    root.add(
      makeBoxPlane(
        "seismic figure caption box",
        addNormalLift(captionCenter, normalLift.clone().multiplyScalar(0.92)),
        captionWidth,
        captionHeightVec,
        captionBoxColor,
        clamp(styleNumber(style, "seismicFigureCaptionBoxOpacity", 0.54), 0, 1),
      ),
    );
    root.add(
      makeTextPlane(
        "seismic figure caption text",
        model.caption,
        addNormalLift(captionCenter, normalLift),
        captionWidth.clone().multiplyScalar(0.92),
        captionHeightVec.clone().multiplyScalar(-0.82),
        textColor,
        { multiline: true, fontPx: 40, weight: 650 },
      ),
    );
  }

  tagFigureTree(root, graphMetadata);
  mesh.add(root);
  mesh.userData.seismicFigureAnnotationRoot = root;
}
