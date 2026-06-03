export interface GeophysicsAxisTick {
  value: number;
  label: string;
  secondaryLabel?: string;
}

export interface GeophysicsAxisModel {
  heading: string;
  unit: string;
  ticks: GeophysicsAxisTick[];
  caveat?: string;
}

export interface GeophysicsFigureModel {
  artifactFamily: "seismic" | "mt-resistivity";
  title: string;
  subtitle: string;
  primaryAxis: GeophysicsAxisModel;
  horizontalAxis?: GeophysicsAxisModel;
  valueAxis?: GeophysicsAxisModel;
  figureLines: string[];
}

export interface SeismicFigureModelInput {
  product?: unknown;
  renderMode?: "slice" | "raymarch";
  sliceAxis?: string;
  sampleRange?: readonly [number, number];
}

export interface MtResistivityFigureModelInput {
  slice?: unknown;
  sourceOrigin?: string;
  verticalRangeM?: readonly [number, number];
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function stringField(record: UnknownRecord | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(record: UnknownRecord | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 0.5 ? 0 : value;
  return normalized.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatSignedNumber(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  return formatNumber(value);
}

function linearTicks(min: number, max: number, count = 5): GeophysicsAxisTick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max === min) {
    return [{ value: min, label: formatNumber(min) }];
  }
  const safeCount = Math.max(2, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => {
    const value = min + ((max - min) * index) / (safeCount - 1);
    return {
      value,
      label: formatNumber(value),
    };
  });
}

function rangeFromArray(value: unknown): readonly [number, number] | undefined {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [value[0], value[1]];
  }
  return undefined;
}

function firstSectionSampleRange(
  product: UnknownRecord | undefined,
): readonly [number, number] | undefined {
  const sections = product?.sections;
  if (!Array.isArray(sections)) return undefined;
  for (const section of sections) {
    const sampleDomain = asRecord(asRecord(section)?.sampleDomain);
    const min = numberField(sampleDomain, "min");
    const max = numberField(sampleDomain, "max");
    if (min !== undefined && max !== undefined) return [min, max];
  }
  return undefined;
}

function fallbackSampleRange(domainKind: string | undefined): readonly [number, number] {
  if (domainKind === "depth") return [0, 6000];
  if (domainKind === "velocity-time") return [0, 10000];
  return [0, 4000];
}

function seismicSampleRange(
  input: SeismicFigureModelInput,
  product: UnknownRecord | undefined,
  domainKind: string | undefined,
): readonly [number, number] {
  return (
    input.sampleRange ??
    rangeFromArray(product?.sampleRange) ??
    firstSectionSampleRange(product) ??
    fallbackSampleRange(domainKind)
  );
}

function sectionVerticalScale(product: UnknownRecord | undefined): number | undefined {
  const sections = product?.sections;
  if (!Array.isArray(sections)) return undefined;
  for (const section of sections) {
    const sampleDomain = asRecord(asRecord(section)?.sampleDomain);
    const scale = numberField(sampleDomain, "verticalScaleMPerUnit");
    if (scale !== undefined) return scale;
  }
  return undefined;
}

function seismicAxisHeading(domainKind: string | undefined): {
  heading: string;
  unit: string;
  caveat?: string;
} {
  if (domainKind === "depth") {
    return {
      heading: "Depth below seismic datum",
      unit: "m",
      caveat: "Absolute elevation side labels use datum minus depth.",
    };
  }
  return {
    heading: "Two-way travel time (TWT)",
    unit: "ms",
    caveat:
      "Depth/elevation labels for time-domain seismic are display-derived and approximate.",
  };
}

function velocityValueAxis(
  product: UnknownRecord | undefined,
): GeophysicsAxisModel | undefined {
  const valueEncoding = asRecord(product?.valueEncoding);
  const displayRange = rangeFromArray(valueEncoding?.displayRangeMPerS);
  if (!displayRange) return undefined;
  return {
    heading: "Interval velocity",
    unit: "m/s",
    ticks: linearTicks(displayRange[0], displayRange[1]),
  };
}

function seismicFigureLines(
  product: UnknownRecord | undefined,
  axis: GeophysicsAxisModel,
  input: SeismicFigureModelInput,
): string[] {
  const label = stringField(product, "label") ?? stringField(product, "id") ?? "Seismic product";
  const lineLabel = stringField(product, "lineLabel");
  const sourceSubmission = stringField(product, "sourceSubmission");
  const datumM = numberField(product, "datumM");
  const navigationPlacement = asRecord(product?.navigationPlacement);
  const navigationStatus = stringField(navigationPlacement, "statusLabel");
  const renderLine =
    input.renderMode === "raymarch"
      ? "Render: Raymarch volume"
      : `Render: Section slice${input.sliceAxis ? ` (${input.sliceAxis})` : ""}`;
  const lines = [
    label,
    `Domain: ${axis.heading} (${axis.unit})`,
    lineLabel ? `Line: ${lineLabel}` : null,
    datumM !== undefined ? `Datum: ${formatNumber(datumM)} m ASL` : null,
    sourceSubmission ? `Source: ${sourceSubmission}` : null,
    renderLine,
    navigationStatus ?? null,
    axis.caveat ?? null,
  ];
  return lines.filter((line): line is string => Boolean(line));
}

