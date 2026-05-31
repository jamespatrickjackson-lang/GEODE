import { useEffect, useState } from "react";
import * as THREE from "three";
import { useEditor } from "../editor/EditorContext";
import { vibrancyLabel } from "../editor/styles";
import type { SceneHandle } from "../scene";

const BUTTON_SIZE_PX = 36;
const COMPASS_SIZE_PX = 36;
const NORTH_NEEDLE_COLOR = "#ffd1dc";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const rgbMatch = clean.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i,
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(246, 246, 246, ${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function projectedNorthAngle(sceneHandle: SceneHandle): number {
  const reference = sceneHandle.controls.target.clone();
  const north = reference.clone().add(new THREE.Vector3(0, 1, 0));
  const rect = sceneHandle.renderer.domElement.getBoundingClientRect();
  const a = reference.project(sceneHandle.camera);
  const b = north.project(sceneHandle.camera);
  const ax = rect.left + ((a.x + 1) / 2) * rect.width;
  const ay = rect.top + ((1 - a.y) / 2) * rect.height;
  const bx = rect.left + ((b.x + 1) / 2) * rect.width;
  const by = rect.top + ((1 - b.y) / 2) * rect.height;
  if (![ax, ay, bx, by].every(Number.isFinite)) return 0;
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI + 90;
}

function SunIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill={color} />
      <g stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.8v2.4" />
        <path d="M12 18.8v2.4" />
        <path d="M2.8 12h2.4" />
        <path d="M18.8 12h2.4" />
        <path d="m5.5 5.5 1.7 1.7" />
        <path d="m16.8 16.8 1.7 1.7" />
        <path d="m18.5 5.5-1.7 1.7" />
        <path d="m7.2 16.8-1.7 1.7" />
      </g>
    </svg>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18.6 15.7A7.5 7.5 0 0 1 8.3 5.4a7.5 7.5 0 1 0 10.3 10.3Z"
        fill={color}
      />
    </svg>
  );
}

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 11.1 12 4.8l7.5 6.3"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.8 10.2v8.3h10.4v-8.3"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LightModeToggle({
  sceneHandle,
  onReturnHome,
}: {
  sceneHandle: SceneHandle;
  onReturnHome: () => void;
}) {
  const { state, setEnvScene, commitPending } = useEditor();
  const [northAngleDeg, setNorthAngleDeg] = useState(0);
  const [homePromptOpen, setHomePromptOpen] = useState(false);
  const [exitAfterSave, setExitAfterSave] = useState(false);
  const lightMode = state.environment.scene?.lightMode === true;
  const gui = state.environment.scene?.gui ?? {};
  const guiOverlay = gui.overlay ?? {};
  const guiNavigator = gui.navigator ?? {};
  const navigatorOverride = guiNavigator.useOverride === true;
  const inset = navigatorOverride ? guiNavigator.bottom ?? 16 : 16;
  const textColor = navigatorOverride
    ? guiNavigator.textColor ?? guiOverlay.textColor ?? vibrancyLabel
    : guiOverlay.textColor ?? vibrancyLabel;
  const borderSource = navigatorOverride
    ? guiNavigator.borderColor ?? guiOverlay.borderColor ?? "#ffffff"
    : guiOverlay.borderColor ?? "#ffffff";
  const borderAlpha = clamp(
    navigatorOverride
      ? guiNavigator.borderAlpha ?? guiOverlay.borderAlpha ?? 0.58
      : guiOverlay.borderAlpha ?? 0.58,
    0,
    1,
  );
  const backgroundColor = navigatorOverride
    ? guiNavigator.backgroundColor ?? guiOverlay.backgroundColor ?? "#f6f6f6"
    : guiOverlay.backgroundColor ?? "#f6f6f6";
  const backgroundAlpha = clamp(
    navigatorOverride
      ? guiNavigator.backgroundAlpha ?? guiOverlay.backgroundAlpha ?? 0.72
      : guiOverlay.backgroundAlpha ?? 0.72,
    0,
    1,
  );
  const backdropBlur = Math.max(
    0,
    navigatorOverride
      ? guiNavigator.backdropBlurPx ?? guiOverlay.backdropBlurPx ?? 24
      : guiOverlay.backdropBlurPx ?? 24,
  );
  const backdropSaturation = Math.max(
    0,
    navigatorOverride
      ? guiNavigator.backdropSaturation ?? guiOverlay.backdropSaturation ?? 180
      : guiOverlay.backdropSaturation ?? 180,
  );
  const borderColor = hexToRgba(borderSource, borderAlpha);
  const background = hexToRgba(backgroundColor, backgroundAlpha);
  const compassSecondary = hexToRgba(borderSource, 0.72);
  const hasPendingEdits =
    state.dirty.size > 0 || state.saveStatus === "error";

  useEffect(() => {
    let previous = Number.NaN;
    const update = () => {
      const next = projectedNorthAngle(sceneHandle);
      if (!Number.isFinite(previous) || Math.abs(next - previous) > 0.5) {
        previous = next;
        setNorthAngleDeg(next);
      }
    };
    update();
    const offTick = sceneHandle.onTick(update, "LightModeToggle.northAngle");
    window.addEventListener("resize", update);
    return () => {
      offTick();
      window.removeEventListener("resize", update);
    };
  }, [sceneHandle]);

  useEffect(() => {
    if (!exitAfterSave) return;
    if (state.saveStatus === "error") {
      setExitAfterSave(false);
      return;
    }
    if (state.saveStatus !== "saving" && state.dirty.size === 0) {
      setExitAfterSave(false);
      setHomePromptOpen(false);
      onReturnHome();
    }
  }, [exitAfterSave, onReturnHome, state.dirty.size, state.saveStatus]);

  const requestHome = () => {
    if (hasPendingEdits) {
      setHomePromptOpen(true);
      return;
    }
    onReturnHome();
  };

  const rootStyle: React.CSSProperties = {
    position: "absolute",
    right: inset,
    bottom: inset,
    zIndex: 25,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "system-ui, sans-serif",
  };
  const buttonStyle: React.CSSProperties = {
    width: BUTTON_SIZE_PX,
    height: BUTTON_SIZE_PX,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    color: textColor,
    background,
    border: `1px solid ${borderColor}`,
    borderRadius: "50%",
    cursor: "pointer",
    boxShadow: "none",
    backdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
    WebkitBackdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
  };
  const compassStyle: React.CSSProperties = {
    position: "relative",
    width: COMPASS_SIZE_PX,
    height: COMPASS_SIZE_PX,
    borderRadius: "50%",
    border: `1px solid ${borderColor}`,
    boxSizing: "border-box",
    background,
    pointerEvents: "none",
    backdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
    WebkitBackdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
  };
  const needleStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 0,
    height: 0,
    transform: `translate(-50%, -50%) rotate(${northAngleDeg}deg)`,
    transformOrigin: "50% 50%",
  };
  const northNeedleStyle: React.CSSProperties = {
    position: "absolute",
    left: -4,
    top: -13,
    width: 0,
    height: 0,
    borderLeft: "4px solid transparent",
    borderRight: "4px solid transparent",
    borderBottom: `13px solid ${NORTH_NEEDLE_COLOR}`,
  };
  const southNeedleStyle: React.CSSProperties = {
    position: "absolute",
    left: -4,
    top: 0,
    width: 0,
    height: 0,
    borderLeft: "4px solid transparent",
    borderRight: "4px solid transparent",
    borderTop: `13px solid ${compassSecondary}`,
  };

  return (
    <>
      <div style={rootStyle}>
        <div style={compassStyle} aria-label="Compass north">
          <div style={needleStyle}>
            <div style={northNeedleStyle} />
            <div style={southNeedleStyle} />
          </div>
        </div>
        <button
          style={buttonStyle}
          onClick={() => setEnvScene({ lightMode: !lightMode })}
          title={
            lightMode
              ? "Switch to dark mode (cinematic terrain palette)"
              : "Switch to light mode (greyscale terrain)"
          }
          aria-label={lightMode ? "Dark mode" : "Light mode"}
        >
          {lightMode ? <MoonIcon color={textColor} /> : <SunIcon color={textColor} />}
        </button>
        <button
          style={buttonStyle}
          onClick={requestHome}
          title="Return to project landing"
          aria-label="Return to project landing"
        >
          <HomeIcon color={textColor} />
        </button>
      </div>
      {homePromptOpen && (
        <HomeExitPrompt
          dirtyCount={state.dirty.size}
          saveError={state.saveStatus === "error" ? state.saveError : null}
          saving={state.saveStatus === "saving" && exitAfterSave}
          textColor={textColor}
          background={hexToRgba(guiOverlay.backgroundColor ?? "#121518", clamp(guiOverlay.backgroundAlpha ?? 0.55, 0, 1))}
          borderColor={hexToRgba(guiOverlay.borderColor ?? "#ffffff", clamp(guiOverlay.borderAlpha ?? 0.2, 0, 1))}
          backdropBlur={guiOverlay.backdropBlurPx ?? 20}
          backdropSaturation={guiOverlay.backdropSaturation ?? 145}
          onCancel={() => {
            setExitAfterSave(false);
            setHomePromptOpen(false);
          }}
          onExit={onReturnHome}
          onSaveExit={() => {
            setExitAfterSave(true);
            void commitPending();
          }}
        />
      )}
    </>
  );
}

