import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

export const repoRoot = process.cwd();

export function repoPath(path) {
  return resolve(repoRoot, path);
}

export function displayPath(path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

export function readJson(path) {
  return JSON.parse(readFileSync(repoPath(path), "utf8"));
}

export function assertFileExists(path, label = path) {
  assert.equal(existsSync(repoPath(path)), true, `${label} should exist`);
}

export function fileSize(path) {
  return statSync(repoPath(path)).size;
}

export function assertArrayContainsAll(actual, expected, label) {
  assert.ok(Array.isArray(actual), `${label} should be an array`);
  for (const value of expected) {
    assert.ok(actual.includes(value), `${label} should include ${value}`);
  }
}

export function assertGreaterThan(actual, expected, label) {
  assert.ok(
    actual > expected,
    `${label} should be greater than ${expected}; received ${actual}`,
  );
}

export function assertGreaterThanOrEqual(actual, expected, label) {
  assert.ok(
    actual >= expected,
    `${label} should be at least ${expected}; received ${actual}`,
  );
}

export function assertCloseTo(actual, expected, precision, label) {
  const tolerance = 0.5 * 10 ** -precision;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} should be close to ${expected}; received ${actual}`,
  );
}

export function assertSubset(actual, expected, label) {
  if (
    expected &&
    typeof expected === "object" &&
    !Array.isArray(expected)
  ) {
    assert.ok(
      actual && typeof actual === "object" && !Array.isArray(actual),
      `${label} should be an object`,
    );
    for (const [key, value] of Object.entries(expected)) {
      assertSubset(actual[key], value, `${label}.${key}`);
    }
    return;
  }

  assert.deepEqual(actual, expected, `${label} should match`);
}

export function assertNotContains(value, fragment, label) {
  assert.equal(
    String(value).includes(fragment),
    false,
    `${label} should not contain ${fragment}`,
  );
}

export function runValidation(name, validate) {
  try {
    validate();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
