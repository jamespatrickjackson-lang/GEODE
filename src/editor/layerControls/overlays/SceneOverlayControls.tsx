import { useState } from "react";
import type React from "react";
import { panelStyles, vibrancyLabel, vibrancySecondaryLabel } from "../../styles";
import { useEditor } from "../../EditorContext";
import { writeFile } from "../../save";
import type { PresentationPage, SceneOverlayDef } from "../../../pages/types";

const CLASSIFICATIONS_OVERLAY = [
  "observation",
  "interpretation",
  "narrative",
  "planned",
] as const;

export function SceneOverlayRow({
  id,
  isEnv,
  currentPage,
}: {
  id: string;
  isEnv: boolean;
  currentPage: PresentationPage | null;
}) {
  const {
    state,
    setEnvSceneOverlayField,
    setEnvSceneOverlayProvenance,
    setPageSceneOverlay,
    removePageSceneOverlay,
    removeEnvSceneOverlay,
  } = useEditor();
  const def = state.environment.sceneOverlays?.[id];
  if (!def) return null;
  const enabled = def.enabled !== false;
  const envDefault = def.defaultOpacity ?? 0.85;
  const envTint = def.tint ?? "#ffffff";
  const ref = currentPage?.sceneOverlays?.find((r) => r.id === id);
  const onThisPage = !!ref && ref.visible !== false;
  const hasOpacityOverride = !!ref && typeof ref.opacity === "number";
  const hasTintOverride = !!ref && typeof ref.tint === "string";
  const effOpacity = ref?.opacity ?? envDefault;
  const effTint = ref?.tint ?? envTint;

  return (
    <div style={panelStyles.section}>
      <div style={panelStyles.sectionHeader}>
        <span style={panelStyles.layerLabel}>{def.label}</span>
        <span style={panelStyles.layerType}>
          {def.provenance.classification}
        </span>
        {isEnv && (
          <button
            style={{
              ...panelStyles.iconButton,
              marginLeft: 6,
            }}
            onClick={() => {
              if (
                confirm(
                  `Remove scene overlay "${def.label}"? Page references will be stripped.`,
                )
              ) {
                removeEnvSceneOverlay(id);
              }
            }}
            title="Remove this scene overlay from the environment"
          >
            ×
          </button>
        )}
      </div>

      {/* Visibility row */}
      <div style={panelStyles.row}>
        <label
          style={{
            ...panelStyles.checkboxRow,
            cursor: !isEnv && !currentPage ? "default" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={isEnv ? enabled : onThisPage}
            disabled={!isEnv && !currentPage}
            onChange={(e) => {
              if (isEnv) {
                setEnvSceneOverlayField(id, { enabled: e.target.checked });
              } else if (currentPage) {
                if (e.target.checked) {
                  setPageSceneOverlay(currentPage.id, id, { visible: true });
                } else {
                  removePageSceneOverlay(currentPage.id, id);
                }
              }
            }}
          />
          <span style={panelStyles.fieldLabel}>
            {isEnv ? "Enabled" : "Show on this page"}
          </span>
        </label>
      </div>

      {/* Opacity row */}
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Opacity</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isEnv ? envDefault : effOpacity}
          disabled={isEnv ? !enabled : !onThisPage}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isEnv) {
              setEnvSceneOverlayField(id, { defaultOpacity: v });
            } else if (currentPage) {
              setPageSceneOverlay(currentPage.id, id, { opacity: v });
            }
          }}
          style={{ flex: 1 }}
        />
        <span style={panelStyles.numberReadout}>
          {(isEnv ? envDefault : effOpacity).toFixed(2)}
        </span>
      </div>

      {/* Page mode: env-default hint + revert affordance */}
      {!isEnv && currentPage && onThisPage && (
        <div
          style={{
            ...panelStyles.muted,
            fontSize: 11,
            marginTop: -4,
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>env default: {envDefault.toFixed(2)}</span>
          {hasOpacityOverride && (
            <button
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "0 8px",
                fontSize: 11,
              }}
              onClick={() =>
                setPageSceneOverlay(currentPage.id, id, {
                  opacity: undefined,
                })
              }
              title="Drop the per-page opacity override"
            >
              revert
            </button>
          )}
        </div>
      )}

      {/* Tint row -- multiplies against the texture in the shader.
          White = no tint. Env mode edits def.tint; page mode edits
          ref.tint with revert-to-env affordance. */}
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Tint</label>
        <input
          type="color"
          value={isEnv ? envTint : effTint}
          disabled={isEnv ? !enabled : !onThisPage}
          onChange={(e) => {
            const v = e.target.value;
            if (isEnv) {
              setEnvSceneOverlayField(id, { tint: v });
            } else if (currentPage) {
              setPageSceneOverlay(currentPage.id, id, { tint: v });
            }
          }}
        />
        {!isEnv && currentPage && onThisPage && hasTintOverride && (
          <button
            style={{
              ...panelStyles.iconButton,
              width: "auto",
              padding: "0 8px",
              fontSize: 11,
              marginLeft: 6,
            }}
            onClick={() =>
              setPageSceneOverlay(currentPage.id, id, { tint: undefined })
            }
            title="Drop the per-page tint override"
          >
            revert
          </button>
        )}
      </div>

      {/* Env mode: provenance details */}
      {isEnv && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ ...panelStyles.muted, cursor: "pointer" }}>
            Provenance
          </summary>
          <div style={{ marginTop: 6 }}>
            <div style={panelStyles.row}>
              <label style={panelStyles.fieldLabel}>Source</label>
              <input
                type="text"
                value={def.provenance.source}
                onChange={(e) =>
                  setEnvSceneOverlayProvenance(id, {
                    source: e.target.value,
                  })
                }
                style={panelStyles.textInput}
              />
            </div>
            <div style={panelStyles.row}>
              <label style={panelStyles.fieldLabel}>Classification</label>
              <select
                value={def.provenance.classification}
                onChange={(e) =>
                  setEnvSceneOverlayProvenance(id, {
                    classification: e.target
                      .value as (typeof CLASSIFICATIONS_OVERLAY)[number],
                  })
                }
              >
                {CLASSIFICATIONS_OVERLAY.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={panelStyles.row}>
              <label style={panelStyles.fieldLabel}>Notes</label>
              <textarea
                value={def.provenance.notes ?? ""}
                onChange={(e) =>
                  setEnvSceneOverlayProvenance(id, { notes: e.target.value })
                }
                style={{ ...panelStyles.textInput, minHeight: 60 }}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

// ----- env-mode rows --------------------------------------------------------


function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}

