#!/usr/bin/env node
// Static preservation gate. Does not launch Claude or Codex, and does not
// assert actual instruction discovery. Must pass before router conversion.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  inspectAgentContracts,
  sharedAgentPaths,
  legacyClaudePaths,
} from "./lib/agent-contract-check.mjs";

const names = [
  ...sharedAgentPaths,
  ...legacyClaudePaths,
  "docs/CLAUDE.md",
  "docs/dev-context/Agent-Instruction-Consolidation-Plan.md",
];
const files = Object.fromEntries(names.map((name) => {
  const p = resolve(process.cwd(), name);
  return [name, existsSync(p) ? readFileSync(p, "utf8") : ""];
}));
const issues = inspectAgentContracts(files);
if (issues.length) {
  console.error("Agent-contract preservation check failed:");
  for (const issue of issues) console.error(" - " + issue);
  process.exitCode = 1;
} else {
  console.log("Agent-contract static preservation check passed (61 source groups; scoped contracts; Claude migration state).");
  console.log("Provider instruction loading has NOT been tested by this command.");
}
