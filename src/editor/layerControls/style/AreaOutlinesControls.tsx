import type React from "react";
import { panelStyles } from "../../styles";
import {
  detailsContentStyle,
  drillingAssayDetailsStyle,
  drillingAssaySummaryStyle,
  EnvSelectRow,
  EnvStyleRow,
  EzGammaCheckboxRow,
} from "../../styleControls";
import type { AreaOutlineDef } from "../../../pages/types";
import { LABEL_KIND_OPTIONS } from "../labelKindOptions";
import { EnvTextRow } from "./StyleControls";

const AREA_OUTLINE_MODE_OPTIONS = [
  { value: "terrain3d", label: "3D terrain" },
  { value: "flat2d", label: "2D flat" },
] as const;

const areaOutlineButtonStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  margin: "6px 0 10px",
};

const ezGammaControlsStyle: React.CSSProperties = {
  marginTop: 10,
};

export function AreaOutlinesControls({
  outlines,
  viewCenter,
  onChange,
}: {
  outlines: AreaOutlineDef[];
  viewCenter: [number, number];
  onChange: (outlines: AreaOutlineDef[]) => void;
}) {
  const updateOutline = (id: string, patch: Partial<AreaOutlineDef>) => {
    onChange(
      outlines.map((outline) =>
        outline.id === id ? { ...outline, ...patch } : outline,
      ),
    );
  };
  const addOutline = () => {
    const index = outlines.length + 1;
    const id = `area-outline-${Date.now().toString(36)}`;
    onChange([
      ...outlines,
      {
        id,
        label: `Area outline ${index}`,
        center: viewCenter,
        radiusX: 850,
        radiusY: 520,
        rotationDeg: 0,
        liftMeters: 18,
        fillVisible: true,
        fillColor: "#ff8a3d",
        fillOpacity: 0.18,
        outlineVisible: true,
        outlineColor: "#ff8a3d",
        outlineOpacity: 0.95,
        outlineWidthM: 14,
        dashed: true,
        outlineMode: "terrain3d",
        dashLengthM: 170,
        dashGapM: 90,
        labelKind: "area",
      },
    ]);
  };
  const duplicateOutline = (source: AreaOutlineDef, index: number) => {
    const center = source.center ?? viewCenter;
    onChange([
      ...outlines.slice(0, index + 1),
      {
        ...source,
        id: `area-outline-${Date.now().toString(36)}`,
        label: `${source.label || `Area outline ${index + 1}`} duplicate`,
        center: [center[0] + 80, center[1] + 80],
      },
      ...outlines.slice(index + 1),
    ]);
  };
  const removeOutline = (id: string) => {
    onChange(outlines.filter((outline) => outline.id !== id));
  };

  return (
    <div style={ezGammaControlsStyle}>
      <div style={areaOutlineButtonStackStyle}>
        <button
          type="button"
          className="editor-action-button"
          style={panelStyles.button}
          onClick={addOutline}
        >
          Add outline
        </button>
      </div>
      {outlines.length === 0 ? (
        <p style={panelStyles.helpText}>
          Add an outline to rough in a boundary as a ground-parallel ellipse.
        </p>
      ) : null}
      {outlines.map((outline, index) => (
        <details key={outline.id} style={drillingAssayDetailsStyle}>
          <summary style={drillingAssaySummaryStyle}>
            {outline.label || `Area outline ${index + 1}`}
          </summary>
          <div style={detailsContentStyle}>
            <EnvTextRow
              label="Name"
              value={outline.label}
              onChange={(value) => updateOutline(outline.id, { label: value })}
            />
            <EnvStyleRow
              label="Center E"
              inputType="number"
              value={String(Math.round(outline.center?.[0] ?? viewCenter[0]))}
              step={10}
              onChange={(value) => {
                const next = [...(outline.center ?? viewCenter)] as [
                  number,
                  number,
                ];
                next[0] = parseFloat(value);
                updateOutline(outline.id, { center: next });
              }}
            />
            <EnvStyleRow
              label="Center N"
              inputType="number"
              value={String(Math.round(outline.center?.[1] ?? viewCenter[1]))}
              step={10}
              onChange={(value) => {
                const next = [...(outline.center ?? viewCenter)] as [
                  number,
                  number,
                ];
                next[1] = parseFloat(value);
                updateOutline(outline.id, { center: next });
              }}
            />
            <div style={areaOutlineButtonStackStyle}>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() =>
                  updateOutline(outline.id, { center: viewCenter })
                }
              >
                Move center
              </button>
            </div>
            <EnvStyleRow
              label="Width X"
              inputType="range"
              value={String(outline.radiusX ?? 850)}
              min={50}
              max={5000}
              step={25}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { radiusX: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Width Y"
              inputType="range"
              value={String(outline.radiusY ?? 520)}
              min={50}
              max={5000}
              step={25}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { radiusY: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Rotation"
              inputType="range"
              value={String(outline.rotationDeg ?? 0)}
              min={-180}
              max={180}
              step={1}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { rotationDeg: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Lift"
              inputType="range"
              value={String(outline.liftMeters ?? 18)}
              min={0}
              max={120}
              step={1}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { liftMeters: parseFloat(value) })
              }
            />
            <EnvSelectRow
              label="Line mode"
              value={outline.outlineMode ?? "terrain3d"}
              options={AREA_OUTLINE_MODE_OPTIONS}
              onChange={(value) =>
                updateOutline(outline.id, { outlineMode: value })
              }
            />

            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Infill</summary>
              <div style={detailsContentStyle}>
                <EzGammaCheckboxRow
                  label="Visible"
                  checked={outline.fillVisible !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { fillVisible: checked })
                  }
                />
                <EnvStyleRow
                  label="Color"
                  inputType="color"
                  value={outline.fillColor ?? "#ff8a3d"}
                  onChange={(value) =>
                    updateOutline(outline.id, { fillColor: value })
                  }
                />
                <EnvStyleRow
                  label="Alpha"
                  inputType="range"
                  value={String(outline.fillOpacity ?? 0.18)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      fillOpacity: parseFloat(value),
                    })
                  }
                />
              </div>
            </details>

            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Outline</summary>
              <div style={detailsContentStyle}>
                <EzGammaCheckboxRow
                  label="Visible"
                  checked={outline.outlineVisible !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { outlineVisible: checked })
                  }
                />
                <EnvStyleRow
                  label="Color"
                  inputType="color"
                  value={outline.outlineColor ?? "#ff8a3d"}
                  onChange={(value) =>
                    updateOutline(outline.id, { outlineColor: value })
                  }
                />
                <EnvStyleRow
                  label="Alpha"
                  inputType="range"
                  value={String(outline.outlineOpacity ?? 0.95)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      outlineOpacity: parseFloat(value),
                    })
                  }
                />
                <EnvStyleRow
                  label="Width"
                  inputType="range"
                  value={String(outline.outlineWidthM ?? 14)}
                  min={1}
                  max={80}
                  step={1}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      outlineWidthM: parseFloat(value),
                    })
                  }
                />
                <EzGammaCheckboxRow
                  label="Dashed"
                  checked={outline.dashed !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { dashed: checked })
                  }
                />
                <EnvStyleRow
                  label="Dash len."
                  inputType="range"
                  value={String(outline.dashLengthM ?? 170)}
                  min={10}
                  max={900}
                  step={10}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      dashLengthM: parseFloat(value),
                    })
                  }
                />
                <EnvStyleRow
                  label="Dash gap"
                  inputType="range"
                  value={String(outline.dashGapM ?? 90)}
                  min={0}
                  max={600}
                  step={10}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      dashGapM: parseFloat(value),
                    })
                  }
                />
              </div>
            </details>

            <EnvSelectRow
              label="Label style"
              value={outline.labelKind ?? "area"}
              options={LABEL_KIND_OPTIONS}
              onChange={(value) =>
                updateOutline(outline.id, {
                  labelKind: value as AreaOutlineDef["labelKind"],
                })
              }
            />
            <div style={areaOutlineButtonStackStyle}>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() => duplicateOutline(outline, index)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() => removeOutline(outline.id)}
              >
                Remove
              </button>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
