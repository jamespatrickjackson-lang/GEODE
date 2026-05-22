import { spawnSync } from "node:child_process";

const SNAPSHOT_SENSITIVE = "presentation-snapshot";
const RUNTIME_DATA = "runtime-data";
const VERIFICATION_SYSTEM = "verification-system";
const ENTRY_ROUTING = "entry-routing-docs";
const APP_CODE = "app-code";
const DOCS = "docs";
const OTHER = "other";

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    throw new Error(stderr || `git ${args.join(" ")} failed`);
  }

  return result.stdout;
}

function parsePath(rawPath) {
  if (rawPath.startsWith('"')) {
    try {
      return JSON.parse(rawPath);
    } catch {
      return rawPath.slice(1, -1);
    }
  }

  return rawPath;
}

function parseStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      const rawPath = line.slice(3);
      const path = parsePath(rawPath).replaceAll("\\", "/");
      return {
        path,
        status,
        tracked: status !== "??",
        staged: status[0] !== " " && status[0] !== "?",
        unstaged: status[1] !== " " && status[1] !== "?",
      };
    });
}

function classify(path) {
  if (
    /^projects\/[^/]+\/environment\.json$/.test(path) ||
    /^projects\/[^/]+\/pages\//.test(path) ||
    /^projects\/[^/]+\/overlays\//.test(path) ||
    /^projects\/[^/]+\/branding\//.test(path) ||
    /^data\/Marketing\//.test(path)
  ) {
    return SNAPSHOT_SENSITIVE;
  }

  if (
    /^projects\/[^/]+\/project\.json$/.test(path) ||
    /^projects\/[^/]+\/data\//.test(path) ||
    /^data\//.test(path)
  ) {
    return RUNTIME_DATA;
  }

  if (
    path === "package.json" ||
    path.startsWith("tools/") ||
    path.startsWith("tests/") ||
    path.startsWith("playwright.config.")
  ) {
    return VERIFICATION_SYSTEM;
  }

  if (
    path === "README.md" ||
    path === "CLAUDE.md" ||
    path === "docs/START-HERE.md" ||
    path === "docs/dev-context/Active-Build-Context.md"
  ) {
    return ENTRY_ROUTING;
  }

  if (path.startsWith("src/") || path.startsWith("plugins/")) {
    return APP_CODE;
  }

  if (path.startsWith("docs/") || path === "CHANGELOG.md") {
    return DOCS;
  }

  return OTHER;
}

function groupByClassification(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const group = classify(entry.path);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry);
  }
  return groups;
}

function formatEntry(entry) {
  return `${entry.status} ${entry.path}`;
}

function printEntries(title, entries) {
  if (entries.length === 0) return;

  console.log(title);
  for (const entry of entries) {
    console.log(`  ${formatEntry(entry)}`);
  }
}

function printGrouped(entries) {
  const groups = groupByClassification(entries);
  for (const [group, groupEntries] of groups.entries()) {
    printEntries(`\n${group}:`, groupEntries);
  }
}

function main() {
  const entries = parseStatus(git(["status", "--porcelain=v1"]));
  const snapshotEntries = entries.filter(
    (entry) => classify(entry.path) === SNAPSHOT_SENSITIVE,
  );
  const trackedEntries = entries.filter((entry) => entry.tracked);
  const untrackedEntries = entries.filter((entry) => !entry.tracked);

  console.log("Workspace state");
  console.log(`  tracked changes: ${trackedEntries.length}`);
  console.log(`  untracked files: ${untrackedEntries.length}`);
  console.log(`  snapshot-sensitive local files: ${snapshotEntries.length}`);

  if (entries.length === 0) {
    console.log("\nClean workspace. Broad verification can be attributed to the committed tree.");
    return;
  }

  printGrouped(entries);

  console.log("\nVerification impact:");
  if (snapshotEntries.length > 0) {
    console.log(
      "  Snapshot-sensitive local work is present. Snapshot and broad browser checks describe this local sketch state, not only the committed repo state.",
    );
  } else {
    console.log(
      "  No snapshot-sensitive local files detected. Broad verification is not limited by presentation sketch files.",
    );
  }

  console.log(
    "  For focused commits, stage exact paths and leave unrelated local work unstaged.",
  );
}

try {
  main();
} catch (error) {
  console.error("Workspace state check failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
