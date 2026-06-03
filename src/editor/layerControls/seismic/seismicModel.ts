import type { EditableStyle, ProjectLayerSpec } from "../../../pages/types";
import { styleBoolean, styleNumber, styleString } from "../../styleControls";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "../scalarSourceRange";
export interface SeismicProductOption {
  id: string;
  label: string;
  surveyKind?: string;
  productKind?: string;
  domainKind?: string;
  domainUnit?: string;
  sourceSubmission?: string;
  navigationPlacement?: {
    navigationSource?: string;
    placementAccuracy?: string;
    canClaimPreciseRegistration?: boolean;
    lineId?: string;
    statusLabel?: string;
    reason?: string;
    validationPath?: string[];
  };
  amplitudeStats?: {
    min?: number;
    max?: number;
    p02?: number;
    p98?: number;
    mean?: number;
  };
  raymarchCapable?: boolean;
}

export interface SeismicAudiencePresetOption {
  id: string;
  label: string;
  audienceMode?: EditableStyle["seismicAudienceMode"];
  summary?: string;
  displayRecipeId?: string;
  productId?: string;
  visibleProductIds?: string[];
  renderMode?: EditableStyle["seismicRenderMode"];
  sliceAxis?: EditableStyle["seismicSliceAxis"];
  sliceFraction?: number;
  opacity?: number;
  amplitudeMin?: number;
  amplitudeMax?: number;
  amplitudeGamma?: number;
  colormap?: EditableStyle["seismicColormap"];
  removeBackground?: boolean;
  backgroundCutoff?: number;
  volumeSampleSteps?: number;
  timeScale?: number;
  navigationVisible?: boolean;
  navigationRoleVisibility?: EditableStyle["seismicNavigationRoleVisibility"];
  sliceThroughVolume?: boolean;
  comparisonProductId?: string;
  comparisonMode?: EditableStyle["seismicComparisonMode"];
  mtCoRender?: EditableStyle["seismicMtCoRender"];
  mtStylePatch?: Partial<EditableStyle>;
  exportLayoutId?: string;
  capabilityGroup?: string;
  cameraShot?: string;
  badges?: string[];
  caveats?: string[];
}

export interface SeismicExportLayoutOption {
  id: string;
  label: string;
  output?: string;
  includes?: string[];
  caveat?: string;
}

export const SEISMIC_AUDIENCE_MODE_OPTIONS = [
  { value: "investor", label: "Investor" },
  { value: "technical", label: "Technical" },
  { value: "data-room", label: "Data room" },
  { value: "export", label: "Export" },
] as const satisfies readonly {
  value: NonNullable<EditableStyle["seismicAudienceMode"]>;
  label: string;
}[];

export const SEISMIC_DEMO_DISCLOSURE_LABELS = [
  "public geothermal demo data",
  "processed seismic product",
  "not a mineral resource estimate",
];