function HomeExitPrompt({
  dirtyCount,
  saveError,
  saving,
  textColor,
  background,
  borderColor,
  backdropBlur,
  backdropSaturation,
  onCancel,
  onExit,
  onSaveExit,
}: {
  dirtyCount: number;
  saveError: string | null;
  saving: boolean;
  textColor: string;
  background: string;
  borderColor: string;
  backdropBlur: number;
  backdropSaturation: number;
  onCancel: () => void;
  onExit: () => void;
  onSaveExit: () => void;
}) {
  return (
    <div style={promptBackdropStyle} role="presentation">
      <div
        style={{
          ...promptPanelStyle,
          color: textColor,
          background,
          border: `1px solid ${borderColor}`,
          backdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
          WebkitBackdropFilter: `blur(${backdropBlur}px) saturate(${backdropSaturation}%)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved project edits"
      >
        <div style={promptTitleStyle}>Unsaved edits</div>
        <div style={promptBodyStyle}>
          {dirtyCount > 0
            ? `${dirtyCount} pending edit${dirtyCount === 1 ? "" : "s"} will be lost if you exit.`
            : "The last save failed. Exit without saving?"}
        </div>
        {saveError && <div style={promptErrorStyle}>{saveError}</div>}
        <div style={promptActionsStyle}>
          <button
            className="editor-action-button"
            style={promptButtonStyle}
            onClick={onSaveExit}
            disabled={saving || dirtyCount === 0}
          >
            {saving ? "Saving..." : "Save & Exit"}
          </button>
          <button
            className="editor-action-button"
            style={promptButtonStyle}
            onClick={onExit}
            disabled={saving}
          >
            Exit
          </button>
          <button
            className="editor-action-button"
            style={promptButtonStyle}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const promptBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 90,
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "rgba(0, 0, 0, 0.18)",
  pointerEvents: "auto",
};

const promptPanelStyle: React.CSSProperties = {
  width: "min(420px, calc(100vw - 48px))",
  boxSizing: "border-box",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.24)",
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

const promptTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 10,
};

const promptBodyStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.78,
  marginBottom: 14,
};

const promptErrorStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.35,
  color: "rgba(255, 111, 127, 0.92)",
  marginBottom: 14,
};

const promptActionsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
};

const promptButtonStyle: React.CSSProperties = {
  minHeight: 34,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "rgba(18, 21, 24, 0.38)",
  color: "inherit",
  font: "inherit",
  fontSize: 11,
  cursor: "pointer",
};
