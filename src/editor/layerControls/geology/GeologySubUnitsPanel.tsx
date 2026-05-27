import { useEffect, useState } from "react";
import { useEditor } from "../../EditorContext";
import { panelStyles, vibrancySecondaryLabel, vibrancyTertiaryLabel } from "../../styles";
import type { EditableStyle } from "../../../pages/types";

interface GeologyColorMap {
  [code: string]: string;
}
interface GeologyUnitOverrides {
  [code: string]: { visible?: boolean; opacity?: number };
}

export function GeologySubUnitsPanel({ layerStyle }: { layerStyle: EditableStyle }) {
  const { sceneHandle, setEnvLayerStyle } = useEditor();
  const [units, setUnits] = useState<
    Array<{ code: string; displayName: string; defaultColor: string }>
  >([]);

  // Geology loads asynchronously; poll until the handle's there.
  useEffect(() => {
    let cancelled = false;
    const tryRead = () => {
      if (cancelled) return;
      const g = sceneHandle.manager.getGeology();
      if (g) {
        setUnits(g.units);
        return;
      }
      window.setTimeout(tryRead, 250);
    };
    tryRead();
    return () => {
      cancelled = true;
    };
  }, [sceneHandle]);

  const colorMap = (layerStyle.geologyColorMap as GeologyColorMap) ?? {};
  const overrides =
    (layerStyle.geologyUnitOverrides as GeologyUnitOverrides) ?? {};

  if (units.length === 0) {
    return (
      <details style={{ marginTop: 8 }}>
        <summary style={{ ...panelStyles.muted, cursor: "pointer" }}>
          Sub-units (loading…)
        </summary>
      </details>
    );
  }

  const setUnitColor = (code: string, hex: string) => {
    const next: GeologyColorMap = { ...colorMap, [code]: hex };
    setEnvLayerStyle("bedrock-geology", { geologyColorMap: next });
  };
  const clearUnitColor = (code: string) => {
    const next: GeologyColorMap = { ...colorMap };
    delete next[code];
    setEnvLayerStyle("bedrock-geology", { geologyColorMap: next });
  };
  const setUnitVisible = (code: string, visible: boolean) => {
    const cur = overrides[code] ?? {};
    const next: GeologyUnitOverrides = {
      ...overrides,
      [code]: { ...cur, visible },
    };
    setEnvLayerStyle("bedrock-geology", { geologyUnitOverrides: next });
  };

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ ...panelStyles.muted, cursor: "pointer" }}>
        Sub-units ({units.length})
      </summary>
      <div style={{ marginTop: 6 }}>
        {units.map((u) => {
          const visible = overrides[u.code]?.visible !== false;
          const color = colorMap[u.code] ?? u.defaultColor;
          const overridden = colorMap[u.code] !== undefined;
          return (
            <div
              key={u.code}
              style={{
                ...panelStyles.row,
                gap: 6,
                marginBottom: 3,
              }}
              title={u.displayName}
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setUnitVisible(u.code, e.target.checked)}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setUnitColor(u.code, e.target.value)}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: visible
                    ? vibrancySecondaryLabel
                    : vibrancyTertiaryLabel,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {u.displayName}
              </span>
              {overridden && (
                <button
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "0 6px",
                    fontSize: 10,
                  }}
                  onClick={() => clearUnitColor(u.code)}
                  title="Revert to BCGS canonical colour"
                >
                  ↺
                </button>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
