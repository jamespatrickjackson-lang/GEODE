import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  Pose,
  ProjectManifest,
  ProjectLayerSpec,
  RenderPresetId,
  UserRenderPreset,
  EasingName,
  TextOverlayTiming,
  SceneProperties,
  SceneOverlayDef,
  SceneOverlayRef,
} from "../pages/types";

// Per-page rolling capture history. Lives in EditorContext state, in
// memory only (cleared on reload). FIFO, capped at 5 entries.
export const POSE_HISTORY_LIMIT = 5;

// Editor-internal types. The on-disk schema types stay in src/pages/types.ts;
// this file is only for runtime editor concerns.

// Sentinel for the "Global Settings" pseudo-page. selectedPageId can hold
// this string in place of a real page id when the editor is editing the
// environment. Keep it distinct from any plausible page id.
export const ENVIRONMENT_SENTINEL = "environment" as const;
export type EnvironmentSentinel = typeof ENVIRONMENT_SENTINEL;

// What's been changed-but-not-yet-saved. The save loop iterates this set
// and writes each entity to its own file path.
export type EntityKey =
  | "project"
  | "environment"
  | `page:${string}`
  | `overlay:${string}`;

export type SaveStatus = "idle" | "saving" | "error";

export interface EditorState {
  projectSlug: string;
  projectRoot: string;
  manifest: ProjectManifest;
  environment: EnvironmentSetup;
  pages: PresentationPage[];
  archivedPages: PresentationPage[];
  // Markdown text per page. Loaded from overlays/<id>/text.md on first
  // selection; held in memory until save flushes.
  overlays: Record<string, string>;
  selectedPageId: string | EnvironmentSentinel | null;
  // Rolling capture history per page (in-memory only). The Capture button's
  // dropdown reads from here; restoring an entry sets the page's camera
  // and marks the page dirty (manual save required).
  poseHistory: Record<string, Pose[]>;
  dirty: ReadonlySet<EntityKey>;
  saveStatus: SaveStatus;
  saveError: string | null;
  presenterMode: boolean;
}

export interface EditableProvenance {
  sourceFile?: string;
  sourceDate?: string;
  sourceOrigin?: string;
  classification?:
    | "observation"
    | "interpretation"
    | "environmental"
    | "narrative"
    | "planned";
  confidentiality?: "public" | "private";
  notes?: string;
  [k: string]: unknown;
}

