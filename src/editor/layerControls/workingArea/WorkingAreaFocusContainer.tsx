import { useEffect, useRef } from "react";
import { panelStyles, vibrancyTertiaryLabel } from "../../styles";
import {
  detailsContentStyle,
  nestedControlRowStyle,
  nestedDetailsStyle,
  nestedFieldLabelStyle,
  styleBoolean,
  type LayerStyleSetter,
  type PageStyleSetter,
} from "../../styleControls";
import { compactCheckboxRowStyle } from "../layout/layoutStyles";
import { editorLayerLabel } from "../layerLabels";
import { SeismicCapabilityLayerItem } from "../seismic/SeismicCapabilityLayerItem";
import { useEditor } from "../../EditorContext";
import type { EditableStyle, PresentationPage, ProjectLayerSpec } from "../../../pages/types";
import type { SceneHandle } from "../../../scene";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../../../projectModules/utahForge/layerIds";
import {
  WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY,
  WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS,
} from "../../../projectModules/utahForge/workingAreaFocus";

type WorkingAreaFocusCapability = "two-zone" | "fallback" | "unsupported";

interface WorkingAreaFocusLayerOption {
  id: string;
  label: string;
  capability: WorkingAreaFocusCapability;
  capabilityLabel: string;
}

function workingAreaFocusCapabilityForLayer(
  layerId: string,
): Pick<WorkingAreaFocusLayerOption, "capability" | "capabilityLabel"> {
  if (layerId === UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID) {
    return {
      capability: "unsupported",
      capabilityLabel: "boundary only",
    };
  }
  if (
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID ||
    layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
  ) {
    return {
      capability: "two-zone",
      capabilityLabel: "two-zone",
    };
  }
  return {
    capability: "fallback",
    capabilityLabel: "material fallback",
  };
}

function workingAreaFocusLayerOptions(
  allLayers: ProjectLayerSpec[],
): WorkingAreaFocusLayerOption[] {
  const byId = new Map(allLayers.map((layer) => [layer.id, layer]));
  return [
    UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
    UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
    UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
    UTAH_FORGE_MT_STATIONS_LAYER_ID,
    "utah-forge-reference-stage",
    "terrain",
    "transport-roads",
    "hydrography-streams",
    "hydrography-lakes",
  ]
    .map((id) => {
      const layer = byId.get(id);
      if (!layer) return null;
      const capability = workingAreaFocusCapabilityForLayer(id);
      return {
        id,
        label:
          id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
            ? "Seismic browser / survey geometry"
            : editorLayerLabel(layer),
        ...capability,
      };
    })
    .filter((layer): layer is WorkingAreaFocusLayerOption => layer !== null);
}

function workingAreaFocusDefaultTargets(
  options: WorkingAreaFocusLayerOption[],
): string[] {
  const optionIds = new Set(options.map((option) => option.id));
  return WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS.filter((id) =>
    optionIds.has(id),
  );
}

function workingAreaFocusTargetSet(
  style: EditableStyle,
  options: WorkingAreaFocusLayerOption[],
): Set<string> {
  const configured = Array.isArray(style.workingAreaFocusTargetLayerIds)
    ? style.workingAreaFocusTargetLayerIds.filter(
        (id) => typeof id === "string",
      )
    : workingAreaFocusDefaultTargets(options);
  const supportedIds = new Set(
    options
      .filter((option) => option.capability !== "unsupported")
      .map((option) => option.id),
  );
  return new Set(configured.filter((id) => supportedIds.has(id)));
}

function workingAreaFocusOpacityForLayer(
  style: EditableStyle,
  layerId: string,
): number {
  const value = style.workingAreaFocusOutsideOpacityByLayerId?.[layerId];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY;
}

function completeWorkingAreaFocusOpacityMap(
  style: EditableStyle,
  options: WorkingAreaFocusLayerOption[],
  patch: Record<string, number> = {},
): Record<string, number> {
  return Object.fromEntries(
    options
      .filter((option) => option.capability !== "unsupported")
      .map((option) => [
        option.id,
        Math.max(
          0,
          Math.min(
            1,
            typeof patch[option.id] === "number"
              ? patch[option.id]
              : workingAreaFocusOpacityForLayer(style, option.id),
          ),
        ),
      ]),
  );
}

function workingAreaFocusPatchFromStyle(
  style: EditableStyle,
  options: WorkingAreaFocusLayerOption[],
): Partial<EditableStyle> {
  const targetLayerIds = workingAreaFocusTargetSet(style, options);
  return {
    workingAreaFocusEnabled: styleBoolean(
      style,
      "workingAreaFocusEnabled",
      false,
    ),
    workingAreaFocusMode:
      style.workingAreaFocusMode === "inside-only"
        ? "inside-only"
        : "outside-context",
    workingAreaFocusBoundsLayerId:
      style.workingAreaFocusBoundsLayerId ??
      UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
    workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
    workingAreaFocusOutsideOpacityByLayerId:
      completeWorkingAreaFocusOpacityMap(style, options),
    workingAreaFocusHelperVisible: styleBoolean(
      style,
      "workingAreaFocusHelperVisible",
      true,
    ),
  };
}

