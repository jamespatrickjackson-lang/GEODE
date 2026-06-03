import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { FrameLayer } from "./FrameLayer";
import { buildColourResolver } from "./elements/RenderDispatcher";
import { RulerHorizontal } from "./RulerHorizontal";
import { RulerVertical } from "./RulerVertical";
import { snapPoint } from "../../core/geometry/snap";
import {
  anchorsForFrame,
} from "../../core/geometry/anchorsForFrame";
import { computeSmartGuides, type SmartGuide } from "../../core/geometry/smartGuides";
import { applyMove, applyResize, type HandleId } from "../../core/geometry/transform";
import {
  elementsWhollyEnclosedByRect,
  topmostElementAtFramePoint,
} from "./selection/selectionLogic";
import type { Frame } from "../../core/schema/frame";
import type { Component } from "../../core/schema/component";
import type { Container } from "../../core/schema/container";
import type { Rect } from "../../core/schema/primitives";
import { clone } from "../../core/util/clone";

interface DragState {
  kind: "move" | "resize" | "pan" | "marquee";
  handle?: HandleId;
  startScreen: { x: number; y: number };
  startRects?: Record<string, Rect>;
  baseSnapshot?: { frames: Frame[]; containers: Record<string, Container>; components: Record<string, Component> };
  marqueeStart?: { x: number; y: number };
}

