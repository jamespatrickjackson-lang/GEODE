import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "docs/dev-context/schemas/artifact-metadata.schema.json");
const defaultFiles = [
  "docs/dev-context/templates/artifact-metadata.template.json",
  "docs/dev-context/templates/artifact-metadata.example.utah-mt-slices.json",
  "docs/dev-context/templates/artifact-metadata.example.utah-seismic-browser.json"
];

function displayPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function enumValues(schema, field) {
  return schema?.properties?.[field]?.enum || [];
}

function parseStringLiteral(text, start) {
  let value = "";
  let index = start + 1;
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") {
      const next = text[index + 1];
      if (next === "u") {
        value += text.slice(index, index + 6);
        index += 6;
      } else {
        value += next ?? "";
        index += 2;
      }
      continue;
    }
    if (char === "\"") {
      return { value, next: index + 1 };
    }
    value += char;
    index += 1;
  }
  throw new Error("Unterminated JSON string");
}

function skipWhitespace(text, index) {
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }
  return index;
}

function consumePrimitive(text, start) {
  let index = start;
  while (index < text.length && !/[,\]\}\s]/.test(text[index])) {
    index += 1;
  }
  return index;
}

function markValueComplete(stack) {
  if (!stack.length) {
    return false;
  }
  stack[stack.length - 1].expect = "commaOrEnd";
  return true;
}

function detectDuplicateKeys(text) {
  const duplicates = [];
  const stack = [];
  let index = 0;

  while (index < text.length) {
    index = skipWhitespace(text, index);
    if (index >= text.length) {
      break;
    }

    const char = text[index];
    const frame = stack[stack.length - 1];

    if (char === "{") {
      stack.push({ type: "object", keys: new Set(), expect: "keyOrEnd" });
      index += 1;
      continue;
    }

    if (char === "[") {
      stack.push({ type: "array", expect: "valueOrEnd" });
      index += 1;
      continue;
    }

    if (char === "\"") {
      const parsed = parseStringLiteral(text, index);
      const top = stack[stack.length - 1];
      if (top?.type === "object" && top.expect === "keyOrEnd") {
        if (top.keys.has(parsed.value)) {
          duplicates.push(parsed.value);
        }
        top.keys.add(parsed.value);
        top.expect = "colon";
      } else {
        markValueComplete(stack);
      }
      index = parsed.next;
      continue;
    }

    if (char === ":") {
      if (frame?.type === "object" && frame.expect === "colon") {
        frame.expect = "value";
      }
      index += 1;
      continue;
    }

    if (char === ",") {
      if (frame?.type === "object" && frame.expect === "commaOrEnd") {
        frame.expect = "keyOrEnd";
      } else if (frame?.type === "array" && frame.expect === "commaOrEnd") {
        frame.expect = "valueOrEnd";
      }
      index += 1;
      continue;
    }

    if (char === "}") {
      if (frame?.type === "object") {
        stack.pop();
        if (!markValueComplete(stack)) {
          index += 1;
          continue;
        }
      }
      index += 1;
      continue;
    }

    if (char === "]") {
      if (frame?.type === "array") {
        stack.pop();
        if (!markValueComplete(stack)) {
          index += 1;
          continue;
        }
      }
      index += 1;
      continue;
    }

    index = consumePrimitive(text, index);
    markValueComplete(stack);
  }

  return [...new Set(duplicates)];
}

function readJson(filePath, { checkDuplicateKeys = true } = {}) {
  const text = fs.readFileSync(filePath, "utf8");
  if (checkDuplicateKeys) {
    const duplicates = detectDuplicateKeys(text);
    if (duplicates.length) {
      throw new Error(`Duplicate JSON key(s): ${duplicates.join(", ")}`);
    }
  }
  return JSON.parse(text);
}

function validateWrapperData(data, schema) {
  const errors = [];

  if (!isPlainObject(data)) {
    return ["Top-level value must be an object"];
  }

  for (const field of schema.required || []) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const field of [
    "artifactFamily",
    "artifactType",
    "renderRole",
    "loadClass",
    "sourceType",
    "epistemicStatus",
    "status"
  ]) {
    const allowed = enumValues(schema, field);
    if (allowed.length && !allowed.includes(data[field])) {
      errors.push(`Invalid ${field}: ${JSON.stringify(data[field])}`);
    }
  }

  if (typeof data.accepted !== "boolean") {
    errors.push("accepted must be boolean");
  }
  if (typeof data.reviewRequired !== "boolean") {
    errors.push("reviewRequired must be boolean");
  }
  if (!Array.isArray(data.inputs)) {
    errors.push("inputs must be array");
  }
  if (!Array.isArray(data.limitations)) {
    errors.push("limitations must be array");
  }
  if (!Array.isArray(data.relatedLayers)) {
    errors.push("relatedLayers must be array");
  }
  if (!Array.isArray(data.relatedPages)) {
    errors.push("relatedPages must be array");
  }

  for (const field of ["paths", "provenance", "crs", "units"]) {
    if (!isPlainObject(data[field])) {
      errors.push(`${field} must be object`);
    }
  }

  return errors;
}

