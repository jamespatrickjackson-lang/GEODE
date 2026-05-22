import { spawnSync } from "node:child_process";

const SNAPSHOT_SENSITIVE = "presentation-snapshot";
const RUNTIME_DATA = "runtime-data";
const VERIFICATION_SYSTEM = "verification-system";
const ENTRY_ROUTING = "entry-routing-docs";
const APP_CODE = "app-code";
const DOCS = "docs";
const OTHER = "other";
const POLICY_ARGS = new Set(["--commit", "--broad"]);

function parseArgs(argv) {
  const unknownArgs = argv.filter((arg) => !POLICY_ARGS.has(arg));
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }

  return {
    commit: argv.includes("--commit"),
    broad: argv.includes("--broad"),
  };
}

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

function formatGroupSet(groups) {
  return [...groups].sort().join(", ");
}

function evaluateCommitPolicy(stagedEntries) {
  console.log("\nCommit policy:");

  if (stagedEntries.length === 0) {
    console.log("  No staged paths; commit scope check has nothing to validate.");
    return false;
  }

  const stagedGroups = new Set(stagedEntries.map((entry) => classify(entry.path)));
  const groupList = formatGroupSet(stagedGroups);

  if (stagedGroups.has(SNAPSHOT_SENSITIVE) && stagedGroups.size > 1) {
    console.error(
      `  FAIL: snapshot-sensitive files are staged with other categories (${groupList}).`,
    );
    console.error(
      "  Stage snapshot changes separately from docs, tools, code, or data wiring.",
    );
    return true;
  }

  if (stagedGroups.size >= 3) {
    console.error(`  FAIL: staged paths span too many categories (${groupList}).`);
    console.error("  Split the commit or stage a tighter set of paths.");
    return true;
  }

  if (stagedGroups.size === 2) {
    console.log(
      `  WARN: staged paths span two categories (${groupList}); allowed because no snapshot-sensitive files are mixed.`,
    );
    return false;
  }

  console.log(`  PASS: staged paths are focused (${groupList}).`);
  return false;
}

function evaluateBroadPolicy(snapshotEntries) {
  console.log("\nBroad verification policy:");

  if (snapshotEntries.length > 0) {
    console.error(
      "  FAIL: snapshot-sensitive local files are dirty. Broad snapshot/browser verification would describe local sketch state.",
    );
    console.error("  Commit, stash, or intentionally exclude that sketch work first.");
    return true;
  }

  console.log("  PASS: no snapshot-sensitive local files detected.");
  return false;
}

function main() {
  const policy = parseArgs(process.argv.slice(2));
  const entries = parseStatus(git(["status", "--porcelain=v1"]));
  const snapshotEntries = entries.filter(
    (entry) => classify(entry.path) === SNAPSHOT_SENSITIVE,
  );
  const trackedEntries = entries.filter((entry) => entry.tracked);
  const untrackedEntries = entries.filter((entry) => !entry.tracked);
  const stagedEntries = entries.filter((entry) => entry.staged);
  const unstagedEntries = entries.filter(
    (entry) => entry.unstaged || !entry.tracked,
  );
  const hasSnapshotSketch = snapshotEntries.length > 0;

  console.log("Workspace state");
  console.log(`  tracked changes: ${trackedEntries.length}`);
  console.log(`  untracked files: ${untrackedEntries.length}`);
  console.log(`  snapshot-sensitive local files: ${snapshotEntries.length}`);
  console.log("\nState model:");
  console.log(
    `  committed repo state: ${entries.length === 0 ? "clean" : "has local changes"}`,
  );
  console.log(`  local sketch state: ${hasSnapshotSketch ? "present" : "none detected"}`);
  console.log(
    `  excluded user work candidates: ${unstagedEntries.length > 0 ? "present" : "none detected"}`,
  );
  console.log(`  accepted snapshot: ${hasSnapshotSketch ? "not current" : "current"}`);
  if (stagedEntries.length > 0) {
    console.log(`  staged paths: ${stagedEntries.length}`);
  }

  if (entries.length === 0) {
    console.log("\nClean workspace. Broad verification can be attributed to the committed tree.");
  } else {
    printGrouped(entries);

    console.log("\nVerification impact:");
    if (hasSnapshotSketch) {
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

  let failed = false;
  if (policy.commit) {
    failed = evaluateCommitPolicy(stagedEntries) || failed;
  }
  if (policy.broad) {
    failed = evaluateBroadPolicy(snapshotEntries) || failed;
  }

  if (failed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error("Workspace state check failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
