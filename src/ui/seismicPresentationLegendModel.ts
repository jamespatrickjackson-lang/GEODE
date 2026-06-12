import type { EditableStyle, ProjectLayerSpec } from "../pages/types";

export const SEISMIC_PRESENTATION_VELOCITY_PRODUCT_ID =
  "gdr-1015-forge3d-velo5d-float-01312018";
const DEFAULT_VELOCITY_RANGE_M_PER_S = [2000, 5000] as const;
const DEFAULT_VELOCITY_MIN_LABEL = "2,000 m/s";
const DEFAULT_VELOCITY_MAX_LABEL = "5,000 m/s";
const DEFAULT_DATUM_LABEL = "1,800 m";

export type SeismicPresentationSliceAxis = "inline" | "crossline" | "sample";

type UnknownRecord = Record<string, unknown>;

export interface SeismicPresentationGridRanges {
  inlineRange?: readonly [number, number];
  crosslineRange?: readonly [number, number];
  sampleRange?: readonly [number, number];
}

export interface SeismicPresentationLegendModel {
  productLabel: string;
  renderModeLabel: string;
  amplitudeLabel: string;
  amplitudeMinLabel: string;
  amplitudeMidLabel: string;
  amplitudeMaxLabel: string;
  colormap: NonNullable<EditableStyle["seismicColormap"]>;
  velocityReferenceLabel: string;
  velocityMinLabel: string;
  velocityMaxLabel: string;
  datumLabel: string;
  provenanceTag: string;
  verticalExaggerationLabel: string;
  sliceAxis: SeismicPresentationSliceAxis;
  sliceFraction: number;
  sliceReadout: string;
  gridRanges: SeismicPresentationGridRanges;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
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

function seismicProducts(layer: ProjectLayerSpec | undefined): UnknownRecord[] {
  const products = layer?.metadata?.seismicProducts;
  if (!Array.isArray(products)) return [];
  return products.filter(
    (product): product is UnknownRecord =>
      Boolean(product) && typeof product === "object" && !Array.isArray(product),
  );
}

export function seismicPresentationProductById(
  layer: ProjectLayerSpec | undefined,
  id: string | undefined,
): UnknownRecord | undefined {
  if (!id) return undefined;
  return seismicProducts(layer).find((product) => stringField(product, "id") === id);
}

function selectedProductForStyle(
  layer: ProjectLayerSpec | undefined,
  style: EditableStyle,
): UnknownRecord | undefined {
  const productId =
    typeof style.seismicProductId === "string"
      ? style.seismicProductId
      : typeof layer?.metadata?.defaultSeismicProductId === "string"
        ? layer.metadata.defaultSeismicProductId
        : undefined;
  return seismicPresentationProductById(layer, productId);
}

function companionVelocityProduct(
  layer: ProjectLayerSpec | undefined,
): UnknownRecord | undefined {
  return (
    seismicPresentationProductById(layer, SEISMIC_PRESENTATION_VELOCITY_PRODUCT_ID) ??
    seismicProducts(layer).find(
      (product) =>
        stringField(product, "productKind") === "velocity" &&
        stringField(product, "surveyKind") === "3d",
    )
  );
}

function productDisplayLabel(product: UnknownRecord | undefined, fallback: string): string {
  return (
    stringField(product, "label") ??
    stringField(product, "canonicalLabel") ??
    stringField(product, "id") ??
    fallback
  )
    .replace(/\bFORGE\s*3D\b/gi, "3D")
    .replace(/\bForge3D\b/g, "3D")
    .replace(/\bForge3d\b/g, "3D")
    .replace(/\s+/g, " ")
    .trim();
}

function productTextHeader(product: UnknownRecord | undefined): string {
  const evidence = asRecord(product?.nameEvidence);
  return stringField(evidence, "textHeaderExcerpt") ?? "";
}

function headerAxisRange(header: string, axis: "IL" | "XL"): readonly [number, number] | undefined {
  const values = [...header.matchAll(new RegExp(`\\b${axis}\\s*(\\d+)`, "gi"))]
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) return undefined;
  return [Math.min(...values), Math.max(...values)];
}