export function seismicIndustryLabel(label: string): string {
  return label
    .replace(/\bUtah\s+FORGE\b/gi, "")
    .replace(/\bUtah\b/gi, "")
    .replace(/\bFORGE\s*3D\b/gi, "3D")
    .replace(/\bForge\s*3d\b/gi, "3D")
    .replace(/\bForge3D\b/g, "3D")
    .replace(/\bForge3d\b/g, "3D")
    .replace(/\bFORGE[-\s]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function seismicColormapFromValue(
  value: unknown,
): NonNullable<EditableStyle["seismicColormap"]> {
  return value === "grayscale" || value === "velocity"
    ? value
    : "blue-white-red";
}

export function isVelocityProduct(product: SeismicProductOption | undefined): boolean {
  return (
    product?.productKind === "velocity" ||
    product?.domainKind === "velocity-time"
  );
}

export function seismicWindowValueLabel(
  product: SeismicProductOption | undefined,
  normalized: number,
): string {
  if (!isVelocityProduct(product)) return normalized.toFixed(2);
  const stats = product?.amplitudeStats;
  const min = typeof stats?.p02 === "number" ? stats.p02 : stats?.min;
  const max = typeof stats?.p98 === "number" ? stats.p98 : stats?.max;
  if (typeof min !== "number" || typeof max !== "number" || max <= min) {
    return `${normalized.toFixed(2)} window`;
  }
  return `${Math.round(min + (max - min) * normalized).toLocaleString()} m/s`;
}

export function seismicProductOptions(
  layer: ProjectLayerSpec,
): SeismicProductOption[] {
  const rawProducts = (layer.metadata as Record<string, unknown>)
    .seismicProducts;
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .map((raw): SeismicProductOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const product = raw as Record<string, unknown>;
      if (typeof product.id !== "string" || typeof product.label !== "string") {
        return null;
      }
      return {
        id: product.id,
        label: seismicIndustryLabel(product.label),
        surveyKind:
          typeof product.surveyKind === "string"
            ? product.surveyKind
            : undefined,
        productKind:
          typeof product.productKind === "string"
            ? product.productKind
            : undefined,
        domainKind:
          typeof product.domainKind === "string"
            ? product.domainKind
            : undefined,
        domainUnit:
          typeof product.domainUnit === "string"
            ? product.domainUnit
            : undefined,
        sourceSubmission:
          typeof product.sourceSubmission === "string"
            ? product.sourceSubmission
            : undefined,
        navigationPlacement:
          product.navigationPlacement &&
          typeof product.navigationPlacement === "object" &&
          !Array.isArray(product.navigationPlacement)
            ? (product.navigationPlacement as SeismicProductOption["navigationPlacement"])
            : undefined,
        amplitudeStats:
          product.amplitudeStats &&
          typeof product.amplitudeStats === "object" &&
          !Array.isArray(product.amplitudeStats)
            ? (product.amplitudeStats as SeismicProductOption["amplitudeStats"])
            : undefined,
        raymarchCapable: product.raymarchCapable === true,
      };
    })
    .filter((product): product is SeismicProductOption => product !== null);
}

export function seismicAudiencePresets(
  layer: ProjectLayerSpec,
): SeismicAudiencePresetOption[] {
  const rawPresets = (layer.metadata as Record<string, unknown>)
    .seismicAudiencePresets;
  if (!Array.isArray(rawPresets)) return [];
  return rawPresets
    .map((raw): SeismicAudiencePresetOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const preset = raw as Record<string, unknown>;
      if (typeof preset.id !== "string" || typeof preset.label !== "string") {
        return null;
      }
      const audienceMode =
        preset.audienceMode === "investor" ||
        preset.audienceMode === "technical" ||
        preset.audienceMode === "data-room" ||
        preset.audienceMode === "export"
          ? preset.audienceMode
          : undefined;
      const mtCoRender =
        preset.mtCoRender === "seismic" ||
        preset.mtCoRender === "mt" ||
        preset.mtCoRender === "integrated"
          ? preset.mtCoRender
          : undefined;
      const mtStylePatch =
        preset.mtStylePatch &&
        typeof preset.mtStylePatch === "object" &&
        !Array.isArray(preset.mtStylePatch)
          ? (preset.mtStylePatch as Partial<EditableStyle>)
          : undefined;
      const navigationRoleVisibility =
        preset.navigationRoleVisibility &&
        typeof preset.navigationRoleVisibility === "object" &&
        !Array.isArray(preset.navigationRoleVisibility)
          ? (preset.navigationRoleVisibility as EditableStyle["seismicNavigationRoleVisibility"])
          : undefined;
      return {
        id: preset.id,
        label: preset.label,
        audienceMode,
        summary:
          typeof preset.summary === "string" ? preset.summary : undefined,
        displayRecipeId:
          typeof preset.displayRecipeId === "string"
            ? preset.displayRecipeId
            : undefined,
        productId:
          typeof preset.productId === "string" ? preset.productId : undefined,
        visibleProductIds: Array.isArray(preset.visibleProductIds)
          ? preset.visibleProductIds.filter(
              (id): id is string => typeof id === "string",
            )
          : undefined,
        renderMode: preset.renderMode === "raymarch" ? "raymarch" : "slice",
        sliceAxis:
          preset.sliceAxis === "crossline" ||
          preset.sliceAxis === "sample" ||
          preset.sliceAxis === "line"
            ? preset.sliceAxis
            : "inline",
        sliceFraction:
          typeof preset.sliceFraction === "number"
            ? preset.sliceFraction
            : undefined,
        opacity:
          typeof preset.opacity === "number" ? preset.opacity : undefined,
        amplitudeMin:
          typeof preset.amplitudeMin === "number"
            ? preset.amplitudeMin
            : undefined,
        amplitudeMax:
          typeof preset.amplitudeMax === "number"
            ? preset.amplitudeMax
            : undefined,
        amplitudeGamma:
          typeof preset.amplitudeGamma === "number"
            ? preset.amplitudeGamma
            : undefined,
        colormap: seismicColormapFromValue(preset.colormap),
        removeBackground: preset.removeBackground === true,
        backgroundCutoff:
          typeof preset.backgroundCutoff === "number"
            ? preset.backgroundCutoff
            : undefined,
        volumeSampleSteps:
          typeof preset.volumeSampleSteps === "number"
            ? preset.volumeSampleSteps
            : undefined,
        timeScale:
          typeof preset.timeScale === "number" ? preset.timeScale : undefined,
        navigationVisible:
          typeof preset.navigationVisible === "boolean"
            ? preset.navigationVisible
            : undefined,
        navigationRoleVisibility,
        sliceThroughVolume: preset.sliceThroughVolume === true,
        comparisonProductId:
          typeof preset.comparisonProductId === "string"
            ? preset.comparisonProductId
            : undefined,
        comparisonMode:
          preset.comparisonMode === "side-by-side" ? "side-by-side" : "overlay",
        mtCoRender,
        mtStylePatch,
        exportLayoutId:
          typeof preset.exportLayoutId === "string"
            ? preset.exportLayoutId
            : undefined,
        capabilityGroup:
          typeof preset.capabilityGroup === "string"
            ? preset.capabilityGroup
            : undefined,
        cameraShot:
          typeof preset.cameraShot === "string" ? preset.cameraShot : undefined,
        badges: Array.isArray(preset.badges)
          ? preset.badges.filter(
              (badge): badge is string => typeof badge === "string",
            )
          : undefined,
        caveats: Array.isArray(preset.caveats)
          ? preset.caveats.filter(
              (caveat): caveat is string => typeof caveat === "string",
            )
          : undefined,
      };
    })
    .filter((preset): preset is SeismicAudiencePresetOption => preset !== null);
}

