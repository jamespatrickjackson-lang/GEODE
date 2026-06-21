import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { SceneHandle } from "./scene";
import { loadProject, type LoadedProject } from "./pages/loadPages";
import { HoverTooltip } from "./ui/HoverTooltip";
import { EditorProvider } from "./editor/EditorContext";
import { UtahForgeAddToProjectDrop } from "./editor/UtahForgeAddToProjectDrop";
import { installDevLayerDiagnostics } from "./scene/layerDiagnostics";
import {
  BASE_GUI_PROJECT,
  DEFAULT_PROJECT_SLUG,
  PROJECT_CATALOG,
  UTAH_FORGE_PROJECT,
  WOODJAM_PROJECT,
  type ProjectCatalogEntry,
} from "./projects/projectCatalogRuntime";
import { debugLog } from "./utils/debugLog";
import { SHAHBAZI_VIEWER_BACKGROUND } from "./projectModules/shahbazi/ui";
import "./App.css";

type LoadState = "landing" | "loading" | "loaded";

interface LandingImageSettings {
  effectsEnabled: boolean;
  opacity: number;
  frostBlurPx: number;
  saturation: number;
  brightness: number;
  contrast: number;
  darkness: number;
  vignette: number;
  grayscale: number;
  sepia: number;
  hueDeg: number;
  scale: number;
  positionX: number;
  positionY: number;
}

interface SavedLandingImage {
  imageUrl: string | null;
  imageName: string | null;
  settings: LandingImageSettings;
}

const EditorChrome = lazy(() =>
  import("./editor/EditorChrome").then((module) => ({
    default: module.EditorChrome,
  })),
);

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadRequestRef = useRef(0);
  const initialProjectOpenedRef = useRef(false);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("landing");
  const [sceneHandle, setSceneHandle] = useState<SceneHandle | null>(null);

  const openProject = useCallback((projectSlug: string = DEFAULT_PROJECT_SLUG) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoadError(null);
    setProject(null);
    setSceneHandle(null);
    setLoadState("loading");
    loadProject(projectSlug)
      .then((loadedProject) => {
        if (loadRequestRef.current !== requestId) return;
        setProject(loadedProject);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (loadRequestRef.current !== requestId) return;
        const message =
          error instanceof Error ? error.message : "Unknown project load error";
        console.error("[App] project load failed:", error);
        setLoadError(message);
        setLoadState("landing");
      });
  }, []);

  const returnToLanding = useCallback(() => {
    loadRequestRef.current += 1;
    setLoadError(null);
    setProject(null);
    setSceneHandle(null);
    setLoadState("landing");
  }, []);

  useEffect(() => {
    if (initialProjectOpenedRef.current) return;
    initialProjectOpenedRef.current = true;
    const slug = new URLSearchParams(window.location.search).get("project");
    if (slug) openProject(slug);
  }, [openProject]);

  useEffect(() => {
    if (!containerRef.current || !project) return;
    let disposed = false;
    let mountedHandle: SceneHandle | null = null;
    // Diagnostic: confirm what we're about to hand to the scene.
    const overlays = project.environment.sceneOverlays ?? {};
    debugLog(
      "[App] handing scene overlays to mountScene:",
      Object.keys(overlays),
      overlays,
    );
    import("./scene")
      .then(({ mountScene }) => {
        if (disposed || !containerRef.current) return;
        let handle: SceneHandle;
        try {
          handle = mountScene(
            containerRef.current,
            project.manifest.layers,
            overlays,
          );
        } catch (error) {
          console.error("[App] scene mount failed:", error);
          const message =
            error instanceof Error ? error.message : "Unknown scene mount error";
          setLoadError(message);
          setProject(null);
          setLoadState("landing");
          return;
        }
        if (disposed) {
          handle.dispose();
          return;
        }
        mountedHandle = handle;
        setSceneHandle(handle);
      })
      .catch((error) => {
        console.error("[App] scene mount failed:", error);
        const message =
          error instanceof Error ? error.message : "Unknown scene import error";
        setLoadError(message);
        setProject(null);
        setLoadState("landing");
      });
    return () => {
      disposed = true;
      mountedHandle?.dispose();
      setSceneHandle(null);
    };
  }, [project]);

  useEffect(() => {
    if (!sceneHandle || !project || !import.meta.env.DEV) return;
    return installDevLayerDiagnostics(sceneHandle, {
      projectSlug: project.projectSlug,
      projectName: project.manifest.name,
    });
  }, [project, sceneHandle]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {loadState === "landing" && !project && (
        <ProjectLanding
          error={loadError}
          onOpenProject={openProject}
          onOpenDevelopment={() => openProject(WOODJAM_PROJECT.slug)}
          onOpenBaseGui={() => openProject(BASE_GUI_PROJECT.slug)}
        />
      )}
      {loadState === "loading" && !project && (
        <div style={statusStyle}>
          Loading project...
        </div>
      )}
      {loadState === "loaded" && project && !sceneHandle && (
        <div style={statusStyle}>
          Preparing editor...
        </div>
      )}
      <HoverTooltip />
      {sceneHandle && project && (
        <EditorProvider
          projectSlug={project.projectSlug}
          projectRoot={project.projectRoot}
          manifest={project.manifest}
          environment={project.environment}
          pages={project.pages}
          archivedPages={project.archivedPages}
          sceneHandle={sceneHandle}
        >
          <Suspense fallback={<div style={statusStyle}>Loading editor...</div>}>
            <EditorChrome
              sceneHandle={sceneHandle}
              onReturnHome={returnToLanding}
            />
          </Suspense>
        </EditorProvider>
      )}
    </div>
  );
}

