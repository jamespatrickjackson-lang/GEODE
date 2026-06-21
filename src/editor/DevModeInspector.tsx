import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EditorChromeSettings } from "../pages/types";
import { DevContainerControlPanel } from "./devMode/ControlPanel";
import {
  BoxModelOverlay,
  ContainerOutlinesLayer,
  collectContainerOutlines,
} from "./devMode/containerOutlines";
import { inspectAtPoint, inspectElement } from "./devMode/inspect";
import { applyOverridesToDocument } from "./devMode/overrideStore";
import { DevModeReorderRegistration } from "./devMode/ReorderRegistration";
import {
  ReorderDragLayer,
  isReorderClickSuppressed,
  isReorderDragging,
} from "./devMode/reorderDrag";
import { buildRestorePatch, captureSnapshot } from "./devMode/session";
import {
  devModeBadgeStyle,
  devDiscardButtonStyle,
  devSaveBarLabelStyle,
  devSaveBarStyle,
  devSaveButtonStyle,
  highlightStyle,
  tooltipKickerStyle,
  tooltipNoteStyle,
  tooltipPaddingStyle,
  tooltipSourceStyle,
  tooltipStyle,
} from "./devMode/styles";
import type { ContainerOutlineInfo, HoverInfo } from "./devMode/types";

interface DevModeInspectorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  editorSettings: EditorChromeSettings;
  onEditorSettingsChange: (patch: EditorChromeSettings) => void;
  onDevCommit?: () => void;
}

export function DevModeInspector({
  enabled,
  onEnabledChange,
  editorSettings,
  onEditorSettingsChange,
  onDevCommit,
}: DevModeInspectorProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [locked, setLocked] = useState<HoverInfo | null>(null);
  const [outlines, setOutlines] = useState<ContainerOutlineInfo[]>([]);
  const [hasDevEdits, setHasDevEdits] = useState(false);
  const snapshotRef = useRef<EditorChromeSettings | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "d" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTypingTarget(document.activeElement)
      ) {
        return;
      }
      event.preventDefault();
      const next = !enabled;
      if (!next) {
        setHover(null);
        setLocked(null);
      }
      onEnabledChange(next);
      setHover(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onEnabledChange]);

  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (event: PointerEvent) => {
      if (locked) return;
      if (isReorderDragging()) return;
      if (isDevModeControlTarget(event.target)) return;
      const next = inspectAtPoint(event);
      if (next) setHover(next);
    };

    const onPointerLeave = () => setHover(null);
    const onClick = (event: MouseEvent) => {
      if (isReorderClickSuppressed()) return;
      if (isDevModeControlTarget(event.target)) return;
      const next = inspectAtPoint(event, { lock: true });
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      setLocked(next);
      setHover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLocked(null);
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [enabled, locked]);

  // Recompute container outlines off the hover path (perf): on enable, scroll,
  // resize, lock changes, and chrome-setting edits that can shift layout.
  useEffect(() => {
    if (!enabled) {
      setOutlines([]);
      return;
    }
    let raf = 0;
    const refresh = () => setOutlines(collectContainerOutlines());
    const scheduleRefresh = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        refresh();
      });
    };
    refresh();
    window.addEventListener("scroll", scheduleRefresh, true);
    window.addEventListener("resize", scheduleRefresh);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", scheduleRefresh, true);
      window.removeEventListener("resize", scheduleRefresh);
    };
  }, [enabled, locked, editorSettings]);

  // Phase 4: re-apply persisted text/style overrides on load and whenever the
  // override map changes. Runs regardless of dev mode so saved edits always show.
  useEffect(() => {
    const overrides = editorSettings.devTextOverrides;
    if (!overrides) return;
    applyOverridesToDocument(overrides);
    const retry = window.setTimeout(() => applyOverridesToDocument(overrides), 400);
    return () => window.clearTimeout(retry);
  }, [editorSettings.devTextOverrides]);

  if (!enabled) return null;

  const info = locked ?? hover;
  const tooltipLeft = info
    ? Math.min(info.x + 14, window.innerWidth - 330)
    : 16;
  const tooltipTop = info
    ? Math.min(info.y + 16, window.innerHeight - 132)
    : 16;

  const selectContainer = (element: Element) => {
    const next = inspectElement(element, { lock: true });
    if (!next) return;
    setLocked(next);
    setHover(null);
  };

  // Phase 3 (D1): dev edits apply live but persist only on Save; Discard reverts.
  const handlePatch = (patch: EditorChromeSettings) => {
    if (!snapshotRef.current) snapshotRef.current = captureSnapshot(editorSettings);
    setHasDevEdits(true);
    onEditorSettingsChange(patch);
  };
  const saveDevEdits = () => {
    snapshotRef.current = null;
    setHasDevEdits(false);
    onDevCommit?.();
  };
  const discardDevEdits = () => {
    if (snapshotRef.current) {
      onEditorSettingsChange(
        buildRestorePatch(editorSettings, snapshotRef.current),
      );
    }
    snapshotRef.current = null;
    setHasDevEdits(false);
    setLocked(null);
  };

  return createPortal(
    <>
      <div style={devModeBadgeStyle}>Dev mode: hover to find code</div>
      <ContainerOutlinesLayer
        outlines={outlines}
        selectedElement={locked?.element}
        onSelect={selectContainer}
      />
      <DevModeReorderRegistration />
      <ReorderDragLayer enabled={enabled} />
      {info?.box && <BoxModelOverlay box={info.box} />}
      {info?.rect && (
        <div
          style={{
            ...highlightStyle,
            left: info.rect.left,
            top: info.rect.top,
            width: info.rect.width,
            height: info.rect.height,
          }}
        />
      )}
      {info && (
        <div
          style={{
            ...tooltipStyle,
            left: tooltipLeft,
            top: tooltipTop,
          }}
        >
          <div style={tooltipKickerStyle}>
            {info.locked ? "clicked" : "hover"} - {info.label}
          </div>
          {info.containerName && (
            <div style={tooltipPaddingStyle}>
              {info.containerName} - {info.containerType}
            </div>
          )}
          <div style={tooltipSourceStyle}>{info.source}</div>
          {info.containerScope && (
            <div style={tooltipNoteStyle}>scope: {info.containerScope}</div>
          )}
          {info.padding && (
            <div style={tooltipPaddingStyle}>
              padding: {info.padding.sides.join(" + ")}
            </div>
          )}
          {info.note && <div style={tooltipNoteStyle}>{info.note}</div>}
          {info.locked && (
            <div style={tooltipNoteStyle}>Press Esc to clear the lock.</div>
          )}
        </div>
      )}
      {locked && (
        <DevContainerControlPanel
          info={locked}
          editorSettings={editorSettings}
          onPatch={handlePatch}
          onClose={() => setLocked(null)}
        />
      )}
      {hasDevEdits && (
        <div style={devSaveBarStyle} data-dev-mode-control="true">
          <span style={devSaveBarLabelStyle}>Dev edits pending</span>
          <button
            type="button"
            style={devSaveButtonStyle}
            onClick={saveDevEdits}
          >
            Save
          </button>
          <button
            type="button"
            style={devDiscardButtonStyle}
            onClick={discardDevEdits}
          >
            Discard
          </button>
        </div>
      )}
    </>,
    document.body,
  );
}

function isTypingTarget(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLInputElement) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

function isDevModeControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && Boolean(target.closest("[data-dev-mode-control]"))
  );
}
