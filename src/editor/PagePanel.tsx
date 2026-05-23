import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useEditor } from "./EditorContext";
import { usePageController } from "../pages/PageController";
import { capturePose } from "../pages/capturePose";
import {
  isUserRenderPresetId,
  renderPresetOptionsForEnvironment,
} from "../pages/renderPresets";
import {
  EDITOR_PAGE_LIST_INDENT_X,
  EDITOR_PILL_TEXT_INSET_PX,
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  editorFieldBackground,
  editorFieldBorder,
  frostedSubheading,
  globalSettingsAccent,
  globalSettingsHoverAccent,
  pageAccentForPage,
  pageAccentHexForIndex,
  panelStyles,
  regularLightMaterial,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import { ENVIRONMENT_SENTINEL } from "./types";
import { InlineEditableTitle } from "./InlineEditableTitle";
import {
  CameraSetupPanel,
  EnvironmentScenePanel,
  GuiSetupPanel,
} from "./EnvironmentScenePanel";
import type {
  DynamicCamera,
  EasingName,
  Pose,
  PresentationPage,
  RenderPresetId,
  Vec3,
} from "../pages/types";
import type { SceneHandle } from "../scene";

const PAGE_EASINGS: EasingName[] = [
  "linear",
  "easeInOutCubic",
  "easeOutCubic",
  "easeOutQuart",
  "easeInOutSine",
];

interface Props {
  sceneHandle: SceneHandle;
  showGlobalPageCameras: boolean;
  onToggleGlobalPageCameras: () => void;
  onShowGlobalPageCameras: () => void;
}

export function PagePanel({
  sceneHandle,
  showGlobalPageCameras,
  onToggleGlobalPageCameras,
  onShowGlobalPageCameras,
}: Props) {
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);
  const [visualSelectedPageId, setVisualSelectedPageId] = useState<
    string | null
  >(ENVIRONMENT_SENTINEL);
  const navigationFrameRef = useRef<number | null>(null);
  const navigationPaintFrameRef = useRef<number | null>(null);
  const {
    state,
    addPage,
    deletePageById,
    duplicatePageById,
    reorderPage,
    selectPage,
    setPageField,
    resetPageOverrides,
  } = useEditor();
  const { currentIndex, goto, isTransitioning, targetIndex } =
    usePageController();
  const selectedActionPage =
    state.pages.find((p) => p.id === visualSelectedPageId) ??
    (state.selectedPageId && state.selectedPageId !== ENVIRONMENT_SENTINEL
      ? state.pages.find((p) => p.id === state.selectedPageId)
      : null);
  const selectedActionPageIndex = selectedActionPage
    ? state.pages.findIndex((page) => page.id === selectedActionPage.id)
    : -1;
  const selectedActionPageAccent =
    selectedActionPage && selectedActionPageIndex >= 0
      ? pageAccentForPage(selectedActionPage, selectedActionPageIndex)
      : null;
  const globalSettingsSelected = visualSelectedPageId === ENVIRONMENT_SENTINEL;
  const renderPresetOptions = renderPresetOptionsForEnvironment(
    state.environment,
  );

  useEffect(() => {
    setVisualSelectedPageId(state.selectedPageId);
  }, [state.selectedPageId]);

  useEffect(() => {
    return () => {
      if (navigationFrameRef.current !== null) {
        window.cancelAnimationFrame(navigationFrameRef.current);
      }
      if (navigationPaintFrameRef.current !== null) {
        window.cancelAnimationFrame(navigationPaintFrameRef.current);
      }
    };
  }, []);

  const cancelPendingNavigation = () => {
    if (navigationFrameRef.current !== null) {
      window.cancelAnimationFrame(navigationFrameRef.current);
      navigationFrameRef.current = null;
    }
    if (navigationPaintFrameRef.current !== null) {
      window.cancelAnimationFrame(navigationPaintFrameRef.current);
      navigationPaintFrameRef.current = null;
    }
  };

  const moveCameraAfterSelectionPaint = (index: number) => {
    cancelPendingNavigation();
    navigationFrameRef.current = window.requestAnimationFrame(() => {
      navigationFrameRef.current = null;
      navigationPaintFrameRef.current = window.requestAnimationFrame(() => {
        navigationPaintFrameRef.current = null;
        goto(index);
      });
    });
  };

  const selectPageImmediately = (pageId: string) => {
    flushSync(() => {
      setVisualSelectedPageId(pageId);
      selectPage(pageId);
    });
  };

  const selectGlobalSettings = () => {
    cancelPendingNavigation();
    selectPageImmediately(ENVIRONMENT_SENTINEL);
  };

  const selectPageThenMoveCamera = (pageId: string, index: number) => {
    selectPageImmediately(pageId);
    moveCameraAfterSelectionPaint(index);
  };

  const onAdd = () => {
    const pose = capturePose(sceneHandle.camera, sceneHandle.controls);
    const id = addPage(pose);
    const idx = state.pages.length;
    selectPage(id);
    goto(idx);
  };

  const onDuplicateSelected = () => {
    if (!selectedActionPage) return;
    const sourceIndex = state.pages.findIndex(
      (page) => page.id === selectedActionPage.id,
    );
    const id = duplicatePageById(selectedActionPage.id);
    if (!id) return;
    setVisualSelectedPageId(id);
    if (sourceIndex >= 0) {
      moveCameraAfterSelectionPaint(sourceIndex + 1);
    }
  };

  return (
    <div
      style={panelStyles.body}
      data-dev-source="src/editor/PagePanel.tsx:40"
      data-dev-note="PagePanel contains Global Settings plus the Pages select/order list."
    >
      <div
        style={globalSettingsSelectorStyle}
        data-dev-source="src/editor/PagePanel.tsx:244"
        data-dev-note="globalSettingsSelectorStyle aligns the Global Settings selector with the Global Settings containers."
      >
        <div
          data-dev-source="src/editor/styles.ts:205"
          data-dev-padding-source="src/editor/styles.ts:216"
          data-dev-note="Global Settings is an editor-only pseudo-page. It selects environment/global controls and is not part of presenter navigation."
          style={{
            ...panelStyles.globalSettingsBar,
            background: globalSettingsSelected
              ? globalSettingsAccent
              : frostedSubheading.background,
            ...(hoveredPageId === ENVIRONMENT_SENTINEL &&
            !globalSettingsSelected
              ? pageRowHoverStyle(globalSettingsHoverAccent)
              : {}),
          }}
          onMouseEnter={() => setHoveredPageId(ENVIRONMENT_SENTINEL)}
          onMouseLeave={() =>
            setHoveredPageId((id) =>
              id === ENVIRONMENT_SENTINEL ? null : id,
            )
          }
          onPointerDownCapture={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("button,input,label")) return;
            selectGlobalSettings();
          }}
          onClick={selectGlobalSettings}
        >
          <span
            style={{
              flex: 1,
              fontWeight: globalSettingsSelected ? 600 : 400,
              color: globalSettingsSelected
                ? vibrancyLabel
                : vibrancySecondaryLabel,
              display: "flex",
              alignItems: "center",
              minWidth: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {(state.dirty.has("environment") || state.dirty.has("project")) && (
              <span style={dirtyDotStyle} title="Unsaved global changes">
                •
              </span>
            )}
            <span
              style={{ marginRight: 4 }}
              data-dev-text-source="src/editor/PagePanel.tsx:90"
            >
              00.
            </span>
            <span>Global Settings</span>
          </span>
          <span style={globalSettingsActionSlotStyle}>
            <button
              className="editor-action-button"
              data-dev-source="src/editor/PagePanel.tsx:195"
              data-dev-note="Global Settings camera button toggles the in-scene page camera markers."
              style={pageManagerIconButtonStyle({
                surface: globalSettingsSelected ? "tinted" : "dark",
              })}
              onClick={(e) => {
                e.stopPropagation();
                if (globalSettingsSelected) {
                  onToggleGlobalPageCameras();
                } else {
                  selectGlobalSettings();
                  onShowGlobalPageCameras();
                }
              }}
              title={
                showGlobalPageCameras
                  ? "Hide page cameras"
                  : "Show page cameras"
              }
              aria-label={
                showGlobalPageCameras
                  ? "Hide page cameras"
                  : "Show page cameras"
              }
              aria-pressed={showGlobalPageCameras}
            >
              <CameraIcon />
            </button>
          </span>
        </div>
      </div>

      <div
        style={pageListStyle}
        data-dev-source="src/editor/PagePanel.tsx:244"
        data-dev-note="pageListStyle controls the indentation and spacing of page rows."
      >
        {state.pages.map((p, i) => {
          const pageHidden = p.hidden === true;
          const pageIsChosen = p.id === visualSelectedPageId;
          const pageHasLanded =
            pageIsChosen &&
            i === currentIndex &&
            !isTransitioning &&
            targetIndex === null;
          const pageIsWaiting = pageIsChosen && !pageHasLanded;
          const hovered = p.id === hoveredPageId;
          const pageAccent = pageAccentForPage(p, i);
          const pageHoverAccent = pageAccentForPage(p, i, 0.384);
          const pagePendingAccent = pageAccentForPage(p, i, 0.192);
          const pageAccentHex = p.accentColor ?? pageAccentHexForIndex(i);
          const actionSurface = pageIsChosen ? "tinted" : "dark";
          return (
            <div
              key={p.id}
              data-dev-source="src/editor/styles.ts:135"
              data-dev-padding-source="src/editor/styles.ts:140"
              data-dev-note="panelStyles.pageRow and pageRowSelected control page row shape, selection material, and row spacing."
              style={{
                ...panelStyles.pageRow,
                ...(hovered && !pageIsChosen
                  ? pageRowHoverStyle(pageHoverAccent)
                  : {}),
                ...(pageIsWaiting
                  ? waitingPageRowStyle(pagePendingAccent, pageHoverAccent)
                  : {}),
                ...(pageHasLanded
                  ? {
                      ...panelStyles.pageRowSelected,
                      ...selectedPageRowStyle(pageAccent),
                    }
                  : {}),
                ...(pageHidden ? hiddenPageRowStyle : {}),
              }}
              onMouseEnter={() => setHoveredPageId(p.id)}
              onMouseLeave={() =>
                setHoveredPageId((id) => (id === p.id ? null : id))
              }
              onPointerDownCapture={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest("button,input,label")) return;
                selectPageImmediately(p.id);
              }}
              onClick={() => {
                selectPageThenMoveCamera(p.id, i);
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontWeight: pageHasLanded ? 600 : 400,
                  color: pageHidden
                    ? vibrancyTertiaryLabel
                    : pageIsChosen
                      ? vibrancyLabel
                      : vibrancySecondaryLabel,
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {(state.dirty.has(`page:${p.id}`) ||
                  state.dirty.has(`overlay:${p.id}`)) && (
                  <span style={dirtyDotStyle} title="Unsaved changes">
                    •
                  </span>
                )}
                <span
                  style={{ marginRight: 4 }}
                  data-dev-text-source="src/editor/PagePanel.tsx:90"
                >
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <InlineEditableTitle
                  value={p.title}
                  onCommit={(next) => setPageField(p.id, { title: next })}
                  title={p.title}
                  truncate
                  textStyle={{
                    fontWeight: pageHasLanded ? 600 : 400,
                    color: pageHidden
                      ? vibrancyTertiaryLabel
                      : pageIsChosen
                        ? vibrancyLabel
                        : vibrancySecondaryLabel,
                  }}
                />
              </span>
              <span style={pageRowActionsStyle}>
                <label
                  data-dev-source="src/editor/PagePanel.tsx:322"
                  data-dev-note="Page color circle stores the page accent color used for row and section fill states."
                  style={pageColorButtonStyle(pageAccent)}
                  title="Change page color"
                  aria-label="Change page color"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="color"
                    value={pageAccentHex}
                    style={pageColorInputStyle}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setPageField(p.id, {
                        accentColor: e.currentTarget.value,
                      })
                    }
                  />
                </label>
                <button
                  className="editor-action-button"
                  data-dev-source="src/editor/styles.ts:148"
                  data-dev-note="panelStyles.iconButton controls these reorder/show-hide/delete button circles."
                  style={pageManagerIconButtonStyle({
                    surface: actionSurface,
                    disabled: i === 0,
                  })}
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderPage(p.id, "up");
                  }}
                  title="Move up"
                  aria-label="Move page up"
                >
                  <span style={upTriangleIconStyle} aria-hidden="true" />
                </button>
                <button
                  className="editor-action-button"
                  data-dev-source="src/editor/styles.ts:148"
                  data-dev-note="panelStyles.iconButton controls these reorder/show-hide/delete button circles."
                  style={pageManagerIconButtonStyle({
                    surface: actionSurface,
                    disabled: i === state.pages.length - 1,
                  })}
                  disabled={i === state.pages.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderPage(p.id, "down");
                  }}
                  title="Move down"
                  aria-label="Move page down"
                >
                  <span style={downTriangleIconStyle} aria-hidden="true" />
                </button>
                <button
                  className="editor-action-button"
                  data-dev-source="src/editor/styles.ts:148"
                  data-dev-note="panelStyles.iconButton controls these reorder/show-hide/delete button circles."
                  style={pageManagerIconButtonStyle({ surface: actionSurface })}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPageField(p.id, { hidden: !pageHidden });
                  }}
                  title={pageHidden ? "Show page" : "Hide page"}
                  aria-label={pageHidden ? "Show page" : "Hide page"}
                >
                  {pageHidden ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <button
                  className="editor-action-button"
                  data-dev-source="src/editor/styles.ts:148"
                  data-dev-note="panelStyles.iconButton controls these reorder/show-hide/delete button circles."
                  style={pageManagerIconButtonStyle({
                    surface: actionSurface,
                    disabled: state.pages.length <= 1,
                  })}
                  disabled={state.pages.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete page "${p.title}"?`)) {
                      deletePageById(p.id);
                    }
                  }}
                  title="Delete"
                  aria-label="Delete page"
                >
                  <TrashIcon />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={pageActionsStyle}
        data-dev-source="src/editor/PagePanel.tsx:280"
        data-dev-note="pageActionsStyle aligns Pages action buttons to the delete button right edge."
      >
        <span style={pageFooterActionsStyle}>
          <button
            className="editor-action-button"
            style={pageFooterActionButtonStyle(36)}
            onClick={onAdd}
          >
            Add
          </button>
          <button
            className="editor-action-button"
            style={pageFooterActionButtonStyle(76, !selectedActionPage)}
            disabled={!selectedActionPage}
            onClick={onDuplicateSelected}
            title={
              selectedActionPage
                ? `Duplicate ${selectedActionPage.title}`
                : "Select a page first"
            }
          >
            Duplicate
          </button>
          <button
            className="editor-action-button"
            style={pageFooterActionButtonStyle(44, !selectedActionPage)}
            disabled={!selectedActionPage}
            onClick={() => {
              if (!selectedActionPage) return;
              if (
                confirm(
                  `Reset page "${selectedActionPage.title}" to Global Settings defaults? Camera, dynamic camera, title, timing, and text/image overlays will be preserved.`,
                )
              ) {
                resetPageOverrides(selectedActionPage.id);
              }
            }}
            title="Strip layer, visibility, exposure, and bloom overrides from the selected page only."
          >
            Reset
          </button>
        </span>
      </div>

      {!globalSettingsSelected && selectedActionPage && (
        <RenderPresetContainer
          title="Page Render Preset Override"
          label="Page preset"
          value={
            selectedActionPage.renderPreset ??
            selectedActionPage.renderPresetId ??
            ""
          }
          options={renderPresetOptions}
          accentColor={selectedActionPageAccent}
          emptyLabel="Inherit project preset"
          onChange={(value) =>
            setPageField(selectedActionPage.id, {
              renderPreset: value ? (value as RenderPresetId) : undefined,
              renderPresetId: undefined,
            })
          }
        />
      )}
    </div>
  );
}

interface GlobalToolPanelProps {
  accentColor?: string | null;
}

export function VisualStudioPanel({
  accentColor = globalSettingsAccent,
}: GlobalToolPanelProps) {
  const {
    state,
    selectPage,
    setEnvRenderPreset,
    saveEnvCustomRenderPreset,
    updateSelectedEnvCustomRenderPreset,
  } = useEditor();
  const renderPresetOptions = renderPresetOptionsForEnvironment(
    state.environment,
  );
  const selectedProjectPresetIsCustom = isUserRenderPresetId(
    state.environment,
    state.environment.renderPreset,
  );
  const activateGlobalSettings = useCallback(() => {
    selectPage(ENVIRONMENT_SENTINEL);
  }, [selectPage]);

  return (
    <div
      style={globalToolPanelBodyStyle}
      onPointerDownCapture={activateGlobalSettings}
    >
      <RenderPresetContainer
        title="Cinematic Render Preset"
        label="Project preset"
        value={state.environment.renderPreset ?? ""}
        options={renderPresetOptions}
        accentColor={accentColor}
        emptyLabel="Current / Custom"
        revertLabel="Revert to Current / Custom"
        saveCustomLabel="Save Custom Preset"
        updateCustomLabel="Update Selected Custom Preset"
        showUpdateCustom={selectedProjectPresetIsCustom}
        onSaveCustom={saveEnvCustomRenderPreset}
        onUpdateCustom={updateSelectedEnvCustomRenderPreset}
        onChange={(value) =>
          setEnvRenderPreset(value ? (value as RenderPresetId) : null)
        }
      />
      <EnvironmentScenePanel
        title="Environment"
        onActivate={activateGlobalSettings}
        accentColor={accentColor}
      />
      <EnvironmentScenePanel
        title="Lighting Studio"
        content="lighting"
        onActivate={activateGlobalSettings}
        accentColor={accentColor}
      />
      <CameraSetupPanel
        title="Camera Studio"
        onActivate={activateGlobalSettings}
        accentColor={accentColor}
      />
      <EnvironmentScenePanel
        title="Terrain grid"
        content="terrain"
        onActivate={activateGlobalSettings}
        accentColor={accentColor}
      />
    </div>
  );
}

export function UiSettingsPanel({
  accentColor = globalSettingsAccent,
}: GlobalToolPanelProps) {
  const { selectPage } = useEditor();
  const activateGlobalSettings = useCallback(() => {
    selectPage(ENVIRONMENT_SENTINEL);
  }, [selectPage]);

  return (
    <div
      style={globalToolPanelBodyStyle}
      onPointerDownCapture={activateGlobalSettings}
    >
      <GuiSetupPanel
        title="Client Logo"
        content="logo"
        onActivate={activateGlobalSettings}
        accentColor={accentColor}
      />
      <GuiSetupPanel
        title="GUI Styles"
        content="overlay"
        onActivate={activateGlobalSettings}
        accentColor={accentColor}
      />
    </div>
  );
}

function RenderPresetContainer({
  title,
  label,
  value,
  options,
  accentColor,
  emptyLabel,
  revertLabel,
  saveCustomLabel,
  updateCustomLabel,
  showUpdateCustom,
  onSaveCustom,
  onUpdateCustom,
  onChange,
}: {
  title: string;
  label: string;
  value: RenderPresetId | "";
  options: Array<{ value: string; label: string }>;
  accentColor?: string | null;
  emptyLabel: string;
  revertLabel?: string;
  saveCustomLabel?: string;
  updateCustomLabel?: string;
  showUpdateCustom?: boolean;
  onSaveCustom?: () => unknown;
  onUpdateCustom?: () => unknown;
  onChange: (value: RenderPresetId | "") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section style={renderPresetGroupStyle} aria-label={title}>
      <button
        type="button"
        style={renderPresetHeadingStyle(accentColor)}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span style={renderPresetHeadingTextStyle}>{title}</span>
        <span style={renderPresetDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...renderPresetChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>

      {open && (
        <div style={renderPresetBodyStyle}>
          <label style={renderPresetControlRowStyle}>
            <span style={renderPresetFieldLabelStyle}>{label}</span>
            <select
              value={value}
              onChange={(event) =>
                onChange(event.currentTarget.value as RenderPresetId | "")
              }
              style={renderPresetSelectStyle}
            >
              <option value="">{emptyLabel}</option>
              {options.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {(saveCustomLabel || (revertLabel && value) || showUpdateCustom) && (
            <div style={renderPresetButtonRowStyle}>
              {saveCustomLabel && onSaveCustom && (
                <button
                  type="button"
                  className="editor-action-button"
                  style={renderPresetSmallButtonStyle}
                  onClick={() => onSaveCustom()}
                >
                  {saveCustomLabel}
                </button>
              )}
              {showUpdateCustom && updateCustomLabel && onUpdateCustom && (
                <button
                  type="button"
                  className="editor-action-button"
                  style={renderPresetSmallButtonStyle}
                  onClick={() => onUpdateCustom()}
                >
                  {updateCustomLabel}
                </button>
              )}
              {revertLabel && value && (
                <button
                  type="button"
                  className="editor-action-button"
                  style={renderPresetSmallButtonStyle}
                  onClick={() => onChange("")}
                >
                  {revertLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface DynamicCameraPanelProps {
  page: PresentationPage;
  sceneHandle: SceneHandle;
  disabled: boolean;
  setPageField: (
    pageId: string,
    patch: Partial<
      Pick<PresentationPage, "dynamicCamera" | "holdDuration">
    >,
  ) => void;
  capturePoseForPage: (pageId: string, pose: PresentationPage["camera"]) => void;
  pageAccent: string;
}

export function DynamicCameraPanel({
  page,
  sceneHandle,
  disabled,
  setPageField,
  capturePoseForPage,
  pageAccent,
}: DynamicCameraPanelProps) {
  const [pickingOrbitCenter, setPickingOrbitCenter] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const {
    setPageTransition,
    getPoseHistory,
    restorePoseFromHistory,
  } = useEditor();
  const { tweenToPose } = usePageController();
  const cfg = dynamicCameraForPage(page);
  const distanceMax = Math.max(
    5000,
    Math.ceil((cfg.orbitRadius ?? 5000) * 1.75 / 100) * 100,
  );
  const heightValue = cfg.orbitHeight ?? 0;
  const heightMin = Math.min(-2500, Math.floor((heightValue - 1000) / 100) * 100);
  const heightMax = Math.max(5000, Math.ceil((heightValue + 1000) / 100) * 100);
  const orbitDirection = cfg.orbitDirection === -1 ? -1 : 1;
  const dynamicMovementEnabled = cfg.enabled === true;
  const orbitEnabled = cfg.orbitEnabled !== false;
  const zoomEnabled = cfg.zoomEnabled === true;
  const movementControlsDisabled = disabled || !dynamicMovementEnabled;
  const orbitControlsDisabled = movementControlsDisabled || !orbitEnabled;
  const zoomControlsDisabled = movementControlsDisabled || !zoomEnabled;

  const writeDynamic = useCallback((patch: Partial<DynamicCamera>) => {
    const next: DynamicCamera = {
      ...cfg,
      ...(page.dynamicCamera ?? {}),
      ...patch,
      mode: "orbit",
    };
    setPageField(page.id, { dynamicCamera: next });
  }, [cfg, page.dynamicCamera, page.id, setPageField]);

  const saveCurrentCameraAsPageStart = useCallback(
    (target: Vec3) => {
      const pose = capturePose(sceneHandle.camera, sceneHandle.controls);
      capturePoseForPage(page.id, { ...pose, target });
    },
    [capturePoseForPage, page.id, sceneHandle],
  );

  const writeOrbitPoint = useCallback(
    (rawPoint: Vec3) => {
      const poi: Vec3 = [
        roundSceneValue(rawPoint[0]),
        roundSceneValue(rawPoint[1]),
        roundSceneValue(rawPoint[2]),
      ];
      const position = sceneHandle.camera.position;
      writeDynamic({
        poi,
        orbitRadius: roundSceneValue(
          Math.max(1, Math.hypot(position.x - poi[0], position.y - poi[1])),
        ),
        orbitHeight: roundSceneValue(position.z - poi[2]),
      });
      saveCurrentCameraAsPageStart(poi);
      sceneHandle.setDynamicCameraOrbitCenter(poi, orbitDirection);
    },
    [orbitDirection, saveCurrentCameraAsPageStart, sceneHandle, writeDynamic],
  );

  const setPointFromView = () => {
    const target = sceneHandle.controls.target;
    const position = sceneHandle.camera.position;
    const poi: Vec3 = [
      roundSceneValue(target.x),
      roundSceneValue(target.y),
      roundSceneValue(target.z),
    ];
    writeDynamic({
      poi,
      orbitRadius: roundSceneValue(
        Math.max(1, Math.hypot(position.x - target.x, position.y - target.y)),
      ),
      orbitHeight: roundSceneValue(position.z - target.z),
    });
    saveCurrentCameraAsPageStart(poi);
    sceneHandle.setDynamicCameraOrbitCenter(poi, orbitDirection);
  };

  const updateOrbitPointFromFields = (poi: Vec3) => {
    writeDynamic({ poi });
    sceneHandle.setDynamicCameraOrbitCenter(poi, orbitDirection);
  };

  const toggleScreenPick = () => {
    if (pickingOrbitCenter) {
      sceneHandle.cancelDynamicCameraOrbitCenterPick();
      setPickingOrbitCenter(false);
      return;
    }
    setPickingOrbitCenter(true);
    sceneHandle.beginDynamicCameraOrbitCenterPick((poi) => {
      writeOrbitPoint(poi);
      setPickingOrbitCenter(false);
    });
  };

  useEffect(() => {
    sceneHandle.setDynamicCameraOrbitCenter(
      page.dynamicCamera?.poi ?? null,
      orbitDirection,
    );
  }, [
    orbitDirection,
    sceneHandle,
    page.id,
    page.dynamicCamera?.poi?.[0],
    page.dynamicCamera?.poi?.[1],
    page.dynamicCamera?.poi?.[2],
  ]);

  useEffect(() => {
    sceneHandle.setDynamicCameraOrbitCenterCommitHandler(writeOrbitPoint);
    return () => sceneHandle.setDynamicCameraOrbitCenterCommitHandler(null);
  }, [sceneHandle, writeOrbitPoint]);

  useEffect(() => {
    setPickingOrbitCenter(false);
    setHistoryOpen(false);
    sceneHandle.cancelDynamicCameraOrbitCenterPick();
  }, [sceneHandle, page.id]);

  useEffect(() => {
    return () => {
      sceneHandle.cancelDynamicCameraOrbitCenterPick();
      sceneHandle.setDynamicCameraOrbitCenter(null);
      sceneHandle.setDynamicCameraOrbitCenterCommitHandler(null);
    };
  }, [sceneHandle]);

  return (
    <div style={dynamicCameraPanelStyle(pageAccent)}>
      <DynamicCameraPoseCapture
        page={page}
        sceneHandle={sceneHandle}
        disabled={disabled}
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
        capturePoseForPage={capturePoseForPage}
        getPoseHistory={getPoseHistory}
        restorePoseFromHistory={restorePoseFromHistory}
        tweenToPose={tweenToPose}
      />
      <DynamicCameraGroup
        title="Camera transitions"
        state="neutral"
        accentColor={pageAccent}
      >
        <DynamicCameraPageTiming
          page={page}
          setPageField={setPageField}
          setPageTransition={setPageTransition}
        />
      </DynamicCameraGroup>
      <DynamicCameraGroup
        title="Dynamic movement"
        state={dynamicMovementEnabled ? "active" : "inactive"}
        accentColor={pageAccent}
        bodyVariant="sections"
      >
        <DynamicMasterToggleRow
          label="Use Dynamic Movement"
          value={dynamicMovementEnabled}
          disabled={disabled}
          onChange={(enabled) => {
            if (!enabled) {
              sceneHandle.cancelDynamicCameraOrbitCenterPick();
              setPickingOrbitCenter(false);
            }
            writeDynamic({ enabled });
          }}
        />
        <DynamicCameraSubsection
          title="Camera Target"
          muted={!dynamicMovementEnabled}
        >
          <div style={dynamicCameraButtonRowStyle}>
            <button
              className="editor-action-button"
              style={{
                ...dynamicCameraMiniButtonStyle,
                ...(pickingOrbitCenter ? dynamicCameraPickingButtonStyle : {}),
                opacity: movementControlsDisabled ? 0.55 : 1,
              }}
              disabled={movementControlsDisabled}
              onClick={toggleScreenPick}
              title="Click a point on the terrain to make it this page's orbit center."
            >
              {pickingOrbitCenter ? "Place orbit" : "Select orbit"}
            </button>
            <button
              className="editor-action-button"
              style={{
                ...dynamicCameraMiniButtonStyle,
                opacity: movementControlsDisabled ? 0.55 : 1,
              }}
              disabled={movementControlsDisabled}
              onClick={setPointFromView}
              title="Use the current OrbitControls target as this page's orbit point."
            >
              Cam rotate
            </button>
            <button
              className="editor-action-button"
              style={{
                ...dynamicCameraMiniButtonStyle,
                opacity: movementControlsDisabled ? 0.55 : 1,
              }}
              disabled={movementControlsDisabled}
              onClick={() => {
                const poi = page.camera.target;
                writeDynamic({
                  orbitEnabled: true,
                  poi,
                  orbitRadius: defaultOrbitRadius(page),
                  orbitHeight: defaultOrbitHeight(page, poi),
                  zoomFov: page.camera.fov,
                  zoomEnabled: false,
                  zoomDeltaFov: 0,
                  zoomStartMs: 0,
                  zoomEndMs: 2500,
                  zoomCurve: "smooth",
                  orbitSpeedDegPerSec: 4,
                  orbitDirection: 1,
                  easeInMs: 1600,
                  transitionLeadMs: 1600,
                  transitionExitMs: 900,
                  transitionBlendCurve: "smooth",
                  pathAwareBlend: false,
                });
                sceneHandle.setDynamicCameraOrbitCenter(poi, 1);
              }}
            >
              Reset
            </button>
          </div>
          <DynamicVectorRow
            label="Target"
            value={cfg.poi ?? page.camera.target}
            disabled={movementControlsDisabled}
            onChange={updateOrbitPointFromFields}
          />
        </DynamicCameraSubsection>

        <DynamicCameraSubsection
          title="Camera Orbit"
          muted={!dynamicMovementEnabled || !orbitEnabled}
          action={
            <DynamicCheckToggle
              value={orbitEnabled}
              disabled={disabled || !dynamicMovementEnabled}
              onChange={(orbitEnabled) => writeDynamic({ orbitEnabled })}
            />
          }
        >
          <DynamicRangeRow
            label="Speed"
            value={cfg.orbitSpeedDegPerSec ?? 4}
            min={0}
            max={24}
            step={0.1}
            suffix="deg/s"
            disabled={orbitControlsDisabled}
            onChange={(orbitSpeedDegPerSec) =>
              writeDynamic({ orbitSpeedDegPerSec })
            }
          />
          <div style={dynamicCameraDirectionRowStyle}>
            <span style={dynamicCameraFieldLabelStyle}>Direction</span>
            <button
              className="editor-action-button"
              style={{
                ...dynamicCameraSegmentStyle,
                ...(cfg.orbitDirection !== -1
                  ? dynamicCameraSegmentActiveStyle
                  : {}),
              }}
              disabled={orbitControlsDisabled}
              onClick={() => {
                writeDynamic({ orbitDirection: 1 });
                sceneHandle.setDynamicCameraOrbitCenter(
                  cfg.poi ?? page.camera.target,
                  1,
                );
              }}
            >
              Clockwise
            </button>
            <button
              className="editor-action-button"
              style={{
                ...dynamicCameraSegmentStyle,
                ...(cfg.orbitDirection === -1
                  ? dynamicCameraSegmentActiveStyle
                  : {}),
              }}
              disabled={orbitControlsDisabled}
              onClick={() => {
                writeDynamic({ orbitDirection: -1 });
                sceneHandle.setDynamicCameraOrbitCenter(
                  cfg.poi ?? page.camera.target,
                  -1,
                );
              }}
            >
              Counter
            </button>
          </div>
          <DynamicRangeRow
            label="Distance"
            value={cfg.orbitRadius ?? defaultOrbitRadius(page)}
            min={50}
            max={distanceMax}
            step={10}
            suffix="m"
            disabled={orbitControlsDisabled}
            onChange={(orbitRadius) => writeDynamic({ orbitRadius })}
          />
          <DynamicRangeRow
            label="Height"
            value={heightValue}
            min={heightMin}
            max={heightMax}
            step={10}
            suffix="m"
            disabled={orbitControlsDisabled}
            onChange={(orbitHeight) => writeDynamic({ orbitHeight })}
          />
          <DynamicCheckboxRow
            label="Blend path aware"
            value={cfg.pathAwareBlend === true}
            disabled={orbitControlsDisabled}
            onChange={(pathAwareBlend) =>
              writeDynamic({ pathAwareBlend })
            }
          />
          <DynamicRangeRow
            label="Ramp in"
            value={cfg.transitionLeadMs ?? 1600}
            min={0}
            max={4000}
            step={50}
            suffix="ms"
            disabled={orbitControlsDisabled}
            onChange={(transitionLeadMs) => writeDynamic({ transitionLeadMs })}
          />
          <DynamicRangeRow
            label="Ramp out"
            value={cfg.transitionExitMs ?? 900}
            min={0}
            max={3000}
            step={50}
            suffix="ms"
            disabled={orbitControlsDisabled}
            onChange={(transitionExitMs) => writeDynamic({ transitionExitMs })}
          />
          <DynamicRangeRow
            label="Blend in"
            value={cfg.easeInMs ?? 1600}
            min={0}
            max={5000}
            step={50}
            suffix="ms"
            disabled={orbitControlsDisabled}
            onChange={(easeInMs) => writeDynamic({ easeInMs })}
          />
          <DynamicSelectRow
            label="Curve"
            value={cfg.transitionBlendCurve ?? "smooth"}
            disabled={orbitControlsDisabled}
            options={[
              ["linear", "Linear"],
              ["smooth", "Smooth"],
              ["cinematic", "Cinematic"],
            ]}
            onChange={(transitionBlendCurve) =>
              writeDynamic({ transitionBlendCurve })
            }
          />
        </DynamicCameraSubsection>

        <DynamicCameraSubsection
          title="Camera Zoom"
          muted={!dynamicMovementEnabled || !zoomEnabled}
          divider={false}
          action={
            <DynamicCheckToggle
              value={zoomEnabled}
              disabled={disabled || !dynamicMovementEnabled}
              onChange={(zoomEnabled) => writeDynamic({ zoomEnabled })}
            />
          }
        >
          <DynamicRangeRow
            label="Delta FOV"
            value={cfg.zoomDeltaFov ?? 0}
            min={-40}
            max={40}
            step={0.5}
            suffix="deg"
            disabled={zoomControlsDisabled}
            onChange={(zoomDeltaFov) => writeDynamic({ zoomDeltaFov })}
          />
          <DynamicRangeRow
            label="Start"
            value={cfg.zoomStartMs ?? 0}
            min={0}
            max={12000}
            step={50}
            suffix="ms"
            disabled={zoomControlsDisabled}
            onChange={(zoomStartMs) => writeDynamic({ zoomStartMs })}
          />
          <DynamicRangeRow
            label="End"
            value={cfg.zoomEndMs ?? 2500}
            min={0}
            max={12000}
            step={50}
            suffix="ms"
            disabled={zoomControlsDisabled}
            onChange={(zoomEndMs) => writeDynamic({ zoomEndMs })}
          />
          <DynamicSelectRow
            label="Curve"
            value={cfg.zoomCurve ?? "smooth"}
            disabled={zoomControlsDisabled}
            options={[
              ["linear", "Linear"],
              ["smooth", "Smooth"],
              ["cinematic", "Cinematic"],
            ]}
            onChange={(zoomCurve) => writeDynamic({ zoomCurve })}
          />
        </DynamicCameraSubsection>
      </DynamicCameraGroup>
    </div>
  );
}

function DynamicCameraGroup({
  title,
  state = "neutral",
  accentColor,
  action,
  initialOpen = false,
  bodyVariant = "controls",
  children,
}: {
  title: string;
  state?: "active" | "inactive" | "neutral";
  accentColor?: string | null;
  action?: React.ReactNode;
  initialOpen?: boolean;
  bodyVariant?: "controls" | "sections";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const summaryStyle = dynamicCameraGroupSummaryStyle(state, accentColor);
  const bodyStyle =
    bodyVariant === "sections"
      ? dynamicCameraSectionsBodyStyle
      : dynamicCameraGroupBodyStyle;
  return (
    <div style={dynamicCameraGroupStyle}>
      <div
        role="button"
        tabIndex={0}
        style={summaryStyle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        <span style={dynamicCameraGroupTitleStyle}>{title}</span>
        <span style={dynamicCameraGroupHeaderControlsStyle}>
          {action && (
            <span
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {action}
            </span>
          )}
          <span style={dynamicCameraGroupDisclosureStyle} aria-hidden="true">
            <span
              style={{
                ...dynamicCameraGroupChevronStyle,
                transform: open ? "rotate(45deg)" : "rotate(-45deg)",
              }}
            />
          </span>
        </span>
      </div>
      {open && <div style={bodyStyle}>{children}</div>}
    </div>
  );
}

function DynamicCameraSubsection({
  title,
  action,
  muted = false,
  divider = true,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  muted?: boolean;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        ...dynamicCameraSubsectionStyle,
        ...(divider ? {} : dynamicCameraSubsectionLastStyle),
      }}
    >
      <div style={dynamicCameraSubsectionHeaderStyle}>
        <span
          style={{
            ...dynamicCameraSubsectionTitleStyle,
            opacity: muted ? 0.62 : 1,
          }}
        >
          {title}
        </span>
        {action && (
          <span
            style={dynamicCameraSubsectionActionStyle}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {action}
          </span>
        )}
      </div>
      <div
        style={{
          ...dynamicCameraSubsectionBodyStyle,
          opacity: muted ? 0.58 : 1,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function DynamicMasterToggleRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={dynamicCameraMasterToggleRowStyle}>
      <span style={dynamicCameraMasterToggleLabelStyle}>{label}</span>
      <DynamicCheckToggle
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function DynamicVectorRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: Vec3;
  disabled: boolean;
  onChange: (value: Vec3) => void;
}) {
  const update = (index: 0 | 1 | 2, nextValue: number) => {
    const next: Vec3 = [...value] as Vec3;
    next[index] = nextValue;
    onChange(next);
  };
  return (
    <label style={dynamicCameraVectorRowStyle}>
      <span style={dynamicCameraFieldLabelStyle}>{label}</span>
      {[0, 1, 2].map((index) => (
        <input
          key={index}
          type="number"
          value={formatDynamicNumber(value[index])}
          disabled={disabled}
          style={dynamicCameraNumberInputStyle}
          onChange={(e) => {
            const n = Number(e.currentTarget.value);
            if (Number.isFinite(n)) update(index as 0 | 1 | 2, n);
          }}
        />
      ))}
    </label>
  );
}

function DynamicRangeRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label style={dynamicCameraRangeRowStyle}>
      <span style={dynamicCameraFieldLabelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={dynamicCameraRangeInputStyle}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={formatDynamicNumber(value)}
        disabled={disabled}
        style={dynamicCameraValueInputStyle}
        onChange={(e) => {
          const n = Number(e.currentTarget.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      <span style={dynamicCameraSuffixStyle}>{suffix}</span>
    </label>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={dynamicCameraCheckSvgStyle}
    >
      <path
        d="M3.3 8.2 6.4 11.1 12.8 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DynamicCheckToggle({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className="editor-action-button"
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      style={{
        ...dynamicCameraCheckToggleStyle,
        ...(value
          ? dynamicCameraCheckBoxActiveStyle
          : dynamicCameraCheckBoxInactiveStyle),
        opacity: disabled ? 0.55 : 1,
      }}
      onClick={() => onChange(!value)}
    >
      {value ? <CheckIcon /> : null}
    </button>
  );
}

function DynamicCheckboxRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={dynamicCameraCheckboxRowStyle}>
      <span style={dynamicCameraFieldLabelStyle}>{label}</span>
      <DynamicCheckToggle
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function DynamicSelectRow<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label style={dynamicCameraSelectRowStyle}>
      <span style={dynamicCameraFieldLabelStyle}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        style={dynamicCameraSelectInputStyle}
        onChange={(e) => onChange(e.currentTarget.value as T)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function dynamicCameraForPage(page: PresentationPage): DynamicCamera {
  const poi = page.dynamicCamera?.poi ?? page.camera.target;
  const legacyZoomDelta =
    typeof page.dynamicCamera?.zoomFov === "number" &&
    Number.isFinite(page.dynamicCamera.zoomFov)
      ? page.dynamicCamera.zoomFov - page.camera.fov
      : 0;
  return {
    enabled: page.dynamicCamera?.enabled ?? false,
    mode: "orbit",
    orbitEnabled: page.dynamicCamera?.orbitEnabled ?? true,
    poi,
    orbitSpeedDegPerSec: page.dynamicCamera?.orbitSpeedDegPerSec ?? 4,
    orbitRadius: page.dynamicCamera?.orbitRadius ?? defaultOrbitRadius(page, poi),
    orbitHeight: page.dynamicCamera?.orbitHeight ?? defaultOrbitHeight(page, poi),
    orbitDirection: page.dynamicCamera?.orbitDirection ?? 1,
    zoomFov: page.dynamicCamera?.zoomFov ?? page.camera.fov,
    zoomEnabled:
      page.dynamicCamera?.zoomEnabled ??
      Math.abs(legacyZoomDelta) > 0.01,
    zoomDeltaFov: page.dynamicCamera?.zoomDeltaFov ?? legacyZoomDelta,
    zoomStartMs: page.dynamicCamera?.zoomStartMs ?? 0,
    zoomEndMs: page.dynamicCamera?.zoomEndMs ?? 2500,
    zoomCurve: page.dynamicCamera?.zoomCurve ?? "smooth",
    easeInMs: page.dynamicCamera?.easeInMs ?? 1600,
    transitionLeadMs: page.dynamicCamera?.transitionLeadMs ?? 1600,
    transitionExitMs: page.dynamicCamera?.transitionExitMs ?? 900,
    transitionBlendCurve: page.dynamicCamera?.transitionBlendCurve ?? "smooth",
    pathAwareBlend: page.dynamicCamera?.pathAwareBlend ?? false,
  };
}

function defaultOrbitRadius(page: PresentationPage, poi = page.camera.target): number {
  return Math.max(
    1,
    Math.hypot(page.camera.position[0] - poi[0], page.camera.position[1] - poi[1]),
  );
}

function defaultOrbitHeight(page: PresentationPage, poi: Vec3): number {
  return page.camera.position[2] - poi[2];
}

function DynamicCameraPoseCapture({
  page,
  sceneHandle,
  disabled,
  historyOpen,
  setHistoryOpen,
  capturePoseForPage,
  getPoseHistory,
  restorePoseFromHistory,
  tweenToPose,
}: {
  page: PresentationPage;
  sceneHandle: SceneHandle;
  disabled: boolean;
  historyOpen: boolean;
  setHistoryOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  capturePoseForPage: (pageId: string, pose: PresentationPage["camera"]) => void;
  getPoseHistory: (pageId: string) => readonly Pose[];
  restorePoseFromHistory: (pageId: string, index: number) => void;
  tweenToPose: (pose: PresentationPage["camera"]) => void;
}) {
  return (
    <div style={dynamicCameraCaptureBlockStyle}>
      <div style={dynamicCameraCaptureRowStyle}>
        <button
          className="editor-action-button"
          style={{
            ...pagePanelActionButtonStyle,
            opacity: disabled ? 0.55 : 1,
          }}
          disabled={disabled}
          onClick={() => {
            const pose = capturePose(sceneHandle.camera, sceneHandle.controls);
            capturePoseForPage(page.id, pose);
            setHistoryOpen(false);
          }}
          title={
            disabled
              ? "Disabled while transitioning"
              : "Capture current camera as this page's pose"
          }
        >
          Update camera
        </button>
        <button
          className="editor-action-button"
          style={pagePanelActionButtonStyle}
          onClick={() => setHistoryOpen((value) => !value)}
          title="Restore a recently captured pose for this page"
        >
          History
        </button>
      </div>
      {historyOpen && (
        <PoseHistoryDropdown
          history={getPoseHistory(page.id)}
          onPick={(idx) => {
            const history = getPoseHistory(page.id);
            const pose = history[idx];
            if (!pose) return;
            restorePoseFromHistory(page.id, idx);
            tweenToPose(pose);
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

function DynamicCameraPageTiming({
  page,
  setPageField,
  setPageTransition,
}: {
  page: PresentationPage;
  setPageField: (
    pageId: string,
    patch: Partial<Pick<PresentationPage, "holdDuration">>,
  ) => void;
  setPageTransition: (
    pageId: string,
    patch: Partial<{ duration: number; easing: EasingName }>,
  ) => void;
}) {
  return (
    <div style={dynamicCameraTimingBlockStyle}>
      <DynamicRangeRow
        label="Transition"
        value={page.transition.duration}
        min={0}
        max={15000}
        step={250}
        suffix="ms"
        disabled={false}
        onChange={(duration) => setPageTransition(page.id, { duration })}
      />
      <DynamicSelectRow
        label="Easing"
        value={page.transition.easing}
        disabled={false}
        options={PAGE_EASINGS.map((name) => [name, name])}
        onChange={(easing) => setPageTransition(page.id, { easing })}
      />
      <DynamicRangeRow
        label="Hold"
        value={page.holdDuration}
        min={0}
        max={20000}
        step={500}
        suffix="ms"
        disabled={false}
        onChange={(holdDuration) =>
          setPageField(page.id, { holdDuration })
        }
      />
    </div>
  );
}

function PoseHistoryDropdown({
  history,
  onPick,
  onClose,
}: {
  history: readonly Pose[];
  onPick: (idx: number) => void;
  onClose: () => void;
}) {
  if (history.length === 0) {
    return (
      <div style={historyDropdownStyle}>
        <div style={historyEmptyStyle}>
          No captures yet. Click the Capture button to add an entry.
        </div>
        <button
          className="editor-action-button"
          style={{
            ...historyEntryStyle,
            fontSize: 11,
            color: vibrancySecondaryLabel,
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    );
  }
  return (
    <div style={historyDropdownStyle}>
      {history.map((p, i) => (
        <button
          className="editor-action-button"
          key={i}
          style={historyEntryStyle}
          onClick={() => onPick(i)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "rgba(244, 240, 232, 0.42)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "transparent")
          }
        >
          Capture #{history.length - i}
          <span
            style={{
              color: vibrancyTertiaryLabel,
              fontSize: 10,
              marginLeft: 6,
            }}
          >
            ({p.position.map((v) => v.toFixed(0)).join(", ")})
          </span>
        </button>
      ))}
    </div>
  );
}

function roundSceneValue(value: number, decimals = 0): number {
  const scale = Math.pow(10, decimals);
  return Math.round(value * scale) / scale;
}

function formatDynamicNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

const dirtyDotStyle: React.CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 14,
  marginRight: 4,
  lineHeight: 1,
};

function pageRowHoverStyle(_accentColor: string): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid transparent",
    boxShadow: "none",
  };
}

function waitingPageRowStyle(
  _accentFill: string,
  _accentStroke: string,
): React.CSSProperties {
  return {
    background: _accentFill,
    border: "1px solid transparent",
    boxShadow: "none",
  };
}

function selectedPageRowStyle(accentColor: string): React.CSSProperties {
  return {
    background: accentColor,
    border: "1px solid transparent",
    boxShadow: "none",
  };
}

const hiddenPageRowStyle: React.CSSProperties = {
  opacity: 0.58,
};

type PageManagerActionSurface = "dark" | "tinted";

const PAGE_ROW_ACTION_EXTENT = 168;
const PAGE_ROW_ACTION_RIGHT_INSET = 26;
const PAGE_MANAGER_DARK_SURFACE_FILL = "rgba(244, 240, 232, 0.066)";
const PAGE_MANAGER_TINTED_SURFACE_FILL = "rgba(18, 21, 24, 0.192)";
const PAGE_MANAGER_DISABLED_FILL = "rgba(244, 240, 232, 0.038)";

const pageActionButtonBaseStyle: React.CSSProperties = {
  ...panelStyles.iconButton,
  color: vibrancySecondaryLabel,
};

function pageManagerActionContrastStyle(
  surface: PageManagerActionSurface,
  disabled = false,
): React.CSSProperties {
  if (disabled) {
    return {
      background: PAGE_MANAGER_DISABLED_FILL,
      color: "rgba(244, 240, 232, 0.38)",
      opacity: 1,
      cursor: "default",
    };
  }

  return {
    background:
      surface === "tinted"
        ? PAGE_MANAGER_TINTED_SURFACE_FILL
        : PAGE_MANAGER_DARK_SURFACE_FILL,
    color: surface === "tinted" ? vibrancyLabel : vibrancySecondaryLabel,
    opacity: 1,
    cursor: "pointer",
  };
}

function pageManagerIconButtonStyle({
  surface = "dark",
  disabled = false,
}: {
  surface?: PageManagerActionSurface;
  disabled?: boolean;
}): React.CSSProperties {
  return {
    ...pageActionButtonBaseStyle,
    ...pageManagerActionContrastStyle(surface, disabled),
  };
}

const pageRowActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flex: "none",
  marginLeft: 12,
};

function pageColorButtonStyle(accentColor: string): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    cursor: "pointer",
    padding: 0,
    flex: "none",
    position: "relative",
    overflow: "hidden",
    background: accentColor,
    border: "none",
    boxShadow: "none",
  };
}

const pageColorInputStyle: React.CSSProperties = {
  position: "absolute",
  inset: -4,
  width: 32,
  height: 32,
  opacity: 0,
  cursor: "pointer",
  padding: 0,
  border: "none",
};

const pageActionSvgStyle: React.CSSProperties = {
  width: 13,
  height: 13,
  display: "block",
  flex: "none",
};

const globalSettingsActionSlotStyle: React.CSSProperties = {
  width: PAGE_ROW_ACTION_EXTENT,
  height: 24,
  display: "flex",
  justifyContent: "flex-end",
  flex: "none",
  marginRight: 8,
};

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={pageActionSvgStyle}
    >
      <path
        d="M4.5 8.5h3.2l1.15-2h6.3l1.15 2h3.2a1.7 1.7 0 0 1 1.7 1.7v7.1a1.7 1.7 0 0 1-1.7 1.7h-15a1.7 1.7 0 0 1-1.7-1.7v-7.1a1.7 1.7 0 0 1 1.7-1.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="13.7"
        r="3.15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={pageActionSvgStyle}
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={pageActionSvgStyle}
    >
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 12s3.5-6 9.5-6c1.3 0 2.5.28 3.55.73M21.5 12s-3.5 6-9.5 6c-1.31 0-2.51-.28-3.58-.74"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={pageActionSvgStyle}
    >
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7l1-3h4l1 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const pageActionsStyle: React.CSSProperties = {
  marginTop: 16,
  marginBottom: 24,
  paddingRight: PAGE_ROW_ACTION_RIGHT_INSET,
  display: "flex",
  justifyContent: "flex-end",
};

const pageFooterActionsStyle: React.CSSProperties = {
  width: PAGE_ROW_ACTION_EXTENT,
  display: "grid",
  gridTemplateColumns: "36px 76px 44px",
  gap: 6,
};

function pageFooterActionButtonStyle(
  width: number,
  disabled = false,
): React.CSSProperties {
  return {
    ...pageActionButtonBaseStyle,
    ...pageManagerActionContrastStyle("dark", disabled),
    width,
    minWidth: width,
    height: 24,
    padding: "0 6px",
    fontSize: 10.5,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
}

const pagePanelActionButtonStyle: React.CSSProperties = {
  ...panelStyles.iconButton,
  width: 108,
  height: "auto",
  padding: "6px 10px",
  fontSize: 11,
  color: vibrancySecondaryLabel,
};

const globalToolPanelBodyStyle: React.CSSProperties = {
  paddingTop: 10,
};

const renderPresetGroupStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingLeft: 18,
};

const renderPresetHeadingTextStyle: React.CSSProperties = {
  color: vibrancyLabel,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const renderPresetHeadingStyle = (
  accentColor?: string | null,
): React.CSSProperties => ({
  ...panelStyles.globalSettingsBar,
  background: accentColor ?? panelStyles.globalSettingsBar.background,
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  appearance: "none",
});

const renderPresetDisclosureStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: vibrancyLabel,
  flex: "none",
};

const renderPresetChevronStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRight: "2px solid rgba(244, 240, 232, 0.82)",
  borderBottom: "2px solid rgba(244, 240, 232, 0.82)",
  transformOrigin: "center",
  transition: "transform 160ms ease",
};

const renderPresetBodyStyle: React.CSSProperties = {
  ...panelStyles.globalSettingsBody,
};

const renderPresetControlRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "94px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const renderPresetFieldLabelStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 12,
};

const renderPresetSelectStyle: React.CSSProperties = {
  ...panelStyles.textInput,
  width: "100%",
  minWidth: 0,
};

const renderPresetButtonRowStyle: React.CSSProperties = {
  margin: "0 0 8px 102px",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const renderPresetSmallButtonStyle: React.CSSProperties = {
  ...panelStyles.button,
  width: "auto",
  minHeight: 28,
  padding: "6px 10px",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const dynamicCameraPastelGreenStrong = "rgba(181, 219, 191, 0.672)";
const dynamicCameraMutedGrayStrong = "rgba(18, 21, 24, 0.368)";

const dynamicCameraCaptureBlockStyle: React.CSSProperties = {
  margin: "0 0 12px 18px",
  padding: "0 12px 8px 0",
  borderBottom: FROSTED_HAIRLINE,
  position: "relative",
};

const dynamicCameraCaptureRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const dynamicCameraTimingBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const historyDropdownStyle: React.CSSProperties = {
  ...regularLightMaterial,
  position: "absolute",
  top: "100%",
  right: 12,
  marginTop: 4,
  border: FROSTED_HAIRLINE,
  borderRadius: 12,
  padding: 6,
  width: 220,
  zIndex: 10,
};

const historyEntryStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 10px",
  background: "transparent",
  color: vibrancyLabel,
  border: "1px solid transparent",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: TECHNICAL_MONO_FONT,
  cursor: "pointer",
  boxSizing: "border-box",
};

const historyEmptyStyle: React.CSSProperties = {
  padding: "8px 12px",
  color: vibrancyTertiaryLabel,
  fontSize: 11,
  fontStyle: "italic",
};

function dynamicCameraPanelStyle(_accentColor: string): React.CSSProperties {
  return {
    padding: "4px 14px 14px",
    fontSize: 13,
    color: vibrancyLabel,
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  };
}

const dynamicCameraGroupStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingLeft: 18,
};

function dynamicCameraGroupSummaryStyle(
  state: "active" | "inactive" | "neutral",
  accentColor?: string | null,
): React.CSSProperties {
  const inactive = state === "inactive";
  return {
    ...frostedSubheading,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    width: "100%",
    minHeight: 42,
    padding: `0 ${EDITOR_PILL_TEXT_INSET_PX}px`,
    cursor: "pointer",
    userSelect: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    background: accentColor ?? frostedSubheading.background,
    border: "1px solid transparent",
    opacity: inactive ? 0.72 : 1,
    boxShadow: "none",
  };
}

const dynamicCameraGroupTitleStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: 0,
  minWidth: 0,
};

const dynamicCameraGroupHeaderControlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "none",
};

const dynamicCameraGroupDisclosureStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};

const dynamicCameraGroupChevronStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRight: "2px solid rgba(0, 0, 0, 0.74)",
  borderBottom: "2px solid rgba(0, 0, 0, 0.74)",
  transformOrigin: "center",
  transition: "transform 160ms ease",
};

const dynamicCameraGroupBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 0 8px 28px",
};

const dynamicCameraSectionsBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
  padding: "10px 12px 0 28px",
};

const dynamicCameraMasterToggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 24,
  marginBottom: 10,
};

const dynamicCameraMasterToggleLabelStyle: React.CSSProperties = {
  color: vibrancyLabel,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
};

const dynamicCameraSubsectionStyle: React.CSSProperties = {
  padding: "0 0 14px",
  marginBottom: 14,
  borderBottom: FROSTED_HAIRLINE,
};

const dynamicCameraSubsectionLastStyle: React.CSSProperties = {
  paddingBottom: 2,
  marginBottom: 0,
  borderBottom: "none",
};

const dynamicCameraSubsectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 24,
  marginBottom: 7,
};

const dynamicCameraSubsectionTitleStyle: React.CSSProperties = {
  color: vibrancyLabel,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
};

const dynamicCameraSubsectionActionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};

const dynamicCameraSubsectionBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const dynamicCameraButtonRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const dynamicCameraMiniButtonStyle: React.CSSProperties = {
  ...pagePanelActionButtonStyle,
};

const dynamicCameraPickingButtonStyle: React.CSSProperties = {
  color: vibrancyLabel,
  background: dynamicCameraPastelGreenStrong,
  borderColor: "rgba(116, 168, 126, 0.34)",
};

const dynamicCameraRangeRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "68px minmax(0, 1fr) 56px 32px",
  alignItems: "center",
  gap: 6,
  minHeight: 24,
};

const dynamicCameraVectorRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "68px repeat(3, minmax(0, 1fr))",
  alignItems: "center",
  gap: 6,
};

const dynamicCameraDirectionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "68px 1fr 1fr",
  alignItems: "center",
  gap: 6,
};

const dynamicCameraCheckboxRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "96px 16px",
  alignItems: "center",
  gap: 6,
  minHeight: 24,
};

const dynamicCameraSelectRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "68px minmax(0, 1fr)",
  alignItems: "center",
  gap: 6,
  minHeight: 24,
};

const dynamicCameraFieldLabelStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 10.5,
  lineHeight: 1.1,
};

const dynamicCameraRangeInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  accentColor: "#74a87e",
};

const dynamicCameraValueInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "3px 4px",
  borderRadius: 7,
  border: editorFieldBorder,
  background: editorFieldBackground,
  color: vibrancyLabel,
  fontSize: 10,
  fontFamily: TECHNICAL_MONO_FONT,
  boxSizing: "border-box",
};

const dynamicCameraSelectInputStyle: React.CSSProperties = {
  ...dynamicCameraValueInputStyle,
  width: "100%",
};

const dynamicCameraNumberInputStyle: React.CSSProperties = {
  ...dynamicCameraValueInputStyle,
  width: "100%",
};

const dynamicCameraSuffixStyle: React.CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 9.5,
};

const dynamicCameraSegmentStyle: React.CSSProperties = {
  ...panelStyles.iconButton,
  width: "100%",
  height: "auto",
  minWidth: 0,
  padding: "4px 5px",
  color: vibrancySecondaryLabel,
  background: dynamicCameraMutedGrayStrong,
  borderColor: "rgba(130, 130, 130, 0.18)",
  fontSize: 10,
};

const dynamicCameraSegmentActiveStyle: React.CSSProperties = {
  color: vibrancyLabel,
  background: dynamicCameraPastelGreenStrong,
  borderColor: "rgba(116, 168, 126, 0.34)",
};

const dynamicCameraCheckToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  padding: 0,
  borderRadius: 4,
  color: vibrancySecondaryLabel,
  font: "inherit",
  cursor: "pointer",
  boxSizing: "border-box",
};

const dynamicCameraCheckBoxActiveStyle: React.CSSProperties = {
  color: "rgba(24, 70, 39, 0.94)",
  background: dynamicCameraPastelGreenStrong,
  border: "1px solid rgba(116, 168, 126, 0.44)",
};

const dynamicCameraCheckBoxInactiveStyle: React.CSSProperties = {
  background: "rgba(18, 21, 24, 0.5)",
  border: FROSTED_HAIRLINE,
};

const dynamicCameraCheckSvgStyle: React.CSSProperties = {
  width: 11,
  height: 11,
  display: "block",
};

const triangleIconBaseStyle: React.CSSProperties = {
  width: 0,
  height: 0,
  display: "block",
  borderLeft: "4px solid transparent",
  borderRight: "4px solid transparent",
};

const upTriangleIconStyle: React.CSSProperties = {
  ...triangleIconBaseStyle,
  borderBottom: "6px solid currentColor",
};

const downTriangleIconStyle: React.CSSProperties = {
  ...triangleIconBaseStyle,
  borderTop: "6px solid currentColor",
};

// DEV NOTES: page list contents
// -----------------------------
// This is the plain list under the Page Manager top-level section. It should
// not carry a heavy material box; the visual weight belongs to selected rows.
const globalSettingsSelectorStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  marginTop: 6,
  paddingLeft: EDITOR_PAGE_LIST_INDENT_X,
};

const pageListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginTop: 6,
  // Row text aligns with Global Settings section labels like Atmosphere:
  // 38px list inset + 8px row padding = 46px visual text start.
  paddingLeft: EDITOR_PAGE_LIST_INDENT_X,
  // Mirror the left inset so selected rows have balanced rounded ends.
  paddingRight: EDITOR_PAGE_LIST_INDENT_X,
};
