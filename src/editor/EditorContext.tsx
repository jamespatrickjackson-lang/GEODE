import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  Pose,
  ProjectLayerSpec,
  ProjectManifest,
  RenderPresetId,
  SceneProperties,
  SceneOverlayDef,
  SceneOverlayRef,
  EasingName,
  TextOverlayContainer,
  TextOverlayTiming,
} from "../pages/types";
import type { SceneHandle } from "../scene";
import type {
  EditorAction,
  EditorState,
  EntityKey,
  EnvironmentSentinel,
} from "./types";
import { ENVIRONMENT_SENTINEL, POSE_HISTORY_LIMIT } from "./types";
import {
  type BatchWriteFile,
  environmentJsonPath,
  overlayMarkdownPath,
  pageArchivePath,
  pageJsonPath,
  projectJsonPath,
  readFile,
  writeFilesBatch,
  copyFile,
  deleteFile,
} from "./save";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { selectedPageWriteBlocked } from "./authoringTarget";
import {
  createUserRenderPresetFromEnvironment,
  updateUserRenderPresetFromEnvironment,
} from "../pages/renderPresets";
import { stripTopoMaterialAuthorityFromTerrain } from "../topoMap/materialAuthority";

// EditorContext owns the editable copy of the project. The on-disk state is
// authoritative on first load (via loadProject in src/pages); from then on
// the in-memory state in this context is the source of truth, and the
// user clicks Save (or hits Ctrl+S) to commit pending edits to disk.

interface EditorContextValue {
  state: EditorState;
  allEditablePages: PresentationPage[];
  /** Scene handle exposed for components that need direct GPU-side
   *  reads (e.g. the geology sub-layer panel reads the loaded units). */
  sceneHandle: SceneHandle;
  // Environment-mode dispatchers
  setEnvLayerStyle: (layerId: string, style: Partial<EditableStyle>) => void;
  toggleEnvDefaultVisible: (layerId: string) => void;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
  setAuthoringScene: (patch: Partial<SceneProperties>) => void;
  setEnvRenderPreset: (renderPreset: RenderPresetId | null) => void;
  saveEnvCustomRenderPreset: () => string | null;
  updateSelectedEnvCustomRenderPreset: () => boolean;

  // Scene-overlay env-mode dispatchers
  setEnvSceneOverlayField: (
    id: string,
    patch: Partial<SceneOverlayDef>,
  ) => void;
  setEnvSceneOverlayProvenance: (
    id: string,
    patch: Partial<SceneOverlayDef["provenance"]>,
  ) => void;
  addEnvSceneOverlay: (id: string, def: SceneOverlayDef) => Promise<void>;
  removeEnvSceneOverlay: (id: string) => void;
  // Scene-overlay per-page dispatchers
  setPageSceneOverlay: (
    pageId: string,
    overlayId: string,
    patch: Partial<SceneOverlayRef>,
  ) => void;
  removePageSceneOverlay: (pageId: string, overlayId: string) => void;

  // Provenance (project-keyed)
  setLayerProvenance: (layerId: string, metadata: Record<string, unknown>) => void;
  addProjectLayer: (
    layer: ProjectLayerSpec,
    style?: Partial<EditableStyle>,
    visible?: boolean,
  ) => void;
  removeProjectLayer: (layerId: string) => void;

  // Presentation-page delta dispatchers
  setPageLayerOverride: (
    pageId: string,
    layerId: string,
    patch: Partial<EditableStyle>,
  ) => void;
  clearPageLayerOverride: (
    pageId: string,
    layerId: string,
    field?: keyof EditableStyle,
  ) => void;
  setPageVisibilityOverride: (
    pageId: string,
    layerId: string,
    visible: boolean,
  ) => void;
  clearPageVisibilityOverride: (pageId: string, layerId: string) => void;

  // Page metadata
  setPageField: (
    pageId: string,
    patch: Partial<
      Pick<
        PresentationPage,
        | "title"
        | "subtitle"
        | "accentColor"
        | "hidden"
        | "holdDuration"
        | "dynamicCamera"
        | "cinematicExposure"
        | "bloomBoost"
        | "sunLockToCamera"
        | "renderPreset"
        | "renderPresetId"
        | "envSnapshot"
        | "sceneOverrides"
        | "cameraObjectFocus"
      >
    >,
  ) => void;
  setPageTransition: (
    pageId: string,
    patch: Partial<{ duration: number; easing: EasingName }>,
  ) => void;
  capturePoseForPage: (
    pageId: string,
    pose: Pose,
    cameraObjectFocus?: PresentationPage["cameraObjectFocus"],
  ) => void;
  setPageOverlayLayout: (
    pageId: string,
    layout: NonNullable<PresentationPage["overlayLayout"]>,
  ) => void;
  setPageOverlayTiming: (pageId: string, timing: TextOverlayTiming) => void;
  setPageOverlayHidden: (pageId: string, hidden: boolean) => void;
  addPage: (basePose: Pose) => string;
  duplicatePageById: (pageId: string) => string | null;
  deletePageById: (pageId: string) => void;
  reorderPage: (pageId: string, direction: "up" | "down") => void;
  movePageBlock: (
    pageId: string,
    targetPageId: string,
    insertPosition?: "before" | "after",
  ) => void;
  // Dev Mode Inspector UI-only sidebar reorder (no scene/transition effect).
  // orderedIds is the new desired order of the affected sidebar group's members.
  reorderLayer: (orderedIds: string[]) => void;
  reorderSceneOverlay: (pageId: string, orderedIds: string[]) => void;
  archivePage: (
    pageId: string,
    targetPageId?: string,
    insertPosition?: "before" | "after",
  ) => void;
  restoreArchivedPage: (
    pageId: string,
    targetPageId?: string,
    insertPosition?: "before" | "after",
  ) => void;
  moveArchivedPage: (
    pageId: string,
    targetPageId: string,
    insertPosition?: "before" | "after",
  ) => void;
  // Sub Master page hierarchy (DEC-079). addSubMaster creates a new Sub
  // Master that snapshots the current environment; addSubMasterChild creates
  // a child page inheriting from the given Sub Master; reSnapshotSubMaster
  // refreshes the Sub Master's envSnapshot from the current global env;
  // deleteSubMasterById cascade-deletes the master and every child page
  // that references it. Returns the new page id where applicable.
  addSubMaster: (basePose: Pose) => string;
  addSubMasterChild: (parentMasterId: string, basePose: Pose) => string | null;
  makePageSubMaster: (pageId: string) => void;
  duplicateSubMasterAsChild: (pageId: string) => string | null;
  reSnapshotSubMaster: (pageId: string) => void;
  deleteSubMasterById: (pageId: string) => void;
  selectPage: (pageId: string | EnvironmentSentinel) => void;
  resetAllPageOverrides: () => void;
  resetPageOverrides: (pageId: string) => void;
  setOverlayText: (pageId: string, text: string) => void;
  addOverlayImage: (pageId: string, fileName: string, caption?: string) => void;
  removeOverlayImage: (pageId: string, fileName: string) => void;
  togglePresenterMode: () => void;
  setLiveApplyTransitionActive: (active: boolean) => void;
  canApplyLiveSceneEdits: () => boolean;
  flushDeferredLiveSceneEdits: () => boolean;
  // Manual save -- writes every dirty entity. Returns when done.
  commitPending: () => Promise<void>;
  // Per-page rolling capture history (in-memory only, capped at 5).
  getPoseHistory: (pageId: string) => readonly Pose[];
  restorePoseFromHistory: (pageId: string, index: number) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

type KnownDiskContent = Record<string, string | null>;

function comparableJsonContent(value: unknown): string {
  return JSON.stringify(value);
}

function comparableContentForPath(
  path: string,
  content: string | null,
): string | null {
  if (content === null) return null;
  if (!path.endsWith(".json")) return content;
  try {
    return JSON.stringify(JSON.parse(content));
  } catch {
    throw new Error(
      `save conflict: ${path} is no longer valid JSON; reload the project before saving.`,
    );
  }
}

function buildInitialKnownDiskContent(
  projectRoot: string,
  manifest: ProjectManifest,
  environment: EnvironmentSetup,
  pages: readonly PresentationPage[],
  archivedPages: readonly PresentationPage[],
): KnownDiskContent {
  const known: KnownDiskContent = {
    [projectJsonPath(projectRoot)]: comparableJsonContent(manifest),
    [environmentJsonPath(projectRoot)]: comparableJsonContent(environment),
  };
  for (const page of [...pages, ...archivedPages]) {
    known[pageJsonPath(page.id, projectRoot)] = comparableJsonContent(page);
  }
  return known;
}

function saveConflictMessage(path: string): string {
  return (
    `save conflict: ${path} changed on disk since the editor loaded it; ` +
    "reload the project before saving."
  );
}

async function expectedContentForSave(
  path: string,
  knownDiskContent: KnownDiskContent,
): Promise<string | null> {
  const knownComparable = knownDiskContent[path];
  const currentContent = await readFile(path).catch(() => null);
  if (knownComparable === undefined) {
    if (currentContent !== null) {
      throw new Error(saveConflictMessage(path));
    }
    return null;
  }
  const currentComparable = comparableContentForPath(path, currentContent);
  if (currentComparable !== knownComparable) {
    throw new Error(saveConflictMessage(path));
  }
  return currentContent;
}

function rememberWrittenContent(
  knownDiskContent: KnownDiskContent,
  path: string,
  content: string | null,
): void {
  knownDiskContent[path] = comparableContentForPath(path, content);
}

function withDirty(
  prev: ReadonlySet<EntityKey>,
  add: EntityKey | EntityKey[],
): Set<EntityKey> {
  const next = new Set(prev);
  for (const k of Array.isArray(add) ? add : [add]) next.add(k);
  return next;
}

type EditablePageLists = Pick<EditorState, "pages" | "archivedPages">;

function archivedPageOrderOf(manifest: ProjectManifest): string[] {
  return Array.isArray(manifest.archivedPageOrder)
    ? manifest.archivedPageOrder.filter(
        (id): id is string => typeof id === "string" && id !== "",
      )
    : [];
}

function allEditablePages(state: EditablePageLists): PresentationPage[] {
  return [...state.pages, ...state.archivedPages];
}

function findEditablePage(
  state: EditablePageLists,
  pageId: string | null | undefined,
): PresentationPage | null {
  if (!pageId) return null;
  return (
    state.pages.find((page) => page.id === pageId) ??
    state.archivedPages.find((page) => page.id === pageId) ??
    null
  );
}

function mapEditablePages(
  state: EditablePageLists,
  mapper: (page: PresentationPage) => PresentationPage,
): EditablePageLists {
  return {
    pages: state.pages.map(mapper),
    archivedPages: state.archivedPages.map(mapper),
  };
}

function pagesInOrderFrom(
  pages: readonly PresentationPage[],
  pageOrder: readonly string[],
): PresentationPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  return pageOrder
    .map((id) => byId.get(id))
    .filter((page): page is PresentationPage => page != null);
}

function withoutDirty(
  prev: ReadonlySet<EntityKey>,
  remove: EntityKey,
): Set<EntityKey> {
  const next = new Set(prev);
  next.delete(remove);
  return next;
}

function mergeSceneEdit(
  base: Partial<SceneProperties> | undefined,
  patch: Partial<SceneProperties>,
): Partial<SceneProperties> {
  const next: Partial<SceneProperties> = { ...(base ?? {}), ...patch };
  if (patch.fog) next.fog = { ...(base?.fog ?? {}), ...patch.fog };
  if (patch.bloom) next.bloom = { ...(base?.bloom ?? {}), ...patch.bloom };
  if (patch.camera) next.camera = { ...(base?.camera ?? {}), ...patch.camera };
  if (patch.terrain) {
    next.terrain = { ...(base?.terrain ?? {}), ...patch.terrain };
  }
  if (patch.ambientOcclusion) {
    next.ambientOcclusion = {
      ...(base?.ambientOcclusion ?? {}),
      ...patch.ambientOcclusion,
    };
  }
  if (patch.colorGrade) {
    next.colorGrade = { ...(base?.colorGrade ?? {}), ...patch.colorGrade };
  }
  if (patch.vignette) {
    next.vignette = { ...(base?.vignette ?? {}), ...patch.vignette };
  }
  if (patch.depthOfField) {
    next.depthOfField = {
      ...(base?.depthOfField ?? {}),
      ...patch.depthOfField,
    };
  }
  if (patch.tiltShift) {
    next.tiltShift = { ...(base?.tiltShift ?? {}), ...patch.tiltShift };
  }
  if (patch.lensEffects) {
    next.lensEffects = {
      ...(base?.lensEffects ?? {}),
      ...patch.lensEffects,
    };
  }
  if (patch.motionTrails) {
    next.motionTrails = {
      ...(base?.motionTrails ?? {}),
      ...patch.motionTrails,
    };
  }
  if (patch.presentationFrame) {
    next.presentationFrame = {
      ...(base?.presentationFrame ?? {}),
      ...patch.presentationFrame,
    };
  }
  if (patch.compositionGuides) {
    next.compositionGuides = {
      ...(base?.compositionGuides ?? {}),
      ...patch.compositionGuides,
    };
  }
  if (patch.sectionVisuals) {
    next.sectionVisuals = {
      ...(base?.sectionVisuals ?? {}),
      ...patch.sectionVisuals,
    };
  }
  if (patch.sun) next.sun = { ...(base?.sun ?? {}), ...patch.sun };
  if (patch.topoDetails) {
    next.topoDetails = { ...(base?.topoDetails ?? {}), ...patch.topoDetails };
  }
  if (patch.gui) {
    next.gui = {
      ...(base?.gui ?? {}),
      ...patch.gui,
      labels: {
        ...(base?.gui?.labels ?? {}),
        ...(patch.gui.labels ?? {}),
      },
      editor: {
        ...(base?.gui?.editor ?? {}),
        ...(patch.gui.editor ?? {}),
      },
    };
  }
  if (patch.lighting) {
    next.lighting = {
      ...(base?.lighting ?? {}),
      ...patch.lighting,
      hemisphere: {
        ...(base?.lighting?.hemisphere ?? {}),
        ...(patch.lighting.hemisphere ?? {}),
      },
      directional: {
        ...(base?.lighting?.directional ?? {}),
        ...(patch.lighting.directional ?? {}),
      },
      fill: {
        ...(base?.lighting?.fill ?? {}),
        ...(patch.lighting.fill ?? {}),
      },
      rim: {
        ...(base?.lighting?.rim ?? {}),
        ...(patch.lighting.rim ?? {}),
      },
    };
  }
  return next;
}

