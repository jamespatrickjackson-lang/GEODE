import { useState } from "react";
import { useEditor } from "./EditorContext";
import {
  frostedSubheading,
  EDITOR_PILL_TEXT_INSET_PX,
  panelStyles,
  thinLightMaterial,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import { writeFile } from "./save";
import { TransientSlider } from "./TransientSlider";
import type { SceneProperties } from "../pages/types";

type GuiProperties = NonNullable<SceneProperties["gui"]>;
type BoxOverlayStyle = NonNullable<GuiProperties["overlay"]>;
type NavigatorOverlayStyle = NonNullable<GuiProperties["navigator"]>;
type BoxOverlayStylePreset = NonNullable<GuiProperties["overlayStyles"]>[number];
type GuiLabelSettings = NonNullable<GuiProperties["labels"]>;
type EditorChromeSettings = NonNullable<GuiProperties["editor"]>;
type GuiLabelVisualStyle = NonNullable<
  NonNullable<GuiLabelSettings["styles"]>[keyof NonNullable<
    GuiLabelSettings["styles"]
  >]
>;
type GuiLabelStyleKind = keyof NonNullable<GuiLabelSettings["styles"]>;

// Stripped scene panel (Week 4 iteration). Core controls:
//   - Sun azimuth, sun elevation (drives key light + terrain hillshade)
//   - Exposure (overall brightness)
//   - Fog density (how aggressively the frame dissolves)
//   - Fog color (the atmospheric fade tone)
//
// The studio lighting rig exposes ambient/key/fill/rim values plus optional
// movable source lights for checking scene-object lighting direction.
//
// Per-page mood overrides live in the selected page's Layers > Environment
// section.

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div
      style={panelStyles.row}
      data-dev-source="src/editor/EnvironmentScenePanel.tsx:30"
      data-dev-note="Row controls Global Settings label/control alignment."
    >
      <label
        style={panelStyles.fieldLabel}
        data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:30"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function GuiSubsection({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...guiSubsectionStyle, ...style }}>
      <button
        type="button"
        style={guiSubsectionButtonStyle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={guiSubsectionTitleStyle}>{title}</span>
        <span style={environmentDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...environmentChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>
      {open && <div style={guiSubsectionBodyStyle}>{children}</div>}
    </div>
  );
}

function GuiDetail({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details style={guiDetailStyle}>
      <summary style={guiDetailSummaryStyle}>{title}</summary>
      <div style={guiDetailBodyStyle}>{children}</div>
    </details>
  );
}

const FONT_OPTIONS = [
  {
    label: "System sans",
    value:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  { label: "Apple display", value: '"SF Pro Display", system-ui, sans-serif' },
  { label: "Apple text", value: '"SF Pro Text", system-ui, sans-serif' },
  { label: "Editorial serif", value: 'Georgia, "Times New Roman", serif' },
  {
    label: "Classic serif",
    value: '"Iowan Old Style", "Palatino Linotype", Palatino, serif',
  },
  {
    label: "Technical mono",
    value: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
];

const LABEL_GUI_DEFAULTS = {
  followLerp: 0.1,
  maxSpringPx: 70,
  pinGapPx: 28,
  collisionPadPx: 10,
  fadeNearM: 15000,
  fadeFarM: 40000,
  frustumMargin: 1.2,
  maxSiteLabelsDesktop: 34,
  maxSiteLabelsMobile: 18,
  leaderVisibleThresholdPx: 4,
  nearNudgeMinPx: 48,
  nearNudgeMaxPx: 118,
  nearNudgeScale: 0.72,
  farNudgeMinPx: 96,
  farNudgeMaxPx: 190,
  farNudgeScale: 1.28,
  topNudgePenalty: 22,
  farNudgePenalty: 72,
  bottomPenalty: 1200,
  bottomDiagonalPenalty: 1450,
  overlapPenalty: 18,
  crossingPenalty: 5000,
  distancePenaltyDivisor: 58,
  landTitleDistancePenaltyDivisor: 90,
  movementPenaltyDivisor: 52,
  sideChangePenalty: 280,
  belowAnchorPenalty: 1800,
} satisfies NonNullable<NonNullable<SceneProperties["gui"]>["labels"]>;

const LABEL_STYLE_DEFAULTS = {
  siteElement: {
    textColor: "#e6e2dc",
    textOpacity: 1,
    outlineColor: "#e6e2dc",
    outlineOpacity: 1,
    fillColor: "#14161c",
    fillOpacity: 0,
    pointerVisible: true,
    pointerSide: "auto",
  },
  landTitle: {
    textColor: "#fff4e6",
    textOpacity: 1,
    outlineColor: "#e6e2dc",
    outlineOpacity: 0.34,
    fillColor: "#2a2118",
    fillOpacity: 0.82,
    pointerVisible: true,
    pointerSide: "auto",
  },
  area: {
    textColor: "#f4f7ee",
    textOpacity: 1,
    outlineColor: "#d9ead0",
    outlineOpacity: 0.76,
    fillColor: "#263426",
    fillOpacity: 0.68,
    pointerVisible: true,
    pointerSide: "auto",
  },
  anomaly: {
    textColor: "#fff2df",
    textOpacity: 1,
    outlineColor: "#ff9f43",
    outlineOpacity: 0.82,
    fillColor: "#4d2412",
    fillOpacity: 0.76,
    pointerVisible: true,
    pointerSide: "auto",
  },
} satisfies Record<GuiLabelStyleKind, Required<GuiLabelVisualStyle>>;

const LABEL_STYLE_GROUPS: Array<{
  key: GuiLabelStyleKind;
  title: string;
}> = [
  { key: "siteElement", title: "Site element labels" },
  { key: "landTitle", title: "Land title labels" },
  { key: "area", title: "Area labels" },
  { key: "anomaly", title: "Anomaly labels" },
];

type LabelInteractionKey = NonNullable<{
  [K in keyof GuiLabelSettings]: GuiLabelSettings[K] extends number | undefined
    ? K
    : never;
}[keyof GuiLabelSettings]>;

interface LabelInteractionControl {
  label: string;
  key: LabelInteractionKey;
  fallback: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}

const formatPx = (value: number) => `${value.toFixed(0)} px`;
const formatKm = (value: number) => `${(value / 1000).toFixed(1)} km`;
const formatWhole = (value: number) => `${value.toFixed(0)}`;
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const LABEL_INTERACTION_GROUPS: Array<{
  title: string;
  controls: LabelInteractionControl[];
}> = [
  {
    title: "Motion",
    controls: [
      {
        label: "Follow speed",
        key: "followLerp",
        fallback: LABEL_GUI_DEFAULTS.followLerp,
        min: 0,
        max: 0.35,
        step: 0.01,
        format: formatPercent,
      },
      {
        label: "Max stretch",
        key: "maxSpringPx",
        fallback: LABEL_GUI_DEFAULTS.maxSpringPx,
        min: 0,
        max: 240,
        step: 5,
        format: formatPx,
      },
      {
        label: "Lift above",
        key: "pinGapPx",
        fallback: LABEL_GUI_DEFAULTS.pinGapPx,
        min: 0,
        max: 90,
        step: 1,
        format: formatPx,
      },
      {
        label: "Collision pad",
        key: "collisionPadPx",
        fallback: LABEL_GUI_DEFAULTS.collisionPadPx,
        min: 0,
        max: 40,
        step: 1,
        format: formatPx,
      },
      {
        label: "Leader hide",
        key: "leaderVisibleThresholdPx",
        fallback: LABEL_GUI_DEFAULTS.leaderVisibleThresholdPx,
        min: 0,
        max: 32,
        step: 1,
        format: formatPx,
      },
    ],
  },
  {
    title: "Visibility",
    controls: [
      {
        label: "Fade near",
        key: "fadeNearM",
        fallback: LABEL_GUI_DEFAULTS.fadeNearM,
        min: 0,
        max: 60000,
        step: 500,
        format: formatKm,
      },
      {
        label: "Fade far",
        key: "fadeFarM",
        fallback: LABEL_GUI_DEFAULTS.fadeFarM,
        min: 1000,
        max: 90000,
        step: 500,
        format: formatKm,
      },
      {
        label: "Edge margin",
        key: "frustumMargin",
        fallback: LABEL_GUI_DEFAULTS.frustumMargin,
        min: 0.9,
        max: 2,
        step: 0.05,
      },
      {
        label: "Max labels",
        key: "maxSiteLabelsDesktop",
        fallback: LABEL_GUI_DEFAULTS.maxSiteLabelsDesktop,
        min: 0,
        max: 80,
        step: 1,
        format: formatWhole,
      },
      {
        label: "Max mobile",
        key: "maxSiteLabelsMobile",
        fallback: LABEL_GUI_DEFAULTS.maxSiteLabelsMobile,
        min: 0,
        max: 50,
        step: 1,
        format: formatWhole,
      },
    ],
  },
  {
    title: "Near nudge",
    controls: [
      {
        label: "Near nudge min",
        key: "nearNudgeMinPx",
        fallback: LABEL_GUI_DEFAULTS.nearNudgeMinPx,
        min: 0,
        max: 180,
        step: 2,
        format: formatPx,
      },
      {
        label: "Near nudge max",
        key: "nearNudgeMaxPx",
        fallback: LABEL_GUI_DEFAULTS.nearNudgeMaxPx,
        min: 0,
        max: 260,
        step: 2,
        format: formatPx,
      },
      {
        label: "Near nudge scale",
        key: "nearNudgeScale",
        fallback: LABEL_GUI_DEFAULTS.nearNudgeScale,
        min: 0,
        max: 2,
        step: 0.05,
      },
    ],
  },
  {
    title: "Far nudge",
    controls: [
      {
        label: "Far nudge min",
        key: "farNudgeMinPx",
        fallback: LABEL_GUI_DEFAULTS.farNudgeMinPx,
        min: 0,
        max: 280,
        step: 2,
        format: formatPx,
      },
      {
        label: "Far nudge max",
        key: "farNudgeMaxPx",
        fallback: LABEL_GUI_DEFAULTS.farNudgeMaxPx,
        min: 0,
        max: 420,
        step: 2,
        format: formatPx,
      },
      {
        label: "Far nudge scale",
        key: "farNudgeScale",
        fallback: LABEL_GUI_DEFAULTS.farNudgeScale,
        min: 0,
        max: 3,
        step: 0.05,
      },
    ],
  },
  {
    title: "Solver",
    controls: [
      {
        label: "Overlap push",
        key: "overlapPenalty",
        fallback: LABEL_GUI_DEFAULTS.overlapPenalty,
        min: 0,
        max: 80,
        step: 1,
      },
      {
        label: "Crossing push",
        key: "crossingPenalty",
        fallback: LABEL_GUI_DEFAULTS.crossingPenalty,
        min: 0,
        max: 12000,
        step: 250,
        format: formatWhole,
      },
      {
        label: "Anchor pull",
        key: "distancePenaltyDivisor",
        fallback: LABEL_GUI_DEFAULTS.distancePenaltyDivisor,
        min: 10,
        max: 220,
        step: 2,
      },
      {
        label: "Land pull",
        key: "landTitleDistancePenaltyDivisor",
        fallback: LABEL_GUI_DEFAULTS.landTitleDistancePenaltyDivisor,
        min: 10,
        max: 260,
        step: 2,
      },
      {
        label: "Motion stick",
        key: "movementPenaltyDivisor",
        fallback: LABEL_GUI_DEFAULTS.movementPenaltyDivisor,
        min: 10,
        max: 220,
        step: 2,
      },
      {
        label: "Side stick",
        key: "sideChangePenalty",
        fallback: LABEL_GUI_DEFAULTS.sideChangePenalty,
        min: 0,
        max: 1800,
        step: 25,
        format: formatWhole,
      },
    ],
  },
  {
    title: "Penalties",
    controls: [
      {
        label: "Near lane cost",
        key: "topNudgePenalty",
        fallback: LABEL_GUI_DEFAULTS.topNudgePenalty,
        min: 0,
        max: 500,
        step: 5,
        format: formatWhole,
      },
      {
        label: "Far lane cost",
        key: "farNudgePenalty",
        fallback: LABEL_GUI_DEFAULTS.farNudgePenalty,
        min: 0,
        max: 800,
        step: 5,
        format: formatWhole,
      },
      {
        label: "Below cost",
        key: "bottomPenalty",
        fallback: LABEL_GUI_DEFAULTS.bottomPenalty,
        min: 0,
        max: 5000,
        step: 50,
        format: formatWhole,
      },
      {
        label: "Below diagonal",
        key: "bottomDiagonalPenalty",
        fallback: LABEL_GUI_DEFAULTS.bottomDiagonalPenalty,
        min: 0,
        max: 6000,
        step: 50,
        format: formatWhole,
      },
    ],
  },
];

const NAVIGATOR_GUI_DEFAULTS = {
  useOverride: false,
  backgroundColor: "#f6f6f6",
  backgroundAlpha: 0.72,
  textColor: "#222222",
  borderColor: "#ffffff",
  borderAlpha: 0.58,
  borderWidth: 1,
  topHighlightAlpha: 0.7,
  bottomShadowAlpha: 0.12,
  backdropBlurPx: 24,
  backdropSaturation: 180,
  dividerAlpha: 0.22,
  radius: 999,
  groupPadding: 4,
  buttonPaddingX: 14,
  buttonPaddingY: 6,
  gap: 4,
  bottom: 16,
  fontSize: 13,
  fontWeight: 400,
  fontItalic: false,
  arrowSize: 10,
  arrowFillColor: "#222222",
  arrowFillAlpha: 1,
  arrowOutlineColor: "#222222",
  arrowOutlineAlpha: 0,
  arrowOutlineWidth: 0,
  arrowBevel: 0,
  arrowPaddingX: 14,
  arrowPaddingY: 6,
  shadowAlpha: 0.16,
  shadowBlur: 50,
} satisfies NavigatorOverlayStyle;

function FontSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
    >
      {FONT_OPTIONS.map((option) => (
        <option key={option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Range({
  value,
  onChange,
  min,
  max,
  step,
  format,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <TransientSlider
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={onChange}
      format={format}
      style={{ flex: 1 }}
    />
  );
}

const CAMERA_FOCUS_EASINGS = [
  "linear",
  "easeInOutCubic",
  "easeOutCubic",
  "easeInOutSine",
  "easeOutQuart",
] as const;

const LENS_PRESETS = [
  { id: "ultra-wide", label: "Ultra Wide", fov: 75 },
  { id: "wide", label: "Wide", fov: 62 },
  { id: "documentary", label: "Documentary", fov: 54 },
  { id: "standard", label: "Standard", fov: 45 },
  { id: "portrait", label: "Portrait", fov: 35 },
  { id: "tele", label: "Tele", fov: 25 },
] as const;

const COLOR_FILTER_PRESETS = [
  ["none", "None"],
  ["warm", "Warm"],
  ["cool", "Cool"],
  ["bleach", "Bleach"],
  ["noir", "Noir"],
  ["teal-orange", "Teal Orange"],
  ["sepia", "Sepia"],
  ["infrared", "Infrared"],
] as const;

function cameraFocusNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function LabelInteractionControls({
  labels,
  setLabels,
}: {
  labels: GuiLabelSettings;
  setLabels: (patch: GuiLabelSettings) => void;
}) {
  return (
    <GuiDetail title="Label Interaction">
      {LABEL_INTERACTION_GROUPS.map((group) => (
        <GuiDetail key={group.title} title={group.title}>
          {group.controls.map((control) => (
            <Row key={control.key} label={control.label}>
              <Range
                value={labels[control.key] ?? control.fallback}
                min={control.min}
                max={control.max}
                step={control.step}
                onChange={(value) =>
                  setLabels({ [control.key]: value } as GuiLabelSettings)
                }
                format={control.format}
              />
            </Row>
          ))}
        </GuiDetail>
      ))}
    </GuiDetail>
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

type EnvironmentScenePanelContent = "environment" | "lighting" | "terrain";
type GuiSetupPanelContent =
  | "overlay"
  | "labels"
  | "logo"
  | "editor";

interface EnvironmentScenePanelProps {
  title?: string;
  onActivate?: () => void;
  accentColor?: string | null;
  content?: EnvironmentScenePanelContent;
  scene: SceneProperties;
  setScene: (patch: Partial<SceneProperties>) => void;
}

interface CameraSetupPanelProps {
  title?: string;
  onActivate?: () => void;
  accentColor?: string | null;
  topSlot?: React.ReactNode;
  content?: "camera" | "post";
  scene: SceneProperties;
  setScene: (patch: Partial<SceneProperties>) => void;
}

interface GuiSetupPanelProps {
  title?: string;
  onActivate?: () => void;
  accentColor?: string | null;
  devModeEnabled?: boolean;
  onDevModeChange?: (enabled: boolean) => void;
  content?: GuiSetupPanelContent;
}

type PresentationLightSource = NonNullable<
  NonNullable<SceneProperties["lighting"]>["sources"]
>[number];
type PresentationLightType = NonNullable<PresentationLightSource["type"]>;

const LIGHT_SOURCE_PRESETS: Array<{
  type: PresentationLightType;
  label: string;
}> = [
  { type: "spot", label: "Spot" },
  { type: "area", label: "Area" },
  { type: "point", label: "Point" },
  { type: "directional", label: "Directional" },
];

function lightSourceGainDefault(type: PresentationLightType): number {
  switch (type) {
    case "point":
      return 220000;
    case "spot":
      return 140000;
    case "area":
      return 160;
    case "directional":
    default:
      return 1;
  }
}

function lightSourceGainMax(type: PresentationLightType): number {
  switch (type) {
    case "point":
      return 500000;
    case "spot":
      return 350000;
    case "area":
      return 600;
    case "directional":
    default:
      return 8;
  }
}

function lightSourceGainStep(type: PresentationLightType): number {
  switch (type) {
    case "point":
    case "spot":
      return 5000;
    case "area":
      return 10;
    case "directional":
    default:
      return 0.05;
  }
}

function lightSourceDefaults(
  type: PresentationLightType,
  index: number,
): PresentationLightSource {
  const base = {
    id: `presentation-light-${Date.now().toString(36)}-${index}`,
    label: `${LIGHT_SOURCE_PRESETS.find((p) => p.type === type)?.label ?? "Light"} ${index}`,
    enabled: true,
    type,
    color: "#ffffff",
    gain: lightSourceGainDefault(type),
    intensity:
      type === "spot"
        ? 2.2
        : type === "area"
          ? 2.0
          : type === "point"
            ? 1.8
            : 1.35,
    position: [2500, -3000, 2600] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  };
  if (type === "spot") {
    return {
      ...base,
      distance: 12000,
      decay: 1.4,
      angle: 24,
      penumbra: 0.35,
    };
  }
  if (type === "area") {
    return { ...base, width: 1600, height: 900 };
  }
  if (type === "point") {
    return { ...base, distance: 9000, decay: 1.6 };
  }
  return base;
}

export function EnvironmentScenePanel({
  title = "Environment",
  onActivate,
  accentColor,
  content = "environment",
  scene,
  setScene,
}: EnvironmentScenePanelProps) {
  const [open, setOpen] = useState(false);
  const lightSources = scene.lighting?.sources ?? [];
  const setLighting = (patch: NonNullable<SceneProperties["lighting"]>) =>
    setScene({ lighting: { ...(scene.lighting ?? {}), ...patch } });
  const setLightSources = (sources: PresentationLightSource[]) =>
    setLighting({ sources });
  const updateLightSource = (
    id: string,
    patch: Partial<PresentationLightSource>,
  ) =>
    setLightSources(
      lightSources.map((source) =>
        source.id === id ? { ...source, ...patch } : source,
      ),
    );
  const removeLightSource = (id: string) =>
    setLightSources(lightSources.filter((source) => source.id !== id));
  const changeLightSourceType = (
    source: PresentationLightSource,
    type: PresentationLightType,
  ) => {
    const defaults = lightSourceDefaults(type, lightSources.length + 1);
    updateLightSource(source.id, {
      ...defaults,
      id: source.id,
      label: source.label,
      enabled: source.enabled,
      color: source.color ?? defaults.color,
      intensity: source.intensity ?? defaults.intensity,
      gain: defaults.gain,
      position: source.position ?? defaults.position,
      target: source.target ?? defaults.target,
      type,
    });
  };
  const addLightSource = (type: PresentationLightType) => {
    const nextIndex = lightSources.length + 1;
    setLightSources([...lightSources, lightSourceDefaults(type, nextIndex)]);
  };
  const setTerrain = (patch: NonNullable<SceneProperties["terrain"]>) =>
    setScene({ terrain: { ...(scene.terrain ?? {}), ...patch } });
  const fogDensity = scene.fog?.density ?? 0.00018;
  const fogReachKm = 3 / Math.max(fogDensity, 0.000001) / 1000;
  const setFogDensity = (density: number) =>
    setScene({ fog: { ...(scene.fog ?? {}), density } });

  return (
    <div
      style={environmentGroupStyle}
      onPointerDownCapture={onActivate}
      data-dev-source="src/editor/EnvironmentScenePanel.tsx:216"
      data-dev-note="environmentGroupStyle controls the Global Settings subheading inset."
    >
      <button
        type="button"
        style={accentedEnvironmentHeadingStyle(
          environmentHeadingStyle,
          accentColor,
        )}
        data-dev-source="src/editor/EnvironmentScenePanel.tsx:221"
        data-dev-padding-source="src/editor/EnvironmentScenePanel.tsx:229"
        data-dev-note="environmentHeadingStyle controls the Environment heading pill."
        aria-expanded={open}
        onClick={() => {
          onActivate?.();
          setOpen((v) => !v);
        }}
      >
        <span
          style={environmentHeadingTextStyle}
          data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:113"
        >
          {title}
        </span>
        <span style={environmentDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...environmentChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>

      {open && (
        <div
          style={environmentBodyStyle}
          data-dev-source="src/editor/EnvironmentScenePanel.tsx:264"
          data-dev-note="environmentBodyStyle controls indentation below Environment."
        >
          {content === "environment" && (
            <>
              <div
                style={sectionHeaderStyle}
                data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:132"
              >
                Sun
              </div>
              <div style={panelStyles.section}>
                <Row label="Azimuth">
                  <Range
                    value={scene.sun?.azimuth ?? 235}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(v) =>
                      setScene({
                        sun: { ...(scene.sun ?? {}), azimuth: v },
                      })
                    }
                    format={(v) => `${v.toFixed(0)} deg`}
                  />
                </Row>
                <Row label="Elevation">
                  <Range
                    value={scene.sun?.elevation ?? 22}
                    min={-5}
                    max={85}
                    step={1}
                    onChange={(v) =>
                      setScene({
                        sun: { ...(scene.sun ?? {}), elevation: v },
                      })
                    }
                    format={(v) => `${v.toFixed(0)} deg`}
                  />
                </Row>
                <Row label="Lock to camera">
                  <input
                    type="checkbox"
                    checked={scene.sun?.lockToCamera === true}
                    onChange={(e) =>
                      setScene({
                        sun: {
                          ...(scene.sun ?? {}),
                          lockToCamera: e.target.checked,
                        },
                      })
                    }
                  />
                </Row>
              </div>
            </>
          )}

          {content === "lighting" && (
            <div
              style={environmentNestedBodyStyle}
              data-dev-source="src/editor/EnvironmentScenePanel.tsx:270"
              data-dev-note="Studio lights toggles the hemisphere/key/fill/rim presentation rig."
            >
                <Row label="Studio lights">
                  <input
                    type="checkbox"
                    checked={scene.lighting?.enabled !== false}
                    onChange={(e) =>
                      setLighting({ enabled: e.target.checked })
                    }
                  />
                </Row>
                <Row label="Studio scene elements">
                  <input
                    type="checkbox"
                    checked={scene.lighting?.showSceneElements !== false}
                    onChange={(e) =>
                      setLighting({ showSceneElements: e.target.checked })
                    }
                  />
                </Row>
                <div style={environmentHelpTextStyle}>
                  Scene elements only show the drag handles and guide lines.
                  They do not change the lighting.
                </div>
                <div style={environmentLightSourceStyle}>
                  <div style={environmentLightSummaryStyle}>
                    <span>Base rig</span>
                  </div>
                  <div style={environmentLightBodyStyle}>
                    <Row label="Ambient sky">
                      <input
                        type="color"
                        value={scene.lighting?.hemisphere?.sky ?? "#c4d4ee"}
                        onChange={(e) =>
                          setLighting({
                            hemisphere: {
                              ...(scene.lighting?.hemisphere ?? {}),
                              sky: e.target.value,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Ambient ground">
                      <input
                        type="color"
                        value={scene.lighting?.hemisphere?.ground ?? "#48362a"}
                        onChange={(e) =>
                          setLighting({
                            hemisphere: {
                              ...(scene.lighting?.hemisphere ?? {}),
                              ground: e.target.value,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Ambient power">
                      <Range
                        value={scene.lighting?.hemisphere?.intensity ?? 0.42}
                        min={0}
                        max={2}
                        step={0.02}
                        onChange={(v) =>
                          setLighting({
                            hemisphere: {
                              ...(scene.lighting?.hemisphere ?? {}),
                              intensity: v,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Key color">
                      <input
                        type="color"
                        value={scene.lighting?.directional?.color ?? "#ffe2b8"}
                        onChange={(e) =>
                          setLighting({
                            directional: {
                              ...(scene.lighting?.directional ?? {}),
                              color: e.target.value,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Key power">
                      <Range
                        value={scene.lighting?.directional?.intensity ?? 2.35}
                        min={0}
                        max={6}
                        step={0.05}
                        onChange={(v) =>
                          setLighting({
                            directional: {
                              ...(scene.lighting?.directional ?? {}),
                              intensity: v,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Fill color">
                      <input
                        type="color"
                        value={scene.lighting?.fill?.color ?? "#9ab7d8"}
                        onChange={(e) =>
                          setLighting({
                            fill: {
                              ...(scene.lighting?.fill ?? {}),
                              color: e.target.value,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Fill power">
                      <Range
                        value={scene.lighting?.fill?.intensity ?? 0.22}
                        min={0}
                        max={3}
                        step={0.02}
                        onChange={(v) =>
                          setLighting({
                            fill: {
                              ...(scene.lighting?.fill ?? {}),
                              intensity: v,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Rim color">
                      <input
                        type="color"
                        value={scene.lighting?.rim?.color ?? "#ffd9a0"}
                        onChange={(e) =>
                          setLighting({
                            rim: {
                              ...(scene.lighting?.rim ?? {}),
                              color: e.target.value,
                            },
                          })
                        }
                      />
                    </Row>
                    <Row label="Rim power">
                      <Range
                        value={scene.lighting?.rim?.intensity ?? 0.28}
                        min={0}
                        max={3}
                        step={0.02}
                        onChange={(v) =>
                          setLighting({
                            rim: {
                              ...(scene.lighting?.rim ?? {}),
                              intensity: v,
                            },
                          })
                        }
                      />
                    </Row>
                  </div>
                </div>
                <div style={environmentPresetRowStyle}>
                  {LIGHT_SOURCE_PRESETS.map((preset) => (
                    <button
                      key={preset.type}
                      type="button"
                      style={environmentAddButtonStyle}
                      onClick={() => addLightSource(preset.type)}
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
                {lightSources.map((source, index) => {
                  const sourceType = source.type ?? "spot";
                  const position = source.position ?? [0, -3500, 2500];
                  const target = source.target ?? [0, 0, 0];
                  const setPositionAxis = (axis: 0 | 1 | 2, value: number) => {
                    const next = [...position] as [number, number, number];
                    next[axis] = value;
                    updateLightSource(source.id, { position: next });
                  };
                  const setTargetAxis = (axis: 0 | 1 | 2, value: number) => {
                    const next = [...target] as [number, number, number];
                    next[axis] = value;
                    updateLightSource(source.id, { target: next });
                  };
                  return (
                    <div
                      key={source.id}
                      style={environmentLightSourceStyle}
                    >
                      <div style={environmentLightSummaryStyle}>
                        <span>
                          {source.label || `Light ${index + 1}`}
                        </span>
                        <button
                          type="button"
                          style={environmentRemoveButtonStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLightSource(source.id);
                          }}
                        >
                          remove
                        </button>
                      </div>
                      <div style={environmentLightBodyStyle}>
                        <Row label="Enabled">
                          <input
                            type="checkbox"
                            checked={source.enabled !== false}
                            onChange={(e) =>
                              updateLightSource(source.id, {
                                enabled: e.target.checked,
                              })
                            }
                          />
                        </Row>
                        <Row label="Name">
                          <input
                            type="text"
                            value={source.label ?? ""}
                            onChange={(e) =>
                              updateLightSource(source.id, {
                                label: e.target.value,
                              })
                            }
                            style={panelStyles.textInput}
                          />
                        </Row>
                        <Row label="Source type">
                          <select
                            value={sourceType}
                            onChange={(e) =>
                              changeLightSourceType(
                                source,
                                e.target.value as PresentationLightType,
                              )
                            }
                            style={{ ...panelStyles.textInput, flex: 1 }}
                          >
                            <option value="spot">Spot</option>
                            <option value="area">Area</option>
                            <option value="point">Point</option>
                            <option value="directional">Directional</option>
                          </select>
                        </Row>
                        <Row label="Color">
                          <input
                            type="color"
                            value={source.color ?? "#ffffff"}
                            onChange={(e) =>
                              updateLightSource(source.id, {
                                color: e.target.value,
                              })
                            }
                          />
                        </Row>
                        <Row label="Intensity">
                          <Range
                            value={source.intensity ?? 0.65}
                            min={0}
                            max={5}
                            step={0.05}
                            onChange={(v) =>
                              updateLightSource(source.id, { intensity: v })
                            }
                          />
                        </Row>
                        <Row label="Scene gain">
                          <Range
                            value={
                              source.gain ??
                              lightSourceGainDefault(sourceType)
                            }
                            min={0}
                            max={lightSourceGainMax(sourceType)}
                            step={lightSourceGainStep(sourceType)}
                            onChange={(v) =>
                              updateLightSource(source.id, { gain: v })
                            }
                            format={(v) =>
                              sourceType === "directional"
                                ? `${v.toFixed(2)}x`
                                : `${Math.round(v).toLocaleString()}x`
                            }
                          />
                        </Row>
                        <Row label="Position X">
                          <Range
                            value={position[0]}
                            min={-10000}
                            max={10000}
                            step={100}
                            onChange={(v) => setPositionAxis(0, v)}
                            format={(v) => v.toFixed(0)}
                          />
                        </Row>
                        <Row label="Position Y">
                          <Range
                            value={position[1]}
                            min={-10000}
                            max={10000}
                            step={100}
                            onChange={(v) => setPositionAxis(1, v)}
                            format={(v) => v.toFixed(0)}
                          />
                        </Row>
                        <Row label="Position Z">
                          <Range
                            value={position[2]}
                            min={-2000}
                            max={10000}
                            step={100}
                            onChange={(v) => setPositionAxis(2, v)}
                            format={(v) => v.toFixed(0)}
                          />
                        </Row>
                        {sourceType === "directional" ||
                        sourceType === "spot" ||
                        sourceType === "area" ? (
                          <>
                            <Row label="Target X">
                              <Range
                                value={target[0]}
                                min={-10000}
                                max={10000}
                                step={100}
                                onChange={(v) => setTargetAxis(0, v)}
                                format={(v) => v.toFixed(0)}
                              />
                            </Row>
                            <Row label="Target Y">
                              <Range
                                value={target[1]}
                                min={-10000}
                                max={10000}
                                step={100}
                                onChange={(v) => setTargetAxis(1, v)}
                                format={(v) => v.toFixed(0)}
                              />
                            </Row>
                            <Row label="Target Z">
                              <Range
                                value={target[2]}
                                min={-2000}
                                max={10000}
                                step={100}
                                onChange={(v) => setTargetAxis(2, v)}
                                format={(v) => v.toFixed(0)}
                              />
                            </Row>
                          </>
                        ) : null}

                        {sourceType === "spot" ? (
                          <>
                            <Row label="Cone angle">
                              <Range
                                value={source.angle ?? 24}
                                min={5}
                                max={75}
                                step={1}
                                onChange={(v) =>
                                  updateLightSource(source.id, { angle: v })
                                }
                                format={(v) => `${v.toFixed(0)} deg`}
                              />
                            </Row>
                            <Row label="Soft edge">
                              <Range
                                value={source.penumbra ?? 0.35}
                                min={0}
                                max={1}
                                step={0.05}
                                onChange={(v) =>
                                  updateLightSource(source.id, { penumbra: v })
                                }
                              />
                            </Row>
                          </>
                        ) : null}

                        {sourceType === "area" ? (
                          <>
                            <Row label="Width">
                              <Range
                                value={source.width ?? 1600}
                                min={100}
                                max={6000}
                                step={100}
                                onChange={(v) =>
                                  updateLightSource(source.id, { width: v })
                                }
                                format={(v) => v.toFixed(0)}
                              />
                            </Row>
                            <Row label="Height">
                              <Range
                                value={source.height ?? 900}
                                min={100}
                                max={6000}
                                step={100}
                                onChange={(v) =>
                                  updateLightSource(source.id, { height: v })
                                }
                                format={(v) => v.toFixed(0)}
                              />
                            </Row>
                          </>
                        ) : null}

                        {sourceType === "point" || sourceType === "spot" ? (
                          <>
                            <Row label="Distance">
                              <Range
                                value={
                                  source.distance ??
                                  (sourceType === "spot" ? 12000 : 9000)
                                }
                                min={500}
                                max={30000}
                                step={500}
                                onChange={(v) =>
                                  updateLightSource(source.id, {
                                    distance: v,
                                  })
                                }
                                format={(v) => v.toFixed(0)}
                              />
                            </Row>
                            <Row label="Falloff">
                              <Range
                                value={
                                  source.decay ??
                                  (sourceType === "spot" ? 1.4 : 1.6)
                                }
                                min={0}
                                max={3}
                                step={0.05}
                                onChange={(v) =>
                                  updateLightSource(source.id, { decay: v })
                                }
                              />
                            </Row>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {content === "environment" && (
            <>
              <div
                style={sectionHeaderStyle}
                data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:160"
              >
                Brightness
              </div>
              <div style={panelStyles.section}>
                <Row label="Exposure">
                  <Range
                    value={scene.exposure ?? 1}
                    min={0.3}
                    max={2.5}
                    step={0.05}
                    onChange={(v) => setScene({ exposure: v })}
                  />
                </Row>
              </div>

              <div
                style={sectionHeaderStyle}
                data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:173"
              >
                Atmosphere
              </div>
              <div style={panelStyles.section}>
                <Row label="Light mode">
                  <input
                    type="checkbox"
                    checked={scene.lightMode === true}
                    onChange={(e) => setScene({ lightMode: e.target.checked })}
                  />
                </Row>
                <Row label="Dark background">
                  <input
                    data-dev-source="src/editor/EnvironmentScenePanel.tsx:192"
                    data-dev-note="Dark mode background color input; input[type=color] shape is controlled in global.css."
                    type="color"
                    value={scene.background ?? "#23252a"}
                    onChange={(e) => setScene({ background: e.target.value })}
                  />
                </Row>
                <Row label="Dark fog">
                  <input
                    type="color"
                    value={scene.fog?.color ?? scene.background ?? "#23252a"}
                    onChange={(e) =>
                      setScene({
                        fog: { ...(scene.fog ?? {}), color: e.target.value },
                      })
                    }
                  />
                </Row>
                <Row label="Light background">
                  <input
                    type="color"
                    value={scene.lightModeBackground ?? "#a0a0a0"}
                    onChange={(e) =>
                      setScene({ lightModeBackground: e.target.value })
                    }
                  />
                </Row>
                <Row label="Light fog">
                  <input
                    type="color"
                    value={
                      scene.fog?.lightModeColor ??
                      scene.lightModeBackground ??
                      "#a0a0a0"
                    }
                    onChange={(e) =>
                      setScene({
                        fog: {
                          ...(scene.fog ?? {}),
                          lightModeColor: e.target.value,
                        },
                      })
                    }
                  />
                </Row>
                <Row label="Fog enabled">
                  <input
                    type="checkbox"
                    checked={scene.fog?.enabled !== false}
                    onChange={(e) =>
                      setScene({
                        fog: { ...(scene.fog ?? {}), enabled: e.target.checked },
                      })
                    }
                  />
                </Row>
                {scene.fog?.enabled !== false ? (
                  <>
                    <Row label="Fog density">
                      <Range
                        value={fogDensity * 10000}
                        min={0.02}
                        max={6}
                        step={0.05}
                        onChange={(v) => setFogDensity(v / 10000)}
                        format={(v) => v.toFixed(2)}
                      />
                    </Row>
                    <Row label="Fog reach">
                      <Range
                        value={fogReachKm}
                        min={5}
                        max={3000}
                        step={5}
                        onChange={(v) =>
                          setFogDensity(3 / Math.max(v * 1000, 1))
                        }
                        format={(v) => `${v.toFixed(0)} km`}
                      />
                    </Row>
                  </>
                ) : null}
              </div>
            </>
          )}

          {content === "terrain" && (
            <div
              style={environmentNestedBodyStyle}
              data-dev-source="src/editor/EnvironmentScenePanel.tsx:317"
              data-dev-note="Grid controls: visible, color, opacity, spacing, line width, and underside surface."
            >
                <Row label="Visible">
                  <input
                    type="checkbox"
                    checked={scene.terrain?.gridEnabled ?? true}
                    onChange={(e) =>
                      setTerrain({ gridEnabled: e.target.checked })
                    }
                  />
                </Row>
                <Row label="Color">
                  <input
                    type="color"
                    value={scene.terrain?.gridColor ?? "#bababa"}
                    onChange={(e) => setTerrain({ gridColor: e.target.value })}
                  />
                </Row>
                <Row label="Opacity">
                  <Range
                    value={scene.terrain?.gridOpacity ?? 0.68}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setTerrain({ gridOpacity: v })}
                  />
                </Row>
                <Row label="Spacing">
                  <Range
                    value={scene.terrain?.gridSpacingM ?? 600}
                    min={250}
                    max={4000}
                    step={50}
                    onChange={(v) => setTerrain({ gridSpacingM: v })}
                    format={(v) => `${v.toFixed(0)}m`}
                  />
                </Row>
                <Row label="Line width">
                  <Range
                    value={scene.terrain?.gridLineWidthM ?? 2.75}
                    min={0.25}
                    max={8}
                    step={0.25}
                    onChange={(v) => setTerrain({ gridLineWidthM: v })}
                    format={(v) => v.toFixed(2)}
                  />
                </Row>
                <Row label="Surface">
                  <Range
                    value={scene.terrain?.undersideOpacity ?? 0}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setTerrain({ undersideOpacity: v })}
                  />
                </Row>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CameraSetupPanel({
  title = "Camera Setup",
  onActivate,
  accentColor,
  topSlot,
  content = "camera",
  scene,
  setScene,
}: CameraSetupPanelProps) {
  const [open, setOpen] = useState(false);
  const setCamera = (patch: NonNullable<SceneProperties["camera"]>) =>
    setScene({ camera: { ...(scene.camera ?? {}), ...patch } });
  const setVignette = (patch: NonNullable<SceneProperties["vignette"]>) =>
    setScene({ vignette: { ...(scene.vignette ?? {}), ...patch } });
  const setColorGrade = (patch: NonNullable<SceneProperties["colorGrade"]>) =>
    setScene({ colorGrade: { ...(scene.colorGrade ?? {}), ...patch } });
  const setBloom = (patch: NonNullable<SceneProperties["bloom"]>) =>
    setScene({ bloom: { ...(scene.bloom ?? {}), ...patch } });
  const setDepthOfField = (
    patch: NonNullable<SceneProperties["depthOfField"]>,
  ) =>
    setScene({
      depthOfField: {
        ...(scene.depthOfField ?? {}),
        ...patch,
      },
    });
  const setTiltShift = (
    patch: NonNullable<SceneProperties["tiltShift"]>,
  ) =>
    setScene({
      tiltShift: {
        ...(scene.tiltShift ?? {}),
        ...patch,
      },
    });
  const setLensEffects = (
    patch: NonNullable<SceneProperties["lensEffects"]>,
  ) =>
    setScene({
      lensEffects: {
        ...(scene.lensEffects ?? {}),
        ...patch,
      },
    });
  const setMotionTrails = (
    patch: NonNullable<SceneProperties["motionTrails"]>,
  ) =>
    setScene({
      motionTrails: {
        ...(scene.motionTrails ?? {}),
        ...patch,
      },
    });
  const setPresentationFrame = (
    patch: NonNullable<SceneProperties["presentationFrame"]>,
  ) =>
    setScene({
      presentationFrame: {
        ...(scene.presentationFrame ?? {}),
        ...patch,
      },
    });
  const setCompositionGuides = (
    patch: NonNullable<SceneProperties["compositionGuides"]>,
  ) =>
    setScene({
      compositionGuides: {
        ...(scene.compositionGuides ?? {}),
        ...patch,
      },
    });
  const setAmbientOcclusion = (
    patch: NonNullable<SceneProperties["ambientOcclusion"]>,
  ) =>
    setScene({
      ambientOcclusion: {
        ...(scene.ambientOcclusion ?? {}),
        ...patch,
      },
    });
  const setCameraFocus = (
    patch: NonNullable<SceneProperties["cameraFocus"]>,
  ) =>
    setScene({
      cameraFocus: {
        ...(scene.cameraFocus ?? {}),
        ...patch,
      },
    });
  const cameraFocus = scene.cameraFocus ?? {};
  const dofFocusPoint = scene.depthOfField?.focusPoint ?? [0, 0, 0];
  const setDepthOfFieldFocusPoint = (index: 0 | 1 | 2, value: number) => {
    const next: [number, number, number] = [
      dofFocusPoint[0] ?? 0,
      dofFocusPoint[1] ?? 0,
      dofFocusPoint[2] ?? 0,
    ];
    next[index] = Number.isFinite(value) ? value : 0;
    setDepthOfField({ focusPoint: next });
  };
  const selectedLensPreset =
    scene.camera?.lensPreset ??
    LENS_PRESETS.find((preset) => preset.fov === scene.camera?.fov)?.id ??
    "standard";

  return (
    <div
      style={environmentGroupStyle}
      onPointerDownCapture={onActivate}
      data-dev-source="src/editor/EnvironmentScenePanel.tsx:239"
      data-dev-note={
        content === "post"
          ? "PostProcessingPanel controls depth, finish, glow, optics, trails, guides, and frame settings."
          : "CameraSetupPanel controls lens and camera focus settings."
      }
    >
      <button
        type="button"
        style={accentedEnvironmentHeadingStyle(
          environmentHeadingStyle,
          accentColor,
        )}
        data-dev-source="src/editor/EnvironmentScenePanel.tsx:245"
        data-dev-padding-source="src/editor/EnvironmentScenePanel.tsx:253"
        data-dev-note="environmentHeadingStyle controls the Camera Setup heading pill."
        aria-expanded={open}
        onClick={() => {
          onActivate?.();
          setOpen((v) => !v);
        }}
      >
        <span
          style={environmentHeadingTextStyle}
          data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:257"
        >
          {title}
        </span>
        <span style={environmentDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...environmentChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>

      {open && (
        <div
          style={environmentBodyStyle}
          data-dev-source="src/editor/EnvironmentScenePanel.tsx:275"
          data-dev-note="environmentBodyStyle controls indentation below Camera Setup."
        >
          {content === "camera" && (
            <>
              {topSlot && (
                <>
                  <div style={sectionHeaderStyle}>Render Preset</div>
                  {topSlot}
                </>
              )}

              <div style={sectionHeaderStyle}>Lens Types</div>
              <div style={panelStyles.section}>
                <Row label="Lens type">
                  <select
                    value={selectedLensPreset}
                    onChange={(e) => {
                      const lensPreset = e.target.value as NonNullable<
                        SceneProperties["camera"]
                      >["lensPreset"];
                      const preset = LENS_PRESETS.find(
                        (candidate) => candidate.id === lensPreset,
                      );
                      setCamera({
                        lensPreset,
                        fov: preset?.fov ?? scene.camera?.fov ?? 45,
                      });
                    }}
                    style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
                  >
                    {LENS_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Lens">
                  <Range
                    value={scene.camera?.fov ?? 50}
                    min={25}
                    max={75}
                    step={1}
                    onChange={(v) => setCamera({ fov: v })}
                    format={(v) => `${v.toFixed(0)} deg`}
                  />
                </Row>
              </div>

              <div style={sectionHeaderStyle}>Camera Focus</div>
              <div style={panelStyles.section}>
                <div style={panelStyles.muted}>
                  Affects double-click focus only.
                </div>
                <Row label="Duration">
                  <Range
                    value={cameraFocusNumber(cameraFocus.durationMs, 900, 0, 5000)}
                    min={0}
                    max={5000}
                    step={50}
                    format={(v) => `${v.toFixed(0)} ms`}
                    onChange={(v) => setCameraFocus({ durationMs: v })}
                  />
                </Row>
                <Row label="Easing">
                  <select
                    value={cameraFocus.easing ?? "easeOutCubic"}
                    onChange={(e) =>
                      setCameraFocus({
                        easing: e.target.value as NonNullable<
                          SceneProperties["cameraFocus"]
                        >["easing"],
                      })
                    }
                    style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
                  >
                    {CAMERA_FOCUS_EASINGS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Fit padding">
                  <Range
                    value={cameraFocusNumber(cameraFocus.fitPaddingPx, 500, 0, 2000)}
                    min={0}
                    max={2000}
                    step={25}
                    format={(v) => `${v.toFixed(0)} px`}
                    onChange={(v) => setCameraFocus({ fitPaddingPx: v })}
                  />
                </Row>
                <Row label="Same target">
                  <Range
                    value={cameraFocusNumber(
                      cameraFocus.sameTargetZoomFactor,
                      0.7,
                      0.05,
                      1.5,
                    )}
                    min={0.05}
                    max={1.5}
                    step={0.05}
                    format={(v) => `${v.toFixed(2)}x`}
                    onChange={(v) => setCameraFocus({ sameTargetZoomFactor: v })}
                  />
                </Row>
                <Row label="Click delay">
                  <Range
                    value={cameraFocusNumber(
                      cameraFocus.singleClickDelayMs,
                      250,
                      120,
                      500,
                    )}
                    min={120}
                    max={500}
                    step={10}
                    format={(v) => `${v.toFixed(0)} ms`}
                    onChange={(v) => setCameraFocus({ singleClickDelayMs: v })}
                  />
                </Row>
                <Row label="Scroll settle">
                  <Range
                    value={cameraFocusNumber(
                      cameraFocus.scrollSettleMs,
                      250,
                      80,
                      800,
                    )}
                    min={80}
                    max={800}
                    step={10}
                    format={(v) => `${v.toFixed(0)} ms`}
                    onChange={(v) => setCameraFocus({ scrollSettleMs: v })}
                  />
                </Row>
                <Row label="Pill pulse">
                  <Range
                    value={cameraFocusNumber(cameraFocus.pulsePillMs, 600, 200, 1600)}
                    min={200}
                    max={1600}
                    step={20}
                    format={(v) => `${v.toFixed(0)} ms`}
                    onChange={(v) => setCameraFocus({ pulsePillMs: v })}
                  />
                </Row>
                <Row label="Text pulse">
                  <Range
                    value={cameraFocusNumber(cameraFocus.pulseTextMs, 480, 200, 1600)}
                    min={200}
                    max={1600}
                    step={20}
                    format={(v) => `${v.toFixed(0)} ms`}
                    onChange={(v) => setCameraFocus({ pulseTextMs: v })}
                  />
                </Row>
                <Row label="Static pulse">
                  <Range
                    value={cameraFocusNumber(
                      cameraFocus.pulseStaticMs,
                      1200,
                      400,
                      3000,
                    )}
                    min={400}
                    max={3000}
                    step={50}
                    format={(v) => `${v.toFixed(0)} ms`}
                    onChange={(v) => setCameraFocus({ pulseStaticMs: v })}
                  />
                </Row>
                <Row label="Reveal scroll">
                  <select
                    value={cameraFocus.revealScrollBehavior ?? "smooth"}
                    onChange={(e) =>
                      setCameraFocus({
                        revealScrollBehavior: e.target.value as NonNullable<
                          SceneProperties["cameraFocus"]
                        >["revealScrollBehavior"],
                      })
                    }
                    style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
                  >
                    <option value="smooth">smooth</option>
                    <option value="auto">auto</option>
                  </select>
                </Row>
                <Row label="RMB threshold">
                  <Range
                    value={cameraFocusNumber(cameraFocus.rmbExitDragPx, 0, 0, 24)}
                    min={0}
                    max={24}
                    step={1}
                    format={(v) => `${v.toFixed(0)} px`}
                    onChange={(v) => setCameraFocus({ rmbExitDragPx: v })}
                  />
                </Row>
              </div>
            </>
          )}

          {content === "post" && (
            <>
              <div style={sectionHeaderStyle}>Depth of Field</div>
          <div style={panelStyles.section}>
            <Row label="Depth of field">
              <input
                type="checkbox"
                checked={scene.depthOfField?.enabled === true}
                onChange={(e) =>
                  setDepthOfField({ enabled: e.target.checked })
                }
              />
            </Row>
            <div style={dofSubheadingStyle}>Focus Target</div>
            <Row label="Focus mode">
              <select
                value={scene.depthOfField?.focusMode ?? "page-target"}
                onChange={(e) =>
                  setDepthOfField({
                    focusMode: e.target.value as NonNullable<
                      SceneProperties["depthOfField"]
                    >["focusMode"],
                  })
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              >
                <option value="page-target">page target</option>
                <option value="camera-object">camera object</option>
                <option value="manual-distance">manual distance</option>
                <option value="picked-point">picked point</option>
              </select>
            </Row>
            <Row label="Focus dist.">
              <Range
                value={scene.depthOfField?.focusDistanceM ?? 1000}
                min={1}
                max={50000}
                step={25}
                format={(v) => `${v.toFixed(0)} m`}
                onChange={(v) => setDepthOfField({ focusDistanceM: v })}
              />
            </Row>
            <Row label="Focus offset">
              <Range
                value={scene.depthOfField?.focusOffsetM ?? 0}
                min={-25000}
                max={25000}
                step={25}
                format={(v) => `${v.toFixed(0)} m`}
                onChange={(v) => setDepthOfField({ focusOffsetM: v })}
              />
            </Row>
            <Row label="Focus X">
              <input
                type="number"
                value={dofFocusPoint[0] ?? 0}
                onChange={(e) =>
                  setDepthOfFieldFocusPoint(0, Number(e.target.value))
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              />
            </Row>
            <Row label="Focus Y">
              <input
                type="number"
                value={dofFocusPoint[1] ?? 0}
                onChange={(e) =>
                  setDepthOfFieldFocusPoint(1, Number(e.target.value))
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              />
            </Row>
            <Row label="Focus Z">
              <input
                type="number"
                value={dofFocusPoint[2] ?? 0}
                onChange={(e) =>
                  setDepthOfFieldFocusPoint(2, Number(e.target.value))
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              />
            </Row>
            <div style={dofSubheadingStyle}>Blur Strength</div>
            <Row label="Aperture">
              <Range
                value={scene.depthOfField?.aperture ?? 0.00002}
                min={0}
                max={0.0002}
                step={0.000005}
                format={(v) => v.toFixed(6)}
                onChange={(v) => setDepthOfField({ aperture: v })}
              />
            </Row>
            <Row label="Max blur">
              <Range
                value={scene.depthOfField?.maxBlur ?? 0.004}
                min={0}
                max={0.03}
                step={0.001}
                format={(v) => v.toFixed(3)}
                onChange={(v) => setDepthOfField({ maxBlur: v })}
              />
            </Row>
            <div style={dofSubheadingStyle}>Focus Debug</div>
            <Row label="Debug plane">
              <input
                type="checkbox"
                checked={scene.depthOfField?.debugFocusPlane === true}
                onChange={(e) =>
                  setDepthOfField({ debugFocusPlane: e.target.checked })
                }
              />
            </Row>
            <Row label="Debug opacity">
              <Range
                value={scene.depthOfField?.debugFocusPlaneOpacity ?? 0.16}
                min={0.02}
                max={0.5}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) =>
                  setDepthOfField({ debugFocusPlaneOpacity: v })
                }
              />
            </Row>
            <Row label="Debug scale">
              <Range
                value={scene.depthOfField?.debugFocusPlaneScale ?? 1}
                min={0.1}
                max={3}
                step={0.05}
                format={(v) => `${v.toFixed(2)}x`}
                onChange={(v) => setDepthOfField({ debugFocusPlaneScale: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Tilt-Shift</div>
          <div style={panelStyles.section}>
            <Row label="Tilt-shift">
              <input
                type="checkbox"
                checked={scene.tiltShift?.enabled === true}
                onChange={(e) => setTiltShift({ enabled: e.target.checked })}
              />
            </Row>
            <Row label="Center X">
              <Range
                value={scene.tiltShift?.centerX ?? 0.5}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setTiltShift({ centerX: v })}
              />
            </Row>
            <Row label="Center Y">
              <Range
                value={scene.tiltShift?.centerY ?? 0.5}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setTiltShift({ centerY: v })}
              />
            </Row>
            <Row label="Angle">
              <Range
                value={scene.tiltShift?.angleDeg ?? 0}
                min={-90}
                max={90}
                step={1}
                format={(v) => `${v.toFixed(0)} deg`}
                onChange={(v) => setTiltShift({ angleDeg: v })}
              />
            </Row>
            <Row label="Band">
              <Range
                value={scene.tiltShift?.bandSize ?? 0.28}
                min={0.02}
                max={0.9}
                step={0.01}
                onChange={(v) => setTiltShift({ bandSize: v })}
              />
            </Row>
            <Row label="Feather">
              <Range
                value={scene.tiltShift?.feather ?? 0.2}
                min={0.01}
                max={0.8}
                step={0.01}
                onChange={(v) => setTiltShift({ feather: v })}
              />
            </Row>
            <Row label="Blur">
              <Range
                value={scene.tiltShift?.blur ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setTiltShift({ blur: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Post Production</div>
          <div style={panelStyles.section}>
            <Row label="Amount">
              <Range
                value={scene.vignette?.strength ?? 0.95}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setVignette({ strength: v })}
              />
            </Row>
            <Row label="Softness">
              <Range
                value={scene.vignette?.smoothness ?? 0.75}
                min={0.1}
                max={1.5}
                step={0.05}
                onChange={(v) => setVignette({ smoothness: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Image finish</div>
          <div style={panelStyles.section}>
            <Row label="Contrast">
              <Range
                value={scene.colorGrade?.contrast ?? 1.06}
                min={0.75}
                max={1.35}
                step={0.01}
                onChange={(v) => setColorGrade({ contrast: v })}
              />
            </Row>
            <Row label="Saturation">
              <Range
                value={scene.colorGrade?.saturation ?? 1.06}
                min={0.5}
                max={1.5}
                step={0.01}
                onChange={(v) => setColorGrade({ saturation: v })}
              />
            </Row>
            <Row label="Vibrancy">
              <Range
                value={scene.colorGrade?.vibrancy ?? 1.0}
                min={0.5}
                max={1.8}
                step={0.01}
                onChange={(v) => setColorGrade({ vibrancy: v })}
              />
            </Row>
            <Row label="Tint color">
              <input
                data-dev-source="src/editor/EnvironmentScenePanel.tsx:342"
                data-dev-note="Camera Setup tint color; input[type=color] shape is controlled in global.css."
                type="color"
                value={
                  scene.colorGrade?.tint ??
                  scene.fog?.color ??
                  scene.background ??
                  "#23252a"
                }
                onChange={(e) => setColorGrade({ tint: e.target.value })}
              />
            </Row>
            <Row label="Tint amount">
              <Range
                value={scene.colorGrade?.tintStrength ?? 0.04}
                min={0}
                max={0.25}
                step={0.01}
                onChange={(v) => setColorGrade({ tintStrength: v })}
              />
            </Row>
            <Row label="Temperature">
              <Range
                value={scene.colorGrade?.temperature ?? 0}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => setColorGrade({ temperature: v })}
              />
            </Row>
            <Row label="Black point">
              <Range
                value={scene.colorGrade?.blackPoint ?? 0}
                min={0}
                max={0.8}
                step={0.01}
                onChange={(v) => setColorGrade({ blackPoint: v })}
              />
            </Row>
            <Row label="White point">
              <Range
                value={scene.colorGrade?.whitePoint ?? 1}
                min={0.2}
                max={2}
                step={0.01}
                onChange={(v) => setColorGrade({ whitePoint: v })}
              />
            </Row>
            <Row label="Lift">
              <Range
                value={scene.colorGrade?.lift ?? 0}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => setColorGrade({ lift: v })}
              />
            </Row>
            <Row label="Gamma">
              <Range
                value={scene.colorGrade?.gamma ?? 1}
                min={0.25}
                max={3}
                step={0.01}
                onChange={(v) => setColorGrade({ gamma: v })}
              />
            </Row>
            <Row label="Gain">
              <Range
                value={scene.colorGrade?.gain ?? 1}
                min={0}
                max={3}
                step={0.01}
                onChange={(v) => setColorGrade({ gain: v })}
              />
            </Row>
            <Row label="Shadow tone">
              <input
                type="color"
                value={scene.colorGrade?.splitShadowColor ?? "#182238"}
                onChange={(e) =>
                  setColorGrade({ splitShadowColor: e.target.value })
                }
              />
            </Row>
            <Row label="Highlight tone">
              <input
                type="color"
                value={scene.colorGrade?.splitHighlightColor ?? "#ffd29a"}
                onChange={(e) =>
                  setColorGrade({ splitHighlightColor: e.target.value })
                }
              />
            </Row>
            <Row label="Split amount">
              <Range
                value={scene.colorGrade?.splitToneAmount ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setColorGrade({ splitToneAmount: v })}
              />
            </Row>
            <Row label="Filter">
              <select
                value={scene.colorGrade?.filterPreset ?? "none"}
                onChange={(e) =>
                  setColorGrade({
                    filterPreset: e.target.value as NonNullable<
                      SceneProperties["colorGrade"]
                    >["filterPreset"],
                  })
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              >
                {COLOR_FILTER_PRESETS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Filter amount">
              <Range
                value={scene.colorGrade?.filterIntensity ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setColorGrade({ filterIntensity: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Glow</div>
          <div style={panelStyles.section}>
            <Row label="Strength">
              <Range
                value={scene.bloom?.strength ?? 0}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => setBloom({ strength: v })}
              />
            </Row>
            <Row label="Radius">
              <Range
                value={scene.bloom?.radius ?? 0.7}
                min={0}
                max={1.5}
                step={0.05}
                onChange={(v) => setBloom({ radius: v })}
              />
            </Row>
            <Row label="Threshold">
              <Range
                value={scene.bloom?.threshold ?? 0.82}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setBloom({ threshold: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Film / Optics</div>
          <div style={panelStyles.section}>
            <Row label="Grain">
              <Range
                value={scene.lensEffects?.grain ?? 0}
                min={0}
                max={0.35}
                step={0.01}
                onChange={(v) => setLensEffects({ grain: v })}
              />
            </Row>
            <Row label="Grain size">
              <Range
                value={scene.lensEffects?.grainSize ?? 1}
                min={0.25}
                max={16}
                step={0.25}
                onChange={(v) => setLensEffects({ grainSize: v })}
              />
            </Row>
            <Row label="Distortion">
              <Range
                value={scene.lensEffects?.distortion ?? 0}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => setLensEffects({ distortion: v })}
              />
            </Row>
            <Row label="Chromatic">
              <Range
                value={scene.lensEffects?.chromaticAberration ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setLensEffects({ chromaticAberration: v })
                }
              />
            </Row>
            <Row label="Sharpen">
              <Range
                value={scene.lensEffects?.sharpen ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLensEffects({ sharpen: v })}
              />
            </Row>
            <Row label="Diffusion">
              <Range
                value={scene.lensEffects?.diffusion ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLensEffects({ diffusion: v })}
              />
            </Row>
            <Row label="Halation">
              <Range
                value={scene.lensEffects?.halation ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLensEffects({ halation: v })}
              />
            </Row>
            <Row label="Anamorphic">
              <Range
                value={scene.lensEffects?.anamorphicStreak ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setLensEffects({ anamorphicStreak: v })}
              />
            </Row>
            <Row label="Streak len.">
              <Range
                value={scene.lensEffects?.anamorphicStreakLength ?? 0.45}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setLensEffects({ anamorphicStreakLength: v })
                }
              />
            </Row>
            <Row label="Streak gate">
              <Range
                value={scene.lensEffects?.anamorphicStreakThreshold ?? 0.82}
                min={0.2}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setLensEffects({ anamorphicStreakThreshold: v })
                }
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Motion Trails</div>
          <div style={panelStyles.section}>
            <Row label="Trails">
              <input
                type="checkbox"
                checked={scene.motionTrails?.enabled === true}
                onChange={(e) =>
                  setMotionTrails({ enabled: e.target.checked })
                }
              />
            </Row>
            <Row label="Amount">
              <Range
                value={scene.motionTrails?.amount ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setMotionTrails({ amount: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Composition Guides</div>
          <div style={panelStyles.section}>
            <Row label="Guides">
              <input
                type="checkbox"
                checked={scene.compositionGuides?.enabled === true}
                onChange={(e) =>
                  setCompositionGuides({ enabled: e.target.checked })
                }
              />
            </Row>
            <Row label="Thirds">
              <input
                type="checkbox"
                checked={scene.compositionGuides?.ruleOfThirds === true}
                onChange={(e) =>
                  setCompositionGuides({ ruleOfThirds: e.target.checked })
                }
              />
            </Row>
            <Row label="Center">
              <input
                type="checkbox"
                checked={scene.compositionGuides?.centerCross === true}
                onChange={(e) =>
                  setCompositionGuides({ centerCross: e.target.checked })
                }
              />
            </Row>
            <Row label="Safe frame">
              <input
                type="checkbox"
                checked={scene.compositionGuides?.safeFrame === true}
                onChange={(e) =>
                  setCompositionGuides({ safeFrame: e.target.checked })
                }
              />
            </Row>
            <Row label="Aspect">
              <select
                value={scene.compositionGuides?.aspectMask ?? "none"}
                onChange={(e) =>
                  setCompositionGuides({
                    aspectMask: e.target.value as NonNullable<
                      SceneProperties["compositionGuides"]
                    >["aspectMask"],
                  })
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              >
                <option value="none">none</option>
                <option value="16:9">16:9</option>
                <option value="1.85:1">1.85:1</option>
                <option value="2.39:1">2.39:1</option>
              </select>
            </Row>
            <Row label="Line thickness">
              <Range
                value={scene.compositionGuides?.lineThickness ?? 0.25}
                min={0.1}
                max={2}
                step={0.05}
                format={(v) => `${v.toFixed(2)}x`}
                onChange={(v) => setCompositionGuides({ lineThickness: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Presentation Frame</div>
          <div style={panelStyles.section}>
            <Row label="Letterbox">
              <input
                type="checkbox"
                checked={scene.presentationFrame?.letterbox === true}
                onChange={(e) =>
                  setPresentationFrame({ letterbox: e.target.checked })
                }
              />
            </Row>
            <Row label="Aspect">
              <select
                value={scene.presentationFrame?.aspectRatio ?? "none"}
                onChange={(e) =>
                  setPresentationFrame({
                    aspectRatio: e.target.value as NonNullable<
                      SceneProperties["presentationFrame"]
                    >["aspectRatio"],
                  })
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              >
                <option value="none">none</option>
                <option value="16:9">16:9</option>
                <option value="1.85:1">1.85:1</option>
                <option value="2.39:1">2.39:1</option>
                <option value="4:3">4:3</option>
              </select>
            </Row>
            <Row label="Matte">
              <Range
                value={scene.presentationFrame?.matteOpacity ?? 0.72}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setPresentationFrame({ matteOpacity: v })}
              />
            </Row>
            <Row label="Matte color">
              <input
                type="color"
                value={scene.presentationFrame?.matteColor ?? "#000000"}
                onChange={(e) =>
                  setPresentationFrame({ matteColor: e.target.value })
                }
              />
            </Row>
            <Row label="Corner fade">
              <Range
                value={scene.presentationFrame?.cornerFade ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setPresentationFrame({ cornerFade: v })}
              />
            </Row>
            <Row label="Gate weave">
              <Range
                value={scene.presentationFrame?.gateWeave ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setPresentationFrame({ gateWeave: v })}
              />
            </Row>
          </div>

          <div style={sectionHeaderStyle}>Contact Depth</div>
          <div style={panelStyles.section}>
            <Row label="Ambient occl.">
              <input
                type="checkbox"
                checked={scene.ambientOcclusion?.enabled ?? true}
                onChange={(e) =>
                  setAmbientOcclusion({ enabled: e.target.checked })
                }
              />
            </Row>
            <Row label="Radius">
              <Range
                value={scene.ambientOcclusion?.radius ?? 7}
                min={0}
                max={24}
                step={0.5}
                onChange={(v) => setAmbientOcclusion({ radius: v })}
              />
            </Row>
            <Row label="Near">
              <Range
                value={scene.ambientOcclusion?.minDistance ?? 0.004}
                min={0}
                max={0.04}
                step={0.001}
                format={(v) => v.toFixed(3)}
                onChange={(v) => setAmbientOcclusion({ minDistance: v })}
              />
            </Row>
            <Row label="Far">
              <Range
                value={scene.ambientOcclusion?.maxDistance ?? 0.12}
                min={0.02}
                max={0.4}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => setAmbientOcclusion({ maxDistance: v })}
              />
            </Row>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PostProcessingPanel(
  props: Omit<CameraSetupPanelProps, "content" | "topSlot">,
) {
  return <CameraSetupPanel {...props} content="post" />;
}

export function GuiSetupPanel({
  title = "Box Overlay Styles",
  onActivate,
  accentColor,
  devModeEnabled = false,
  onDevModeChange,
  content = "overlay",
}: GuiSetupPanelProps) {
  const { state, setEnvScene } = useEditor();
  const scene: SceneProperties = state.environment.scene ?? {};
  const gui = scene.gui ?? {};
  const overlay = gui.overlay ?? {};
  const navigator = gui.navigator ?? {};
  const logo = gui.logo ?? {};
  const labels = gui.labels ?? {};
  const editor = gui.editor ?? {};
  const overlayStyles = gui.overlayStyles ?? [];
  const firstOverlayStyle: BoxOverlayStylePreset = {
    id: "overlay-style-1",
    label: "Style 1",
    overlay: { ...overlay },
    navigator: { ...navigator },
    labels: { ...labels },
  };
  const overlayStyleButtons =
    overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
  const activeOverlayStyleId =
    gui.activeOverlayStyleId ??
    (overlayStyles.length > 0 ? overlayStyles[0]?.id : firstOverlayStyle.id);
  const linkedOverlayRadius =
    (overlay.imageRadius ?? 16) + (overlay.imagePadding ?? 32);
  const navigatorOverride = navigator.useOverride === true;
  const navigatorPreview: NavigatorOverlayStyle = navigatorOverride
    ? {
        ...NAVIGATOR_GUI_DEFAULTS,
        ...overlay,
        ...navigator,
        fontWeight:
          navigator.fontWeight ??
          overlay.bodyFontWeight ??
          NAVIGATOR_GUI_DEFAULTS.fontWeight,
        fontItalic:
          navigator.fontItalic ??
          overlay.bodyItalic ??
          NAVIGATOR_GUI_DEFAULTS.fontItalic,
        arrowFillColor:
          navigator.arrowFillColor ??
          navigator.textColor ??
          overlay.textColor ??
          NAVIGATOR_GUI_DEFAULTS.arrowFillColor,
        arrowOutlineColor:
          navigator.arrowOutlineColor ??
          navigator.arrowFillColor ??
          navigator.textColor ??
          overlay.textColor ??
          NAVIGATOR_GUI_DEFAULTS.arrowOutlineColor,
      }
    : {
        ...NAVIGATOR_GUI_DEFAULTS,
        backgroundColor:
          overlay.backgroundColor ?? NAVIGATOR_GUI_DEFAULTS.backgroundColor,
        backgroundAlpha:
          overlay.backgroundAlpha ?? NAVIGATOR_GUI_DEFAULTS.backgroundAlpha,
        textColor: overlay.textColor ?? NAVIGATOR_GUI_DEFAULTS.textColor,
        borderColor: overlay.borderColor ?? NAVIGATOR_GUI_DEFAULTS.borderColor,
        borderAlpha: overlay.borderAlpha ?? NAVIGATOR_GUI_DEFAULTS.borderAlpha,
        borderWidth: overlay.borderWidth ?? NAVIGATOR_GUI_DEFAULTS.borderWidth,
        topHighlightAlpha:
          overlay.topHighlightAlpha ?? NAVIGATOR_GUI_DEFAULTS.topHighlightAlpha,
        bottomShadowAlpha:
          overlay.bottomShadowAlpha ?? NAVIGATOR_GUI_DEFAULTS.bottomShadowAlpha,
        backdropBlurPx:
          overlay.backdropBlurPx ?? NAVIGATOR_GUI_DEFAULTS.backdropBlurPx,
        backdropSaturation:
          overlay.backdropSaturation ??
          NAVIGATOR_GUI_DEFAULTS.backdropSaturation,
        radius: overlay.radius ?? NAVIGATOR_GUI_DEFAULTS.radius,
        fontWeight:
          overlay.bodyFontWeight ?? NAVIGATOR_GUI_DEFAULTS.fontWeight,
        fontItalic: overlay.bodyItalic ?? NAVIGATOR_GUI_DEFAULTS.fontItalic,
        arrowFillColor:
          navigator.arrowFillColor ??
          overlay.textColor ??
          NAVIGATOR_GUI_DEFAULTS.arrowFillColor,
        arrowOutlineColor:
          navigator.arrowOutlineColor ??
          navigator.arrowFillColor ??
          overlay.textColor ??
          NAVIGATOR_GUI_DEFAULTS.arrowOutlineColor,
      };
  const [open, setOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editorLogoCropOpen, setEditorLogoCropOpen] = useState(false);

  const setGui = (patch: NonNullable<SceneProperties["gui"]>) =>
    setEnvScene({ gui: { ...gui, ...patch } });
  const setOverlay = (
    patch: NonNullable<NonNullable<SceneProperties["gui"]>["overlay"]>,
  ) => {
    const nextOverlay: BoxOverlayStyle = { ...overlay, ...patch };
    const selectedStyleId =
      gui.activeOverlayStyleId ??
      (overlayStyles.length > 0 ? overlayStyles[0]?.id : firstOverlayStyle.id);
    const styles =
      overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
    const nextStyles = styles.map((style) =>
      style.id === selectedStyleId
        ? { ...style, overlay: nextOverlay }
        : style,
    );
    setGui({
      overlay: nextOverlay,
      overlayStyles: nextStyles,
      activeOverlayStyleId: selectedStyleId,
    });
  };
  const setLogo = (
    patch: NonNullable<NonNullable<SceneProperties["gui"]>["logo"]>,
  ) => setGui({ logo: { ...logo, ...patch } });
  const setEditor = (patch: EditorChromeSettings) =>
    setGui({ editor: { ...editor, ...patch } });
  const editorHeaderLogoSrc = editor.headerLogoPath
    ? editor.headerLogoPath.startsWith("/")
      ? editor.headerLogoPath
      : `/${editor.headerLogoPath}`
    : "";
  const editorLogoCropX = cameraFocusNumber(editor.headerLogoCropX, 0, 0, 0.95);
  const editorLogoCropY = cameraFocusNumber(editor.headerLogoCropY, 0, 0, 0.95);
  const editorLogoCropWidth = cameraFocusNumber(
    editor.headerLogoCropWidth,
    1,
    0.05,
    1,
  );
  const editorLogoCropHeight = cameraFocusNumber(
    editor.headerLogoCropHeight,
    1,
    0.05,
    1,
  );
  const editorLogoCropBox = {
    left: `${editorLogoCropX * 100}%`,
    top: `${editorLogoCropY * 100}%`,
    width: `${Math.min(1 - editorLogoCropX, editorLogoCropWidth) * 100}%`,
    height: `${Math.min(1 - editorLogoCropY, editorLogoCropHeight) * 100}%`,
  };
  const setLabels = (
    patch: NonNullable<NonNullable<SceneProperties["gui"]>["labels"]>,
  ) => {
    const nextLabels: GuiLabelSettings = { ...labels, ...patch };
    const selectedStyleId =
      gui.activeOverlayStyleId ??
      (overlayStyles.length > 0 ? overlayStyles[0]?.id : firstOverlayStyle.id);
    const styles =
      overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
    const nextStyles = styles.map((style) =>
      style.id === selectedStyleId
        ? { ...style, labels: nextLabels }
        : style,
    );
    setGui({
      labels: nextLabels,
      overlayStyles: nextStyles,
      activeOverlayStyleId: selectedStyleId,
    });
  };
  const setLabelVisualStyle = (
    kind: GuiLabelStyleKind,
    patch: GuiLabelVisualStyle,
  ) => {
    setLabels({
      styles: {
        ...(labels.styles ?? {}),
        [kind]: {
          ...(labels.styles?.[kind] ?? {}),
          ...patch,
        },
      },
    });
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${state.projectRoot}/brand/${safeName}`;
      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      await writeFile(path, base64, { encoding: "base64" });
      setLogo({
        path,
        visible: true,
        x: logo.x ?? 0.025,
        y: logo.y ?? 0.025,
        width: logo.width ?? 0.14,
        opacity: logo.opacity ?? 0.92,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onEditorLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${state.projectRoot}/brand/editor-${safeName}`;
      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      await writeFile(path, base64, { encoding: "base64" });
      setEditor({
        headerLogoPath: path,
        headerLogoVisible: true,
        headerLogoSizePx: editor.headerLogoSizePx ?? 24,
        headerLogoGapPx: editor.headerLogoGapPx ?? 10,
        headerLogoPaddingTopPx: editor.headerLogoPaddingTopPx ?? 0,
        headerLogoPaddingRightPx: editor.headerLogoPaddingRightPx ?? 0,
        headerLogoPaddingBottomPx: editor.headerLogoPaddingBottomPx ?? 0,
        headerLogoPaddingLeftPx: editor.headerLogoPaddingLeftPx ?? 0,
        headerLogoOpacity: editor.headerLogoOpacity ?? 0.92,
        headerLogoBackgroundTransparent:
          editor.headerLogoBackgroundTransparent ?? false,
        headerLogoBackgroundCutoff: editor.headerLogoBackgroundCutoff ?? 0.93,
        headerLogoEdgeSoftness: editor.headerLogoEdgeSoftness ?? 0.06,
        headerLogoForegroundWhite: editor.headerLogoForegroundWhite ?? true,
        headerLogoCropX: editor.headerLogoCropX ?? 0,
        headerLogoCropY: editor.headerLogoCropY ?? 0,
        headerLogoCropWidth: editor.headerLogoCropWidth ?? 1,
        headerLogoCropHeight: editor.headerLogoCropHeight ?? 1,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const applyOverlayStyle = (style: BoxOverlayStylePreset) => {
    const nextStyles =
      overlayStyles.length > 0 ? overlayStyles : [style];
    setGui({
      overlay: { ...style.overlay },
      navigator: style.navigator ? { ...style.navigator } : undefined,
      labels: style.labels ? { ...style.labels } : labels,
      overlayStyles: nextStyles,
      activeOverlayStyleId: style.id,
    });
  };

  const addOverlayStyle = () => {
    const baseStyles =
      overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
    const nextIndex = baseStyles.length + 1;
    const nextStyle: BoxOverlayStylePreset = {
      id: `overlay-style-${Date.now().toString(36)}`,
      label: `Style ${nextIndex}`,
      overlay: { ...overlay },
      navigator: { ...navigator },
      labels: { ...labels },
    };
    setGui({
      overlayStyles: [...baseStyles, nextStyle],
      activeOverlayStyleId: nextStyle.id,
    });
  };

  const copyOverlayStyle = () => {
    const baseStyles =
      overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
    const source =
      baseStyles.find((style) => style.id === activeOverlayStyleId) ??
      baseStyles[0] ??
      firstOverlayStyle;
    const nextIndex = baseStyles.length + 1;
    const nextStyle: BoxOverlayStylePreset = {
      id: `overlay-style-${Date.now().toString(36)}`,
      label: `Style ${nextIndex}`,
      overlay: { ...(source.overlay ?? overlay) },
      navigator: source.navigator
        ? { ...source.navigator }
        : { ...navigator },
      labels: source.labels ? { ...source.labels } : { ...labels },
    };
    setGui({
      overlay: { ...nextStyle.overlay },
      navigator: nextStyle.navigator,
      labels: nextStyle.labels,
      overlayStyles: [...baseStyles, nextStyle],
      activeOverlayStyleId: nextStyle.id,
    });
  };

  const removeOverlayStyle = () => {
    const baseStyles =
      overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
    if (baseStyles.length <= 1) return;
    const removeIndex = Math.max(
      0,
      baseStyles.findIndex((style) => style.id === activeOverlayStyleId),
    );
    const nextStyles = baseStyles.filter((_, index) => index !== removeIndex);
    const nextStyle =
      nextStyles[Math.min(removeIndex, nextStyles.length - 1)] ??
      nextStyles[0];
    setGui({
      overlay: { ...nextStyle.overlay },
      navigator: nextStyle.navigator ? { ...nextStyle.navigator } : undefined,
      labels: nextStyle.labels ? { ...nextStyle.labels } : labels,
      overlayStyles: nextStyles,
      activeOverlayStyleId: nextStyle.id,
    });
  };

  const setNavigator = (patch: NavigatorOverlayStyle) => {
    const nextNavigator: NavigatorOverlayStyle = { ...navigator, ...patch };
    const selectedStyleId =
      gui.activeOverlayStyleId ??
      (overlayStyles.length > 0 ? overlayStyles[0]?.id : firstOverlayStyle.id);
    const styles =
      overlayStyles.length > 0 ? overlayStyles : [firstOverlayStyle];
    const nextStyles = styles.map((style) =>
      style.id === selectedStyleId
        ? { ...style, navigator: nextNavigator }
        : style,
    );
    setGui({
      navigator: nextNavigator,
      overlayStyles: nextStyles,
      activeOverlayStyleId: selectedStyleId,
    });
  };

  const resetNavigatorToOverlay = () => {
    setNavigator({ useOverride: false });
  };

  return (
    <div
      style={environmentGroupStyle}
      onPointerDownCapture={onActivate}
      data-dev-source="src/editor/EnvironmentScenePanel.tsx:424"
      data-dev-container="true"
      data-dev-container-type="editor-tool-container"
      data-dev-container-name={title}
      data-dev-container-scope="EnvironmentScenePanel/GuiSetupPanel container"
      data-dev-note="GuiSetupPanel controls presenter overlay card aesthetics and client logo placement."
    >
      <button
        type="button"
        style={accentedEnvironmentHeadingStyle(
          environmentHeadingStyle,
          accentColor,
        )}
        data-dev-source="src/editor/EnvironmentScenePanel.tsx:430"
        data-dev-container="true"
        data-dev-container-type="nested-section-header"
        data-dev-container-name={title}
        data-dev-container-scope="environmentHeadingStyle"
        data-dev-padding-source="src/editor/EnvironmentScenePanel.tsx:438"
        data-dev-note="environmentHeadingStyle controls the GUI Setup heading pill."
        aria-expanded={open}
        onClick={() => {
          onActivate?.();
          setOpen((v) => !v);
        }}
      >
        <span
          style={environmentHeadingTextStyle}
          data-dev-text-source="src/editor/EnvironmentScenePanel.tsx:442"
        >
          {title}
        </span>
        <span style={environmentDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...environmentChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>

      {open && (
        <div
          style={environmentBodyStyle}
          data-dev-source="src/editor/EnvironmentScenePanel.tsx:460"
          data-dev-note="environmentBodyStyle controls indentation below GUI Setup."
        >
          {content === "editor" && (
            <>
              <Row label="Dev mode">
                <label style={panelStyles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={devModeEnabled}
                    onChange={(e) => onDevModeChange?.(e.target.checked)}
                  />
                </label>
              </Row>
              <div style={environmentHelpTextStyle}>
                Shows reusable container outlines and click-to-edit shared
                editor chrome variables. Shortcut: D.
              </div>

              <GuiDetail title="Header logo">
                <Row label="Visible">
                  <label style={panelStyles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={
                        editor.headerLogoVisible !== false &&
                        !!editor.headerLogoPath
                      }
                      disabled={!editor.headerLogoPath}
                      onChange={(e) =>
                        setEditor({ headerLogoVisible: e.target.checked })
                      }
                    />
                  </label>
                </Row>
                <Row label="Load logo">
                  <input
                    data-testid="editor-heading-logo-file"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={onEditorLogoFile}
                    style={{ fontSize: 11, minWidth: 0, flex: 1 }}
                  />
                </Row>
                {editor.headerLogoPath && (
                  <div style={{ ...panelStyles.muted, fontSize: 11 }}>
                    {editor.headerLogoPath.split("/").at(-1)}
                    <button
                      type="button"
                      style={{
                        ...overlayStyleButtonStyle,
                        marginLeft: 8,
                        padding: "2px 6px",
                      }}
                      onClick={() =>
                        setEditor({
                          headerLogoPath: "",
                          headerLogoVisible: false,
                        })
                      }
                    >
                      Clear
                    </button>
                  </div>
                )}
                {uploadError && (
                  <div
                    style={{
                      color: "rgba(255, 111, 127, 0.9)",
                      fontSize: 11,
                      marginBottom: 8,
                    }}
                  >
                    {uploadError}
                  </div>
                )}
                <Row label="Heading text">
                  <label style={panelStyles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={editor.headerTitleVisible !== false}
                      onChange={(e) =>
                        setEditor({ headerTitleVisible: e.target.checked })
                      }
                    />
                  </label>
                </Row>
                <Row label="Crop">
                  <button
                    type="button"
                    data-testid="editor-heading-logo-crop"
                    style={{
                      ...overlayStyleButtonStyle,
                      flex: 1,
                      justifyContent: "center",
                    }}
                    disabled={!editor.headerLogoPath}
                    onClick={() => setEditorLogoCropOpen((value) => !value)}
                  >
                    {editorLogoCropOpen ? "Close crop" : "Crop"}
                  </button>
                </Row>
                {editorLogoCropOpen && editorHeaderLogoSrc && (
                  <div style={logoCropPanelStyle}>
                    <div style={logoCropHeaderStyle}>
                      <span>Logo crop preview</span>
                      <button
                        type="button"
                        style={logoCropResetButtonStyle}
                        onClick={() =>
                          setEditor({
                            headerLogoCropX: 0,
                            headerLogoCropY: 0,
                            headerLogoCropWidth: 1,
                            headerLogoCropHeight: 1,
                          })
                        }
                      >
                        Reset
                      </button>
                    </div>
                    <div style={logoCropImageFrameStyle}>
                      <img
                        src={editorHeaderLogoSrc}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        style={logoCropPreviewImageStyle}
                      />
                      <div
                        style={{
                          ...logoCropBoxStyle,
                          ...editorLogoCropBox,
                        }}
                      >
                        <span style={cropMidlineHorizontalStyle} />
                        <span style={cropMidlineVerticalStyle} />
                      </div>
                    </div>
                    <Row label="Crop X">
                      <Range
                        value={editorLogoCropX}
                        min={0}
                        max={0.95}
                        step={0.01}
                        onChange={(v) =>
                          setEditor({
                            headerLogoCropX: v,
                            headerLogoCropWidth: Math.min(
                              editorLogoCropWidth,
                              1 - v,
                            ),
                          })
                        }
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Row>
                    <Row label="Crop Y">
                      <Range
                        value={editorLogoCropY}
                        min={0}
                        max={0.95}
                        step={0.01}
                        onChange={(v) =>
                          setEditor({
                            headerLogoCropY: v,
                            headerLogoCropHeight: Math.min(
                              editorLogoCropHeight,
                              1 - v,
                            ),
                          })
                        }
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Row>
                    <Row label="Crop W">
                      <Range
                        value={Math.min(1 - editorLogoCropX, editorLogoCropWidth)}
                        min={0.05}
                        max={Math.max(0.05, 1 - editorLogoCropX)}
                        step={0.01}
                        onChange={(v) => setEditor({ headerLogoCropWidth: v })}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Row>
                    <Row label="Crop H">
                      <Range
                        value={Math.min(1 - editorLogoCropY, editorLogoCropHeight)}
                        min={0.05}
                        max={Math.max(0.05, 1 - editorLogoCropY)}
                        step={0.01}
                        onChange={(v) => setEditor({ headerLogoCropHeight: v })}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Row>
                  </div>
                )}
                <Row label="Size">
                  <Range
                    value={editor.headerLogoSizePx ?? 24}
                    min={10}
                    max={160}
                    step={1}
                    onChange={(v) => setEditor({ headerLogoSizePx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Gap">
                  <Range
                    value={editor.headerLogoGapPx ?? 10}
                    min={0}
                    max={28}
                    step={1}
                    onChange={(v) => setEditor({ headerLogoGapPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Pad top">
                  <Range
                    value={editor.headerLogoPaddingTopPx ?? 0}
                    min={0}
                    max={80}
                    step={1}
                    onChange={(v) => setEditor({ headerLogoPaddingTopPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Pad right">
                  <Range
                    value={editor.headerLogoPaddingRightPx ?? 0}
                    min={0}
                    max={80}
                    step={1}
                    onChange={(v) => setEditor({ headerLogoPaddingRightPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Pad bottom">
                  <Range
                    value={editor.headerLogoPaddingBottomPx ?? 0}
                    min={0}
                    max={80}
                    step={1}
                    onChange={(v) => setEditor({ headerLogoPaddingBottomPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Pad left">
                  <Range
                    value={editor.headerLogoPaddingLeftPx ?? 0}
                    min={0}
                    max={80}
                    step={1}
                    onChange={(v) => setEditor({ headerLogoPaddingLeftPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Opacity">
                  <Range
                    value={editor.headerLogoOpacity ?? 0.92}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setEditor({ headerLogoOpacity: v })}
                  />
                </Row>
                <Row label="Transparent bg">
                  <label style={panelStyles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={editor.headerLogoBackgroundTransparent === true}
                      disabled={!editor.headerLogoPath}
                      onChange={(e) =>
                        setEditor({
                          headerLogoBackgroundTransparent: e.target.checked,
                        })
                      }
                    />
                  </label>
                </Row>
                <Row label="Text to white">
                  <label style={panelStyles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={editor.headerLogoForegroundWhite !== false}
                      disabled={!editor.headerLogoPath}
                      onChange={(e) =>
                        setEditor({ headerLogoForegroundWhite: e.target.checked })
                      }
                    />
                  </label>
                </Row>
                <Row label="BG cutoff">
                  <Range
                    value={editor.headerLogoBackgroundCutoff ?? 0.93}
                    min={0.75}
                    max={1}
                    step={0.01}
                    onChange={(v) =>
                      setEditor({ headerLogoBackgroundCutoff: v })
                    }
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Edge softness">
                  <Range
                    value={editor.headerLogoEdgeSoftness ?? 0.06}
                    min={0}
                    max={0.2}
                    step={0.01}
                    onChange={(v) =>
                      setEditor({ headerLogoEdgeSoftness: v })
                    }
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
              </GuiDetail>

              <GuiDetail title="Panel">
                <Row label="UI scale">
                  <Range
                    value={editor.uiScale ?? 0.75}
                    min={0.6}
                    max={1.25}
                    step={0.05}
                    onChange={(v) => setEditor({ uiScale: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Width">
                  <Range
                    value={editor.panelWidthPx ?? 512}
                    min={360}
                    max={760}
                    step={8}
                    onChange={(v) => setEditor({ panelWidthPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Margin">
                  <Range
                    value={editor.panelMarginPx ?? 44}
                    min={8}
                    max={120}
                    step={1}
                    onChange={(v) => setEditor({ panelMarginPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="X position">
                  <Range
                    value={editor.panelLeftPx ?? 44}
                    min={0}
                    max={1400}
                    step={1}
                    onChange={(v) => setEditor({ panelLeftPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Y position">
                  <Range
                    value={editor.panelTopPx ?? 44}
                    min={0}
                    max={900}
                    step={1}
                    onChange={(v) => setEditor({ panelTopPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Bottom safe">
                  <Range
                    value={editor.panelBottomSafePx ?? 112}
                    min={40}
                    max={260}
                    step={2}
                    onChange={(v) => setEditor({ panelBottomSafePx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Corners">
                  <Range
                    value={editor.panelCornerRadiusPx ?? 34}
                    min={6}
                    max={64}
                    step={1}
                    onChange={(v) => setEditor({ panelCornerRadiusPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
              </GuiDetail>

              <GuiDetail title="Header">
                <Row label="Height">
                  <Range
                    value={editor.headerHeightPx ?? 54}
                    min={36}
                    max={180}
                    step={1}
                    onChange={(v) => setEditor({ headerHeightPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Font size">
                  <Range
                    value={editor.headerFontSizePx ?? 18}
                    min={12}
                    max={24}
                    step={1}
                    onChange={(v) => setEditor({ headerFontSizePx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Gap">
                  <Range
                    value={editor.headerGapPx ?? 16}
                    min={0}
                    max={40}
                    step={1}
                    onChange={(v) => setEditor({ headerGapPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
              </GuiDetail>

              <GuiDetail title="Bars and lists">
                <Row label="Side inset">
                  <Range
                    value={editor.sectionMarginXPx ?? 12}
                    min={0}
                    max={40}
                    step={1}
                    onChange={(v) => setEditor({ sectionMarginXPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Row gap">
                  <Range
                    value={editor.sectionGapYPx ?? 10}
                    min={0}
                    max={32}
                    step={1}
                    onChange={(v) => setEditor({ sectionGapYPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Bottom gap">
                  <Range
                    value={editor.topBarBottomGapPx ?? 6}
                    min={0}
                    max={24}
                    step={1}
                    onChange={(v) => setEditor({ topBarBottomGapPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Inner gap">
                  <Range
                    value={editor.containerGapPx ?? 14}
                    min={0}
                    max={32}
                    step={1}
                    onChange={(v) => setEditor({ containerGapPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Body indent">
                  <Range
                    value={editor.containerBodyIndentPx ?? 28}
                    min={0}
                    max={72}
                    step={1}
                    onChange={(v) => setEditor({ containerBodyIndentPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Align">
                  <select
                    value={editor.containerAlignItems ?? "center"}
                    onChange={(e) =>
                      setEditor({
                        containerAlignItems: e.target.value as
                          | "flex-start"
                          | "center"
                          | "flex-end"
                          | "stretch"
                          | "baseline",
                      })
                    }
                    style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
                  >
                    <option value="flex-start">Top</option>
                    <option value="center">Center</option>
                    <option value="flex-end">Bottom</option>
                    <option value="stretch">Stretch</option>
                    <option value="baseline">Baseline</option>
                  </select>
                </Row>
                <Row label="Justify">
                  <select
                    value={editor.containerJustifyContent ?? "space-between"}
                    onChange={(e) =>
                      setEditor({
                        containerJustifyContent: e.target.value as
                          | "flex-start"
                          | "center"
                          | "flex-end"
                          | "space-between"
                          | "space-around"
                          | "space-evenly",
                      })
                    }
                    style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
                  >
                    <option value="flex-start">Start</option>
                    <option value="center">Center</option>
                    <option value="flex-end">End</option>
                    <option value="space-between">Between</option>
                    <option value="space-around">Around</option>
                    <option value="space-evenly">Evenly</option>
                  </select>
                </Row>
                <Row label="Bar radius">
                  <Range
                    value={editor.barRadiusPx ?? 999}
                    min={0}
                    max={999}
                    step={1}
                    onChange={(v) => setEditor({ barRadiusPx: v })}
                    format={(v) => (v >= 999 ? "pill" : `${v.toFixed(0)} px`)}
                  />
                </Row>
                <Row label="Top bar h.">
                  <Range
                    value={editor.topBarHeightPx ?? 44}
                    min={32}
                    max={72}
                    step={1}
                    onChange={(v) => setEditor({ topBarHeightPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Nested h.">
                  <Range
                    value={editor.nestedBarHeightPx ?? 42}
                    min={30}
                    max={68}
                    step={1}
                    onChange={(v) => setEditor({ nestedBarHeightPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Text inset">
                  <Range
                    value={editor.pillTextInsetPx ?? 24}
                    min={8}
                    max={40}
                    step={1}
                    onChange={(v) => setEditor({ pillTextInsetPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Page indent">
                  <Range
                    value={editor.pageListIndentPx ?? 18}
                    min={0}
                    max={48}
                    step={1}
                    onChange={(v) => setEditor({ pageListIndentPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Scroll end">
                  <Range
                    value={editor.scrollEndPaddingPx ?? 4}
                    min={0}
                    max={96}
                    step={1}
                    onChange={(v) => setEditor({ scrollEndPaddingPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Footer gap">
                  <Range
                    value={editor.saveFooterGapPx ?? 8}
                    min={0}
                    max={64}
                    step={1}
                    onChange={(v) => setEditor({ saveFooterGapPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Save icon">
                  <Range
                    value={editor.saveIconSizePx ?? 13}
                    min={8}
                    max={24}
                    step={1}
                    onChange={(v) => setEditor({ saveIconSizePx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
              </GuiDetail>

              <GuiDetail title="Sliders">
                <Row label="Track h.">
                  <Range
                    value={editor.sliderTrackHeightPx ?? 8}
                    min={3}
                    max={18}
                    step={1}
                    onChange={(v) => setEditor({ sliderTrackHeightPx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
                <Row label="Knob size">
                  <Range
                    value={editor.sliderThumbSizePx ?? 20}
                    min={8}
                    max={34}
                    step={1}
                    onChange={(v) => setEditor({ sliderThumbSizePx: v })}
                    format={(v) => `${v.toFixed(0)} px`}
                  />
                </Row>
              </GuiDetail>
            </>
          )}

          {content === "overlay" && (
            <>
              <div style={overlayStyleActionsStyle}>
                {overlayStyleButtons.map((style) => {
                  const selected = style.id === activeOverlayStyleId;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      style={{
                        ...overlayStyleButtonStyle,
                        ...(selected ? overlayStyleButtonActiveStyle : {}),
                      }}
                      onClick={() => applyOverlayStyle(style)}
                    >
                      {style.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  style={overlayStyleButtonStyle}
                  onClick={addOverlayStyle}
                >
                  Add style
                </button>
                <button
                  type="button"
                  style={overlayStyleButtonStyle}
                  onClick={copyOverlayStyle}
                >
                  Copy style
                </button>
                <button
                  type="button"
                  style={{
                    ...overlayStyleButtonStyle,
                    opacity: overlayStyleButtons.length > 1 ? 1 : 0.55,
                  }}
                  disabled={overlayStyleButtons.length <= 1}
                  onClick={removeOverlayStyle}
                >
                  Remove style
                </button>
              </div>
              <GuiSubsection title="Label styles">
            {LABEL_STYLE_GROUPS.map(({ key, title }) => {
              const style = {
                ...LABEL_STYLE_DEFAULTS[key],
                ...(labels.styles?.[key] ?? {}),
              };
              return (
                <GuiDetail key={key} title={title}>
                  <Row label="Text color">
                    <input
                      type="color"
                      value={style.textColor}
                      onChange={(e) =>
                        setLabelVisualStyle(key, { textColor: e.target.value })
                      }
                    />
                  </Row>
                  <Row label="Text opacity">
                    <Range
                      value={style.textOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) =>
                        setLabelVisualStyle(key, { textOpacity: v })
                      }
                    />
                  </Row>
                  <Row label="Outline">
                    <input
                      type="color"
                      value={style.outlineColor}
                      onChange={(e) =>
                        setLabelVisualStyle(key, {
                          outlineColor: e.target.value,
                        })
                      }
                    />
                  </Row>
                  <Row label="Outline alpha">
                    <Range
                      value={style.outlineOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) =>
                        setLabelVisualStyle(key, { outlineOpacity: v })
                      }
                    />
                  </Row>
                  <Row label="Fill color">
                    <input
                      type="color"
                      value={style.fillColor}
                      onChange={(e) =>
                        setLabelVisualStyle(key, { fillColor: e.target.value })
                      }
                    />
                  </Row>
                  <Row label="Fill alpha">
                    <Range
                      value={style.fillOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) =>
                        setLabelVisualStyle(key, { fillOpacity: v })
                      }
                    />
                  </Row>
                  <Row label="Show pointer">
                    <label style={panelStyles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={style.pointerVisible}
                        onChange={(e) =>
                          setLabelVisualStyle(key, {
                            pointerVisible: e.target.checked,
                          })
                        }
                      />
                    </label>
                  </Row>
                  <Row label="Pointer side">
                    <select
                      value={style.pointerSide}
                      onChange={(e) =>
                        setLabelVisualStyle(key, {
                          pointerSide: e.target.value as
                            | "auto"
                            | "left"
                            | "right",
                        })
                      }
                      style={{
                        ...panelStyles.textInput,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <option value="auto">Auto</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </Row>
                </GuiDetail>
              );
            })}
            <LabelInteractionControls labels={labels} setLabels={setLabels} />
          </GuiSubsection>
              <GuiSubsection title="Overlay box style">
                <GuiDetail title="Material">
                  <Row label="Fill color">
                  <input
                    type="color"
                    value={overlay.backgroundColor ?? "#f6f6f6"}
                    onChange={(e) =>
                      setOverlay({ backgroundColor: e.target.value })
                    }
                  />
                </Row>
            <Row label="Transparency">
              <Range
                value={overlay.backgroundAlpha ?? 0.72}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(v) => setOverlay({ backgroundAlpha: v })}
              />
            </Row>
            <Row label="Frost blur">
              <Range
                value={overlay.backdropBlurPx ?? 24}
                min={0}
                max={60}
                step={1}
                onChange={(v) => setOverlay({ backdropBlurPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Frost sat.">
              <Range
                value={overlay.backdropSaturation ?? 180}
                min={80}
                max={260}
                step={5}
                onChange={(v) => setOverlay({ backdropSaturation: v })}
                format={(v) => `${v.toFixed(0)}%`}
              />
            </Row>
                </GuiDetail>
                <GuiDetail title="Shadow">
            <Row label="Shadow">
              <Range
                value={overlay.shadowAlpha ?? 0.24}
                min={0}
                max={0.7}
                step={0.05}
                onChange={(v) => setOverlay({ shadowAlpha: v })}
              />
            </Row>
            <Row label="Shadow blur">
              <Range
                value={overlay.shadowBlur ?? 80}
                min={0}
                max={140}
                step={2}
                onChange={(v) => setOverlay({ shadowBlur: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Shadow Y">
              <Range
                value={overlay.shadowOffsetY ?? 24}
                min={0}
                max={80}
                step={1}
                onChange={(v) => setOverlay({ shadowOffsetY: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
                </GuiDetail>
                <GuiDetail title="Outline">
            <Row label="Outline">
              <input
                type="color"
                value={overlay.borderColor ?? "#ffffff"}
                onChange={(e) => setOverlay({ borderColor: e.target.value })}
              />
            </Row>
            <Row label="Outline alpha">
              <Range
                value={overlay.borderAlpha ?? 0.58}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setOverlay({ borderAlpha: v })}
              />
            </Row>
            <Row label="Outline px">
              <Range
                value={overlay.borderWidth ?? 1}
                min={0}
                max={4}
                step={0.5}
                onChange={(v) => setOverlay({ borderWidth: v })}
              />
            </Row>
                </GuiDetail>
                <GuiDetail title="Shape">
            <Row label="Top shine">
              <Range
                value={overlay.topHighlightAlpha ?? 0.7}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setOverlay({ topHighlightAlpha: v })}
              />
            </Row>
            <Row label="Bottom shade">
              <Range
                value={overlay.bottomShadowAlpha ?? 0.12}
                min={0}
                max={0.6}
                step={0.05}
                onChange={(v) => setOverlay({ bottomShadowAlpha: v })}
              />
            </Row>
            <Row label="Corners">
              <Range
                value={
                  overlay.bevelRatio === true
                    ? linkedOverlayRadius
                    : overlay.radius ?? 24
                }
                min={0}
                max={96}
                step={1}
                disabled={overlay.bevelRatio === true}
                onChange={(v) => setOverlay({ radius: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
                </GuiDetail>
          </GuiSubsection>

          <GuiSubsection title="Overlay box text">
            <GuiDetail title="Colors">
            <Row label="Heading color">
              <input
                type="color"
                value={overlay.textColor ?? "#222222"}
                onChange={(e) => setOverlay({ textColor: e.target.value })}
              />
            </Row>
            <Row label="Subtext color">
              <input
                type="color"
                value={overlay.secondaryTextColor ?? "#666666"}
                onChange={(e) =>
                  setOverlay({ secondaryTextColor: e.target.value })
                }
              />
            </Row>
            <Row label="Body color">
              <input
                type="color"
                value={overlay.bodyTextColor ?? overlay.textColor ?? "#222222"}
                onChange={(e) => setOverlay({ bodyTextColor: e.target.value })}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Layout">
            <Row label="Text padding">
              <Range
                value={overlay.textPadding ?? overlay.contentPadding ?? 32}
                min={12}
                max={56}
                step={1}
                onChange={(v) => setOverlay({ textPadding: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Heading">
            <Row label="Heading font">
              <FontSelect
                value={overlay.headingFontFamily ?? FONT_OPTIONS[0].value}
                onChange={(v) => setOverlay({ headingFontFamily: v })}
              />
            </Row>
            <Row label="Heading size">
              <Range
                value={overlay.headingFontSize ?? 22}
                min={12}
                max={54}
                step={1}
                onChange={(v) => setOverlay({ headingFontSize: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Heading weight">
              <Range
                value={overlay.headingFontWeight ?? 600}
                min={100}
                max={900}
                step={100}
                onChange={(v) => setOverlay({ headingFontWeight: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Heading italic">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={overlay.headingItalic === true}
                  onChange={(e) =>
                    setOverlay({ headingItalic: e.target.checked })
                  }
                />
              </label>
            </Row>
            </GuiDetail>
            <GuiDetail title="Subheading">
            <Row label="Subhead font">
              <FontSelect
                value={overlay.subheadingFontFamily ?? FONT_OPTIONS[0].value}
                onChange={(v) => setOverlay({ subheadingFontFamily: v })}
              />
            </Row>
            <Row label="Subhead size">
              <Range
                value={overlay.subheadingFontSize ?? 13}
                min={9}
                max={34}
                step={1}
                onChange={(v) => setOverlay({ subheadingFontSize: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Subhead weight">
              <Range
                value={overlay.subheadingFontWeight ?? 400}
                min={100}
                max={900}
                step={100}
                onChange={(v) => setOverlay({ subheadingFontWeight: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Subhead italic">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={overlay.subheadingItalic === true}
                  onChange={(e) =>
                    setOverlay({ subheadingItalic: e.target.checked })
                  }
                />
              </label>
            </Row>
            </GuiDetail>
            <GuiDetail title="Body">
            <Row label="Body font">
              <FontSelect
                value={overlay.bodyFontFamily ?? FONT_OPTIONS[0].value}
                onChange={(v) => setOverlay({ bodyFontFamily: v })}
              />
            </Row>
            <Row label="Body size">
              <Range
                value={overlay.bodyFontSize ?? 14}
                min={9}
                max={28}
                step={1}
                onChange={(v) => setOverlay({ bodyFontSize: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Body weight">
              <Range
                value={overlay.bodyFontWeight ?? 400}
                min={100}
                max={900}
                step={100}
                onChange={(v) => setOverlay({ bodyFontWeight: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Body italic">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={overlay.bodyItalic === true}
                  onChange={(e) =>
                    setOverlay({ bodyItalic: e.target.checked })
                  }
                />
              </label>
            </Row>
            </GuiDetail>
            <GuiDetail title="Figure labels">
            <Row label="Visible">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={overlay.figureLabelVisible !== false}
                  onChange={(e) =>
                    setOverlay({ figureLabelVisible: e.target.checked })
                  }
                />
              </label>
            </Row>
            <Row label="Prefix">
              <input
                type="text"
                value={overlay.figureLabelPrefix ?? "Fig."}
                onChange={(e) =>
                  setOverlay({ figureLabelPrefix: e.target.value })
                }
                style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
              />
            </Row>
            <Row label="Text color">
              <input
                type="color"
                value={
                  overlay.figureLabelColor ??
                  overlay.textColor ??
                  "#222222"
                }
                onChange={(e) =>
                  setOverlay({ figureLabelColor: e.target.value })
                }
              />
            </Row>
            <Row label="Font">
              <FontSelect
                value={overlay.figureLabelFontFamily ?? FONT_OPTIONS[0].value}
                onChange={(v) => setOverlay({ figureLabelFontFamily: v })}
              />
            </Row>
            <Row label="Size">
              <Range
                value={overlay.figureLabelFontSize ?? 11}
                min={8}
                max={22}
                step={1}
                onChange={(v) => setOverlay({ figureLabelFontSize: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Inset">
              <Range
                value={overlay.figureLabelInset ?? 10}
                min={0}
                max={28}
                step={1}
                onChange={(v) => setOverlay({ figureLabelInset: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Pad X">
              <Range
                value={overlay.figureLabelPaddingX ?? 8}
                min={0}
                max={24}
                step={1}
                onChange={(v) => setOverlay({ figureLabelPaddingX: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Pad Y">
              <Range
                value={overlay.figureLabelPaddingY ?? 4}
                min={0}
                max={16}
                step={1}
                onChange={(v) => setOverlay({ figureLabelPaddingY: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Backing">
              <input
                type="color"
                value={overlay.figureLabelBackgroundColor ?? "#000000"}
                onChange={(e) =>
                  setOverlay({ figureLabelBackgroundColor: e.target.value })
                }
              />
            </Row>
            <Row label="Backing alpha">
              <Range
                value={overlay.figureLabelBackgroundAlpha ?? 0}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) =>
                  setOverlay({ figureLabelBackgroundAlpha: v })
                }
              />
            </Row>
            <Row label="Corners">
              <Range
                value={overlay.figureLabelRadius ?? 999}
                min={0}
                max={999}
                step={1}
                onChange={(v) => setOverlay({ figureLabelRadius: v })}
                format={(v) => (v >= 999 ? "pill" : `${v.toFixed(0)} px`)}
              />
            </Row>
            </GuiDetail>
          </GuiSubsection>

          <GuiSubsection title="Navigator" style={{ order: 99 }}>
            <GuiDetail title="Setup">
            <Row label="Override">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={navigatorOverride}
                  onChange={(e) =>
                    setNavigator({ useOverride: e.target.checked })
                  }
                />
              </label>
            </Row>
            <Row label="Reset">
              <button
                type="button"
                style={{
                  ...overlayStyleButtonStyle,
                  opacity: navigatorOverride ? 1 : 0.55,
                }}
                disabled={!navigatorOverride}
                onClick={resetNavigatorToOverlay}
              >
                Reset to boxes
              </button>
            </Row>
            </GuiDetail>
            <GuiDetail title="Material">
            <Row label="Fill color">
              <input
                type="color"
                disabled={!navigatorOverride}
                value={
                  navigatorPreview.backgroundColor ??
                  NAVIGATOR_GUI_DEFAULTS.backgroundColor
                }
                onChange={(e) =>
                  setNavigator({
                    useOverride: true,
                    backgroundColor: e.target.value,
                  })
                }
              />
            </Row>
            <Row label="Transparency">
              <Range
                value={
                  navigatorPreview.backgroundAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.backgroundAlpha
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, backgroundAlpha: v })
                }
              />
            </Row>
            <Row label="Frost blur">
              <Range
                value={
                  navigatorPreview.backdropBlurPx ??
                  NAVIGATOR_GUI_DEFAULTS.backdropBlurPx
                }
                min={0}
                max={60}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, backdropBlurPx: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Frost sat.">
              <Range
                value={
                  navigatorPreview.backdropSaturation ??
                  NAVIGATOR_GUI_DEFAULTS.backdropSaturation
                }
                min={0}
                max={260}
                step={5}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, backdropSaturation: v })
                }
                format={(v) => `${v.toFixed(0)}%`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Frame">
            <Row label="Text color">
              <input
                type="color"
                disabled={!navigatorOverride}
                value={
                  navigatorPreview.textColor ??
                  NAVIGATOR_GUI_DEFAULTS.textColor
                }
                onChange={(e) =>
                  setNavigator({ useOverride: true, textColor: e.target.value })
                }
              />
            </Row>
            <Row label="Outline">
              <input
                type="color"
                disabled={!navigatorOverride}
                value={
                  navigatorPreview.borderColor ??
                  NAVIGATOR_GUI_DEFAULTS.borderColor
                }
                onChange={(e) =>
                  setNavigator({
                    useOverride: true,
                    borderColor: e.target.value,
                  })
                }
              />
            </Row>
            <Row label="Outline alpha">
              <Range
                value={
                  navigatorPreview.borderAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.borderAlpha
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, borderAlpha: v })
                }
              />
            </Row>
            <Row label="Outline px">
              <Range
                value={
                  navigatorPreview.borderWidth ??
                  NAVIGATOR_GUI_DEFAULTS.borderWidth
                }
                min={0}
                max={6}
                step={0.5}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, borderWidth: v })
                }
              />
            </Row>
            <Row label="Top shine">
              <Range
                value={
                  navigatorPreview.topHighlightAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.topHighlightAlpha
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, topHighlightAlpha: v })
                }
              />
            </Row>
            <Row label="Bottom shade">
              <Range
                value={
                  navigatorPreview.bottomShadowAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.bottomShadowAlpha
                }
                min={0}
                max={0.6}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, bottomShadowAlpha: v })
                }
              />
            </Row>
            <Row label="Divider alpha">
              <Range
                value={
                  navigatorPreview.dividerAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.dividerAlpha
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, dividerAlpha: v })
                }
              />
            </Row>
            <Row label="Corners">
              <Range
                value={
                  navigatorPreview.radius ?? NAVIGATOR_GUI_DEFAULTS.radius
                }
                min={0}
                max={999}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) => setNavigator({ useOverride: true, radius: v })}
                format={(v) => (v >= 999 ? "pill" : `${v.toFixed(0)} px`)}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Layout">
            <Row label="Bottom">
              <Range
                value={
                  navigatorPreview.bottom ?? NAVIGATOR_GUI_DEFAULTS.bottom
                }
                min={0}
                max={120}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) => setNavigator({ useOverride: true, bottom: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Outer pad">
              <Range
                value={
                  navigatorPreview.groupPadding ??
                  NAVIGATOR_GUI_DEFAULTS.groupPadding
                }
                min={0}
                max={24}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, groupPadding: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Gap">
              <Range
                value={navigatorPreview.gap ?? NAVIGATOR_GUI_DEFAULTS.gap}
                min={0}
                max={24}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) => setNavigator({ useOverride: true, gap: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Button X">
              <Range
                value={
                  navigatorPreview.buttonPaddingX ??
                  NAVIGATOR_GUI_DEFAULTS.buttonPaddingX
                }
                min={4}
                max={36}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, buttonPaddingX: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Button Y">
              <Range
                value={
                  navigatorPreview.buttonPaddingY ??
                  NAVIGATOR_GUI_DEFAULTS.buttonPaddingY
                }
                min={2}
                max={24}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, buttonPaddingY: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Arrows">
            <Row label="Size">
              <Range
                value={
                  navigatorPreview.arrowSize ??
                  NAVIGATOR_GUI_DEFAULTS.arrowSize
                }
                min={0}
                max={100}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowSize: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Bevel">
              <Range
                value={
                  navigatorPreview.arrowBevel ??
                  NAVIGATOR_GUI_DEFAULTS.arrowBevel
                }
                min={0}
                max={5}
                step={0.25}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowBevel: v })
                }
                format={(v) => `${v.toFixed(2)} px`}
              />
            </Row>
            <Row label="Fill">
              <input
                type="color"
                disabled={!navigatorOverride}
                value={
                  navigatorPreview.arrowFillColor ??
                  navigatorPreview.textColor ??
                  NAVIGATOR_GUI_DEFAULTS.arrowFillColor
                }
                onChange={(e) =>
                  setNavigator({
                    useOverride: true,
                    arrowFillColor: e.target.value,
                  })
                }
              />
            </Row>
            <Row label="Fill alpha">
              <Range
                value={
                  navigatorPreview.arrowFillAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.arrowFillAlpha
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowFillAlpha: v })
                }
              />
            </Row>
            <Row label="Outline">
              <input
                type="color"
                disabled={!navigatorOverride}
                value={
                  navigatorPreview.arrowOutlineColor ??
                  navigatorPreview.arrowFillColor ??
                  navigatorPreview.textColor ??
                  NAVIGATOR_GUI_DEFAULTS.arrowOutlineColor
                }
                onChange={(e) =>
                  setNavigator({
                    useOverride: true,
                    arrowOutlineColor: e.target.value,
                  })
                }
              />
            </Row>
            <Row label="Outline alpha">
              <Range
                value={
                  navigatorPreview.arrowOutlineAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.arrowOutlineAlpha
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowOutlineAlpha: v })
                }
              />
            </Row>
            <Row label="Outline px">
              <Range
                value={
                  navigatorPreview.arrowOutlineWidth ??
                  NAVIGATOR_GUI_DEFAULTS.arrowOutlineWidth
                }
                min={0}
                max={5}
                step={0.25}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowOutlineWidth: v })
                }
                format={(v) => `${v.toFixed(2)} px`}
              />
            </Row>
            <Row label="Pad X">
              <Range
                value={
                  navigatorPreview.arrowPaddingX ??
                  NAVIGATOR_GUI_DEFAULTS.arrowPaddingX
                }
                min={0}
                max={42}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowPaddingX: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Pad Y">
              <Range
                value={
                  navigatorPreview.arrowPaddingY ??
                  NAVIGATOR_GUI_DEFAULTS.arrowPaddingY
                }
                min={0}
                max={28}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, arrowPaddingY: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Text">
            <Row label="Font size">
              <Range
                value={
                  navigatorPreview.fontSize ??
                  NAVIGATOR_GUI_DEFAULTS.fontSize
                }
                min={9}
                max={22}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, fontSize: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Font weight">
              <Range
                value={
                  navigatorPreview.fontWeight ??
                  NAVIGATOR_GUI_DEFAULTS.fontWeight
                }
                min={100}
                max={900}
                step={50}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, fontWeight: v })
                }
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Italic">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  disabled={!navigatorOverride}
                  checked={
                    navigatorPreview.fontItalic ??
                    NAVIGATOR_GUI_DEFAULTS.fontItalic
                  }
                  onChange={(e) =>
                    setNavigator({
                      useOverride: true,
                      fontItalic: e.target.checked,
                    })
                  }
                />
              </label>
            </Row>
            </GuiDetail>
            <GuiDetail title="Shadow">
            <Row label="Shadow">
              <Range
                value={
                  navigatorPreview.shadowAlpha ??
                  NAVIGATOR_GUI_DEFAULTS.shadowAlpha
                }
                min={0}
                max={0.6}
                step={0.05}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, shadowAlpha: v })
                }
              />
            </Row>
            <Row label="Shadow blur">
              <Range
                value={
                  navigatorPreview.shadowBlur ??
                  NAVIGATOR_GUI_DEFAULTS.shadowBlur
                }
                min={0}
                max={90}
                step={1}
                disabled={!navigatorOverride}
                onChange={(v) =>
                  setNavigator({ useOverride: true, shadowBlur: v })
                }
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
          </GuiSubsection>
            </>
          )}
          {false && content === "overlay" && (
            <>
            <GuiDetail title="Motion">
            <Row label="Follow speed">
              <Range
                value={labels.followLerp ?? LABEL_GUI_DEFAULTS.followLerp}
                min={0}
                max={0.35}
                step={0.01}
                onChange={(v) => setLabels({ followLerp: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </Row>
            <Row label="Max stretch">
              <Range
                value={labels.maxSpringPx ?? LABEL_GUI_DEFAULTS.maxSpringPx}
                min={0}
                max={240}
                step={5}
                onChange={(v) => setLabels({ maxSpringPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Lift above">
              <Range
                value={labels.pinGapPx ?? LABEL_GUI_DEFAULTS.pinGapPx}
                min={0}
                max={90}
                step={1}
                onChange={(v) => setLabels({ pinGapPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Collision pad">
              <Range
                value={labels.collisionPadPx ?? LABEL_GUI_DEFAULTS.collisionPadPx}
                min={0}
                max={40}
                step={1}
                onChange={(v) => setLabels({ collisionPadPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Leader hide">
              <Range
                value={
                  labels.leaderVisibleThresholdPx ??
                  LABEL_GUI_DEFAULTS.leaderVisibleThresholdPx
                }
                min={0}
                max={32}
                step={1}
                onChange={(v) => setLabels({ leaderVisibleThresholdPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Visibility">
            <Row label="Fade near">
              <Range
                value={labels.fadeNearM ?? LABEL_GUI_DEFAULTS.fadeNearM}
                min={0}
                max={60000}
                step={500}
                onChange={(v) => setLabels({ fadeNearM: v })}
                format={(v) => `${(v / 1000).toFixed(1)} km`}
              />
            </Row>
            <Row label="Fade far">
              <Range
                value={labels.fadeFarM ?? LABEL_GUI_DEFAULTS.fadeFarM}
                min={1000}
                max={90000}
                step={500}
                onChange={(v) => setLabels({ fadeFarM: v })}
                format={(v) => `${(v / 1000).toFixed(1)} km`}
              />
            </Row>
            <Row label="Edge margin">
              <Range
                value={labels.frustumMargin ?? LABEL_GUI_DEFAULTS.frustumMargin}
                min={0.9}
                max={2}
                step={0.05}
                onChange={(v) => setLabels({ frustumMargin: v })}
              />
            </Row>
            <Row label="Max labels">
              <Range
                value={
                  labels.maxSiteLabelsDesktop ??
                  LABEL_GUI_DEFAULTS.maxSiteLabelsDesktop
                }
                min={0}
                max={80}
                step={1}
                onChange={(v) => setLabels({ maxSiteLabelsDesktop: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Max mobile">
              <Range
                value={
                  labels.maxSiteLabelsMobile ??
                  LABEL_GUI_DEFAULTS.maxSiteLabelsMobile
                }
                min={0}
                max={50}
                step={1}
                onChange={(v) => setLabels({ maxSiteLabelsMobile: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Near nudge">
            <Row label="Near nudge min">
              <Range
                value={labels.nearNudgeMinPx ?? LABEL_GUI_DEFAULTS.nearNudgeMinPx}
                min={0}
                max={180}
                step={2}
                onChange={(v) => setLabels({ nearNudgeMinPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Near nudge max">
              <Range
                value={labels.nearNudgeMaxPx ?? LABEL_GUI_DEFAULTS.nearNudgeMaxPx}
                min={0}
                max={260}
                step={2}
                onChange={(v) => setLabels({ nearNudgeMaxPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Near nudge scale">
              <Range
                value={labels.nearNudgeScale ?? LABEL_GUI_DEFAULTS.nearNudgeScale}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => setLabels({ nearNudgeScale: v })}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Far nudge">
            <Row label="Far nudge min">
              <Range
                value={labels.farNudgeMinPx ?? LABEL_GUI_DEFAULTS.farNudgeMinPx}
                min={0}
                max={280}
                step={2}
                onChange={(v) => setLabels({ farNudgeMinPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Far nudge max">
              <Range
                value={labels.farNudgeMaxPx ?? LABEL_GUI_DEFAULTS.farNudgeMaxPx}
                min={0}
                max={420}
                step={2}
                onChange={(v) => setLabels({ farNudgeMaxPx: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Far nudge scale">
              <Range
                value={labels.farNudgeScale ?? LABEL_GUI_DEFAULTS.farNudgeScale}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => setLabels({ farNudgeScale: v })}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Solver">
            <Row label="Overlap push">
              <Range
                value={labels.overlapPenalty ?? LABEL_GUI_DEFAULTS.overlapPenalty}
                min={0}
                max={80}
                step={1}
                onChange={(v) => setLabels({ overlapPenalty: v })}
              />
            </Row>
            <Row label="Crossing push">
              <Range
                value={labels.crossingPenalty ?? LABEL_GUI_DEFAULTS.crossingPenalty}
                min={0}
                max={12000}
                step={250}
                onChange={(v) => setLabels({ crossingPenalty: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Anchor pull">
              <Range
                value={
                  labels.distancePenaltyDivisor ??
                  LABEL_GUI_DEFAULTS.distancePenaltyDivisor
                }
                min={10}
                max={220}
                step={2}
                onChange={(v) => setLabels({ distancePenaltyDivisor: v })}
              />
            </Row>
            <Row label="Land pull">
              <Range
                value={
                  labels.landTitleDistancePenaltyDivisor ??
                  LABEL_GUI_DEFAULTS.landTitleDistancePenaltyDivisor
                }
                min={10}
                max={260}
                step={2}
                onChange={(v) =>
                  setLabels({ landTitleDistancePenaltyDivisor: v })
                }
              />
            </Row>
            <Row label="Motion stick">
              <Range
                value={
                  labels.movementPenaltyDivisor ??
                  LABEL_GUI_DEFAULTS.movementPenaltyDivisor
                }
                min={10}
                max={220}
                step={2}
                onChange={(v) => setLabels({ movementPenaltyDivisor: v })}
              />
            </Row>
            <Row label="Side stick">
              <Range
                value={labels.sideChangePenalty ?? LABEL_GUI_DEFAULTS.sideChangePenalty}
                min={0}
                max={1800}
                step={25}
                onChange={(v) => setLabels({ sideChangePenalty: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Penalties">
            <Row label="Near lane cost">
              <Range
                value={labels.topNudgePenalty ?? LABEL_GUI_DEFAULTS.topNudgePenalty}
                min={0}
                max={500}
                step={5}
                onChange={(v) => setLabels({ topNudgePenalty: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Far lane cost">
              <Range
                value={labels.farNudgePenalty ?? LABEL_GUI_DEFAULTS.farNudgePenalty}
                min={0}
                max={800}
                step={5}
                onChange={(v) => setLabels({ farNudgePenalty: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Below cost">
              <Range
                value={labels.bottomPenalty ?? LABEL_GUI_DEFAULTS.bottomPenalty}
                min={0}
                max={5000}
                step={50}
                onChange={(v) => setLabels({ bottomPenalty: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            <Row label="Below diagonal">
              <Range
                value={
                  labels.bottomDiagonalPenalty ??
                  LABEL_GUI_DEFAULTS.bottomDiagonalPenalty
                }
                min={0}
                max={6000}
                step={50}
                onChange={(v) => setLabels({ bottomDiagonalPenalty: v })}
                format={(v) => `${v.toFixed(0)}`}
              />
            </Row>
            </GuiDetail>
          </>
          )}

          {content === "overlay" && (
            <>
              <GuiSubsection title="Overlay images">
            <GuiDetail title="Layout">
            <Row label="Bevel ratio">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={overlay.bevelRatio === true}
                  onChange={(e) =>
                    setOverlay({ bevelRatio: e.target.checked })
                  }
                />
              </label>
            </Row>
            <Row label="Image padding">
              <Range
                value={overlay.imagePadding ?? 32}
                min={0}
                max={56}
                step={1}
                onChange={(v) => setOverlay({ imagePadding: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Corners">
              <Range
                value={overlay.imageRadius ?? 16}
                min={0}
                max={36}
                step={1}
                onChange={(v) => setOverlay({ imageRadius: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            <Row label="Spacing">
              <Range
                value={overlay.imageSpacing ?? 14}
                min={0}
                max={32}
                step={1}
                onChange={(v) => setOverlay({ imageSpacing: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Outline">
            <Row label="Outline">
              <input
                type="color"
                value={overlay.imageOutlineColor ?? "#ffffff"}
                onChange={(e) =>
                  setOverlay({ imageOutlineColor: e.target.value })
                }
              />
            </Row>
            <Row label="Outline alpha">
              <Range
                value={overlay.imageOutlineAlpha ?? 0}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setOverlay({ imageOutlineAlpha: v })}
              />
            </Row>
            <Row label="Outline px">
              <Range
                value={overlay.imageOutlineWidth ?? 0}
                min={0}
                max={6}
                step={0.5}
                onChange={(v) => setOverlay({ imageOutlineWidth: v })}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Shadow">
            <Row label="Shadow">
              <Range
                value={overlay.imageShadowAlpha ?? 0.18}
                min={0}
                max={0.7}
                step={0.05}
                onChange={(v) => setOverlay({ imageShadowAlpha: v })}
              />
            </Row>
            <Row label="Shadow blur">
              <Range
                value={overlay.imageShadowBlur ?? 24}
                min={0}
                max={64}
                step={1}
                onChange={(v) => setOverlay({ imageShadowBlur: v })}
                format={(v) => `${v.toFixed(0)} px`}
              />
            </Row>
            </GuiDetail>
          </GuiSubsection>
            </>
          )}

          {content === "logo" && (
            <>
              <GuiSubsection title="Client logo">
            <GuiDetail title="Source">
            <Row label="Visible">
              <label style={panelStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={logo.visible !== false && !!logo.path}
                  disabled={!logo.path}
                  onChange={(e) => setLogo({ visible: e.target.checked })}
                />
              </label>
            </Row>
            <Row label="Insert logo">
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={onLogoFile}
                style={{ fontSize: 11, minWidth: 0, flex: 1 }}
              />
            </Row>
            {logo.path && (
              <div style={{ ...panelStyles.muted, fontSize: 11 }}>
                {logo.path.split("/").at(-1)}
              </div>
            )}
            {uploadError && (
              <div
                style={{
                  color: "rgba(255, 111, 127, 0.9)",
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                {uploadError}
              </div>
            )}
            </GuiDetail>
            <GuiDetail title="Placement">
            <Row label="X position">
              <Range
                value={logo.x ?? 0.025}
                min={0}
                max={0.8}
                step={0.005}
                onChange={(v) => setLogo({ x: v })}
                format={(v) => `${(v * 100).toFixed(1)}%`}
              />
            </Row>
            <Row label="Y position">
              <Range
                value={logo.y ?? 0.025}
                min={0}
                max={0.8}
                step={0.005}
                onChange={(v) => setLogo({ y: v })}
                format={(v) => `${(v * 100).toFixed(1)}%`}
              />
            </Row>
            <Row label="Width">
              <Range
                value={logo.width ?? 0.14}
                min={0.04}
                max={0.4}
                step={0.005}
                onChange={(v) => setLogo({ width: v })}
                format={(v) => `${(v * 100).toFixed(1)}%`}
              />
            </Row>
            </GuiDetail>
            <GuiDetail title="Appearance">
            <Row label="Opacity">
              <Range
                value={logo.opacity ?? 0.92}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setLogo({ opacity: v })}
              />
            </Row>
            </GuiDetail>
          </GuiSubsection>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function accentedEnvironmentHeadingStyle(
  base: React.CSSProperties,
  accentColor?: string | null,
): React.CSSProperties {
  if (!accentColor) return base;
  return {
    ...base,
    background: accentColor,
    border: "1px solid transparent",
    boxShadow: "none",
  };
}

const environmentGroupStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingLeft: "var(--editor-page-list-indent, 18px)",
};

const environmentHeadingStyle: React.CSSProperties = {
  ...frostedSubheading,
  display: "flex",
  alignItems: "var(--editor-container-align, center)",
  justifyContent: "var(--editor-container-justify, space-between)",
  gap: "var(--editor-container-gap, 14px)",
  width: "100%",
  minHeight: "var(--editor-nested-bar-height, 42px)",
  padding: `0 var(--editor-pill-text-inset, ${EDITOR_PILL_TEXT_INSET_PX}px)`,
  cursor: "pointer",
  userSelect: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  appearance: "none",
};

const environmentHeadingTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  color: vibrancyLabel,
  minWidth: 0,
};

const environmentDisclosureStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};

const environmentChevronStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRight: "2px solid rgba(244, 240, 232, 0.82)",
  borderBottom: "2px solid rgba(244, 240, 232, 0.82)",
  transformOrigin: "center",
  transition: "transform 160ms ease",
};

const environmentBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "8px 0 8px var(--editor-container-body-indent, 28px)",
};

const overlayStyleActionsStyle: React.CSSProperties = {
  margin: "0 28px 14px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const overlayStyleButtonStyle: React.CSSProperties = {
  ...panelStyles.iconButton,
  width: 108,
  height: "auto",
  padding: "6px 10px",
  fontSize: 11,
  color: vibrancySecondaryLabel,
};

const overlayStyleButtonActiveStyle: React.CSSProperties = {
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.5)",
  borderColor: "rgba(244, 240, 232, 0.5)",
};

const environmentNestedBodyStyle: React.CSSProperties = {
  padding: "10px 0 0 18px",
};

const environmentHelpTextStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.35,
  color: vibrancyTertiaryLabel,
  maxWidth: 250,
  margin: "4px 32px 0 0",
};

const environmentPresetRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
  margin: "10px 28px 8px 0",
};

const environmentAddButtonStyle: React.CSSProperties = {
  ...panelStyles.primaryButton,
  minHeight: 30,
  borderRadius: 999,
  fontSize: 12,
  padding: "5px 8px",
};

const environmentLightSourceStyle: React.CSSProperties = {
  ...thinLightMaterial,
  border: "1px solid transparent",
  borderRadius: 14,
  margin: "8px 28px 8px 0",
  overflow: "hidden",
  boxShadow: "none",
};

const environmentLightSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minHeight: 32,
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 700,
  color: vibrancySecondaryLabel,
  cursor: "pointer",
};

const environmentLightBodyStyle: React.CSSProperties = {
  padding: "8px 10px 10px",
};

const environmentRemoveButtonStyle: React.CSSProperties = {
  ...panelStyles.iconButton,
  width: "auto",
  minWidth: 0,
  height: 22,
  padding: "0 8px",
  fontSize: 11,
  color: vibrancyTertiaryLabel,
};

const logoCropPanelStyle: React.CSSProperties = {
  ...thinLightMaterial,
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 14,
  padding: 10,
  margin: "8px 28px 10px 0",
};

const logoCropHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
  color: vibrancyLabel,
  fontSize: 12,
  fontWeight: 700,
};

const logoCropResetButtonStyle: React.CSSProperties = {
  ...panelStyles.iconButton,
  width: "auto",
  minWidth: 0,
  height: 22,
  padding: "0 8px",
  fontSize: 11,
};

const logoCropImageFrameStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 500,
  minHeight: 160,
  marginBottom: 10,
  overflow: "hidden",
  borderRadius: 10,
  border: "1px solid rgba(255, 255, 255, 0.16)",
  background:
    "linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.08) 75%), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.08) 75%)",
  backgroundColor: "rgba(0, 0, 0, 0.42)",
  backgroundPosition: "0 0, 12px 12px",
  backgroundSize: "24px 24px",
};

const logoCropPreviewImageStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  userSelect: "none",
};

const logoCropBoxStyle: React.CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  border: "2px solid rgba(255, 255, 255, 0.95)",
  boxShadow:
    "0 0 0 999px rgba(0, 0, 0, 0.44), 0 0 18px rgba(255, 255, 255, 0.32)",
  pointerEvents: "none",
};

const cropMidlineHorizontalStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "50%",
  height: 1,
  background: "rgba(0, 229, 255, 0.95)",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.35)",
  transform: "translateY(-50%)",
};

const cropMidlineVerticalStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "50%",
  width: 1,
  background: "rgba(255, 80, 210, 0.95)",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.35)",
  transform: "translateX(-50%)",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: vibrancyLabel,
  letterSpacing: 0,
  marginTop: 10,
  marginBottom: 8,
};

const dofSubheadingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: vibrancySecondaryLabel,
  letterSpacing: 0,
  marginTop: 10,
  marginBottom: 4,
};

const guiSubsectionStyle: React.CSSProperties = {
  margin: "8px 0 12px",
};

const guiSubsectionButtonStyle: React.CSSProperties = {
  ...frostedSubheading,
  display: "flex",
  alignItems: "var(--editor-container-align, center)",
  justifyContent: "var(--editor-container-justify, space-between)",
  gap: "var(--editor-container-gap, 12px)",
  width: "100%",
  minHeight: 38,
  padding: "0 14px",
  cursor: "pointer",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  appearance: "none",
};

const guiSubsectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: vibrancyLabel,
  lineHeight: 1.2,
};

const guiSubsectionBodyStyle: React.CSSProperties = {
  ...panelStyles.section,
  paddingTop: 10,
  paddingLeft: "calc(var(--editor-container-body-indent, 28px) / 2)",
  paddingRight: 2,
  marginBottom: 0,
};

const guiDetailStyle: React.CSSProperties = {
  marginTop: 4,
};

const guiDetailSummaryStyle: React.CSSProperties = {
  ...panelStyles.summary,
  fontWeight: 700,
  marginBottom: 6,
  color: vibrancyLabel,
};

const guiDetailBodyStyle: React.CSSProperties = {
  marginLeft: 0,
  paddingLeft: 0,
  paddingBottom: 6,
};
