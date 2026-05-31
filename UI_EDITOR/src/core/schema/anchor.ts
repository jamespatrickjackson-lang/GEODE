export type AnchorKind = "left" | "right" | "centre" | "scale" | "stretch";

export type ConstraintKind = AnchorKind;

export interface Constraints {
  horizontal: AnchorKind;
  vertical: AnchorKind;
}

export const DEFAULT_CONSTRAINTS: Constraints = {
  horizontal: "left",
  vertical: "left",
};

export interface AnchorLine {
  axis: "x" | "y";
  position: number;
  sourceKind:
    | "frame-edge"
    | "frame-centre"
    | "safe-area"
    | "container-edge"
    | "container-centre"
    | "component-edge"
    | "component-centre"
    | "guide";
  sourceId?: string;
}
