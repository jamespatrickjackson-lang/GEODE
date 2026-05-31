import type { Severity } from "./validation";

export type ChangeState =
  | "Draft"
  | "Validated"
  | "Approved"
  | "Applied"
  | "Rejected"
  | "Archived";

export type ChangeRecordKind =
  | "component_added"
  | "component_removed"
  | "component_property_changed"
  | "container_added"
  | "container_removed"
  | "container_property_changed"
  | "container_reordered"
  | "frame_created"
  | "frame_removed"
  | "frame_resized"
  | "frame_property_changed"
  | "guide_added"
  | "guide_removed"
  | "guide_moved"
  | "library_entry_added"
  | "library_entry_edited"
  | "library_entry_removed"
  | "swatch_added"
  | "swatch_recoloured"
  | "token_added"
  | "token_changed"
  | "style_added"
  | "style_edited"
  | "style_removed"
  | "style_applied"
  | "style_detached"
  | "elements_grouped"
  | "elements_ungrouped"
  | "effects_changed"
  | "shadow_added"
  | "shadow_removed"
  | "rectangle_added"
  | "ellipse_added"
  | "line_added"
  | "image_placeholder_added"
  | "intent_edited"
  | "padding_changed"
  | "modal_state_changed"
  | "modal_overlay_added"
  | "modal_content_added"
  | "tabs_active_changed"
  | "tab_trigger_added"
  | "tab_content_added"
  | "dropdown_state_changed"
  | "menu_item_added"
  | "menu_item_removed"
  | "carousel_active_slide_changed"
  | "carousel_slide_added"
  | "carousel_slide_removed"
  | "toggle_pressed_changed"
  | "segmented_active_changed"
  | "button_loading_changed"
  | "validation_run"
  | "error_acknowledged"
  | "error_unacknowledged"
  | "state_advanced_to_validated"
  | "state_advanced_to_approved"
  | "state_demoted_to_draft"
  | "package_created"
  | "package_saved"
  | "package_exported"
  | "package_approved";

export interface ChangeRecordAffected {
  frameId?: string;
  containerIds?: string[];
  componentIds?: string[];
  swatchIds?: string[];
  tokenIds?: string[];
  styleIds?: string[];
  libraryEntryIds?: string[];
}

export interface ChangeRecord {
  id: string;
  timestamp: string;
  author?: string;
  kind: ChangeRecordKind;
  packageStateBefore: ChangeState;
  packageStateAfter: ChangeState;
  affected: ChangeRecordAffected;
  summary: string;
  rationale?: string;
  validation?: {
    findingCountBefore: number;
    findingCountAfter: number;
    worstSeverityBefore?: Severity;
    worstSeverityAfter?: Severity;
  };
  diff?: unknown;
  batchId?: string;
  editClass?: "schema" | "ephemeral";
}

export interface ChangeLogFile {
  schemaVersion: 1;
  records: ChangeRecord[];
}