function sampleRangeForProduct(
  product: UnknownRecord | undefined,
): readonly [number, number] | undefined {
  return (
    rangeFromArray(product?.sampleRange) ??
    rangeFromArray(asRecord(asRecord(product?.raymarchVolume)?.sampleDomain)?.range) ??
    (() => {
      const domain = asRecord(asRecord(product?.raymarchVolume)?.sampleDomain);
      const min = numberField(domain, "min");
      const max = numberField(domain, "max");
      return min !== undefined && max !== undefined ? [min, max] : undefined;
    })()
  );
}

export function seismicPresentationGridRanges(
  product: UnknownRecord | undefined,
): SeismicPresentationGridRanges {
  const header = productTextHeader(product);
  const inlineRange = headerAxisRange(header, "IL");
  const crosslineRange = headerAxisRange(header, "XL");
  const sampleRange = sampleRangeForProduct(product);
  return {
    inlineRange,
    crosslineRange,
    sampleRange,
  };
}

function fractionValue(
  range: readonly [number, number] | undefined,
  fraction: number,
): number | undefined {
  if (!range) return undefined;
  return range[0] + (range[1] - range[0]) * clamp(fraction, 0, 1);
}

function datumMForProduct(product: UnknownRecord | undefined): number {
  return (
    numberField(product, "datumM") ??
    numberField(asRecord(product?.verticalReference), "referenceDatumM") ??
    numberField(asRecord(product?.verticalReference), "sourceDatumM") ??
    1800
  );
}

export function formatSeismicPresentationSliceReadout({
  axis,
  fraction,
  product,
}: {
  axis: EditableStyle["seismicSliceAxis"];
  fraction: number;
  product: UnknownRecord | undefined;
}): string {
  const safeFraction = clamp(fraction, 0, 1);
  const gridRanges = seismicPresentationGridRanges(product);
  if (axis === "crossline") {
    const value = fractionValue(gridRanges.crosslineRange, safeFraction);
    return value !== undefined
      ? `XL ${Math.round(value)}`
      : `XL ${(safeFraction * 100).toFixed(0)}%`;
  }
  if (axis === "sample") {
    const value = fractionValue(gridRanges.sampleRange, safeFraction);
    const datumM = datumMForProduct(product);
    return value !== undefined
      ? `Depth ${formatNumber(value)} m below ${formatNumber(datumM)} m datum`
      : `Depth ${(safeFraction * 100).toFixed(0)}%`;
  }
  const value = fractionValue(gridRanges.inlineRange, safeFraction);
  return value !== undefined
    ? `IL ${Math.round(value)}`
    : `IL ${(safeFraction * 100).toFixed(0)}%`;
}

function valueEncodingRange(
  product: UnknownRecord | undefined,
): readonly [number, number] | undefined {
  return (
    rangeFromArray(asRecord(product?.valueEncoding)?.displayRangeMPerS) ??
    rangeFromArray(
      asRecord(asRecord(product?.raymarchVolume)?.valueEncoding)?.displayRangeMPerS,
    )
  );
}

function seismicColormapFromStyle(
  value: EditableStyle["seismicColormap"],
): NonNullable<EditableStyle["seismicColormap"]> {
  return value === "grayscale" || value === "velocity"
    ? value
    : "blue-white-red";
}

function normalizedAmplitudeTicks(style: EditableStyle): [number, number, number] {
  const min = clamp(
    typeof style.seismicAmplitudeMin === "number" ? style.seismicAmplitudeMin : 0.08,
    0,
    0.98,
  );
  const max = clamp(
    Math.max(
      min + 0.01,
      typeof style.seismicAmplitudeMax === "number" ? style.seismicAmplitudeMax : 0.92,
    ),
    min + 0.01,
    1,
  );
  return [min, (min + max) / 2, max];
}

function presentationSliceAxis(
  axis: EditableStyle["seismicSliceAxis"],
): SeismicPresentationSliceAxis {
  if (axis === "crossline" || axis === "sample") return axis;
  return "inline";
}

function provenanceTagFromPreset(activePreset: unknown): string {
  const preset = asRecord(activePreset);
  return stringField(preset, "provenanceClassification") ?? "source-derived";
}

