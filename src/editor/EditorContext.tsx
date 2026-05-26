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
import { effectiveStyle, effectiveVisibility } from "../pages/effective";
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
  /** Scene handle exposed for components that need direct GPU-side
   *  reads (e.g. the geology sub-layer panel reads the loaded units). */
  sceneHandle: SceneHandle;
  // Environment-mode dispatchers
  setEnvLayerStyle: (layerId: string, style: Partial<EditableStyle>) => void;
  toggleEnvDefaultVisible: (layerId: string) => void;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
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
      >
    >,
  ) => void;
  setPageTransition: (
    pageId: string,
    patch: Partial<{ duration: number; easing: EasingName }>,
  ) => void;
  capturePoseForPage: (pageId: string, pose: Pose) => void;
  setPageOverlayLayout: (
    pageId: string,
    layout: NonNullable<PresentationPage["overlayLayout"]>,
  ) => void;
  setPageOverlayTiming: (pageId: string, timing: TextOverlayTiming) => void;
  addPage: (basePose: Pose) => string;
  duplicatePageById: (pageId: string) => string | null;
  deletePageById: (pageId: string) => void;
  reorderPage: (pageId: string, direction: "up" | "down") => void;
  selectPage: (pageId: string | EnvironmentSentinel) => void;
  resetAllPageOverrides: () => void;
  resetPageOverrides: (pageId: string) => void;
  setOverlayText: (pageId: string, text: string) => void;
  addOverlayImage: (pageId: string, fileName: string, caption?: string) => void;
  removeOverlayImage: (pageId: string, fileName: string) => void;
  togglePresenterMode: () => void;
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

