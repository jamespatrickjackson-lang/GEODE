import { selectTool } from "./selectTool";
import { moveTool } from "./moveTool";
import { resizeTool } from "./resizeTool";
import { containerTool } from "./containerTool";
import { textTool } from "./textTool";
import { dividerTool } from "./dividerTool";
import { eyedropperTool } from "./eyedropperTool";
import { colourTool } from "./colourTool";
import { alignTool } from "./alignTool";
import { distributeTool } from "./distributeTool";
import { rectangleTool } from "./rectangleTool";
import { ellipseTool } from "./ellipseTool";
import { lineTool } from "./lineTool";
import type { ToolDescriptor, ToolId } from "../toolTypes";

export const ALL_TOOLS: readonly ToolDescriptor[] = [
  selectTool,
  moveTool,
  resizeTool,
  containerTool,
  textTool,
  dividerTool,
  eyedropperTool,
  colourTool,
  alignTool,
  distributeTool,
  rectangleTool,
  ellipseTool,
  lineTool,
];

export function toolById(id: ToolId): ToolDescriptor | undefined {
  return ALL_TOOLS.find((t) => t.id === id);
}

export {
  selectTool,
  moveTool,
  resizeTool,
  containerTool,
  textTool,
  dividerTool,
  eyedropperTool,
  colourTool,
  alignTool,
  distributeTool,
  rectangleTool,
  ellipseTool,
  lineTool,
};