export function buildSeismicPresentationLegendModel({
  layer,
  style,
  activePreset,
  verticalExaggeration,
}: {
  layer: ProjectLayerSpec | undefined;
  style: EditableStyle;
  activePreset?: unknown;
  verticalExaggeration?: number;
}): SeismicPresentationLegendModel {
  const product = selectedProductForStyle(layer, style);
  const velocityProduct = companionVelocityProduct(layer);
  const velocityRange = valueEncodingRange(velocityProduct) ?? DEFAULT_VELOCITY_RANGE_M_PER_S;
  const [ampMin, ampMid, ampMax] = normalizedAmplitudeTicks(style);
  const sliceFraction = clamp(
    typeof style.seismicSliceFraction === "number" ? style.seismicSliceFraction : 0.5,
    0,
    1,
  );
  const sliceAxis = presentationSliceAxis(style.seismicSliceAxis);
  const datumM = datumMForProduct(product);
  const datumDisplayLabel =
    Math.round(datumM) === 1800 ? DEFAULT_DATUM_LABEL : `${formatNumber(datumM)} m`;
  const safeVerticalExaggeration =
    typeof verticalExaggeration === "number" && Number.isFinite(verticalExaggeration)
      ? Math.max(0.01, verticalExaggeration)
      : 1;

  return {
    productLabel: productDisplayLabel(product, "Seismic product"),
    renderModeLabel:
      style.seismicRenderMode === "raymarch"
        ? "Raymarch volume - source-normalized amplitude"
        : "Section slice - source-normalized amplitude",
    amplitudeLabel: "Amplitude color map",
    amplitudeMinLabel: ampMin.toFixed(2),
    amplitudeMidLabel: ampMid.toFixed(2),
    amplitudeMaxLabel: ampMax.toFixed(2),
    colormap: seismicColormapFromStyle(style.seismicColormap),
    velocityReferenceLabel: "Velocity reference",
    velocityMinLabel:
      velocityRange === DEFAULT_VELOCITY_RANGE_M_PER_S
        ? DEFAULT_VELOCITY_MIN_LABEL
        : `${formatNumber(velocityRange[0])} m/s`,
    velocityMaxLabel:
      velocityRange === DEFAULT_VELOCITY_RANGE_M_PER_S
        ? DEFAULT_VELOCITY_MAX_LABEL
        : `${formatNumber(velocityRange[1])} m/s`,
    datumLabel: `Depth axis in metres, referenced to ${datumDisplayLabel} datum`,
    provenanceTag: provenanceTagFromPreset(activePreset),
    verticalExaggerationLabel: `VE ${safeVerticalExaggeration.toFixed(2)}x`,
    sliceAxis,
    sliceFraction,
    sliceReadout: formatSeismicPresentationSliceReadout({
      axis: sliceAxis,
      fraction: sliceFraction,
      product,
    }),
    gridRanges: seismicPresentationGridRanges(product),
  };
}

export function seismicPresentationColor(
  t: number,
  palette: EditableStyle["seismicColormap"],
): string {
  const c = clamp(t, 0, 1);
  if (palette === "grayscale") {
    const channel = Math.round(c * 255);
    return `rgb(${channel}, ${channel}, ${channel})`;
  }
  if (palette === "velocity") {
    if (c < 0.33) {
      const k = c / 0.33;
      return `rgb(${Math.round(23 + (51 - 23) * k)}, ${Math.round(
        59 + (182 - 59) * k,
      )}, ${Math.round(154 + (215 - 154) * k)})`;
    }
    if (c < 0.66) {
      const k = (c - 0.33) / 0.33;
      return `rgb(${Math.round(51 + (244 - 51) * k)}, ${Math.round(
        182 + (223 - 182) * k,
      )}, ${Math.round(215 + (99 - 215) * k)})`;
    }
    const k = (c - 0.66) / 0.34;
    return `rgb(${Math.round(244 + (211 - 244) * k)}, ${Math.round(
      223 + (75 - 223) * k,
    )}, ${Math.round(99 + (45 - 99) * k)})`;
  }
  if (c < 0.5) {
    const k = c / 0.5;
    return `rgb(${Math.round(36 + (244 - 36) * k)}, ${Math.round(
      86 + (247 - 86) * k,
    )}, ${Math.round(201 + (255 - 201) * k)})`;
  }
  const k = (c - 0.5) / 0.5;
  return `rgb(${Math.round(244 + (217 - 244) * k)}, ${Math.round(
    247 + (54 - 247) * k,
  )}, ${Math.round(255 + (47 - 255) * k)})`;
}
