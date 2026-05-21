import { useCallback, useEffect } from "react";
import type * as THREE from "three";
import { useEditor } from "../editor/EditorContext";
import { usePageController } from "../pages/PageController";
import type { SceneHandle } from "../scene";
import {
  type AudienceLensConfig,
  type AudienceLensId,
} from "./audienceLenses";
import {
  CASE_STUDY_B_AUDIENCE_LENSES,
  audienceLensById,
} from "../projectModules/caseStudyB/audienceLenses";
import {
  FROSTED_CONTROL_SHADOW,
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "../editor/styles";
import {
  CASE_STUDY_B_SLUG,
  CASE_STUDY_B_DEMO_SHELL_LAYER_ID as DEMO_SHELL_LAYER_ID,
} from "../projectModules/caseStudyB/layerIds";

interface Props {
  sceneHandle: SceneHandle;
  activeLens: AudienceLensId;
  onLensChange: (lens: AudienceLensId) => void;
  mode?: "bar" | "floating" | "hidden";
}

export function AudienceLensControls({
  sceneHandle,
  activeLens,
  onLensChange,
  mode = "bar",
}: Props) {
  const { state } = useEditor();
  const { currentIndex, goto } = usePageController();
  const isCaseStudyB = state.projectSlug === CASE_STUDY_B_SLUG;
  const lens = audienceLensById(activeLens);

  useEffect(() => {
    if (!isCaseStudyB) return;
    applyZoneEmphasis(sceneHandle, lens);
  }, [isCaseStudyB, lens, sceneHandle]);

  const selectLens = useCallback(
    (nextId: AudienceLensId) => {
      const nextLens = audienceLensById(nextId);
      onLensChange(nextId);
      const targetIndex = state.pages.findIndex(
        (page) => page.id === nextLens.targetPageId,
      );
      if (targetIndex >= 0 && targetIndex !== currentIndex) {
        goto(targetIndex);
      }
    },
    [currentIndex, goto, onLensChange, state.pages],
  );

  if (!isCaseStudyB || mode === "hidden") return null;

  return (
    <div
      style={mode === "floating" ? floatingRootStyle : barRootStyle}
      aria-label="Audience lens controls"
    >
      <div style={buttonGroupStyle}>
        {CASE_STUDY_B_AUDIENCE_LENSES.map((item) => {
          const active = item.id === activeLens;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectLens(item.id)}
              title={item.summary}
              aria-pressed={active}
              style={{
                ...buttonStyle,
                ...(active ? activeButtonStyle : null),
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function applyZoneEmphasis(
  sceneHandle: SceneHandle,
  lens: AudienceLensConfig,
): void {
  const layer = sceneHandle.manager.getLayer(DEMO_SHELL_LAYER_ID);
  if (!layer) return;

  layer.traverse((obj) => {
    const zoneId =
      typeof obj.userData?.demoZoneId === "string"
        ? obj.userData.demoZoneId
        : null;
    if (!zoneId) return;

    const emphasis = lens.zoneOpacity[zoneId] ?? 1;

    for (const material of materialsForObject(obj)) {
      if (typeof material.userData.demoBaseOpacity !== "number") {
        material.userData.demoBaseOpacity = material.opacity;
      }
      const baseOpacity = material.userData.demoBaseOpacity;
      material.opacity = clamp01(baseOpacity * emphasis);
      material.transparent =
        material.opacity < 1 || material.userData.forceTransparent === true;
      material.needsUpdate = true;
    }
  });
}

function materialsForObject(obj: THREE.Object3D): Array<THREE.Material> {
  const maybeMaterial = (obj as { material?: THREE.Material | THREE.Material[] })
    .material;
  if (!maybeMaterial) return [];
  return Array.isArray(maybeMaterial) ? maybeMaterial : [maybeMaterial];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const barRootStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 14px",
  borderTop: FROSTED_HAIRLINE,
  borderBottom: FROSTED_HAIRLINE,
  background: "rgba(18, 21, 24, 0.55)",
  flex: "none",
};

const floatingRootStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 92,
  transform: "translateX(-50%)",
  zIndex: 36,
  display: "flex",
  alignItems: "center",
  padding: "8px 10px",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: 999,
  background: "rgba(18, 21, 24, 0.72)",
  color: vibrancyLabel,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
  backdropFilter: "blur(18px) saturate(140%)",
  WebkitBackdropFilter: "blur(18px) saturate(140%)",
  fontFamily: TECHNICAL_MONO_FONT,
};

const buttonGroupStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
  flex: "1 1 auto",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 28,
  padding: "5px 8px",
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  background: "rgba(18, 21, 24, 0.38)",
  color: vibrancySecondaryLabel,
  cursor: "pointer",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  fontWeight: 650,
  letterSpacing: 0,
  lineHeight: 1.1,
  boxShadow: FROSTED_CONTROL_SHADOW,
};

const activeButtonStyle: React.CSSProperties = {
  borderColor: "rgba(244, 240, 232, 0.68)",
  background: "rgba(18, 21, 24, 0.48)",
  color: vibrancyLabel,
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(244, 240, 232, 0.06)",
};
