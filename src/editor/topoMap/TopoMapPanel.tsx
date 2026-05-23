import { useState } from "react";
import { convertBrandingAsset, writeFile } from "../save";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssaySummaryStyle,
  EnvSelectRow,
  EnvStyleRow,
  EnvVisibilityRow,
  EzGammaCheckboxRow,
  LayerBooleanStyleControl,
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
import type {
  EditableStyle,
  PresentationPage,
  SceneProperties,
} from "../../pages/types";
import {
  ORTHO_PHOTO_TEXTURE_BUDGETS,
  PUBLIC_TOPO_MATERIAL_PRESETS,
  SURFACE_ELEVATION_DEFAULT_BLEND,
  SURFACE_ELEVATION_DEFAULT_MAX_M,
  SURFACE_ELEVATION_DEFAULT_MIN_M,
  SURFACE_ELEVATION_DEFAULT_SOFTNESS,
  SURFACE_ELEVATION_STOP_GAP,
  TOPO_MAP_BRANDING_DEFAULT_ANCHOR,
  TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M,
  TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M,
  TOPO_MAP_SURFACE_LABEL,
  orthoPhotoDefaultPatch,
  surfaceElevationColorsFromTerrain,
  surfaceElevationDefaultPatch,
  surfaceElevationGradientCss,
  surfaceElevationMidpointsFromTerrain,
  surfaceElevationPositionsFromTerrain,
  surfaceElevationTickLabel,
  topoMapPresetPatch,
  type OrthoPhotoTextureBudgetId,
  type PublicTopoMaterialPresetId,
  type ResolvedTopoMapSettings,
} from "../../topoMap/settings";
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