export function seismicCapabilityPresets(
  layer: ProjectLayerSpec,
): SeismicAudiencePresetOption[] {
  const rawPresets = (layer.metadata as Record<string, unknown>)
    .seismicCapabilityPresets;
  if (!Array.isArray(rawPresets)) return [];
  return seismicAudiencePresets({
    ...layer,
    metadata: {
      ...(layer.metadata as Record<string, unknown>),
      seismicAudiencePresets: rawPresets,
    },
  });
}

export function seismicExportLayouts(
  layer: ProjectLayerSpec,
): SeismicExportLayoutOption[] {
  const rawLayouts = (layer.metadata as Record<string, unknown>)
    .seismicExportLayouts;
  if (!Array.isArray(rawLayouts)) return [];
  return rawLayouts
    .map((raw): SeismicExportLayoutOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const layout = raw as Record<string, unknown>;
      if (typeof layout.id !== "string" || typeof layout.label !== "string") {
        return null;
      }
      return {
        id: layout.id,
        label: layout.label,
        output: typeof layout.output === "string" ? layout.output : undefined,
        includes: Array.isArray(layout.includes)
          ? layout.includes.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
        caveat: typeof layout.caveat === "string" ? layout.caveat : undefined,
      };
    })
    .filter((layout): layout is SeismicExportLayoutOption => layout !== null);
}

export function seismicAudienceModeFromStyle(
  style: EditableStyle,
): NonNullable<EditableStyle["seismicAudienceMode"]> {
  return style.seismicAudienceMode === "technical" ||
    style.seismicAudienceMode === "data-room" ||
    style.seismicAudienceMode === "export"
    ? style.seismicAudienceMode
    : "investor";
}

