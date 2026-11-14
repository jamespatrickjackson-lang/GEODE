import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const scanRoots = ["README.md", "AGENTS.md", "CLAUDE.md", "docs", "projects", "src", "tests"];
const allowedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
]);

const excludedPathFragments = [
  "docs/dev-context/templates/",
  "projects/utah-forge/artifact_metadata/",
  "node_modules/",
  "dist/",
  "test-results/",
  "playwright-report/",
  ".git/",
];

const lineChecks = [
  { label: "_untitled identifier", pattern: /_untitled\b/ },
  { label: "Untitled page label", pattern: /Untitled page/ },
  { label: "manual freshness marker", pattern: /^Last updated:/i },
  { label: "manual freshness marker", pattern: /^Last populated:/i },
  { label: "manual freshness marker", pattern: /^Updated:/i },
  { label: "manual freshness marker", pattern: /^Date:/i },
  {
    label: "candidate-stale wrapper",
    pattern: /Candidate-stale orientation note/i,
  },
  { label: "removed receipt anchor", pattern: /VER-2026-05-15/ },
  { label: "removed receipt anchor", pattern: /VER-2026-05-16/ },
  {
    label: "stale seismic contradiction",
    pattern: /No seismic output is active|seismic is blocked/i,
  },
  { label: "old decision reference", pattern: /supersedes\s+#[0-9]+/i },
];

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function shouldSkip(repoPath) {
  return excludedPathFragments.some((fragment) => repoPath.includes(fragment));
}

function collectFiles(target, files) {
  const absolutePath = path.join(rootDir, target);
  const repoPath = toRepoPath(absolutePath);
  if (shouldSkip(`${repoPath}/`)) return files;

  const stat = statSync(absolutePath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absolutePath)) {
      collectFiles(path.join(target, entry), files);
    }
    return files;
  }

  if (allowedExtensions.has(path.extname(absolutePath).toLowerCase())) {
    files.push(absolutePath);
  }
  return files;
}

const findings = [];
const files = scanRoots.flatMap((target) => collectFiles(target, []));

for (const filePath of files) {
  const repoPath = toRepoPath(filePath);
  if (shouldSkip(repoPath)) continue;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of lineChecks) {
      if (check.pattern.test(line)) {
        findings.push({
          repoPath,
          lineNumber: index + 1,
          label: check.label,
          line: line.trim(),
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("Agent-drag markers found:");
  for (const finding of findings) {
    console.error(
      `${finding.repoPath}:${finding.lineNumber}: ${finding.label}: ${finding.line}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log("No active agent-drag markers found");
}
