import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const manifestPath = "docs/dev-context/editor-control-manifest.json";
const activeStatus = "active";
const removalStatuses = new Set(["removed", "renamed", "hidden"]);
const sourceIdPatterns = [
  /data-editor-control-id=\{?"([^"}]+)"\}?/g,
  /data-editor-section-id=\{?"([^"}]+)"\}?/g,
  /manifestId="([^"]+)"/g,
  /editorControlId="([^"]+)"/g,
];

function read(relPath) {
  return readFileSync(join(repoRoot, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

function parseGitPath(rawPath) {
  if (rawPath.startsWith('"')) {
    try {
      return JSON.parse(rawPath);
    } catch {
      return rawPath.slice(1, -1);
    }
  }
  return rawPath;
}

function gitStatusPaths() {
  const result = spawnSync(
    "git",
    ["status", "--porcelain=v1", "--no-renames"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "git status failed");
  }

  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => normalizedPath(parseGitPath(line.slice(3))));
}

function isProtectedEditorPath(path, protectedPaths) {
  return protectedPaths.some((protectedPath) => {
    const normalized = normalizedPath(protectedPath);
    return path === normalized || path.startsWith(`${normalized}/`);
  });
}

function extractSourceIds(source) {
  const ids = new Set();
  for (const pattern of sourceIdPatterns) {
    for (const match of source.matchAll(pattern)) {
      ids.add(match[1]);
    }
  }
  return ids;
}

function validateApproval(entry, errors, requiredFields, acceptedStatus) {
  const approval =
    entry.approval && typeof entry.approval === "object"
      ? entry.approval
      : null;
  if (!approval) {
    errors.push(`${entry.id}: ${entry.status} entry is missing approval metadata`);
    return;
  }

  for (const field of requiredFields) {
    if (typeof approval[field] !== "string" || approval[field].trim() === "") {
      errors.push(`${entry.id}: approval.${field} is required`);
    }
  }

  if (approval.status !== acceptedStatus) {
    errors.push(
      `${entry.id}: approval.status must be "${acceptedStatus}" for ${entry.status}`,
    );
  }
}

function main() {
  if (!existsSync(join(repoRoot, manifestPath))) {
    throw new Error(`${manifestPath} is missing`);
  }

  const manifest = readJson(manifestPath);
  const errors = [];
  const warnings = [];
  if (manifest.schemaVersion !== 1) {
    errors.push("manifest.schemaVersion must be 1");
  }
  if (!Array.isArray(manifest.entries)) {
    errors.push("manifest.entries must be an array");
  }
  if (!Array.isArray(manifest.protectedSourceFiles)) {
    errors.push("manifest.protectedSourceFiles must be an array");
  }
  if (!Array.isArray(manifest.requiredCompanionPaths)) {
    errors.push("manifest.requiredCompanionPaths must be an array");
  }

  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const ids = new Set();
  const activeIds = new Set();
  const discoveredSourceIds = new Map();
  const sourceCache = new Map();
  const requiredApprovalFields =
    manifest.approvalPolicy?.requiredApprovalFields ?? [
      "status",
      "approvedBy",
      "approvedAt",
      "reason",
    ];
  const acceptedApprovalStatus =
    manifest.approvalPolicy?.acceptedApprovalStatus ?? "approved";

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      errors.push("manifest entry must be an object");
      continue;
    }
    if (typeof entry.id !== "string" || entry.id.trim() === "") {
      errors.push("manifest entry is missing id");
      continue;
    }
    if (ids.has(entry.id)) {
      errors.push(`${entry.id}: duplicate manifest id`);
    }
    ids.add(entry.id);
    if (entry.status === activeStatus) activeIds.add(entry.id);

    if (typeof entry.label !== "string" || entry.label.trim() === "") {
      errors.push(`${entry.id}: label is required`);
    }
    if (typeof entry.kind !== "string" || entry.kind.trim() === "") {
      errors.push(`${entry.id}: kind is required`);
    }
    if (entry.parentId && !ids.has(entry.parentId)) {
      warnings.push(
        `${entry.id}: parentId ${entry.parentId} appears before its manifest entry or is missing`,
      );
    }

    if (entry.status === activeStatus) {
      if (typeof entry.sourceFile !== "string" || entry.sourceFile.trim() === "") {
        errors.push(`${entry.id}: active entry requires sourceFile`);
      } else if (!existsSync(join(repoRoot, entry.sourceFile))) {
        errors.push(`${entry.id}: sourceFile ${entry.sourceFile} does not exist`);
      }
      if (
        typeof entry.sourceAnchor !== "string" ||
        entry.sourceAnchor.trim() === ""
      ) {
        errors.push(`${entry.id}: active entry requires sourceAnchor`);
      }
    } else if (removalStatuses.has(entry.status)) {
      validateApproval(
        entry,
        errors,
        requiredApprovalFields,
        acceptedApprovalStatus,
      );
    } else {
      errors.push(`${entry.id}: unsupported status "${entry.status}"`);
    }
  }

  for (const entry of entries) {
    if (entry.status !== activeStatus) continue;
    if (
      typeof entry.sourceFile !== "string" ||
      typeof entry.sourceAnchor !== "string" ||
      !existsSync(join(repoRoot, entry.sourceFile))
    ) {
      continue;
    }
    let source = sourceCache.get(entry.sourceFile);
    if (!source) {
      source = read(entry.sourceFile);
      sourceCache.set(entry.sourceFile, source);
    }
    if (!source.includes(entry.sourceAnchor)) {
      errors.push(
        `${entry.id}: sourceAnchor not found in ${entry.sourceFile}: ${entry.sourceAnchor}`,
      );
    }
  }

  const sourceFiles = new Set(
    entries
      .filter((entry) => typeof entry.sourceFile === "string")
      .map((entry) => entry.sourceFile),
  );
  for (const sourceFile of sourceFiles) {
    if (!existsSync(join(repoRoot, sourceFile))) continue;
    const idsInFile = extractSourceIds(read(sourceFile));
    for (const id of idsInFile) {
      discoveredSourceIds.set(id, sourceFile);
    }
  }

  for (const [id, sourceFile] of discoveredSourceIds.entries()) {
    if (!activeIds.has(id)) {
      errors.push(
        `${sourceFile}: source anchor id ${id} is missing from active manifest entries`,
      );
    }
  }

  const statusPaths = gitStatusPaths();
  const protectedPaths = manifest.protectedSourceFiles ?? [];
  const companionPaths = new Set(manifest.requiredCompanionPaths ?? []);
  const protectedChanges = statusPaths.filter((path) =>
    isProtectedEditorPath(path, protectedPaths),
  );
  const hasCompanionChange = statusPaths.some((path) => companionPaths.has(path));
  if (protectedChanges.length > 0 && !hasCompanionChange) {
    errors.push(
      [
        "Protected editor source changed without an editor-control manifest companion update.",
        "Changed protected paths:",
        ...protectedChanges.map((path) => `  - ${path}`),
        "Update docs/dev-context/editor-control-manifest.json or record the approved removal/rename/hide path.",
      ].join("\n"),
    );
  }

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }
  if (errors.length > 0) {
    console.error("Editor control manifest guard failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Editor control manifest guard passed (${entries.length} entries, ${discoveredSourceIds.size} source ids).`,
  );
}

try {
  main();
} catch (error) {
  console.error("Editor control manifest guard failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
