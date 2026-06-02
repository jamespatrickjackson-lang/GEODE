import type { Rect, ColourOrRef, BorderSpec } from "./primitives";
import type { Constraints } from "./anchor";
import type { Padding } from "./padding";
import type { Effects } from "./effects";
import type { IntentAnnotations } from "./intent";

export type ContainerArchetypeId =
  | "page-list-row"
  | "page-list-row-sub-master"
  | "page-list-row-sub-master-child"
  | "pseudo-page-bar"
  | "layer-card"
  | "layer-subsection"
  | "scene-section-frame-container"
  | "camera-studio-subcontainer"
  | "footer-action-row"
  | "cinematic-render-preset"
  | "container-group"
  | "modal-overlay"
  | "modal-content"
  | "tabs"
  | "tab-content"
  | "dropdown-menu"
  | "carousel"
  | "carousel-slide"
  | "segmented-control"
  | "container-blank";

export interface ContainerBase {
  id: string;
  name: string;
  archetype: ContainerArchetypeId | string;
  parentId: string | null;
  frameId: string;
  rect: Rect;
  constraints: Constraints;
  containerIds: string[];
  componentIds: string[];
  locked: boolean;
  hidden: boolean;
  fill?: ColourOrRef | null;
  border?: BorderSpec | null;
  padding?: Padding;
  styleRef?: string;
  effects?: Effects;
  hostRef?: string;
  rationale?: string;
  intent?: IntentAnnotations;
}

export interface PageListRowExtras {
  archetype: "page-list-row";
  role: "global-child";
  accentSwatchId?: string;
}

export interface PageListRowSubMasterExtras {
  archetype: "page-list-row-sub-master";
  role: "sub-master";
  accentSwatchId: string;
  subMasterOrdinal: number;
}

export interface PageListRowSubMasterChildExtras {
  archetype: "page-list-row-sub-master-child";
  role: "sub-master-child";
  accentSwatchId: string;
  parentMasterRowId: string;
}

export interface PseudoPageBarExtras {
  archetype: "pseudo-page-bar";
  role: "global-settings";
}

export interface LayerCardExtras {
  archetype: "layer-card";
  collapsedByDefault: boolean;
  layerKindHint?: string;
}

export interface LayerSubsectionExtras {
  archetype: "layer-subsection";
  summary: string;
  defaultOpen: boolean;
  disclosureKind: "native-details" | "aria-expanded";
}

export interface SceneSectionFrameContainerExtras {
  archetype: "scene-section-frame-container";
  axis: "x" | "y" | "z";
}

export interface CameraStudioSubcontainerExtras {
  archetype: "camera-studio-subcontainer";
  sectionKey: "focus-transition" | "perspective" | "vignette" | "image-finish" | "glow";
}

export interface FooterActionRowExtras {
  archetype: "footer-action-row";
  alignment: "left" | "centre" | "right";
}

export interface CinematicRenderPresetExtras {
  archetype: "cinematic-render-preset";
}

export interface ContainerGroupExtras {
  archetype: "container-group";
  groupName?: string;
  collapseInLayersPanel: boolean;
}

export interface ModalOverlayExtras {
  archetype: "modal-overlay";
  backdrop: {
    fill: ColourOrRef;
    blur?: number | { tokenRef: string };
  };
  dismissOnBackdropClick?: boolean;
}

export interface ModalContentExtras {
  archetype: "modal-content";
  modalKind?: "alert" | "confirm" | "form" | "info" | "destructive";
  trapFocus?: boolean;
  closeAffordance?: "x-button" | "esc-only" | "neither";
}

export interface TabsExtras {
  archetype: "tabs";
  activeTabId: string;
  orientation: "horizontal" | "vertical";
  triggerAlignment?: "start" | "centre" | "end" | "stretch";
}

export interface TabContentExtras {
  archetype: "tab-content";
  tabId: string;
}

export interface DropdownMenuExtras {
  archetype: "dropdown-menu";
  triggerLabel?: string;
  anchorPosition: "top" | "right" | "bottom" | "left";
  isOpen: boolean;
  dismissOnOutsideClick?: boolean;
}

export interface CarouselExtras {
  archetype: "carousel";
  activeSlideIndex: number;
  autoAdvance?: { intervalMs: number; pauseOnHover?: boolean };
  loop?: boolean;
}

export interface CarouselSlideExtras {
  archetype: "carousel-slide";
  slideIndex: number;
}

export interface SegmentedControlExtras {
  archetype: "segmented-control";
  activeSegmentId: string;
  orientation: "horizontal" | "vertical";
}

export interface ContainerBlankExtras {
  archetype: "container-blank";
}

export type ContainerExtras =
  | PageListRowExtras
  | PageListRowSubMasterExtras
  | PageListRowSubMasterChildExtras
  | PseudoPageBarExtras
  | LayerCardExtras
  | LayerSubsectionExtras
  | SceneSectionFrameContainerExtras
  | CameraStudioSubcontainerExtras
  | FooterActionRowExtras
  | CinematicRenderPresetExtras
  | ContainerGroupExtras
  | ModalOverlayExtras
  | ModalContentExtras
  | TabsExtras
  | TabContentExtras
  | DropdownMenuExtras
  | CarouselExtras
  | CarouselSlideExtras
  | SegmentedControlExtras
  | ContainerBlankExtras;

export type Container = ContainerBase & { extras?: ContainerExtras };

export interface ContainersFile {
  schemaVersion: 1;
  containers: Record<string, Container>;
}