function cinematicScenePatchForEdit(
  patch: Partial<SceneProperties>,
): Partial<SceneProperties> {
  const next: Partial<SceneProperties> = {};
  if (patch.background !== undefined) next.background = patch.background;
  if (patch.lightModeBackground !== undefined) {
    next.lightModeBackground = patch.lightModeBackground;
  }
  if (patch.fog !== undefined) next.fog = patch.fog;
  if (patch.sun !== undefined) next.sun = patch.sun;
  if (patch.lighting !== undefined) next.lighting = patch.lighting;
  if (patch.terrain !== undefined) {
    const terrain = stripTopoMaterialAuthorityFromTerrain(patch.terrain);
    if (terrain) next.terrain = terrain;
  }
  if (patch.topoDetails !== undefined) next.topoDetails = patch.topoDetails;
  if (patch.lightMode !== undefined) next.lightMode = patch.lightMode;
  if (patch.toneMapping !== undefined) next.toneMapping = patch.toneMapping;
  if (patch.exposure !== undefined) next.exposure = patch.exposure;
  if (patch.bloom !== undefined) next.bloom = patch.bloom;
  if (patch.ambientOcclusion !== undefined) {
    next.ambientOcclusion = patch.ambientOcclusion;
  }
  if (patch.vignette !== undefined) next.vignette = patch.vignette;
  if (patch.colorGrade !== undefined) next.colorGrade = patch.colorGrade;
  if (patch.depthOfField !== undefined) next.depthOfField = patch.depthOfField;
  if (patch.tiltShift !== undefined) next.tiltShift = patch.tiltShift;
  if (patch.lensEffects !== undefined) next.lensEffects = patch.lensEffects;
  if (patch.motionTrails !== undefined) next.motionTrails = patch.motionTrails;
  if (patch.presentationFrame !== undefined) {
    next.presentationFrame = patch.presentationFrame;
  }
  if (patch.compositionGuides !== undefined) {
    next.compositionGuides = patch.compositionGuides;
  }
  if (patch.sectionVisuals !== undefined) {
    next.sectionVisuals = patch.sectionVisuals;
  }
  if (patch.gui !== undefined) next.gui = patch.gui;
  return next;
}

function currentAuthoringScene(state: EditorState): SceneProperties {
  const selectedPageId = state.selectedPageId;
  if (selectedPageId && selectedPageId !== ENVIRONMENT_SENTINEL) {
    const page = findEditablePage(state, selectedPageId);
    if (page) {
      return (
        resolveEnvironmentForPage(
          state.environment,
          allEditablePages(state),
          page,
        ).scene ??
        {}
      );
    }
  }
  return state.environment.scene ?? {};
}

function pageAtmosphereSceneOverrides(
  scene: SceneProperties,
): Partial<SceneProperties> {
  const next: Partial<SceneProperties> = {
    lightMode: scene.lightMode === true,
  };
  if (scene.background !== undefined) next.background = scene.background;
  if (scene.lightModeBackground !== undefined) {
    next.lightModeBackground = scene.lightModeBackground;
  }
  if (scene.fog !== undefined) next.fog = clone(scene.fog);
  return next;
}

function syncActiveUserRenderPresetScene(
  environment: EnvironmentSetup,
  patch: Partial<SceneProperties>,
): EnvironmentSetup {
  const selectedId =
    environment.renderPreset ?? environment.scene?.activeRenderPresetId;
  if (!selectedId) return environment;
  const presetScenePatch = cinematicScenePatchForEdit(patch);
  if (Object.keys(presetScenePatch).length === 0) return environment;
  const presets = environment.customRenderPresets ?? [];
  const preset = presets.find(
    (candidate) => candidate.id === selectedId && candidate.source === "user",
  );
  if (!preset) return environment;
  return {
    ...environment,
    customRenderPresets: presets.map((candidate) =>
      candidate.id === preset.id
        ? {
            ...candidate,
            scenePatch: mergeSceneEdit(
              candidate.scenePatch,
              presetScenePatch,
            ) as typeof candidate.scenePatch,
          }
        : candidate,
    ),
  };
}

function syncActiveUserRenderPresetLayerStyle(
  environment: EnvironmentSetup,
  layerId: string,
  patch: Partial<EditableStyle>,
): EnvironmentSetup {
  const selectedId =
    environment.renderPreset ?? environment.scene?.activeRenderPresetId;
  if (!selectedId || Object.keys(patch).length === 0) return environment;
  const presets = environment.customRenderPresets ?? [];
  const preset = presets.find(
    (candidate) => candidate.id === selectedId && candidate.source === "user",
  );
  if (!preset) return environment;
  return {
    ...environment,
    customRenderPresets: presets.map((candidate) =>
      candidate.id === preset.id
        ? {
            ...candidate,
            layerStylePatchesByLayerId: {
              ...(candidate.layerStylePatchesByLayerId ?? {}),
              [layerId]: {
                ...(candidate.layerStylePatchesByLayerId?.[layerId] ?? {}),
                ...patch,
              },
            },
          }
        : candidate,
    ),
  };
}

// ---- Sub Master helpers (DEC-079) ----

function isSubMasterPage(page: PresentationPage): boolean {
  return (
    page.envSnapshot != null &&
    (page.parentMasterId == null || page.parentMasterId === "global")
  );
}

function isSubMasterChildPage(page: PresentationPage): boolean {
  return page.parentMasterId != null && page.parentMasterId !== "global";
}

function childrenOfSubMaster(
  masterId: string,
  pages: PresentationPage[],
  pageOrder: readonly string[],
): string[] {
  const childIds = new Set(
    pages.filter((p) => p.parentMasterId === masterId).map((p) => p.id),
  );
  return pageOrder.filter((id) => childIds.has(id));
}

// Atomic block for the given page: the contiguous run of pageOrder ids that
// move together. For a Sub Master, master + its children. For a child of a
// Sub Master, the master's full block (the child is part of it). For a
// Global child, just the child.
function atomicBlockFor(
  pageId: string,
  pages: PresentationPage[],
  pageOrder: readonly string[],
): string[] {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return [pageId];
  if (isSubMasterPage(page)) {
    return [page.id, ...childrenOfSubMaster(page.id, pages, pageOrder)];
  }
  if (isSubMasterChildPage(page)) {
    const masterId = page.parentMasterId!;
    return [masterId, ...childrenOfSubMaster(masterId, pages, pageOrder)];
  }
  return [pageId];
}

function nextSubMasterOrdinal(pages: PresentationPage[]): number {
  let max = 0;
  for (const p of pages) {
    if (typeof p.subMasterOrdinal === "number" && p.subMasterOrdinal > max) {
      max = p.subMasterOrdinal;
    }
  }
  return max + 1;
}

function pagesInManifestOrder(
  pages: PresentationPage[],
  pageOrder: readonly string[],
): PresentationPage[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  return pageOrder
    .map((id) => byId.get(id))
    .filter((p): p is PresentationPage => p != null);
}

function materializePageEnvironmentSnapshot(
  state: EditorState,
  page: PresentationPage,
): EnvironmentSetup {
  const base = clone(
    resolveEnvironmentForPage(state.environment, allEditablePages(state), page),
  );
  const layerIds = new Set([
    ...Object.keys(base.layerStyles ?? {}),
    ...Object.keys(page.layerOverrides ?? {}),
  ]);
  const layerStyles: EnvironmentSetup["layerStyles"] = {
    ...(base.layerStyles ?? {}),
  };
  for (const layerId of layerIds) {
    layerStyles[layerId] = effectiveStyle(base, page, layerId);
  }
  return {
    ...base,
    defaultVisibleLayers: Array.from(effectiveVisibility(base, page)),
    layerStyles,
  };
}

function withoutLayerOverrideFields(
  page: PresentationPage,
  layerId: string,
  fields?: readonly (keyof EditableStyle)[],
): PresentationPage {
  const overrides = { ...(page.layerOverrides ?? {}) };
  if (fields === undefined) {
    delete overrides[layerId];
  } else {
    const layerOverride = { ...(overrides[layerId] ?? {}) };
    for (const field of fields) delete layerOverride[field];
    if (Object.keys(layerOverride).length === 0) {
      delete overrides[layerId];
    } else {
      overrides[layerId] = layerOverride;
    }
  }
  const next: PresentationPage = { ...page, layerOverrides: overrides };
  if (Object.keys(overrides).length === 0) delete next.layerOverrides;
  return next;
}

function withoutVisibilityOverride(
  page: PresentationPage,
  layerId: string,
): PresentationPage {
  const visibilityOverrides = { ...(page.visibilityOverrides ?? {}) };
  delete visibilityOverrides[layerId];
  const next: PresentationPage = { ...page, visibilityOverrides };
  if (Object.keys(visibilityOverrides).length === 0) {
    delete next.visibilityOverrides;
  }
  return next;
}

function setSubMasterSnapshotLayerStyle(
  page: PresentationPage,
  layerId: string,
  patch: Partial<EditableStyle>,
): PresentationPage {
  if (!isSubMasterPage(page) || !page.envSnapshot) return page;
  const envSnapshot = clone(page.envSnapshot);
  envSnapshot.layerStyles[layerId] = normalizeMtBoundaryVisibilityStyle({
    ...(envSnapshot.layerStyles[layerId] ?? {}),
    ...patch,
  });
  const cleared = withoutLayerOverrideFields(
    page,
    layerId,
    Object.keys(patch) as (keyof EditableStyle)[],
  );
  return { ...cleared, envSnapshot };
}

function clearSubMasterSnapshotLayerStyle(
  page: PresentationPage,
  layerId: string,
  field?: keyof EditableStyle,
): PresentationPage {
  if (!isSubMasterPage(page) || !page.envSnapshot) return page;
  const envSnapshot = clone(page.envSnapshot);
  if (field === undefined) {
    delete envSnapshot.layerStyles[layerId];
  } else {
    const style = { ...(envSnapshot.layerStyles[layerId] ?? {}) };
    delete style[field];
    if (Object.keys(style).length === 0) {
      delete envSnapshot.layerStyles[layerId];
    } else {
      envSnapshot.layerStyles[layerId] = style;
    }
  }
  const cleared = withoutLayerOverrideFields(
    page,
    layerId,
    field === undefined ? undefined : [field],
  );
  return { ...cleared, envSnapshot };
}

function setSubMasterSnapshotVisible(
  page: PresentationPage,
  layerId: string,
  visible: boolean,
): PresentationPage {
  if (!isSubMasterPage(page) || !page.envSnapshot) return page;
  const envSnapshot = clone(page.envSnapshot);
  const visibleLayers = new Set(envSnapshot.defaultVisibleLayers);
  if (visible) visibleLayers.add(layerId);
  else visibleLayers.delete(layerId);
  envSnapshot.defaultVisibleLayers = Array.from(visibleLayers);
  return { ...withoutVisibilityOverride(page, layerId), envSnapshot };
}

function normalizeMtBoundaryVisibilityStyle(style: EditableStyle): EditableStyle {
  const boundaries = style.mtSurfaceBoundariesById;
  if (!boundaries) return style;

  let changed = false;
  const visibility = { ...(style.mtThresholdSurfaceVisibility ?? {}) };
  for (const [id, boundary] of Object.entries(boundaries)) {
    if (typeof boundary?.visible !== "boolean") continue;
    if (visibility[id] === boundary.visible) continue;
    visibility[id] = boundary.visible;
    changed = true;
  }

  return changed ? { ...style, mtThresholdSurfaceVisibility: visibility } : style;
}

function normalizeMtBoundaryVisibilityLayerStyles(
  layerStyles: Record<string, EditableStyle>,
): Record<string, EditableStyle> {
  let changed = false;
  const next = { ...layerStyles };
  for (const [layerId, style] of Object.entries(layerStyles)) {
    const normalized = normalizeMtBoundaryVisibilityStyle(style);
    if (normalized === style) continue;
    next[layerId] = normalized;
    changed = true;
  }
  return changed ? next : layerStyles;
}

function normalizeMtBoundaryVisibilityEnvironment(
  environment: EnvironmentSetup,
): EnvironmentSetup {
  const layerStyles = normalizeMtBoundaryVisibilityLayerStyles(
    environment.layerStyles,
  );
  return layerStyles === environment.layerStyles
    ? environment
    : { ...environment, layerStyles };
}

function normalizeMtBoundaryVisibilityPage(
  page: PresentationPage,
): PresentationPage {
  let next = page;
  if (page.layerOverrides) {
    const layerOverrides = normalizeMtBoundaryVisibilityLayerStyles(
      page.layerOverrides,
    );
    if (layerOverrides !== page.layerOverrides) {
      next = { ...next, layerOverrides };
    }
  }
  if (page.envSnapshot) {
    const envSnapshot = normalizeMtBoundaryVisibilityEnvironment(
      page.envSnapshot,
    );
    if (envSnapshot !== page.envSnapshot) {
      next = { ...next, envSnapshot };
    }
  }
  return next;
}

function normalizeSubMasterAuthoringPage(page: PresentationPage): PresentationPage {
  if (!isSubMasterPage(page) || !page.envSnapshot) return page;
  let next: PresentationPage = page;
  const envSnapshot = clone(page.envSnapshot);
  for (const [layerId, patch] of Object.entries(page.layerOverrides ?? {})) {
    envSnapshot.layerStyles[layerId] = {
      ...(envSnapshot.layerStyles[layerId] ?? {}),
      ...patch,
    };
  }
  for (const [layerId, visible] of Object.entries(page.visibilityOverrides ?? {})) {
    const visibleLayers = new Set(envSnapshot.defaultVisibleLayers);
    if (visible) visibleLayers.add(layerId);
    else visibleLayers.delete(layerId);
    envSnapshot.defaultVisibleLayers = Array.from(visibleLayers);
  }
  envSnapshot.layerStyles = normalizeMtBoundaryVisibilityLayerStyles(
    envSnapshot.layerStyles,
  );
  next = { ...next, envSnapshot };
  delete next.layerOverrides;
  delete next.visibilityOverrides;
  return normalizeMtBoundaryVisibilityPage(next);
}

