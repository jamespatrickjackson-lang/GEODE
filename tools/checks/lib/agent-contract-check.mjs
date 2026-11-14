// Pure static policy checker. Agent-runtime discovery is NOT established by this check.
export const sharedAgentPaths = [
  "AGENTS.md",
  "projects/AGENTS.md",
  "src/editor/AGENTS.md",
  "src/scene/AGENTS.md",
  "docs/AGENTS.md",
];

export const legacyClaudePaths = [
  "CLAUDE.md",
  "projects/CLAUDE.md",
  "src/editor/CLAUDE.md",
  "src/scene/CLAUDE.md",
];

const crosswalkPath = "docs/dev-context/Agent-Instruction-Consolidation-Plan.md";
const sourceBaseline = "29d9c4c7eee77ac1b104289b09b1382c574145d0";

const expectedIds = [
  ...Array.from({ length: 27 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 4 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 5 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 18 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`),
];

function normalized(file) {
  return (file ?? "").replace(/^\uFEFF/, "").trim();
}

export function inspectAgentContracts(files) {
  const errors = [];
  for (const file of sharedAgentPaths) {
    if (!normalized(files[file])) {
      errors.push(`missing shared agent contract: ${file}`);
    }
  }

  const root = normalized(files["AGENTS.md"]);
  if (/\bswitch to[^\n]*C:\\GeoSee\\GeoSee_Dev/i.test(root)) {
    errors.push("legacy checkout auto-switch still present in shared AGENTS.md");
  }

  let routerCount = 0;
  for (const file of legacyClaudePaths) {
    const body = normalized(files[file]);
    if (!body) {
      errors.push(`missing Claude entry: ${file}`);
      continue;
    }
    if (body === "@AGENTS.md") {
      routerCount += 1;
      continue;
    }
    if (body.includes("@AGENTS.md")) {
      errors.push(`non-router content mixed with @AGENTS.md import in ${file}`);
      continue;
    }
    // During migration, the unconverted Claude contract remains substantive.
    if (body.length < 120 || !/^## /m.test(body)) {
      errors.push(`unrecognized substantive Claude contract: ${file}`);
    }
  }
  if (routerCount > 0 && routerCount < legacyClaudePaths.length) {
    errors.push(`partial Claude conversion: ${routerCount}/${legacyClaudePaths.length} router entries; convert atomically only after runtime validation`);
  }
  const optionalDocsClaude = normalized(files["docs/CLAUDE.md"]);
  if (optionalDocsClaude && optionalDocsClaude !== "@AGENTS.md") {
    errors.push("non-router content in optional docs/CLAUDE.md");
  }

  const plan = normalized(files[crosswalkPath]);
  if (!plan) {
    errors.push(`missing preservation crosswalk: ${crosswalkPath}`);
  } else {
    const rows = plan.split(/\r?\n/).filter((line) =>
      /^\|\s*[RPESD]\d{2}\s*\|/.test(line)
    );
    const ids = rows.map((row) => row.match(/^\|\s*([RPESD]\d{2})\s*\|/)[1]);
    const idSet = new Set(ids);
    if (ids.length !== 61 || idSet.size !== 61 ||
        expectedIds.some((id) => !idSet.has(id))) {
      errors.push(`expected 61 unique rule groups (R27/P04/E07/S05/D18); got ${ids.length} rows / ${idSet.size} unique`);
    }
    for (const row of rows) {
      if (!row.includes(`/blob/${sourceBaseline}/`)) {
        errors.push(`missing immutable original-source link in crosswalk row ${row.slice(0, 12).trim()}`);
      }
    }
  }
  return errors;
}
