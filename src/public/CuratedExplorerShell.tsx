import type { CSSProperties } from "react";
import type { SceneHandle } from "../scene";
import type { LoadedProject } from "../pages/loadPages";
import {
  PageControllerProvider,
  usePageController,
} from "../pages/PageController";
import {
  GATE_A_CURATED_PROJECT_SLUG,
  requireGateACapability,
} from "./gateAExperience";

interface PublicLandingProps {
  error: string | null;
  onOpenUtah: () => void;
  developmentAvailable: boolean;
}

/** An explicit, single supported example. Other projects remain in the dev editor. */
export function CuratedPublicLanding({
  error,
  onOpenUtah,
  developmentAvailable,
}: PublicLandingProps) {
  return (
    <main aria-labelledby="public-landing-title" style={landing}>
      <div style={panel}>
        <p style={eyebrow}>GeoSee · Geoscience visualization</p>
        <h1 id="public-landing-title" style={title}>
          Explore Utah FORGE
        </h1>
        <p style={description}>
          Explore a prepared geothermal and geophysical visualization in a
          browser. This public preview supports camera navigation only;
          creating a project, importing files, authoring and saving are not
          available here.
        </p>
        <p style={caveat}>
          Prepared source-derived layers may have unresolved survey registration
          or datum limitations. Visualization is not validation of scientific
          measurements or suitability for engineering decisions.
        </p>
        {error && <p role="alert" style={errorStyle}>{error}</p>}
        <button
          type="button"
          style={primaryButton}
          onClick={onOpenUtah}
          data-public-project={GATE_A_CURATED_PROJECT_SLUG}
        >
          Open Utah FORGE
        </button>
        {developmentAvailable && (
          <p style={developerNote}>
            Working on GeoSee? <a href="?mode=developer">Open developer editor</a>
          </p>
        )}
      </div>
    </main>
  );
}

interface PublicExplorerProps {
  sceneHandle: SceneHandle;
  project: LoadedProject;
  onReturnHome: () => void;
}

/**
 * The public viewer mounts the existing read-only scene/page-state application
 * path, never EditorProvider, EditorChrome or the dev Save/Import actions.
 * Pages may supply optional camera/display presets, not application capability.
 */
export function CuratedExplorerShell({
  sceneHandle,
  project,
  onReturnHome,
}: PublicExplorerProps) {
  return (
    <PageControllerProvider
      pages={project.pages}
      environment={project.environment}
      sceneHandle={sceneHandle}
      allowPageCameraMarker={false}
    >
      <PublicExplorerControls onReturnHome={onReturnHome} />
    </PageControllerProvider>
  );
}

function PublicExplorerControls({ onReturnHome }: { onReturnHome: () => void }) {
  const { resetToPose } = usePageController();

  const handleReset = () => {
    requireGateACapability("public", "view.reset");
    resetToPose();
  };

  return (
    <div style={viewerOverlay}>
      <div style={viewerHeader}>
        <button type="button" style={outlineButton} onClick={onReturnHome}>
          Back to examples
        </button>
        <div style={viewerTitle}>Utah FORGE · Public viewer</div>
        <button type="button" style={outlineButton} onClick={handleReset}>
          Reset view
        </button>
      </div>
      <p style={viewerFooter}>
        Drag to orbit · Scroll to zoom · View-only. Scientific registration may
        be unverified. Project editing, import, save and capture are unavailable.
      </p>
    </div>
  );
}

const landing: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(145deg, #0b1823, #1a3040 65%, #0a141c)",
  color: "#f0f4f6",
  fontFamily: "system-ui, sans-serif",
  overflowY: "auto",
  zIndex: 8,
  padding: 24,
  boxSizing: "border-box",
};
const panel: CSSProperties = {
  width: "min(640px, 100%)",
  background: "rgba(13, 23, 31, 0.88)",
  border: "1px solid rgba(190, 217, 226, 0.25)",
  borderRadius: 18,
  padding: "clamp(24px, 5vw, 48px)",
  boxSizing: "border-box",
  boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
};
const eyebrow: CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#9ec9d4",
  margin: "0 0 18px",
};
const title: CSSProperties = {
  fontSize: "clamp(34px, 5vw, 52px)",
  lineHeight: 1.08,
  fontWeight: 650,
  margin: "0 0 22px",
};
const description: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.65,
  color: "#dae4e8",
};
const caveat: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: "#afc3cb",
};
const primaryButton: CSSProperties = {
  marginTop: 24,
  background: "#dbf0f5",
  color: "#0c2530",
  border: 0,
  borderRadius: 9,
  padding: "12px 20px",
  cursor: "pointer",
  font: "600 15px system-ui, sans-serif",
};
const errorStyle: CSSProperties = {
  padding: 12,
  color: "#ffe0df",
  border: "1px solid #a95453",
  borderRadius: 8,
};
const developerNote: CSSProperties = {
  marginTop: 24,
  color: "#bbd1db",
  fontSize: 12,
};
const viewerOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 12,
  fontFamily: "system-ui, sans-serif",
  color: "#f2f6f7",
};
const viewerHeader: CSSProperties = {
  position: "absolute",
  left: 20,
  right: 20,
  top: 18,
  display: "flex",
  alignItems: "center",
  gap: 12,
  justifyContent: "space-between",
};
const viewerTitle: CSSProperties = {
  padding: "10px 14px",
  background: "rgba(13,24,33,0.82)",
  borderRadius: 9,
  textAlign: "center",
  fontSize: 14,
};
const outlineButton: CSSProperties = {
  pointerEvents: "auto",
  background: "rgba(13,24,33,0.87)",
  color: "#fff",
  border: "1px solid rgba(228,242,247,0.55)",
  borderRadius: 9,
  padding: "10px 14px",
  font: "500 13px system-ui, sans-serif",
  cursor: "pointer",
};
const viewerFooter: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(720px, calc(100% - 32px))",
  textAlign: "center",
  background: "rgba(10,20,28,0.78)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 12,
  lineHeight: 1.5,
};
