import type React from "react";
import { DEFAULT_ASSAY_COLOR_STOPS } from "../../../loaders/assayPalette";
import type { SceneProperties } from "../../../pages/types";
import { panelStyles } from "../../styles";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssayHintStyle,
  drillingAssayPaletteStyle,
  drillingAssayPaletteTitleStyle,
  drillingAssaySummaryStyle,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
} from "../../styleControls";
import {
  assayOutlineColorInputStyle,
  drillingAssayColorNameStyle,
  drillingAssayColorRowStyle,
} from "./layoutStyles";
import {
  AssayColorControl,
  AssayToggle,
  TopoDistanceSlider,
} from "./LayoutControls";

export function DrillingAssayPanel({
  scene,
  setEnvScene,
}: {
  scene: SceneProperties;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
}) {
  const drilling = scene.drilling ?? {};
  const assays = drilling.assays ?? {};
  const traceMode = assays.traceMode ?? "assay";
  const showBoreLine = assays.showBoreLine ?? true;
  const boreLineColor = assays.boreLineColor ?? "#e7dcc4";
  const boreWidth = assays.boreLineWidthPx ?? 3.25;
  const boreLineOpacity = assays.boreLineOpacity ?? 0.72;
  const boreLineRenderOrder = assays.boreLineRenderOrder ?? 6.8;
  const showBoreTube = assays.showBoreTube ?? true;
  const boreTubeColor = assays.boreTubeColor ?? "#d8ccb2";
  const boreTubeOpacity = assays.boreTubeOpacity ?? 0.88;
  const boreTubeRoughness = assays.boreTubeRoughness ?? 0.64;
  const boreTubeMetalness = assays.boreTubeMetalness ?? 0.08;
  const boreTubeEmissiveColor = assays.boreTubeEmissiveColor ?? "#8d826f";
  const boreTubeEmissive = assays.boreTubeEmissive ?? 0.012;
  const boreTubeRenderOrder = assays.boreTubeRenderOrder ?? 5.4;
  const assayMultiplier = assays.assayWidthMultiplier ?? 2.6;
  const lithologyMultiplier = assays.lithologyWidthMultiplier ?? 2.45;
  const lithologyOpacity = assays.lithologyOpacity ?? 0.56;
  const showAssaySides = assays.showAssaySides ?? true;
  const showAssayCaps = assays.showAssayCaps ?? true;
  const assaySideOpacity = assays.assaySideOpacity ?? 1;
  const assayCapOpacity = assays.assayCapOpacity ?? 1;
  const capThicknessM = assays.assayCapThicknessM ?? 1.6;
  const sideRoughness = assays.assaySideRoughness ?? 0.46;
  const capRoughness = assays.assayCapRoughness ?? 0.74;
  const metalness = assays.assayMetalness ?? 0.02;
  const sideEmissive = assays.assaySideEmissive ?? 0.018;
  const capEmissive = assays.assayCapEmissive ?? 0.012;
  const sideRenderOrder = assays.assaySideRenderOrder ?? 7.4;
  const capRenderOrder = assays.assayCapRenderOrder ?? 8;
  const showBoreLens = assays.showBoreLens ?? true;
  const boreLensColor = assays.boreLensColor ?? "#e9dec4";
  const boreLensOpacity = assays.boreLensOpacity ?? 0.16;
  const colorStopMap = new Map(
    DEFAULT_ASSAY_COLOR_STOPS.map((stop) => [stop.id, stop]),
  );
  for (const stop of assays.colorStops ?? []) {
    colorStopMap.set(stop.id, stop);
  }
  const colorStops = DEFAULT_ASSAY_COLOR_STOPS.map(
    (stop) => colorStopMap.get(stop.id) ?? stop,
  );
  const setAssays = (
    patch: NonNullable<NonNullable<SceneProperties["drilling"]>["assays"]>,
  ) => {
    setEnvScene({
      drilling: {
        ...drilling,
        assays: { ...assays, ...patch },
      },
    });
  };
  const updateColorStop = (
    id: string,
    patch: Partial<{ label: string; color: string }>,
  ) => {
    setAssays({
      colorStops: colorStops.map((stop) =>
        stop.id === id ? { ...stop, ...patch } : stop,
      ),
    });
  };

  return (
    <details
      style={drillingAssayDetailsStyle}
      data-dev-source="src/editor/LayerPanel.tsx:529"
      data-dev-note="DrillingAssayPanel captures render variables for 2023 downhole assay display under the Assay Samples layer group."
    >
      <summary style={drillingAssaySummaryStyle}>Assays</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Trace view</label>
          <select
            value={traceMode}
            onChange={(e) =>
              setAssays({
                traceMode: e.target.value as "assay" | "lithology" | "both",
              })
            }
            style={panelStyles.textInput}
          >
            <option value="assay">Assay grade</option>
            <option value="lithology">Lithology</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Bore line / outline</div>
          <AssayToggle
            label="Line"
            checked={showBoreLine}
            onChange={(checked) => setAssays({ showBoreLine: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreLineColor}
            onChange={(color) => setAssays({ boreLineColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreLineOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreLineOpacity: value })}
          />
          <TopoDistanceSlider
            label="Order"
            value={boreLineRenderOrder}
            min={0}
            max={12}
            step={0.1}
            decimals={1}
            onChange={(value) => setAssays({ boreLineRenderOrder: value })}
          />
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Bore tube</div>
          <AssayToggle
            label="Tube"
            checked={showBoreTube}
            onChange={(checked) => setAssays({ showBoreTube: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreTubeColor}
            onChange={(color) => setAssays({ boreTubeColor: color })}
          />
          <AssayColorControl
            label="Glow color"
            value={boreTubeEmissiveColor}
            onChange={(color) => setAssays({ boreTubeEmissiveColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreTubeOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeOpacity: value })}
          />
          <TopoDistanceSlider
            label="Rough"
            value={boreTubeRoughness}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeRoughness: value })}
          />
          <TopoDistanceSlider
            label="Metal"
            value={boreTubeMetalness}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeMetalness: value })}
          />
          <TopoDistanceSlider
            label="Glow"
            value={boreTubeEmissive}
            min={0}
            max={0.4}
            step={0.005}
            decimals={3}
            onChange={(value) => setAssays({ boreTubeEmissive: value })}
          />
          <TopoDistanceSlider
            label="Order"
            value={boreTubeRenderOrder}
            min={0}
            max={12}
            step={0.1}
            decimals={1}
            onChange={(value) => setAssays({ boreTubeRenderOrder: value })}
          />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Bore width</label>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.5}
            value={boreWidth}
            onChange={(e) =>
              setAssays({ boreLineWidthPx: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((boreWidth - 0.5) / 5.5) * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Assay width</label>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={assayMultiplier}
            onChange={(e) =>
              setAssays({ assayWidthMultiplier: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((assayMultiplier - 1) / 7) * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Lith width</label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={lithologyMultiplier}
            onChange={(e) =>
              setAssays({
                lithologyWidthMultiplier: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((lithologyMultiplier - 1) / 9) * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>
        <TopoDistanceSlider
          label="Lith opacity"
          value={lithologyOpacity}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(value) => setAssays({ lithologyOpacity: value })}
        />
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Assay tuning</div>
          <AssayToggle
            label="Sides"
            checked={showAssaySides}
            onChange={(checked) => setAssays({ showAssaySides: checked })}
          />
          <AssayToggle
            label="Caps"
            checked={showAssayCaps}
            onChange={(checked) => setAssays({ showAssayCaps: checked })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap thick</label>
            <input
              type="range"
              min={0.2}
              max={20}
              step={0.2}
              value={capThicknessM}
              onChange={(e) =>
                setAssays({ assayCapThicknessM: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((capThicknessM - 0.2) / 19.8) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <TopoDistanceSlider
            label="Side alpha"
            value={assaySideOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ assaySideOpacity: value })}
          />
          <TopoDistanceSlider
            label="Cap alpha"
            value={assayCapOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ assayCapOpacity: value })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side rough</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sideRoughness}
              onChange={(e) =>
                setAssays({ assaySideRoughness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${sideRoughness * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap rough</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={capRoughness}
              onChange={(e) =>
                setAssays({ assayCapRoughness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${capRoughness * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Metal</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={metalness}
              onChange={(e) =>
                setAssays({ assayMetalness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${metalness * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side lift</label>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.005}
              value={sideEmissive}
              onChange={(e) =>
                setAssays({ assaySideEmissive: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${(sideEmissive / 0.4) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap lift</label>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.005}
              value={capEmissive}
              onChange={(e) =>
                setAssays({ assayCapEmissive: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${(capEmissive / 0.4) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side order</label>
            <input
              type="range"
              min={6}
              max={10}
              step={0.1}
              value={sideRenderOrder}
              onChange={(e) =>
                setAssays({ assaySideRenderOrder: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((sideRenderOrder - 6) / 4) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap order</label>
            <input
              type="range"
              min={6}
              max={10}
              step={0.1}
              value={capRenderOrder}
              onChange={(e) =>
                setAssays({ assayCapRenderOrder: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((capRenderOrder - 6) / 4) * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Cap lens</div>
          <AssayToggle
            label="Lens"
            checked={showBoreLens}
            onChange={(checked) => setAssays({ showBoreLens: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreLensColor}
            onChange={(color) => setAssays({ boreLensColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreLensOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreLensOpacity: value })}
          />
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Assay colors</div>
          {colorStops.map((stop) => (
            <div key={stop.id} style={drillingAssayColorRowStyle}>
              <input
                type="color"
                value={stop.color}
                onChange={(e) =>
                  updateColorStop(stop.id, { color: e.target.value })
                }
                style={assayOutlineColorInputStyle}
                title={stop.label}
              />
              <input
                type="text"
                value={stop.label}
                onChange={(e) =>
                  updateColorStop(stop.id, { label: e.target.value })
                }
                style={drillingAssayColorNameStyle}
              />
            </div>
          ))}
        </div>
        <div style={drillingAssayHintStyle}>
          Assay intervals are loaded from drillhole_assays.json; lithology bands
          are loaded from drillhole_lithology.json.
        </div>
      </div>
    </details>
  );
}