function validateFile(filePath, schema) {
  try {
    const data = readJson(filePath);
    return validateWrapperData(data, schema);
  } catch (error) {
    return [`Invalid JSON or unreadable file: ${error.message}`];
  }
}

function printFileResult(filePath, errors) {
  const display = displayPath(filePath);
  if (errors.length) {
    console.log(`FAIL ${display}`);
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    return true;
  }
  console.log(`PASS ${display}`);
  return false;
}

function listMetadataFiles(artifactDir) {
  if (!fs.existsSync(artifactDir)) {
    return [];
  }
  return fs.readdirSync(artifactDir)
    .filter((entry) => entry.endsWith(".metadata.json"))
    .map((entry) => path.join(artifactDir, entry));
}

function resolveWrapperPath(projectDir, artifactDir, wrapperPath) {
  const candidates = [
    path.resolve(root, wrapperPath),
    path.resolve(projectDir, wrapperPath),
    path.resolve(artifactDir, wrapperPath)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function validateProject(projectArg, schema) {
  const projectDir = path.resolve(root, projectArg);
  const artifactDir = path.join(projectDir, "artifact_metadata");
  const indexPath = path.join(artifactDir, "index.json");
  let failed = false;
  let index;

  if (!fs.existsSync(indexPath)) {
    console.log(`FAIL ${displayPath(indexPath)}`);
    console.log("  - Missing artifact metadata index");
    return true;
  }

  try {
    index = readJson(indexPath);
    console.log(`PASS ${displayPath(indexPath)}`);
  } catch (error) {
    console.log(`FAIL ${displayPath(indexPath)}`);
    console.log(`  - Invalid JSON or unreadable file: ${error.message}`);
    return true;
  }

  if (!Array.isArray(index.wrappers)) {
    console.log(`FAIL ${displayPath(indexPath)}`);
    console.log("  - index.wrappers must be an array");
    failed = true;
  }

  const entries = Array.isArray(index.wrappers) ? index.wrappers : [];
  const listedByPath = new Map();
  const actualFiles = listMetadataFiles(artifactDir);
  const actualSet = new Set(actualFiles.map((file) => path.resolve(file)));

  for (const entry of entries) {
    if (!entry?.path) {
      console.log(`FAIL ${displayPath(indexPath)}`);
      console.log(`  - Wrapper entry missing path: ${entry?.artifactId ?? "unknown artifactId"}`);
      failed = true;
      continue;
    }
    const wrapperPath = resolveWrapperPath(projectDir, artifactDir, entry.path);
    listedByPath.set(path.resolve(wrapperPath), entry);
    if (!fs.existsSync(wrapperPath)) {
      console.log(`FAIL ${displayPath(wrapperPath)}`);
      console.log(`  - Listed in index but file is missing: ${entry.artifactId ?? "unknown artifactId"}`);
      failed = true;
    }
  }

  for (const actualFile of actualFiles) {
    if (!listedByPath.has(path.resolve(actualFile))) {
      console.log(`FAIL ${displayPath(actualFile)}`);
      console.log("  - Wrapper file exists but is not listed in index.json");
      failed = true;
    }
  }

  const targets = new Set([
    ...[...listedByPath.keys()].filter((filePath) => fs.existsSync(filePath)),
    ...actualSet
  ]);

  for (const filePath of [...targets].sort()) {
    const errors = validateFile(filePath, schema);
    failed = printFileResult(filePath, errors) || failed;
  }

  return failed;
}

let schema;
try {
  schema = readJson(schemaPath);
} catch (error) {
  console.error(`FAIL ${displayPath(schemaPath)}: Invalid schema JSON or unreadable file: ${error.message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
let failed = false;

if (args[0] === "--project") {
  const projectArg = args[1];
  if (!projectArg) {
    console.error("FAIL --project requires a project folder path");
    process.exit(1);
  }
  failed = validateProject(projectArg, schema);
} else {
  const targets = args.length ? args : defaultFiles;
  for (const target of targets) {
    const filePath = path.resolve(root, target);
    const errors = validateFile(filePath, schema);
    failed = printFileResult(filePath, errors) || failed;
  }
}

process.exit(failed ? 1 : 0);