function ProjectLanding({
  error,
  onOpenProject,
  onOpenDevelopment,
  onOpenBaseGui,
}: {
  error: string | null;
  onOpenProject: (projectSlug: string) => void;
  onOpenDevelopment: () => void;
  onOpenBaseGui: () => void;
}) {
  const openBaseGui = onOpenBaseGui ?? onOpenDevelopment;
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [landingImageUrl, setLandingImageUrl] = useState<string | null>(null);
  const [landingImageName, setLandingImageName] = useState<string | null>(null);
  const [landingImageSettings, setLandingImageSettings] =
    useState<LandingImageSettings>(DEFAULT_LANDING_IMAGE_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [utahForgeIntakeOpen, setUtahForgeIntakeOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LANDING_IMAGE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SavedLandingImage>;
      if (typeof saved.imageUrl === "string") setLandingImageUrl(saved.imageUrl);
      if (typeof saved.imageName === "string") setLandingImageName(saved.imageName);
      setLandingImageSettings({
        ...DEFAULT_LANDING_IMAGE_SETTINGS,
        ...(saved.settings ?? {}),
      });
    } catch (error) {
      console.warn("[App] failed to load saved landing image profile:", error);
    }
  }, []);

  const loadLandingImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      setLandingImageUrl(reader.result);
      setLandingImageName(file.name);
      setSaveStatus("Unsaved");
    });
    reader.readAsDataURL(file);
  };

  const clearLandingImage = () => {
    setLandingImageUrl(null);
    setLandingImageName(null);
    setSaveStatus(null);
    window.localStorage.removeItem(LANDING_IMAGE_STORAGE_KEY);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const updateLandingImageSetting = (
    key: keyof LandingImageSettings,
    value: number | boolean,
  ) => {
    setLandingImageSettings((settings) => ({ ...settings, [key]: value }));
    setSaveStatus("Unsaved");
  };

  const resetLandingImageSettings = () => {
    setLandingImageSettings(DEFAULT_LANDING_IMAGE_SETTINGS);
    setSaveStatus("Unsaved");
  };

  const saveLandingImageProfile = () => {
    const payload: SavedLandingImage = {
      imageUrl: landingImageUrl,
      imageName: landingImageName,
      settings: landingImageSettings,
    };
    try {
      window.localStorage.setItem(
        LANDING_IMAGE_STORAGE_KEY,
        JSON.stringify(payload),
      );
      setSaveStatus("Saved");
    } catch (error) {
      console.error("[App] failed to save landing image profile:", error);
      setSaveStatus("Save failed");
    }
  };

  return (
    <div style={landingRootStyle}>
      {landingImageUrl && (
        <div
          aria-hidden="true"
          style={landingImageBackdropStyle(
            landingImageUrl,
            landingImageSettings,
          )}
        />
      )}
      {landingImageUrl && landingImageSettings.effectsEnabled && (
        <div
          aria-hidden="true"
          style={landingImageEffectStyle(landingImageSettings)}
        />
      )}
      <main style={landingShellStyle} aria-labelledby="project-landing-title">
        <div style={landingHeaderStyle}>
          <p style={landingEyebrowStyle}>GeoSee Projects</p>
          <h1 id="project-landing-title" style={landingTitleStyle}>
            Open a project
          </h1>
        </div>

        {error && (
          <div role="alert" style={landingErrorStyle}>
            Failed to load project: {error}
          </div>
        )}

        <section style={projectListStyle} aria-label="Available projects">
          {PROJECT_CATALOG.map((project) => (
            <ProjectOption
              key={project.slug}
              project={project}
              onOpen={() => onOpenProject(project.slug)}
              onAddToProject={
                project.slug === UTAH_FORGE_PROJECT.slug
                  ? () => setUtahForgeIntakeOpen(true)
                  : undefined
              }
            />
          ))}
          <ProjectActionOption label="Add New Project" onOpen={openBaseGui} />
        </section>

        <div style={developmentRowStyle}>
          <button
            className="geosee-landing-button geosee-landing-button--secondary"
            style={secondaryButtonStyle}
            onClick={openBaseGui}
          >
            EDIT BASE GUI
          </button>
        </div>
      </main>
      {settingsOpen && (
        <div style={landingImagePanelStyle}>
          <div style={landingImagePanelTitleStyle}>Landing Image</div>
          <button
            className="geosee-landing-button geosee-landing-button--secondary"
            style={landingImageLoadButtonStyle}
            onClick={() => imageInputRef.current?.click()}
          >
            LOAD IMAGE
          </button>
          {landingImageName && (
            <div style={landingImageNameStyle}>{landingImageName}</div>
          )}
          <div style={landingImageActionsStyle}>
            <button
              className="geosee-landing-button geosee-landing-button--secondary"
              style={landingImageSmallButtonStyle}
              onClick={saveLandingImageProfile}
            >
              SAVE
            </button>
            <button
              className="geosee-landing-button geosee-landing-button--secondary"
              style={landingImageSmallButtonStyle}
              onClick={resetLandingImageSettings}
            >
              RESET FX
            </button>
          </div>
          <label style={landingToggleRowStyle}>
            <input
              type="checkbox"
              checked={landingImageSettings.effectsEnabled}
              onChange={(event) =>
                updateLandingImageSetting(
                  "effectsEnabled",
                  event.currentTarget.checked,
                )
              }
            />
            <span>Effect overlay</span>
          </label>
          <LandingImageSlider
            label="Opacity"
            value={landingImageSettings.opacity}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => updateLandingImageSetting("opacity", value)}
          />
          <LandingImageSlider
            label="Frost blur"
            value={landingImageSettings.frostBlurPx}
            min={0}
            max={24}
            unit="px"
            onChange={(value) =>
              updateLandingImageSetting("frostBlurPx", value)
            }
          />
          <LandingImageSlider
            label="Saturation"
            value={landingImageSettings.saturation}
            min={0}
            max={220}
            unit="%"
            onChange={(value) =>
              updateLandingImageSetting("saturation", value)
            }
          />
          <LandingImageSlider
            label="Brightness"
            value={landingImageSettings.brightness}
            min={20}
            max={180}
            unit="%"
            onChange={(value) =>
              updateLandingImageSetting("brightness", value)
            }
          />
          <LandingImageSlider
            label="Contrast"
            value={landingImageSettings.contrast}
            min={40}
            max={220}
            unit="%"
            onChange={(value) => updateLandingImageSetting("contrast", value)}
          />
          <LandingImageSlider
            label="Darkness"
            value={landingImageSettings.darkness}
            min={0}
            max={90}
            unit="%"
            onChange={(value) => updateLandingImageSetting("darkness", value)}
          />
          <LandingImageSlider
            label="Vignette"
            value={landingImageSettings.vignette}
            min={0}
            max={95}
            unit="%"
            onChange={(value) => updateLandingImageSetting("vignette", value)}
          />
          <LandingImageSlider
            label="Grayscale"
            value={landingImageSettings.grayscale}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => updateLandingImageSetting("grayscale", value)}
          />
          <LandingImageSlider
            label="Sepia"
            value={landingImageSettings.sepia}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => updateLandingImageSetting("sepia", value)}
          />
          <LandingImageSlider
            label="Hue"
            value={landingImageSettings.hueDeg}
            min={-180}
            max={180}
            unit="deg"
            onChange={(value) => updateLandingImageSetting("hueDeg", value)}
          />
          <LandingImageSlider
            label="Scale"
            value={landingImageSettings.scale}
            min={100}
            max={150}
            unit="%"
            onChange={(value) => updateLandingImageSetting("scale", value)}
          />
          <LandingImageSlider
            label="X"
            value={landingImageSettings.positionX}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => updateLandingImageSetting("positionX", value)}
          />
          <LandingImageSlider
            label="Y"
            value={landingImageSettings.positionY}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => updateLandingImageSetting("positionY", value)}
          />
          {saveStatus && <div style={landingImageNameStyle}>{saveStatus}</div>}
          {landingImageUrl && (
            <button
              className="geosee-landing-button geosee-landing-button--secondary"
              style={landingImageClearButtonStyle}
              onClick={clearLandingImage}
            >
              CLEAR
            </button>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) =>
              loadLandingImage(event.currentTarget.files?.[0] ?? null)
            }
          />
        </div>
      )}
      <button
        className="geosee-landing-round-button"
        style={landingGearButtonStyle}
        onClick={() => setSettingsOpen((open) => !open)}
        title="Landing image settings"
        aria-label="Landing image settings"
      >
        <GearIcon />
      </button>
      <UtahForgeAddToProjectDrop
        open={utahForgeIntakeOpen}
        projectRoot={UTAH_FORGE_PROJECT.root}
        entrypoint="home-project-list"
        onClose={() => setUtahForgeIntakeOpen(false)}
      />
    </div>
  );
}

function LandingImageSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label style={landingSliderRowStyle}>
      <span style={landingSliderLabelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={landingSliderInputStyle}
      />
      <span style={landingSliderValueStyle}>
        {value}
        {unit}
      </span>
    </label>
  );
}

function ProjectOption({
  project,
  onOpen,
  onAddToProject,
}: {
  project: ProjectCatalogEntry;
  onOpen: () => void;
  onAddToProject?: () => void;
}) {
  const hasAddToProject = Boolean(onAddToProject);
  return (
    <div style={projectOptionWrapStyle}>
      <button
        className="geosee-landing-button geosee-landing-button--project"
        style={
          hasAddToProject ? projectOptionWithIntakeStyle : projectOptionStyle
        }
        onClick={onOpen}
      >
        <ProjectMapIcon />
        <div style={projectOptionTextStyle}>
          <h2 style={projectNameStyle}>{project.name}</h2>
        </div>
      </button>
      {hasAddToProject && (
        <button
          type="button"
          className="geosee-landing-button geosee-landing-button--secondary"
          style={projectIntakeButtonStyle}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onAddToProject?.();
          }}
          title="Stage small local files under Utah FORGE intake_staging"
        >
          Add to Project
        </button>
      )}
    </div>
  );
}

function ProjectActionOption({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      className="geosee-landing-button geosee-landing-button--project"
      style={projectOptionStyle}
      onClick={onOpen}
    >
      <AddProjectIcon />
      <div style={projectOptionTextStyle}>
        <h2 style={projectNameStyle}>{label}</h2>
      </div>
    </button>
  );
}

function ProjectMapIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={landingIconStyle}
    >
      <path
        d="M3.5 6.4 8.7 4l6.6 2.4 5.2-2.1v13.3l-5.2 2.1-6.6-2.4-5.2 2.3V6.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 4v13.3M15.3 6.4v13.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AddProjectIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={landingIconStyle}
    >
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9.8 3.8h4.4l.6 2.3c.6.2 1.1.5 1.6.9l2.3-.7 2.2 3.8-1.7 1.7v1.8l1.7 1.7-2.2 3.8-2.3-.7c-.5.4-1 .7-1.6.9l-.6 2.3H9.8l-.6-2.3c-.6-.2-1.1-.5-1.6-.9l-2.3.7-2.2-3.8 1.7-1.7v-1.8L3.1 10l2.2-3.8 2.3.7c.5-.4 1-.7 1.6-.9l.6-2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const TECHNICAL_MONO_FONT =
  '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
const LANDING_OVERLAY_TEXT = "#f4f0e8";
// Fine SVG noise (~5% alpha) layered over the dark landing gradients to dither
// out 8-bit banding — without it the near-black radial gradients show concentric
// "cheap vignette" band arcs. Tiles seamlessly (stitched fractal noise).
const LANDING_GRADIENT_DITHER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' " +
  "width='160' height='160'%3E%3Cfilter id='gd'%3E%3CfeTurbulence " +
  "type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E" +
  "%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 0.05'/%3E" +
  "%3C/filter%3E%3Crect width='160' height='160' filter='url(%23gd)'/%3E%3C/svg%3E\")";
