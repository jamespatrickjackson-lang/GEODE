import { useState, type CSSProperties, type ReactNode } from "react";
import { convertBrandingAsset, writeFile } from "../save";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssaySummaryStyle,
  EditorEyeButton,
  EnvSelectRow,
  EnvStyleRow,
  EnvVisibilityRow,
  EzGammaCheckboxRow,
  LayerBooleanStyleControl,
  LayerColorStyleControl,
  LayerNumberStyleControl,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  PageVisibilityRow,
  type LayerStyleSetter,
  type PageStyleClearer,
  type PageStyleSetter,
} from "../styleControls";
import {
  panelStyles,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "../styles";
import { effectiveStyle, isVisibilityOverridden } from "../../pages/effective";
import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  ProjectLayerSpec,
  SceneProperties,
} from "../../pages/types";
import {
  ORTHO_PHOTO_TEXTURE_BUDGETS,
  SURFACE_ELEVATION_DEFAULT_BLEND,
  SURFACE_ELEVATION_DEFAULT_MAX_M,
  SURFACE_ELEVATION_DEFAULT_MIN_M,
  SURFACE_ELEVATION_DEFAULT_SOFTNESS,
  SURFACE_ELEVATION_STOP_GAP,
  TOPO_MAP_BRANDING_DEFAULT_ANCHOR,
  TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M,
  TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M,
  TOPO_MAP_SURFACE_LABEL,
  isImageBackedTopoMaterialPreset,
  orthoPhotoDefaultPatch,
  surfaceElevationColorsFromTerrain,
  surfaceElevationDefaultPatch,
  surfaceElevationGradientCss,
  surfaceElevationMidpointsFromTerrain,
  surfaceElevationPositionsFromTerrain,
  surfaceElevationTickLabel,
  topoImageMaterialDefaultPatch,
  topoImageMaterialSourceForPreset,
  topoMapPresetPatch,
  topoMapPresetSurfaceStylePatch,
  type OrthoPhotoTextureBudgetId,
  type PublicTopoMaterialPresetId,
  type ResolvedTopoMapSettings,
} from "../../topoMap/settings";
import { editorLayerTypeLabel } from "../layerControls/layerLabels";
import { useTopoGradientHandles } from "./useTopoGradientHandles";

const CLASSIFICATIONS = [
  "observation",
  "interpretation",
  "narrative",
  "planned",
] as const;
const CONFIDENTIALITIES = ["public", "private"] as const;
const TITLE_BLOCK_UPLOAD_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.eps,image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,application/postscript";
const TITLE_BLOCK_DIRECT_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
]);
const TITLE_BLOCK_CONVERTED_EXTENSIONS = new Set(["pdf", "eps"]);
const DEFAULT_FOG_DENSITY = 0.00018;

const topoGraticuleSubheaderStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#ffffff",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginTop: 12,
  marginBottom: 6,
};

const topoSubheadingRowStyle: CSSProperties = {
  ...topoGraticuleSubheaderStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minHeight: 28,
  padding: "2px 8px 2px 0",
  boxSizing: "border-box",
};

const topoSubheadingLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const topoSubsectionDetailsStyle: CSSProperties = {
  margin: "8px 0 10px",
};

const topoSubsectionContentStyle: CSSProperties = {
  ...detailsContentStyle,
  paddingTop: 2,
};

const topoInlineActionRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const topoInlineActionButtonStyle: CSSProperties = {
  flex: "1 1 150px",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  color: vibrancySecondaryLabel,
  font: "inherit",
  padding: "5px 8px",
  cursor: "pointer",
};

const topoClipReadoutStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 6,
  padding: "7px 8px",
  color: vibrancySecondaryLabel,
  background: "rgba(255, 255, 255, 0.04)",
  lineHeight: 1.35,
};

type TerrainSettings = NonNullable<SceneProperties["terrain"]>;
type TopoMapBranding = NonNullable<TerrainSettings["topoMapBranding"]>;
type LayerProvenancePatch = Partial<
  Record<
    | "sourceFile"
    | "sourceDate"
    | "sourceOrigin"
    | "classification"
    | "confidentiality",
    string
  >
>;
type TopoMapPanelSection = "all" | "surface" | "graticule" | "title";

function TopoSubsection({
  label,
  children,
  active,
  onToggle,
  testId,
  defaultOpen = true,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  onToggle?: () => void;
  testId?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      style={topoSubsectionDetailsStyle}
      data-testid={testId}
    >
      <summary
        style={{
          ...topoSubheadingRowStyle,
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <span style={topoSubheadingLabelStyle}>{label}</span>
        {onToggle ? (
          <EditorEyeButton
            visible={active !== false}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggle();
            }}
            title={active !== false ? `Hide ${label}` : `Show ${label}`}
            ariaLabel={active !== false ? `Hide ${label}` : `Show ${label}`}
            style={{ marginLeft: "auto" }}
          />
        ) : null}
      </summary>
      <div style={topoSubsectionContentStyle}>{children}</div>
    </details>
  );
}

function TopoEyeToggleRow({
  label,
  checked,
  onChange,
  testId,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
  title?: string;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <EditorEyeButton
        visible={checked}
        onClick={() => onChange(!checked)}
        title={title ?? (checked ? `Hide ${label}` : `Show ${label}`)}
        ariaLabel={title ?? (checked ? `Hide ${label}` : `Show ${label}`)}
        testId={testId}
        style={{ marginLeft: "auto" }}
      />
    </div>
  );
}

