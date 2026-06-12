import type { EditableStyle, ProjectLayerSpec } from "../../../pages/types";
import { styleBoolean, styleNumber, styleString } from "../../styleControls";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "../scalarSourceRange";
export interface SeismicProductOption {
  id: string;
  label: string;
  sections?: SeismicProductSectionOption[];
  lineId?: string;
  lineLabel?: string;
  processingStage?: string;
  canonicalLabel?: string;
  nameEvidence?: {
    labelBasis?: string;
    sourceFileName?: string;
    sourceStem?: string;
    sourceSubmission?: string;
    sourceFile?: string;
    textHeaderExcerpt?: string;
  };
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

export interface SeismicProductSectionOption {
  id: string;
  axis?: string;
  fraction?: number;
}

export interface SeismicRequiredProductSourceGate {
  id: string;
  label: string;
  filename?: string;
  expectedBytes?: number;
  sourceSubmission?: string;
  sourceCitation?: string;
  downloadLandingPage?: string;
  sourceZipMember?: string;
  status?: string;
  reason?: string;
  error?: string;
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
  presentationBarVisible?: boolean;
  sliceThroughVolume?: boolean;
  comparisonProductId?: string;
  comparisonMode?: EditableStyle["seismicComparisonMode"];
  mtCoRender?: EditableStyle["seismicMtCoRender"];
  mtStylePatch?: Partial<EditableStyle>;
  linkedLayerStylePatches?: Record<string, Partial<EditableStyle>>;
  exportLayoutId?: string;
  capabilityGroup?: string;
  cameraShot?: string;
  badges?: string[];
  caveats?: string[];
  provenanceClassification?: string;
  provenanceNote?: string;
}

function linkedLayerStylePatchesFromValue(
  value: unknown,
): Record<string, Partial<EditableStyle>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const patches: Record<string, Partial<EditableStyle>> = {};
  for (const [layerId, patch] of Object.entries(value)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      continue;
    }
    patches[layerId] = patch as Partial<EditableStyle>;
  }
  return Object.keys(patches).length > 0 ? patches : undefined;
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

export const SEISMIC_VERTICAL_DATUM_MODE_OPTIONS = [
  { value: "source", label: "Source datum" },
  { value: "reference-1800m", label: "1800 m" },
  { value: "terrain-top-preview", label: "Terrain top" },
] as const satisfies readonly {
  value: NonNullable<EditableStyle["seismicVerticalDatumMode"]>;
  label: string;
}[];

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