export function buildSeismicFigureModel(
  input: SeismicFigureModelInput,
): GeophysicsFigureModel {
  const product = asRecord(input.product);
  const domainKind = stringField(product, "domainKind");
  const axisBase = seismicAxisHeading(domainKind);
  const sampleRange = seismicSampleRange(input, product, domainKind);
  const datumM = numberField(product, "datumM");
  const verticalScale = sectionVerticalScale(product);
  const primaryAxis: GeophysicsAxisModel = {
    ...axisBase,
    ticks: linearTicks(sampleRange[0], sampleRange[1]).map((tick) => {
      if (datumM === undefined) return tick;
      if (domainKind === "depth") {
        return {
          ...tick,
          secondaryLabel: `Elevation ${formatNumber(datumM - tick.value)} m ASL`,
        };
      }
      if (verticalScale !== undefined) {
        return {
          ...tick,
          secondaryLabel: `Display-derived elevation ${formatNumber(
            datumM - tick.value * verticalScale,
          )} m ASL`,
        };
      }
      return tick;
    }),
  };
  const valueAxis =
    stringField(product, "productKind") === "velocity" ||
    domainKind === "velocity-time"
      ? velocityValueAxis(product)
      : undefined;
  const title =
    valueAxis?.heading ??
    (domainKind === "depth" ? "Seismic depth section" : "Seismic time section");
  const subtitle = stringField(product, "label") ?? "Source-backed seismic product";
  return {
    artifactFamily: "seismic",
    title,
    subtitle,
    primaryAxis,
    valueAxis,
    figureLines: seismicFigureLines(product, primaryAxis, input),
  };
}

function mtSliceKind(slice: UnknownRecord | undefined): string | undefined {
  const kind = stringField(slice, "kind");
  if (kind === "horizontal-slice") return "horizontal-elevation-slice";
  return kind;
}

function mtWindowLine(slice: UnknownRecord | undefined): string | undefined {
  const sourceWindow = asRecord(slice?.sourceWindow);
  const directWindow = numberField(slice, "sourceWindowM");
  const halfWindow = numberField(sourceWindow, "halfWindowM");
  const halfWidth = numberField(sourceWindow, "halfWidthM");
  const value = directWindow ?? halfWindow ?? halfWidth;
  return value === undefined ? undefined : `Window: +/-${formatNumber(value)} m`;
}

function mtSectionHorizontalAxis(
  slice: UnknownRecord | undefined,
): GeophysicsAxisModel | undefined {
  const sectionLine = asRecord(slice?.sectionLine);
  const orientation = stringField(sectionLine, "orientation");
  if (orientation === "east-west") {
    const xMin = numberField(sectionLine, "xMin");
    const xMax = numberField(sectionLine, "xMax");
    if (xMin !== undefined && xMax !== undefined) {
      return {
        heading: "East-west distance",
        unit: "m",
        ticks: linearTicks(xMin, xMax),
      };
    }
  }
  if (orientation === "north-south") {
    const yMin = numberField(sectionLine, "yMin");
    const yMax = numberField(sectionLine, "yMax");
    if (yMin !== undefined && yMax !== undefined) {
      return {
        heading: "North-south distance",
        unit: "m",
        ticks: linearTicks(yMin, yMax),
      };
    }
  }
  return undefined;
}

function mtFigureLines(
  slice: UnknownRecord | undefined,
  input: MtResistivityFigureModelInput,
): string[] {
  const label = stringField(slice, "label") ?? stringField(slice, "id") ?? "MT resistivity";
  const targetElevation =
    numberField(slice, "targetElevationM") ?? numberField(slice, "elevationM");
  const kind = mtSliceKind(slice);
  const lines = [
    label,
    "Values: log10 resistivity (Ohm-m)",
    kind === "vertical-section" ? "Section: station-centroid fence" : null,
    targetElevation !== undefined
      ? `Slice elevation: ${formatSignedNumber(targetElevation)} m ASL`
      : null,
    mtWindowLine(slice),
    input.sourceOrigin ? `Source: ${input.sourceOrigin}` : null,
  ];
  return lines.filter((line): line is string => Boolean(line));
}

export function buildMtResistivityFigureModel(
  input: MtResistivityFigureModelInput,
): GeophysicsFigureModel {
  const slice = asRecord(input.slice);
  const kind = mtSliceKind(slice);
  const targetElevation =
    numberField(slice, "targetElevationM") ?? numberField(slice, "elevationM");
  const verticalRange = input.verticalRangeM ?? [-25000, 1500];
  const primaryAxis: GeophysicsAxisModel =
    kind === "vertical-section"
      ? {
          heading: "Elevation",
          unit: "m ASL",
          ticks: linearTicks(verticalRange[0], verticalRange[1]),
        }
      : {
          heading: "Elevation",
          unit: "m ASL",
          ticks: [
            {
              value: targetElevation ?? 0,
              label: formatNumber(targetElevation ?? 0),
            },
          ],
        };
  return {
    artifactFamily: "mt-resistivity",
    title: "MT resistivity",
    subtitle: stringField(slice, "label") ?? "Authored resistivity slice",
    primaryAxis,
    horizontalAxis: mtSectionHorizontalAxis(slice),
    valueAxis: {
      heading: "log10 resistivity",
      unit: "Ohm-m",
      ticks: [],
    },
    figureLines: mtFigureLines(slice, input),
  };
}