export function TopoMapPanel({
  settings,
  section = "all",
  nestedContainers = true,
  environment,
  scene,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  setEnvScene,
  projectRoot,
  terrainEnvVisible,
  terrainEffectiveVisible,
  toggleTerrainEnvVisible,
  setPageTerrainVisible,
  clearPageTerrainVisible,
  toggleEnvDefaultVisible,
  setPageVisibilityOverride,
  clearPageVisibilityOverride,
  publicSurfaceLayerIds,
  setLayerProvenance,
}: {
  settings: ResolvedTopoMapSettings;
  section?: TopoMapPanelSection;
  nestedContainers?: boolean;
  environment: EnvironmentSetup;
  scene: SceneProperties;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
  projectRoot: string;
  terrainEnvVisible: boolean;
  terrainEffectiveVisible: boolean;
  toggleTerrainEnvVisible: () => void;
  setPageTerrainVisible: (visible: boolean) => void;
  clearPageTerrainVisible: () => void;
  toggleEnvDefaultVisible: (layerId: string) => void;
  setPageVisibilityOverride: (
    pageId: string,
    layerId: string,
    visible: boolean,
  ) => void;
  clearPageVisibilityOverride: (pageId: string, layerId: string) => void;
  publicSurfaceLayerIds: readonly string[];
  setLayerProvenance: (layerId: string, patch: LayerProvenancePatch) => void;
}) {
  const rawTerrain = scene.terrain ?? {};
  const terrain = settings.terrain;
  const style = settings.surfaceStyle;
  const terrainLayer = settings.surfaceLayer;
  const graticuleLayer = settings.graticuleLayers[0] ?? null;
  const layerId = settings.surfaceLayerId;
  const [brandingUploadError, setBrandingUploadError] = useState<string | null>(
    null,
  );
  const [brandingUploading, setBrandingUploading] = useState(false);
  const setTerrain = (patch: TerrainSettings) => {
    setEnvScene({ terrain: patch });
  };
  const layerControlProps = {
    style,
    isEnv,
    currentPage,
    layerId,
    setEnvLayerStyle,
    setPageLayerOverride,
    clearPageLayerOverride,
  };
  const sceneFog = scene.fog ?? {};
  const sceneFogEnabled = sceneFog.enabled !== false;
  const sceneFogDensity = sceneFog.density ?? DEFAULT_FOG_DENSITY;
  const sceneFogReachKm = 3 / Math.max(sceneFogDensity, 0.000001) / 1000;
  const sceneSun = scene.sun ?? {};
  const sunAzimuth = sceneSun.azimuth ?? 235;
  const sunElevation = sceneSun.elevation ?? 22;
  const sceneFogGradientCurve =
    typeof rawTerrain.fogGradientCurve === "number"
      ? rawTerrain.fogGradientCurve
      : 1;
  const topoFogDensity =
    typeof style.fogDensity === "number" ? style.fogDensity : sceneFogDensity;
  const topoFogReachKm = 3 / Math.max(topoFogDensity, 0.000001) / 1000;
  const topoFogIncluded = style.affectedByFog !== false;
  const mapSunReliefActive = (terrain.hillshadeIntensity ?? 1.05) > 0;
  const surfaceElevationMinM =
    typeof terrain.surfaceElevationMinM === "number"
      ? terrain.surfaceElevationMinM
      : SURFACE_ELEVATION_DEFAULT_MIN_M;
  const surfaceElevationMaxM =
    typeof terrain.surfaceElevationMaxM === "number"
      ? terrain.surfaceElevationMaxM
      : SURFACE_ELEVATION_DEFAULT_MAX_M;
  const surfaceElevationColors = surfaceElevationColorsFromTerrain(terrain);
  const surfaceElevationPositions =
    surfaceElevationPositionsFromTerrain(terrain);
  const surfaceElevationMidpoints =
    surfaceElevationMidpointsFromTerrain(terrain);
  const surfaceElevationTransitionSoftness =
    typeof terrain.surfaceElevationTransitionSoftness === "number"
      ? terrain.surfaceElevationTransitionSoftness
      : SURFACE_ELEVATION_DEFAULT_SOFTNESS;
  const surfaceElevationColorBlend =
    typeof terrain.surfaceElevationColorBlend === "number"
      ? terrain.surfaceElevationColorBlend
      : SURFACE_ELEVATION_DEFAULT_BLEND;
  const surfaceElevationGradient = surfaceElevationGradientCss(
    surfaceElevationColors,
    surfaceElevationPositions,
    surfaceElevationMidpoints,
  );
  const edgeFadeShape =
    terrain.edgeFadeShape === "rounded-square" ||
    terrain.edgeFadeShape === "circle"
      ? terrain.edgeFadeShape
      : "square";
  const topoMapBranding = terrain.topoMapBranding ?? {};
  const rawTopoMapBranding = rawTerrain.topoMapBranding ?? {};
  const terrainMeta = (terrainLayer?.metadata ?? {}) as Record<
    string,
    string | undefined
  >;
  const setTopoMapBranding = (patch: TopoMapBranding) => {
    setEnvScene({
      terrain: {
        ...rawTerrain,
        topoMapBranding: { ...rawTopoMapBranding, ...patch },
      },
    });
  };
  const onTopoMapBrandingLogoFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const originalName = file.name || "title-block-logo";
    const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (
      !TITLE_BLOCK_DIRECT_IMAGE_EXTENSIONS.has(ext) &&
      !TITLE_BLOCK_CONVERTED_EXTENSIONS.has(ext)
    ) {
      setBrandingUploadError("Choose PNG, JPG, WebP, GIF, SVG, PDF, or EPS.");
      event.target.value = "";
      return;
    }
    setBrandingUploading(true);
    setBrandingUploadError(null);
    try {
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const fileName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (TITLE_BLOCK_CONVERTED_EXTENSIONS.has(ext)) {
        const stem = fileName.replace(/\.[^.]+$/, "") || "title-block-logo";
        const sourcePath = `${projectRoot}/branding/source/${fileName}`;
        const outputPath = `${projectRoot}/branding/generated/${stem}.png`;
        await writeFile(sourcePath, b64, { encoding: "base64" });
        await convertBrandingAsset({
          sourcePath,
          outputPath,
          sourceFormat: ext,
        });
        setTopoMapBranding({
          logoPath: outputPath,
          logoRenderablePath: outputPath,
          logoSourcePath: sourcePath,
          logoSourceFormat: ext,
          visible: true,
        });
      } else {
        const path = `${projectRoot}/branding/${fileName}`;
        await writeFile(path, b64, { encoding: "base64" });
        setTopoMapBranding({
          logoPath: path,
          logoRenderablePath: path,
          logoSourcePath: path,
          logoSourceFormat: ext,
          visible: true,
        });
      }
    } catch (error) {
      setBrandingUploadError(String((error as Error).message ?? error));
    } finally {
      setBrandingUploading(false);
      event.target.value = "";
    }
  };
  const setSurfaceElevationColor = (index: number, value: string) => {
    const nextColors = [...surfaceElevationColors];
    nextColors[index] = value;
    setTerrain({ surfaceElevationColors: nextColors });
  };
  const setSurfaceElevationPosition = (index: number, value: number) => {
    const nextPositions = [...surfaceElevationPositions];
    const lower =
      index === 0 ? 0 : nextPositions[index - 1] + SURFACE_ELEVATION_STOP_GAP;
    const upper =
      index === nextPositions.length - 1
        ? 1
        : nextPositions[index + 1] - SURFACE_ELEVATION_STOP_GAP;
    nextPositions[index] = Math.min(Math.max(value, lower), upper);
    setTerrain({ surfaceElevationColorPositions: nextPositions });
  };
  const setSurfaceElevationMidpoint = (index: number, value: number) => {
    const nextMidpoints = [...surfaceElevationMidpoints];
    nextMidpoints[index] = Math.min(Math.max(value, 0.05), 0.95);
    setTerrain({ surfaceElevationMidpoints: nextMidpoints });
  };
  const setSurfaceElevationEnabled = (checked: boolean) => {
    setTerrain({
      materialPreset:
        checked && !isImageBackedTopoMaterialPreset(terrain.materialPreset)
          ? "surface-elevation"
          : terrain.materialPreset === "surface-elevation"
            ? "soft-topo"
            : terrain.materialPreset,
      surfaceElevationEnabled: checked,
      surfaceElevationLegendVisible:
        checked && terrain.surfaceElevationLegendVisible !== false,
      surfaceElevationMinM,
      surfaceElevationMaxM,
      surfaceElevationColors,
      surfaceElevationColorPositions: surfaceElevationPositions,
      surfaceElevationMidpoints,
      surfaceElevationTransitionSoftness,
      surfaceElevationColorBlend,
      surfaceElevationReverse: terrain.surfaceElevationReverse === true,
    });
  };
  const {
    gradientRailRef,
    beginStopDrag: beginSurfaceElevationStopDrag,
    beginMidpointDrag: beginSurfaceElevationMidpointDrag,
    handleStopKeyDown: handleSurfaceElevationStopKeyDown,
    handleMidpointKeyDown: handleSurfaceElevationMidpointKeyDown,
  } = useTopoGradientHandles({
    positions: surfaceElevationPositions,
    midpoints: surfaceElevationMidpoints,
    setPosition: setSurfaceElevationPosition,
    setMidpoint: setSurfaceElevationMidpoint,
  });
  const selectedPreset = settings.materialPreset;
  const selectedImageSource = topoImageMaterialSourceForPreset(
    rawTerrain,
    selectedPreset,
  );
  const selectedPresetIsImageBacked =
    isImageBackedTopoMaterialPreset(selectedPreset);
  const selectedOrthoPhotoBudget: OrthoPhotoTextureBudgetId =
    terrain.orthoPhotoTextureBudget === 8192 ? "8192" : "4096";
  const targetLayerIds =
    publicSurfaceLayerIds.length > 0 ? publicSurfaceLayerIds : [layerId];
  const setPublicTopoLayerStyle = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      for (const id of targetLayerIds) setEnvLayerStyle(id, patch);
    } else if (currentPage) {
      for (const id of targetLayerIds) {
        setPageLayerOverride(currentPage.id, id, patch);
      }
    }
  };
  const publicSurfaceLayerControlProps = {
    ...layerControlProps,
    setEnvLayerStyle: (_layerId: string, patch: Partial<EditableStyle>) =>
      setPublicTopoLayerStyle(patch),
    setPageLayerOverride: (
      _pageId: string,
      _layerId: string,
      patch: Partial<EditableStyle>,
    ) => setPublicTopoLayerStyle(patch),
    clearPageLayerOverride: (
      pageId: string,
      _layerId: string,
      field: keyof EditableStyle,
    ) => {
      for (const id of targetLayerIds) {
        clearPageLayerOverride(pageId, id, field);
      }
    },
  };
  const setSceneFog = (patch: NonNullable<SceneProperties["fog"]>) => {
    setEnvScene({ fog: { ...sceneFog, ...patch } });
  };
  const setSceneSun = (patch: NonNullable<SceneProperties["sun"]>) => {
    setEnvScene({ sun: { ...sceneSun, ...patch } });
  };
  const setTopoMaterialPreset = (value: PublicTopoMaterialPresetId) => {
    const patch = topoMapPresetPatch(value, rawTerrain);
    if (!patch) {
      setTerrain({ materialPreset: "custom" });
      return;
    }
    setTerrain(patch);
    const stylePatch = topoMapPresetSurfaceStylePatch(value, rawTerrain);
    if (stylePatch) setPublicTopoLayerStyle(stylePatch);
  };
  const setImageTextureBudget = (value: OrthoPhotoTextureBudgetId) => {
    setTerrain(
      selectedImageSource
        ? topoImageMaterialDefaultPatch(selectedImageSource, value)
        : orthoPhotoDefaultPatch(rawTerrain, value),
    );
  };
  const showSurface = section === "all" || section === "surface";
  const showGraticule = section === "all" || section === "graticule";
  const showTitle = section === "all" || section === "title";

  return (
    <>
      {showSurface ? (
        <TopoSurfaceSettingsPanel nested={nestedContainers}>
          {terrainLayer ? (
            <div style={panelStyles.sectionHeader}>
              <div style={panelStyles.checkboxRow}>
                <span
                  style={{
                    ...panelStyles.layerLabel,
                    color: terrainEffectiveVisible
                      ? vibrancyLabel
                      : vibrancyTertiaryLabel,
                  }}
                >
                  {TOPO_MAP_SURFACE_LABEL}
                </span>
                <span
                  style={{
                    ...panelStyles.layerType,
                    color: terrainEffectiveVisible
                      ? vibrancySecondaryLabel
                      : vibrancyTertiaryLabel,
                  }}
                >
                  ({editorLayerTypeLabel(terrainLayer)})
                </span>
              </div>
            </div>
          ) : null}
          {isEnv ? (
            <EnvVisibilityRow
              visible={terrainEnvVisible}
              onToggle={toggleTerrainEnvVisible}
            />
          ) : currentPage ? (
            <PageVisibilityRow
              page={currentPage}
              layerId={layerId}
              envVisible={terrainEnvVisible}
              onSet={setPageTerrainVisible}
              onClear={clearPageTerrainVisible}
            />
          ) : null}
          <LayerNumberStyleControl
            label="Opacity"
            field="opacity"
            fallback={1}
            min={0}
            max={1}
            step={0.05}
            decimals={2}
            {...layerControlProps}
          />
          <details style={drillingAssayDetailsStyle}>
            <summary style={drillingAssaySummaryStyle}>
              Topo map transform
            </summary>
            <div style={detailsContentStyle}>
              <LayerNumberStyleControl
                label="Lift +/-"
                field="meshSurfaceLiftM"
                fallback={0}
                min={-5000}
                max={5000}
                step={25}
                decimals={0}
                {...layerControlProps}
              />
            </div>
          </details>
          <TopoSubsection
            label="Material source"
            testId="topo-material-controls"
          >
            <EnvSelectRow<PublicTopoMaterialPresetId>
              label="Material"
              value={selectedPreset}
              options={settings.materialOptions}
              testId="topo-material-preset"
              onChange={setTopoMaterialPreset}
            />
          </TopoSubsection>
          {selectedPresetIsImageBacked ? (
            <>
              <TopoSubsection label="Image adjustment">
                <EnvSelectRow<OrthoPhotoTextureBudgetId>
                  label="Texture budget"
                  value={selectedOrthoPhotoBudget}
                  options={ORTHO_PHOTO_TEXTURE_BUDGETS}
                  testId="topo-ortho-photo-texture-budget"
                  onChange={setImageTextureBudget}
                />
                <EnvStyleRow
                  label="Photo opacity"
                  inputType="range"
                  value={String(terrain.orthoPhotoOpacity ?? 1)}
                  min={0}
                  max={1}
                  step={0.05}
                  decimals={2}
                  testId="topo-ortho-photo-opacity"
                  onChange={(v) =>
                    setTerrain({ orthoPhotoOpacity: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Photo relief"
                  inputType="range"
                  value={String(terrain.orthoPhotoHillshadeBlend ?? 0.45)}
                  min={0}
                  max={1}
                  step={0.05}
                  decimals={2}
                  testId="topo-ortho-photo-hillshade"
                  onChange={(v) =>
                    setTerrain({
                      orthoPhotoHillshadeBlend: parseFloat(v),
                    })
                  }
                />
                <EnvStyleRow
                  label="Photo bright"
                  inputType="range"
                  value={String(terrain.orthoPhotoBrightness ?? 0)}
                  min={-0.5}
                  max={0.5}
                  step={0.02}
                  decimals={2}
                  testId="topo-ortho-photo-brightness"
                  onChange={(v) =>
                    setTerrain({ orthoPhotoBrightness: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Photo contrast"
                  inputType="range"
                  value={String(terrain.orthoPhotoContrast ?? 1)}
                  min={0.25}
                  max={2}
                  step={0.05}
                  decimals={2}
                  testId="topo-ortho-photo-contrast"
                  onChange={(v) =>
                    setTerrain({ orthoPhotoContrast: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Photo sat."
                  inputType="range"
                  value={String(terrain.orthoPhotoSaturation ?? 1)}
                  min={0}
                  max={2}
                  step={0.05}
                  decimals={2}
                  testId="topo-ortho-photo-saturation"
                  onChange={(v) =>
                    setTerrain({ orthoPhotoSaturation: parseFloat(v) })
                  }
                />
              </TopoSubsection>
            </>
          ) : null}
          <TopoSubsection
            label="Elevation ramp"
            active={terrain.surfaceElevationEnabled === true}
            testId="topo-surface-elevation-enabled"
            onToggle={() =>
              setSurfaceElevationEnabled(
                terrain.surfaceElevationEnabled !== true,
              )
            }
          >
            <TopoEyeToggleRow
              label="Elev. legend"
              checked={terrain.surfaceElevationLegendVisible !== false}
              testId="topo-surface-elevation-legend-visible"
              onChange={(checked) =>
                setTerrain({ surfaceElevationLegendVisible: checked })
              }
            />
            <EzGammaCheckboxRow
              label="Reverse ramp"
              checked={terrain.surfaceElevationReverse === true}
              testId="topo-surface-elevation-reverse"
              onChange={(checked) =>
                setTerrain({ surfaceElevationReverse: checked })
              }
            />
            <div style={nestedControlRowStyle}>
              <span style={nestedFieldLabelStyle}>PDF palette</span>
              <button
                type="button"
                data-testid="topo-surface-elevation-reset"
                onClick={() => setTerrain(surfaceElevationDefaultPatch())}
                style={{
                  flex: 1,
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  borderRadius: 6,
                  background: "rgba(255, 255, 255, 0.08)",
                  color: vibrancySecondaryLabel,
                  font: "inherit",
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                Reset 1500-3500 m
              </button>
            </div>
            <EnvStyleRow
              label="Elev. min"
              inputType="range"
              value={String(surfaceElevationMinM)}
              min={-500}
              max={4500}
              step={25}
              decimals={0}
              testId="topo-surface-elevation-min"
              onChange={(v) =>
                setTerrain({ surfaceElevationMinM: parseFloat(v) })
              }
            />
            <EnvStyleRow
              label="Elev. max"
              inputType="range"
              value={String(surfaceElevationMaxM)}
              min={0}
              max={5000}
              step={25}
              decimals={0}
              testId="topo-surface-elevation-max"
              onChange={(v) =>
                setTerrain({ surfaceElevationMaxM: parseFloat(v) })
              }
            />
            <div style={nestedControlRowStyle}>
              <span style={nestedFieldLabelStyle}>Gradient</span>
              <div
                ref={gradientRailRef}
                data-testid="topo-surface-gradient-rail"
                style={{
                  position: "relative",
                  flex: 1,
                  height: 30,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: "10px 0 7px",
                    borderRadius: 999,
                    background: surfaceElevationGradient,
                    border: "1px solid rgba(255, 255, 255, 0.28)",
                    boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.18)",
                  }}
                />
                {surfaceElevationMidpoints.map((midpoint, index) => {
                  const left = surfaceElevationPositions[index];
                  const right = surfaceElevationPositions[index + 1];
                  const position = left + (right - left) * midpoint;
                  return (
                    <button
                      type="button"
                      role="slider"
                      aria-label={`Transition spread ${index + 1}-${index + 2}`}
                      aria-valuemin={0.05}
                      aria-valuemax={0.95}
                      aria-valuenow={midpoint}
                      key={`surface-elevation-midpoint-${index}`}
                      data-testid={`topo-surface-gradient-midpoint-${index}`}
                      title={`Transition spread ${index + 1}-${index + 2}`}
                      onPointerDown={beginSurfaceElevationMidpointDrag(index)}
                      onKeyDown={handleSurfaceElevationMidpointKeyDown(index)}
                      style={{
                        position: "absolute",
                        left: `${position * 100}%`,
                        top: 5,
                        width: 5,
                        height: 22,
                        padding: 0,
                        borderRadius: 3,
                        transform: "translateX(-50%)",
                        background: "rgba(255, 255, 255, 0.78)",
                        border: "1px solid rgba(17, 20, 24, 0.62)",
                        boxShadow: "0 1px 5px rgba(0, 0, 0, 0.28)",
                        cursor: "ew-resize",
                      }}
                    />
                  );
                })}
                {surfaceElevationColors.map((color, index) => {
                  const pinned =
                    index === 0 || index === surfaceElevationColors.length - 1;
                  return (
                    <button
                      type="button"
                      role="slider"
                      aria-label={`Color stop ${index + 1}`}
                      aria-valuemin={0}
                      aria-valuemax={1}
                      aria-valuenow={surfaceElevationPositions[index]}
                      aria-readonly={pinned}
                      key={`surface-elevation-stop-${index}`}
                      data-testid={`topo-surface-gradient-stop-${index}`}
                      title={
                        pinned
                          ? `Color stop ${index + 1} pinned`
                          : `Color stop ${index + 1}`
                      }
                      onPointerDown={beginSurfaceElevationStopDrag(index)}
                      onKeyDown={handleSurfaceElevationStopKeyDown(index)}
                      style={{
                        position: "absolute",
                        left: `${surfaceElevationPositions[index] * 100}%`,
                        top: 2,
                        width: 11,
                        height: 11,
                        padding: 0,
                        transform: "translateX(-50%) rotate(45deg)",
                        borderRadius: 2,
                        background: color,
                        border: "1px solid rgba(255, 255, 255, 0.86)",
                        boxShadow: "0 1px 6px rgba(0, 0, 0, 0.36)",
                        cursor: pinned ? "default" : "ew-resize",
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <EnvStyleRow
              label="Ramp softness"
              inputType="range"
              value={String(surfaceElevationTransitionSoftness)}
              min={0}
              max={1}
              step={0.05}
              decimals={2}
              testId="topo-surface-elevation-softness"
              onChange={(v) =>
                setTerrain({
                  surfaceElevationTransitionSoftness: parseFloat(v),
                })
              }
            />
            <EnvStyleRow
              label="Color blend"
              inputType="range"
              value={String(surfaceElevationColorBlend)}
              min={0}
              max={1}
              step={0.05}
              decimals={2}
              testId="topo-surface-elevation-color-blend"
              onChange={(v) =>
                setTerrain({ surfaceElevationColorBlend: parseFloat(v) })
              }
            />
            {surfaceElevationColors.map((color, index) => (
              <EnvStyleRow
                key={`surface-elevation-color-${index}`}
                label={`${surfaceElevationTickLabel(
                  surfaceElevationMinM,
                  surfaceElevationMaxM,
                  index,
                )} m`}
                inputType="color"
                value={color}
                testId={`topo-surface-elevation-color-${index}`}
                onChange={(v) => setSurfaceElevationColor(index, v)}
              />
            ))}
          </TopoSubsection>
          <TopoSubsection label="Terrain shading">
            <EnvStyleRow
              label="Ramp low"
              inputType="color"
              value={terrain.rampLow ?? "#4f4a40"}
              onChange={(v) => setTerrain({ rampLow: v })}
            />
            <EnvStyleRow
              label="Ramp mid"
              inputType="color"
              value={terrain.rampMid ?? "#8a7e68"}
              onChange={(v) => setTerrain({ rampMid: v })}
            />
            <EnvStyleRow
              label="Ramp high"
              inputType="color"
              value={terrain.rampHigh ?? "#d7c69e"}
              onChange={(v) => setTerrain({ rampHigh: v })}
            />
            <EnvStyleRow
              label="Elev low"
              inputType="range"
              value={String(terrain.elevLowM ?? 0)}
              min={-2000}
              max={4000}
              step={25}
              decimals={0}
              onChange={(v) => setTerrain({ elevLowM: parseFloat(v) })}
            />
            <EnvStyleRow
              label="Elev high"
              inputType="range"
              value={String(terrain.elevHighM ?? 120)}
              min={-2000}
              max={5000}
              step={25}
              decimals={0}
              onChange={(v) => setTerrain({ elevHighM: parseFloat(v) })}
            />
            <EnvStyleRow
              label="Vertical exaggeration"
              inputType="range"
              value={String(terrain.verticalExaggeration ?? 1)}
              min={0.25}
              max={5}
              step={0.05}
              decimals={2}
              onChange={(v) =>
                setTerrain({ verticalExaggeration: parseFloat(v) })
              }
              testId="topo-vertical-exaggeration"
            />
            <EnvStyleRow
              label="Hue variance"
              inputType="range"
              value={String(terrain.rockHueVariance ?? 0.05)}
              min={0}
              max={0.2}
              step={0.005}
              decimals={3}
              onChange={(v) => setTerrain({ rockHueVariance: parseFloat(v) })}
            />
          </TopoSubsection>
          <TopoSurfaceClipControls
            {...publicSurfaceLayerControlProps}
            terrain={terrain}
            setTerrain={setTerrain}
            edgeFadeShape={edgeFadeShape}
            alignTitleToMapEdge={() =>
              setTopoMapBranding({
                anchor: TOPO_MAP_BRANDING_DEFAULT_ANCHOR,
                offsetXM: TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M,
                offsetYM: TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M,
              })
            }
          />
          <details style={drillingAssayDetailsStyle}>
            <summary style={drillingAssaySummaryStyle}>Atmosphere</summary>
            <div style={detailsContentStyle}>
              <TopoSubsection
                label="Sun"
                active={mapSunReliefActive}
                onToggle={() =>
                  setTerrain({
                    hillshadeIntensity: mapSunReliefActive ? 0 : 1.05,
                  })
                }
              >
                <EnvStyleRow
                  label="Sun azimuth"
                  inputType="range"
                  value={String(sunAzimuth)}
                  min={0}
                  max={360}
                  step={1}
                  decimals={0}
                  testId="topo-map-sun-azimuth"
                  onChange={(v) => setSceneSun({ azimuth: parseFloat(v) })}
                />
                <EnvStyleRow
                  label="Sun elevation"
                  inputType="range"
                  value={String(sunElevation)}
                  min={-5}
                  max={80}
                  step={1}
                  decimals={0}
                  testId="topo-map-sun-elevation"
                  onChange={(v) => setSceneSun({ elevation: parseFloat(v) })}
                />
                <TopoEyeToggleRow
                  label="Camera lock"
                  checked={sceneSun.lockToCamera === true}
                  title={
                    sceneSun.lockToCamera === true
                      ? "Unlock sun from camera"
                      : "Lock sun to camera"
                  }
                  onChange={(checked) => setSceneSun({ lockToCamera: checked })}
                />
                <EnvStyleRow
                  label="Relief strength"
                  inputType="range"
                  value={String(terrain.hillshadeIntensity ?? 1.05)}
                  min={0}
                  max={2}
                  step={0.05}
                  decimals={2}
                  testId="topo-map-hillshade-strength"
                  onChange={(v) =>
                    setTerrain({ hillshadeIntensity: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Shadow edge"
                  inputType="range"
                  value={String(terrain.shadowSharpness ?? 0.5)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  testId="topo-map-shadow-edge"
                  onChange={(v) =>
                    setTerrain({ shadowSharpness: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Facet highlight"
                  inputType="range"
                  value={String(terrain.facetStrength ?? 0.08)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  testId="topo-map-facet-highlight"
                  onChange={(v) => setTerrain({ facetStrength: parseFloat(v) })}
                />
                <EnvStyleRow
                  label="Shadow tint"
                  inputType="color"
                  value={terrain.shadowTint ?? "#303640"}
                  testId="topo-map-shadow-tint"
                  onChange={(v) => setTerrain({ shadowTint: v })}
                />
              </TopoSubsection>
              {isEnv || currentPage ? (
                <TopoSubsection
                  label="Scene fog"
                  active={sceneFogEnabled}
                  onToggle={() => setSceneFog({ enabled: !sceneFogEnabled })}
                >
                  <EnvStyleRow
                    label="Fog color"
                    inputType="color"
                    value={sceneFog.color ?? scene.background ?? "#383838"}
                    onChange={(v) => setSceneFog({ color: v })}
                  />
                  {sceneFogEnabled ? (
                    <>
                      <EnvStyleRow
                        label="Fog dens."
                        inputType="range"
                        value={String(sceneFogDensity * 10000)}
                        min={0.01}
                        max={6}
                        step={0.01}
                        decimals={2}
                        onChange={(v) =>
                          setSceneFog({ density: parseFloat(v) / 10000 })
                        }
                      />
                      <EnvStyleRow
                        label="Fog reach"
                        inputType="range"
                        value={String(sceneFogReachKm)}
                        min={5}
                        max={3000}
                        step={5}
                        decimals={0}
                        onChange={(v) =>
                          setSceneFog({
                            density: 3 / Math.max(parseFloat(v) * 1000, 1),
                          })
                        }
                      />
                      <EnvStyleRow
                        label="Fog gradient"
                        inputType="range"
                        value={String(sceneFogGradientCurve)}
                        min={0.35}
                        max={4}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setTerrain({ fogGradientCurve: parseFloat(v) })
                        }
                      />
                    </>
                  ) : null}
                </TopoSubsection>
              ) : null}
              <TopoSubsection
                label="Map fog"
                active={topoFogIncluded}
                onToggle={() =>
                  setPublicTopoLayerStyle({ affectedByFog: !topoFogIncluded })
                }
              >
                {topoFogIncluded ? (
                  <>
                    <EnvStyleRow
                      label="Layer dens."
                      inputType="range"
                      value={String(topoFogDensity * 10000)}
                      min={0.01}
                      max={6}
                      step={0.01}
                      decimals={2}
                      onChange={(v) =>
                        setPublicTopoLayerStyle({
                          fogDensity: parseFloat(v) / 10000,
                        })
                      }
                    />
                    <EnvStyleRow
                      label="Layer reach"
                      inputType="range"
                      value={String(topoFogReachKm)}
                      min={5}
                      max={3000}
                      step={5}
                      decimals={0}
                      onChange={(v) =>
                        setPublicTopoLayerStyle({
                          fogDensity: 3 / Math.max(parseFloat(v) * 1000, 1),
                        })
                      }
                    />
                  </>
                ) : null}
              </TopoSubsection>
            </div>
          </details>
          {terrainLayer ? (
            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Provenance</summary>
              <div style={detailsContentStyle}>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Source file</label>
                  <input
                    type="text"
                    value={terrainMeta.sourceFile ?? ""}
                    onChange={(event) =>
                      setLayerProvenance(layerId, {
                        sourceFile: event.target.value,
                      })
                    }
                    style={panelStyles.textInput}
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Source date</label>
                  <input
                    type="text"
                    value={terrainMeta.sourceDate ?? ""}
                    placeholder="YYYY-MM-DD or source range"
                    onChange={(event) =>
                      setLayerProvenance(layerId, {
                        sourceDate: event.target.value,
                      })
                    }
                    style={panelStyles.textInput}
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Origin</label>
                  <input
                    type="text"
                    value={terrainMeta.sourceOrigin ?? ""}
                    onChange={(event) =>
                      setLayerProvenance(layerId, {
                        sourceOrigin: event.target.value,
                      })
                    }
                    style={panelStyles.textInput}
                  />
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Classification</label>
                  <select
                    value={terrainMeta.classification ?? "observation"}
                    onChange={(event) =>
                      setLayerProvenance(layerId, {
                        classification: event.target.value,
                      })
                    }
                  >
                    {CLASSIFICATIONS.map((classification) => (
                      <option key={classification} value={classification}>
                        {classification}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Confidentiality</label>
                  <select
                    value={terrainMeta.confidentiality ?? "public"}
                    onChange={(event) =>
                      setLayerProvenance(layerId, {
                        confidentiality: event.target.value,
                      })
                    }
                  >
                    {CONFIDENTIALITIES.map((confidentiality) => (
                      <option key={confidentiality} value={confidentiality}>
                        {confidentiality}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
          ) : null}
        </TopoSurfaceSettingsPanel>
      ) : null}
      {showGraticule ? (
        <TopoGraticulePanel
          layer={graticuleLayer}
          nested={nestedContainers}
          environment={environment}
          isEnv={isEnv}
          currentPage={currentPage}
          setEnvLayerStyle={setEnvLayerStyle}
          setPageLayerOverride={setPageLayerOverride}
          clearPageLayerOverride={clearPageLayerOverride}
          toggleEnvDefaultVisible={toggleEnvDefaultVisible}
          setPageVisibilityOverride={setPageVisibilityOverride}
          clearPageVisibilityOverride={clearPageVisibilityOverride}
        />
      ) : null}
      {showTitle ? (
        <TopoTitleBlockPanel nested={nestedContainers}>
          <TopoEyeToggleRow
            label="Visible"
            checked={topoMapBranding.visible === true}
            testId="topo-map-branding-visible"
            onChange={(checked) => setTopoMapBranding({ visible: checked })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Logo file</label>
            <input
              data-testid="topo-map-branding-logo-file"
              type="file"
              accept={TITLE_BLOCK_UPLOAD_ACCEPT}
              disabled={brandingUploading}
              onChange={onTopoMapBrandingLogoFile}
              style={{ flex: 1, minWidth: 0, fontSize: 11 }}
            />
          </div>
          {topoMapBranding.logoPath ? (
            <div style={{ ...panelStyles.muted, fontSize: 11 }}>
              {(topoMapBranding.logoSourcePath ?? topoMapBranding.logoPath)
                .split("/")
                .at(-1)}
              <button
                type="button"
                onClick={() =>
                  setTopoMapBranding({
                    logoPath: "",
                    logoRenderablePath: "",
                    logoSourcePath: "",
                    logoSourceFormat: "",
                  })
                }
                style={{
                  ...panelStyles.iconButton,
                  width: "auto",
                  minHeight: 0,
                  marginLeft: 8,
                  padding: "1px 6px",
                  fontSize: 10,
                }}
              >
                Clear
              </button>
            </div>
          ) : null}
          {brandingUploadError ? (
            <div
              style={{
                color: "rgba(255, 111, 127, 0.9)",
                fontSize: 11,
              }}
            >
              {brandingUploadError}
            </div>
          ) : null}
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Heading</label>
            <input
              data-testid="topo-map-branding-heading"
              type="text"
              value={topoMapBranding.heading ?? ""}
              onChange={(event) =>
                setTopoMapBranding({ heading: event.currentTarget.value })
              }
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Subheading</label>
            <input
              data-testid="topo-map-branding-subheading"
              type="text"
              value={topoMapBranding.subheading ?? ""}
              onChange={(event) =>
                setTopoMapBranding({ subheading: event.currentTarget.value })
              }
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Layout</label>
            <select
              data-testid="topo-map-branding-layout"
              value={topoMapBranding.layout ?? "horizontal"}
              onChange={(event) =>
                setTopoMapBranding({
                  layout: event.currentTarget
                    .value as TopoMapBranding["layout"],
                })
              }
              style={{ flex: 1 }}
            >
              <option value="horizontal">Horizontal</option>
              <option value="stacked">Stacked</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Logo pos.</label>
            <select
              data-testid="topo-map-branding-logo-placement"
              value={topoMapBranding.logoPlacement ?? "before"}
              onChange={(event) =>
                setTopoMapBranding({
                  logoPlacement: event.currentTarget
                    .value as TopoMapBranding["logoPlacement"],
                })
              }
              style={{ flex: 1 }}
            >
              <option value="before">Before text</option>
              <option value="after">After text</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Logo fit</label>
            <select
              data-testid="topo-map-branding-logo-fit"
              value={topoMapBranding.logoFit ?? "contain"}
              onChange={(event) =>
                setTopoMapBranding({
                  logoFit: event.currentTarget
                    .value as TopoMapBranding["logoFit"],
                })
              }
              style={{ flex: 1 }}
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="stretch">Stretch</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Font</label>
            <select
              data-testid="topo-map-branding-font-family"
              value={topoMapBranding.fontFamily ?? "mono"}
              onChange={(event) =>
                setTopoMapBranding({
                  fontFamily: event.currentTarget
                    .value as TopoMapBranding["fontFamily"],
                })
              }
              style={{ flex: 1 }}
            >
              <option value="mono">Mono</option>
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="condensed">Condensed</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Text align</label>
            <select
              data-testid="topo-map-branding-text-align"
              value={topoMapBranding.textAlign ?? "left"}
              onChange={(event) =>
                setTopoMapBranding({
                  textAlign: event.currentTarget
                    .value as TopoMapBranding["textAlign"],
                })
              }
              style={{ flex: 1 }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Anchor</label>
            <select
              data-testid="topo-map-branding-anchor"
              value={topoMapBranding.anchor ?? TOPO_MAP_BRANDING_DEFAULT_ANCHOR}
              onChange={(event) =>
                setTopoMapBranding({
                  anchor: event.currentTarget
                    .value as TopoMapBranding["anchor"],
                })
              }
              style={{ flex: 1 }}
            >
              <option value="south-west">South west</option>
              <option value="south-east">South east</option>
              <option value="north-west">North west</option>
              <option value="north-east">North east</option>
            </select>
          </div>
          <EnvStyleRow
            label="Offset X"
            inputType="range"
            value={String(
              topoMapBranding.offsetXM ?? TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M,
            )}
            min={-600000}
            max={600000}
            step={5000}
            decimals={0}
            testId="topo-map-branding-offset-x"
            onChange={(v) => setTopoMapBranding({ offsetXM: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Offset Y"
            inputType="range"
            value={String(
              topoMapBranding.offsetYM ?? TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M,
            )}
            min={-600000}
            max={600000}
            step={5000}
            decimals={0}
            testId="topo-map-branding-offset-y"
            onChange={(v) => setTopoMapBranding({ offsetYM: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Rotation"
            inputType="range"
            value={String(topoMapBranding.rotationDeg ?? 0)}
            min={-180}
            max={180}
            step={1}
            decimals={0}
            testId="topo-map-branding-rotation"
            onChange={(v) => setTopoMapBranding({ rotationDeg: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Lift"
            inputType="range"
            value={String(topoMapBranding.liftM ?? 260)}
            min={0}
            max={2000}
            step={25}
            decimals={0}
            testId="topo-map-branding-lift"
            onChange={(v) => setTopoMapBranding({ liftM: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Logo width"
            inputType="range"
            value={String(topoMapBranding.logoWidthM ?? 46000)}
            min={0}
            max={160000}
            step={1000}
            decimals={0}
            testId="topo-map-branding-logo-width"
            onChange={(v) => setTopoMapBranding({ logoWidthM: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Logo gap"
            inputType="range"
            value={String(topoMapBranding.logoGapM ?? 16000)}
            min={-50000}
            max={80000}
            step={1000}
            decimals={0}
            testId="topo-map-branding-logo-gap"
            onChange={(v) => setTopoMapBranding({ logoGapM: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Heading size"
            inputType="range"
            value={String(topoMapBranding.headingSizeM ?? 18000)}
            min={2000}
            max={240000}
            step={1000}
            decimals={0}
            testId="topo-map-branding-heading-size"
            onChange={(v) =>
              setTopoMapBranding({ headingSizeM: parseFloat(v) })
            }
          />
          <EnvStyleRow
            label="Subhead size"
            inputType="range"
            value={String(topoMapBranding.subheadingSizeM ?? 10500)}
            min={1500}
            max={180000}
            step={500}
            decimals={0}
            testId="topo-map-branding-subheading-size"
            onChange={(v) =>
              setTopoMapBranding({ subheadingSizeM: parseFloat(v) })
            }
          />
          <EnvStyleRow
            label="Head weight"
            inputType="range"
            value={String(topoMapBranding.headingWeight ?? 800)}
            min={100}
            max={900}
            step={100}
            decimals={0}
            testId="topo-map-branding-heading-weight"
            onChange={(v) =>
              setTopoMapBranding({ headingWeight: parseFloat(v) })
            }
          />
          <EzGammaCheckboxRow
            label="Head italic"
            checked={topoMapBranding.headingItalic === true}
            testId="topo-map-branding-heading-italic"
            onChange={(checked) =>
              setTopoMapBranding({ headingItalic: checked })
            }
          />
          <EnvStyleRow
            label="Sub weight"
            inputType="range"
            value={String(topoMapBranding.subheadingWeight ?? 500)}
            min={100}
            max={900}
            step={100}
            decimals={0}
            testId="topo-map-branding-subheading-weight"
            onChange={(v) =>
              setTopoMapBranding({ subheadingWeight: parseFloat(v) })
            }
          />
          <EzGammaCheckboxRow
            label="Sub italic"
            checked={topoMapBranding.subheadingItalic === true}
            testId="topo-map-branding-subheading-italic"
            onChange={(checked) =>
              setTopoMapBranding({ subheadingItalic: checked })
            }
          />
          <EnvStyleRow
            label="Line gap"
            inputType="range"
            value={String(topoMapBranding.lineGapM ?? 2500)}
            min={-30000}
            max={50000}
            step={500}
            decimals={0}
            testId="topo-map-branding-line-gap"
            onChange={(v) => setTopoMapBranding({ lineGapM: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Text color"
            inputType="color"
            value={topoMapBranding.textColor ?? "#ffffff"}
            testId="topo-map-branding-text-color"
            onChange={(v) => setTopoMapBranding({ textColor: v })}
          />
          <EnvStyleRow
            label="Block opacity"
            inputType="range"
            value={String(topoMapBranding.opacity ?? 0.92)}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            testId="topo-map-branding-opacity"
            onChange={(v) => setTopoMapBranding({ opacity: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Logo opacity"
            inputType="range"
            value={String(
              topoMapBranding.logoOpacity ?? topoMapBranding.opacity ?? 0.92,
            )}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            testId="topo-map-branding-logo-opacity"
            onChange={(v) => setTopoMapBranding({ logoOpacity: parseFloat(v) })}
          />
          <EnvStyleRow
            label="Text opacity"
            inputType="range"
            value={String(
              topoMapBranding.textOpacity ?? topoMapBranding.opacity ?? 0.92,
            )}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            testId="topo-map-branding-text-opacity"
            onChange={(v) => setTopoMapBranding({ textOpacity: parseFloat(v) })}
          />
          <EzGammaCheckboxRow
            label="Background"
            checked={topoMapBranding.backgroundEnabled === true}
            testId="topo-map-branding-background-enabled"
            onChange={(checked) =>
              setTopoMapBranding({ backgroundEnabled: checked })
            }
          />
          <EnvStyleRow
            label="Bg color"
            inputType="color"
            value={topoMapBranding.backgroundColor ?? "#050607"}
            testId="topo-map-branding-background-color"
            onChange={(v) => setTopoMapBranding({ backgroundColor: v })}
          />
          <EnvStyleRow
            label="Bg opacity"
            inputType="range"
            value={String(topoMapBranding.backgroundOpacity ?? 0.36)}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            testId="topo-map-branding-background-opacity"
            onChange={(v) =>
              setTopoMapBranding({ backgroundOpacity: parseFloat(v) })
            }
          />
          <EnvStyleRow
            label="Bg pad X"
            inputType="range"
            value={String(topoMapBranding.backgroundPaddingXM ?? 12000)}
            min={0}
            max={180000}
            step={1000}
            decimals={0}
            testId="topo-map-branding-background-padding-x"
            onChange={(v) =>
              setTopoMapBranding({ backgroundPaddingXM: parseFloat(v) })
            }
          />
          <EnvStyleRow
            label="Bg pad Y"
            inputType="range"
            value={String(topoMapBranding.backgroundPaddingYM ?? 8000)}
            min={0}
            max={180000}
            step={1000}
            decimals={0}
            testId="topo-map-branding-background-padding-y"
            onChange={(v) =>
              setTopoMapBranding({ backgroundPaddingYM: parseFloat(v) })
            }
          />
          <TopoEyeToggleRow
            label="Outline"
            checked={topoMapBranding.outlineEnabled === true}
            testId="topo-map-branding-outline-enabled"
            onChange={(checked) =>
              setTopoMapBranding({ outlineEnabled: checked })
            }
          />
          <EnvStyleRow
            label="Outline color"
            inputType="color"
            value={topoMapBranding.outlineColor ?? "#ffffff"}
            testId="topo-map-branding-outline-color"
            onChange={(v) => setTopoMapBranding({ outlineColor: v })}
          />
          <EnvStyleRow
            label="Outline opacity"
            inputType="range"
            value={String(topoMapBranding.outlineOpacity ?? 0.8)}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            testId="topo-map-branding-outline-opacity"
            onChange={(v) =>
              setTopoMapBranding({ outlineOpacity: parseFloat(v) })
            }
          />
          <EnvStyleRow
            label="Outline width"
            inputType="range"
            value={String(topoMapBranding.outlineWidthM ?? 2500)}
            min={250}
            max={50000}
            step={250}
            decimals={0}
            testId="topo-map-branding-outline-width"
            onChange={(v) =>
              setTopoMapBranding({ outlineWidthM: parseFloat(v) })
            }
          />
        </TopoTitleBlockPanel>
      ) : null}
    </>
  );
}

function TopoSurfaceSettingsPanel({
  children,
  nested,
}: {
  children: ReactNode;
  nested: boolean;
}) {
  if (!nested) {
    return (
      <div style={detailsContentStyle} data-testid="topo-surface-controls">
        {children}
      </div>
    );
  }
  return (
    <details style={drillingAssayDetailsStyle}>
      <summary style={drillingAssaySummaryStyle}>Topo Surface Settings</summary>
      <div style={detailsContentStyle} data-testid="topo-surface-controls">
        {children}
      </div>
    </details>
  );
}

function TopoGraticulePanel({
  layer,
  nested,
  environment,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  toggleEnvDefaultVisible,
  setPageVisibilityOverride,
  clearPageVisibilityOverride,
}: {
  layer: ProjectLayerSpec | null;
  nested: boolean;
  environment: EnvironmentSetup;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  toggleEnvDefaultVisible: (layerId: string) => void;
  setPageVisibilityOverride: (
    pageId: string,
    layerId: string,
    visible: boolean,
  ) => void;
  clearPageVisibilityOverride: (pageId: string, layerId: string) => void;
}) {
  if (!layer) return null;

  const layerId = layer.id;
  const envStyle = environment.layerStyles[layerId] ?? {};
  const style = currentPage
    ? effectiveStyle(environment, currentPage, layerId)
    : envStyle;
  const envVisible = environment.defaultVisibleLayers.includes(layerId);
  const effectiveVisible = currentPage
    ? isVisibilityOverridden(currentPage, layerId)
      ? currentPage.visibilityOverrides?.[layerId] === true
      : envVisible
    : envVisible;
  const controlProps = {
    style: isEnv ? envStyle : style,
    isEnv,
    currentPage,
    layerId,
    setEnvLayerStyle,
    setPageLayerOverride,
    clearPageLayerOverride,
  };
  const setGraticuleStylePatch = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const minorLinesActive = (style.graticuleMinorOpacity ?? 0.5) > 0;
  const ribbonModeActive = style.graticuleRibbonMode === true;
  const edgeLabelsActive = style.graticuleEdgeLabelVisible !== false;
  const leaderBlendActive = style.graticuleLeaderBlendEnabled === true;

  const content = (
    <div
      style={detailsContentStyle}
      data-testid={nested ? undefined : "topo-graticule-controls"}
    >
      <div style={panelStyles.sectionHeader}>
        <div style={panelStyles.checkboxRow}>
          <span
            style={{
              ...panelStyles.layerLabel,
              color: effectiveVisible ? vibrancyLabel : vibrancyTertiaryLabel,
            }}
          >
            {layer.label ?? "Longitude / latitude grid"}
          </span>
          <span
            style={{
              ...panelStyles.layerType,
              color: effectiveVisible
                ? vibrancySecondaryLabel
                : vibrancyTertiaryLabel,
            }}
          >
            ({editorLayerTypeLabel(layer)})
          </span>
        </div>
      </div>
      {isEnv ? (
        <EnvVisibilityRow
          visible={envVisible}
          onToggle={() => toggleEnvDefaultVisible(layerId)}
        />
      ) : currentPage ? (
        <PageVisibilityRow
          page={currentPage}
          layerId={layerId}
          envVisible={envVisible}
          onSet={(visible) =>
            setPageVisibilityOverride(currentPage.id, layerId, visible)
          }
          onClear={() => clearPageVisibilityOverride(currentPage.id, layerId)}
        />
      ) : null}
      <LayerColorStyleControl
        label="Color"
        field="color"
        fallback="#cccccc"
        {...controlProps}
      />
      <LayerNumberStyleControl
        label="Opacity"
        field="opacity"
        fallback={1}
        min={0}
        max={1}
        step={0.05}
        decimals={2}
        {...controlProps}
      />
      <LayerNumberStyleControl
        label="Line width"
        field="lineWidth"
        fallback={1.15}
        min={0.5}
        max={6}
        step={0.25}
        decimals={2}
        {...controlProps}
      />
      <LayerBooleanStyleControl
        label="Labels"
        field="graticuleLabelVisible"
        fallback={true}
        {...controlProps}
      />
      <LayerNumberStyleControl
        label="Label size"
        field="graticuleLabelSizeM"
        fallback={9000}
        min={1500}
        max={60000}
        step={500}
        decimals={0}
        {...controlProps}
      />
      <LayerNumberStyleControl
        label="Surface lift"
        field="graticuleLiftM"
        fallback={24}
        min={0}
        max={500}
        step={4}
        decimals={0}
        {...controlProps}
      />
      <LayerBooleanStyleControl
        label="Edge fade aware"
        field="graticuleEdgeFadeAware"
        fallback={true}
        {...controlProps}
      />
      <LayerBooleanStyleControl
        label="Section frames clip grid"
        field="topoSectionable"
        fallback={false}
        {...controlProps}
      />
      <LayerNumberStyleControl
        label="Edge strength"
        field="graticuleEdgeFadeStrength"
        fallback={1}
        min={0}
        max={1}
        step={0.05}
        decimals={2}
        testId="topo-graticule-edge-strength"
        {...controlProps}
      />
      <LayerColorStyleControl
        label="Edge line"
        field="graticuleEdgeLineColor"
        fallback="#ffffff"
        testId="topo-graticule-edge-line-color"
        {...controlProps}
      />
      <LayerNumberStyleControl
        label="Edge line weight"
        field="graticuleEdgeLineWidth"
        fallback={4.75}
        min={0.1}
        max={32}
        step={0.25}
        decimals={2}
        testId="topo-graticule-edge-line-width"
        {...controlProps}
      />
      <TopoSubsection
        label="Half-degree (.5) lines"
        active={minorLinesActive}
        onToggle={() =>
          setGraticuleStylePatch({
            graticuleMinorOpacity: minorLinesActive ? 0 : 0.5,
          })
        }
      >
        <LayerNumberStyleControl
          label="Minor line weight"
          field="graticuleMinorLineWidth"
          fallback={0.92}
          min={0.1}
          max={32}
          step={0.25}
          decimals={2}
          {...controlProps}
        />
        <LayerNumberStyleControl
          label="Minor opacity"
          field="graticuleMinorOpacity"
          fallback={0.5}
          min={0}
          max={1}
          step={0.05}
          decimals={2}
          {...controlProps}
        />
        <LayerColorStyleControl
          label="Minor colour"
          field="graticuleMinorColor"
          fallback="#d7d1c7"
          {...controlProps}
        />
      </TopoSubsection>
      <TopoSubsection
        label="Rendering mode"
        active={ribbonModeActive}
        onToggle={() =>
          setGraticuleStylePatch({ graticuleRibbonMode: !ribbonModeActive })
        }
      >
        <LayerBooleanStyleControl
          label="Perspective line width"
          field="graticulePerspectiveLineWidth"
          fallback={false}
          {...controlProps}
        />
        <LayerNumberStyleControl
          label="Ribbon width (m)"
          field="graticuleRibbonWidthM"
          fallback={250}
          min={50}
          max={3000}
          step={25}
          decimals={0}
          {...controlProps}
        />
        <LayerNumberStyleControl
          label="Minor ribbon width (m)"
          field="graticuleMinorRibbonWidthM"
          fallback={200}
          min={10}
          max={3000}
          step={10}
          decimals={0}
          {...controlProps}
        />
        <LayerBooleanStyleControl
          label="Ribbon additive blending"
          field="graticuleRibbonAdditive"
          fallback={true}
          {...controlProps}
        />
        <LayerNumberStyleControl
          label="Ribbon brightness"
          field="graticuleRibbonBrightness"
          fallback={1}
          min={0.1}
          max={8}
          step={0.1}
          decimals={2}
          {...controlProps}
        />
      </TopoSubsection>
      <TopoSubsection
        label="Labels & leaders"
        active={edgeLabelsActive}
        onToggle={() =>
          setGraticuleStylePatch({
            graticuleEdgeLabelVisible: !edgeLabelsActive,
          })
        }
      >
        <LayerColorStyleControl
          label="Edge label"
          field="graticuleEdgeLabelColor"
          fallback="#ffffff"
          testId="topo-graticule-edge-label-color"
          {...controlProps}
        />
        <LayerNumberStyleControl
          label="Label offset"
          field="graticuleEdgeLabelOffsetM"
          fallback={90000}
          min={0}
          max={160000}
          step={1000}
          decimals={0}
          testId="topo-graticule-edge-label-offset"
          {...controlProps}
        />
        <LayerNumberStyleControl
          label="Label gap"
          field="graticuleEdgeLabelGapM"
          fallback={22000}
          min={-100000}
          max={100000}
          step={1000}
          decimals={0}
          testId="topo-graticule-edge-label-gap"
          {...controlProps}
        />
      </TopoSubsection>
      <TopoSubsection
        label="Leader colour blend"
        active={leaderBlendActive}
        onToggle={() =>
          setGraticuleStylePatch({
            graticuleLeaderBlendEnabled: !leaderBlendActive,
          })
        }
      >
        <LayerColorStyleControl
          label="Blend inner colour"
          field="graticuleLeaderBlendInnerColor"
          fallback="#d7d1c7"
          {...controlProps}
        />
        <LayerColorStyleControl
          label="Blend outer colour"
          field="graticuleLeaderBlendOuterColor"
          fallback="#ffffff"
          {...controlProps}
        />
      </TopoSubsection>
    </div>
  );

  if (!nested) return content;

  return (
    <details
      style={drillingAssayDetailsStyle}
      data-testid="topo-graticule-controls"
    >
      <summary style={drillingAssaySummaryStyle}>
        Longitude / latitude grid
      </summary>
      {content}
    </details>
  );
}

function TopoTitleBlockPanel({
  children,
  nested,
}: {
  children: ReactNode;
  nested: boolean;
}) {
  if (!nested) return <div style={detailsContentStyle}>{children}</div>;
  return (
    <details style={drillingAssayDetailsStyle}>
      <summary style={drillingAssaySummaryStyle}>Title block</summary>
      <div style={detailsContentStyle}>{children}</div>
    </details>
  );
}

function TopoSurfaceClipControls({
  terrain,
  setTerrain,
  edgeFadeShape,
  alignTitleToMapEdge,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  terrain: TerrainSettings;
  setTerrain: (patch: TerrainSettings) => void;
  edgeFadeShape: "square" | "rounded-square" | "circle";
  alignTitleToMapEdge: () => void;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const numberProps = {
    style,
    isEnv,
    currentPage,
    layerId,
    setEnvLayerStyle,
    setPageLayerOverride,
    clearPageLayerOverride,
  };
  const edgeFadeActive = (terrain.edgeFadeDistanceM ?? 90_000) > 0;
  const publicSurfaceClipActive = style.publicSurfaceClipEnabled === true;
  const materialSource = topoImageMaterialSourceForPreset(
    terrain,
    terrain.materialPreset,
  );
  const materialLabel =
    materialSource?.label ??
    (terrain.materialPreset === "ortho-photo"
      ? "Ortho photo"
      : "Active source");
  const materialBounds = terrain.orthoPhotoBounds;
  const materialFootprint =
    materialBounds && materialBounds.length === 4
      ? `${Math.round((materialBounds[2] - materialBounds[0]) / 1000)} km x ${Math.round((materialBounds[3] - materialBounds[1]) / 1000)} km`
      : "No raster bounds";
  const resetMaterialEdgeCrop = () =>
    setTerrain({
      edgeFadeDistanceM: 0,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      edgeOutlineEnabled: false,
      edgeOutlineOpacity: 0,
      edgeOutlineOffsetM: 0,
    });
  const setPublicSurfaceClipEnabled = (enabled: boolean) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, { publicSurfaceClipEnabled: enabled });
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, {
        publicSurfaceClipEnabled: enabled,
      });
    }
  };
  return (
    <TopoSubsection label="Clipping" testId="topo-clipping-controls">
      <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
        Material edge opacity fade changes the visible topo footprint by fading
        into the active fog color. Public surface clip crops terrain, roads,
        streams, graticule, and waterbodies together.
      </div>
      <div style={topoClipReadoutStyle}>
        <div>Material source: {materialLabel}</div>
        <div>Raster footprint: {materialFootprint}</div>
      </div>
      <div style={topoInlineActionRowStyle}>
        <button
          type="button"
          style={topoInlineActionButtonStyle}
          onClick={resetMaterialEdgeCrop}
        >
          Full material edge
        </button>
        <button
          type="button"
          style={topoInlineActionButtonStyle}
          onClick={alignTitleToMapEdge}
        >
          Align title to edge
        </button>
      </div>
      <TopoSubsection
        label="Material edge opacity fade"
        active={edgeFadeActive}
        testId="topo-edge-fade-heading"
        onToggle={() =>
          setTerrain({ edgeFadeDistanceM: edgeFadeActive ? 0 : 90_000 })
        }
      >
        <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
          Opacity/fog fade only. Edge color is controlled by Material edge
          outline below.
        </div>
        <EnvStyleRow
          label="Fade width"
          inputType="range"
          value={String(terrain.edgeFadeDistanceM ?? 90_000)}
          min={0}
          max={250_000}
          step={5_000}
          decimals={0}
          onChange={(v) => setTerrain({ edgeFadeDistanceM: parseFloat(v) })}
          testId="topo-edge-fade-distance"
        />
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Fade shape</label>
          <select
            data-testid="topo-edge-fade-shape"
            value={edgeFadeShape}
            onChange={(event) =>
              setTerrain({
                edgeFadeShape: event.currentTarget
                  .value as TerrainSettings["edgeFadeShape"],
              })
            }
            style={{ flex: 1 }}
          >
            <option value="square">Square</option>
            <option value="rounded-square">Rounded square</option>
            <option value="circle">Circle</option>
          </select>
        </div>
        <EnvStyleRow
          label="Fade inset"
          inputType="range"
          value={String(terrain.edgeFadeInsetM ?? 0)}
          min={0}
          max={250_000}
          step={5_000}
          decimals={0}
          onChange={(v) => setTerrain({ edgeFadeInsetM: parseFloat(v) })}
          testId="topo-edge-fade-inset"
        />
        <EnvStyleRow
          label="Corner radius"
          inputType="range"
          value={String(terrain.edgeFadeCornerRadiusM ?? 0)}
          min={0}
          max={250_000}
          step={5_000}
          decimals={0}
          onChange={(v) => setTerrain({ edgeFadeCornerRadiusM: parseFloat(v) })}
          testId="topo-edge-fade-corner-radius"
        />
      </TopoSubsection>
      <TopoSubsection
        label="Material edge outline"
        active={terrain.edgeOutlineEnabled === true}
        testId="topo-edge-outline-enabled"
        onToggle={() =>
          setTerrain({
            edgeOutlineEnabled: terrain.edgeOutlineEnabled !== true,
          })
        }
      >
        <EnvStyleRow
          label="Outline offset"
          inputType="range"
          value={String(terrain.edgeOutlineOffsetM ?? 0)}
          min={0}
          max={250_000}
          step={2_500}
          decimals={0}
          onChange={(v) => setTerrain({ edgeOutlineOffsetM: parseFloat(v) })}
          testId="topo-edge-outline-offset"
        />
        <EnvStyleRow
          label="Outline width"
          inputType="range"
          value={String(terrain.edgeOutlineThicknessM ?? 2500)}
          min={0}
          max={25_000}
          step={500}
          decimals={0}
          onChange={(v) => setTerrain({ edgeOutlineThicknessM: parseFloat(v) })}
          testId="topo-edge-outline-thickness"
        />
        <EnvStyleRow
          label="Outline opacity"
          inputType="range"
          value={String(terrain.edgeOutlineOpacity ?? 0)}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(v) => setTerrain({ edgeOutlineOpacity: parseFloat(v) })}
          testId="topo-edge-outline-opacity"
        />
        <EnvStyleRow
          label="Outline color"
          inputType="color"
          value={terrain.edgeOutlineColor ?? "#f8ead0"}
          onChange={(v) => setTerrain({ edgeOutlineColor: v })}
          testId="topo-edge-outline-color"
        />
        <EnvStyleRow
          label="Top shine"
          inputType="range"
          value={String(terrain.edgeTopShine ?? 0)}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(v) => setTerrain({ edgeTopShine: parseFloat(v) })}
          testId="topo-edge-top-shine"
        />
        <EnvStyleRow
          label="Corner shine"
          inputType="range"
          value={String(terrain.edgeCornerShine ?? 0)}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(v) => setTerrain({ edgeCornerShine: parseFloat(v) })}
          testId="topo-edge-corner-shine"
        />
        <EnvStyleRow
          label="Bottom shine"
          inputType="range"
          value={String(terrain.edgeBottomShine ?? 0)}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(v) => setTerrain({ edgeBottomShine: parseFloat(v) })}
          testId="topo-edge-bottom-shine"
        />
      </TopoSubsection>
      <TopoSubsection
        label="Public surface clip"
        active={publicSurfaceClipActive}
        testId="public-surface-clip-enabled"
        onToggle={() => setPublicSurfaceClipEnabled(!publicSurfaceClipActive)}
      >
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Shape</label>
          <select
            data-testid="public-surface-clip-shape"
            value={style.publicSurfaceClipShape === "circle" ? "circle" : "box"}
            onChange={(event) => {
              const value =
                event.currentTarget.value === "circle" ? "circle" : "box";
              if (isEnv) {
                setEnvLayerStyle(layerId, { publicSurfaceClipShape: value });
              } else if (currentPage) {
                setPageLayerOverride(currentPage.id, layerId, {
                  publicSurfaceClipShape: value,
                });
              }
            }}
            style={{ flex: 1 }}
          >
            <option value="circle">Circle inside box</option>
            <option value="box">Box</option>
          </select>
        </div>
        <LayerNumberStyleControl
          label="X center"
          field="publicSurfaceClipCenterX"
          fallback={0}
          min={-300000}
          max={300000}
          step={250}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Y center"
          field="publicSurfaceClipCenterY"
          fallback={0}
          min={-300000}
          max={300000}
          step={250}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Z center"
          field="publicSurfaceClipCenterZ"
          fallback={2000}
          min={-20000}
          max={30000}
          step={100}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="X size"
          field="publicSurfaceClipSizeX"
          fallback={279150}
          min={100}
          max={500000}
          step={500}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Y size"
          field="publicSurfaceClipSizeY"
          fallback={227900}
          min={100}
          max={500000}
          step={500}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Z size"
          field="publicSurfaceClipSizeZ"
          fallback={8000}
          min={100}
          max={50000}
          step={100}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Z rotate"
          field="publicSurfaceClipRotationZDeg"
          fallback={0}
          min={-180}
          max={180}
          step={1}
          decimals={0}
          {...numberProps}
        />
      </TopoSubsection>
    </TopoSubsection>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}
