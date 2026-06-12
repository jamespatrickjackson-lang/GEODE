import { vibrancyTertiaryLabel } from "../../styles";
import {
  EditorCompactSegmentedRow,
  nestedControlRowStyle,
  nestedFieldLabelStyle,
  OverrideStateIndicator,
} from "../../styleControls";
import type { EditableStyle } from "../../../pages/types";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";
import type {
  SeismicProductOption,
  SeismicRequiredProductSourceGate,
} from "./seismicModel";
import { SEISMIC_VERTICAL_DATUM_MODE_OPTIONS } from "./seismicModel";

type ActiveSeismicPreset = {
  label?: string;
  provenanceClassification?: string;
  provenanceNote?: string;
};

function countBySurveyKind(products: SeismicProductOption[]): string {
  const counts = products.reduce<Record<string, number>>((acc, product) => {
    const key = product.surveyKind ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return [
    counts["3d"] ? `3D ${counts["3d"]}` : null,
    counts["2d"] ? `2D ${counts["2d"]}` : null,
    counts["legacy-2d"] ? `legacy ${counts["legacy-2d"]}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function placementLabel(product: SeismicProductOption | undefined): string {
  const placement = product?.navigationPlacement;
  if (!placement) return "registration metadata unavailable";
  if (placement.canClaimPreciseRegistration === true) {
    return placement.statusLabel ?? "trace/header registration available";
  }
  return placement.statusLabel ?? placement.reason ?? "registration caveat required";
}

function sourceGateLabel(gates: SeismicRequiredProductSourceGate[]): string {
  if (gates.length === 0) return "all required source products renderable";
  const first = gates[0];
  return `${first.filename ?? first.label} / ${first.status ?? "source-gated"}`;
}

export function SeismicSourceAndRegistrationControls({
  products,
  selectedProduct,
  visibleProductCount,
  raymarchProductCount,
  sourceGatedProducts,
  currentCapabilityPresetId,
  activePreset,
  renderMode,
  verticalDatumMode,
  onSetVerticalDatumMode,
  layerVisible,
  onSetLayerVisible,
  isEnv,
  overridden,
  onToggleOverride,
  disabled,
  controlOpacity,
}: {
  products: SeismicProductOption[];
  selectedProduct: SeismicProductOption | undefined;
  visibleProductCount: number;
  raymarchProductCount: number;
  sourceGatedProducts: SeismicRequiredProductSourceGate[];
  currentCapabilityPresetId: string;
  activePreset?: ActiveSeismicPreset;
  renderMode: "slice" | "raymarch";
  verticalDatumMode: NonNullable<EditableStyle["seismicVerticalDatumMode"]>;
  onSetVerticalDatumMode: (
    value: NonNullable<EditableStyle["seismicVerticalDatumMode"]>,
  ) => void;
  layerVisible: boolean;
  onSetLayerVisible: (visible: boolean) => void;
  isEnv: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  disabled: boolean;
  controlOpacity: number;
}) {
  return (
    <SeismicCapabilityLayerItem
      testId="seismic-source-registration"
      title="Source and registration"
      type="metadata"
      visible={layerVisible}
      visibilityDisabled={disabled}
      onVisibleChange={onSetLayerVisible}
    >
      <div
        style={{
          color: vibrancyTertiaryLabel,
          fontSize: 11,
          lineHeight: 1.35,
          opacity: controlOpacity,
        }}
      >
        {!isEnv ? (
          <div style={nestedControlRowStyle}>
            <span style={nestedFieldLabelStyle}>Controls</span>
            <input
              type="checkbox"
              checked={overridden}
              onChange={(e) => onToggleOverride?.(e.target.checked)}
              title="Override environment seismic browser variables for this page"
            />
            <span style={{ flex: 1 }}>
              {overridden ? "page override active" : "using environment defaults"}
            </span>
            <OverrideStateIndicator active={overridden} />
          </div>
        ) : null}
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Products</span>
          <span style={{ flex: 1 }}>
            {visibleProductCount}/{products.length} visible /{" "}
            {countBySurveyKind(products)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>3D volumes</span>
          <span style={{ flex: 1 }}>{raymarchProductCount} raymarch capable</span>
        </div>
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Selected</span>
          <span style={{ flex: 1 }}>
            {selectedProduct?.lineLabel ?? "line"} /{" "}
            {selectedProduct?.productKind ?? "product"} /{" "}
            {selectedProduct?.domainUnit ?? "domain"}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Source</span>
          <span style={{ flex: 1 }}>
            {selectedProduct?.sourceSubmission ?? "source record unavailable"}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Placement</span>
          <span style={{ flex: 1 }}>{placementLabel(selectedProduct)}</span>
        </div>
        <EditorCompactSegmentedRow
          label="Vertical datum"
          value={verticalDatumMode}
          testId="seismic-vertical-datum-mode-select"
          disabled={disabled}
          controlOpacity={controlOpacity}
          options={SEISMIC_VERTICAL_DATUM_MODE_OPTIONS}
          onChange={onSetVerticalDatumMode}
        />
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Render</span>
          <span style={{ flex: 1 }}>
            {renderMode} / {currentCapabilityPresetId || "manual controls"}
          </span>
        </div>
        {activePreset?.label ? (
          <div style={nestedControlRowStyle}>
            <span style={nestedFieldLabelStyle}>Preset</span>
            <span style={{ flex: 1 }}>{activePreset?.label}</span>
          </div>
        ) : null}
        {activePreset?.provenanceClassification ? (
          <div style={nestedControlRowStyle}>
            <span style={nestedFieldLabelStyle}>Provenance</span>
            <span style={{ flex: 1 }}>
              {activePreset.provenanceClassification}
            </span>
          </div>
        ) : null}
        {activePreset?.provenanceNote ? (
          <div style={nestedControlRowStyle}>
            <span style={nestedFieldLabelStyle}>Note</span>
            <span style={{ flex: 1 }}>{activePreset?.provenanceNote}</span>
          </div>
        ) : null}
        <div style={nestedControlRowStyle}>
          <span style={nestedFieldLabelStyle}>Gate</span>
          <span style={{ flex: 1 }}>{sourceGateLabel(sourceGatedProducts)}</span>
        </div>
      </div>
    </SeismicCapabilityLayerItem>
  );
}
