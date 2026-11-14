import assert from "node:assert/strict";
import test from "node:test";

import { inspectAgentContracts } from "../../tools/checks/lib/agent-contract-check.mjs";

const root = "AGENTS.md";
const scoped = ["projects", "src/editor", "src/scene", "docs"];
const legacyClaudePaths = ["CLAUDE.md", ...scoped.slice(0, 3).map((s) => `${s}/CLAUDE.md`)];
const baseline = "29d9c4c7eee77ac1b104289b09b1382c574145d0";
const groups = [
  ...Array.from({ length: 27 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 4 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 5 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 18 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`),
];

function fixture() {
  const files = {
    [root]: "# Shared agent contract\n\nUse authorized checkout with git rev-parse --show-toplevel.",
  };
  for (const scope of scoped) {
    files[`${scope}/AGENTS.md`] = `# ${scope} shared contract\n\nPreserve engineering safeguards.`;
  }
  for (const path of legacyClaudePaths) {
    files[path] = "# Legacy Claude contract\n\n## Scope\n" +
      "Keep established workspace and verification instructions. ".repeat(4) +
      "\n## Safety\nKeep protective rules intact.";
  }
  files["docs/dev-context/Agent-Instruction-Consolidation-Plan.md"] = groups.map((g) =>
    `| ${g} | [source](https://github.com/example/GEODE/blob/${baseline}/AGENTS.md#L1-L4) | rule | owner | preserved |`
  ).join("\n");
  return files;
}

test("accepts a fully preserved legacy Claude stage before verified router conversion", () => {
  assert.deepEqual(inspectAgentContracts(fixture()), []);
});

test("accepts a complete import-only Claude stage when every counterpart is converted", () => {
  const files = fixture();
  for (const path of legacyClaudePaths) files[path] = "@AGENTS.md\n";
  assert.deepEqual(inspectAgentContracts(files), []);
});

test("rejects a partial import conversion, even if every file exists", () => {
  const files = fixture();
  files["CLAUDE.md"] = "@AGENTS.md\n";
  assert.match(inspectAgentContracts(files).join("\n"), /partial Claude conversion/);
});

test("rejects a mixed import and substantive-policy file", () => {
  const files = fixture();
  for (const path of legacyClaudePaths) files[path] = "@AGENTS.md\n";
  files["src/editor/CLAUDE.md"] = "@AGENTS.md\n## Extra engineering policy\n";
  assert.match(inspectAgentContracts(files).join("\n"), /non-router content/);
});

test("rejects missing scoped contracts and duplicate or missing source groups", () => {
  const files = fixture();
  delete files["src/scene/AGENTS.md"];
  files["docs/dev-context/Agent-Instruction-Consolidation-Plan.md"] =
    files["docs/dev-context/Agent-Instruction-Consolidation-Plan.md"].replace("| D18 |", "| D17 |");
  const errors = inspectAgentContracts(files).join("\n");
  assert.match(errors, /missing shared agent contract.*src\/scene\/AGENTS.md/);
  assert.match(errors, /61 unique rule groups/);
});

test("rejects crosswalk links to moving branches or unpinned original sources", () => {
  const files = fixture();
  files["docs/dev-context/Agent-Instruction-Consolidation-Plan.md"] =
    files["docs/dev-context/Agent-Instruction-Consolidation-Plan.md"].replace(
      `/blob/${baseline}/`, "/blob/main/"
    );
  assert.match(inspectAgentContracts(files).join("\n"), /immutable original-source/);
});

test("rejects active auto-switch instructions in shared contract", () => {
  const files = fixture();
  files[root] += "\nIf missing, switch to C:\\GeoSee\\GeoSee_Dev before editing.";
  assert.match(inspectAgentContracts(files).join("\n"), /legacy checkout auto-switch/);
});