export function seismicPresetPatch(
  preset: SeismicAudiencePresetOption,
  products: SeismicProductOption[],
  fallbackProductId: string,
): Partial<EditableStyle> {
  const productIds = new Set(products.map((product) => product.id));
  const productId =
    preset.productId && productIds.has(preset.productId)
      ? preset.productId
      : fallbackProductId;
  const visibleIds = new Set(
    (preset.visibleProductIds ?? [productId]).filter((id) =>
      productIds.has(id),
    ),
  );
  if (visibleIds.size === 0 && productId) visibleIds.add(productId);
  const product = products.find((candidate) => candidate.id === productId);
  const renderMode =
    preset.renderMode === "raymarch" && product?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    product?.surveyKind !== "3d"
      ? "line"
      : preset.sliceAxis === "crossline" || preset.sliceAxis === "sample"
        ? preset.sliceAxis
        : "inline";
  return {
    seismicAudienceMode: preset.audienceMode ?? "investor",
    seismicAudiencePresetId: preset.capabilityGroup ? undefined : preset.id,
    seismicCapabilityPresetId: preset.capabilityGroup ? preset.id : undefined,
    seismicDisplayRecipeId: preset.displayRecipeId,
    seismicProductId: productId,
    seismicProductVisibility: Object.fromEntries(
      products.map((candidate) => [candidate.id, visibleIds.has(candidate.id)]),
    ),
    seismicRenderMode: renderMode,
    seismicSliceAxis: sliceAxis,
    seismicSliceFraction:
      typeof preset.sliceFraction === "number" ? preset.sliceFraction : 0.5,
    seismicAmplitudeMin:
      typeof preset.amplitudeMin === "number" ? preset.amplitudeMin : 0.08,
    seismicAmplitudeMax:
      typeof preset.amplitudeMax === "number" ? preset.amplitudeMax : 0.92,
    seismicAmplitudeGamma:
      typeof preset.amplitudeGamma === "number" ? preset.amplitudeGamma : 1,
    seismicColormap: seismicColormapFromValue(preset.colormap),
    seismicRemoveBackground: preset.removeBackground === true,
    seismicBackgroundCutoff:
      typeof preset.backgroundCutoff === "number"
        ? preset.backgroundCutoff
        : 0.16,
    seismicVolumeSampleSteps:
      typeof preset.volumeSampleSteps === "number"
        ? preset.volumeSampleSteps
        : 96,
    seismicTimeScale:
      typeof preset.timeScale === "number" ? preset.timeScale : 2,
    seismicNavigationVisible:
      typeof preset.navigationVisible === "boolean"
        ? preset.navigationVisible
        : true,
    seismicNavigationRoleVisibility: preset.navigationRoleVisibility ?? {
      sources: true,
      receivers: true,
      lines: true,
    },
    seismicSliceThroughVolume:
      preset.sliceThroughVolume === true && product?.raymarchCapable === true,
    seismicComparisonProductId: preset.comparisonProductId,
    seismicComparisonMode:
      preset.comparisonMode === "side-by-side" ? "side-by-side" : "overlay",
    seismicExportLayoutId: preset.exportLayoutId,
    seismicMtCoRender: preset.mtCoRender,
    opacity: typeof preset.opacity === "number" ? preset.opacity : 0.62,
  };
}

export function seismicDefaultProductId(layer: ProjectLayerSpec): string {
  const metadata = layer.metadata as Record<string, unknown>;
  if (typeof metadata.defaultSeismicProductId === "string") {
    return metadata.defaultSeismicProductId;
  }
  return seismicProductOptions(layer)[0]?.id ?? "";
}

export function seismicProductVisibilityFromStyle(
  style: EditableStyle,
  products: SeismicProductOption[],
  selectedProductId: string,
): Record<string, boolean> {
  const rawVisibility =
    typeof style.seismicProductVisibility === "object" &&
    style.seismicProductVisibility !== null
      ? style.seismicProductVisibility
      : {};
  const hasExplicitVisibility = Object.keys(rawVisibility).length > 0;
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      hasExplicitVisibility
        ? rawVisibility[product.id] === true
        : product.id === selectedProductId,
    ]),
  );
}

export function seismicComparisonActions(products: SeismicProductOption[]) {
  return [
    {
      label: "301",
      primary: "gdr-1141-line-301-pdm-enh",
      compare: "gdr-1141-line-301-psdm-unenh",
    },
    {
      label: "302",
      primary: "gdr-1141-line-302-psdm-enh",
      compare: "gdr-1141-line-302-psdm-unenh",
    },
    {
      label: "L5",
      primary: "gdr-1141-line-l5-psdm-enh",
      compare: "gdr-1141-line-l5-psdm-unenh",
    },
    {
      label: "L11",
      primary: "gdr-1141-line-l11-psdm-enh",
      compare: "gdr-1141-line-l11-psdm-unenh",
    },
  ].filter(
    (action) =>
      products.some((product) => product.id === action.primary) &&
      products.some((product) => product.id === action.compare),
  );
}

export function sectionIsoPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    sectionIsoEnabled: styleBoolean(style, "sectionIsoEnabled", false),
    sectionIsoLinesVisible: styleBoolean(style, "sectionIsoLinesVisible", true),
    sectionIsoBandsVisible: styleBoolean(style, "sectionIsoBandsVisible", true),
    sectionIsoTargetIds:
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? { ...(style.sectionIsoTargetIds as Record<string, boolean>) }
        : {},
    sectionIsoMin: styleNumber(style, "sectionIsoMin", SCALAR_SOURCE_MIN),
    sectionIsoMax: styleNumber(style, "sectionIsoMax", SCALAR_SOURCE_MAX),
    sectionIsoLevelCount: Math.max(
      2,
      Math.min(32, Math.round(styleNumber(style, "sectionIsoLevelCount", 32))),
    ),
    sectionIsoLineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6),
    sectionIsoLineStyle:
      style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
    sectionIsoBandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32),
    sectionIsoFillOffset: styleNumber(style, "sectionIsoFillOffset", 0),
    sectionIsoSourceOpacity: styleNumber(style, "sectionIsoSourceOpacity", 0),
  };
}