export type EditorAction =
  // Environment-mode edits (selectedPageId === "environment"):
  | { type: "SET_ENV_LAYER_STYLE"; layerId: string; style: Partial<EditableStyle> }
  | { type: "TOGGLE_ENV_DEFAULT_VISIBLE"; layerId: string }
  | { type: "SET_ENV_SCENE"; patch: Partial<SceneProperties> }
  | { type: "SET_ENV_RENDER_PRESET"; renderPreset: RenderPresetId | null }
  | { type: "ADD_ENV_CUSTOM_RENDER_PRESET"; preset: UserRenderPreset }
  | { type: "UPDATE_ENV_CUSTOM_RENDER_PRESET"; preset: UserRenderPreset }

  // Scene overlay env-mode edits (registry lives on env.sceneOverlays).
  | {
      type: "SET_ENV_SCENE_OVERLAY_FIELD";
      id: string;
      patch: Partial<SceneOverlayDef>;
    }
  | {
      type: "SET_ENV_SCENE_OVERLAY_PROVENANCE";
      id: string;
      patch: Partial<SceneOverlayDef["provenance"]>;
    }
  | {
      type: "ADD_ENV_SCENE_OVERLAY";
      id: string;
      def: SceneOverlayDef;
    }
  | {
      type: "REMOVE_ENV_SCENE_OVERLAY";
      id: string;
    }

  // Scene overlay per-page activation. Adds/updates/removes the page's
  // ref in pageId.sceneOverlays.
  | {
      type: "SET_PAGE_SCENE_OVERLAY";
      pageId: string;
      overlayId: string;
      patch: Partial<SceneOverlayRef>;
    }
  | {
      type: "REMOVE_PAGE_SCENE_OVERLAY";
      pageId: string;
      overlayId: string;
    }

  // Provenance lives on the project manifest, not env, but is edited
  // through the LayerPanel. Stays project-keyed.
  | {
      type: "SET_LAYER_PROVENANCE";
      layerId: string;
      metadata: Partial<EditableProvenance>;
    }
  | {
      type: "ADD_PROJECT_LAYER";
      layer: ProjectLayerSpec;
      style?: Partial<EditableStyle>;
      visible?: boolean;
    }
  | {
      type: "REMOVE_PROJECT_LAYER";
      layerId: string;
    }

  // Presentation-page-mode edits: deltas against environment.
  | {
      type: "SET_PAGE_LAYER_OVERRIDE";
      pageId: string;
      layerId: string;
      patch: Partial<EditableStyle>;
    }
  | {
      type: "CLEAR_PAGE_LAYER_OVERRIDE";
      pageId: string;
      layerId: string;
      field?: keyof EditableStyle; // omit to clear whole layer entry
    }
  | {
      type: "SET_PAGE_VISIBILITY_OVERRIDE";
      pageId: string;
      layerId: string;
      visible: boolean;
    }
  | {
      type: "CLEAR_PAGE_VISIBILITY_OVERRIDE";
      pageId: string;
      layerId: string;
    }

  // Page-level metadata edits (unchanged from Week 3).
  | {
      type: "SET_PAGE_FIELD";
      pageId: string;
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
      >;
    }
  | {
      type: "SET_PAGE_TRANSITION";
      pageId: string;
      patch: Partial<{ duration: number; easing: EasingName }>;
    }
  | {
      type: "CAPTURE_POSE";
      pageId: string;
      pose: Pose;
      cameraObjectFocus?: PresentationPage["cameraObjectFocus"];
    }
  | { type: "RESTORE_POSE_FROM_HISTORY"; pageId: string; index: number }
  | {
      type: "SET_PAGE_OVERLAY_LAYOUT";
      pageId: string;
      layout: NonNullable<PresentationPage["overlayLayout"]>;
    }
  | {
      type: "SET_PAGE_OVERLAY_TIMING";
      pageId: string;
      timing: TextOverlayTiming;
    }
  | {
      type: "SET_PAGE_OVERLAY_HIDDEN";
      pageId: string;
      hidden: boolean;
    }
  | {
      type: "ADD_PAGE";
      page: PresentationPage;
      afterPageId?: string;
      overlayText?: string;
    }
  | { type: "DELETE_PAGE"; pageId: string }
  | { type: "REORDER_PAGE"; pageId: string; direction: "up" | "down" }
  // Dev Mode Inspector UI-only arrangement (key "d"). Reorders the editor-side
  // catalog arrays for sidebar display. The scene/transition runtime resolves
  // layers and overlays by id (Maps), so this has no render/transition effect.
  // orderedIds is the new desired order of a sidebar group's members (e.g. a
  // layer category, or a page's overlays). Reordering by id set is robust to the
  // sidebar's category grouping, where a row index != the catalog array index.
  | { type: "REORDER_LAYER"; orderedIds: string[] }
  | { type: "REORDER_SCENE_OVERLAY"; orderedIds: string[] }
  | {
      type: "MOVE_PAGE_BLOCK";
      pageId: string;
      targetPageId: string;
      insertPosition?: "before" | "after";
    }
  | {
      type: "ARCHIVE_PAGE";
      pageId: string;
      targetPageId?: string;
      insertPosition?: "before" | "after";
    }
  | {
      type: "RESTORE_ARCHIVED_PAGE";
      pageId: string;
      targetPageId?: string;
      insertPosition?: "before" | "after";
    }
  | {
      type: "MOVE_ARCHIVED_PAGE";
      pageId: string;
      targetPageId: string;
      insertPosition?: "before" | "after";
    }
  // Sub Master page hierarchy (DEC-079). ADD_SUB_MASTER creates a new
  // renderable page that snapshots the current global environment and acts
  // as the inheritance base for its own children. ADD_SUB_MASTER_CHILD
  // creates a regular page parented to that Sub Master. MAKE_PAGE_SUB_MASTER
  // converts an existing page into a frozen Sub Master. DUPLICATE_SUB_MASTER_AS_CHILD
  // copies a Sub Master into a regular child under that master. RE_SNAPSHOT
  // replaces only the Sub Master's frozen envSnapshot (preserving its own
  // page-level overrides). DELETE_SUB_MASTER cascade-deletes the master and
  // every page whose parentMasterId references it.
  | { type: "ADD_SUB_MASTER"; page: PresentationPage; afterPageId?: string }
  | { type: "ADD_SUB_MASTER_CHILD"; page: PresentationPage }
  | { type: "MAKE_PAGE_SUB_MASTER"; pageId: string }
  | {
      type: "DUPLICATE_SUB_MASTER_AS_CHILD";
      page: PresentationPage;
      overlayText?: string;
    }
  | { type: "RE_SNAPSHOT_SUB_MASTER"; pageId: string }
  | { type: "DELETE_SUB_MASTER"; pageId: string }
  | { type: "SELECT_PAGE"; pageId: string | EnvironmentSentinel }
  | { type: "SET_OVERLAY_TEXT"; pageId: string; text: string }
  | {
      type: "ADD_OVERLAY_IMAGE";
      pageId: string;
      file: string;
      caption?: string;
    }
  | { type: "REMOVE_OVERLAY_IMAGE"; pageId: string; file: string }
  | { type: "RESET_PAGE_OVERRIDES"; pageId: string }
  | { type: "RESET_ALL_PAGE_OVERRIDES" }
  | { type: "MARK_SAVED"; key: EntityKey }
  | { type: "SAVE_STATUS"; status: SaveStatus; error?: string | null }
  | { type: "TOGGLE_PRESENTER_MODE" }
  | { type: "HYDRATE_OVERLAY"; pageId: string; text: string };
