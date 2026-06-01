import type { ToolDescriptor } from "../toolTypes";

export const ellipseTool: ToolDescriptor = {
  id: "ellipse",
  label: "Ellipse",
  hint: "O",
  cursorCss: "crosshair",
  keyboardShortcut: "o",
  description: "Drag to draw an ellipse. Shift = circle.",
  isDrawing: true,
};
