import type React from "react";
import { FROSTED_HAIRLINE, vibrancyLabel, vibrancyTertiaryLabel } from "../../styles";
import {
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  overrideTagActiveStyle,
  overrideTagStyle,
  sliderNumberReadoutStyle,
  styleNumber,
  styleString,
} from "../../styleControls";
import type { EditableStyle } from "../../../pages/types";
import { SurfaceGradientColorInput } from "../style/StyleControls";
import { SCALAR_SOURCE_MAX, SCALAR_SOURCE_MIN } from "../scalarSourceRange";

export function ScalarRampControls({
  style,
  targetLabel,
  fullDensityMode = false,
  disabled,
  isPageOverride,
  overridden,
  volumeThresholdMode = false,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  targetLabel: string;
  fullDensityMode?: boolean;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  volumeThresholdMode?: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lowColor = styleString(style, "scalarColorLow", "#2cc9ff");
  const midColor = styleString(style, "scalarColorMid", "#f8dd6d");
  const highColor = styleString(style, "scalarColorHigh", "#ff637a");
  const sourceMin = SCALAR_SOURCE_MIN;
  const sourceMax = SCALAR_SOURCE_MAX;
  const colorMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.01,
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
  );
  const colorMax = Math.min(
    sourceMax,
    Math.max(styleNumber(style, "scalarDisplayMax", 3.937122), colorMin + 0.01),
  );
  const trimMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.01,
      volumeThresholdMode
        ? styleNumber(
            style,
            "scalarVolumeThresholdMin",
            styleNumber(style, "scalarFocusMin", sourceMin),
          )
        : styleNumber(style, "scalarFocusMin", sourceMin),
    ),
  );
  const trimMax = Math.max(
    trimMin + 0.01,
    Math.min(
      sourceMax,
      volumeThresholdMode
        ? styleNumber(
            style,
            "scalarVolumeThresholdMax",
            styleNumber(style, "scalarFocusMax", sourceMax),
          )
        : styleNumber(style, "scalarFocusMax", sourceMax),
    ),
  );
  const blendMin = Math.max(
    trimMin,
    Math.min(trimMax - 0.01, styleNumber(style, "scalarBlendMin", colorMin)),
  );
  const rawBlendMax = styleNumber(style, "scalarBlendMax", colorMax);
  const blendMax = Math.min(trimMax, Math.max(rawBlendMax, blendMin + 0.01));
  const midpoint = Math.max(
    0.05,
    Math.min(0.95, styleNumber(style, "scalarMidpoint", 0.5)),
  );
  const contrast = Math.max(
    0.35,
    Math.min(3, styleNumber(style, "scalarContrast", 1)),
  );
  const midpointFill = Math.max(0, Math.min(100, midpoint * 100));
  const contrastFill = Math.max(
    0,
    Math.min(100, ((contrast - 0.35) / (3 - 0.35)) * 100),
  );
  const inclusionMode =
    fullDensityMode && style.scalarInclusionMode !== "thresholded"
      ? "all-valid"
      : style.scalarInclusionMode === "thresholded"
        ? "thresholded"
        : "all-valid";
  const thresholdControlsVisible = true;
  const controlOpacity = disabled ? 0.4 : 1;
  const sourceRange = Math.max(0.01, sourceMax - sourceMin);
  const blendMinFill = Math.max(
    0,
    Math.min(100, ((blendMin - sourceMin) / sourceRange) * 100),
  );
  const blendMaxFill = Math.max(
    blendMinFill,
    Math.min(100, ((blendMax - sourceMin) / sourceRange) * 100),
  );
  const colorMinFill = Math.max(
    0,
    Math.min(100, ((colorMin - sourceMin) / sourceRange) * 100),
  );
  const colorMaxFill = Math.max(
    colorMinFill,
    Math.min(100, ((colorMax - sourceMin) / sourceRange) * 100),
  );
  const colorMidFill = colorMinFill + (colorMaxFill - colorMinFill) * midpoint;
  const trimMinFill = Math.max(
    0,
    Math.min(100, ((trimMin - sourceMin) / sourceRange) * 100),
  );
  const trimMaxFill = Math.max(
    trimMinFill,
    Math.min(100, ((trimMax - sourceMin) / sourceRange) * 100),
  );
  const valueFill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - sourceMin) / sourceRange) * 100))}%`;
  const spectrumBackground = `linear-gradient(90deg, ${lowColor} 0%, ${lowColor} ${colorMinFill.toFixed(
    1,
  )}%, ${midColor} ${colorMidFill.toFixed(1)}%, ${highColor} ${colorMaxFill.toFixed(
    1,
  )}%, ${highColor} 100%)`;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Target</label>
        <span
          style={{
            flex: 1,
            color: vibrancyLabel,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.3,
            opacity: controlOpacity,
          }}
        >
          Scalar controls target: {targetLabel}
        </span>
      </div>
      {fullDensityMode ? (
        <>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Inclusion</label>
            <select
              value={inclusionMode}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  scalarInclusionMode:
                    e.target.value === "thresholded"
                      ? "thresholded"
                      : "all-valid",
                })
              }
              style={{
                flex: 1,
                opacity: controlOpacity,
              }}
            >
              <option value="all-valid">All valid points</option>
              <option value="thresholded">Threshold/filter points</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mode note</label>
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              {inclusionMode === "thresholded"
                ? "Trim, feather, and noise can filter drawn points."
                : "Trim, feather, and noise change visual emphasis; all valid points stay drawn."}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Surface mask</label>
            <input
              type="checkbox"
              checked={style.scalarSurfaceMaskEnabled !== false}
              disabled={disabled}
              onChange={(e) =>
                onChange({ scalarSurfaceMaskEnabled: e.target.checked })
              }
            />
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mask depth</label>
            <input
              type="range"
              aria-label="MT surface mask depth"
              min={0}
              max={500}
              step={5}
              value={styleNumber(style, "scalarSurfaceMaskDepthM", 25)}
              disabled={disabled || style.scalarSurfaceMaskEnabled === false}
              onChange={(e) =>
                onChange({
                  scalarSurfaceMaskDepthM: parseFloat(e.target.value),
                })
              }
              style={
                {
                  flex: 1,
                  opacity:
                    disabled || style.scalarSurfaceMaskEnabled === false
                      ? 0.4
                      : controlOpacity,
                  "--editor-slider-fill": `${Math.round(
                    (styleNumber(style, "scalarSurfaceMaskDepthM", 25) / 500) *
                      100,
                  )}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {Math.round(styleNumber(style, "scalarSurfaceMaskDepthM", 25))} m
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mask feather</label>
            <input
              type="range"
              aria-label="MT surface mask feather"
              min={0}
              max={1000}
              step={10}
              value={styleNumber(style, "scalarSurfaceMaskFeatherM", 175)}
              disabled={disabled || style.scalarSurfaceMaskEnabled === false}
              onChange={(e) =>
                onChange({
                  scalarSurfaceMaskFeatherM: parseFloat(e.target.value),
                })
              }
              style={
                {
                  flex: 1,
                  opacity:
                    disabled || style.scalarSurfaceMaskEnabled === false
                      ? 0.4
                      : controlOpacity,
                  "--editor-slider-fill": `${Math.round(
                    (styleNumber(style, "scalarSurfaceMaskFeatherM", 175) /
                      1000) *
                      100,
                  )}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {Math.round(styleNumber(style, "scalarSurfaceMaskFeatherM", 175))}{" "}
              m
            </span>
          </div>
        </>
      ) : null}
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Spectrum</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment scalar ramp for this page"
          />
        ) : null}
        <div
          style={{
            flex: 1,
            position: "relative",
            height: 22,
            opacity: controlOpacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 6,
              height: 14,
              borderRadius: 999,
              border: FROSTED_HAIRLINE,
              background: spectrumBackground,
              overflow: "hidden",
            }}
          >
            {thresholdControlsVisible ? (
              <>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${trimMinFill}%`,
                    background: "rgba(0, 0, 0, 0.58)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: `${trimMaxFill}%`,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.58)",
                  }}
                />
                {blendMinFill > trimMinFill ? (
                  <span
                    style={{
                      position: "absolute",
                      left: `${trimMinFill}%`,
                      width: `${blendMinFill - trimMinFill}%`,
                      top: 0,
                      bottom: 0,
                      background:
                        "linear-gradient(90deg, rgba(0, 0, 0, 0.54), rgba(0, 0, 0, 0))",
                    }}
                  />
                ) : null}
                {trimMaxFill > blendMaxFill ? (
                  <span
                    style={{
                      position: "absolute",
                      left: `${blendMaxFill}%`,
                      width: `${trimMaxFill - blendMaxFill}%`,
                      top: 0,
                      bottom: 0,
                      background:
                        "linear-gradient(90deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.54))",
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {thresholdControlsVisible
            ? [trimMinFill, blendMinFill, blendMaxFill, trimMaxFill].map(
                (left, index) => (
                  <span
                    key={`${index}-${left.toFixed(1)}`}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: 0,
                      width: index === 0 || index === 3 ? 7 : 5,
                      height: index === 0 || index === 3 ? 18 : 14,
                      borderRadius: 999,
                      transform: "translateX(-50%)",
                      background:
                        index === 0 || index === 3
                          ? "rgba(255, 255, 255, 0.92)"
                          : "rgba(255, 255, 255, 0.42)",
                      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.45)",
                    }}
                  />
                ),
              )
            : null}
        </div>
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Colors</label>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <SurfaceGradientColorInput
            label="Low"
            value={lowColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ scalarColorLow: value })}
          />
          <SurfaceGradientColorInput
            label="Mid"
            value={midColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ scalarColorMid: value })}
          />
          <SurfaceGradientColorInput
            label="High"
            value={highColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ scalarColorHigh: value })}
          />
        </div>
      </div>
      {thresholdControlsVisible ? (
        <>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {volumeThresholdMode ? "Cut min" : "Trim min"}
            </label>
            <input
              type="range"
              aria-label={
                volumeThresholdMode
                  ? "Scalar volume cut minimum"
                  : "Scalar trim minimum"
              }
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={trimMin}
              disabled={disabled}
              onChange={(e) => {
                const next = Math.min(
                  parseFloat(e.target.value),
                  trimMax - 0.01,
                );
                const nextTrimMin = Math.max(sourceMin, next);
                const nextBlendMin = Math.max(blendMin, nextTrimMin);
                const nextBlendMax = Math.min(
                  trimMax,
                  Math.max(blendMax, nextBlendMin + 0.01),
                );
                onChange({
                  scalarFocusMin: nextTrimMin,
                  ...(volumeThresholdMode
                    ? {
                        scalarVolumeThresholdMin: nextTrimMin,
                        scalarVolumeThresholdMax: trimMax,
                      }
                    : {}),
                  scalarBlendMin: nextBlendMin,
                  scalarBlendMax: nextBlendMax,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${trimMinFill}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{trimMin.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {volumeThresholdMode ? "Cut max" : "Trim max"}
            </label>
            <input
              type="range"
              aria-label={
                volumeThresholdMode
                  ? "Scalar volume cut maximum"
                  : "Scalar trim maximum"
              }
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={trimMax}
              disabled={disabled}
              onChange={(e) => {
                const next = Math.max(
                  parseFloat(e.target.value),
                  trimMin + 0.01,
                );
                const nextTrimMax = Math.min(sourceMax, next);
                const nextBlendMax = Math.min(blendMax, nextTrimMax);
                const nextBlendMin = Math.max(
                  trimMin,
                  Math.min(blendMin, nextBlendMax - 0.01),
                );
                onChange({
                  scalarFocusMax: nextTrimMax,
                  ...(volumeThresholdMode
                    ? {
                        scalarVolumeThresholdMin: trimMin,
                        scalarVolumeThresholdMax: nextTrimMax,
                      }
                    : {}),
                  scalarBlendMin: nextBlendMin,
                  scalarBlendMax: nextBlendMax,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${trimMaxFill}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{trimMax.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Feather min</label>
            <input
              type="range"
              aria-label="Scalar feather minimum"
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={blendMin}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  scalarBlendMin: Math.max(
                    trimMin,
                    Math.min(parseFloat(e.target.value), blendMax - 0.01),
                  ),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": valueFill(blendMin),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{blendMin.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Feather max</label>
            <input
              type="range"
              aria-label="Scalar feather maximum"
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={blendMax}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  scalarBlendMax: Math.min(
                    trimMax,
                    Math.max(parseFloat(e.target.value), blendMin + 0.01),
                  ),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": valueFill(blendMax),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{blendMax.toFixed(2)}</span>
          </div>
          {fullDensityMode ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Noise</label>
              <input
                type="range"
                aria-label="Scalar noise threshold"
                min={0}
                max={1}
                step={0.01}
                value={styleNumber(style, "scalarNoiseThreshold", 0)}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ scalarNoiseThreshold: parseFloat(e.target.value) })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${Math.round(
                      styleNumber(style, "scalarNoiseThreshold", 0) * 100,
                    )}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>
                {Math.round(
                  styleNumber(style, "scalarNoiseThreshold", 0) * 100,
                )}
                %
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Trim</label>
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              lineHeight: 1.35,
              opacity: controlOpacity,
            }}
          >
            All-valid mode draws every valid source point. Trim, feather, and
            noise controls are available in Threshold/filter points mode.
          </span>
        </div>
      )}
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Midpoint</label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={midpoint}
          disabled={disabled}
          onChange={(e) =>
            onChange({ scalarMidpoint: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${midpointFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{midpoint.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Nuance</label>
        <input
          type="range"
          min={0.35}
          max={3}
          step={0.05}
          value={contrast}
          disabled={disabled}
          onChange={(e) =>
            onChange({ scalarContrast: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${contrastFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{contrast.toFixed(2)}</span>
      </div>
    </>
  );
}