const LANDING_IMAGE_STORAGE_KEY = "geosee.landingImageProfile.v1";

const DEFAULT_LANDING_IMAGE_SETTINGS: LandingImageSettings = {
  effectsEnabled: true,
  opacity: 100,
  frostBlurPx: 0,
  saturation: 100,
  brightness: 100,
  contrast: 100,
  darkness: 42,
  vignette: 60,
  grayscale: 0,
  sepia: 0,
  hueDeg: 0,
  scale: 100,
  positionX: 50,
  positionY: 50,
};

function landingImageBackdropStyle(
  imageUrl: string,
  settings: LandingImageSettings,
): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    backgroundImage: `url("${imageUrl}")`,
    backgroundSize: `${settings.scale}%`,
    backgroundPosition: `${settings.positionX}% ${settings.positionY}%`,
    backgroundRepeat: "no-repeat",
    opacity: settings.opacity / 100,
    filter: [
      `blur(${settings.frostBlurPx}px)`,
      `saturate(${settings.saturation}%)`,
      `brightness(${settings.brightness}%)`,
      `contrast(${settings.contrast}%)`,
      `grayscale(${settings.grayscale}%)`,
      `sepia(${settings.sepia}%)`,
      `hue-rotate(${settings.hueDeg}deg)`,
    ].join(" "),
    transform:
      settings.frostBlurPx > 0
        ? `scale(${1 + settings.frostBlurPx / 320})`
        : undefined,
  };
}

function landingImageEffectStyle(
  settings: LandingImageSettings,
): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background: [
      LANDING_GRADIENT_DITHER,
      `linear-gradient(rgba(0, 0, 0, ${settings.darkness / 100}), rgba(0, 0, 0, ${settings.darkness / 100}))`,
      `radial-gradient(circle at 55% 58%, rgba(255, 255, 255, 0) 0%, rgba(0, 0, 0, ${settings.vignette / 100}) 100%)`,
    ].join(", "),
  };
}

const statusStyle = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  color: LANDING_OVERLAY_TEXT,
  background: SHAHBAZI_VIEWER_BACKGROUND,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 14,
} satisfies React.CSSProperties;

const landingRootStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 100,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  padding: 24,
  color: LANDING_OVERLAY_TEXT,
  background: [
    LANDING_GRADIENT_DITHER,
    "radial-gradient(circle at 55% 58%, rgba(46, 48, 47, 0.95) 0%, rgba(31, 32, 31, 0.98) 46%, #151819 100%)",
  ].join(", "),
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} satisfies React.CSSProperties;

const landingShellStyle = {
  position: "relative",
  zIndex: 1,
  width: "min(720px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: 0,
  color: LANDING_OVERLAY_TEXT,
} satisfies React.CSSProperties;

const landingHeaderStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
  padding: "0 0 2px",
} satisfies React.CSSProperties;

const landingEyebrowStyle = {
  margin: 0,
  color: LANDING_OVERLAY_TEXT,
  fontSize: 13,
  lineHeight: 1,
  fontWeight: 700,
  textTransform: "uppercase",
} satisfies React.CSSProperties;

const landingTitleStyle = {
  margin: 0,
  color: LANDING_OVERLAY_TEXT,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 720,
} satisfies React.CSSProperties;

const landingErrorStyle = {
  padding: "11px 14px",
  color: "#5d1520",
  background: "rgba(180, 45, 67, 0.08)",
  border: "1px solid rgba(180, 45, 67, 0.24)",
  borderRadius: 8,
  fontSize: 13,
} satisfies React.CSSProperties;

const projectListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 13,
} satisfies React.CSSProperties;

const projectOptionWrapStyle = {
  position: "relative",
  width: "100%",
} satisfies React.CSSProperties;

const projectOptionStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 14,
  width: "100%",
  minHeight: 58,
  padding: "17px 20px 15px",
  color: LANDING_OVERLAY_TEXT,
  textAlign: "left",
  fontFamily: TECHNICAL_MONO_FONT,
} satisfies React.CSSProperties;

const projectOptionWithIntakeStyle = {
  ...projectOptionStyle,
  paddingRight: 184,
} satisfies React.CSSProperties;