export function seismicVerticalDatumModeFromStyle(
  style: EditableStyle,
): NonNullable<EditableStyle["seismicVerticalDatumMode"]> {
  return style.seismicVerticalDatumMode === "reference-1800m" ||
    style.seismicVerticalDatumMode === "terrain-top-preview"
    ? style.seismicVerticalDatumMode
    : "source";
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
      const canonicalLabel =
        typeof product.canonicalLabel === "string"
          ? seismicIndustryLabel(product.canonicalLabel)
          : undefined;
      return {
        id: product.id,
        label: canonicalLabel ?? seismicIndustryLabel(product.label),
        sections: Array.isArray(product.sections)
          ? product.sections
              .map((rawSection): SeismicProductSectionOption | null => {
                if (!rawSection || typeof rawSection !== "object") return null;
                const section = rawSection as Record<string, unknown>;
                if (typeof section.id !== "string") return null;
                return {
                  id: section.id,
                  axis:
                    typeof section.axis === "string"
                      ? section.axis
                      : undefined,
                  fraction:
                    typeof section.fraction === "number" &&
                    Number.isFinite(section.fraction)
                      ? section.fraction
                      : undefined,
                };
              })
              .filter(
                (section): section is SeismicProductSectionOption =>
                  section !== null,
              )
          : undefined,
        lineId:
          typeof product.lineId === "string" ? product.lineId : undefined,
        lineLabel:
          typeof product.lineLabel === "string" ? product.lineLabel : undefined,
        processingStage:
          typeof product.processingStage === "string"
            ? product.processingStage
            : undefined,
        canonicalLabel,
        nameEvidence:
          product.nameEvidence &&
          typeof product.nameEvidence === "object" &&
          !Array.isArray(product.nameEvidence)
            ? (product.nameEvidence as SeismicProductOption["nameEvidence"])
            : undefined,
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

export function seismicRequiredProductSourceGates(
  layer: ProjectLayerSpec,
): SeismicRequiredProductSourceGate[] {
  const rawGates = (layer.metadata as Record<string, unknown>)
    .seismicRequiredProductSourceGates;
  if (!Array.isArray(rawGates)) return [];
  return rawGates
    .map((raw): SeismicRequiredProductSourceGate | null => {
      if (!raw || typeof raw !== "object") return null;
      const gate = raw as Record<string, unknown>;
      if (typeof gate.id !== "string" || typeof gate.label !== "string") {
        return null;
      }
      return {
        id: gate.id,
        label: seismicIndustryLabel(gate.label),
        filename:
          typeof gate.filename === "string" ? gate.filename : undefined,
        expectedBytes:
          typeof gate.expectedBytes === "number"
            ? gate.expectedBytes
            : undefined,
        sourceSubmission:
          typeof gate.sourceSubmission === "string"
            ? gate.sourceSubmission
            : undefined,
        sourceCitation:
          typeof gate.sourceCitation === "string"
            ? gate.sourceCitation
            : undefined,
        downloadLandingPage:
          typeof gate.downloadLandingPage === "string"
            ? gate.downloadLandingPage
            : undefined,
        sourceZipMember:
          typeof gate.sourceZipMember === "string"
            ? gate.sourceZipMember
            : undefined,
        status: typeof gate.status === "string" ? gate.status : undefined,
        reason: typeof gate.reason === "string" ? gate.reason : undefined,
        error: typeof gate.error === "string" ? gate.error : undefined,
      };
    })
    .filter((gate): gate is SeismicRequiredProductSourceGate => gate !== null);
}

const SEISMIC_LINE_GROUP_ORDER = ["3d", "301", "302", "95", "L11", "L5"];

const SEISMIC_PROCESSING_STAGE_ORDER: Record<string, number> = {
  "psdm-depth-volume": 1,
  "pstm-time-volume": 2,
  "poststack-time-migration": 3,
  "migrated-depth-section": 10,
  "psdm-depth-section": 11,
  "pstm-time-stack": 12,
  "unmigrated-time-stack": 13,
  "time-stack": 14,
  "psdm-interval-velocity": 15,
  "velocity-model": 16,
};

const SEISMIC_PROCESSING_STAGE_LABELS: Record<string, string> = {
  "psdm-depth-volume": "PSDM depth volume",
  "pstm-time-volume": "PSTM time volume",
  "poststack-time-migration": "Post-stack migration",
  "migrated-depth-section": "Migrated depth",
  "psdm-depth-section": "PSDM depth",
  "pstm-time-stack": "PSTM time",
  "unmigrated-time-stack": "Unmigrated time",
  "time-stack": "Time stack",
  "psdm-interval-velocity": "PSDM interval velocity",
  "velocity-model": "Velocity model",
  "processed-section": "Processed section",
  "processed-volume": "Processed volume",
};

function seismicProductLineKey(product: SeismicProductOption): string {
  if (product.lineId) return product.lineId;
  if (product.navigationPlacement?.lineId) return product.navigationPlacement.lineId;
  return product.surveyKind === "3d" ? "3d" : "other";
}

function seismicProductGroupSortKey(key: string): number {
  const index = SEISMIC_LINE_GROUP_ORDER.indexOf(key);
  return index >= 0 ? index : 100;
}

export function seismicProcessingStageLabel(stage: string | undefined): string {
  if (!stage) return "Processed product";
  return (
    SEISMIC_PROCESSING_STAGE_LABELS[stage] ??
    stage.replace(/-/g, " ")
  );
}

export function seismicProductGroups(products: SeismicProductOption[]): {
  key: string;
  label: string;
  products: SeismicProductOption[];
}[] {
  const groups = new Map<string, SeismicProductOption[]>();
  for (const product of products) {
    const key = seismicProductLineKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const groupDelta =
        seismicProductGroupSortKey(a) - seismicProductGroupSortKey(b);
      return groupDelta !== 0 ? groupDelta : a.localeCompare(b);
    })
    .map(([key, groupProducts]) => ({
      key,
      label:
        groupProducts[0]?.lineLabel ??
        (key === "3d" ? "3D seismic products" : "Other seismic products"),
      products: groupProducts.sort((a, b) => {
        const stageDelta =
          (SEISMIC_PROCESSING_STAGE_ORDER[a.processingStage ?? ""] ?? 99) -
          (SEISMIC_PROCESSING_STAGE_ORDER[b.processingStage ?? ""] ?? 99);
        if (stageDelta !== 0) return stageDelta;
        return a.label.localeCompare(b.label);
      }),
    }));
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
      const linkedLayerStylePatches = linkedLayerStylePatchesFromValue(
        preset.linkedLayerStylePatches,
      );
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
        presentationBarVisible:
          typeof preset.presentationBarVisible === "boolean"
            ? preset.presentationBarVisible
            : undefined,
        sliceThroughVolume: preset.sliceThroughVolume === true,
        comparisonProductId:
          typeof preset.comparisonProductId === "string"
            ? preset.comparisonProductId
            : undefined,
        comparisonMode:
          preset.comparisonMode === "side-by-side" ? "side-by-side" : "overlay",
        mtCoRender,
        mtStylePatch,
        linkedLayerStylePatches,
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
        provenanceClassification:
          typeof preset.provenanceClassification === "string"
            ? preset.provenanceClassification
            : undefined,
        provenanceNote:
          typeof preset.provenanceNote === "string"
            ? preset.provenanceNote
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
    seismicPresentationBarVisible: preset.presentationBarVisible === true,
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

export const SEISMIC_SECTION_GRAPH_HEADINGS = [
  "3D Volume",
  "3D Section Plane",
  "2D Section Line",
  "Processing Comparison",
  "Integrated Geophysics",
  "Survey Geometry",
  "Figure Annotation",
] as const;

export type SeismicSectionGraphHeading =
  (typeof SEISMIC_SECTION_GRAPH_HEADINGS)[number];

export interface SeismicSectionGraphOption {
  id: string;
  label: string;
  heading: SeismicSectionGraphHeading;
  patch: Partial<EditableStyle>;
  mtStylePatch?: Partial<EditableStyle>;
  linkedLayerStylePatches?: Record<string, Partial<EditableStyle>>;
  disabled?: boolean;
}

export interface SeismicSectionGraphOptionGroup {
  heading: SeismicSectionGraphHeading;
  options: SeismicSectionGraphOption[];
}

export function seismicCapabilityPresetPatch(
  preset: SeismicAudiencePresetOption,
  products: SeismicProductOption[],
  fallbackProductId: string,
): Partial<EditableStyle> {
  const sectionPatch = { ...seismicPresetPatch(preset, products, fallbackProductId) };
  delete sectionPatch.seismicAudienceMode;
  delete sectionPatch.seismicAudiencePresetId;
  delete sectionPatch.seismicExportLayoutId;
  return {
    ...sectionPatch,
    seismicCapabilityPresetId: preset.id,
  };
}

function selectedProductVisibility(
  products: SeismicProductOption[],
  productId: string,
): Record<string, boolean> {
  return Object.fromEntries(
    products.map((product) => [product.id, product.id === productId]),
  );
}

function selectedProductIdForSectionOptions(
  style: EditableStyle,
  products: SeismicProductOption[],
  fallbackProductId: string,
): string {
  const rawProductId = styleString(style, "seismicProductId", fallbackProductId);
  return products.some((product) => product.id === rawProductId)
    ? rawProductId
    : fallbackProductId;
}

function productPatch(
  products: SeismicProductOption[],
  product: SeismicProductOption,
  patch: Partial<EditableStyle> = {},
): Partial<EditableStyle> {
  const renderMode =
    patch.seismicRenderMode ??
    (product.raymarchCapable === true ? "raymarch" : "slice");
  return {
    visible: true,
    seismicProductId: product.id,
    seismicProductVisibility: selectedProductVisibility(products, product.id),
    seismicRenderMode: renderMode,
    seismicSliceAxis: product.surveyKind === "3d" ? "inline" : "line",
    seismicSliceThroughVolume: false,
    seismicColormap: isVelocityProduct(product) ? "velocity" : undefined,
    ...patch,
  };
}

function optionFromPreset(
  heading: SeismicSectionGraphHeading,
  label: string,
  presetId: string,
  presets: SeismicAudiencePresetOption[],
  products: SeismicProductOption[],
  fallbackProductId: string,
): SeismicSectionGraphOption | null {
  const preset = presets.find((candidate) => candidate.id === presetId);
  if (!preset) return null;
  return {
    id: presetId,
    label,
    heading,
    patch: seismicCapabilityPresetPatch(preset, products, fallbackProductId),
    mtStylePatch: preset.mtStylePatch,
    linkedLayerStylePatches: preset.linkedLayerStylePatches,
  };
}

function firstProduct(
  products: SeismicProductOption[],
  predicate: (product: SeismicProductOption) => boolean,
): SeismicProductOption | undefined {
  return products.find(predicate);
}

function volumeOption(
  heading: SeismicSectionGraphHeading,
  label: string,
  products: SeismicProductOption[],
  predicate: (product: SeismicProductOption) => boolean,
  capabilityPresetId: string,
): SeismicSectionGraphOption | null {
  const product = firstProduct(products, predicate);
  if (!product) return null;
  return {
    id: capabilityPresetId,
    label,
    heading,
    patch: productPatch(products, product, {
      seismicCapabilityPresetId: capabilityPresetId,
      seismicRenderMode: product.raymarchCapable ? "raymarch" : "slice",
      seismicSliceAxis: "inline",
      seismicSliceThroughVolume: false,
    }),
  };
}

function lineOption(
  heading: SeismicSectionGraphHeading,
  label: string,
  lineId: string,
  kind: "depth" | "time" | "velocity",
  products: SeismicProductOption[],
): SeismicSectionGraphOption | null {
  const product = firstProduct(products, (candidate) => {
    const candidateLine =
      candidate.lineId ?? candidate.navigationPlacement?.lineId ?? "";
    if (candidateLine !== lineId) return false;
    if (kind === "velocity") return isVelocityProduct(candidate);
    if (isVelocityProduct(candidate)) return false;
    const stage = candidate.processingStage ?? "";
    const domain = candidate.domainKind ?? "";
    const unit = candidate.domainUnit ?? "";
    if (kind === "depth") {
      return (
        domain === "depth" ||
        unit === "m" ||
        stage.includes("depth") ||
        stage.includes("psdm")
      );
    }
    return (
      domain === "time" ||
      unit === "ms" ||
      stage.includes("time") ||
      stage.includes("pstm") ||
      stage.includes("unmigrated")
    );
  });
  if (!product) return null;
  return {
    id: `line-${lineId.toLowerCase()}-${kind}-sections`,
    label,
    heading,
    patch: productPatch(products, product, {
      seismicCapabilityPresetId: `line-${lineId.toLowerCase()}-${kind}-sections`,
      seismicRenderMode: "slice",
      seismicSliceAxis: "line",
      seismicSliceThroughVolume: false,
      seismicNavigationVisible: true,
    }),
  };
}

function sectionPlaneProduct(
  products: SeismicProductOption[],
  selectedProductId: string,
): SeismicProductOption | undefined {
  const selected = products.find((product) => product.id === selectedProductId);
  if (selected?.surveyKind === "3d") return selected;
  return (
    products.find((product) => product.surveyKind === "3d" && product.raymarchCapable) ??
    products.find((product) => product.surveyKind === "3d")
  );
}

const SECTION_LINE_OPTION_SPECS = [
  {
    lineId: "301",
    kind: "depth",
    label: "Line 301 depth sections",
  },
  {
    lineId: "301",
    kind: "time",
    label: "Line 301 time sections",
  },
  {
    lineId: "301",
    kind: "velocity",
    label: "Line 301 velocity section",
  },
  {
    lineId: "302",
    kind: "depth",
    label: "Line 302 depth sections",
  },
  {
    lineId: "302",
    kind: "time",
    label: "Line 302 time sections",
  },
  {
    lineId: "302",
    kind: "velocity",
    label: "Line 302 velocity section",
  },
  {
    lineId: "L5",
    kind: "depth",
    label: "Line L5 depth sections",
  },
  {
    lineId: "L5",
    kind: "time",
    label: "Line L5 time sections",
  },
  {
    lineId: "L5",
    kind: "velocity",
    label: "Line L5 velocity section",
  },
  {
    lineId: "L11",
    kind: "depth",
    label: "Line L11 depth sections",
  },
  {
    lineId: "L11",
    kind: "time",
    label: "Line L11 time sections",
  },
  {
    lineId: "L11",
    kind: "velocity",
    label: "Line L11 velocity section",
  },
] as const satisfies readonly {
  lineId: string;
  kind: "depth" | "time" | "velocity";
  label: string;
}[];

const SECTION_PROCESSING_COMPARISON_OPTION_SPECS = [
  {
    actionLabel: "301",
    label: "Line 301 enhanced vs unenhanced",
    capabilityPresetId: "enhanced-vs-unenhanced",
  },
  {
    actionLabel: "302",
    label: "Line 302 enhanced vs unenhanced",
    capabilityPresetId: "enhanced-vs-unenhanced-302",
  },
  {
    actionLabel: "L5",
    label: "Line L5 enhanced vs unenhanced",
    capabilityPresetId: "enhanced-vs-unenhanced-l5",
  },
  {
    actionLabel: "L11",
    label: "Line L11 enhanced vs unenhanced",
    capabilityPresetId: "enhanced-vs-unenhanced-l11",
  },
] as const;

const SECTION_SURVEY_GEOMETRY_ROLE_OPTION_SPECS = [
  {
    role: "sources",
    label: "Sources",
  },
  {
    role: "receivers",
    label: "Receivers",
  },
  {
    role: "lines",
    label: "Navigation lines",
  },
] as const satisfies readonly {
  role: "sources" | "receivers" | "lines";
  label: string;
}[];

export function seismicSectionGraphOptionGroups(
  layer: ProjectLayerSpec,
  style: EditableStyle,
): SeismicSectionGraphOptionGroup[] {
  const products = seismicProductOptions(layer);
  const presets = seismicCapabilityPresets(layer);
  const fallbackProductId = seismicDefaultProductId(layer);
  const selectedProductId = selectedProductIdForSectionOptions(
    style,
    products,
    fallbackProductId,
  );
  const active3dProduct = sectionPlaneProduct(products, selectedProductId);
  const selectedVisibility = active3dProduct
    ? selectedProductVisibility(products, active3dProduct.id)
    : {};
  const groups = new Map<SeismicSectionGraphHeading, SeismicSectionGraphOption[]>(
    SEISMIC_SECTION_GRAPH_HEADINGS.map((heading) => [heading, []]),
  );
  const push = (option: SeismicSectionGraphOption | null) => {
    if (!option) return;
    groups.get(option.heading)?.push(option);
  };

  push(
    optionFromPreset(
      "3D Volume",
      "PSDM depth volume",
      "3d-volume-psdm-depth",
      presets,
      products,
      fallbackProductId,
    ) ??
      volumeOption(
        "3D Volume",
        "PSDM depth volume",
        products,
        (product) => product.processingStage === "psdm-depth-volume",
        "3d-volume-psdm-depth",
      ),
  );
  push(
    optionFromPreset(
      "3D Volume",
      "Presentation-enhanced PSDM surrogate",
      "psdm-depth-surrogate-showcase",
      presets,
      products,
      fallbackProductId,
    ),
  );
  push(
    optionFromPreset(
      "3D Volume",
      "PSTM time volume",
      "3d-volume-pstm-time",
      presets,
      products,
      fallbackProductId,
    ) ??
      volumeOption(
        "3D Volume",
        "PSTM time volume",
        products,
        (product) => product.processingStage === "pstm-time-volume",
        "3d-volume-pstm-time",
      ),
  );
  push(
    optionFromPreset(
      "3D Volume",
      "FXY decon time volume",
      "3d-volume-fxydecon",
      presets,
      products,
      fallbackProductId,
    ) ??
      volumeOption(
        "3D Volume",
        "FXY decon time volume",
        products,
        (product) => product.processingStage === "poststack-time-migration",
        "3d-volume-fxydecon",
      ),
  );
  push(
    optionFromPreset(
      "3D Volume",
      "Velocity model",
      "3d-velocity-volume",
      presets,
      products,
      fallbackProductId,
    ) ??
      volumeOption(
        "3D Volume",
        "Velocity model",
        products,
        isVelocityProduct,
        "3d-velocity-volume",
      ),
  );

  if (active3dProduct) {
    for (const option of [
      {
        id: "inline-slice",
        label: "Inline slice",
        patch: {
          seismicSliceAxis: "inline" as const,
          seismicSliceThroughVolume: false,
        },
      },
      {
        id: "crossline-slice",
        label: "Crossline slice",
        patch: {
          seismicSliceAxis: "crossline" as const,
          seismicSliceThroughVolume: false,
        },
      },
      {
        id: "time-depth-plane",
        label: "Time/depth plane",
        patch: {
          seismicSliceAxis: "sample" as const,
          seismicSliceThroughVolume: false,
        },
      },
      {
        id: "volume-slice-sync",
        label: "Volume + synced slice",
        patch: {
          seismicRenderMode: "raymarch" as const,
          seismicSliceAxis:
            style.seismicSliceAxis === "crossline"
              ? ("crossline" as const)
              : ("inline" as const),
          seismicSliceThroughVolume: true,
        },
      },
    ]) {
      push({
        id: option.id,
        label: option.label,
        heading: "3D Section Plane",
        patch: {
          visible: true,
          seismicCapabilityPresetId: option.id,
          seismicProductId: active3dProduct.id,
          seismicProductVisibility: selectedVisibility,
          seismicRenderMode: "slice",
          ...option.patch,
        },
      });
    }
  }

  for (const option of SECTION_LINE_OPTION_SPECS) {
    push(
      lineOption(
        "2D Section Line",
        option.label,
        option.lineId,
        option.kind,
        products,
      ),
    );
  }

  const comparisonActions = seismicComparisonActions(products);
  for (const option of SECTION_PROCESSING_COMPARISON_OPTION_SPECS) {
    const action = comparisonActions.find(
      (candidate) => candidate.label === option.actionLabel,
    );
    if (!action) continue;
    push({
      id: `line-${action.label.toLowerCase()}-enhanced-vs-unenhanced`,
      label: option.label,
      heading: "Processing Comparison",
      patch: {
        visible: true,
        seismicCapabilityPresetId: option.capabilityPresetId,
        seismicProductId: action.primary,
        seismicProductVisibility: Object.fromEntries(
          products.map((product) => [
            product.id,
            product.id === action.primary || product.id === action.compare,
          ]),
        ),
        seismicRenderMode: "slice",
        seismicSliceAxis: "line",
        seismicComparisonProductId: action.compare,
        seismicComparisonMode:
          style.seismicComparisonMode === "side-by-side"
            ? "side-by-side"
            : "overlay",
      },
    });
  }

  push({
    id: "seismic-only",
    label: "Seismic only",
    heading: "Integrated Geophysics",
    patch: {
      seismicMtCoRender: "seismic",
      seismicProductVisibility:
        selectedProductId !== ""
          ? { ...selectedProductVisibility(products, selectedProductId) }
          : {},
    },
    mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
  });
  push({
    id: "mt-only",
    label: "MT only",
    heading: "Integrated Geophysics",
    patch: {
      seismicMtCoRender: "mt",
      seismicProductVisibility: Object.fromEntries(
        products.map((product) => [product.id, false]),
      ),
    },
    mtStylePatch: { opacity: 0.48, scalarLegendVisible: true },
  });
  push({
    id: "seismic-mt",
    label: "Seismic + MT",
    heading: "Integrated Geophysics",
    patch: {
      visible: true,
      seismicMtCoRender: "integrated",
      seismicProductVisibility:
        selectedProductId !== ""
          ? { ...selectedProductVisibility(products, selectedProductId) }
          : {},
    },
    mtStylePatch: { opacity: 0.36, scalarLegendVisible: true },
  });
  push(
    optionFromPreset(
      "Integrated Geophysics",
      "PSDM + MT + 58-32 tie",
      "psdm-mt-58-32-source-location-tie",
      presets,
      products,
      fallbackProductId,
    ),
  );
  push({
    id: "isoband-source-seismic-amplitude",
    label: "Isoband source: seismic amplitude",
    heading: "Integrated Geophysics",
    patch: { seismicIsoSource: "seismic-amplitude" },
  });
  push({
    id: "isoband-source-mt-resistivity",
    label: "Isoband source: MT resistivity",
    heading: "Integrated Geophysics",
    patch: { seismicIsoSource: "mt-resistivity" },
  });

  for (const option of SECTION_SURVEY_GEOMETRY_ROLE_OPTION_SPECS) {
    push({
      id: `survey-geometry-${option.role}`,
      label: option.label,
      heading: "Survey Geometry",
      patch: {
        seismicNavigationVisible: true,
        seismicNavigationRoleVisibility: {
          ...(typeof style.seismicNavigationRoleVisibility === "object" &&
          style.seismicNavigationRoleVisibility !== null
            ? style.seismicNavigationRoleVisibility
            : {}),
          [option.role]: true,
        },
      },
    });
  }

  push(
    optionFromPreset(
      "Survey Geometry",
      "Show survey geometry",
      "survey-geometry",
      presets,
      products,
      fallbackProductId,
    ) ?? {
      id: "show-survey-geometry",
      label: "Show survey geometry",
      heading: "Survey Geometry",
      patch: {
        seismicNavigationVisible: true,
        seismicNavigationRoleVisibility: {
          sources: true,
          receivers: true,
          lines: true,
        },
      },
    },
  );

  return SEISMIC_SECTION_GRAPH_HEADINGS.map((heading) => ({
    heading,
    options: groups.get(heading) ?? [],
  }));
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
    seismicIsoSource:
      style.seismicIsoSource === "mt-resistivity"
        ? "mt-resistivity"
        : "seismic-amplitude",
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
    seismicProductStates:
      typeof style.seismicProductStates === "object" &&
      style.seismicProductStates !== null
        ? style.seismicProductStates
        : undefined,
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
    seismicVerticalDatumMode: seismicVerticalDatumModeFromStyle(style),
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
    seismicPresentationBarVisible: styleBoolean(
      style,
      "seismicPresentationBarVisible",
      false,
    ),
    seismicFigureAnnotationsVisible: styleBoolean(
      style,
      "seismicFigureAnnotationsVisible",
      false,
    ),
    seismicFigureTitle:
      typeof style.seismicFigureTitle === "string"
        ? style.seismicFigureTitle
        : undefined,
    seismicFigureCaption:
      typeof style.seismicFigureCaption === "string"
        ? style.seismicFigureCaption
        : undefined,
    seismicFigureScaleLabel:
      typeof style.seismicFigureScaleLabel === "string"
        ? style.seismicFigureScaleLabel
        : undefined,
    seismicFigureTextColor: styleString(
      style,
      "seismicFigureTextColor",
      "#f7f7f2",
    ),
    seismicFigureAxisColor: styleString(
      style,
      "seismicFigureAxisColor",
      "#f7f7f2",
    ),
    seismicFigureCaptionBoxColor: styleString(
      style,
      "seismicFigureCaptionBoxColor",
      "#050505",
    ),
    seismicFigureCaptionBoxOpacity: styleNumber(
      style,
      "seismicFigureCaptionBoxOpacity",
      0.54,
    ),
    seismicFigureOutsideOffsetM: styleNumber(
      style,
      "seismicFigureOutsideOffsetM",
      240,
    ),
    seismicFigureLabelSizeM: styleNumber(
      style,
      "seismicFigureLabelSizeM",
      140,
    ),
    seismicFigureWellVisible: styleBoolean(
      style,
      "seismicFigureWellVisible",
      false,
    ),
    seismicFigureWellLabel:
      typeof style.seismicFigureWellLabel === "string"
        ? style.seismicFigureWellLabel
        : undefined,
    seismicFigureWellPosition: styleNumber(
      style,
      "seismicFigureWellPosition",
      0.5,
    ),
    seismicFigureWellColor: styleString(
      style,
      "seismicFigureWellColor",
      "#5875ff",
    ),
    seismicFigureHorizonVisible: styleBoolean(
      style,
      "seismicFigureHorizonVisible",
      false,
    ),
    seismicFigureHorizonPoints: Array.isArray(style.seismicFigureHorizonPoints)
      ? style.seismicFigureHorizonPoints
      : undefined,
    seismicFigureHorizonColor: styleString(
      style,
      "seismicFigureHorizonColor",
      "#ffcc33",
    ),
    graphAnnotationDefaults:
      typeof style.graphAnnotationDefaults === "object" &&
      style.graphAnnotationDefaults !== null
        ? style.graphAnnotationDefaults
        : undefined,
    graphAnnotationProfiles:
      typeof style.graphAnnotationProfiles === "object" &&
      style.graphAnnotationProfiles !== null
        ? style.graphAnnotationProfiles
        : undefined,
    graphAnnotationSelectedTargetKey:
      typeof style.graphAnnotationSelectedTargetKey === "string"
        ? style.graphAnnotationSelectedTargetKey
        : undefined,
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