export function WorkingAreaFocusContainer({
  allLayers,
  style,
  disabled,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  allLayers: ProjectLayerSpec[];
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const { canApplyLiveSceneEdits } = useEditor();
  const layerOptions = workingAreaFocusLayerOptions(allLayers);
  const targetLayerIds = workingAreaFocusTargetSet(style, layerOptions);
  const enabled = styleBoolean(style, "workingAreaFocusEnabled", false);
  const mode =
    style.workingAreaFocusMode === "inside-only"
      ? "inside-only"
      : "outside-context";
  const helperVisible = styleBoolean(
    style,
    "workingAreaFocusHelperVisible",
    true,
  );
  const liveStyleRef = useRef(style);
  useEffect(() => {
    liveStyleRef.current = style;
  }, [style]);

  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    const base = liveStyleRef.current;
    const merged = {
      ...base,
      workingAreaFocusBoundsLayerId:
        base.workingAreaFocusBoundsLayerId ??
        UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
      workingAreaFocusOutsideOpacityByLayerId:
        completeWorkingAreaFocusOpacityMap(base, layerOptions),
      ...patch,
    };
    liveStyleRef.current = merged;
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(
        UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
        merged,
      );
    }
    const persistedPatch = workingAreaFocusPatchFromStyle(merged, layerOptions);
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID, persistedPatch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
        persistedPatch,
      );
    }
  };

  const commitTargetLayerIds = (nextTargets: Set<string>) => {
    commit({
      workingAreaFocusTargetLayerIds: Array.from(nextTargets),
      workingAreaFocusOutsideOpacityByLayerId:
        completeWorkingAreaFocusOpacityMap(liveStyleRef.current, layerOptions),
    });
  };

  const toggleLayerTarget = (id: string, checked: boolean) => {
    const next = new Set(targetLayerIds);
    if (checked) next.add(id);
    else next.delete(id);
    commitTargetLayerIds(next);
  };

  const updateOutsideOpacity = (id: string, value: number) => {
    commit({
      workingAreaFocusOutsideOpacityByLayerId:
        completeWorkingAreaFocusOpacityMap(liveStyleRef.current, layerOptions, {
          [id]: value,
        }),
    });
  };

  return (
    <SeismicCapabilityLayerItem
      title="Working area focus"
      type="clip"
      testId="working-area-focus-container"
      inactive={!enabled}
      visible={enabled}
      visibilityDisabled={disabled}
      onVisibleChange={(visible) =>
        commit({
          workingAreaFocusEnabled: visible,
          workingAreaFocusMode: mode,
          workingAreaFocusBoundsLayerId:
            UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
          workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
          workingAreaFocusOutsideOpacityByLayerId:
            completeWorkingAreaFocusOpacityMap(
              liveStyleRef.current,
              layerOptions,
            ),
        })
      }
    >
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Enable focus</span>
          <input
            data-testid="working-area-focus-enabled"
            type="checkbox"
            disabled={disabled}
            checked={enabled}
            onChange={(event) =>
              commit({
                workingAreaFocusEnabled: event.target.checked,
                workingAreaFocusMode: mode,
                workingAreaFocusBoundsLayerId:
                  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
                workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
                workingAreaFocusOutsideOpacityByLayerId:
                  completeWorkingAreaFocusOpacityMap(
                    liveStyleRef.current,
                    layerOptions,
                  ),
              })
            }
          />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Mode</label>
          <select
            data-testid="working-area-focus-mode"
            disabled={disabled}
            value={mode}
            onChange={(event) =>
              commit({
                workingAreaFocusMode:
                  event.target.value === "inside-only"
                    ? "inside-only"
                    : "outside-context",
                workingAreaFocusOutsideOpacityByLayerId:
                  completeWorkingAreaFocusOpacityMap(
                    liveStyleRef.current,
                    layerOptions,
                  ),
              })
            }
            style={{ flex: 1 }}
          >
            <option value="outside-context">Dim outside</option>
            <option value="inside-only">Hide outside</option>
          </select>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Show box</span>
          <input
            data-testid="working-area-focus-helper-visible"
            type="checkbox"
            disabled={disabled}
            checked={helperVisible}
            onChange={(event) =>
              commit({ workingAreaFocusHelperVisible: event.target.checked })
            }
          />
        </label>
        <details style={nestedDetailsStyle}>
          <summary style={panelStyles.summary}>Affected layers</summary>
          <div style={detailsContentStyle}>
            {layerOptions.map((layer) => {
              const supported = layer.capability !== "unsupported";
              const checked = supported && targetLayerIds.has(layer.id);
              const opacity = workingAreaFocusOpacityForLayer(style, layer.id);
              const sliderDisabled =
                disabled || !supported || !checked || mode === "inside-only";
              return (
                <div
                  key={layer.id}
                  style={{
                    marginBottom: 6,
                    opacity: supported ? 1 : 0.48,
                  }}
                >
                  <label
                    style={{
                      ...compactCheckboxRowStyle,
                      cursor: supported ? "pointer" : "not-allowed",
                    }}
                  >
                    <input
                      data-testid={`working-area-focus-target-${layer.id}`}
                      type="checkbox"
                      disabled={disabled || !supported}
                      checked={checked}
                      onChange={(event) =>
                        toggleLayerTarget(layer.id, event.target.checked)
                      }
                    />
                    <span>
                      {layer.label}
                      <span style={{ color: vibrancyTertiaryLabel }}>
                        {" "}
                        {layer.capabilityLabel}
                      </span>
                    </span>
                  </label>
                  {supported ? (
                    <div style={{ ...nestedControlRowStyle, paddingLeft: 18 }}>
                      <label style={nestedFieldLabelStyle}>Outside</label>
                      <input
                        data-testid={`working-area-focus-opacity-${layer.id}`}
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={sliderDisabled}
                        value={opacity}
                        onChange={(event) =>
                          updateOutsideOpacity(
                            layer.id,
                            parseFloat(event.target.value),
                          )
                        }
                        style={
                          {
                            flex: 1,
                            opacity: sliderDisabled ? 0.45 : 1,
                            "--editor-slider-fill": `${opacity * 100}%`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </SeismicCapabilityLayerItem>
  );
}