function withDirty(
  prev: ReadonlySet<EntityKey>,
  add: EntityKey | EntityKey[],
): Set<EntityKey> {
  const next = new Set(prev);
  for (const k of Array.isArray(add) ? add : [add]) next.add(k);
  return next;
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
  if (patch.gui !== undefined) next.gui = patch.gui;
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

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    // ---- environment ------------------------------------------------------
    case "SET_ENV_LAYER_STYLE": {
      let environment = clone(state.environment);
      environment.layerStyles[action.layerId] = {
        ...(environment.layerStyles[action.layerId] ?? {}),
        ...action.style,
      };
      environment = syncActiveUserRenderPresetLayerStyle(
        environment,
        action.layerId,
        action.style,
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
      const pages = state.pages.map((p) => {
        const refs = p.sceneOverlays ?? [];
        if (!refs.some((r) => r.id === action.id)) return p;
        const next: PresentationPage = { ...p };
        const filtered = refs.filter((r) => r.id !== action.id);
        if (filtered.length > 0) next.sceneOverlays = filtered;
        else delete next.sceneOverlays;
        dirty.add(`page:${p.id}`);
        return next;
      });
      return { ...state, environment, pages, dirty };
    }
    case "SET_PAGE_SCENE_OVERLAY": {
      const pages = state.pages.map((p) => {
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
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "REMOVE_PAGE_SCENE_OVERLAY": {
      const pages = state.pages.map((p) => {
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

    // ---- presentation-page deltas ----------------------------------------
    case "SET_PAGE_LAYER_OVERRIDE": {
      const pages = state.pages.map((p) => {
        if (p.id !== action.pageId) return p;
        const overrides = { ...(p.layerOverrides ?? {}) };
        overrides[action.layerId] = {
          ...(overrides[action.layerId] ?? {}),
          ...action.patch,
        };
        return { ...p, layerOverrides: overrides };
      });
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "CLEAR_PAGE_LAYER_OVERRIDE": {
      const pages = state.pages.map((p) => {
        if (p.id !== action.pageId) return p;
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
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_VISIBILITY_OVERRIDE": {
      const pages = state.pages.map((p) => {
        if (p.id !== action.pageId) return p;
        const overrides = { ...(p.visibilityOverrides ?? {}) };
        overrides[action.layerId] = action.visible;
        return { ...p, visibilityOverrides: overrides };
      });
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "CLEAR_PAGE_VISIBILITY_OVERRIDE": {
      const pages = state.pages.map((p) => {
        if (p.id !== action.pageId) return p;
        const overrides = { ...(p.visibilityOverrides ?? {}) };
        delete overrides[action.layerId];
        const next: PresentationPage = { ...p, visibilityOverrides: overrides };
        if (Object.keys(overrides).length === 0) delete next.visibilityOverrides;
        return next;
      });
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }

    // ---- page metadata (unchanged from Week 3) ----------------------------
    case "SET_PAGE_FIELD": {
      const pages = state.pages.map((p) =>
        p.id === action.pageId ? { ...p, ...action.patch } : p,
      );
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_TRANSITION": {
      const pages = state.pages.map((p) =>
        p.id === action.pageId
          ? { ...p, transition: { ...p.transition, ...action.patch } }
          : p,
      );
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "CAPTURE_POSE": {
      const pages = state.pages.map((p) =>
        p.id === action.pageId ? { ...p, camera: action.pose } : p,
      );
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
        poseHistory: { ...state.poseHistory, [action.pageId]: nextHistory },
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_OVERLAY_LAYOUT": {
      const pages = state.pages.map((p) =>
        p.id === action.pageId ? { ...p, overlayLayout: action.layout } : p,
      );
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "SET_PAGE_OVERLAY_TIMING": {
      const pages = state.pages.map((p) => {
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
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "RESTORE_POSE_FROM_HISTORY": {
      const history = state.poseHistory[action.pageId] ?? [];
      const pose = history[action.index];
      if (!pose) return state;
      const pages = state.pages.map((p) =>
        p.id === action.pageId ? { ...p, camera: pose } : p,
      );
      // Restoring does NOT push to history -- this entry already exists.
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "ADD_PAGE": {
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
          ? state.pages.findIndex((page) => page.id === action.afterPageId)
          : -1;
      const pages = [...state.pages];
      if (sourceIndex >= 0) {
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
        overlays,
        selectedPageId: action.page.id,
        dirty: withDirty(state.dirty, dirtyKeys),
      };
    }
    case "DELETE_PAGE": {
      if (state.pages.length <= 1) return state;
      const manifest = clone(state.manifest);
      manifest.pageOrder = manifest.pageOrder.filter(
        (id) => id !== action.pageId,
      );
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      const selectedPageId =
        state.selectedPageId === action.pageId
          ? pages[0]?.id ?? null
          : state.selectedPageId;
      return {
        ...state,
        manifest,
        pages,
        selectedPageId,
        dirty: withDirty(state.dirty, "project"),
      };
    }
    case "REORDER_PAGE": {
      const manifest = clone(state.manifest);
      const order = manifest.pageOrder;
      const idx = order.indexOf(action.pageId);
      if (idx < 0) return state;
      const swap = action.direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= order.length) return state;
      [order[idx], order[swap]] = [order[swap], order[idx]];
      const byId = new Map(state.pages.map((p) => [p.id, p]));
      const pages = order.map((id) => byId.get(id)!).filter(Boolean);
      return {
        ...state,
        manifest,
        pages,
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
      const pages = state.pages.map((p) => {
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
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "REMOVE_OVERLAY_IMAGE": {
      const pages = state.pages.map((p) => {
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
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "RESET_PAGE_OVERRIDES": {
      const pages = state.pages.map((p) => {
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
      const changed = pages.some((p, i) => p !== state.pages[i]);
      if (!changed) return state;
      return {
        ...state,
        pages,
        dirty: withDirty(state.dirty, `page:${action.pageId}`),
      };
    }
    case "RESET_ALL_PAGE_OVERRIDES": {
      // Strip layerOverrides, visibilityOverrides, cinematicExposure, and
      // bloomBoost from every page. Keep camera, title, subtitle,
      // transition, holdDuration, overlay, annotations, presenterNotes
      // intact. Mark each modified page dirty so the save loop persists.
      const dirtyAdd: EntityKey[] = [];
      const pages = state.pages.map((p) => {
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
      return { ...state, pages, dirty: withDirty(state.dirty, dirtyAdd) };
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
  sceneHandle: SceneHandle;
  children: ReactNode;
}

export function EditorProvider({
  projectSlug,
  projectRoot,
  manifest: initialManifest,
  environment: initialEnvironment,
  pages: initialPages,
  sceneHandle,
  children,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    projectSlug,
    projectRoot,
    manifest: initialManifest,
    environment: initialEnvironment,
    pages: initialPages,
    overlays: {},
    poseHistory: {},
    // Open the editor on the editor-only Global Settings pseudo-page so
    // first-load shows the world declaration, not whatever page is index 0.
    // The user can navigate into a presentation page from the Page Manager.
    selectedPageId: ENVIRONMENT_SENTINEL,
    dirty: new Set<EntityKey>(),
    saveStatus: "idle" as const,
    saveError: null,
    presenterMode: false,
  }));

  const stateRef = useRef(state);
  stateRef.current = state;

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
      const batchWrites: Array<{ path: string; content: string }> = [];
      const deletedPageIds =
        ordered.includes("project") || deletedPageIdsRef.current.size > 0
          ? Array.from(deletedPageIdsRef.current)
          : [];
      for (const key of ordered) {
        if (key === "project") {
          const m = stateRef.current.manifest;
          batchWrites.push({
            path: projectJsonPath(cur.projectRoot),
            content:
              JSON.stringify(
                { ...m, modified: new Date().toISOString() },
                null,
                2,
              ) + "\n",
          });
          for (const id of deletedPageIds) {
            const content = await readFile(pageJsonPath(id, cur.projectRoot)).catch(
              () => null,
            );
            if (content !== null) {
              batchWrites.push({
                path: pageArchivePath(id, cur.projectRoot),
                content,
              });
            }
          }
        } else if (key === "environment") {
          batchWrites.push({
            path: environmentJsonPath(cur.projectRoot),
            content: JSON.stringify(stateRef.current.environment, null, 2) + "\n",
          });
        } else if (key.startsWith("page:")) {
          const id = key.slice(5);
          const page = stateRef.current.pages.find((p) => p.id === id);
          if (!page) continue;
          batchWrites.push({
            path: pageJsonPath(id, cur.projectRoot),
            content: JSON.stringify(page, null, 2) + "\n",
          });
        } else if (key.startsWith("overlay:")) {
          const id = key.slice(8);
          const text = stateRef.current.overlays[id] ?? "";
          batchWrites.push({
            path: overlayMarkdownPath(id, cur.projectRoot),
            content: text,
          });
        }
      }

      await writeFilesBatch(batchWrites);
      for (const id of deletedPageIds) {
        await deleteFile(pageJsonPath(id, cur.projectRoot)).catch(() => {
          /* ignore */
        });
      }
      deletedPageIdsRef.current.clear();
      for (const key of ordered) {
        dispatch({ type: "MARK_SAVED", key });
      }
      dispatch({ type: "SAVE_STATUS", status: "idle" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error("[editor] save failed:", msg);
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
      const pageIdx = cur.pages.findIndex((p) => p.id === cur.selectedPageId);
      const displayPage =
        pageIdx >= 0 ? cur.pages[pageIdx] : cur.pages[0];
      if (displayPage) {
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
        sceneHandle.manager.applyStyle(
          layerId,
          effectiveStyle(nextEnvironment, previewPage, layerId),
        );
      }
      dispatch({ type: "SET_ENV_LAYER_STYLE", layerId, style });
    },
    [sceneHandle],
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
      const displayPage = cur.pages.find((p) => p.id === cur.selectedPageId)
        ?? cur.pages[0];
      if (displayPage) {
        const nextDefaultVisibleLayers = Array.from(set);
        const visEnv =
          cur.selectedPageId === ENVIRONMENT_SENTINEL
            ? new Set(nextDefaultVisibleLayers)
            : effectiveVisibility(
                {
                  ...cur.environment,
                  defaultVisibleLayers: nextDefaultVisibleLayers,
                },
                displayPage,
              );
        sceneHandle.manager.setVisible(visEnv);
      }
      dispatch({ type: "TOGGLE_ENV_DEFAULT_VISIBLE", layerId });
    },
    [sceneHandle],
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
      sceneHandle.manager.applyEnvironment(nextEnv);
      dispatch({ type: "SET_ENV_SCENE", patch });
    },
    [sceneHandle],
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
      sceneHandle.manager.applyEnvironment(nextEnv);
      dispatch({ type: "SET_ENV_RENDER_PRESET", renderPreset });
    },
    [sceneHandle],
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
    sceneHandle.manager.applyEnvironment(nextEnv);
    dispatch({ type: "ADD_ENV_CUSTOM_RENDER_PRESET", preset });
    return preset.id;
  }, [sceneHandle]);

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
    sceneHandle.manager.applyEnvironment(nextEnv);
    dispatch({ type: "UPDATE_ENV_CUSTOM_RENDER_PRESET", preset });
    return true;
  }, [sceneHandle]);

  // ---- scene overlay dispatchers ---------------------------------------
  // Each dispatcher computes the post-mutation env / page locally and
  // calls applySceneOverlaysForPage so the live scene reflects the edit
  // before React re-renders. Same optimistic-apply pattern as
  // setEnvLayerStyle.

  const applyOverlaysAfter = useCallback(
    (env: EnvironmentSetup, pages: PresentationPage[]) => {
      const sel = stateRef.current.selectedPageId;
      const page =
        (sel && sel !== ENVIRONMENT_SENTINEL
          ? pages.find((p) => p.id === sel)
          : null) ?? pages[0];
      if (page) sceneHandle.manager.applySceneOverlaysForPage(env, page);
    },
    [sceneHandle],
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
      const nextPages = cur.pages.map((p) => {
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
      const nextPages = cur.pages.map((p) => {
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
      const scene = cur.environment.scene ?? {};
      const lighting = scene.lighting ?? {};
      const sources = lighting.sources ?? [];
      let changed = false;
      const nextSources = sources.map((source) => {
        if (source.id !== id) return source;
        changed = true;
        return { ...source, ...patch };
      });
      if (!changed) return;
      dispatch({
        type: "SET_ENV_SCENE",
        patch: { lighting: { ...lighting, sources: nextSources } },
      });
    });
    return () => sceneHandle.setLightingSourceCommitHandler(null);
  }, [sceneHandle]);

  // Area outlines are authored directly in the scene with move/scale handles.
  // Commit the previewed shape back into env.json so each outline keeps its own
  // saved center and radii.
  useEffect(() => {
    sceneHandle.setAreaOutlineCommitHandler((id, patch) => {
      const cur = stateRef.current;
      const scene = cur.environment.scene ?? {};
      const outlines = scene.areaOutlines ?? [];
      let changed = false;
      const nextOutlines = outlines.map((outline) => {
        if (outline.id !== id) return outline;
        changed = true;
        return { ...outline, ...patch };
      });
      if (!changed) return;
      const nextEnv: EnvironmentSetup = {
        ...cur.environment,
        scene: { ...scene, areaOutlines: nextOutlines },
      };
      sceneHandle.manager.applyEnvironment(nextEnv);
      dispatch({
        type: "SET_ENV_SCENE",
        patch: { areaOutlines: nextOutlines },
      });
    });
    return () => sceneHandle.setAreaOutlineCommitHandler(null);
  }, [sceneHandle]);

  useEffect(() => {
    sceneHandle.setSceneSectionPlaneCommitHandler((axis, positionM) => {
      const cur = stateRef.current;
      const selectedPageId = cur.selectedPageId;
      const page =
        selectedPageId && selectedPageId !== ENVIRONMENT_SENTINEL
          ? cur.pages.find((candidate) => candidate.id === selectedPageId)
          : null;
      const layerId = "utah-forge-scene-section-planes";
      const currentStyle = page
        ? effectiveStyle(cur.environment, page, layerId)
        : (cur.environment.layerStyles[layerId] ?? {});
      const currentPlanes = currentStyle.sceneSectionPlanes ?? {};
      const patch: Partial<EditableStyle> = {
        sceneSectionEnabled: true,
        sceneSectionActiveAxis: axis,
        sceneSectionPlanes: {
          ...currentPlanes,
          [axis]: {
            ...(currentPlanes[axis] ?? {}),
            enabled: true,
            positionM,
          },
        },
      };
      sceneHandle.manager.applyStyle(layerId, { ...currentStyle, ...patch });
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
  }, [sceneHandle]);

  useEffect(() => {
    sceneHandle.setSceneSectionWindowCommitHandler((axis, kind, valueM) => {
      if (axis !== "x" && axis !== "y") return;
      const cur = stateRef.current;
      const selectedPageId = cur.selectedPageId;
      const page =
        selectedPageId && selectedPageId !== ENVIRONMENT_SENTINEL
          ? cur.pages.find((candidate) => candidate.id === selectedPageId)
          : null;
      const layerId = "utah-forge-scene-section-planes";
      const currentStyle = page
        ? effectiveStyle(cur.environment, page, layerId)
        : (cur.environment.layerStyles[layerId] ?? {});
      const currentByAxis = currentStyle.sceneSectionWindowByAxis ?? {};
      const currentWindow = currentByAxis[axis] ?? {};
      const windowPatch =
        kind === "window-min"
          ? { minAlongM: valueM }
          : kind === "window-max"
            ? { maxAlongM: valueM }
            : { bottomElevationM: valueM };
      const patch: Partial<EditableStyle> = {
        sceneSectionEnabled: true,
        sceneSectionActiveAxis: axis,
        sceneSectionWindowEnabled: true,
        sceneSectionWindowActiveAxis: axis,
        sceneSectionWindowByAxis: {
          ...currentByAxis,
          [axis]: {
            ...currentWindow,
            ...windowPatch,
          },
        },
      };
      sceneHandle.manager.applyStyle(layerId, { ...currentStyle, ...patch });
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
  }, [sceneHandle]);

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

  // ---- presentation-page delta dispatchers ------------------------------

  const setPageLayerOverride = useCallback<
    EditorContextValue["setPageLayerOverride"]
  >(
    (pageId, layerId, patch) => {
      // Live scene update for the currently displayed page only.
      const cur = stateRef.current;
      if (cur.selectedPageId === pageId) {
        const page = cur.pages.find((p) => p.id === pageId);
        if (page) {
          const merged = effectiveStyle(
            cur.environment,
            { ...page, layerOverrides: { ...(page.layerOverrides ?? {}), [layerId]: { ...(page.layerOverrides?.[layerId] ?? {}), ...patch } } },
            layerId,
          );
          sceneHandle.manager.applyStyle(layerId, merged);
        }
      }
      dispatch({ type: "SET_PAGE_LAYER_OVERRIDE", pageId, layerId, patch });
    },
    [sceneHandle],
  );

  const clearPageLayerOverride = useCallback<
    EditorContextValue["clearPageLayerOverride"]
  >(
    (pageId, layerId, field) => {
      const cur = stateRef.current;
      if (cur.selectedPageId === pageId) {
        const page = cur.pages.find((candidate) => candidate.id === pageId);
        if (page) {
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
            effectiveStyle(cur.environment, nextPage, layerId),
          );
        }
      }
      dispatch({ type: "CLEAR_PAGE_LAYER_OVERRIDE", pageId, layerId, field });
    },
    [sceneHandle],
  );

  const setPageVisibilityOverride = useCallback<
    EditorContextValue["setPageVisibilityOverride"]
  >(
    (pageId, layerId, visible) => {
      const cur = stateRef.current;
      if (cur.selectedPageId === pageId) {
        const page = cur.pages.find((p) => p.id === pageId);
        if (page) {
          const merged = effectiveVisibility(cur.environment, {
            ...page,
            visibilityOverrides: {
              ...(page.visibilityOverrides ?? {}),
              [layerId]: visible,
            },
          });
          sceneHandle.manager.setVisible(merged);
        }
      }
      dispatch({
        type: "SET_PAGE_VISIBILITY_OVERRIDE",
        pageId,
        layerId,
        visible,
      });
    },
    [sceneHandle],
  );

  const clearPageVisibilityOverride = useCallback<
    EditorContextValue["clearPageVisibilityOverride"]
  >(
    (pageId, layerId) => {
      const cur = stateRef.current;
      if (cur.selectedPageId === pageId) {
        const page = cur.pages.find((p) => p.id === pageId);
        if (page) {
          const overrides = { ...(page.visibilityOverrides ?? {}) };
          delete overrides[layerId];
          const merged = effectiveVisibility(cur.environment, {
            ...page,
            visibilityOverrides: overrides,
          });
          sceneHandle.manager.setVisible(merged);
        }
      }
      dispatch({ type: "CLEAR_PAGE_VISIBILITY_OVERRIDE", pageId, layerId });
    },
    [sceneHandle],
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
    (pageId, pose) => dispatch({ type: "CAPTURE_POSE", pageId, pose }),
    [],
  );

  const setPageOverlayLayout = useCallback<
    EditorContextValue["setPageOverlayLayout"]
  >(
    (pageId, layout) =>
      dispatch({ type: "SET_PAGE_OVERLAY_LAYOUT", pageId, layout }),
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
      const id = newPageId(stateRef.current.pages.map((p) => p.id));
      const page: PresentationPage = {
        id,
        title: "New page",
        camera: basePose,
        transition: { duration: 3000, easing: "easeInOutCubic" },
        holdDuration: 4000,
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
      const source = cur.pages.find((page) => page.id === pageId);
      if (!source) return null;
      const id = newPageId(cur.pages.map((p) => p.id));
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
      sceneHandle,
      setEnvLayerStyle,
      toggleEnvDefaultVisible,
      setEnvScene,
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
      setPageLayerOverride,
      clearPageLayerOverride,
      setPageVisibilityOverride,
      clearPageVisibilityOverride,
      setPageField,
      setPageTransition,
      capturePoseForPage,
      setPageOverlayLayout,
      setPageOverlayTiming,
      addPage,
      duplicatePageById,
      deletePageById,
      reorderPage,
      selectPage,
      resetAllPageOverrides,
      resetPageOverrides,
      setOverlayText,
      addOverlayImage,
      removeOverlayImage,
      togglePresenterMode,
      commitPending,
      getPoseHistory,
      restorePoseFromHistory,
    }),
    [
      state,
      sceneHandle,
      setEnvLayerStyle,
      toggleEnvDefaultVisible,
      setEnvScene,
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
      setPageLayerOverride,
      clearPageLayerOverride,
      setPageVisibilityOverride,
      clearPageVisibilityOverride,
      setPageField,
      setPageTransition,
      capturePoseForPage,
      setPageOverlayLayout,
      setPageOverlayTiming,
      addPage,
      duplicatePageById,
      deletePageById,
      reorderPage,
      selectPage,
      resetAllPageOverrides,
      resetPageOverrides,
      setOverlayText,
      addOverlayImage,
      removeOverlayImage,
      togglePresenterMode,
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
