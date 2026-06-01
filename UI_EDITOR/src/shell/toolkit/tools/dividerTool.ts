import type { ToolDescriptor } from "../toolTypes";

export const dividerTool: ToolDescriptor = {
  id: "divider",
  label: "Divider",
  hint: "D",
  cursorCss: "crosshair",
  keyboardShortcut: "d",
  description: "Drag right or down to insert a horizontal or vertical Divider.",
  isDrawing: true,
};