function slugifyId(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "overlay"
  );
}

export function AddSceneOverlayForm() {
  const { state, addEnvSceneOverlay } = useEditor();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [classification, setClassification] =
    useState<SceneOverlayDef["provenance"]["classification"]>("interpretation");
  const [source, setSource] = useState("");
  const [bounds, setBounds] = useState({
    minE: "608500",
    minN: "5788170",
    maxE: "613500",
    maxN: "5790830",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setSource("");
    setClassification("interpretation");
    setBounds({
      minE: "608500",
      minN: "5788170",
      maxE: "613500",
      maxN: "5790830",
    });
    setError(null);
    setBusy(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!label.trim()) {
      setError("Set a label before uploading.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = slugifyId(label);
      if (state.environment.sceneOverlays?.[id]) {
        throw new Error(`an overlay with id "${id}" already exists`);
      }
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${state.projectRoot}/overlays-source/${fileName}`;
      await writeFile(path, b64, { encoding: "base64" });

      const minE = parseFloat(bounds.minE);
      const minN = parseFloat(bounds.minN);
      const maxE = parseFloat(bounds.maxE);
      const maxN = parseFloat(bounds.maxN);
      if (
        !Number.isFinite(minE) ||
        !Number.isFinite(minN) ||
        !Number.isFinite(maxE) ||
        !Number.isFinite(maxN)
      ) {
        throw new Error("bounds must be four numbers");
      }

      const def: SceneOverlayDef = {
        path,
        bounds: [minE, minN, maxE, maxN],
        liftMeters: 8,
        defaultOpacity: 0.85,
        label: label.trim(),
        provenance: {
          source: source.trim() || label.trim(),
          classification,
          notes: "Added via editor; refine bounds by dragging in 3D viewport.",
        },
      };
      await addEnvSceneOverlay(id, def);
      reset();
      setOpen(false);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
      // Reset the file input so the same file can be re-picked after a fix.
      if (e.target) e.target.value = "";
    }
  };

  if (!open) {
    return (
      <button
        style={{
          ...panelStyles.iconButton,
          width: "auto",
          padding: "6px 12px",
          fontSize: 12,
          marginTop: 8,
        }}
        onClick={() => setOpen(true)}
      >
        + Add scene overlay
      </button>
    );
  }

  return (
    <div style={{ ...panelStyles.section, marginTop: 8 }}>
      <div style={panelStyles.sectionHeader}>
        <span style={panelStyles.layerLabel}>New scene overlay</span>
        <button
          style={panelStyles.iconButton}
          onClick={() => {
            reset();
            setOpen(false);
          }}
          title="Cancel"
        >
          ×
        </button>
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={panelStyles.textInput}
          placeholder="e.g. Vizsla cross-section B-B'"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Source</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={panelStyles.textInput}
          placeholder="e.g. Vizsla Copper investor figure 4"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Classification</label>
        <select
          value={classification}
          onChange={(e) =>
            setClassification(
              e.target.value as SceneOverlayDef["provenance"]["classification"],
            )
          }
        >
          <option value="observation">observation</option>
          <option value="interpretation">interpretation</option>
          <option value="narrative">narrative</option>
          <option value="planned">planned</option>
        </select>
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Bounds (E,N)</label>
        <input
          type="number"
          value={bounds.minE}
          onChange={(e) => setBounds({ ...bounds, minE: e.target.value })}
          style={{ ...panelStyles.textInput, width: 76 }}
          title="min easting"
        />
        <input
          type="number"
          value={bounds.minN}
          onChange={(e) => setBounds({ ...bounds, minN: e.target.value })}
          style={{ ...panelStyles.textInput, width: 84 }}
          title="min northing"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>...</label>
        <input
          type="number"
          value={bounds.maxE}
          onChange={(e) => setBounds({ ...bounds, maxE: e.target.value })}
          style={{ ...panelStyles.textInput, width: 76 }}
          title="max easting"
        />
        <input
          type="number"
          value={bounds.maxN}
          onChange={(e) => setBounds({ ...bounds, maxN: e.target.value })}
          style={{ ...panelStyles.textInput, width: 84 }}
          title="max northing"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          disabled={busy}
          style={{ color: vibrancySecondaryLabel, fontSize: 12 }}
        />
      </div>
      {busy && (
        <div style={panelStyles.muted}>Uploading + loading texture…</div>
      )}
      {error && (
        <div
          style={{
            ...panelStyles.muted,
            color: vibrancyLabel,
            fontStyle: "normal",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
