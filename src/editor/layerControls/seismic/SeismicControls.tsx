import { useEffect, useRef, useState } from "react";
import type React from "react";
import { panelStyles, vibrancyLabel, vibrancySecondaryLabel, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
  sliderNumberReadoutStyle,
  styleBoolean,
  styleNumber,
  styleString,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "../../styleControls";
import {
  compactCheckboxRowStyle,
  layerControlsStyle,
  layerItemStyle,
  miniGroupTitleStyle,
  smallActionButtonStyle,
} from "../layout/layoutStyles";
import { IsobandControls } from "../mt/MtControls";
import { editorLayerLabel } from "../layerLabels";
import {
  SCALAR_SOURCE_MAX,
  SCALAR_SOURCE_MIN,
} from "../scalarSourceRange";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../../projectModules/utahForge/layerIds";

interface SeismicProductOption {
  id: string;
  label: string;
  surveyKind?: string;
  productKind?: string;
  domainKind?: string;
  domainUnit?: string;
  sourceSubmission?: string;
  amplitudeStats?: {
    min?: number;
    max?: number;
    p02?: number;
    p98?: number;
    mean?: number;
  };
  raymarchCapable?: boolean;
}

interface SeismicAudiencePresetOption {
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

interface SeismicExportLayoutOption {
  id: string;
  label: string;
  output?: string;
  includes?: string[];
  caveat?: string;
}

const SEISMIC_AUDIENCE_MODE_OPTIONS = [
  { value: "investor", label: "Investor" },
  { value: "technical", label: "Technical" },
  { value: "data-room", label: "Data room" },
  { value: "export", label: "Export" },
] as const satisfies readonly {
  value: NonNullable<EditableStyle["seismicAudienceMode"]>;
  label: string;
}[];

const SEISMIC_DEMO_DISCLOSURE_LABELS = [
  "public geothermal demo data",
  "processed seismic product",
  "not a mineral resource estimate",
];

function seismicIndustryLabel(label: string): string {
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

function seismicColormapFromValue(
  value: unknown,
): NonNullable<EditableStyle["seismicColormap"]> {
  return value === "grayscale" || value === "velocity"
    ? value
    : "blue-white-red";
}

function isVelocityProduct(product: SeismicProductOption | undefined): boolean {
  return (
    product?.productKind === "velocity" ||
    product?.domainKind === "velocity-time"
  );
}

function seismicWindowValueLabel(
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

function seismicProductOptions(
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

function seismicAudiencePresets(
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

function seismicCapabilityPresets(
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

function seismicExportLayouts(
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

function seismicAudienceModeFromStyle(
  style: EditableStyle,
): NonNullable<EditableStyle["seismicAudienceMode"]> {
  return style.seismicAudienceMode === "technical" ||
    style.seismicAudienceMode === "data-room" ||
    style.seismicAudienceMode === "export"
    ? style.seismicAudienceMode
    : "investor";
}

function seismicPresetPatch(
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

function seismicDefaultProductId(layer: ProjectLayerSpec): string {
  const metadata = layer.metadata as Record<string, unknown>;
  if (typeof metadata.defaultSeismicProductId === "string") {
    return metadata.defaultSeismicProductId;
  }
  return seismicProductOptions(layer)[0]?.id ?? "";
}

function seismicProductVisibilityFromStyle(
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

function sectionIsoPatchFromStyle(
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

export function SeismicCapabilityLayerItem({
  title,
  type,
  testId,
  inactive = false,
  children,
}: {
  title: string;
  type: string;
  testId: string;
  inactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={layerItemStyle}
      data-dev-note="Virtual seismic capability container. Controls patch the one real Utah FORGE seismic layer."
    >
      <div style={panelStyles.sectionHeader}>
        <div style={panelStyles.checkboxRow}>
          <span
            style={{
              ...panelStyles.layerLabel,
              color: inactive ? vibrancyTertiaryLabel : vibrancyLabel,
            }}
          >
            {title}
          </span>
        </div>
        <span
          style={{
            ...panelStyles.layerType,
            color: inactive ? vibrancyTertiaryLabel : vibrancySecondaryLabel,
          }}
        >
          {type}
        </span>
      </div>
      <div style={layerControlsStyle}>{children}</div>
    </div>
  );
}

export function SceneSectionPlanesContainer({
  seismicLayer,
  allLayers,
  style,
  disabled,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  seismicLayer?: ProjectLayerSpec;
  allLayers: ProjectLayerSpec[];
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const products = seismicLayer ? seismicProductOptions(seismicLayer) : [];
  const defaultProductId = seismicLayer
    ? seismicDefaultProductId(seismicLayer)
    : (products[0]?.id ?? "");
  const enabled = styleBoolean(style, "sceneSectionEnabled", false);
  const mode = "cutaway";
  const targetScope =
    style.sceneSectionTargetScope === "all-visible" ||
    style.sceneSectionTargetScope === "active-selection"
      ? style.sceneSectionTargetScope
      : "selected-targets";
  const activeAxis =
    style.sceneSectionActiveAxis === "x" ||
    style.sceneSectionActiveAxis === "y" ||
    style.sceneSectionActiveAxis === "z"
      ? style.sceneSectionActiveAxis
      : "z";
  const planes = style.sceneSectionPlanes ?? {};
  const targetLayerIds = new Set(
    Array.isArray(style.sceneSectionTargetLayerIds)
      ? style.sceneSectionTargetLayerIds
        : [
            UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
            UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
            UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
          ],
  );
  const targetProductIds = new Set(
    Array.isArray(style.sceneSectionTargetProductIds)
      ? style.sceneSectionTargetProductIds
      : defaultProductId
        ? [defaultProductId]
        : [],
  );
  const helperVisible = styleBoolean(style, "sceneSectionHelperVisible", true);
  const legendVisible = styleBoolean(style, "sceneSectionLegendVisible", true);
  const windowEnabled = styleBoolean(style, "sceneSectionWindowEnabled", false);
  const groundTraceVisible = styleBoolean(
    style,
    "sceneSectionGroundTraceVisible",
    true,
  );
  const axesVisible = styleBoolean(style, "sceneSectionAxesVisible", true);
  const windowByAxis = style.sceneSectionWindowByAxis ?? {};
  const liveStyleRef = useRef(style);
  useEffect(() => {
    liveStyleRef.current = style;
  }, [style]);
  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    const merged = { ...liveStyleRef.current, ...patch };
    liveStyleRef.current = merged;
    sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged);
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, patch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        patch,
      );
    }
  };
  const setPlanePatch = (
    axis: "x" | "y" | "z",
    patch: { enabled?: boolean; positionM?: number; invert?: boolean },
  ) => {
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionPlanes: {
        ...planes,
        [axis]: {
          ...(planes[axis] ?? {}),
          ...patch,
        },
      },
    });
  };
  const setWindowPatch = (
    axis: "x" | "y",
    patch: { minAlongM?: number; maxAlongM?: number; bottomElevationM?: number },
  ) => {
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionWindowEnabled: true,
      sceneSectionWindowActiveAxis: axis,
      sceneSectionWindowByAxis: {
        ...windowByAxis,
        [axis]: {
          ...(windowByAxis[axis] ?? {}),
          ...patch,
        },
      },
    });
  };
  const toggleLayerTarget = (id: string, checked: boolean) => {
    const next = new Set(targetLayerIds);
    if (checked) next.add(id);
    else next.delete(id);
    commit({ sceneSectionTargetLayerIds: Array.from(next) });
  };
  const toggleProductTarget = (id: string, checked: boolean) => {
    const next = new Set(targetProductIds);
    if (checked) next.add(id);
    else next.delete(id);
    commit({ sceneSectionTargetProductIds: Array.from(next) });
  };
  const layerOptions = allLayers
    .filter((layer) =>
      [
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
        UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
        UTAH_FORGE_MT_STATIONS_LAYER_ID,
        "utah-forge-reference-stage",
      ].includes(layer.id),
    )
    .map((layer) => ({
      id: layer.id,
      label:
        layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
          ? "Seismic browser / survey geometry"
          : layer.id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID
            ? "3D MT resistivity volume"
            : layer.id === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID
              ? "3D MT threshold surfaces"
              : editorLayerLabel(layer),
      supported:
        layer.id !== UTAH_FORGE_MT_STATIONS_LAYER_ID ||
        targetScope === "all-visible",
    }));
  const axisRanges = {
    x: { min: -140000, max: 140000, label: "X Section" },
    y: { min: -115000, max: 115000, label: "Y Section" },
    z: { min: -122000, max: 4000, label: "Z Section" },
  } as const;
  const controlDisabled = disabled || !enabled;

  const renderAxis = (axis: "x" | "y" | "z") => {
    const plane = planes[axis] ?? {};
    const range = axisRanges[axis];
    const isActiveAxis = axis === activeAxis;
    const planeEnabled = plane.enabled === true;
    const position =
      typeof plane.positionM === "number" && Number.isFinite(plane.positionM)
        ? plane.positionM
        : axis === "x"
          ? -6000
          : axis === "y"
            ? -10300
            : -2200;
    const fill =
      ((position - range.min) / Math.max(1, range.max - range.min)) * 100;
    return (
      <details
        key={axis}
        style={nestedDetailsStyle}
        data-testid={`scene-section-plane-${axis}`}
      >
        <summary
          style={{
            ...panelStyles.summary,
            color: isActiveAxis
              ? vibrancySecondaryLabel
              : panelStyles.summary.color,
          }}
        >
          {range.label}
          {isActiveAxis ? " active" : ""}
        </summary>
        <div style={detailsContentStyle}>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Enabled</span>
            <input
              data-testid={`scene-section-plane-${axis}-enabled`}
              type="checkbox"
              disabled={disabled}
              checked={planeEnabled}
              onChange={(e) =>
                commit({
                  sceneSectionMode: "cutaway",
                  sceneSectionActiveAxis: axis,
                  sceneSectionPlanes: {
                    ...planes,
                    [axis]: {
                      ...(planes[axis] ?? {}),
                      enabled: e.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cut position</label>
            <input
              data-testid={`scene-section-plane-${axis}-position`}
              type="range"
              min={range.min}
              max={range.max}
              step={25}
              disabled={controlDisabled || !planeEnabled}
              value={position}
              onChange={(e) =>
                setPlanePatch(axis, { positionM: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${Math.max(0, Math.min(100, fill))}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {Math.round(position)} m
            </span>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Flip side</span>
            <input
              data-testid={`scene-section-plane-${axis}-invert`}
              type="checkbox"
              disabled={controlDisabled || !planeEnabled}
              checked={plane.invert === true}
              onChange={(e) =>
                setPlanePatch(axis, { invert: e.target.checked })
              }
            />
          </label>
          <button
            type="button"
            data-testid={`scene-section-plane-${axis}-active`}
            disabled={disabled}
            onClick={() => commit({ sceneSectionActiveAxis: axis })}
            style={smallActionButtonStyle}
          >
            Make active handle
          </button>
        </div>
      </details>
    );
  };

  return (
    <SeismicCapabilityLayerItem
      title="Scene section planes"
      type="section"
      testId="scene-section-planes-container"
    >
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Enabled</span>
          <input
            data-testid="scene-section-enabled"
            type="checkbox"
            disabled={disabled}
            checked={enabled}
            onChange={(e) =>
              commit({
                sceneSectionEnabled: e.target.checked,
                sceneSectionMode: "cutaway",
              })
            }
          />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Type</label>
          <select
            data-testid="scene-section-mode"
            disabled={disabled}
            value={mode}
            onChange={() =>
              commit({
                sceneSectionMode: "cutaway",
              })
            }
            style={{ flex: 1 }}
          >
            <option value="cutaway">Cutaway clip</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Targets</label>
          <select
            data-testid="scene-section-target-scope"
            disabled={disabled}
            value={targetScope}
            onChange={(e) =>
              commit({
                sceneSectionTargetScope:
                  e.target.value === "all-visible"
                    ? "all-visible"
                    : e.target.value === "active-selection"
                      ? "active-selection"
                      : "selected-targets",
              })
            }
            style={{ flex: 1 }}
          >
            <option value="selected-targets">Selected targets</option>
            <option value="all-visible">All visible</option>
            <option value="active-selection">Active selection</option>
          </select>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Gizmo</span>
          <input
            data-testid="scene-section-helper-visible"
            type="checkbox"
            disabled={disabled}
            checked={helperVisible}
            onChange={(e) =>
              commit({ sceneSectionHelperVisible: e.target.checked })
            }
          />
        </label>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Legend</span>
          <input
            data-testid="scene-section-legend-visible"
            type="checkbox"
            disabled={disabled}
            checked={legendVisible}
            onChange={(e) =>
              commit({ sceneSectionLegendVisible: e.target.checked })
            }
          />
        </label>
        <details style={nestedDetailsStyle} data-testid="scene-section-window">
          <summary style={panelStyles.summary}>MT section window</summary>
          <div style={detailsContentStyle}>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Window crop</span>
              <input
                data-testid="scene-section-window-enabled"
                type="checkbox"
                disabled={disabled}
                checked={windowEnabled}
                onChange={(e) =>
                  commit({ sceneSectionWindowEnabled: e.target.checked })
                }
              />
            </label>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Ground trace</span>
              <input
                data-testid="scene-section-ground-trace-visible"
                type="checkbox"
                disabled={disabled || !windowEnabled}
                checked={groundTraceVisible}
                onChange={(e) =>
                  commit({ sceneSectionGroundTraceVisible: e.target.checked })
                }
              />
            </label>
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Scale axes</span>
              <input
                data-testid="scene-section-axes-visible"
                type="checkbox"
                disabled={disabled || !windowEnabled}
                checked={axesVisible}
                onChange={(e) =>
                  commit({ sceneSectionAxesVisible: e.target.checked })
                }
              />
            </label>
            {(["x", "y"] as const).map((axis) => {
              const axisWindow = windowByAxis[axis] ?? {};
              const minLimit = axis === "x" ? -115000 : -140000;
              const maxLimit = axis === "x" ? 115000 : 140000;
              const minAlong =
                typeof axisWindow.minAlongM === "number" &&
                Number.isFinite(axisWindow.minAlongM)
                  ? axisWindow.minAlongM
                  : minLimit;
              const maxAlong =
                typeof axisWindow.maxAlongM === "number" &&
                Number.isFinite(axisWindow.maxAlongM)
                  ? axisWindow.maxAlongM
                  : maxLimit;
              const bottomElevation =
                typeof axisWindow.bottomElevationM === "number" &&
                Number.isFinite(axisWindow.bottomElevationM)
                  ? axisWindow.bottomElevationM
                  : -25000;
              const alongLabel =
                axis === "x" ? "Northing window" : "Easting window";
              return (
                <details
                  key={axis}
                  style={nestedDetailsStyle}
                  data-testid={`scene-section-window-${axis}`}
                >
                  <summary style={panelStyles.summary}>
                    {axis.toUpperCase()} section frame
                  </summary>
                  <div style={detailsContentStyle}>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>
                        {alongLabel} min
                      </label>
                      <input
                        data-testid={`scene-section-window-${axis}-min`}
                        type="range"
                        min={minLimit}
                        max={maxLimit}
                        step={100}
                        disabled={disabled || !windowEnabled}
                        value={minAlong}
                        onChange={(e) =>
                          setWindowPatch(axis, {
                            minAlongM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(minAlong)} m
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>
                        {alongLabel} max
                      </label>
                      <input
                        data-testid={`scene-section-window-${axis}-max`}
                        type="range"
                        min={minLimit}
                        max={maxLimit}
                        step={100}
                        disabled={disabled || !windowEnabled}
                        value={maxAlong}
                        onChange={(e) =>
                          setWindowPatch(axis, {
                            maxAlongM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {Math.round(maxAlong)} m
                      </span>
                    </div>
                    <div style={nestedControlRowStyle}>
                      <label style={nestedFieldLabelStyle}>Bottom elev.</label>
                      <input
                        data-testid={`scene-section-window-${axis}-bottom`}
                        type="range"
                        min={-122000}
                        max={4000}
                        step={100}
                        disabled={disabled || !windowEnabled}
                        value={bottomElevation}
                        onChange={(e) =>
                          setWindowPatch(axis, {
                            bottomElevationM: parseFloat(e.target.value),
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {(bottomElevation / 1000).toFixed(1)} km
                      </span>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </details>
        {(["x", "y", "z"] as const).map(renderAxis)}
        <details style={nestedDetailsStyle}>
          <summary style={panelStyles.summary}>Target checklist</summary>
          <div style={detailsContentStyle}>
            <div style={miniGroupTitleStyle}>Volume products</div>
            {products
              .filter((product) => product.raymarchCapable)
              .map((product) => (
                <label
                  key={product.id}
                  style={{ ...compactCheckboxRowStyle, cursor: "pointer" }}
                >
                  <input
                    data-testid={`scene-section-target-product-${product.id}`}
                    type="checkbox"
                    disabled={disabled || targetScope === "all-visible"}
                    checked={
                      targetScope === "all-visible" ||
                      targetProductIds.has(product.id)
                    }
                    onChange={(e) =>
                      toggleProductTarget(product.id, e.target.checked)
                    }
                  />
                  <span>{product.label}</span>
                </label>
              ))}
            <div style={miniGroupTitleStyle}>Scene layers</div>
            {layerOptions.map((layer) => (
              <label
                key={layer.id}
                style={{
                  ...compactCheckboxRowStyle,
                  cursor: layer.supported ? "pointer" : "not-allowed",
                  opacity: layer.supported ? 1 : 0.45,
                }}
              >
                <input
                  data-testid={`scene-section-target-layer-${layer.id}`}
                  type="checkbox"
                  disabled={
                    disabled ||
                    targetScope === "all-visible" ||
                    !layer.supported
                  }
                  checked={
                    targetScope === "all-visible" ||
                    targetLayerIds.has(layer.id)
                  }
                  onChange={(e) =>
                    toggleLayerTarget(layer.id, e.target.checked)
                  }
                />
                <span>{layer.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
    </SeismicCapabilityLayerItem>
  );
}

export function SeismicCapabilityLayerContainers({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const products = seismicProductOptions(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const selectedProduct = products.find((product) => product.id === productId);
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const requestedRenderMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedRenderMode === "raymarch" && selectedProduct?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    selectedProduct?.surveyKind !== "3d"
      ? "line"
      : style.seismicSliceAxis === "crossline" ||
          style.seismicSliceAxis === "sample"
        ? style.seismicSliceAxis
        : "inline";
  const sliceFraction = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicSliceFraction", 0.5)),
  );
  const amplitudeMin = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicAmplitudeMin", 0.08)),
  );
  const amplitudeMax = Math.max(
    amplitudeMin + 0.01,
    Math.min(1, styleNumber(style, "seismicAmplitudeMax", 0.92)),
  );
  const amplitudeGamma = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "seismicAmplitudeGamma", 1)),
  );
  const backgroundCutoff = Math.max(
    0,
    Math.min(0.45, styleNumber(style, "seismicBackgroundCutoff", 0.16)),
  );
  const volumeSampleSteps = Math.round(
    Math.max(
      24,
      Math.min(160, styleNumber(style, "seismicVolumeSampleSteps", 96)),
    ),
  );
  const seismicOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "opacity", 0.62)),
  );
  const timeScale = Math.max(
    0.25,
    Math.min(8, styleNumber(style, "seismicTimeScale", 2)),
  );
  const colormap = seismicColormapFromValue(style.seismicColormap);
  const removeBackground = styleBoolean(
    style,
    "seismicRemoveBackground",
    false,
  );
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";
  const comparisonSpacingM = Math.max(
    0,
    Math.min(3000, styleNumber(style, "seismicComparisonSpacingM", 650)),
  );
  const navigationVisible = styleBoolean(
    style,
    "seismicNavigationVisible",
    true,
  );
  const navigationRoleVisibility =
    typeof style.seismicNavigationRoleVisibility === "object" &&
    style.seismicNavigationRoleVisibility !== null
      ? style.seismicNavigationRoleVisibility
      : {};
  const navigationSourcesVisible = navigationRoleVisibility.sources !== false;
  const navigationReceiversVisible =
    navigationRoleVisibility.receivers !== false;
  const navigationLinesVisible = navigationRoleVisibility.lines !== false;
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  const controlOpacity = disabled ? 0.4 : 1;
  const liveSeismicStyleRef = useRef(style);
  useEffect(() => {
    liveSeismicStyleRef.current = style;
  }, [style]);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (targetLayerId === layerId) {
      const merged = { ...liveSeismicStyleRef.current, ...patch };
      liveSeismicStyleRef.current = merged;
      sceneHandle.manager.applyStyle(targetLayerId, merged);
    }
    if (isEnv) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(layerId, patch);
  };
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setCapabilityForProduct = (
    product: SeismicProductOption,
    mode: "slice" | "raymarch",
    syncSlice: boolean,
  ) => {
    const nextRenderMode =
      mode === "raymarch" && product.raymarchCapable ? "raymarch" : "slice";
    commit({
      seismicCapabilityPresetId: `${product.id}-${nextRenderMode}${
        syncSlice ? "-sync" : ""
      }`,
      seismicProductId: product.id,
      seismicProductVisibility: selectedOnlyVisibility(product.id),
      seismicRenderMode: nextRenderMode,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicSliceAxis:
        product.surveyKind === "3d"
          ? sliceAxis === "line"
            ? "inline"
            : sliceAxis
          : "line",
      seismicSliceThroughVolume:
        nextRenderMode === "raymarch" &&
        syncSlice &&
        product.raymarchCapable === true,
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: true,
        receivers: true,
        lines: true,
      },
    });
  };
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const setMtCoRender = (
    value: NonNullable<EditableStyle["seismicMtCoRender"]>,
  ) => {
    const mtPatch: Partial<EditableStyle> =
      value === "integrated"
        ? { opacity: 0.36, scalarLegendVisible: true }
        : value === "mt"
          ? { opacity: 0.48, scalarLegendVisible: true }
          : { opacity: 0.06, scalarLegendVisible: false };
    const seismicPatch: Partial<EditableStyle> = { seismicMtCoRender: value };
    if (value === "mt") {
      seismicPatch.seismicProductVisibility = Object.fromEntries(
        products.map((product) => [product.id, false]),
      );
    } else if (productId) {
      seismicPatch.seismicProductVisibility = {
        ...productVisibility,
        [productId]: true,
      };
    }
    commit(seismicPatch);
    commitLayerStyle(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, mtPatch);
  };
  const setNavigationRoleVisible = (
    role: "sources" | "receivers" | "lines",
    visible: boolean,
  ) => {
    commit({
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: navigationSourcesVisible,
        receivers: navigationReceiversVisible,
        lines: navigationLinesVisible,
        [role]: visible,
      },
    });
  };
  const comparisonActions = [
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
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const productControlActive = (product: SeismicProductOption) =>
    product.id === productId;

  const renderProductDisplayVariables = (product: SeismicProductOption) => {
    const windowMinLabel = isVelocityProduct(product) ? "Vel min" : "Amp min";
    const windowMaxLabel = isVelocityProduct(product) ? "Vel max" : "Amp max";
    return (
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Product variables</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Slice</label>
            <select
              data-testid={`seismic-capability-slice-axis-${product.id}`}
              value={productControlActive(product) ? sliceAxis : "inline"}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({
                  seismicSliceAxis: e.target.value as NonNullable<
                    EditableStyle["seismicSliceAxis"]
                  >,
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="inline">Inline</option>
              <option value="crossline">Crossline</option>
              <option value="sample">Time/depth plane</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Position</label>
            <input
              data-testid={`seismic-capability-slice-position-${product.id}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sliceFraction}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicSliceFraction: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${sliceFraction * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sliceFraction.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Opacity</label>
            <input
              data-testid={`seismic-capability-opacity-${product.id}`}
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={seismicOpacity}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${seismicOpacity * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicOpacity.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>{windowMinLabel}</label>
            <input
              data-testid={`seismic-capability-amplitude-min-${product.id}`}
              type="range"
              min={0}
              max={0.98}
              step={0.01}
              value={amplitudeMin}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${amplitudeMin * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(product, amplitudeMin)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>{windowMaxLabel}</label>
            <input
              data-testid={`seismic-capability-amplitude-max-${product.id}`}
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={amplitudeMax}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${amplitudeMax * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(product, amplitudeMax)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Gain curve</label>
            <input
              data-testid={`seismic-capability-amplitude-gamma-${product.id}`}
              type="range"
              min={0.35}
              max={2.5}
              step={0.05}
              value={amplitudeGamma}
              disabled={disabled || !productControlActive(product)}
              onInput={(e) =>
                commit({
                  seismicAmplitudeGamma: parseFloat(
                    (e.currentTarget as HTMLInputElement).value,
                  ),
                })
              }
              onChange={(e) =>
                commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${((amplitudeGamma - 0.35) / 2.15) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {amplitudeGamma.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Palette</label>
            <select
              data-testid={`seismic-capability-colormap-${product.id}`}
              value={colormap}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({
                  seismicColormap: seismicColormapFromValue(e.target.value),
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="blue-white-red">Blue-white-red</option>
              <option value="grayscale">Grayscale</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>White bg</span>
            <input
              data-testid={`seismic-capability-remove-background-${product.id}`}
              type="checkbox"
              checked={removeBackground}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicRemoveBackground: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              remove neutral fill
            </span>
          </label>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Zero mute</label>
            <input
              data-testid={`seismic-capability-background-cutoff-${product.id}`}
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={backgroundCutoff}
              disabled={
                disabled || !productControlActive(product) || !removeBackground
              }
              onChange={(e) =>
                commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity:
                    productControlActive(product) && removeBackground
                      ? controlOpacity
                      : 0.35,
                  "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {backgroundCutoff.toFixed(2)}
            </span>
          </div>
          {product.raymarchCapable ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Ray steps</label>
              <input
                data-testid={`seismic-capability-volume-sample-steps-${product.id}`}
                type="range"
                min={24}
                max={160}
                step={8}
                value={volumeSampleSteps}
                disabled={disabled || !productControlActive(product)}
                onInput={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(
                      (e.currentTarget as HTMLInputElement).value,
                    ),
                  })
                }
                onChange={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(e.target.value),
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: productControlActive(product)
                      ? controlOpacity
                      : 0.35,
                    "--editor-slider-fill": `${((volumeSampleSteps - 24) / 136) * 100}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
            </div>
          ) : null}
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Time scale</label>
            <input
              data-testid={`seismic-capability-time-scale-${product.id}`}
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={timeScale}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicTimeScale: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${((timeScale - 0.25) / 7.75) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
          </div>
        </div>
      </details>
    );
  };

  return (
    <>
      {raymarchProducts.map((product) => {
        const productVisible = productVisibility[product.id] === true;
        return (
          <SeismicCapabilityLayerItem
            key={product.id}
            testId={`seismic-capability-product-${product.id}`}
            title={product.label}
            type={isVelocityProduct(product) ? "3D velocity" : "3D seismic"}
            inactive={!productVisible}
          >
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Visible</span>
              <input
                data-testid={`seismic-capability-product-visible-${product.id}`}
                type="checkbox"
                checked={productVisible}
                disabled={disabled}
                onChange={(e) =>
                  setProductVisible(product.id, e.target.checked)
                }
                style={{ opacity: controlOpacity }}
              />
              <span
                style={{
                  flex: 1,
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  opacity: controlOpacity,
                }}
              >
                {productVisible
                  ? productControlActive(product)
                    ? renderMode === "raymarch"
                      ? "active volume"
                      : "active slice"
                    : (product.domainKind ?? "processed product")
                  : "inactive"}
              </span>
            </label>
            {productVisible ? (
              <>
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Render</summary>
                  <div style={detailsContentStyle}>
                    <div
                      style={{
                        ...nestedControlRowStyle,
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <label style={nestedFieldLabelStyle}>Mode</label>
                      {[
                        {
                          label: "Volume",
                          testId: `seismic-capability-volume-${product.id}`,
                          onClick: () =>
                            setCapabilityForProduct(product, "raymarch", false),
                        },
                        {
                          label: "Slice",
                          testId: `seismic-capability-slice-${product.id}`,
                          onClick: () =>
                            setCapabilityForProduct(product, "slice", false),
                        },
                        {
                          label: "Sync",
                          testId: `seismic-capability-sync-${product.id}`,
                          onClick: () =>
                            setCapabilityForProduct(product, "raymarch", true),
                        },
                      ].map((action) => (
                        <button
                          key={action.testId}
                          type="button"
                          data-testid={action.testId}
                          disabled={disabled}
                          onClick={action.onClick}
                          style={{
                            ...panelStyles.iconButton,
                            width: "auto",
                            padding: "3px 7px",
                            fontSize: 10,
                            opacity: controlOpacity,
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
                {renderProductDisplayVariables(product)}
              </>
            ) : null}
          </SeismicCapabilityLayerItem>
        );
      })}

      <SeismicCapabilityLayerItem
        testId="seismic-capability-line-theatre"
        title="2D / legacy section theatre"
        type="section"
      >
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Curtain</label>
          {[
            { id: "line-301-theatre", label: "Line 301" },
            { id: "line-302-theatre", label: "Line 302" },
            { id: "legacy-l5-l11-theatre", label: "L5 + L11" },
          ].map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid={`seismic-capability-${action.id}`}
              disabled={disabled}
              onClick={() => applyCapabilityPreset(action.id)}
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-processing-comparison"
        title="Processing comparison"
        type="comparison"
      >
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Mode</label>
          <select
            data-testid="seismic-comparison-mode-select"
            value={comparisonMode}
            disabled={disabled}
            onChange={(e) =>
              commit({
                seismicComparisonMode:
                  e.target.value === "side-by-side"
                    ? "side-by-side"
                    : "overlay",
              })
            }
            style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
          >
            <option value="overlay">Overlay</option>
            <option value="side-by-side">Side-by-side</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Spacing</label>
          <input
            data-testid="seismic-comparison-spacing"
            type="range"
            min={0}
            max={3000}
            step={50}
            value={comparisonSpacingM}
            disabled={disabled || comparisonMode !== "side-by-side"}
            onChange={(e) =>
              commit({ seismicComparisonSpacingM: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity:
                  comparisonMode === "side-by-side" ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(comparisonSpacingM / 3000) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {comparisonSpacingM.toFixed(0)} m
          </span>
        </div>
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Pair</label>
          {comparisonActions.map((action) => (
            <button
              key={action.label}
              type="button"
              data-testid={`seismic-comparison-pair-${action.label.toLowerCase()}`}
              disabled={disabled}
              onClick={() =>
                commit({
                  seismicCapabilityPresetId:
                    action.label === "301"
                      ? "enhanced-vs-unenhanced"
                      : `enhanced-vs-unenhanced-${action.label.toLowerCase()}`,
                  seismicProductId: action.primary,
                  seismicProductVisibility: Object.fromEntries(
                    products.map((product) => [
                      product.id,
                      product.id === action.primary ||
                        product.id === action.compare,
                    ]),
                  ),
                  seismicRenderMode: "slice",
                  seismicSliceAxis: "line",
                  seismicComparisonProductId: action.compare,
                  seismicComparisonMode: comparisonMode,
                })
              }
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-display-cleanup"
        title="Display cleanup"
        type="display"
      >
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Opacity</label>
          <input
            data-testid="seismic-capability-opacity"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={seismicOpacity}
            disabled={disabled}
            onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${seismicOpacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {seismicOpacity.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Palette</label>
          <select
            data-testid="seismic-capability-colormap-select"
            value={colormap}
            disabled={disabled}
            onChange={(e) =>
              commit({
                seismicColormap: seismicColormapFromValue(e.target.value),
              })
            }
            style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
          >
            <option value="blue-white-red">Blue-white-red</option>
            <option value="grayscale">Grayscale</option>
            <option value="velocity">Velocity</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Gain curve</label>
          <input
            data-testid="seismic-capability-amplitude-gamma"
            type="range"
            min={0.35}
            max={2.5}
            step={0.05}
            value={amplitudeGamma}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${((amplitudeGamma - 0.35) / 2.15) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {amplitudeGamma.toFixed(2)}
          </span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>White bg</span>
          <input
            data-testid="seismic-capability-remove-background"
            type="checkbox"
            checked={removeBackground}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicRemoveBackground: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              opacity: controlOpacity,
            }}
          >
            remove neutral fill
          </span>
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Zero mute</label>
          <input
            data-testid="seismic-capability-background-cutoff"
            type="range"
            min={0}
            max={0.45}
            step={0.01}
            value={backgroundCutoff}
            disabled={disabled || !removeBackground}
            onChange={(e) =>
              commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: removeBackground ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {backgroundCutoff.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Ray steps</label>
          <input
            data-testid="seismic-capability-volume-sample-steps"
            type="range"
            min={24}
            max={160}
            step={8}
            value={volumeSampleSteps}
            disabled={disabled || !selectedProduct?.raymarchCapable}
            onChange={(e) =>
              commit({ seismicVolumeSampleSteps: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: selectedProduct?.raymarchCapable
                  ? controlOpacity
                  : 0.35,
                "--editor-slider-fill": `${((volumeSampleSteps - 24) / 136) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-survey-geometry"
        title="Survey geometry"
        type="navigation"
      >
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Navigation</span>
          <input
            data-testid="seismic-navigation-visible-capability"
            type="checkbox"
            checked={navigationVisible}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicNavigationVisible: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Preset</label>
          <button
            type="button"
            data-testid="seismic-capability-survey-geometry-preset"
            disabled={disabled}
            onClick={() => applyCapabilityPreset("survey-geometry")}
            style={{
              ...panelStyles.iconButton,
              width: "auto",
              padding: "3px 7px",
              fontSize: 10,
              opacity: controlOpacity,
            }}
          >
            Show survey
          </button>
        </div>
        {[
          {
            role: "sources" as const,
            label: "Sources",
            checked: navigationSourcesVisible,
          },
          {
            role: "receivers" as const,
            label: "Receivers",
            checked: navigationReceiversVisible,
          },
          {
            role: "lines" as const,
            label: "Lines",
            checked: navigationLinesVisible,
          },
        ].map((item) => (
          <label
            key={item.role}
            style={{ ...nestedControlRowStyle, cursor: "pointer" }}
          >
            <span style={nestedFieldLabelStyle}>{item.label}</span>
            <input
              data-testid={`seismic-navigation-role-${item.role}`}
              type="checkbox"
              checked={item.checked}
              disabled={disabled}
              onChange={(e) =>
                setNavigationRoleVisible(item.role, e.target.checked)
              }
              style={{ opacity: controlOpacity }}
            />
            <span style={{ flex: 1 }} />
          </label>
        ))}
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-integrated-geophysics"
        title="Integrated geophysics"
        type="preset"
      >
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>View</label>
          {[
            {
              label: "Seismic",
              testId: "seismic-capability-seismic-only",
              onClick: () => setMtCoRender("seismic"),
            },
            {
              label: "MT",
              testId: "seismic-capability-mt-only",
              onClick: () => setMtCoRender("mt"),
            },
            {
              label: "Integrated",
              testId: "seismic-capability-integrated",
              onClick: () => applyCapabilityPreset("integrated-geophysics"),
            },
          ].map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              disabled={disabled}
              onClick={action.onClick}
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-data-confidence"
        title="Data confidence"
        type="metadata"
      >
        <div
          style={{
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          <div>Products: {products.length} processed GUI products</div>
          <div>3D raymarch-capable: {raymarchProducts.length}</div>
          <div>
            Active capability: {currentCapabilityPresetId || "manual controls"}
          </div>
          <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
        </div>
      </SeismicCapabilityLayerItem>
    </>
  );
}

export function SeismicBrowserControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  overridden,
  sceneSectionStyle,
  sceneHandle,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  overridden: boolean;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const products = seismicProductOptions(layer);
  const presets = seismicAudiencePresets(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
  const exportLayouts = seismicExportLayouts(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const selectedProduct = products.find((product) => product.id === productId);
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const visibleProductCount = products.filter(
    (product) => productVisibility[product.id] === true,
  ).length;
  const audienceMode = seismicAudienceModeFromStyle(style);
  const selectedPreset =
    presets.find((preset) => preset.id === style.seismicAudiencePresetId) ??
    presets.find((preset) => preset.audienceMode === audienceMode) ??
    presets[0];
  const requestedRenderMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedRenderMode === "raymarch" && selectedProduct?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    selectedProduct?.surveyKind !== "3d"
      ? "line"
      : style.seismicSliceAxis === "crossline" ||
          style.seismicSliceAxis === "sample"
        ? style.seismicSliceAxis
        : "inline";
  const sliceFraction = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicSliceFraction", 0.5)),
  );
  const amplitudeMin = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicAmplitudeMin", 0.08)),
  );
  const amplitudeMax = Math.max(
    amplitudeMin + 0.01,
    Math.min(1, styleNumber(style, "seismicAmplitudeMax", 0.92)),
  );
  const amplitudeGamma = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "seismicAmplitudeGamma", 1)),
  );
  const backgroundCutoff = Math.max(
    0,
    Math.min(0.45, styleNumber(style, "seismicBackgroundCutoff", 0.16)),
  );
  const volumeSampleSteps = Math.round(
    Math.max(
      24,
      Math.min(160, styleNumber(style, "seismicVolumeSampleSteps", 96)),
    ),
  );
  const timeScale = Math.max(
    0.25,
    Math.min(8, styleNumber(style, "seismicTimeScale", 2)),
  );
  const navigationVisible = styleBoolean(
    style,
    "seismicNavigationVisible",
    true,
  );
  const colormap = seismicColormapFromValue(style.seismicColormap);
  const removeBackground = styleBoolean(
    style,
    "seismicRemoveBackground",
    false,
  );
  const legendVisible = styleBoolean(style, "seismicLegendVisible", true);
  const sliceThroughVolume =
    selectedProduct?.raymarchCapable === true &&
    styleBoolean(style, "seismicSliceThroughVolume", false);
  const selectedProductVisible = productVisibility[productId] === true;
  const seismicOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "opacity", 0.62)),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const exportLayoutId =
    typeof style.seismicExportLayoutId === "string"
      ? style.seismicExportLayoutId
      : selectedPreset?.exportLayoutId;
  const selectedExportLayout = exportLayouts.find(
    (layout) => layout.id === exportLayoutId,
  );
  const disclosureLabels =
    selectedPreset?.badges && selectedPreset.badges.length > 0
      ? selectedPreset.badges
      : SEISMIC_DEMO_DISCLOSURE_LABELS;
  const mtCoRender =
    style.seismicMtCoRender === "mt" || style.seismicMtCoRender === "integrated"
      ? style.seismicMtCoRender
      : selectedPreset?.mtCoRender === "mt" ||
          selectedPreset?.mtCoRender === "integrated"
        ? selectedPreset.mtCoRender
        : "seismic";
  const comparisonProductId =
    typeof style.seismicComparisonProductId === "string"
      ? style.seismicComparisonProductId
      : selectedPreset?.comparisonProductId;
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";
  const comparisonSpacingM = Math.max(
    0,
    Math.min(3000, styleNumber(style, "seismicComparisonSpacingM", 650)),
  );
  const navigationRoleVisibility =
    typeof style.seismicNavigationRoleVisibility === "object" &&
    style.seismicNavigationRoleVisibility !== null
      ? style.seismicNavigationRoleVisibility
      : {};
  const navigationSourcesVisible = navigationRoleVisibility.sources !== false;
  const navigationReceiversVisible =
    navigationRoleVisibility.receivers !== false;
  const navigationLinesVisible = navigationRoleVisibility.lines !== false;
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (isEnv) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(layerId, patch);
  };
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setVisibilityForProducts = (
    predicate: (product: SeismicProductOption) => boolean,
  ) => {
    commit({
      seismicProductVisibility: Object.fromEntries(
        products.map((product) => [product.id, predicate(product)]),
      ),
    });
  };
  const setMtCoRender = (
    value: NonNullable<EditableStyle["seismicMtCoRender"]>,
  ) => {
    const mtPatch: Partial<EditableStyle> =
      value === "integrated"
        ? { opacity: 0.36, scalarLegendVisible: true }
        : value === "mt"
          ? { opacity: 0.48, scalarLegendVisible: true }
          : { opacity: 0.06, scalarLegendVisible: false };
    const seismicPatch: Partial<EditableStyle> = { seismicMtCoRender: value };
    if (value === "mt") {
      seismicPatch.seismicProductVisibility = Object.fromEntries(
        products.map((product) => [product.id, false]),
      );
    } else if (visibleProductCount === 0 && productId) {
      seismicPatch.seismicProductVisibility = {
        ...productVisibility,
        [productId]: true,
      };
    }
    commit(seismicPatch);
    commitLayerStyle(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, mtPatch);
  };
  const applyPreset = (presetId: string) => {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setCapabilityForProduct = (
    product: SeismicProductOption,
    mode: "slice" | "raymarch",
    syncSlice: boolean,
  ) => {
    if (!product.id) return;
    const renderMode =
      mode === "raymarch" && product.raymarchCapable ? "raymarch" : "slice";
    commit({
      seismicCapabilityPresetId: `${product.id}-${renderMode}${
        syncSlice ? "-sync" : ""
      }`,
      seismicProductId: product.id,
      seismicProductVisibility: selectedOnlyVisibility(product.id),
      seismicRenderMode: renderMode,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicSliceAxis:
        product.surveyKind === "3d"
          ? sliceAxis === "line"
            ? "inline"
            : sliceAxis
          : "line",
      seismicSliceThroughVolume:
        renderMode === "raymarch" &&
        syncSlice &&
        product.raymarchCapable === true,
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: true,
        receivers: true,
        lines: true,
      },
    });
  };
  const applyAudienceMode = (
    value: NonNullable<EditableStyle["seismicAudienceMode"]>,
  ) => {
    const preset = presets.find(
      (candidate) => candidate.audienceMode === value,
    );
    if (preset) {
      applyPreset(preset.id);
      return;
    }
    commit({ seismicAudienceMode: value });
  };
  const selectProduct = (id: string) => {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) return;
    const patch: Partial<EditableStyle> = {
      seismicProductId: id,
      seismicAudiencePresetId: undefined,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
    };
    if (!product.raymarchCapable && renderMode === "raymarch") {
      patch.seismicRenderMode = "slice";
      patch.seismicSliceThroughVolume = false;
    }
    if (product.surveyKind !== "3d") {
      patch.seismicSliceAxis = "line";
    } else if (sliceAxis === "line") {
      patch.seismicSliceAxis = "inline";
    }
    commit(patch);
  };
  const setComparisonProduct = (id: string) => {
    if (id === "none") {
      commit({ seismicComparisonProductId: undefined });
      return;
    }
    commit({
      seismicComparisonProductId: id,
      seismicComparisonMode: comparisonMode,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
      seismicRenderMode: "slice",
    });
  };
  const setNavigationRoleVisible = (
    role: "sources" | "receivers" | "lines",
    visible: boolean,
  ) => {
    commit({
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: navigationSourcesVisible,
        receivers: navigationReceiversVisible,
        lines: navigationLinesVisible,
        [role]: visible,
      },
    });
  };
  const productKindCounts = products.reduce<Record<string, number>>(
    (counts, product) => {
      const key = product.productKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const surveyCounts = products.reduce<Record<string, number>>(
    (counts, product) => {
      const key = product.surveyKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const lineTheatreActions = [
    { id: "line-301-theatre", label: "Line 301" },
    { id: "line-302-theatre", label: "Line 302" },
    { id: "legacy-l5-l11-theatre", label: "L5 + L11" },
  ];
  const comparisonActions = [
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
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Seismic browser</summary>
        <div style={detailsContentStyle}>
          {presets.length > 0 ? (
            <>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Audience</label>
                <select
                  data-testid="seismic-audience-mode-select"
                  value={audienceMode}
                  disabled={disabled}
                  onChange={(e) =>
                    applyAudienceMode(
                      e.target.value as NonNullable<
                        EditableStyle["seismicAudienceMode"]
                      >,
                    )
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {SEISMIC_AUDIENCE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Preset</label>
                <select
                  data-testid="seismic-audience-preset-select"
                  value={selectedPreset?.id ?? ""}
                  disabled={disabled}
                  onChange={(e) => applyPreset(e.target.value)}
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                data-testid="seismic-preset-summary"
                style={{
                  margin: "4px 0 8px 0",
                  padding: "2px 0 4px 0",
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  lineHeight: 1.35,
                  opacity: controlOpacity,
                }}
              >
                <div style={{ color: vibrancySecondaryLabel, fontWeight: 750 }}>
                  {selectedPreset?.summary ?? "Curated seismic demo view"}
                </div>
                <div style={{ marginTop: 4 }}>
                  {disclosureLabels.join(" / ")}
                </div>
                {selectedPreset?.cameraShot ? (
                  <div style={{ marginTop: 4 }}>
                    Camera shot: {selectedPreset.cameraShot}
                  </div>
                ) : null}
                {selectedPreset?.caveats &&
                selectedPreset.caveats.length > 0 ? (
                  <div style={{ marginTop: 4 }}>
                    {selectedPreset.caveats.slice(0, 2).join(" / ")}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Controls</label>
            {!isEnv ? (
              <input
                type="checkbox"
                checked={overridden}
                onChange={(e) => onToggleOverride?.(e.target.checked)}
                title="Override environment seismic browser variables for this page"
              />
            ) : null}
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              {selectedProductVisible
                ? selectedProduct?.raymarchCapable
                  ? "3D volume"
                  : "section curtain"
                : "hidden"}
            </span>
            {!isEnv ? (
              <span
                style={overridden ? overrideTagActiveStyle : overrideTagStyle}
              >
                {overridden ? "overridden" : "inherited"}
              </span>
            ) : null}
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>MT view</label>
            <select
              data-testid="seismic-mt-co-render-select"
              value={mtCoRender}
              disabled={disabled}
              onChange={(e) =>
                setMtCoRender(
                  e.target.value as NonNullable<
                    EditableStyle["seismicMtCoRender"]
                  >,
                )
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="seismic">Seismic only</option>
              <option value="mt">MT only</option>
              <option value="integrated">Integrated</option>
            </select>
          </div>

          {audienceMode === "data-room" ? (
            <div
              data-testid="seismic-data-room-summary"
              style={{
                margin: "4px 0 8px 0",
                padding: "2px 0 4px 0",
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              <div>Products: {products.length}</div>
              <div>
                Survey:{" "}
                {Object.entries(surveyCounts)
                  .map(([key, count]) => `${key} ${count}`)
                  .join(" / ")}
              </div>
              <div>
                Type:{" "}
                {Object.entries(productKindCounts)
                  .map(([key, count]) => `${key} ${count}`)
                  .join(" / ")}
              </div>
              <div>
                Selected: {selectedProduct?.sourceSubmission ?? "source"} /{" "}
                {selectedProduct?.productKind ?? "processed"} /{" "}
                {selectedProduct?.domainUnit ?? "domain"}
              </div>
              <div>
                Confidence: measured navigation / processed seismic product
              </div>
            </div>
          ) : null}

          {audienceMode === "export" ? (
            <div
              data-testid="seismic-export-summary"
              style={{
                margin: "4px 0 8px 0",
                padding: "2px 0 4px 0",
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Layout</label>
                <select
                  data-testid="seismic-export-layout-select"
                  value={exportLayoutId ?? ""}
                  disabled={disabled || exportLayouts.length === 0}
                  onChange={(e) =>
                    commit({ seismicExportLayoutId: e.target.value })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {exportLayouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {selectedExportLayout?.output ?? "PDF-ready report visual"}
              </div>
              <div>
                {(
                  selectedExportLayout?.includes ?? [
                    "legend",
                    "scale",
                    "CRS",
                    "source",
                  ]
                ).join(" / ")}
              </div>
              <div>
                {selectedExportLayout?.caveat ??
                  "Report-supporting visual, not a compliance certification."}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      {false ? (
        <>
          <details
            data-testid="seismic-capability-3d-products"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>3D volume products</summary>
            <div style={detailsContentStyle}>
              {raymarchProducts.map((product) => (
                <div
                  key={product.id}
                  style={{ ...nestedControlRowStyle, gap: 6 }}
                >
                  <label
                    style={{
                      ...nestedFieldLabelStyle,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={product.label}
                  >
                    {product.label}
                  </label>
                  {[
                    {
                      label: "Volume",
                      testId: `seismic-capability-volume-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "raymarch", false),
                    },
                    {
                      label: "Slice",
                      testId: `seismic-capability-slice-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "slice", false),
                    },
                    {
                      label: "Sync",
                      testId: `seismic-capability-sync-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "raymarch", true),
                    },
                  ].map((action) => (
                    <button
                      key={action.testId}
                      type="button"
                      data-testid={action.testId}
                      disabled={disabled}
                      onClick={action.onClick}
                      style={{
                        ...panelStyles.iconButton,
                        width: "auto",
                        padding: "3px 7px",
                        fontSize: 10,
                        opacity: controlOpacity,
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </details>

          <details
            data-testid="seismic-capability-slice-planes"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>3D slice planes</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Plane</label>
                {[
                  { id: "inline-slice", label: "Inline" },
                  { id: "crossline-slice", label: "Crossline" },
                  { id: "time-depth-plane", label: "Time/depth" },
                ].map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-testid={`seismic-capability-${action.id}`}
                    disabled={disabled}
                    onClick={() => applyCapabilityPreset(action.id)}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Position</label>
                <input
                  data-testid="seismic-capability-slice-position"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sliceFraction}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicSliceFraction: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${sliceFraction * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {sliceFraction.toFixed(2)}
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-volume-sync"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Volume + slice sync</summary>
            <div style={detailsContentStyle}>
              <div style={{ ...nestedControlRowStyle, gap: 6 }}>
                <label style={nestedFieldLabelStyle}>Synced view</label>
                <button
                  type="button"
                  data-testid="seismic-capability-volume-slice-sync"
                  disabled={disabled}
                  onClick={() => applyCapabilityPreset("volume-slice-sync")}
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "3px 7px",
                    fontSize: 10,
                    opacity: controlOpacity,
                  }}
                >
                  Apply
                </button>
                <span
                  style={{
                    flex: 1,
                    color: vibrancyTertiaryLabel,
                    fontSize: 11,
                    opacity: controlOpacity,
                  }}
                >
                  volume plus movable cut plane
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-line-theatre"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>
              2D / legacy section theatre
            </summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Curtain</label>
                {lineTheatreActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-testid={`seismic-capability-${action.id}`}
                    disabled={disabled}
                    onClick={() => applyCapabilityPreset(action.id)}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-processing-comparison"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Processing comparison</summary>
            <div style={detailsContentStyle}>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Mode</label>
                <select
                  data-testid="seismic-comparison-mode-select"
                  value={comparisonMode}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({
                      seismicComparisonMode:
                        e.target.value === "side-by-side"
                          ? "side-by-side"
                          : "overlay",
                    })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  <option value="overlay">Overlay</option>
                  <option value="side-by-side">Side-by-side</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Spacing</label>
                <input
                  data-testid="seismic-comparison-spacing"
                  type="range"
                  min={0}
                  max={3000}
                  step={50}
                  value={comparisonSpacingM}
                  disabled={disabled || comparisonMode !== "side-by-side"}
                  onChange={(e) =>
                    commit({
                      seismicComparisonSpacingM: parseFloat(e.target.value),
                    })
                  }
                  style={
                    {
                      flex: 1,
                      opacity:
                        comparisonMode === "side-by-side"
                          ? controlOpacity
                          : 0.35,
                      "--editor-slider-fill": `${(comparisonSpacingM / 3000) * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {comparisonSpacingM.toFixed(0)} m
                </span>
              </div>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Pair</label>
                {comparisonActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    data-testid={`seismic-comparison-pair-${action.label.toLowerCase()}`}
                    disabled={disabled}
                    onClick={() =>
                      commit({
                        seismicCapabilityPresetId:
                          action.label === "301"
                            ? "enhanced-vs-unenhanced"
                            : `enhanced-vs-unenhanced-${action.label.toLowerCase()}`,
                        seismicProductId: action.primary,
                        seismicProductVisibility: Object.fromEntries(
                          products.map((product) => [
                            product.id,
                            product.id === action.primary ||
                              product.id === action.compare,
                          ]),
                        ),
                        seismicRenderMode: "slice",
                        seismicSliceAxis: "line",
                        seismicComparisonProductId: action.compare,
                        seismicComparisonMode: comparisonMode,
                      })
                    }
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-display-cleanup"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Display cleanup</summary>
            <div style={detailsContentStyle}>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Opacity</label>
                <input
                  data-testid="seismic-capability-opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={seismicOpacity}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ opacity: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${seismicOpacity * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicOpacity.toFixed(2)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>
                  {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
                </label>
                <input
                  data-testid="seismic-capability-amplitude-min"
                  type="range"
                  min={0}
                  max={0.98}
                  step={0.01}
                  value={amplitudeMin}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${amplitudeMin * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>
                  {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
                </label>
                <input
                  data-testid="seismic-capability-amplitude-max"
                  type="range"
                  min={0.02}
                  max={1}
                  step={0.01}
                  value={amplitudeMax}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${amplitudeMax * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Palette</label>
                <select
                  data-testid="seismic-capability-colormap-select"
                  value={colormap}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({
                      seismicColormap: seismicColormapFromValue(e.target.value),
                    })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  <option value="blue-white-red">Blue-white-red</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="velocity">Velocity</option>
                </select>
              </div>
              <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                <span style={nestedFieldLabelStyle}>White bg</span>
                <input
                  data-testid="seismic-capability-remove-background"
                  type="checkbox"
                  checked={removeBackground}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicRemoveBackground: e.target.checked })
                  }
                  style={{ opacity: controlOpacity }}
                />
                <span
                  style={{
                    flex: 1,
                    color: vibrancyTertiaryLabel,
                    fontSize: 11,
                    opacity: controlOpacity,
                  }}
                >
                  remove neutral fill
                </span>
              </label>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Time scale</label>
                <input
                  data-testid="seismic-capability-time-scale"
                  type="range"
                  min={0.25}
                  max={8}
                  step={0.25}
                  value={timeScale}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicTimeScale: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${
                        ((timeScale - 0.25) / 7.75) * 100
                      }%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {timeScale.toFixed(2)}
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-survey-geometry"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Survey geometry</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Preset</label>
                <button
                  type="button"
                  data-testid="seismic-capability-survey-geometry-preset"
                  disabled={disabled}
                  onClick={() => applyCapabilityPreset("survey-geometry")}
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "3px 7px",
                    fontSize: 10,
                    opacity: controlOpacity,
                  }}
                >
                  Show survey
                </button>
              </div>
              {[
                {
                  role: "sources" as const,
                  label: "Sources",
                  checked: navigationSourcesVisible,
                },
                {
                  role: "receivers" as const,
                  label: "Receivers",
                  checked: navigationReceiversVisible,
                },
                {
                  role: "lines" as const,
                  label: "Lines",
                  checked: navigationLinesVisible,
                },
              ].map((item) => (
                <label
                  key={item.role}
                  style={{ ...nestedControlRowStyle, cursor: "pointer" }}
                >
                  <span style={nestedFieldLabelStyle}>{item.label}</span>
                  <input
                    data-testid={`seismic-navigation-role-${item.role}`}
                    type="checkbox"
                    checked={item.checked}
                    disabled={disabled}
                    onChange={(e) =>
                      setNavigationRoleVisible(item.role, e.target.checked)
                    }
                    style={{ opacity: controlOpacity }}
                  />
                  <span style={{ flex: 1 }} />
                </label>
              ))}
            </div>
          </details>

          <details
            data-testid="seismic-capability-integrated-geophysics"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Integrated geophysics</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>View</label>
                {[
                  {
                    label: "Seismic",
                    testId: "seismic-capability-seismic-only",
                    onClick: () => setMtCoRender("seismic"),
                  },
                  {
                    label: "MT",
                    testId: "seismic-capability-mt-only",
                    onClick: () => setMtCoRender("mt"),
                  },
                  {
                    label: "Integrated",
                    testId: "seismic-capability-integrated",
                    onClick: () =>
                      applyCapabilityPreset("integrated-geophysics"),
                  },
                ].map((action) => (
                  <button
                    key={action.testId}
                    type="button"
                    data-testid={action.testId}
                    disabled={disabled}
                    onClick={action.onClick}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-data-confidence"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Data confidence</summary>
            <div
              style={{
                ...detailsContentStyle,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
              }}
            >
              <div>Products: {products.length} processed GUI products</div>
              <div>3D raymarch-capable: {raymarchProducts.length}</div>
              <div>
                Active capability:{" "}
                {currentCapabilityPresetId || "manual controls"}
              </div>
              <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
            </div>
          </details>
        </>
      ) : null}

      <details
        data-testid="seismic-technical-controls"
        style={nestedDetailsStyle}
        open={technicalOpen}
        onToggle={(event) =>
          setTechnicalOpen((event.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary style={panelStyles.summary}>Technical controls</summary>
        <div style={detailsContentStyle}>
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>
              Product visibility ({visibleProductCount}/{products.length})
            </summary>
            <div style={detailsContentStyle}>
              <div
                style={{
                  ...nestedControlRowStyle,
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <label style={nestedFieldLabelStyle}>Visibility</label>
                {[
                  {
                    label: "Show all",
                    testId: "seismic-products-show-all",
                    onClick: () => setVisibilityForProducts(() => true),
                  },
                  {
                    label: "Hide all",
                    testId: "seismic-products-hide-all",
                    onClick: () => setVisibilityForProducts(() => false),
                  },
                  {
                    label: "3D only",
                    testId: "seismic-products-show-3d-only",
                    onClick: () =>
                      setVisibilityForProducts(
                        (product) => product.surveyKind === "3d",
                      ),
                  },
                  {
                    label: "2D only",
                    testId: "seismic-products-show-2d-only",
                    onClick: () =>
                      setVisibilityForProducts(
                        (product) => product.surveyKind !== "3d",
                      ),
                  },
                ].map((action) => (
                  <button
                    key={action.testId}
                    type="button"
                    data-testid={action.testId}
                    disabled={disabled}
                    onClick={action.onClick}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {products.map((product) => {
                const selected = product.id === productId;
                return (
                  <div
                    key={product.id}
                    style={{
                      ...nestedControlRowStyle,
                      borderRadius: 6,
                      background: selected
                        ? "rgba(244, 240, 232, 0.08)"
                        : "transparent",
                    }}
                  >
                    <input
                      data-testid={`seismic-product-visible-${product.id}`}
                      type="checkbox"
                      checked={productVisibility[product.id] === true}
                      disabled={disabled}
                      onChange={(e) =>
                        setProductVisible(product.id, e.target.checked)
                      }
                      title="Show or hide this product"
                      style={{ opacity: controlOpacity }}
                    />
                    <button
                      type="button"
                      data-testid={`seismic-product-row-${product.id}`}
                      disabled={disabled}
                      onClick={() => selectProduct(product.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: selected ? vibrancyLabel : vibrancyTertiaryLabel,
                        font: "inherit",
                        fontSize: 11,
                        fontWeight: selected ? 800 : 650,
                        textAlign: "left",
                        cursor: disabled ? "default" : "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        opacity: controlOpacity,
                      }}
                      title={product.label}
                    >
                      {product.label}
                    </button>
                    <span
                      style={{
                        color: vibrancyTertiaryLabel,
                        fontSize: 11,
                        opacity: controlOpacity,
                        minWidth: 54,
                        textAlign: "right",
                      }}
                    >
                      {product.raymarchCapable
                        ? "3D"
                        : (product.surveyKind ?? "2D")}
                      {product.domainUnit ? ` / ${product.domainUnit}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Product</label>
            <select
              data-testid="seismic-product-select"
              value={productId}
              disabled={disabled || products.length === 0}
              onChange={(e) => selectProduct(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Compare</label>
            <select
              data-testid="seismic-comparison-product-select"
              value={comparisonProductId ?? "none"}
              disabled={disabled}
              onChange={(e) => setComparisonProduct(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="none">None</option>
              {products
                .filter((product) => product.id !== productId)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mode</label>
            <select
              data-testid="seismic-render-mode-select"
              value={renderMode}
              disabled={disabled || !selectedProduct?.raymarchCapable}
              onChange={(e) =>
                commit({
                  seismicRenderMode:
                    e.target.value === "raymarch" ? "raymarch" : "slice",
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="slice">Slice</option>
              {selectedProduct?.raymarchCapable ? (
                <option value="raymarch">Raymarch</option>
              ) : null}
            </select>
          </div>

          {selectedProduct?.raymarchCapable ? (
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Sync slice</span>
              <input
                data-testid="seismic-slice-through-volume"
                type="checkbox"
                checked={sliceThroughVolume}
                disabled={disabled}
                onChange={(e) =>
                  commit({ seismicSliceThroughVolume: e.target.checked })
                }
                style={{ opacity: controlOpacity }}
              />
              <span
                style={{
                  flex: 1,
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  opacity: controlOpacity,
                }}
              >
                through volume
              </span>
            </label>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Slice</label>
            <select
              data-testid="seismic-slice-axis-select"
              value={sliceAxis}
              disabled={
                disabled || (renderMode === "raymarch" && !sliceThroughVolume)
              }
              onChange={(e) =>
                commit({
                  seismicSliceAxis: e.target.value as NonNullable<
                    EditableStyle["seismicSliceAxis"]
                  >,
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {selectedProduct?.surveyKind === "3d" ? (
                <>
                  <option value="inline">Inline</option>
                  <option value="crossline">Crossline</option>
                  <option value="sample">Time/depth plane</option>
                </>
              ) : (
                <option value="line">2D line</option>
              )}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Position</label>
            <input
              data-testid="seismic-slice-fraction"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sliceFraction}
              disabled={
                disabled || (renderMode === "raymarch" && !sliceThroughVolume)
              }
              onChange={(e) =>
                commit({ seismicSliceFraction: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${sliceFraction * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sliceFraction.toFixed(2)}
            </span>
          </div>

          <IsobandControls
            style={style}
            disabled={disabled}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            rangeKind="seismic"
            volumePlanes={
              selectedProduct?.raymarchCapable === true &&
              renderMode === "raymarch"
            }
            sceneSectionStyle={sceneSectionStyle}
            sceneHandle={sceneHandle}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
          />

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
            </label>
            <input
              data-testid="seismic-amplitude-min"
              type="range"
              min={0}
              max={0.98}
              step={0.01}
              value={amplitudeMin}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${amplitudeMin * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
            </label>
            <input
              data-testid="seismic-amplitude-max"
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={amplitudeMax}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${amplitudeMax * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Gain curve</label>
            <input
              data-testid="seismic-amplitude-gamma"
              type="range"
              min={0.35}
              max={2.5}
              step={0.05}
              value={amplitudeGamma}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${
                    ((amplitudeGamma - 0.35) / 2.15) * 100
                  }%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {amplitudeGamma.toFixed(2)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Palette</label>
            <select
              data-testid="seismic-colormap-select"
              value={colormap}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  seismicColormap: seismicColormapFromValue(e.target.value),
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="blue-white-red">Blue-white-red</option>
              <option value="grayscale">Grayscale</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Legend</span>
            <input
              data-testid="seismic-legend-visible"
              type="checkbox"
              checked={legendVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicLegendVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              amplitude controls
            </span>
          </label>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>White bg</span>
            <input
              data-testid="seismic-remove-background"
              type="checkbox"
              checked={removeBackground}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicRemoveBackground: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              remove neutral fill
            </span>
          </label>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Zero mute</label>
            <input
              data-testid="seismic-background-cutoff"
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={backgroundCutoff}
              disabled={disabled || !removeBackground}
              onChange={(e) =>
                commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: removeBackground ? controlOpacity : 0.35,
                  "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {backgroundCutoff.toFixed(2)}
            </span>
          </div>

          {selectedProduct?.raymarchCapable ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Ray steps</label>
              <input
                data-testid="seismic-volume-sample-steps"
                type="range"
                min={24}
                max={160}
                step={8}
                value={volumeSampleSteps}
                disabled={disabled}
                onChange={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(e.target.value),
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${
                      ((volumeSampleSteps - 24) / 136) * 100
                    }%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
            </div>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Time scale</label>
            <input
              data-testid="seismic-time-scale"
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={timeScale}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicTimeScale: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${
                    ((timeScale - 0.25) / 7.75) * 100
                  }%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
          </div>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Navigation</span>
            <input
              data-testid="seismic-navigation-visible"
              type="checkbox"
              checked={navigationVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicNavigationVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              source/receiver lines
            </span>
          </label>
        </div>
      </details>
    </>
  );
}