export function TopoMapPanel({
  settings,
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
  publicSurfaceLayerIds,
  setLayerProvenance,
}: {
  settings: ResolvedTopoMapSettings;
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
  publicSurfaceLayerIds: readonly string[];
  setLayerProvenance: (layerId: string, patch: LayerProvenancePatch) => void;
}) {
  const rawTerrain = scene.terrain ?? {};
  const terrain = settings.terrain;
  const style = settings.surfaceStyle;
  const terrainLayer = settings.surfaceLayer;
  const layerId = settings.surfaceLayerId;
  const [brandingUploadError, setBrandingUploadError] = useState<string | null>(
    null,
  );
  const [brandingUploading, setBrandingUploading] = useState(false);
  const setTerrain = (patch: TerrainSettings) => {
    if (!isEnv) return;
    setEnvScene({ terrain: { ...rawTerrain, ...patch } });
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
  const topoFogDensity =
    typeof style.fogDensity === "number" ? style.fogDensity : sceneFogDensity;
  const topoFogReachKm = 3 / Math.max(topoFogDensity, 0.000001) / 1000;
  const topoFogIncluded = style.affectedByFog !== false;
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
    if (!isEnv) return;
    setEnvScene({ fog: { ...sceneFog, ...patch } });
  };
  const setTopoMaterialPreset = (value: PublicTopoMaterialPresetId) => {
    const patch = topoMapPresetPatch(value, rawTerrain);
    if (!patch) {
      setTerrain({ materialPreset: "custom" });
      return;
    }
    setTerrain(patch);
  };
  const setOrthoPhotoBudget = (value: OrthoPhotoTextureBudgetId) => {
    setTerrain(orthoPhotoDefaultPatch(rawTerrain, value));
  };

  return (
    <details style={drillingAssayDetailsStyle} open>
      <summary style={drillingAssaySummaryStyle}>
        {TOPO_MAP_SURFACE_LABEL}
      </summary>
      <div style={detailsContentStyle} data-testid="topo-surface-controls">
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
            </div>
            <span
              style={{
                ...panelStyles.layerType,
                color: terrainEffectiveVisible
                  ? vibrancySecondaryLabel
                  : vibrancyTertiaryLabel,
              }}
            >
              {terrainLayer.type}
            </span>
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
          <summary style={drillingAssaySummaryStyle}>Topo map transform</summary>
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
        <TopoSurfaceClipControls {...publicSurfaceLayerControlProps} />
        <details style={drillingAssayDetailsStyle} open>
          <summary style={drillingAssaySummaryStyle}>Title block</summary>
          <div style={detailsContentStyle}>
            <EzGammaCheckboxRow
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
              onChange={(v) =>
                setTopoMapBranding({ rotationDeg: parseFloat(v) })
              }
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
              onChange={(v) =>
                setTopoMapBranding({ logoWidthM: parseFloat(v) })
              }
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
              onChange={(v) =>
                setTopoMapBranding({ logoGapM: parseFloat(v) })
              }
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
              onChange={(v) =>
                setTopoMapBranding({ lineGapM: parseFloat(v) })
              }
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
              onChange={(v) =>
                setTopoMapBranding({ logoOpacity: parseFloat(v) })
              }
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
              onChange={(v) =>
                setTopoMapBranding({ textOpacity: parseFloat(v) })
              }
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
            <EzGammaCheckboxRow
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
          </div>
        </details>
        <details style={drillingAssayDetailsStyle}>
          <summary style={drillingAssaySummaryStyle}>Topo fog</summary>
          <div style={detailsContentStyle}>
            {!isEnv ? (
              <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
                Scene fog variables are edited in Global Settings.
              </div>
            ) : (
              <>
                <EzGammaCheckboxRow
                  label="Scene fog"
                  checked={sceneFogEnabled}
                  onChange={(checked) => setSceneFog({ enabled: checked })}
                />
                <EnvStyleRow
                  label="Fog color"
                  inputType="color"
                  value={sceneFog.color ?? scene.background ?? "#383838"}
                  onChange={(v) => setSceneFog({ color: v })}
                />
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
              </>
            )}
            <EzGammaCheckboxRow
              label="Topo fog"
              checked={topoFogIncluded}
              onChange={(checked) =>
                setPublicTopoLayerStyle({ affectedByFog: checked })
              }
            />
            <EnvStyleRow
              label="Layer dens."
              inputType="range"
              value={String(topoFogDensity * 10000)}
              min={0.01}
              max={6}
              step={0.01}
              decimals={2}
              onChange={(v) =>
                setPublicTopoLayerStyle({ fogDensity: parseFloat(v) / 10000 })
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
          </div>
        </details>
        <details style={drillingAssayDetailsStyle}>
          <summary style={drillingAssaySummaryStyle}>Topo surface style</summary>
          <div style={detailsContentStyle}>
            {!isEnv ? (
              <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
                Topo surface variables are edited in Global Settings.
              </div>
            ) : (
              <>
                <EnvSelectRow<PublicTopoMaterialPresetId>
                  label="Material"
                  value={selectedPreset}
                  options={PUBLIC_TOPO_MATERIAL_PRESETS}
                  testId="topo-material-preset"
                  onChange={setTopoMaterialPreset}
                />
                {selectedPreset === "ortho-photo" ? (
                  <>
                    <EnvSelectRow<OrthoPhotoTextureBudgetId>
                      label="Texture budget"
                      value={selectedOrthoPhotoBudget}
                      options={ORTHO_PHOTO_TEXTURE_BUDGETS}
                      testId="topo-ortho-photo-texture-budget"
                      onChange={setOrthoPhotoBudget}
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
                  </>
                ) : null}
                <EzGammaCheckboxRow
                  label="Surface color"
                  checked={terrain.surfaceElevationEnabled === true}
                  testId="topo-surface-elevation-enabled"
                  onChange={(checked) =>
                    setTerrain({
                      materialPreset:
                        checked && terrain.materialPreset !== "ortho-photo"
                          ? "surface-elevation"
                          : terrain.materialPreset === "surface-elevation"
                            ? "soft-topo"
                            : terrain.materialPreset,
                      surfaceElevationEnabled: checked,
                      surfaceElevationLegendVisible:
                        checked &&
                        terrain.surfaceElevationLegendVisible !== false,
                      surfaceElevationMinM,
                      surfaceElevationMaxM,
                      surfaceElevationColors,
                      surfaceElevationColorPositions: surfaceElevationPositions,
                      surfaceElevationMidpoints,
                      surfaceElevationTransitionSoftness,
                      surfaceElevationColorBlend,
                      surfaceElevationReverse:
                        terrain.surfaceElevationReverse === true,
                    })
                  }
                />
                <EzGammaCheckboxRow
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
                          onPointerDown={beginSurfaceElevationMidpointDrag(
                            index,
                          )}
                          onKeyDown={handleSurfaceElevationMidpointKeyDown(
                            index,
                          )}
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
                        index === 0 ||
                        index === surfaceElevationColors.length - 1;
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
                  label="Hillshade"
                  inputType="range"
                  value={String(terrain.hillshadeIntensity ?? 1.05)}
                  min={0}
                  max={2}
                  step={0.05}
                  decimals={2}
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
                  onChange={(v) =>
                    setTerrain({ shadowSharpness: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Tessellation"
                  inputType="range"
                  value={String(terrain.facetStrength ?? 0.08)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(v) =>
                    setTerrain({ facetStrength: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Edge fade"
                  inputType="range"
                  value={String(terrain.edgeFadeDistanceM ?? 90_000)}
                  min={0}
                  max={250_000}
                  step={5_000}
                  decimals={0}
                  onChange={(v) =>
                    setTerrain({ edgeFadeDistanceM: parseFloat(v) })
                  }
                  testId="topo-edge-fade-distance"
                />
                <div style={nestedControlRowStyle}>
                  <label style={nestedFieldLabelStyle}>Edge shape</label>
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
                  label="Edge distance"
                  inputType="range"
                  value={String(terrain.edgeFadeInsetM ?? 0)}
                  min={0}
                  max={250_000}
                  step={5_000}
                  decimals={0}
                  onChange={(v) =>
                    setTerrain({ edgeFadeInsetM: parseFloat(v) })
                  }
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
                  onChange={(v) =>
                    setTerrain({ edgeFadeCornerRadiusM: parseFloat(v) })
                  }
                  testId="topo-edge-fade-corner-radius"
                />
                <EnvStyleRow
                  label="Hue variance"
                  inputType="range"
                  value={String(terrain.rockHueVariance ?? 0.05)}
                  min={0}
                  max={0.2}
                  step={0.005}
                  decimals={3}
                  onChange={(v) =>
                    setTerrain({ rockHueVariance: parseFloat(v) })
                  }
                />
                <EnvStyleRow
                  label="Shadow tint"
                  inputType="color"
                  value={terrain.shadowTint ?? "#303640"}
                  onChange={(v) => setTerrain({ shadowTint: v })}
                />
              </>
            )}
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
      </div>
    </details>
  );
}

function TopoSurfaceClipControls({
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
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
  return (
    <details style={drillingAssayDetailsStyle}>
      <summary style={drillingAssaySummaryStyle}>Topo map clipping</summary>
      <div style={detailsContentStyle}>
        <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
          Clips terrain, roads, streams, and waterbodies together.
        </div>
        <LayerBooleanStyleControl
          label="Enabled"
          field="publicSurfaceClipEnabled"
          fallback={false}
          {...numberProps}
        />
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
      </div>
    </details>
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
