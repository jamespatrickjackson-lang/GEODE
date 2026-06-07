import type {
  CaptureCameraPathContinuityV3,
  CaptureCameraPathFairingV3,
  CaptureCameraPathTimeCurveV3,
  CaptureVec3,
} from "./captureCameraPathV3";

const EPSILON = 0.000_001;

export interface CaptureCameraPathV3SegmentGeometryInput {
  previous?: CaptureVec3 | null;
  from: CaptureVec3;
  to: CaptureVec3;
  next?: CaptureVec3 | null;
  fairing: CaptureCameraPathFairingV3;
}

export interface CaptureCameraPathV3SegmentGeometrySample {
  position: CaptureVec3;
  derivative: CaptureVec3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function add(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(value: CaptureVec3, amount: number): CaptureVec3 {
  return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function length(value: CaptureVec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalize(value: CaptureVec3): CaptureVec3 | null {
  const valueLength = length(value);
  if (valueLength <= EPSILON) return null;
  return scale(value, 1 / valueLength);
}

function dot(a: CaptureVec3, b: CaptureVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subtractDirections(a: CaptureVec3 | null, b: CaptureVec3 | null): CaptureVec3 {
  if (!a || !b) return [0, 0, 0];
  return sub(a, b);
}

export function applyCaptureCameraPathV3TimeCurve(
  curve: CaptureCameraPathTimeCurveV3,
  u: number,
): number {
  const t = clamp(Number.isFinite(u) ? u : 0, 0, 1);
  switch (curve.mode) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return 1 - (1 - t) * (1 - t);
    case "ease-in-out":
      return t * t * (3 - 2 * t);
    case "custom-ramp": {
      const ramp = Array.isArray(curve.ramp) ? curve.ramp : [];
      if (ramp.length < 2) return t;
      for (let index = 0; index < ramp.length - 1; index += 1) {
        const start = ramp[index];
        const end = ramp[index + 1];
        if (t < start.t || t > end.t) continue;
        const span = Math.max(EPSILON, end.t - start.t);
        return lerp(start.value, end.value, clamp((t - start.t) / span, 0, 1));
      }
      return ramp[t <= 0 ? 0 : ramp.length - 1]?.value ?? t;
    }
    case "linear":
    default:
      return t;
  }
}

function derivativeFactor(order: number, power: number): number {
  let result = 1;
  for (let index = 0; index < order; index += 1) {
    result *= power - index;
  }
  return result;
}

function buildHermiteMatrix(maxDerivativeOrder: number): number[][] {
  const degree = maxDerivativeOrder * 2 + 1;
  const rows: number[][] = [];
  for (const at of [0, 1]) {
    for (let order = 0; order <= maxDerivativeOrder; order += 1) {
      const row: number[] = [];
      for (let power = 0; power <= degree; power += 1) {
        row.push(
          power < order
            ? 0
            : derivativeFactor(order, power) * Math.pow(at, power - order),
        );
      }
      rows.push(row);
    }
  }
  return rows;
}

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] {
  const size = rhs.length;
  const a = matrix.map((row, index) => [...row, rhs[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    if (Math.abs(a[pivot][column]) <= EPSILON) {
      throw new Error("Camera path polynomial solve failed.");
    }
    if (pivot !== column) {
      const swap = a[column];
      a[column] = a[pivot];
      a[pivot] = swap;
    }
    const pivotValue = a[column][column];
    for (let entry = column; entry <= size; entry += 1) {
      a[column][entry] /= pivotValue;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let entry = column; entry <= size; entry += 1) {
        a[row][entry] -= factor * a[column][entry];
      }
    }
  }
  return a.map((row) => row[size]);
}

function evaluatePolynomial(coefficients: number[], t: number, derivativeOrder = 0): number {
  return coefficients.reduce((sum, coefficient, power) => {
    if (power < derivativeOrder) return sum;
    return (
      sum +
      coefficient *
        derivativeFactor(derivativeOrder, power) *
        Math.pow(t, power - derivativeOrder)
    );
  }, 0);
}

function continuityOrder(continuity: CaptureCameraPathContinuityV3): number {
  switch (continuity) {
    case "G3":
      return 3;
    case "G2":
      return 2;
    case "G1":
      return 1;
    case "G0":
    default:
      return 0;
  }
}

function influenceDistance(
  value: number | "auto",
  fallbackChordLength: number,
  segmentLength: number,
): number {
  const auto = Math.min(segmentLength * 0.5, fallbackChordLength * 0.35);
  return value === "auto" ? auto : clamp(value, 0, Math.max(segmentLength * 2, value));
}

function tangentAtNode({
  previous,
  current,
  next,
  fallbackDirection,
  bias,
}: {
  previous?: CaptureVec3 | null;
  current: CaptureVec3;
  next?: CaptureVec3 | null;
  fallbackDirection: CaptureVec3;
  bias: number;
}): CaptureVec3 {
  const incoming = previous ? normalize(sub(current, previous)) : null;
  const outgoing = next ? normalize(sub(next, current)) : null;
  const balanced =
    incoming && outgoing
      ? normalize(
          add(scale(incoming, 1 - bias), scale(outgoing, 1 + bias)),
        )
      : outgoing ?? incoming;
  let tangent = balanced ?? normalize(fallbackDirection) ?? [1, 0, 0];
  const fallback = normalize(fallbackDirection);
  if (fallback && dot(tangent, fallback) < 0) tangent = scale(tangent, -1);
  return tangent;
}

function derivativeSet(input: CaptureCameraPathV3SegmentGeometryInput): CaptureVec3[][] {
  const fairing = input.fairing;
  const order = continuityOrder(fairing.continuity);
  const chord = sub(input.to, input.from);
  const segmentLength = Math.max(EPSILON, length(chord));
  const chordDirection = normalize(chord) ?? [1, 0, 0];
  const bias = clamp(fairing.bias, -1, 1);
  const tensionScale = lerp(1, 0.2, clamp(fairing.tension, 0, 1));
  const previousChordLength = input.previous
    ? length(sub(input.from, input.previous))
    : segmentLength;
  const nextChordLength = input.next ? length(sub(input.next, input.to)) : segmentLength;
  const startInfluence =
    influenceDistance(fairing.fromInfluenceOut, previousChordLength, segmentLength) *
    tensionScale;
  const endInfluence =
    influenceDistance(fairing.toInfluenceIn, nextChordLength, segmentLength) *
    tensionScale;
  const startTangent = tangentAtNode({
    previous: input.previous,
    current: input.from,
    next: input.to,
    fallbackDirection: chord,
    bias,
  });
  const endTangent = tangentAtNode({
    previous: input.from,
    current: input.to,
    next: input.next,
    fallbackDirection: chord,
    bias,
  });
  const startD1 = scale(startTangent, startInfluence);
  const endD1 = scale(endTangent, endInfluence);
  if (order === 0) {
    return [[input.from], [input.to]];
  }
  const startCurveDelta = subtractDirections(
    normalize(startTangent),
    input.previous ? normalize(sub(input.from, input.previous)) : chordDirection,
  );
  const endCurveDelta = subtractDirections(
    input.next ? normalize(sub(input.next, input.to)) : chordDirection,
    normalize(endTangent),
  );
  const startD2 = scale(startCurveDelta, startInfluence * startInfluence * 0.25);
  const endD2 = scale(endCurveDelta, endInfluence * endInfluence * 0.25);
  const startD3 = scale(startD2, startInfluence * 0.35);
  const endD3 = scale(endD2, endInfluence * 0.35);
  const start = [input.from, startD1];
  const end = [input.to, endD1];
  if (order >= 2) {
    start.push(startD2);
    end.push(endD2);
  }
  if (order >= 3) {
    start.push(startD3);
    end.push(endD3);
  }
  return [start, end];
}

function solveHermiteCoefficients(
  startDerivatives: CaptureVec3[],
  endDerivatives: CaptureVec3[],
): [number[], number[], number[]] {
  const order = Math.max(startDerivatives.length, endDerivatives.length) - 1;
  const matrix = buildHermiteMatrix(order);
  return [0, 1, 2].map((axis) => {
    const rhs = [...startDerivatives, ...endDerivatives].map((value) => value[axis]);
    return solveLinearSystem(matrix, rhs);
  }) as [number[], number[], number[]];
}

export function sampleCaptureCameraPathV3SegmentGeometry(
  input: CaptureCameraPathV3SegmentGeometryInput,
  progress: number,
): CaptureCameraPathV3SegmentGeometrySample {
  const t = clamp(progress, 0, 1);
  if (input.fairing.continuity === "G0") {
    const chord = sub(input.to, input.from);
    return {
      position: add(input.from, scale(chord, t)),
      derivative: chord,
    };
  }
  const [startDerivatives, endDerivatives] = derivativeSet(input);
  const [x, y, z] = solveHermiteCoefficients(startDerivatives, endDerivatives);
  return {
    position: [
      evaluatePolynomial(x, t),
      evaluatePolynomial(y, t),
      evaluatePolynomial(z, t),
    ],
    derivative: [
      evaluatePolynomial(x, t, 1),
      evaluatePolynomial(y, t, 1),
      evaluatePolynomial(z, t, 1),
    ],
  };
}