export function seismicBrowserPatchFromStyle(
  style: EditableStyle,
  layer: ProjectLayerSpec,
): Partial<EditableStyle> {
  const products = seismicProductOptions(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  return {
    ...sectionIsoPatchFromStyle(style),
    seismicAudienceMode: seismicAudienceModeFromStyle(style),
    seismicAudiencePresetId:
      typeof style.seismicAudiencePresetId === "string"
        ? style.seismicAudiencePresetId
        : undefined,
    seismicCapabilityPresetId:
      typeof style.seismicCapabilityPresetId === "string"
        ? style.seismicCapabilityPresetId
        : undefined,
    seismicDisplayRecipeId:
      typeof style.seismicDisplayRecipeId === "string"
        ? style.seismicDisplayRecipeId
        : undefined,
    seismicProductId: productId,
    seismicProductVisibility: seismicProductVisibilityFromStyle(
      style,
      products,
      productId,
    ),
    seismicRenderMode:
      style.seismicRenderMode === "raymarch" ? "raymarch" : "slice",
    seismicSliceAxis:
      style.seismicSliceAxis === "crossline" ||
      style.seismicSliceAxis === "sample" ||
      style.seismicSliceAxis === "line"
        ? style.seismicSliceAxis
        : "inline",
    seismicSliceFraction: styleNumber(style, "seismicSliceFraction", 0.5),
    seismicAmplitudeMin: styleNumber(style, "seismicAmplitudeMin", 0.08),
    seismicAmplitudeMax: styleNumber(style, "seismicAmplitudeMax", 0.92),
    seismicAmplitudeGamma: styleNumber(style, "seismicAmplitudeGamma", 1),
    seismicColormap: seismicColormapFromValue(style.seismicColormap),
    seismicRemoveBackground: styleBoolean(
      style,
      "seismicRemoveBackground",
      false,
    ),
    seismicBackgroundCutoff: styleNumber(
      style,
      "seismicBackgroundCutoff",
      0.16,
    ),
    seismicVolumeSampleSteps: styleNumber(
      style,
      "seismicVolumeSampleSteps",
      96,
    ),
    seismicTimeScale: styleNumber(style, "seismicTimeScale", 2),
    seismicNavigationVisible: styleBoolean(
      style,
      "seismicNavigationVisible",
      true,
    ),
    seismicNavigationRoleVisibility:
      typeof style.seismicNavigationRoleVisibility === "object" &&
      style.seismicNavigationRoleVisibility !== null
        ? style.seismicNavigationRoleVisibility
        : { sources: true, receivers: true, lines: true },
    seismicSliceThroughVolume: styleBoolean(
      style,
      "seismicSliceThroughVolume",
      false,
    ),
    seismicComparisonProductId:
      typeof style.seismicComparisonProductId === "string"
        ? style.seismicComparisonProductId
        : undefined,
    seismicComparisonMode:
      style.seismicComparisonMode === "side-by-side"
        ? "side-by-side"
        : "overlay",
    seismicComparisonSpacingM: styleNumber(
      style,
      "seismicComparisonSpacingM",
      650,
    ),
    seismicExportLayoutId:
      typeof style.seismicExportLayoutId === "string"
        ? style.seismicExportLayoutId
        : undefined,
    seismicMtCoRender:
      style.seismicMtCoRender === "mt" ||
      style.seismicMtCoRender === "integrated"
        ? style.seismicMtCoRender
        : "seismic",
    seismicLegendVisible: styleBoolean(style, "seismicLegendVisible", true),
    sectionIsoMin: styleNumber(
      style,
      "sectionIsoMin",
      styleNumber(style, "seismicAmplitudeMin", 0.08),
    ),
    sectionIsoMax: styleNumber(
      style,
      "sectionIsoMax",
      styleNumber(style, "seismicAmplitudeMax", 0.92),
    ),
    opacity: styleNumber(style, "opacity", 0.62),
  };
}
