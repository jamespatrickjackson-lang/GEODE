import { useState } from "react";
import type React from "react";
import { panelStyles, vibrancyLabel, vibrancyTertiaryLabel } from "../../styles";
import { EditorEyeButton } from "../../styleControls";
import { layerControlsStyle, layerItemStyle } from "../layout/layoutStyles";

interface SeismicCapabilityLayerItemProps {
  title: string;
  type?: string;
  testId: string;
  inactive?: boolean;
  visible: boolean;
  visibilityDisabled?: boolean;
  visibilityTestId?: string;
  onVisibleChange: (visible: boolean) => void;
  children: React.ReactNode;
}

export function SeismicCapabilityLayerItem({
  title,
  testId,
  inactive = false,
  visible,
  visibilityDisabled = false,
  visibilityTestId,
  onVisibleChange,
  children,
}: SeismicCapabilityLayerItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-testid={testId}
      style={layerItemStyle}
      data-dev-note="Virtual seismic capability container. Controls patch the one real Utah FORGE seismic layer."
    >
      <div style={panelStyles.sectionHeader}>
        <button
          type="button"
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            display: "flex",
            flex: "1 1 auto",
            font: "inherit",
            minWidth: 0,
            padding: 0,
            textAlign: "left",
          }}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
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
        </button>
        <EditorEyeButton
          testId={visibilityTestId ?? `${testId}-visible`}
          visible={visible}
          disabled={visibilityDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onVisibleChange(!visible);
          }}
          title={visible ? `Hide ${title}` : `Show ${title}`}
          ariaLabel={visible ? `Hide ${title}` : `Show ${title}`}
          style={{ background: "transparent" }}
        />
      </div>
      {open ? <div style={layerControlsStyle}>{children}</div> : null}
    </div>
  );
}
