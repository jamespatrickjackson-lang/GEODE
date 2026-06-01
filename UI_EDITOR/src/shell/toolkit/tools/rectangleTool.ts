import type { ToolDescriptor } from "../toolTypes";

export const rectangleTool: ToolDescriptor = {
  id: "rectangle",
  label: "Rectangle",
  hint: "R",
  cursorCss: "crosshair",
  keyboardShortcut: "r",
  description: "Drag to draw a new rectangle Component. Shift = square.",
  isDrawing: true,
};
