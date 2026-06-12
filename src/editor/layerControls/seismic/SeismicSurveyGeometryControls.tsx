import type { EditableStyle } from "../../../pages/types";
import { panelStyles } from "../../styles";
import {
  nestedControlRowStyle,
  nestedFieldLabelStyle,
} from "../../styleControls";
import { SeismicCapabilityLayerItem } from "./SeismicCapabilityLayerItem";

type SeismicNavigationRole = "sources" | "receivers" | "lines";

export function SeismicSurveyGeometryControls({
  navigationVisible,
  navigationSourcesVisible,
  navigationReceiversVisible,
  navigationLinesVisible,
  disabled,
  controlOpacity,
  commit,
  setNavigationRoleVisible,
  applyCapabilityPreset,
}: {
  navigationVisible: boolean;
  navigationSourcesVisible: boolean;
  navigationReceiversVisible: boolean;
  navigationLinesVisible: boolean;
  disabled: boolean;
  controlOpacity: number;
  commit: (patch: Partial<EditableStyle>) => void;
  setNavigationRoleVisible: (
    role: SeismicNavigationRole,
    visible: boolean,
  ) => void;
  applyCapabilityPreset: (presetId: string) => void;
}) {
  return (
    <SeismicCapabilityLayerItem
      testId="seismic-capability-survey-geometry"
      title="Seismic survey geometry"
      type="navigation"
      visible={navigationVisible}
      visibilityDisabled={disabled}
      onVisibleChange={(visible) =>
        commit({ seismicNavigationVisible: visible })
      }
    >
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Navigation</span>
        <input
          data-testid="seismic-navigation-visible-capability"
          type="checkbox"
          checked={navigationVisible}
          disabled={disabled}
          onChange={(e) =>
            commit({ seismicNavigationVisible: e.target.checked })
          }
          style={{ opacity: controlOpacity }}
        />
        <span style={{ flex: 1 }} />
      </label>
      <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
        <label style={nestedFieldLabelStyle}>Preset</label>
        <button
          type="button"
          data-testid="seismic-capability-survey-geometry-preset"
          disabled={disabled}
          onClick={() => applyCapabilityPreset("survey-geometry")}
          style={{
            ...panelStyles.iconButton,
            width: "auto",
            padding: "3px 7px",
            fontSize: 10,
            opacity: controlOpacity,
          }}
        >
          Show survey
        </button>
      </div>
      {[
        {
          role: "sources" as const,
          label: "Shot/source points",
          checked: navigationSourcesVisible,
        },
        {
          role: "receivers" as const,
          label: "Receivers",
          checked: navigationReceiversVisible,
        },
        {
          role: "lines" as const,
          label: "Survey lines",
          checked: navigationLinesVisible,
        },
      ].map((item) => (
        <label
          key={item.role}
          style={{ ...nestedControlRowStyle, cursor: "pointer" }}
        >
          <span style={nestedFieldLabelStyle}>{item.label}</span>
          <input
            data-testid={`seismic-navigation-role-${item.role}`}
            type="checkbox"
            checked={item.checked}
            disabled={disabled}
            onChange={(e) =>
              setNavigationRoleVisible(item.role, e.target.checked)
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
      ))}
    </SeismicCapabilityLayerItem>
  );
}
