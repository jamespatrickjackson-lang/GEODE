import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { useEditor } from "../editor/EditorContext";
import { DEFAULT_ASSAY_COLOR_STOPS } from "../loaders/assayPalette";
import {
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { DrillFocus, SceneHandle } from "../scene";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
} from "./legendStyles";

const ASSAY_LAYER_ID = "assay-samples";

const leaderSvgStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 16,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  overflow: "visible",
  opacity: 0,
  transition: "opacity 180ms ease",
};

const rootStyle: CSSProperties = {
  position: "absolute",
  left: LEGEND_PAGE_EDGE_MARGIN_PX,
  bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX,
  zIndex: 17,
  display: "grid",
  gap: 8,
  pointerEvents: "none",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 13,
};

const colorChipStyle: CSSProperties = {
  minHeight: 29,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 150,
  padding: "0 18px",
  borderRadius: 999,
  boxShadow:
    "0 2px 8px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.34)",
  fontWeight: 650,
  whiteSpace: "nowrap",
};

function textColorForFill(hex: string): string {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw;
  if (full.length !== 6) return "#221f1c";
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const linear = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] +
    0.0722 * linear[2];
  return luminance > 0.34 ? "#221f1c" : "#ffffff";
}

function setPathHidden(path: SVGPathElement | undefined): void {
  if (!path) return;
  path.style.opacity = "0";
  path.setAttribute("d", "");
}

function leaderPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  const dx = tx - sx;
  const c1x = sx + dx * 0.36;
  const c2x = sx + dx * 0.72;
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} C${c1x.toFixed(1)} ${sy.toFixed(1)}, ${c2x.toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

export function AssayLegend({ sceneHandle }: { sceneHandle: SceneHandle }) {
  const { state } = useEditor();
  const { pages, transitionFrame } = usePageController();
  const sourceIndex = transitionFrame.sourceIndex;
  const targetIndex = transitionFrame.targetIndex;
  const page =
    targetIndex !== null && transitionFrame.progress >= 0.92
      ? pages[targetIndex] ?? pages[sourceIndex]
      : pages[sourceIndex];
  const pageEnvironment = page
    ? resolveEnvironmentForPage(state.environment, state.pages, page)
    : state.environment;
  const assays = state.environment.scene?.drilling?.assays ?? {};
  const traceMode = assays.traceMode ?? "assay";
  const svgRef = useRef<SVGSVGElement | null>(null);
  const targetRef = useRef<SVGCircleElement | null>(null);
  const focusRef = useRef<DrillFocus | null>(null);
  const visibleRef = useRef(false);
  const chipRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const lineRefs = useRef<Map<string, SVGPathElement>>(new Map());

  const legendVisible =
    !!page &&
    (traceMode === "assay" || traceMode === "both") &&
    effectiveVisibility(pageEnvironment, page).has(ASSAY_LAYER_ID);
  visibleRef.current = legendVisible;

  const overrides = new Map(
    (assays.colorStops ?? []).map((stop) => [stop.id, stop]),
  );
  const stops = DEFAULT_ASSAY_COLOR_STOPS.map(
    (stop) => overrides.get(stop.id) ?? stop,
  );
  const stopsKey = stops
    .map((stop) => `${stop.id}:${stop.color}:${stop.label}`)
    .join("|");

  useEffect(
    () =>
      sceneHandle.onDrillFocus((focus) => {
        focusRef.current = focus;
      }),
    [sceneHandle],
  );

  useEffect(() => {
    const projected = new THREE.Vector3();
    const off = sceneHandle.onTick(
      () => {
        const svg = svgRef.current;
        if (!svg) return;
        const focus = focusRef.current;
        if (!visibleRef.current || !focus) {
          svg.style.opacity = "0";
          for (const path of lineRefs.current.values()) setPathHidden(path);
          if (targetRef.current) targetRef.current.style.opacity = "0";
          return;
        }

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        svg.setAttribute("viewBox", `0 0 ${viewportW} ${viewportH}`);

        projected.copy(focus.point).project(sceneHandle.camera);
        if (
          projected.z < -1 ||
          projected.z > 1 ||
          projected.x < -1.15 ||
          projected.x > 1.15 ||
          projected.y < -1.15 ||
          projected.y > 1.15
        ) {
          svg.style.opacity = "0";
          for (const path of lineRefs.current.values()) setPathHidden(path);
          if (targetRef.current) targetRef.current.style.opacity = "0";
          return;
        }

        const tx = (projected.x * 0.5 + 0.5) * viewportW;
        const ty = (1 - (projected.y * 0.5 + 0.5)) * viewportH;
        svg.style.opacity = "1";

        if (targetRef.current) {
          targetRef.current.setAttribute("cx", tx.toFixed(1));
          targetRef.current.setAttribute("cy", ty.toFixed(1));
          targetRef.current.style.opacity = "0.9";
        }

        for (const stop of stops) {
          const chip = chipRefs.current.get(stop.id);
          const path = lineRefs.current.get(stop.id);
          if (!chip || !path) {
            setPathHidden(path);
            continue;
          }
          const rect = chip.getBoundingClientRect();
          const chipMidX = rect.left + rect.width / 2;
          const sx = tx >= chipMidX ? rect.right - 2 : rect.left + 2;
          const sy = rect.top + rect.height / 2;
          path.setAttribute("d", leaderPath(sx, sy, tx, ty));
          path.setAttribute("stroke", stop.color);
          path.style.opacity = "0.78";
        }
      },
      "AssayLegend.leaders",
    );
    return off;
  }, [sceneHandle, stopsKey, stops]);

  if (!legendVisible) return null;

  return (
    <>
      <svg
        ref={svgRef}
        style={leaderSvgStyle}
        aria-hidden="true"
        data-dev-source="src/ui/AssayLegend.tsx:9"
        data-dev-note="leaderSvgStyle controls the SVG callout leaders from assay legend chips to a clicked 2023 borehole."
      >
        <defs>
          <filter id="assay-legend-leader-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" floodColor="rgba(0,0,0,0.42)" />
          </filter>
        </defs>
        {stops.map((stop) => (
          <path
            key={stop.id}
            ref={(node) => {
              if (node) lineRefs.current.set(stop.id, node);
              else lineRefs.current.delete(stop.id);
            }}
            fill="none"
            stroke={stop.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#assay-legend-leader-shadow)"
            style={{ opacity: 0, transition: "opacity 160ms ease" }}
          />
        ))}
        <circle
          ref={targetRef}
          r={7}
          fill="none"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth={2}
          filter="url(#assay-legend-leader-shadow)"
          style={{ opacity: 0, transition: "opacity 160ms ease" }}
        />
      </svg>
      <div
        style={rootStyle}
        aria-label="Assay color legend"
        data-focused-hole={focusRef.current?.holeId ?? undefined}
        data-dev-source="src/ui/AssayLegend.tsx:1"
        data-dev-note="AssayLegend renders the on-screen Cu assay color legend when the 2023 drilling layer is visible in assay mode."
      >
        {stops.map((stop) => (
          <span
            key={stop.id}
            ref={(node) => {
              if (node) chipRefs.current.set(stop.id, node);
              else chipRefs.current.delete(stop.id);
            }}
            style={{
              ...colorChipStyle,
              background: stop.color,
              color: textColorForFill(stop.color),
            }}
          >
            {stop.label}
          </span>
        ))}
      </div>
    </>
  );
}