function normalizeSubMasterAuthoringPages(
  pages: readonly PresentationPage[],
): PresentationPage[] {
  return pages.map((page) =>
    normalizeMtBoundaryVisibilityPage(normalizeSubMasterAuthoringPage(page)),
  );
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    // ---- environment ------------------------------------------------------
    case "SET_ENV_LAYER_STYLE": {
      let environment = clone(state.environment);
      environment.layerStyles[action.layerId] = normalizeMtBoundaryVisibilityStyle({
        ...(environment.layerStyles[action.layerId] ?? {}),
        ...action.style,
      });
      environment = syncActiveUserRenderPresetLayerStyle(
        environment,
        action.layerId,
        normalizeMtBoundaryVisibilityStyle(action.style),
      );
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "TOGGLE_ENV_DEFAULT_VISIBLE": {
      const environment = clone(state.environment);
      const set = new Set(environment.defaultVisibleLayers);
      if (set.has(action.layerId)) set.delete(action.layerId);
      else set.add(action.layerId);
      environment.defaultVisibleLayers = Array.from(set);
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "SET_ENV_SCENE": {
      const environment = clone(state.environment);
      environment.scene = mergeSceneEdit(environment.scene, action.patch);
      const nextEnvironment = syncActiveUserRenderPresetScene(
        environment,
        action.patch,
      );
      return {
        ...state,
        environment: nextEnvironment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "SET_ENV_RENDER_PRESET": {
      const environment = clone(state.environment);
      if (action.renderPreset) {
        environment.renderPreset = action.renderPreset;
      } else {
        delete environment.renderPreset;
      }
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "ADD_ENV_CUSTOM_RENDER_PRESET": {
      const environment = clone(state.environment);
      environment.customRenderPresets = [
        ...(environment.customRenderPresets ?? []),
        action.preset,
      ];
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "UPDATE_ENV_CUSTOM_RENDER_PRESET": {
      const environment = clone(state.environment);
      environment.customRenderPresets = (
        environment.customRenderPresets ?? []
      ).map((preset) =>
        preset.id === action.preset.id ? action.preset : preset,
      );
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "SET_ENV_SCENE_OVERLAY_FIELD": {
      const environment = clone(state.environment);
      const reg = environment.sceneOverlays ?? {};
      const cur = reg[action.id];
      if (!cur) return state;
      reg[action.id] = { ...cur, ...action.patch };
      environment.sceneOverlays = reg;
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "SET_ENV_SCENE_OVERLAY_PROVENANCE": {
      const environment = clone(state.environment);
      const reg = environment.sceneOverlays ?? {};
      const cur = reg[action.id];
      if (!cur) return state;
      reg[action.id] = {
        ...cur,
        provenance: { ...cur.provenance, ...action.patch },
      };
      environment.sceneOverlays = reg;
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "ADD_ENV_SCENE_OVERLAY": {
      const environment = clone(state.environment);
      const reg = environment.sceneOverlays ?? {};
      reg[action.id] = action.def;
      environment.sceneOverlays = reg;
      return {
        ...state,
        environment,
        dirty: withDirty(state.dirty, "environment"),
      };
    }
    case "REMOVE_ENV_SCENE_OVERLAY": {
      const environment = clone(state.environment);
      const reg = environment.sceneOverlays ?? {};
      if (!(action.id in reg)) return state;
      delete reg[action.id];
      environment.sceneOverlays = reg;
      // Strip references from every page that listed this overlay so
      // we don't leave dangling refs in the saved JSON.
      const dirty = new Set(state.dirty);
      dirty.add("environment");
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        const refs = p.sceneOverlays ?? [];
        if (!refs.some((r) => r.id === action.id)) return p;
        const next: PresentationPage = { ...p };
        const filtered = refs.filter((r) => r.id !== action.id);
        if (filtered.length > 0) next.sceneOverlays = filtered;
        else delete next.sceneOverlays;
        dirty.add(`page:${p.id}`);
        return next;
      });
      return { ...state, environment, pages, archivedPages, dirty };
    }
    case "SET_PAGE_SCENE_OVERLAY": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const refs = [...(p.sceneOverlays ?? [])];
        const idx = refs.findIndex((r) => r.id === action.overlayId);
        if (idx >= 0) {
          refs[idx] = { ...refs[idx], ...action.patch };
        } else {
          refs.push({ id: action.overlayId, ...action.patch });
        }
        return { ...p, sceneOverlays: refs };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "REMOVE_PAGE_SCENE_OVERLAY": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const refs = (p.sceneOverlays ?? []).filter(
          (r) => r.id !== action.overlayId,
        );
        const next: PresentationPage = { ...p };
        if (refs.length > 0) {
          next.sceneOverlays = refs;
        } else {
          delete next.sceneOverlays;
        }
        return next;
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "REORDER_LAYER": {
      // UI-only sidebar arrangement. orderedIds is one sidebar group's members
      // in their new order; re-thread them into manifest.layers slot-for-slot so
      // non-group layers keep their positions. Scene/transition is id/Map-based.
      const set = new Set(action.orderedIds);
      const byId = new Map(state.manifest.layers.map((l) => [l.id, l]));
      const ordered = action.orderedIds
        .map((id) => byId.get(id))
        .filter((l): l is NonNullable<typeof l> => Boolean(l));
      if (ordered.length === 0 || ordered.length !== action.orderedIds.length) {
        return state;
      }
      const manifest = clone(state.manifest);
      let gi = 0;
      manifest.layers = manifest.layers.map((l) =>
        set.has(l.id) ? ordered[gi++] : l,
      );
      return { ...state, manifest, dirty: withDirty(state.dirty, "project") };
    }
    case "REORDER_PAGE_SCENE_OVERLAY": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const refs = p.sceneOverlays ?? [];
        const byId = new Map(refs.map((r) => [r.id, r]));
        const ordered = action.orderedIds
          .map((id) => byId.get(id))
          .filter((r): r is NonNullable<typeof r> => Boolean(r));
        if (ordered.length !== refs.length) return p;
        return { ...p, sceneOverlays: ordered };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }

    // ---- provenance (project) --------------------------------------------
    case "SET_LAYER_PROVENANCE": {
      const manifest = clone(state.manifest);
      const layer = manifest.layers.find((l) => l.id === action.layerId);
      if (!layer) return state;
      layer.metadata = { ...layer.metadata, ...action.metadata };
      return {
        ...state,
        manifest,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "ADD_PROJECT_LAYER": {
      if (state.manifest.layers.some((layer) => layer.id === action.layer.id)) {
        return state;
      }
      const manifest = clone(state.manifest);
      manifest.layers = [...manifest.layers, action.layer];
      const environment = clone(state.environment);
      environment.layerStyles[action.layer.id] = {
        ...(environment.layerStyles[action.layer.id] ?? {}),
        ...(action.style ?? {}),
      };
      if (action.visible !== false) {
        environment.defaultVisibleLayers = Array.from(
          new Set([...environment.defaultVisibleLayers, action.layer.id]),
        );
      }
      return {
        ...state,
        manifest,
        environment,
        dirty: withDirty(state.dirty, ["project", "environment"]),
      };
    }
    case "REMOVE_PROJECT_LAYER": {
      if (!state.manifest.layers.some((layer) => layer.id === action.layerId)) {
        return state;
      }
      const manifest = clone(state.manifest);
      manifest.layers = manifest.layers.filter(
        (layer) => layer.id !== action.layerId,
      );
      const environment = clone(state.environment);
      delete environment.layerStyles[action.layerId];
      environment.defaultVisibleLayers = environment.defaultVisibleLayers.filter(
        (layerId) => layerId !== action.layerId,
      );
      const dirty = withDirty(state.dirty, ["project", "environment"]);
      const { pages, archivedPages } = mapEditablePages(state, (page) => {
        let changed = false;
        const next: PresentationPage = { ...page };
        if (next.layerOverrides?.[action.layerId]) {
          const layerOverrides = { ...next.layerOverrides };
          delete layerOverrides[action.layerId];
          if (Object.keys(layerOverrides).length > 0) {
            next.layerOverrides = layerOverrides;
          } else {
            delete next.layerOverrides;
          }
          changed = true;
        }
        if (next.visibilityOverrides?.[action.layerId] !== undefined) {
          const visibilityOverrides = { ...next.visibilityOverrides };
          delete visibilityOverrides[action.layerId];
          if (Object.keys(visibilityOverrides).length > 0) {
            next.visibilityOverrides = visibilityOverrides;
          } else {
            delete next.visibilityOverrides;
          }
          changed = true;
        }
        if (next.envSnapshot) {
          const envSnapshot = clone(next.envSnapshot);
          const hadStyle = envSnapshot.layerStyles[action.layerId] !== undefined;
          delete envSnapshot.layerStyles[action.layerId];
          const nextDefaultVisibleLayers =
            envSnapshot.defaultVisibleLayers.filter(
              (layerId) => layerId !== action.layerId,
            );
          if (
            hadStyle ||
            nextDefaultVisibleLayers.length !==
              envSnapshot.defaultVisibleLayers.length
          ) {
            envSnapshot.defaultVisibleLayers = nextDefaultVisibleLayers;
            next.envSnapshot = envSnapshot;
            changed = true;
          }
        }
        if (changed) dirty.add(`page:${page.id}`);
        return changed ? next : page;
      });
      return {
        ...state,
        manifest,
        environment,
        pages,
        archivedPages,
        dirty,
      };
    }

    // ---- presentation-page deltas ----------------------------------------
    case "SET_PAGE_LAYER_OVERRIDE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        if (isSubMasterPage(p)) {
          return setSubMasterSnapshotLayerStyle(
            p,
            action.layerId,
            action.patch,
          );
        }
        const overrides = { ...(p.layerOverrides ?? {}) };
        overrides[action.layerId] = normalizeMtBoundaryVisibilityStyle({
          ...(overrides[action.layerId] ?? {}),
          ...action.patch,
        });
        return { ...p, layerOverrides: overrides };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "CLEAR_PAGE_LAYER_OVERRIDE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        if (isSubMasterPage(p)) {
          return clearSubMasterSnapshotLayerStyle(
            p,
            action.layerId,
            action.field,
          );
        }
        const overrides = { ...(p.layerOverrides ?? {}) };
        if (action.field === undefined) {
          delete overrides[action.layerId];
        } else {
          const layerOv = { ...(overrides[action.layerId] ?? {}) };
          delete layerOv[action.field];
          if (Object.keys(layerOv).length === 0) {
            delete overrides[action.layerId];
          } else {
            overrides[action.layerId] = layerOv;
          }
        }
        const next: PresentationPage = { ...p, layerOverrides: overrides };
        if (Object.keys(overrides).length === 0) delete next.layerOverrides;
        return next;
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_VISIBILITY_OVERRIDE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        if (isSubMasterPage(p)) {
          return setSubMasterSnapshotVisible(p, action.layerId, action.visible);
        }
        const overrides = { ...(p.visibilityOverrides ?? {}) };
        overrides[action.layerId] = action.visible;
        return { ...p, visibilityOverrides: overrides };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "CLEAR_PAGE_VISIBILITY_OVERRIDE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        if (isSubMasterPage(p)) {
          return withoutVisibilityOverride(p, action.layerId);
        }
        const overrides = { ...(p.visibilityOverrides ?? {}) };
        delete overrides[action.layerId];
        const next: PresentationPage = { ...p, visibilityOverrides: overrides };
        if (Object.keys(overrides).length === 0) delete next.visibilityOverrides;
        return next;
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }

    // ---- page metadata (unchanged from Week 3) ----------------------------
    case "SET_PAGE_FIELD": {
      const { pages, archivedPages } = mapEditablePages(state, (p) =>
        p.id === action.pageId ? { ...p, ...action.patch } : p,
      );
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_TRANSITION": {
      const { pages, archivedPages } = mapEditablePages(state, (p) =>
        p.id === action.pageId
          ? { ...p, transition: { ...p.transition, ...action.patch } }
          : p,
      );
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "CAPTURE_POSE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const next: PresentationPage = { ...p, camera: action.pose };
        if (action.cameraObjectFocus) {
          next.cameraObjectFocus = action.cameraObjectFocus;
        } else {
          delete next.cameraObjectFocus;
        }
        return next;
      });
      // Push the captured pose onto the page's rolling history (cap 5).
      // Most recent first; user-facing labels are "Capture #N" newest->oldest.
      const prevHistory = state.poseHistory[action.pageId] ?? [];
      const nextHistory = [action.pose, ...prevHistory].slice(
        0,
        POSE_HISTORY_LIMIT,
      );
      return {
        ...state,
        pages,
        archivedPages,
        poseHistory: { ...state.poseHistory, [action.pageId]: nextHistory },
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_OVERLAY_LAYOUT": {
      const { pages, archivedPages } = mapEditablePages(state, (p) =>
        p.id === action.pageId ? { ...p, overlayLayout: action.layout } : p,
      );
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_OVERLAY_TIMING": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const overlay = p.overlay ?? {
          position: "right",
          contentFile: `overlays/${p.id}/text.md`,
          images: [],
        };
        return {
          ...p,
          overlay: {
            ...overlay,
            timing: { ...(overlay.timing ?? {}), ...action.timing },
          },
        };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_OVERLAY_HIDDEN": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const overlay = p.overlay ?? {
          position: "right",
          contentFile: `overlays/${p.id}/text.md`,
          images: [],
        };
        return {
          ...p,
          overlay: { ...overlay, hidden: action.hidden },
        };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "RESTORE_POSE_FROM_HISTORY": {
      const history = state.poseHistory[action.pageId] ?? [];
      const pose = history[action.index];
      if (!pose) return state;
      const { pages, archivedPages } = mapEditablePages(state, (p) =>
        p.id === action.pageId ? { ...p, camera: pose } : p,
      );
      // Restoring does NOT push to history -- this entry already exists.
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "ADD_PAGE": {
      const manifest = clone(state.manifest);
      const pageOrder = [...manifest.pageOrder];
      const archivedPageOrder = archivedPageOrderOf(manifest);
      const sourceIsArchived =
        action.afterPageId !== undefined &&
        archivedPageOrder.includes(action.afterPageId);
      const pageIndex =
        action.afterPageId !== undefined
          ? (sourceIsArchived
              ? archivedPageOrder.indexOf(action.afterPageId)
              : pageOrder.indexOf(action.afterPageId))
          : -1;
      if (sourceIsArchived && pageIndex >= 0) {
        archivedPageOrder.splice(pageIndex + 1, 0, action.page.id);
      } else if (pageIndex >= 0) {
        pageOrder.splice(pageIndex + 1, 0, action.page.id);
      } else {
        pageOrder.push(action.page.id);
      }
      manifest.pageOrder = pageOrder;
      manifest.archivedPageOrder = archivedPageOrder;
      const sourceIndex =
        action.afterPageId !== undefined
          ? (sourceIsArchived
              ? state.archivedPages.findIndex(
                  (page) => page.id === action.afterPageId,
                )
              : state.pages.findIndex((page) => page.id === action.afterPageId))
          : -1;
      const pages = [...state.pages];
      const archivedPages = [...state.archivedPages];
      if (sourceIsArchived && sourceIndex >= 0) {
        archivedPages.splice(sourceIndex + 1, 0, action.page);
      } else if (sourceIndex >= 0) {
        pages.splice(sourceIndex + 1, 0, action.page);
      } else {
        pages.push(action.page);
      }
      const overlays =
        action.overlayText !== undefined
          ? { ...state.overlays, [action.page.id]: action.overlayText }
          : state.overlays;
      const dirtyKeys: EntityKey[] = ["project", `page:${action.page.id}`];
      if (action.overlayText !== undefined) {
        dirtyKeys.push(`overlay:${action.page.id}`);
      }
      return {
        ...state,
        manifest,
        pages,
        archivedPages,
        overlays,
        selectedPageId: action.page.id,
        dirty: withDirty(state.dirty, dirtyKeys),
      };
    }
    case "DELETE_PAGE": {
      const activeTarget = state.pages.some((p) => p.id === action.pageId);
      if (activeTarget && state.pages.length <= 1) return state;
      const manifest = clone(state.manifest);
      manifest.pageOrder = manifest.pageOrder.filter(
        (id) => id !== action.pageId,
      );
      manifest.archivedPageOrder = archivedPageOrderOf(manifest).filter(
        (id) => id !== action.pageId,
      );
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      const archivedPages = state.archivedPages.filter(
        (p) => p.id !== action.pageId,
      );
      const selectedPageId =
        state.selectedPageId === action.pageId
          ? pages[0]?.id ?? null
          : state.selectedPageId;
      return {
        ...state,
        manifest,
        pages,
        archivedPages,
        selectedPageId,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "REORDER_PAGE": {
      // Group-aware reorder (DEC-079). Sub Master blocks (master + children)
      // move atomically; Sub Master children clamp to siblings; Global
      // children skip over Sub Master blocks as units.
      const manifest = clone(state.manifest);
      const order = manifest.pageOrder;
      const page = state.pages.find((p) => p.id === action.pageId);
      if (!page) return state;

      if (isSubMasterChildPage(page)) {
        const siblings = childrenOfSubMaster(
          page.parentMasterId!,
          state.pages,
          order,
        );
        const cIdx = siblings.indexOf(page.id);
        const swap = action.direction === "up" ? cIdx - 1 : cIdx + 1;
        if (swap < 0 || swap >= siblings.length) return state;
        const targetId = siblings[swap];
        const a = order.indexOf(page.id);
        const b = order.indexOf(targetId);
        [order[a], order[b]] = [order[b], order[a]];
        manifest.pageOrder = order;
      } else {
        const myBlock = atomicBlockFor(page.id, state.pages, order);
        const myStart = order.indexOf(myBlock[0]);
        const myEnd = myStart + myBlock.length;
        if (action.direction === "up") {
          if (myStart === 0) return state;
          const neighbourLastId = order[myStart - 1];
          const neighbourBlock = atomicBlockFor(
            neighbourLastId,
            state.pages,
            order,
          );
          const neighbourStart = order.indexOf(neighbourBlock[0]);
          const before = order.slice(0, neighbourStart);
          const after = order.slice(myEnd);
          manifest.pageOrder = [
            ...before,
            ...myBlock,
            ...neighbourBlock,
            ...after,
          ];
        } else {
          if (myEnd >= order.length) return state;
          const neighbourFirstId = order[myEnd];
          const neighbourBlock = atomicBlockFor(
            neighbourFirstId,
            state.pages,
            order,
          );
          const neighbourEnd =
            order.indexOf(neighbourBlock[neighbourBlock.length - 1]) + 1;
          const before = order.slice(0, myStart);
          const after = order.slice(neighbourEnd);
          manifest.pageOrder = [
            ...before,
            ...neighbourBlock,
            ...myBlock,
            ...after,
          ];
        }
      }

      const byId = new Map(state.pages.map((p) => [p.id, p]));
      const pages = manifest.pageOrder
        .map((id) => byId.get(id))
        .filter((p): p is PresentationPage => p != null);
      return {
        ...state,
        manifest,
        pages,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "MOVE_PAGE_BLOCK": {
      if (action.pageId === action.targetPageId) return state;
      const source = state.pages.find((p) => p.id === action.pageId);
      const target = state.pages.find((p) => p.id === action.targetPageId);
      if (!source || !target) return state;

      const manifest = clone(state.manifest);
      const order = manifest.pageOrder;
      const sourceIndex = order.indexOf(source.id);
      const targetIndex = order.indexOf(target.id);
      if (sourceIndex < 0 || targetIndex < 0) return state;

      let nextOrder: string[] | null = null;
      if (isSubMasterChildPage(source)) {
        if (
          !isSubMasterChildPage(target) ||
          target.parentMasterId !== source.parentMasterId
        ) {
          return state;
        }
        const withoutSource = order.filter((id) => id !== source.id);
        const nextTargetIndex = withoutSource.indexOf(target.id);
        if (nextTargetIndex < 0) return state;
        const insertPosition =
          action.insertPosition ?? (sourceIndex < targetIndex ? "after" : "before");
        const insertIndex =
          insertPosition === "after" ? nextTargetIndex + 1 : nextTargetIndex;
        nextOrder = [
          ...withoutSource.slice(0, insertIndex),
          source.id,
          ...withoutSource.slice(insertIndex),
        ];
      } else {
        const sourceBlock = atomicBlockFor(source.id, state.pages, order);
        const targetBlock = atomicBlockFor(target.id, state.pages, order);
        if (targetBlock.some((id) => sourceBlock.includes(id))) return state;

        const sourceBlockStart = order.indexOf(sourceBlock[0]);
        const targetBlockStart = order.indexOf(targetBlock[0]);
        const withoutSource = order.filter((id) => !sourceBlock.includes(id));
        const targetStart = withoutSource.indexOf(targetBlock[0]);
        const targetEnd =
          withoutSource.indexOf(targetBlock[targetBlock.length - 1]) + 1;
        if (targetStart < 0 || targetEnd <= 0) return state;
        const insertPosition =
          action.insertPosition ??
          (sourceBlockStart < targetBlockStart ? "after" : "before");
        const insertIndex =
          insertPosition === "after" ? targetEnd : targetStart;
        nextOrder = [
          ...withoutSource.slice(0, insertIndex),
          ...sourceBlock,
          ...withoutSource.slice(insertIndex),
        ];
      }

      if (!nextOrder || nextOrder.join("\u0000") === order.join("\u0000")) {
        return state;
      }
      manifest.pageOrder = nextOrder;
      const pages = pagesInManifestOrder(state.pages, nextOrder);
      return {
        ...state,
        manifest,
        pages,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "ARCHIVE_PAGE": {
      if (state.pages.length <= 1) return state;
      const source = state.pages.find((p) => p.id === action.pageId);
      if (!source) return state;
      const manifest = clone(state.manifest);
      const nextPageOrder = manifest.pageOrder.filter((id) => id !== source.id);
      const nextArchivedOrder = archivedPageOrderOf(manifest).filter(
        (id) => id !== source.id,
      );
      const targetIndex =
        action.targetPageId !== undefined
          ? nextArchivedOrder.indexOf(action.targetPageId)
          : -1;
      const insertIndex =
        targetIndex >= 0
          ? action.insertPosition === "after"
            ? targetIndex + 1
            : targetIndex
          : 0;
      nextArchivedOrder.splice(insertIndex, 0, source.id);
      manifest.pageOrder = nextPageOrder;
      manifest.archivedPageOrder = nextArchivedOrder;
      const pages = state.pages.filter((p) => p.id !== source.id);
      const archivedPages = state.archivedPages.filter(
        (p) => p.id !== source.id,
      );
      archivedPages.splice(insertIndex, 0, source);
      return {
        ...state,
        manifest,
        pages,
        archivedPages,
        selectedPageId: source.id,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "RESTORE_ARCHIVED_PAGE": {
      const source = state.archivedPages.find((p) => p.id === action.pageId);
      if (!source) return state;
      const manifest = clone(state.manifest);
      const nextArchivedOrder = archivedPageOrderOf(manifest).filter(
        (id) => id !== source.id,
      );
      const nextPageOrder = manifest.pageOrder.filter((id) => id !== source.id);
      const targetIndex =
        action.targetPageId !== undefined
          ? nextPageOrder.indexOf(action.targetPageId)
          : -1;
      const insertIndex =
        targetIndex >= 0
          ? action.insertPosition === "after"
            ? targetIndex + 1
            : targetIndex
          : nextPageOrder.length;
      nextPageOrder.splice(insertIndex, 0, source.id);
      manifest.pageOrder = nextPageOrder;
      manifest.archivedPageOrder = nextArchivedOrder;
      const archivedPages = state.archivedPages.filter((p) => p.id !== source.id);
      const pages = state.pages.filter((p) => p.id !== source.id);
      pages.splice(insertIndex, 0, source);
      return {
        ...state,
        manifest,
        pages,
        archivedPages,
        selectedPageId: source.id,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "MOVE_ARCHIVED_PAGE": {
      if (action.pageId === action.targetPageId) return state;
      const source = state.archivedPages.find((p) => p.id === action.pageId);
      const target = state.archivedPages.find((p) => p.id === action.targetPageId);
      if (!source || !target) return state;
      const manifest = clone(state.manifest);
      const withoutSource = archivedPageOrderOf(manifest).filter(
        (id) => id !== source.id,
      );
      const targetIndex = withoutSource.indexOf(target.id);
      if (targetIndex < 0) return state;
      const insertIndex =
        action.insertPosition === "after" ? targetIndex + 1 : targetIndex;
      withoutSource.splice(insertIndex, 0, source.id);
      manifest.archivedPageOrder = withoutSource;
      const archivedPages = pagesInOrderFrom(state.archivedPages, withoutSource);
      return {
        ...state,
        manifest,
        archivedPages,
        selectedPageId: source.id,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "ADD_SUB_MASTER": {
      const manifest = clone(state.manifest);
      const pageOrder = [...manifest.pageOrder];
      const pageIndex =
        action.afterPageId !== undefined
          ? pageOrder.indexOf(action.afterPageId)
          : -1;
      if (pageIndex >= 0) {
        pageOrder.splice(pageIndex + 1, 0, action.page.id);
      } else {
        pageOrder.push(action.page.id);
      }
      manifest.pageOrder = pageOrder;
      const sourceIndex =
        action.afterPageId !== undefined
          ? state.pages.findIndex((p) => p.id === action.afterPageId)
          : -1;
      const pages = [...state.pages];
      if (sourceIndex >= 0) {
        pages.splice(sourceIndex + 1, 0, action.page);
      } else {
        pages.push(action.page);
      }
      return {
        ...state,
        manifest,
        pages,
        selectedPageId: action.page.id,
        dirty: withDirty(state.dirty, ["project", `page:${action.page.id}`]),
      };
    }
    case "ADD_SUB_MASTER_CHILD": {
      const parentMasterId = action.page.parentMasterId;
      if (!parentMasterId || parentMasterId === "global") return state;
      const parent = findEditablePage(state, parentMasterId);
      if (!parent || !isSubMasterPage(parent)) return state;
      const parentArchived = state.archivedPages.some(
        (p) => p.id === parentMasterId,
      );
      const manifest = clone(state.manifest);
      const archivedPageOrder = archivedPageOrderOf(manifest);
      if (parentArchived) {
        const existingArchivedChildren = state.archivedPages
          .filter((p) => p.parentMasterId === parentMasterId)
          .map((p) => p.id);
        const insertAfterId =
          existingArchivedChildren.length > 0
            ? existingArchivedChildren[existingArchivedChildren.length - 1]
            : parentMasterId;
        const insertAfterIdx = archivedPageOrder.indexOf(insertAfterId);
        archivedPageOrder.splice(
          insertAfterIdx >= 0 ? insertAfterIdx + 1 : archivedPageOrder.length,
          0,
          action.page.id,
        );
        manifest.archivedPageOrder = archivedPageOrder;
        const insertAfterPageIdx = state.archivedPages.findIndex(
          (p) => p.id === insertAfterId,
        );
        const archivedPages = [...state.archivedPages];
        archivedPages.splice(
          insertAfterPageIdx >= 0
            ? insertAfterPageIdx + 1
            : archivedPages.length,
          0,
          action.page,
        );
        return {
          ...state,
          manifest,
          archivedPages,
          selectedPageId: action.page.id,
          dirty: withDirty(state.dirty, ["project", `page:${action.page.id}`]),
        };
      }
      const existingChildren = childrenOfSubMaster(
        parentMasterId,
        allEditablePages(state),
        manifest.pageOrder,
      );
      const insertAfterId =
        existingChildren.length > 0
          ? existingChildren[existingChildren.length - 1]
          : parentMasterId;
      const insertAfterIdx = manifest.pageOrder.indexOf(insertAfterId);
      const newOrder = [...manifest.pageOrder];
      newOrder.splice(insertAfterIdx + 1, 0, action.page.id);
      manifest.pageOrder = newOrder;
      const insertAfterPageIdx = state.pages.findIndex(
        (p) => p.id === insertAfterId,
      );
      const pages = [...state.pages];
      pages.splice(
        insertAfterPageIdx >= 0 ? insertAfterPageIdx + 1 : pages.length,
        0,
        action.page,
      );
      return {
        ...state,
        manifest,
        pages,
        selectedPageId: action.page.id,
        dirty: withDirty(state.dirty, ["project", `page:${action.page.id}`]),
      };
    }
    case "MAKE_PAGE_SUB_MASTER": {
      const target = findEditablePage(state, action.pageId);
      if (!target || isSubMasterPage(target)) return state;

      const envSnapshot = materializePageEnvironmentSnapshot(state, target);
      const converted: PresentationPage = {
        ...target,
        parentMasterId: "global",
        envSnapshot,
        subMasterOrdinal: nextSubMasterOrdinal(allEditablePages(state)),
      };
      delete converted.layerOverrides;
      delete converted.visibilityOverrides;
      delete converted.sceneOverrides;

      const manifest = clone(state.manifest);
      let nextOrder = [...manifest.pageOrder];
      if (isSubMasterChildPage(target)) {
        const parentMasterId = target.parentMasterId!;
        const remainingChildren = childrenOfSubMaster(
          parentMasterId,
          state.pages,
          manifest.pageOrder,
        ).filter((id) => id !== target.id);
        nextOrder = nextOrder.filter((id) => id !== target.id);
        const insertAfterId =
          remainingChildren.length > 0
            ? remainingChildren[remainingChildren.length - 1]
            : parentMasterId;
        const insertAfterIdx = nextOrder.indexOf(insertAfterId);
        nextOrder.splice(
          insertAfterIdx >= 0 ? insertAfterIdx + 1 : nextOrder.length,
          0,
          target.id,
        );
      }
      manifest.pageOrder = nextOrder;
      const { pages, archivedPages } = mapEditablePages(state, (p) =>
        p.id === target.id ? converted : p,
      );
      return {
        ...state,
        manifest,
        pages,
        archivedPages,
        selectedPageId: target.id,
        dirty: withDirty(state.dirty, ["project", `page:${target.id}`]),
      };
    }
    case "DUPLICATE_SUB_MASTER_AS_CHILD": {
      const parentMasterId = action.page.parentMasterId;
      if (!parentMasterId || parentMasterId === "global") return state;
      const parent = findEditablePage(state, parentMasterId);
      if (!parent || !isSubMasterPage(parent)) return state;

      const manifest = clone(state.manifest);
      const parentArchived = state.archivedPages.some(
        (p) => p.id === parentMasterId,
      );
      if (parentArchived) {
        const archivedPageOrder = archivedPageOrderOf(manifest);
        const existingChildren = state.archivedPages
          .filter((p) => p.parentMasterId === parentMasterId)
          .map((p) => p.id);
        const insertAfterId =
          existingChildren.length > 0
            ? existingChildren[existingChildren.length - 1]
            : parentMasterId;
        const insertAfterIdx = archivedPageOrder.indexOf(insertAfterId);
        archivedPageOrder.splice(
          insertAfterIdx >= 0 ? insertAfterIdx + 1 : archivedPageOrder.length,
          0,
          action.page.id,
        );
        manifest.archivedPageOrder = archivedPageOrder;
        const insertAfterPageIdx = state.archivedPages.findIndex(
          (p) => p.id === insertAfterId,
        );
        const archivedPages = [...state.archivedPages];
        archivedPages.splice(
          insertAfterPageIdx >= 0
            ? insertAfterPageIdx + 1
            : archivedPages.length,
          0,
          action.page,
        );
        const overlays =
          action.overlayText !== undefined
            ? { ...state.overlays, [action.page.id]: action.overlayText }
            : state.overlays;
        const dirtyKeys: EntityKey[] = ["project", `page:${action.page.id}`];
        if (action.overlayText !== undefined) {
          dirtyKeys.push(`overlay:${action.page.id}`);
        }
        return {
          ...state,
          manifest,
          archivedPages,
          overlays,
          selectedPageId: action.page.id,
          dirty: withDirty(state.dirty, dirtyKeys),
        };
      }
      const existingChildren = childrenOfSubMaster(
        parentMasterId,
        allEditablePages(state),
        manifest.pageOrder,
      );
      const insertAfterId =
        existingChildren.length > 0
          ? existingChildren[existingChildren.length - 1]
          : parentMasterId;
      const insertAfterIdx = manifest.pageOrder.indexOf(insertAfterId);
      const newOrder = [...manifest.pageOrder];
      newOrder.splice(insertAfterIdx + 1, 0, action.page.id);
      manifest.pageOrder = newOrder;
      const insertAfterPageIdx = state.pages.findIndex(
        (p) => p.id === insertAfterId,
      );
      const pages = [...state.pages];
      pages.splice(
        insertAfterPageIdx >= 0 ? insertAfterPageIdx + 1 : pages.length,
        0,
        action.page,
      );
      const overlays =
        action.overlayText !== undefined
          ? { ...state.overlays, [action.page.id]: action.overlayText }
          : state.overlays;
      const dirtyKeys: EntityKey[] = ["project", `page:${action.page.id}`];
      if (action.overlayText !== undefined) {
        dirtyKeys.push(`overlay:${action.page.id}`);
      }
      return {
        ...state,
        manifest,
        pages,
        overlays,
        selectedPageId: action.page.id,
        dirty: withDirty(state.dirty, dirtyKeys),
      };
    }
    case "RE_SNAPSHOT_SUB_MASTER": {
      const target = findEditablePage(state, action.pageId);
      if (!target || !isSubMasterPage(target)) return state;
      const snapshot = clone(state.environment);
      const { pages, archivedPages } = mapEditablePages(state, (p) =>
        p.id === action.pageId ? { ...p, envSnapshot: snapshot } : p,
      );
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "DELETE_SUB_MASTER": {
      const target = findEditablePage(state, action.pageId);
      if (!target || !isSubMasterPage(target)) return state;
      const childIds = allEditablePages(state)
        .filter((p) => p.parentMasterId === target.id)
        .map((p) => p.id);
      const blockIds = new Set([target.id, ...childIds]);
      if (state.pages.filter((p) => !blockIds.has(p.id)).length < 1) return state;
      const oldIdxOfFirstBlockMember = state.manifest.pageOrder.findIndex(
        (id) => blockIds.has(id),
      );
      const manifest = clone(state.manifest);
      manifest.pageOrder = manifest.pageOrder.filter((id) => !blockIds.has(id));
      manifest.archivedPageOrder = archivedPageOrderOf(manifest).filter(
        (id) => !blockIds.has(id),
      );
      const pages = state.pages.filter((p) => !blockIds.has(p.id));
      const archivedPages = state.archivedPages.filter((p) => !blockIds.has(p.id));
      const previousId =
        oldIdxOfFirstBlockMember > 0
          ? state.manifest.pageOrder[oldIdxOfFirstBlockMember - 1]
          : null;
      const fallbackSelected =
        previousId && pages.some((p) => p.id === previousId)
          ? previousId
          : pages[0]?.id ?? null;
      const currentSelected = state.selectedPageId;
      const selectedPageId =
        typeof currentSelected === "string" && blockIds.has(currentSelected)
          ? fallbackSelected
          : currentSelected;
      return {
        ...state,
        manifest,
        pages,
        archivedPages,
        selectedPageId,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "SELECT_PAGE":
      return { ...state, selectedPageId: action.pageId };
    case "SET_OVERLAY_TEXT":
      return {
        ...state,
        overlays: { ...state.overlays, [action.pageId]: action.text },
        dirty: withDirty(state.dirty, `overlay:${action.pageId}`),
      };
    case "HYDRATE_OVERLAY":
      return {
        ...state,
        overlays: { ...state.overlays, [action.pageId]: action.text },
      };
    case "ADD_OVERLAY_IMAGE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const overlay: TextOverlayContainer = p.overlay ?? {
          position: "right",
          contentFile: `overlays/${p.id}/text.md`,
          images: [],
        };
        const images = Array.isArray(overlay.images)
          ? [...overlay.images]
          : [];
        images.push({
          file: `overlays/${p.id}/${action.file}`,
          caption: action.caption ?? "",
          position: "below-text",
        });
        return { ...p, overlay: { ...overlay, images } };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "REMOVE_OVERLAY_IMAGE": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const overlay: TextOverlayContainer = p.overlay ?? {};
        const images = Array.isArray(overlay.images)
          ? overlay.images.filter(
              (img) => img.file !== `overlays/${p.id}/${action.file}`,
            )
          : [];
        return { ...p, overlay: { ...overlay, images } };
      });
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "RESET_PAGE_OVERRIDES": {
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        if (p.id !== action.pageId) return p;
        const hadOverrides =
          p.layerOverrides !== undefined ||
          p.visibilityOverrides !== undefined ||
          p.cinematicExposure !== undefined ||
          p.bloomBoost !== undefined ||
          p.sunLockToCamera !== undefined;
        if (!hadOverrides) return p;
        const next: PresentationPage = { ...p };
        delete next.layerOverrides;
        delete next.visibilityOverrides;
        delete next.cinematicExposure;
        delete next.bloomBoost;
        delete next.sunLockToCamera;
        return next;
      });
      const changed =
        pages.some((p, i) => p !== state.pages[i]) ||
        archivedPages.some((p, i) => p !== state.archivedPages[i]);
      if (!changed) return state;
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "RESET_ALL_PAGE_OVERRIDES": {
      // Strip layerOverrides, visibilityOverrides, cinematicExposure, and
      // bloomBoost from every page. Keep camera, title, subtitle,
      // transition, holdDuration, overlay, annotations, presenterNotes
      // intact. Mark each modified page dirty so the save loop persists.
      const dirtyAdd: EntityKey[] = [];
      const { pages, archivedPages } = mapEditablePages(state, (p) => {
        const hadOverrides =
          p.layerOverrides !== undefined ||
          p.visibilityOverrides !== undefined ||
          p.cinematicExposure !== undefined ||
          p.bloomBoost !== undefined ||
          p.sunLockToCamera !== undefined;
        if (!hadOverrides) return p;
        dirtyAdd.push(`page:${p.id}` as EntityKey);
        const next: PresentationPage = { ...p };
        delete next.layerOverrides;
        delete next.visibilityOverrides;
        delete next.cinematicExposure;
        delete next.bloomBoost;
        delete next.sunLockToCamera;
        return next;
      });
      if (dirtyAdd.length === 0) return state;
      return {
        ...state,
        pages,
        archivedPages,
        dirty: withDirty(state.dirty, dirtyAdd),
      };
    }
    case "MARK_SAVED":
      return { ...state, dirty: withoutDirty(state.dirty, action.key) };
    case "SAVE_STATUS":
      return {
        ...state,
        saveStatus: action.status,
        saveError: action.error ?? null,
      };
    case "TOGGLE_PRESENTER_MODE":
      return { ...state, presenterMode: !state.presenterMode };
    default:
      return state;
  }
}

function newPageId(existingIds: string[]): string {
  let maxN = 0;
  for (const id of existingIds) {
    const m = /^(\d+)_/.exec(id);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  const n = String(maxN + 1).padStart(2, "0");
  return `${n}_page`;
}

function isExternalOrRootedAssetPath(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|data:|#|\/)/i.test(path);
}

function stripMarkdownUrlDecorations(path: string): string {
  return path
    .trim()
    .replace(/^<(.+)>$/, "$1")
    .replace(/^['"]|['"]$/g, "")
    .split("#")[0]
    .split("?")[0];
}

function overlayRelativeAssetPath(path: string, pageId: string): string | null {
  const clean = stripMarkdownUrlDecorations(path).replace(/\\/g, "/");
  if (!clean || isExternalOrRootedAssetPath(clean)) return null;
  const pagePrefix = `overlays/${pageId}/`;
  if (clean.startsWith(pagePrefix)) return clean.slice(pagePrefix.length);
  if (clean.startsWith("./")) return clean.slice(2);
  if (clean.startsWith("../") || clean.includes("/../")) return null;
  if (clean.startsWith("overlays/")) return null;
  return clean;
}

function markdownImageAssetPaths(markdown: string, pageId: string): string[] {
  const paths = new Set<string>();
  const imagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of markdown.matchAll(imagePattern)) {
    const relative = overlayRelativeAssetPath(match[1], pageId);
    if (relative) paths.add(relative);
  }
  return Array.from(paths);
}

function rewriteOverlayForDuplicate(
  page: PresentationPage,
  fromPageId: string,
  toPageId: string,
): PresentationPage {
  const next = clone(page);
  if (!next.overlay) return next;
  next.overlay = {
    ...next.overlay,
    contentFile: `overlays/${toPageId}/text.md`,
    images: Array.isArray(next.overlay.images)
      ? next.overlay.images.map((image) => {
          const relative = overlayRelativeAssetPath(image.file, fromPageId);
          return relative
            ? { ...image, file: `overlays/${toPageId}/${relative}` }
            : { ...image };
        })
      : next.overlay.images,
  };
  return next;
}

async function copyDuplicateOverlayAssets(
  projectRoot: string,
  fromPageId: string,
  toPageId: string,
  sourcePage: PresentationPage,
  overlayText: string | undefined,
): Promise<void> {
  const text =
    overlayText ??
    (await readFile(overlayMarkdownPath(fromPageId, projectRoot)).catch(
      () => null,
    ));
  if (overlayText === undefined && text !== null) {
    await copyFile(
      overlayMarkdownPath(fromPageId, projectRoot),
      overlayMarkdownPath(toPageId, projectRoot),
    );
  }

  const paths = new Set<string>();
  if (text) {
    for (const path of markdownImageAssetPaths(text, fromPageId)) {
      paths.add(path);
    }
  }
  for (const image of sourcePage.overlay?.images ?? []) {
    const relative = overlayRelativeAssetPath(image.file, fromPageId);
    if (relative) paths.add(relative);
  }

  await Promise.all(
    Array.from(paths).map((relative) =>
      copyFile(
        `${projectRoot}/overlays/${fromPageId}/${relative}`,
        `${projectRoot}/overlays/${toPageId}/${relative}`,
      ).catch((error) => {
        console.warn(
          `[editor] duplicate page could not copy overlay asset ${relative}:`,
          error,
        );
      }),
    ),
  );
}

interface ProviderProps {
  projectSlug: string;
  projectRoot: string;
  manifest: ProjectManifest;
  environment: EnvironmentSetup;
  pages: PresentationPage[];
  archivedPages?: PresentationPage[];
  sceneHandle: SceneHandle;
  children: ReactNode;
}

export function EditorProvider({
  projectSlug,
  projectRoot,
  manifest: initialManifest,
  environment: initialEnvironment,
  pages: initialPages,
  archivedPages: initialArchivedPages = [],
  sceneHandle,
  children,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    projectSlug,
    projectRoot,
    manifest: initialManifest,
    environment: normalizeMtBoundaryVisibilityEnvironment(initialEnvironment),
    pages: normalizeSubMasterAuthoringPages(initialPages),
    archivedPages: normalizeSubMasterAuthoringPages(initialArchivedPages),
    overlays: {},
    poseHistory: {},
    // Open the editor on the editor-only Global Settings pseudo-page so
    // first-load shows the world declaration, not whatever page is index 0.
    // The user can navigate into a presentation page from Pages.
    selectedPageId: ENVIRONMENT_SENTINEL,
    dirty: new Set<EntityKey>(),
    saveStatus: "idle" as const,
    saveError: null,
    presenterMode: false,
  }));

  const stateRef = useRef(state);
  const knownDiskContentRef = useRef<KnownDiskContent | null>(null);
  if (knownDiskContentRef.current === null) {
    knownDiskContentRef.current = buildInitialKnownDiskContent(
      projectRoot,
      initialManifest,
      initialEnvironment,
      initialPages,
      initialArchivedPages,
    );
  }
  const liveApplyTransitionActiveRef = useRef(false);
  const deferredLiveSceneApplyRef = useRef(false);
  stateRef.current = state;
  const editablePages = useMemo(() => allEditablePages(state), [
    state.pages,
    state.archivedPages,
  ]);

  const setLiveApplyTransitionActive = useCallback((active: boolean) => {
    liveApplyTransitionActiveRef.current = active;
  }, []);

  const canApplyLiveSceneEdits = useCallback(() => {
    if (liveApplyTransitionActiveRef.current) {
      deferredLiveSceneApplyRef.current = true;
      return false;
    }
    return true;
  }, []);

  const flushDeferredLiveSceneEdits = useCallback(() => {
    if (liveApplyTransitionActiveRef.current) return false;
    if (!deferredLiveSceneApplyRef.current) return false;
    deferredLiveSceneApplyRef.current = false;
    return true;
  }, []);

  // Hydrate overlay markdown for the selected presentation page (env has no
  // overlay).
  useEffect(() => {
    const pageId = state.selectedPageId;
    if (!pageId || pageId === ENVIRONMENT_SENTINEL) return;
    if (state.overlays[pageId] !== undefined) return;
    let cancelled = false;
    readFile(overlayMarkdownPath(pageId, state.projectRoot))
      .then((text) => {
        if (cancelled) return;
        rememberWrittenContent(
          knownDiskContentRef.current ?? {},
          overlayMarkdownPath(pageId, state.projectRoot),
          text,
        );
        dispatch({ type: "HYDRATE_OVERLAY", pageId, text: text ?? "" });
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn(`overlay read failed for ${pageId}:`, e);
        if (!cancelled) {
          dispatch({ type: "HYDRATE_OVERLAY", pageId, text: "" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.selectedPageId, state.overlays]);

  // Manual commit replaced auto-save (decided this session). The
  // commitPending function below iterates the dirty set and writes each
  // entity to disk in the right order. A Save button + Ctrl+S wired up
  // in EditorRoot trigger it; nothing fires automatically. The reducer
  // and per-entity dispatchers still set dirty bits exactly as before.
  const deletedPageIdsRef = useRef<Set<string>>(new Set());

  const commitPending = useCallback(async () => {
    const cur = stateRef.current;
    if (cur.dirty.size === 0) return;
    const snapshot = Array.from(cur.dirty);
    dispatch({ type: "SAVE_STATUS", status: "saving" });
    try {
      // Order: environment first, then pages/overlays, then project.json
      // last (project.json's "modified" timestamp acts as a coarse
      // commit marker for downstream tooling). Writes are batched through
      // the dev endpoint and dirty bits are only cleared after the whole
      // write set succeeds, so a failed save does not falsely mark partial
      // disk state as clean.
      const ordered = [
        ...snapshot.filter((k) => k === "environment"),
        ...snapshot.filter(
          (k) => k.startsWith("page:") || k.startsWith("overlay:"),
        ),
        ...snapshot.filter((k) => k === "project"),
      ];
      const knownDiskContent = knownDiskContentRef.current ?? {};
      const batchWrites: BatchWriteFile[] = [];
      const deletedPageIds =
        ordered.includes("project") || deletedPageIdsRef.current.size > 0
          ? Array.from(deletedPageIdsRef.current)
          : [];
      for (const key of ordered) {
        if (key === "project") {
          const m = stateRef.current.manifest;
          const path = projectJsonPath(cur.projectRoot);
          const content =
            JSON.stringify(
              { ...m, modified: new Date().toISOString() },
              null,
              2,
            ) + "\n";
          batchWrites.push({
            path,
            content,
            expectedContent: await expectedContentForSave(
              path,
              knownDiskContent,
            ),
          });
          for (const id of deletedPageIds) {
            const content = await readFile(pageJsonPath(id, cur.projectRoot)).catch(
              () => null,
            );
            if (content !== null) {
              const path = pageArchivePath(id, cur.projectRoot);
              batchWrites.push({
                path,
                content,
                expectedContent: await expectedContentForSave(
                  path,
                  knownDiskContent,
                ),
              });
            }
          }
        } else if (key === "environment") {
          const environmentForWrite = normalizeMtBoundaryVisibilityEnvironment(
            stateRef.current.environment,
          );
          const path = environmentJsonPath(cur.projectRoot);
          const content = JSON.stringify(environmentForWrite, null, 2) + "\n";
          batchWrites.push({
            path,
            content,
            expectedContent: await expectedContentForSave(
              path,
              knownDiskContent,
            ),
          });
        } else if (key.startsWith("page:")) {
          const id = key.slice(5);
          const page = findEditablePage(stateRef.current, id);
          if (!page) continue;
          const pageForWrite = normalizeMtBoundaryVisibilityPage(
            normalizeSubMasterAuthoringPage(page),
          );
          const path = pageJsonPath(id, cur.projectRoot);
          const content = JSON.stringify(pageForWrite, null, 2) + "\n";
          batchWrites.push({
            path,
            content,
            expectedContent: await expectedContentForSave(
              path,
              knownDiskContent,
            ),
          });
        } else if (key.startsWith("overlay:")) {
          const id = key.slice(8);
          const text = stateRef.current.overlays[id] ?? "";
          const path = overlayMarkdownPath(id, cur.projectRoot);
          batchWrites.push({
            path,
            content: text,
            expectedContent: await expectedContentForSave(
              path,
              knownDiskContent,
            ),
          });
        }
      }

      await writeFilesBatch(batchWrites);
      for (const write of batchWrites) {
        rememberWrittenContent(knownDiskContent, write.path, write.content);
      }
      for (const id of deletedPageIds) {
        await deleteFile(pageJsonPath(id, cur.projectRoot)).catch(() => {
          /* ignore */
        });
        rememberWrittenContent(
          knownDiskContent,
          pageJsonPath(id, cur.projectRoot),
          null,
        );
      }
      deletedPageIdsRef.current.clear();
      for (const key of ordered) {
        dispatch({ type: "MARK_SAVED", key });
      }
      dispatch({ type: "SAVE_STATUS", status: "idle" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      if (/write conflict|save conflict/i.test(msg)) {
        // eslint-disable-next-line no-console
        console.warn("[editor] save conflict:", msg);
      } else {
        // eslint-disable-next-line no-console
        console.error("[editor] save failed:", msg);
      }
      dispatch({ type: "SAVE_STATUS", status: "error", error: msg });
    }
  }, []);

  // beforeunload guard: when there are pending edits, the browser shows
  // its standard "Leave site?" confirm. Returns the handler so the
  // EditorRoot keyboard / button wiring stays simple.
  useEffect(() => {
    if (state.dirty.size === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the returned string but require it to be
      // non-empty (or returnValue set) to trigger the dialog.
      e.returnValue = "Unsaved changes will be lost.";
      return "Unsaved changes will be lost.";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state.dirty]);

  // ---- environment dispatchers ------------------------------------------

  const setEnvLayerStyle = useCallback<EditorContextValue["setEnvLayerStyle"]>(
    (layerId, style) => {
      // Live scene update: recompute effective style for the currently
      // displayed page (env base ⊕ page override) and apply.
      const cur = stateRef.current;
      const displayPage = findEditablePage(cur, cur.selectedPageId) ?? cur.pages[0];
      if (displayPage && canApplyLiveSceneEdits()) {
        const previewEnvironmentBase =
          cur.selectedPageId === ENVIRONMENT_SENTINEL;
        const nextEnvironment = syncActiveUserRenderPresetLayerStyle(
          {
            ...cur.environment,
            layerStyles: {
              ...cur.environment.layerStyles,
              [layerId]: {
                ...(cur.environment.layerStyles[layerId] ?? {}),
                ...style,
              },
            },
          },
          layerId,
          style,
        );
        const previewPage = previewEnvironmentBase
          ? {
              ...displayPage,
              layerOverrides: undefined,
            }
          : displayPage;
        const previewEnvironment = previewEnvironmentBase
          ? nextEnvironment
          : resolveEnvironmentForPage(
              nextEnvironment,
              allEditablePages(cur),
              displayPage,
            );
        sceneHandle.manager.applyStyle(
          layerId,
          effectiveStyle(previewEnvironment, previewPage, layerId),
        );
      }
      dispatch({ type: "SET_ENV_LAYER_STYLE", layerId, style });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const toggleEnvDefaultVisible = useCallback<
    EditorContextValue["toggleEnvDefaultVisible"]
  >(
    (layerId) => {
      const cur = stateRef.current;
      // Optimistic visibility update against the displayed page.
      const set = new Set(cur.environment.defaultVisibleLayers);
      if (set.has(layerId)) set.delete(layerId);
      else set.add(layerId);
      const displayPage = findEditablePage(cur, cur.selectedPageId) ?? cur.pages[0];
      if (displayPage && canApplyLiveSceneEdits()) {
        const nextDefaultVisibleLayers = Array.from(set);
        const visEnv =
          cur.selectedPageId === ENVIRONMENT_SENTINEL
            ? new Set(nextDefaultVisibleLayers)
            : effectiveVisibility(
                resolveEnvironmentForPage(
                  {
                    ...cur.environment,
                    defaultVisibleLayers: nextDefaultVisibleLayers,
                  },
                  allEditablePages(cur),
                  displayPage,
                ),
                displayPage,
              );
        sceneHandle.manager.setVisibleFaded(visEnv);
      }
      dispatch({ type: "TOGGLE_ENV_DEFAULT_VISIBLE", layerId });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const setEnvScene = useCallback<EditorContextValue["setEnvScene"]>(
    (patch) => {
      const cur = stateRef.current;
      const nextEnv = syncActiveUserRenderPresetScene(
        {
          ...cur.environment,
          scene: mergeSceneEdit(cur.environment.scene, patch),
        },
        patch,
      );
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyEnvironment(nextEnv);
      }
      dispatch({ type: "SET_ENV_SCENE", patch });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const setAuthoringScene = useCallback<
    EditorContextValue["setAuthoringScene"]
  >(
    (patch) => {
      const cur = stateRef.current;
      const page = findEditablePage(cur, cur.selectedPageId);
      if (!page) {
        setEnvScene(patch);
        return;
      }

      const nextPage = isSubMasterPage(page)
        ? {
            ...page,
            envSnapshot: {
              ...page.envSnapshot!,
              scene: mergeSceneEdit(page.envSnapshot?.scene, patch),
            },
          }
        : {
            ...page,
            sceneOverrides: mergeSceneEdit(page.sceneOverrides, patch),
          };
      const nextPages = allEditablePages(cur).map((candidate) =>
        candidate.id === nextPage.id ? nextPage : candidate,
      );
      const nextPageEnvironment = resolveEnvironmentForPage(
        cur.environment,
        nextPages,
        nextPage,
      );
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyEnvironment(nextPageEnvironment);
        sceneHandle.manager.applyPageScene(nextPage);
      }
      dispatch({
        type: "SET_PAGE_FIELD",
        pageId: nextPage.id,
        patch: isSubMasterPage(page)
          ? { envSnapshot: nextPage.envSnapshot }
          : { sceneOverrides: nextPage.sceneOverrides },
      });
    },
    [canApplyLiveSceneEdits, sceneHandle, setEnvScene],
  );

  const setEnvRenderPreset = useCallback<
    EditorContextValue["setEnvRenderPreset"]
  >(
    (renderPreset) => {
      const cur = stateRef.current;
      const nextEnv: EnvironmentSetup = { ...cur.environment };
      // Render presets are selector state only. Choosing Current / Custom
      // deletes the selector field and leaves authored scene/layer values
      // untouched so the original project look is restored.
      if (renderPreset) {
        nextEnv.renderPreset = renderPreset;
      } else {
        delete nextEnv.renderPreset;
      }
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyEnvironment(nextEnv);
      }
      dispatch({ type: "SET_ENV_RENDER_PRESET", renderPreset });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const saveEnvCustomRenderPreset = useCallback<
    EditorContextValue["saveEnvCustomRenderPreset"]
  >(() => {
    const cur = stateRef.current;
    const preset = createUserRenderPresetFromEnvironment(cur.environment);
    const nextEnv: EnvironmentSetup = {
      ...cur.environment,
      customRenderPresets: [
        ...(cur.environment.customRenderPresets ?? []),
        preset,
      ],
    };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyEnvironment(nextEnv);
    }
    dispatch({ type: "ADD_ENV_CUSTOM_RENDER_PRESET", preset });
    return preset.id;
  }, [canApplyLiveSceneEdits, sceneHandle]);

  const updateSelectedEnvCustomRenderPreset = useCallback<
    EditorContextValue["updateSelectedEnvCustomRenderPreset"]
  >(() => {
    const cur = stateRef.current;
    const selectedId = cur.environment.renderPreset;
    if (!selectedId) return false;
    const preset = updateUserRenderPresetFromEnvironment(
      cur.environment,
      selectedId,
    );
    if (!preset) return false;
    const nextEnv: EnvironmentSetup = {
      ...cur.environment,
      customRenderPresets: (cur.environment.customRenderPresets ?? []).map(
        (existing) => (existing.id === preset.id ? preset : existing),
      ),
    };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyEnvironment(nextEnv);
    }
    dispatch({ type: "UPDATE_ENV_CUSTOM_RENDER_PRESET", preset });
    return true;
  }, [canApplyLiveSceneEdits, sceneHandle]);

  // ---- scene overlay dispatchers ---------------------------------------
  // Each dispatcher computes the post-mutation env / page locally and
  // calls applySceneOverlaysForPage so the live scene reflects the edit
  // before React re-renders. Same optimistic-apply pattern as
  // setEnvLayerStyle.

  const applyOverlaysAfter = useCallback(
    (env: EnvironmentSetup, pages: PresentationPage[]) => {
      if (!canApplyLiveSceneEdits()) return;
      const sel = stateRef.current.selectedPageId;
      const page =
        (sel && sel !== ENVIRONMENT_SENTINEL
          ? pages.find((p) => p.id === sel)
          : null) ?? pages[0];
      if (page) sceneHandle.manager.applySceneOverlaysForPage(env, page);
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const setEnvSceneOverlayField = useCallback<
    EditorContextValue["setEnvSceneOverlayField"]
  >(
    (id, patch) => {
      const cur = stateRef.current;
      const reg = { ...(cur.environment.sceneOverlays ?? {}) };
      if (!reg[id]) return;
      reg[id] = { ...reg[id], ...patch };
      const nextEnv: EnvironmentSetup = {
        ...cur.environment,
        sceneOverlays: reg,
      };
      applyOverlaysAfter(nextEnv, cur.pages);
      dispatch({ type: "SET_ENV_SCENE_OVERLAY_FIELD", id, patch });
    },
    [applyOverlaysAfter],
  );

  const setEnvSceneOverlayProvenance = useCallback<
    EditorContextValue["setEnvSceneOverlayProvenance"]
  >(
    (id, patch) =>
      dispatch({ type: "SET_ENV_SCENE_OVERLAY_PROVENANCE", id, patch }),
    [],
  );

  const setPageSceneOverlay = useCallback<
    EditorContextValue["setPageSceneOverlay"]
  >(
    (pageId, overlayId, patch) => {
      const cur = stateRef.current;
      const nextPages = allEditablePages(cur).map((p) => {
        if (p.id !== pageId) return p;
        const refs = [...(p.sceneOverlays ?? [])];
        const idx = refs.findIndex((r) => r.id === overlayId);
        if (idx >= 0) refs[idx] = { ...refs[idx], ...patch };
        else refs.push({ id: overlayId, ...patch });
        return { ...p, sceneOverlays: refs };
      });
      applyOverlaysAfter(cur.environment, nextPages);
      dispatch({ type: "SET_PAGE_SCENE_OVERLAY", pageId, overlayId, patch });
    },
    [applyOverlaysAfter],
  );

  const removePageSceneOverlay = useCallback<
    EditorContextValue["removePageSceneOverlay"]
  >(
    (pageId, overlayId) => {
      const cur = stateRef.current;
      const nextPages = allEditablePages(cur).map((p) => {
        if (p.id !== pageId) return p;
        const refs = (p.sceneOverlays ?? []).filter((r) => r.id !== overlayId);
        const next: PresentationPage = { ...p };
        if (refs.length > 0) next.sceneOverlays = refs;
        else delete next.sceneOverlays;
        return next;
      });
      applyOverlaysAfter(cur.environment, nextPages);
      dispatch({ type: "REMOVE_PAGE_SCENE_OVERLAY", pageId, overlayId });
    },
    [applyOverlaysAfter],
  );

  const addEnvSceneOverlay = useCallback<
    EditorContextValue["addEnvSceneOverlay"]
  >(
    async (id, def) => {
      // Hot-load on the GPU first; if that fails (bad path, missing
      // image), the editor stays consistent because no dispatch ran.
      try {
        await sceneHandle.manager.addSceneOverlay(id, def);
      } catch (e) {
        console.error("[EditorContext] addSceneOverlay failed:", e);
        return;
      }
      dispatch({ type: "ADD_ENV_SCENE_OVERLAY", id, def });
    },
    [sceneHandle],
  );

  const removeEnvSceneOverlay = useCallback<
    EditorContextValue["removeEnvSceneOverlay"]
  >(
    (id) => {
      sceneHandle.manager.removeSceneOverlay(id);
      dispatch({ type: "REMOVE_ENV_SCENE_OVERLAY", id });
    },
    [sceneHandle],
  );

  // Bridge scene.ts's drag-mouseup to a state mutation. Registered
  // once on mount; updates env.json's bounds and asks the manager to
  // rebuild geometry against the new rectangle.
  useEffect(() => {
    sceneHandle.setOverlayBoundsCommitHandler((id, newBounds) => {
      const cur = stateRef.current;
      const reg = { ...(cur.environment.sceneOverlays ?? {}) };
      const def = reg[id];
      if (!def) return;
      reg[id] = { ...def, bounds: newBounds };
      const nextEnv: EnvironmentSetup = {
        ...cur.environment,
        sceneOverlays: reg,
      };
      void sceneHandle.manager.rebuildSceneOverlayBounds(id, newBounds);
      applyOverlaysAfter(nextEnv, cur.pages);
      dispatch({
        type: "SET_ENV_SCENE_OVERLAY_FIELD",
        id,
        patch: { bounds: newBounds },
      });
    });
    return () => sceneHandle.setOverlayBoundsCommitHandler(null);
  }, [sceneHandle, applyOverlaysAfter]);

  // Bridge scene.ts's lighting-handle drag commit to the environment lighting
  // source. The scene owns the live pointer preview; this keeps the saved data
  // as the single durable source of truth.
  useEffect(() => {
    sceneHandle.setLightingSourceCommitHandler((id, patch) => {
      const cur = stateRef.current;
      const selectedPageId = cur.selectedPageId;
      const page =
        selectedPageId && selectedPageId !== ENVIRONMENT_SENTINEL
          ? findEditablePage(cur, selectedPageId)
          : null;
      const pageEnvironment = page
        ? resolveEnvironmentForPage(cur.environment, allEditablePages(cur), page)
        : cur.environment;
      const scene = pageEnvironment.scene ?? {};
      const lighting = scene.lighting ?? {};
      const sources = lighting.sources ?? [];
      let changed = false;
      const nextSources = sources.map((source) => {
        if (source.id !== id) return source;
        changed = true;
        return { ...source, ...patch };
      });
      if (!changed) return;
      if (page) {
        dispatch({
          type: "SET_PAGE_FIELD",
          pageId: page.id,
          patch: {
            sceneOverrides: mergeSceneEdit(page.sceneOverrides, {
              lighting: { sources: nextSources },
            }),
          },
        });
      } else {
        dispatch({
          type: "SET_ENV_SCENE",
          patch: { lighting: { ...lighting, sources: nextSources } },
        });
      }
    });
    return () => sceneHandle.setLightingSourceCommitHandler(null);
  }, [sceneHandle]);

  // Area outlines are authored directly in the scene with move/scale handles.
  // Commit the previewed shape back into the active authoring scope so each
  // outline keeps its own saved center and radii.
  useEffect(() => {
    sceneHandle.setAreaOutlineCommitHandler((id, patch) => {
      const cur = stateRef.current;
      const page =
        cur.selectedPageId && cur.selectedPageId !== ENVIRONMENT_SENTINEL
          ? findEditablePage(cur, cur.selectedPageId)
          : null;
      const pageEnvironment = page
        ? resolveEnvironmentForPage(cur.environment, allEditablePages(cur), page)
        : cur.environment;
      const scene = pageEnvironment.scene ?? {};
      const outlines = scene.areaOutlines ?? [];
      let changed = false;
      const nextOutlines = outlines.map((outline) => {
        if (outline.id !== id) return outline;
        changed = true;
        return { ...outline, ...patch };
      });
      if (!changed) return;
      const nextEnv: EnvironmentSetup = {
        ...pageEnvironment,
        scene: { ...scene, areaOutlines: nextOutlines },
      };
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyEnvironment(nextEnv);
      }
      if (page) {
        dispatch({
          type: "SET_PAGE_FIELD",
          pageId: page.id,
          patch: {
            sceneOverrides: mergeSceneEdit(page.sceneOverrides, {
              areaOutlines: nextOutlines,
            }),
          },
        });
      } else {
        dispatch({
          type: "SET_ENV_SCENE",
          patch: { areaOutlines: nextOutlines },
        });
      }
    });
    return () => sceneHandle.setAreaOutlineCommitHandler(null);
  }, [canApplyLiveSceneEdits, sceneHandle]);

  // Local atmosphere cloud handles preview in the scene, then commit their
  // resolved bounds back through the active authoring scope.
  useEffect(() => {
    sceneHandle.setLocalAtmosphereCommitHandler((layerId, patch) => {
      const stylePatch = patch as Partial<EditableStyle>;
      const cur = stateRef.current;
      const page =
        cur.selectedPageId && cur.selectedPageId !== ENVIRONMENT_SENTINEL
          ? findEditablePage(cur, cur.selectedPageId)
          : null;
      const pageEnvironment = page
        ? resolveEnvironmentForPage(cur.environment, allEditablePages(cur), page)
        : cur.environment;
      const currentStyle = page
        ? effectiveStyle(pageEnvironment, page, layerId)
        : (pageEnvironment.layerStyles[layerId] ?? {});
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyStyle(layerId, {
          ...currentStyle,
          ...stylePatch,
        });
      }
      if (page) {
        dispatch({
          type: "SET_PAGE_LAYER_OVERRIDE",
          pageId: page.id,
          layerId,
          patch: stylePatch,
        });
      } else {
        dispatch({ type: "SET_ENV_LAYER_STYLE", layerId, style: stylePatch });
      }
    });
    return () => sceneHandle.setLocalAtmosphereCommitHandler(null);
  }, [canApplyLiveSceneEdits, sceneHandle]);

  useEffect(() => {
    sceneHandle.setSceneSectionPlaneCommitHandler((axis, positionM, frameId) => {
      const cur = stateRef.current;
      const selectedPageId = cur.selectedPageId;
      const page =
        selectedPageId && selectedPageId !== ENVIRONMENT_SENTINEL
          ? findEditablePage(cur, selectedPageId)
          : null;
      const layerId = "utah-forge-scene-section-planes";
      const pageEnvironment = page
        ? resolveEnvironmentForPage(cur.environment, allEditablePages(cur), page)
        : cur.environment;
      const currentStyle = page
        ? effectiveStyle(pageEnvironment, page, layerId)
        : (pageEnvironment.layerStyles[layerId] ?? {});
      const currentPlanes = currentStyle.sceneSectionPlanes ?? {};
      const targetFrameId = frameId ?? `axis:${axis}`;
      const isBuiltIn = targetFrameId === `axis:${axis}`;
      const currentFrames = Array.isArray(currentStyle.sceneSectionFrames)
        ? currentStyle.sceneSectionFrames
        : (["x", "y", "z"] as const).map((entryAxis) => ({
            id: `axis:${entryAxis}`,
            label: `${entryAxis.toUpperCase()} Section frame`,
            axis: entryAxis,
            plane: currentStyle.sceneSectionPlanes?.[entryAxis] ?? {},
            frame: currentStyle.sceneSectionFrameByAxis?.[entryAxis] ?? {},
          }));
      const nextFrames = currentFrames.map((entry) =>
        entry.id === targetFrameId
          ? {
              ...entry,
              axis,
              plane: {
                ...(entry.plane ?? {}),
                enabled: true,
                positionM,
              },
            }
          : entry,
      );
      const patch: Partial<EditableStyle> = {
        sceneSectionEnabled: true,
        sceneSectionActiveAxis: axis,
        sceneSectionActiveFrameId: targetFrameId,
        sceneSectionFrames: nextFrames,
        sceneSectionPlanes: isBuiltIn
          ? {
              ...currentPlanes,
              [axis]: {
                ...(currentPlanes[axis] ?? {}),
                enabled: true,
                positionM,
              },
            }
          : currentPlanes,
      };
      if (
        page &&
        selectedPageWriteBlocked(
          cur,
          page.id,
          liveApplyTransitionActiveRef.current,
        )
      ) {
        deferredLiveSceneApplyRef.current = true;
      }
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyStyle(layerId, { ...currentStyle, ...patch });
      }
      if (page) {
        dispatch({
          type: "SET_PAGE_LAYER_OVERRIDE",
          pageId: page.id,
          layerId,
          patch,
        });
      } else {
        dispatch({ type: "SET_ENV_LAYER_STYLE", layerId, style: patch });
      }
    });
    return () => sceneHandle.setSceneSectionPlaneCommitHandler(null);
  }, [canApplyLiveSceneEdits, sceneHandle]);

  useEffect(() => {
    sceneHandle.setSceneSectionWindowCommitHandler((axis, kind, valueM, frameId) => {
      const cur = stateRef.current;
      const selectedPageId = cur.selectedPageId;
      const page =
        selectedPageId && selectedPageId !== ENVIRONMENT_SENTINEL
          ? findEditablePage(cur, selectedPageId)
          : null;
      const layerId = "utah-forge-scene-section-planes";
      const pageEnvironment = page
        ? resolveEnvironmentForPage(cur.environment, allEditablePages(cur), page)
        : cur.environment;
      const currentStyle = page
        ? effectiveStyle(pageEnvironment, page, layerId)
        : (pageEnvironment.layerStyles[layerId] ?? {});
      const currentByAxis = currentStyle.sceneSectionWindowByAxis ?? {};
      const currentFrameByAxis = currentStyle.sceneSectionFrameByAxis ?? {};
      const targetFrameId = frameId ?? `axis:${axis}`;
      const isBuiltIn = targetFrameId === `axis:${axis}`;
      const currentFrames = Array.isArray(currentStyle.sceneSectionFrames)
        ? currentStyle.sceneSectionFrames
        : (["x", "y", "z"] as const).map((entryAxis) => ({
            id: `axis:${entryAxis}`,
            label: `${entryAxis.toUpperCase()} Section frame`,
            axis: entryAxis,
            plane: currentStyle.sceneSectionPlanes?.[entryAxis] ?? {},
            frame: currentStyle.sceneSectionFrameByAxis?.[entryAxis] ?? {},
          }));
      const currentFrame =
        currentFrames.find((entry) => entry.id === targetFrameId)?.frame ??
        currentFrameByAxis[axis] ??
        {};
      const frameKind =
        kind === "window-min" || kind === "frame-min-a"
          ? "minA"
          : kind === "window-max" || kind === "frame-max-a"
            ? "maxA"
            : kind === "frame-max-b"
              ? "maxB"
              : "minB";
      const framePatch =
        frameKind === "minA"
          ? { minAM: valueM }
          : frameKind === "maxA"
            ? { maxAM: valueM }
            : frameKind === "maxB"
              ? { maxBM: valueM }
              : { minBM: valueM };
      const nextFrame = {
        ...currentFrame,
        ...framePatch,
      };
      const nextFrames = currentFrames.map((entry) =>
        entry.id === targetFrameId
          ? {
              ...entry,
              axis,
              frame: nextFrame,
            }
          : entry,
      );
      const legacyPatch: Partial<EditableStyle> =
        isBuiltIn && (axis === "x" || axis === "y")
          ? {
              sceneSectionWindowEnabled: true,
              sceneSectionWindowActiveAxis: axis,
              sceneSectionWindowByAxis: {
                ...currentByAxis,
                [axis]: {
                  ...(currentByAxis[axis] ?? {}),
                  minAlongM: nextFrame.minAM ?? currentByAxis[axis]?.minAlongM,
                  maxAlongM: nextFrame.maxAM ?? currentByAxis[axis]?.maxAlongM,
                  bottomElevationM:
                    nextFrame.minBM ?? currentByAxis[axis]?.bottomElevationM,
                },
              },
            }
          : {};
      const patch: Partial<EditableStyle> = {
        sceneSectionEnabled: true,
        sceneSectionActiveAxis: axis,
        sceneSectionActiveFrameId: targetFrameId,
        sceneSectionFrameEnabled: true,
        sceneSectionFrames: nextFrames,
        sceneSectionFrameByAxis: isBuiltIn
          ? {
              ...currentFrameByAxis,
              [axis]: {
                ...nextFrame,
              },
            }
          : currentFrameByAxis,
        ...legacyPatch,
      };
      if (
        page &&
        selectedPageWriteBlocked(
          cur,
          page.id,
          liveApplyTransitionActiveRef.current,
        )
      ) {
        deferredLiveSceneApplyRef.current = true;
      }
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyStyle(layerId, { ...currentStyle, ...patch });
      }
      if (page) {
        dispatch({
          type: "SET_PAGE_LAYER_OVERRIDE",
          pageId: page.id,
          layerId,
          patch,
        });
      } else {
        dispatch({ type: "SET_ENV_LAYER_STYLE", layerId, style: patch });
      }
    });
    return () => sceneHandle.setSceneSectionWindowCommitHandler(null);
  }, [canApplyLiveSceneEdits, sceneHandle]);

  // Editor mode flag drives the manager's overlay drag UX (cursor +
  // outline brightening). Presenter mode keeps overlays read-only.
  useEffect(() => {
    sceneHandle.setEditorMode(!state.presenterMode);
  }, [sceneHandle, state.presenterMode]);

  const setLayerProvenance = useCallback<EditorContextValue["setLayerProvenance"]>(
    (layerId, metadata) =>
      dispatch({ type: "SET_LAYER_PROVENANCE", layerId, metadata }),
    [],
  );

  const addProjectLayer = useCallback<EditorContextValue["addProjectLayer"]>(
    (layer, style = {}, visible = true) => {
      const cur = stateRef.current;
      sceneHandle.manager.registerLayer(layer);
      if (canApplyLiveSceneEdits()) {
        sceneHandle.manager.applyStyle(layer.id, style);
        const nextEnvironment: EnvironmentSetup = {
          ...cur.environment,
          layerStyles: {
            ...cur.environment.layerStyles,
            [layer.id]: {
              ...(cur.environment.layerStyles[layer.id] ?? {}),
              ...style,
            },
          },
          defaultVisibleLayers:
            visible === false
              ? cur.environment.defaultVisibleLayers.filter(
                  (layerId) => layerId !== layer.id,
                )
              : Array.from(
                  new Set([...cur.environment.defaultVisibleLayers, layer.id]),
                ),
        };
        const displayPage =
          findEditablePage(cur, cur.selectedPageId) ??
          cur.pages[0];
        if (displayPage) {
          const pageEnvironment =
            cur.selectedPageId === ENVIRONMENT_SENTINEL
              ? nextEnvironment
              : resolveEnvironmentForPage(
                  nextEnvironment,
                  allEditablePages(cur),
                  displayPage,
                );
          sceneHandle.manager.applyStyle(
            layer.id,
            effectiveStyle(pageEnvironment, displayPage, layer.id),
          );
          sceneHandle.manager.setVisible(
            effectiveVisibility(pageEnvironment, displayPage),
          );
        }
      }
      dispatch({ type: "ADD_PROJECT_LAYER", layer, style, visible });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const removeProjectLayer = useCallback<
    EditorContextValue["removeProjectLayer"]
  >(
    (layerId) => {
      sceneHandle.manager.removeLayer(layerId);
      dispatch({ type: "REMOVE_PROJECT_LAYER", layerId });
    },
    [sceneHandle],
  );

  // ---- presentation-page delta dispatchers ------------------------------

  const setPageLayerOverride = useCallback<
    EditorContextValue["setPageLayerOverride"]
  >(
    (pageId, layerId, patch) => {
      // Live scene update for the currently displayed page only.
      const cur = stateRef.current;
      if (
        selectedPageWriteBlocked(
          cur,
          pageId,
          liveApplyTransitionActiveRef.current,
        )
      ) {
        deferredLiveSceneApplyRef.current = true;
      }
      if (cur.selectedPageId === pageId && canApplyLiveSceneEdits()) {
        const page = findEditablePage(cur, pageId);
        if (page) {
          const pageEnvironment = resolveEnvironmentForPage(
            cur.environment,
            allEditablePages(cur),
            page,
          );
          const nextLayerOverride = normalizeMtBoundaryVisibilityStyle({
            ...(page.layerOverrides?.[layerId] ?? {}),
            ...patch,
          });
          const merged = effectiveStyle(
            pageEnvironment,
            {
              ...page,
              layerOverrides: {
                ...(page.layerOverrides ?? {}),
                [layerId]: nextLayerOverride,
              },
            },
            layerId,
          );
          sceneHandle.manager.applyStyle(layerId, merged);
        }
      }
      dispatch({ type: "SET_PAGE_LAYER_OVERRIDE", pageId, layerId, patch });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const clearPageLayerOverride = useCallback<
    EditorContextValue["clearPageLayerOverride"]
  >(
    (pageId, layerId, field) => {
      const cur = stateRef.current;
      if (
        selectedPageWriteBlocked(
          cur,
          pageId,
          liveApplyTransitionActiveRef.current,
        )
      ) {
        deferredLiveSceneApplyRef.current = true;
      }
      if (cur.selectedPageId === pageId && canApplyLiveSceneEdits()) {
        const page = findEditablePage(cur, pageId);
        if (page) {
          const pageEnvironment = resolveEnvironmentForPage(
            cur.environment,
            allEditablePages(cur),
            page,
          );
          const overrides = { ...(page.layerOverrides ?? {}) };
          if (field === undefined) {
            delete overrides[layerId];
          } else {
            const layerOverride = { ...(overrides[layerId] ?? {}) };
            delete layerOverride[field];
            if (Object.keys(layerOverride).length === 0) {
              delete overrides[layerId];
            } else {
              overrides[layerId] = layerOverride;
            }
          }
          const nextPage: PresentationPage = {
            ...page,
            layerOverrides: overrides,
          };
          if (Object.keys(overrides).length === 0) {
            delete nextPage.layerOverrides;
          }
          sceneHandle.manager.applyStyle(
            layerId,
            effectiveStyle(pageEnvironment, nextPage, layerId),
          );
        }
      }
      dispatch({ type: "CLEAR_PAGE_LAYER_OVERRIDE", pageId, layerId, field });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const setPageVisibilityOverride = useCallback<
    EditorContextValue["setPageVisibilityOverride"]
  >(
    (pageId, layerId, visible) => {
      const cur = stateRef.current;
      if (
        selectedPageWriteBlocked(
          cur,
          pageId,
          liveApplyTransitionActiveRef.current,
        )
      ) {
        deferredLiveSceneApplyRef.current = true;
      }
      if (cur.selectedPageId === pageId && canApplyLiveSceneEdits()) {
        const page = findEditablePage(cur, pageId);
        if (page) {
          const pageEnvironment = resolveEnvironmentForPage(
            cur.environment,
            allEditablePages(cur),
            page,
          );
          const merged = effectiveVisibility(pageEnvironment, {
            ...page,
            visibilityOverrides: {
              ...(page.visibilityOverrides ?? {}),
              [layerId]: visible,
            },
          });
          sceneHandle.manager.setVisibleFaded(merged);
        }
      }
      dispatch({
        type: "SET_PAGE_VISIBILITY_OVERRIDE",
        pageId,
        layerId,
        visible,
      });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  const clearPageVisibilityOverride = useCallback<
    EditorContextValue["clearPageVisibilityOverride"]
  >(
    (pageId, layerId) => {
      const cur = stateRef.current;
      if (
        selectedPageWriteBlocked(
          cur,
          pageId,
          liveApplyTransitionActiveRef.current,
        )
      ) {
        deferredLiveSceneApplyRef.current = true;
      }
      if (cur.selectedPageId === pageId && canApplyLiveSceneEdits()) {
        const page = findEditablePage(cur, pageId);
        if (page) {
          const pageEnvironment = resolveEnvironmentForPage(
            cur.environment,
            allEditablePages(cur),
            page,
          );
          const overrides = { ...(page.visibilityOverrides ?? {}) };
          delete overrides[layerId];
          const merged = effectiveVisibility(pageEnvironment, {
            ...page,
            visibilityOverrides: overrides,
          });
          sceneHandle.manager.setVisibleFaded(merged);
        }
      }
      dispatch({ type: "CLEAR_PAGE_VISIBILITY_OVERRIDE", pageId, layerId });
    },
    [canApplyLiveSceneEdits, sceneHandle],
  );

  // ---- page metadata dispatchers ----------------------------------------

  const setPageField = useCallback<EditorContextValue["setPageField"]>(
    (pageId, patch) => dispatch({ type: "SET_PAGE_FIELD", pageId, patch }),
    [],
  );
  const setPageTransition = useCallback<EditorContextValue["setPageTransition"]>(
    (pageId, patch) => dispatch({ type: "SET_PAGE_TRANSITION", pageId, patch }),
    [],
  );
  const capturePoseForPage = useCallback<EditorContextValue["capturePoseForPage"]>(
    (pageId, pose, cameraObjectFocus) =>
      dispatch({ type: "CAPTURE_POSE", pageId, pose, cameraObjectFocus }),
    [],
  );

  const setPageOverlayLayout = useCallback<
    EditorContextValue["setPageOverlayLayout"]
  >(
    (pageId, layout) =>
      dispatch({ type: "SET_PAGE_OVERLAY_LAYOUT", pageId, layout }),
    [],
  );

  const setPageOverlayHidden = useCallback<
    EditorContextValue["setPageOverlayHidden"]
  >(
    (pageId, hidden) =>
      dispatch({ type: "SET_PAGE_OVERLAY_HIDDEN", pageId, hidden }),
    [],
  );

  const setPageOverlayTiming = useCallback<
    EditorContextValue["setPageOverlayTiming"]
  >(
    (pageId, timing) =>
      dispatch({ type: "SET_PAGE_OVERLAY_TIMING", pageId, timing }),
    [],
  );

  const addPage = useCallback<EditorContextValue["addPage"]>(
    (basePose) => {
      const cur = stateRef.current;
      const id = newPageId(allEditablePages(cur).map((p) => p.id));
      const page: PresentationPage = {
        id,
        title: "New page",
        camera: basePose,
        transition: { duration: 3000, easing: "easeInOutCubic" },
        holdDuration: 4000,
        sceneOverrides: pageAtmosphereSceneOverrides(
          currentAuthoringScene(cur),
        ),
      };
      dispatch({ type: "ADD_PAGE", page });
      return id;
    },
    [],
  );

  const duplicatePageById = useCallback<
    EditorContextValue["duplicatePageById"]
  >(
    (pageId) => {
      const cur = stateRef.current;
      const source = findEditablePage(cur, pageId);
      if (!source) return null;
      const id = newPageId(allEditablePages(cur).map((p) => p.id));
      const page: PresentationPage = {
        ...rewriteOverlayForDuplicate(source, source.id, id),
        id,
        title: `${source.title} duplicate`,
      };
      const overlayText = cur.overlays[pageId];
      dispatch({
        type: "ADD_PAGE",
        page,
        afterPageId: source.id,
        overlayText,
      });
      void copyDuplicateOverlayAssets(
        cur.projectRoot,
        source.id,
        id,
        source,
        overlayText,
      );
      return id;
    },
    [],
  );

  const deletePageById = useCallback<EditorContextValue["deletePageById"]>(
    (pageId) => {
      const cur = stateRef.current;
      const activeTarget = cur.pages.some((page) => page.id === pageId);
      if (activeTarget && cur.pages.length <= 1) return;
      deletedPageIdsRef.current.add(pageId);
      dispatch({ type: "DELETE_PAGE", pageId });
    },
    [],
  );

  const reorderPage = useCallback<EditorContextValue["reorderPage"]>(
    (pageId, direction) =>
      dispatch({ type: "REORDER_PAGE", pageId, direction }),
    [],
  );

  const movePageBlock = useCallback<EditorContextValue["movePageBlock"]>(
    (pageId, targetPageId, insertPosition) =>
      dispatch({ type: "MOVE_PAGE_BLOCK", pageId, targetPageId, insertPosition }),
    [],
  );

  const reorderLayer = useCallback<EditorContextValue["reorderLayer"]>(
    (orderedIds) => dispatch({ type: "REORDER_LAYER", orderedIds }),
    [],
  );

  const reorderSceneOverlay = useCallback<
    EditorContextValue["reorderSceneOverlay"]
  >(
    (pageId, orderedIds) =>
      dispatch({ type: "REORDER_PAGE_SCENE_OVERLAY", pageId, orderedIds }),
    [],
  );

  const archivePage = useCallback<EditorContextValue["archivePage"]>(
    (pageId, targetPageId, insertPosition) =>
      dispatch({ type: "ARCHIVE_PAGE", pageId, targetPageId, insertPosition }),
    [],
  );

  const restoreArchivedPage = useCallback<
    EditorContextValue["restoreArchivedPage"]
  >(
    (pageId, targetPageId, insertPosition) =>
      dispatch({
        type: "RESTORE_ARCHIVED_PAGE",
        pageId,
        targetPageId,
        insertPosition,
      }),
    [],
  );

  const moveArchivedPage = useCallback<EditorContextValue["moveArchivedPage"]>(
    (pageId, targetPageId, insertPosition) =>
      dispatch({
        type: "MOVE_ARCHIVED_PAGE",
        pageId,
        targetPageId,
        insertPosition,
      }),
    [],
  );

  const addSubMaster = useCallback<EditorContextValue["addSubMaster"]>(
    (basePose) => {
      const cur = stateRef.current;
      const id = newPageId(allEditablePages(cur).map((p) => p.id));
      const ordinal = nextSubMasterOrdinal(allEditablePages(cur));
      const envSnapshot = clone(cur.environment);
      const page: PresentationPage = {
        id,
        title: `Sub Master ${ordinal}`,
        camera: basePose,
        transition: { duration: 3000, easing: "easeInOutCubic" },
        holdDuration: 4000,
        parentMasterId: "global",
        envSnapshot,
        subMasterOrdinal: ordinal,
      };
      dispatch({ type: "ADD_SUB_MASTER", page });
      return id;
    },
    [],
  );

  const addSubMasterChild = useCallback<
    EditorContextValue["addSubMasterChild"]
  >((parentMasterId, basePose) => {
    const cur = stateRef.current;
    const parent = findEditablePage(cur, parentMasterId);
    if (!parent || !isSubMasterPage(parent)) return null;
    const id = newPageId(allEditablePages(cur).map((p) => p.id));
    const page: PresentationPage = {
      id,
      title: "New child",
      camera: basePose,
      transition: { duration: 3000, easing: "easeInOutCubic" },
      holdDuration: 4000,
      parentMasterId,
    };
    dispatch({ type: "ADD_SUB_MASTER_CHILD", page });
    return id;
  }, []);

  const makePageSubMaster = useCallback<
    EditorContextValue["makePageSubMaster"]
  >((pageId) => {
    dispatch({ type: "MAKE_PAGE_SUB_MASTER", pageId });
  }, []);

  const duplicateSubMasterAsChild = useCallback<
    EditorContextValue["duplicateSubMasterAsChild"]
  >((pageId) => {
    const cur = stateRef.current;
    const source = findEditablePage(cur, pageId);
    if (!source || !isSubMasterPage(source)) return null;
    const id = newPageId(allEditablePages(cur).map((p) => p.id));
    const page: PresentationPage = {
      ...rewriteOverlayForDuplicate(source, source.id, id),
      id,
      title: `${source.title} child`,
      parentMasterId: source.id,
    };
    delete page.envSnapshot;
    delete page.subMasterOrdinal;
    const overlayText = cur.overlays[pageId];
    dispatch({
      type: "DUPLICATE_SUB_MASTER_AS_CHILD",
      page,
      overlayText,
    });
    void copyDuplicateOverlayAssets(
      cur.projectRoot,
      source.id,
      id,
      source,
      overlayText,
    );
    return id;
  }, []);

  const reSnapshotSubMaster = useCallback<
    EditorContextValue["reSnapshotSubMaster"]
  >((pageId) => {
    dispatch({ type: "RE_SNAPSHOT_SUB_MASTER", pageId });
  }, []);

  const deleteSubMasterById = useCallback<
    EditorContextValue["deleteSubMasterById"]
  >((pageId) => {
    const cur = stateRef.current;
    const target = findEditablePage(cur, pageId);
    if (!target || !isSubMasterPage(target)) return;
    const blockIds = new Set(
      [pageId, ...allEditablePages(cur)
        .filter((p) => p.parentMasterId === pageId)
        .map((p) => p.id)],
    );
    if (cur.pages.filter((p) => !blockIds.has(p.id)).length < 1) return;
    // Track every id touched so commitPending can clean up the orphaned
    // page files on disk (same convention as deletePageById).
    for (const id of blockIds) {
      deletedPageIdsRef.current.add(id);
    }
    dispatch({ type: "DELETE_SUB_MASTER", pageId });
  }, []);

  const selectPage = useCallback<EditorContextValue["selectPage"]>(
    (pageId) => dispatch({ type: "SELECT_PAGE", pageId }),
    [],
  );

  const resetAllPageOverrides = useCallback<
    EditorContextValue["resetAllPageOverrides"]
  >(() => {
    // Just dispatch. The reducer produces a new pages array (only modified
    // page objects get new identity, unchanged ones keep theirs). That
    // identity change triggers PageController's [environment, pages, ...]
    // effect on the next render, which reapplies effective styles +
    // visibility + page mood for the *currently displayed* page (using
    // its real currentIndex). Camera and currentIndex are untouched.
    dispatch({ type: "RESET_ALL_PAGE_OVERRIDES" });
  }, []);

  const resetPageOverrides = useCallback<
    EditorContextValue["resetPageOverrides"]
  >((pageId) => {
    dispatch({ type: "RESET_PAGE_OVERRIDES", pageId });
  }, []);

  const setOverlayText = useCallback<EditorContextValue["setOverlayText"]>(
    (pageId, text) => dispatch({ type: "SET_OVERLAY_TEXT", pageId, text }),
    [],
  );

  const addOverlayImage = useCallback<EditorContextValue["addOverlayImage"]>(
    (pageId, fileName, caption) =>
      dispatch({ type: "ADD_OVERLAY_IMAGE", pageId, file: fileName, caption }),
    [],
  );

  const removeOverlayImage = useCallback<
    EditorContextValue["removeOverlayImage"]
  >(
    (pageId, fileName) =>
      dispatch({ type: "REMOVE_OVERLAY_IMAGE", pageId, file: fileName }),
    [],
  );

  const togglePresenterMode = useCallback(
    () => dispatch({ type: "TOGGLE_PRESENTER_MODE" }),
    [],
  );

  const getPoseHistory = useCallback(
    (pageId: string): readonly Pose[] =>
      stateRef.current.poseHistory[pageId] ?? [],
    [],
  );

  const restorePoseFromHistory = useCallback(
    (pageId: string, index: number) => {
      dispatch({ type: "RESTORE_POSE_FROM_HISTORY", pageId, index });
    },
    [],
  );

  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      allEditablePages: editablePages,
      sceneHandle,
      setEnvLayerStyle,
      toggleEnvDefaultVisible,
      setEnvScene,
      setAuthoringScene,
      setEnvRenderPreset,
      saveEnvCustomRenderPreset,
      updateSelectedEnvCustomRenderPreset,
      setEnvSceneOverlayField,
      setEnvSceneOverlayProvenance,
      addEnvSceneOverlay,
      removeEnvSceneOverlay,
      setPageSceneOverlay,
      removePageSceneOverlay,
      setLayerProvenance,
      addProjectLayer,
      removeProjectLayer,
      setPageLayerOverride,
      clearPageLayerOverride,
      setPageVisibilityOverride,
      clearPageVisibilityOverride,
      setPageField,
      setPageTransition,
      capturePoseForPage,
      setPageOverlayLayout,
      setPageOverlayTiming,
      setPageOverlayHidden,
      addPage,
      duplicatePageById,
      deletePageById,
      reorderPage,
      movePageBlock,
      reorderLayer,
      reorderSceneOverlay,
      archivePage,
      restoreArchivedPage,
      moveArchivedPage,
      addSubMaster,
      addSubMasterChild,
      makePageSubMaster,
      duplicateSubMasterAsChild,
      reSnapshotSubMaster,
      deleteSubMasterById,
      selectPage,
      resetAllPageOverrides,
      resetPageOverrides,
      setOverlayText,
      addOverlayImage,
      removeOverlayImage,
      togglePresenterMode,
      setLiveApplyTransitionActive,
      canApplyLiveSceneEdits,
      flushDeferredLiveSceneEdits,
      commitPending,
      getPoseHistory,
      restorePoseFromHistory,
    }),
    [
      state,
      editablePages,
      sceneHandle,
      setEnvLayerStyle,
      toggleEnvDefaultVisible,
      setEnvScene,
      setAuthoringScene,
      setEnvRenderPreset,
      saveEnvCustomRenderPreset,
      updateSelectedEnvCustomRenderPreset,
      setEnvSceneOverlayField,
      setEnvSceneOverlayProvenance,
      addEnvSceneOverlay,
      removeEnvSceneOverlay,
      setPageSceneOverlay,
      removePageSceneOverlay,
      setLayerProvenance,
      addProjectLayer,
      removeProjectLayer,
      setPageLayerOverride,
      clearPageLayerOverride,
      setPageVisibilityOverride,
      clearPageVisibilityOverride,
      setPageField,
      setPageTransition,
      capturePoseForPage,
      setPageOverlayLayout,
      setPageOverlayTiming,
      setPageOverlayHidden,
      addPage,
      duplicatePageById,
      deletePageById,
      reorderPage,
      movePageBlock,
      reorderLayer,
      reorderSceneOverlay,
      archivePage,
      restoreArchivedPage,
      moveArchivedPage,
      addSubMaster,
      addSubMasterChild,
      makePageSubMaster,
      duplicateSubMasterAsChild,
      reSnapshotSubMaster,
      deleteSubMasterById,
      selectPage,
      resetAllPageOverrides,
      resetPageOverrides,
      setOverlayText,
      addOverlayImage,
      removeOverlayImage,
      togglePresenterMode,
      setLiveApplyTransitionActive,
      canApplyLiveSceneEdits,
      flushDeferredLiveSceneEdits,
      commitPending,
      getPoseHistory,
      restorePoseFromHistory,
    ],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const v = useContext(EditorContext);
  if (!v) throw new Error("useEditor must be inside <EditorProvider>");
  return v;
}
