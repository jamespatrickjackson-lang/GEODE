export interface SeismicFigureSampleDomain {
  kind?: string;
  unit?: string;
  min: number;
  max: number;
  verticalScaleMPerUnit?: number;
}

export interface SeismicFigureAnnotationInput {
  productLabel: string;
  lineLabel?: string;
  sourceSubmission?: string;
  sampleDomain: SeismicFigureSampleDomain;
  datumM?: number;
  sectionStart: readonly [number, number, number];
  sectionEnd: readonly [number, number, number];
  sectionLengthMOverride?: number;
  navigationStatus?: string;
  titleOverride?: string;
  captionOverride?: string;
  scaleLabelOverride?: string;
  wellLabel?: string;
  wellPositionT?: number;
  horizonPoints?: Array<[number, number]>;
}

export interface SeismicFigureTick {
  value: number;
  label: string;
  secondaryLabel?: string;
  t: number;
}

export interface SeismicFigureAnnotationModel {
  title: string;
  caption: string;
  axis: {
    heading: string;
    sideHeading?: string;
    unit: string;
    ticks: SeismicFigureTick[];
  };
  directionLabels: {
    start: string;
    end: string;
  };
  scaleBar: {
    lengthM: number;
    label: string;
    fraction: number;
  };
  wellTrace: {
    label: string;
    t: number;
  } | null;
  horizonPolyline: Array<[number, number]>;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatSampleValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 10) return Math.round(value).toString();
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  const nice =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 5
          ? 5
          : 10;
  return nice * magnitude;
}

function buildAxisTicks(min: number, max: number): SeismicFigureTick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return [];
  }
  if (max === min) return [{ value: min, label: formatSampleValue(min), t: 0 }];
  const range = max - min;
  const step = niceStep(range / 8);
  const ticks: SeismicFigureTick[] = [
    { value: min, label: formatSampleValue(min), t: 0 },
  ];
  const first = Math.ceil(min / step) * step;
  for (let value = first; value < max; value += step) {
    if (Math.abs(value - min) < step * 0.01) continue;
    ticks.push({
      value,
      label: formatSampleValue(value),
      t: clamp01((value - min) / range),
    });
  }
  if (Math.abs(ticks[ticks.length - 1]?.value - max) > range * 0.0001) {
    ticks.push({ value: max, label: formatSampleValue(max), t: 1 });
  }
  return ticks;
}

function axisHeading(domain: SeismicFigureSampleDomain): {
  heading: string;
  sideHeading?: string;
  unit: string;
} {
  const unit = cleanText(domain.unit) || "unit";
  const kind = cleanText(domain.kind).toLowerCase();
  if (kind.includes("time") || unit.toLowerCase() === "ms") {
    return { heading: `Two-way travel time (TWT, ${unit})`, unit };
  }
  if (kind.includes("velocity")) {
    return { heading: `Velocity sample (${unit})`, unit };
  }
  if (kind.includes("depth") || unit.toLowerCase() === "m") {
    return {
      heading: `Depth below seismic datum (${unit})`,
      sideHeading: "Elevation (m ASL)",
      unit,
    };
  }
  return { heading: `Sample (${unit})`, unit };
}

function sectionLengthM(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  return Math.hypot(dx, dy);
}

function formatScaleLength(lengthM: number): string {
  if (lengthM >= 1000) {
    const km = lengthM / 1000;
    return `${Number.isInteger(km) ? km.toFixed(0) : km.toFixed(1)} km`;
  }
  return `${Math.round(lengthM)} m`;
}

function niceScaleBarLength(sectionLength: number): number {
  if (!Number.isFinite(sectionLength) || sectionLength <= 0) return 0;
  const target = sectionLength * 0.33;
  const exponent = Math.floor(Math.log10(target));
  const candidates: number[] = [];
  for (let power = exponent - 2; power <= exponent + 1; power += 1) {
    const magnitude = 10 ** power;
    candidates.push(1 * magnitude, 2 * magnitude, 5 * magnitude);
  }
  return (
    candidates
      .filter((candidate) => candidate > 0 && candidate <= target)
      .sort((a, b) => b - a)[0] ?? target
  );
}

function compassLabel(dx: number, dy: number): string {
  if (Math.hypot(dx, dy) < 1e-6) return "";
  const directions = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
  const angle = Math.atan2(dy, dx);
  const index = Math.round(angle / (Math.PI / 4));
  return directions[((index % 8) + 8) % 8] ?? "";
}

function defaultCaption(input: SeismicFigureAnnotationInput): string {
  const parts = [
    cleanText(input.lineLabel),
    cleanText(input.productLabel),
    cleanText(input.sourceSubmission),
    cleanText(input.navigationStatus),
  ].filter(Boolean);
  return parts.join(" | ");
}

function cleanHorizonPoints(
  points: SeismicFigureAnnotationInput["horizonPoints"],
): Array<[number, number]> {
  if (!Array.isArray(points)) return [];
  return points
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        finiteNumber(point[0]) &&
        finiteNumber(point[1]),
    )
    .map(([x, y]) => [clamp01(x), clamp01(y)]);
}

export function buildSeismicFigureAnnotationModel(
  input: SeismicFigureAnnotationInput,
): SeismicFigureAnnotationModel {
  const title =
    cleanText(input.titleOverride) || cleanText(input.productLabel) || "Seismic section";
  const caption = cleanText(input.captionOverride) || defaultCaption(input);
  const axis = axisHeading(input.sampleDomain);
  const lengthM =
    finiteNumber(input.sectionLengthMOverride) &&
    input.sectionLengthMOverride > 0
      ? input.sectionLengthMOverride
      : sectionLengthM(input.sectionStart, input.sectionEnd);
  const scaleLengthM = niceScaleBarLength(lengthM);
  const scaleLabel =
    cleanText(input.scaleLabelOverride) || formatScaleLength(scaleLengthM);
  const axisDx = input.sectionEnd[0] - input.sectionStart[0];
  const axisDy = input.sectionEnd[1] - input.sectionStart[1];
  const wellPositionT = finiteNumber(input.wellPositionT)
    ? clamp01(input.wellPositionT)
    : null;
  const wellLabel = cleanText(input.wellLabel);

  return {
    title,
    caption,
    axis: {
      ...axis,
      ticks: buildAxisTicks(input.sampleDomain.min, input.sampleDomain.max).map(
        (tick) => {
          if (!finiteNumber(input.datumM)) return tick;
          const kind = cleanText(input.sampleDomain.kind).toLowerCase();
          const unit = cleanText(input.sampleDomain.unit).toLowerCase();
          if (!kind.includes("depth") && unit !== "m") return tick;
          return {
            ...tick,
            secondaryLabel: `Elevation ${Math.round(
              input.datumM - tick.value,
            ).toLocaleString("en-US")} m ASL`,
          };
        },
      ),
    },
    directionLabels: {
      start: compassLabel(-axisDx, -axisDy),
      end: compassLabel(axisDx, axisDy),
    },
    scaleBar: {
      lengthM: scaleLengthM,
      label: scaleLabel,
      fraction: lengthM > 0 ? Math.min(1, scaleLengthM / lengthM) : 0,
    },
    wellTrace:
      wellPositionT !== null && wellLabel
        ? {
            label: wellLabel,
            t: wellPositionT,
          }
        : null,
    horizonPolyline: cleanHorizonPoints(input.horizonPoints),
  };
}
