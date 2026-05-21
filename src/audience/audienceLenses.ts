import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  SceneProperties,
} from "../pages/types";

// Generic audience-lens types + scene/state application utilities.
//
// The lens configurations themselves are project-specific and live with
// the project. Case Study B's lenses (the only set in alpha) live at
// src/projectModules/caseStudyB/audienceLenses.ts alongside audienceLensById.
// Future projects declare their own AudienceLensConfig arrays against the
// shape defined below and supply their own dispatcher.

export type AudienceLensId =
  | "investor"
  | "public"
  | "government"
  | "regulatory";

export interface AudienceLensConfig {
  id: AudienceLensId;
  label: string;
  targetPageId: string;
  scene: Partial<SceneProperties>;
  layerStyles: Record<string, Partial<EditableStyle>>;
  visibilityOverrides: Record<string, boolean>;
  zoneOpacity: Record<string, number>;
  zoneLabels: Record<string, boolean>;
  summary: string;
}

export function applyAudienceLensToState(
  environment: EnvironmentSetup,
  page: PresentationPage,
  lens: AudienceLensConfig,
): { environment: EnvironmentSetup; page: PresentationPage } {
  const nextLayerStyles = { ...environment.layerStyles };
  for (const [layerId, patch] of Object.entries(lens.layerStyles)) {
    nextLayerStyles[layerId] = {
      ...(nextLayerStyles[layerId] ?? {}),
      ...patch,
    };
  }

  const nextScene = mergeAudienceLensScene(environment.scene, lens.scene);

  const nextVisibilityOverrides = { ...(page.visibilityOverrides ?? {}) };
  for (const [layerId, visible] of Object.entries(lens.visibilityOverrides)) {
    if (visible === false || nextVisibilityOverrides[layerId] !== false) {
      nextVisibilityOverrides[layerId] = visible;
    }
  }

  return {
    environment: {
      ...environment,
      layerStyles: nextLayerStyles,
      scene: nextScene,
    },
    page: {
      ...page,
      visibilityOverrides: nextVisibilityOverrides,
    },
  };
}

export function applyAudienceLensSceneToEnvironment(
  environment: EnvironmentSetup,
  lens: AudienceLensConfig,
): EnvironmentSetup {
  return {
    ...environment,
    scene: mergeAudienceLensScene(environment.scene, lens.scene),
  };
}

function mergeAudienceLensScene(
  scene: SceneProperties | undefined,
  scenePatch: Partial<SceneProperties>,
): SceneProperties {
  const base = scene ?? {};
  return {
    ...base,
    ...scenePatch,
    fog: { ...(base.fog ?? {}), ...(scenePatch.fog ?? {}) },
    bloom: { ...(base.bloom ?? {}), ...(scenePatch.bloom ?? {}) },
    camera: { ...(base.camera ?? {}), ...(scenePatch.camera ?? {}) },
    colorGrade: {
      ...(base.colorGrade ?? {}),
      ...(scenePatch.colorGrade ?? {}),
    },
    gui: {
      ...(base.gui ?? {}),
      ...(scenePatch.gui ?? {}),
      labels: {
        ...(base.gui?.labels ?? {}),
        ...(scenePatch.gui?.labels ?? {}),
      },
    },
  };
}