const projectIntakeButtonStyle = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  minHeight: 30,
  minWidth: 136,
  padding: "8px 11px 7px",
  color: LANDING_OVERLAY_TEXT,
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1,
  fontFamily: TECHNICAL_MONO_FONT,
  textAlign: "center",
  textTransform: "none",
  zIndex: 2,
} satisfies React.CSSProperties;

const landingIconStyle = {
  flex: "none",
  color: LANDING_OVERLAY_TEXT,
  opacity: 0.96,
} satisfies React.CSSProperties;

const projectOptionTextStyle = {
  minWidth: 0,
} satisfies React.CSSProperties;

const projectNameStyle = {
  margin: 0,
  color: LANDING_OVERLAY_TEXT,
  fontSize: 18,
  lineHeight: 1.15,
  fontFamily: TECHNICAL_MONO_FONT,
  fontWeight: 700,
} satisfies React.CSSProperties;

const developmentRowStyle = {
  display: "flex",
  justifyContent: "flex-start",
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  minHeight: 34,
  minWidth: 320,
  padding: "9px 14px 8px",
  color: LANDING_OVERLAY_TEXT,
  fontSize: 13,
  lineHeight: 1,
  fontFamily: TECHNICAL_MONO_FONT,
} satisfies React.CSSProperties;

const landingGearButtonStyle = {
  position: "absolute",
  right: 34,
  bottom: 34,
  zIndex: 110,
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  color: LANDING_OVERLAY_TEXT,
} satisfies React.CSSProperties;

const landingImagePanelStyle = {
  position: "absolute",
  right: 34,
  bottom: 82,
  zIndex: 109,
  width: 306,
  maxHeight: "calc(100vh - 132px)",
  boxSizing: "border-box",
  padding: 14,
  overflowY: "auto",
  color: LANDING_OVERLAY_TEXT,
  background: "rgba(18, 21, 24, 0.55)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 12,
  boxShadow:
    "0 24px 80px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(0, 0, 0, 0.12)",
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
  fontFamily: TECHNICAL_MONO_FONT,
} satisfies React.CSSProperties;

const landingImagePanelTitleStyle = {
  marginBottom: 10,
  color: LANDING_OVERLAY_TEXT,
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 700,
  textTransform: "uppercase",
} satisfies React.CSSProperties;

const landingImageActionsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 10,
} satisfies React.CSSProperties;

const landingImageLoadButtonStyle = {
  width: "100%",
  minHeight: 34,
  padding: "9px 14px 8px",
  color: LANDING_OVERLAY_TEXT,
  fontSize: 12,
  lineHeight: 1,
  fontFamily: TECHNICAL_MONO_FONT,
} satisfies React.CSSProperties;

const landingImageSmallButtonStyle = {
  width: "100%",
  minHeight: 30,
  padding: "8px 10px 7px",
  color: LANDING_OVERLAY_TEXT,
  fontSize: 11,
  lineHeight: 1,
  fontFamily: TECHNICAL_MONO_FONT,
} satisfies React.CSSProperties;

const landingImageClearButtonStyle = {
  width: "100%",
  minHeight: 30,
  marginTop: 10,
  padding: "8px 12px 7px",
  color: LANDING_OVERLAY_TEXT,
  fontSize: 11,
  lineHeight: 1,
  fontFamily: TECHNICAL_MONO_FONT,
} satisfies React.CSSProperties;

const landingImageNameStyle = {
  marginTop: 10,
  color: "rgba(244, 240, 232, 0.72)",
  fontSize: 11,
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} satisfies React.CSSProperties;

const landingToggleRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 12,
  color: "rgba(244, 240, 232, 0.82)",
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer",
} satisfies React.CSSProperties;

const landingSliderRowStyle = {
  display: "grid",
  gridTemplateColumns: "72px 1fr 50px",
  alignItems: "center",
  gap: 8,
  marginTop: 10,
  color: "rgba(244, 240, 232, 0.78)",
  fontSize: 11,
  lineHeight: 1,
} satisfies React.CSSProperties;

const landingSliderLabelStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} satisfies React.CSSProperties;

const landingSliderInputStyle = {
  width: "100%",
  accentColor: "#f4f0e8",
} satisfies React.CSSProperties;

const landingSliderValueStyle = {
  textAlign: "right",
  color: "rgba(244, 240, 232, 0.72)",
  fontVariantNumeric: "tabular-nums",
} satisfies React.CSSProperties;
