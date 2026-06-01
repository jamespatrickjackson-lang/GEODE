import type { ToolDescriptor } from "../toolTypes";

export const eyedropperTool: ToolDescriptor = {
  id: "eyedropper",
  label: "Eyedropper",
  hint: "I",
  cursorCss: "crosshair",
  keyboardShortcut: "i",
  description: "Sample a colour from the Canvas and add it to the Colour Library.",
  isDrawing: false,
};