export function CanvasRoot() {
  const { state, dispatch } = useShell();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const spaceHeldRef = useRef(false);
  const fittedPkgRef = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeldRef.current = e.type === "keydown";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // Fit the viewport to a set of frames so loaded parts are immediately
  // visible. mode "all" frames an overview of every panel; mode "active"
  // fills the view with the active frame.
  const fitTo = useCallback(
    (mode: "all" | "active") => {
      if (!state.pkg) return;
      const el = containerRef.current;
      if (!el) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw <= 0 || vh <= 0) return;
      const frames =
        mode === "active"
          ? state.pkg.frames.filter((f) => f.id === state.activeFrameId)
          : state.pkg.frames;
      if (frames.length === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const f of frames) {
        minX = Math.min(minX, f.positionOnCanvas.x);
        minY = Math.min(minY, f.positionOnCanvas.y);
        maxX = Math.max(maxX, f.positionOnCanvas.x + f.size.w);
        maxY = Math.max(maxY, f.positionOnCanvas.y + f.size.h);
      }
      const extentW = Math.max(1, maxX - minX);
      const extentH = Math.max(1, maxY - minY);
      const zoom = clamp(Math.min(vw / extentW, vh / extentH) * 0.9, 0.1, 8);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const panX = vw / (2 * zoom) - centerX;
      const panY = vh / (2 * zoom) - centerY;
      dispatch({ type: "VIEWPORT_SET", patch: { zoom, panX, panY } });
    },
    [state.pkg, state.activeFrameId, dispatch],
  );

  // Auto-fit once per loaded package so the parts show up without manual
  // pan/zoom. requestAnimationFrame waits for the container to have a size.
  useEffect(() => {
    const id = state.pkg?.manifest.id ?? null;
    if (!id || fittedPkgRef.current === id) return;
    const raf = requestAnimationFrame(() => {
      fitTo("all");
      fittedPkgRef.current = id;
    });
    return () => cancelAnimationFrame(raf);
  }, [state.pkg?.manifest.id, fitTo]);

  // Keyboard: "1" fit active frame, "2" fit all, "0" reset to 100%.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "1") fitTo("active");
      else if (e.key === "2") fitTo("all");
      else if (e.key === "0")
        dispatch({ type: "VIEWPORT_SET", patch: { zoom: 1, panX: 0, panY: 0 } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitTo, dispatch]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        // pan via trackpad two-finger scroll
        dispatch({
          type: "VIEWPORT_SET",
          patch: {
            panX: state.viewport.panX - e.deltaX / state.viewport.zoom,
            panY: state.viewport.panY - e.deltaY / state.viewport.zoom,
          },
        });
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextZoom = clamp(state.viewport.zoom * factor, 0.1, 8);
      const focalX = (e.clientX - rect.left) / state.viewport.zoom - state.viewport.panX;
      const focalY = (e.clientY - rect.top) / state.viewport.zoom - state.viewport.panY;
      const nextPanX = (e.clientX - rect.left) / nextZoom - focalX;
      const nextPanY = (e.clientY - rect.top) / nextZoom - focalY;
      dispatch({
        type: "VIEWPORT_SET",
        patch: { zoom: nextZoom, panX: nextPanX, panY: nextPanY },
      });
    },
    [dispatch, state.viewport],
  );

  const activeFrame: Frame | null = useMemo(() => {
    return state.pkg?.frames.find((f) => f.id === state.activeFrameId) ?? null;
  }, [state.pkg, state.activeFrameId]);

  const screenToCanvasCoords = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left) / state.viewport.zoom - state.viewport.panX,
        y: (sy - rect.top) / state.viewport.zoom - state.viewport.panY,
      };
    },
    [state.viewport],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!state.pkg) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const middleButton = e.button === 1;
      if (spaceHeldRef.current || middleButton) {
        setDrag({ kind: "pan", startScreen: { x: e.clientX, y: e.clientY } });
        return;
      }
      // marquee start on empty canvas
      const canvasPt = screenToCanvasCoords(e.clientX, e.clientY);
      const frame = activeFrame;
      if (!frame) return;
      const framePt = {
        x: canvasPt.x - frame.positionOnCanvas.x,
        y: canvasPt.y - frame.positionOnCanvas.y,
      };
      const inside = framePt.x >= 0 && framePt.x <= frame.size.w && framePt.y >= 0 && framePt.y <= frame.size.h;
      if (!inside) return;
      const hit = topmostElementAtFramePoint(framePt, frame, state.pkg.containers, state.pkg.components);
      if (hit) {
        const el = hit.kind === "component" ? state.pkg.components[hit.id] : state.pkg.containers[hit.id];
        if (!el || el.locked) return;
        const isAlready = state.selection.some((s) => s.id === hit.id);
        const newSelection = e.shiftKey
          ? (isAlready
              ? state.selection.filter((s) => s.id !== hit.id)
              : [...state.selection, hit])
          : isAlready
            ? state.selection
            : [hit];
        dispatch({ type: "SELECTION_SET", selection: newSelection });
        const startRects: Record<string, Rect> = {};
        for (const s of newSelection) {
          const r =
            s.kind === "component"
              ? state.pkg.components[s.id]?.rect
              : state.pkg.containers[s.id]?.rect;
          if (r) startRects[s.id] = { ...r };
        }
        setDrag({
          kind: state.activeToolId === "resize" ? "resize" : "move",
          startScreen: { x: e.clientX, y: e.clientY },
          startRects,
          baseSnapshot: {
            frames: state.pkg.frames,
            containers: clone(state.pkg.containers),
            components: clone(state.pkg.components),
          },
        });
      } else {
        // marquee
        if (!e.shiftKey) dispatch({ type: "SELECTION_SET", selection: [] });
        setDrag({
          kind: "marquee",
          startScreen: { x: e.clientX, y: e.clientY },
          marqueeStart: framePt,
        });
      }
    },
    [activeFrame, dispatch, screenToCanvasCoords, state.activeToolId, state.pkg, state.selection],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !state.pkg || !activeFrame) return;
      if (drag.kind === "pan") {
        const dx = (e.clientX - drag.startScreen.x) / state.viewport.zoom;
        const dy = (e.clientY - drag.startScreen.y) / state.viewport.zoom;
        dispatch({
          type: "VIEWPORT_SET",
          patch: { panX: state.viewport.panX + dx, panY: state.viewport.panY + dy },
        });
        setDrag({ ...drag, startScreen: { x: e.clientX, y: e.clientY } });
        return;
      }
      if (drag.kind === "marquee") {
        const cur = screenToCanvasCoords(e.clientX, e.clientY);
        const framePt = {
          x: cur.x - activeFrame.positionOnCanvas.x,
          y: cur.y - activeFrame.positionOnCanvas.y,
        };
        const start = drag.marqueeStart!;
        const rect: Rect = {
          x: Math.min(start.x, framePt.x),
          y: Math.min(start.y, framePt.y),
          w: Math.abs(framePt.x - start.x),
          h: Math.abs(framePt.y - start.y),
        };
        setMarqueeRect(rect);
        return;
      }
      if ((drag.kind === "move" || drag.kind === "resize") && drag.startRects && drag.baseSnapshot) {
        const dxScreen = e.clientX - drag.startScreen.x;
        const dyScreen = e.clientY - drag.startScreen.y;
        const dx = dxScreen / state.viewport.zoom;
        const dy = dyScreen / state.viewport.zoom;
        const excludeIds = new Set(Object.keys(drag.startRects));
        const containersArr = Object.values(drag.baseSnapshot.containers);
        const componentsArr = Object.values(drag.baseSnapshot.components);
        const anchors = anchorsForFrame(
          activeFrame,
          containersArr,
          componentsArr,
          activeFrame.safeArea,
          state.pkg.guides,
          excludeIds,
        );
        const nextContainers = clone(drag.baseSnapshot.containers);
        const nextComponents = clone(drag.baseSnapshot.components);
        const allSmartCandidates: { id: string; rect: Rect }[] = [];
        for (const c of containersArr) if (!excludeIds.has(c.id)) allSmartCandidates.push({ id: c.id, rect: c.rect });
        for (const c of componentsArr) if (!excludeIds.has(c.id)) allSmartCandidates.push({ id: c.id, rect: c.rect });
        const newSmartGuides: SmartGuide[] = [];
        for (const sel of state.selection) {
          const startRect = drag.startRects[sel.id];
          if (!startRect) continue;
          let proposed: Rect;
          if (drag.kind === "move") {
            const desired = { x: startRect.x + dx, y: startRect.y + dy };
            const snapResult = snapPoint(
              desired,
              anchors,
              state.snap.pixelGridSize,
              state.snap.thresholdPx,
              state.viewport.zoom,
            );
            const snappedDelta = { dx: snapResult.x - startRect.x, dy: snapResult.y - startRect.y };
            proposed = applyMove(startRect, snappedDelta, null, null);
          } else {
            proposed = applyResize(
              startRect,
              drag.handle ?? "se",
              { dx, dy },
              null,
              null,
              undefined,
              e.shiftKey,
            );
          }
          if (sel.kind === "component") {
            const node = nextComponents[sel.id];
            if (node) node.rect = proposed;
          } else {
            const node = nextContainers[sel.id];
            if (node) node.rect = proposed;
          }
          newSmartGuides.push(
            ...computeSmartGuides(proposed, sel.id, allSmartCandidates, 0.5),
          );
        }
        const nextPkg = {
          ...state.pkg,
          containers: nextContainers,
          components: nextComponents,
        };
        dispatch({ type: "PACKAGE_REPLACED", pkg: nextPkg });
        setSmartGuides(newSmartGuides);
      }
    },
    [drag, dispatch, screenToCanvasCoords, state.viewport, state.snap, state.pkg, state.selection, activeFrame],
  );

  const onPointerUp = useCallback(() => {
    if (drag?.kind === "marquee" && marqueeRect && activeFrame && state.pkg) {
      const enclosed = elementsWhollyEnclosedByRect(
        marqueeRect,
        activeFrame,
        state.pkg.containers,
        state.pkg.components,
      );
      dispatch({ type: "SELECTION_SET", selection: enclosed });
    }
    setDrag(null);
    setSmartGuides([]);
    setMarqueeRect(null);
  }, [drag, marqueeRect, activeFrame, state.pkg, dispatch]);

  const onHandlePointerDown = useCallback(
    (handle: HandleId, e: React.PointerEvent) => {
      if (!state.pkg || state.selection.length !== 1) return;
      const sel = state.selection[0]!;
      const r =
        sel.kind === "component"
          ? state.pkg.components[sel.id]?.rect
          : state.pkg.containers[sel.id]?.rect;
      if (!r) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        kind: "resize",
        handle,
        startScreen: { x: e.clientX, y: e.clientY },
        startRects: { [sel.id]: { ...r } },
        baseSnapshot: {
          frames: state.pkg.frames,
          containers: clone(state.pkg.containers),
          components: clone(state.pkg.components),
        },
      });
    },
    [state.pkg, state.selection],
  );

  const resolveColour = useMemo(() => buildColourResolver(state.pkg), [state.pkg]);

  const selectedRectsByFrame = useMemo(() => {
    if (!state.pkg) return new Map<string, Rect[]>();
    const map = new Map<string, Rect[]>();
    for (const sel of state.selection) {
      const el =
        sel.kind === "component"
          ? state.pkg.components[sel.id]
          : state.pkg.containers[sel.id];
      if (!el) continue;
      const list = map.get(el.frameId) ?? [];
      list.push(el.rect);
      map.set(el.frameId, list);
    }
    return map;
  }, [state.pkg, state.selection]);

  if (!state.pkg) {
    return (
      <div
        style={{
          flex: 1,
          background: theme.background.body,
          color: theme.foreground.tertiary,
          font: `${theme.font.bodySize}px ${theme.font.ui}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Canvas (no package loaded)
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        background: theme.background.body,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 12,
          zIndex: 30,
          display: "flex",
          gap: 6,
        }}
      >
        <button type="button" style={fitButtonStyle} onClick={() => fitTo("active")} title="Fit active frame (1)">
          Fit frame
        </button>
        <button type="button" style={fitButtonStyle} onClick={() => fitTo("all")} title="Fit all frames (2)">
          Fit all
        </button>
        <button
          type="button"
          style={fitButtonStyle}
          onClick={() => dispatch({ type: "VIEWPORT_SET", patch: { zoom: 1, panX: 0, panY: 0 } })}
          title="Reset to 100% (0)"
        >
          100%
        </button>
        <span style={{ ...fitButtonStyle, cursor: "default", opacity: 0.7 }}>
          {Math.round(state.viewport.zoom * 100)}%
        </span>
      </div>
      <RulerHorizontal
        width={containerRef.current?.clientWidth ?? 800}
        zoom={state.viewport.zoom}
        panX={state.viewport.panX}
        frameOriginCanvasX={activeFrame?.positionOnCanvas.x ?? 0}
      />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <RulerVertical
          height={containerRef.current?.clientHeight ?? 600}
          zoom={state.viewport.zoom}
          panY={state.viewport.panY}
          frameOriginCanvasY={activeFrame?.positionOnCanvas.y ?? 0}
        />
        <div
          ref={containerRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: theme.background.body,
            cursor: spaceHeldRef.current ? "grab" : "default",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: state.viewport.panX * state.viewport.zoom,
              top: state.viewport.panY * state.viewport.zoom,
              transformOrigin: "top left",
            }}
          >
            {state.pkg.frames.map((frame) => (
              <FrameLayer
                key={frame.id}
                frame={frame}
                zoom={state.viewport.zoom}
                containers={state.pkg!.containers}
                components={state.pkg!.components}
                resolveColour={resolveColour}
                guides={state.pkg!.guides}
                smartGuides={frame.id === state.activeFrameId ? smartGuides : []}
                selectedRects={selectedRectsByFrame.get(frame.id) ?? []}
                showHandles={state.activeToolId !== "select" || true}
                isActive={frame.id === state.activeFrameId}
                onFramePointerDown={() => {
                  if (frame.id !== state.activeFrameId) {
                    dispatch({ type: "ACTIVE_FRAME_SET", frameId: frame.id });
                  }
                }}
                onElementPointerDown={(_kind, _id, _e) => {
                  if (frame.id !== state.activeFrameId) {
                    dispatch({ type: "ACTIVE_FRAME_SET", frameId: frame.id });
                  }
                }}
                onHandlePointerDown={onHandlePointerDown}
              />
            ))}
            {marqueeRect && activeFrame && (
              <div
                style={{
                  position: "absolute",
                  left: (activeFrame.positionOnCanvas.x + marqueeRect.x) * state.viewport.zoom,
                  top: (activeFrame.positionOnCanvas.y + marqueeRect.y) * state.viewport.zoom,
                  width: marqueeRect.w * state.viewport.zoom,
                  height: marqueeRect.h * state.viewport.zoom,
                  border: "1px dashed rgba(120,180,220,0.8)",
                  background: "rgba(120,180,220,0.08)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const fitButtonStyle: React.CSSProperties = {
  background: theme.background.panelRaised,
  color: theme.foreground.primary,
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: theme.radius.control,
  padding: "3px 9px",
  font: `${theme.font.bodySize}px ${theme.font.ui}`,
  cursor: "pointer",
};
