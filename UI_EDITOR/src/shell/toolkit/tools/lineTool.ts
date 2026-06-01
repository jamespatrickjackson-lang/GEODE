import type { ToolDescriptor } from "../toolTypes";

export const lineTool: ToolDescriptor = {
  id: "line",
  label: "Line",
  hint: "L",
  cursorCss: "crosshair",
  keyboardShortcut: "l",
  description: "Drag for a free-angle line. Shift snaps to 15° increments.",
  isDrawing: true,
};
