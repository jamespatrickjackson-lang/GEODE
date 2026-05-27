import type React from "react";
import { panelStyles, vibrancyLabel, vibrancySecondaryLabel, vibrancyTertiaryLabel } from "../../styles";
import { layerControlsStyle, layerItemStyle } from "../layout/layoutStyles";
export function SeismicCapabilityLayerItem({
  title,
  type,
  testId,
  inactive = false,
  children,
}: {
  title: string;
  type: string;
  testId: string;
  inactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={layerItemStyle}
      data-dev-note="Virtual seismic capability container. Controls patch the one real Utah FORGE seismic layer."
    >
      <div style={panelStyles.sectionHeader}>
        <div style={panelStyles.checkboxRow}>
          <span
            style={{
              ...panelStyles.layerLabel,
              color: inactive ? vibrancyTertiaryLabel : vibrancyLabel,
            }}
          >
            {title}
          </span>
        </div>
        <span
          style={{
            ...panelStyles.layerType,
            color: inactive ? vibrancyTertiaryLabel : vibrancySecondaryLabel,
          }}
        >
          {type}
        </span>
      </div>
      <div style={layerControlsStyle}>{children}</div>
    </div>
  );
}

