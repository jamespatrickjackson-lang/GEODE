import type { ToolDescriptor } from "../toolTypes";

export const containerTool: ToolDescriptor = {
  id: "container",
  label: "Container",
  hint: "C",
  cursorCss: "crosshair",
  keyboardShortcut: "c",
  description: "Drag to draw a new empty Container.",
  isDrawing: true,
};
