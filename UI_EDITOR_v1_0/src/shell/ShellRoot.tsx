import { useEffect } from "react";
import { theme } from "./styles/theme";
import { ShellProvider, useShell } from "./state/ShellContext";
import { TopBar } from "./topBar/TopBar";
import { PackageBrowser } from "./packageBrowser/PackageBrowser";
import { CanvasRoot } from "./canvas/CanvasRoot";
import { ToolkitBar } from "./toolkit/ToolkitBar";
import { BackgroundStressBar } from "./backgroundStress/BackgroundStressBar";
import { ValidationPanel } from "./validationPanel/ValidationPanel";
import { LayersPanel } from "./layersPanel/LayersPanel";
import { LibraryPanel } from "./libraryPanel/LibraryPanel";
import { PropertiesInspector } from "./propertiesInspector/PropertiesInspector";
import { ALL_TOOLS } from "./toolkit/tools";

function ShellKeyHandler() {
  const { state, dispatch } = useShell();
  useEffect(() => {
    function isInsideInput(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isInsideInput(e.target)) return;
      const key = e.key.toLowerCase();
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && key === "g") {
        e.preventDefault();
        dispatch({
          type: "TOAST_PUSHED",
          toast: {
            id: `t-${Date.now()}`,
            severity: "info",
            message: e.shiftKey
              ? "Ungroup will be wired in Phase 9 (ELEMENTS_UNGROUP)."
              : "Group will be wired in Phase 9 (ELEMENTS_GROUP).",
            createdAt: Date.now(),
          },
        });
        return;
      }
      if (key === "escape") {
        if (state.activeToolId !== "select") {
          dispatch({ type: "TOOL_ACTIVATED", toolId: "select" });
        } else if (state.selection.length > 0) {
          dispatch({ type: "SELECTION_SET", selection: [] });
        }
        return;
      }
      for (const tool of ALL_TOOLS) {
        const shortcutMatch = tool.keyboardShortcut === key;
        const modifierMatch =
          tool.modifier === undefined
            ? !e.shiftKey && !cmd
            : tool.modifier === "shift"
              ? e.shiftKey && !cmd
              : cmd;
        if (shortcutMatch && modifierMatch) {
          e.preventDefault();
          dispatch({ type: "TOOL_ACTIVATED", toolId: tool.id });
          return;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, state.activeToolId, state.selection.length]);
  return null;
}

function ShellLayout() {
  return (
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
      <ShellKeyHandler />
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
  );
}

export function ShellRoot() {
  return (
    <ShellProvider>
      <ShellLayout />
    </ShellProvider>
  );
}
