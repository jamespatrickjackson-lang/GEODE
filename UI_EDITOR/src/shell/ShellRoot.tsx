import { theme } from "./styles/theme";
import { ShellProvider } from "./state/ShellContext";
import { TopBar } from "./topBar/TopBar";
import { PackageBrowser } from "./packageBrowser/PackageBrowser";
import { CanvasRoot } from "./canvas/CanvasRoot";
import { ToolkitBar } from "./toolkit/ToolkitBar";
import { BackgroundStressBar } from "./backgroundStress/BackgroundStressBar";
import { ValidationPanel } from "./validationPanel/ValidationPanel";
import { LayersPanel } from "./layersPanel/LayersPanel";
import { LibraryPanel } from "./libraryPanel/LibraryPanel";
import { PropertiesInspector } from "./propertiesInspector/PropertiesInspector";

export function ShellRoot() {
  return (
    <ShellProvider>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: theme.background.body,
          color: theme.foreground.primary,
          font: `${theme.font.bodySize}px/${theme.font.bodyLineHeight} ${theme.font.ui}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar />
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <PackageBrowser />
          <CanvasRoot />
          <div
            style={{
              width: 280,
              display: "flex",
              flexDirection: "column",
              borderLeft: theme.border.hairline,
            }}
          >
            <LibraryPanel />
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
            <PropertiesInspector />
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
            <LayersPanel />
          </div>
        </div>
        <ToolkitBar />
        <BackgroundStressBar />
        <ValidationPanel />
      </div>
    </ShellProvider>
  );
}
