#!/usr/bin/env node
// Gate aggregator: run every tests/tools source-fidelity / anti-pattern test in
// one process. Closes the audit finding that GeoSee had 90+ node:test files and
// NO aggregator (they ran one at a time). Robust across shells/Node versions
// (does its own file discovery instead of relying on shell globbing or
// directory-positional --test). Ported from DMT/template/checks/run-source-tests.mjs.
//
// Usage: node tools/checks/run-source-tests.mjs [--config <path>]

import { spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadConfig, globToRegExp, repoPath } from "./lib/config.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--config") out.config = argv[(i += 1)];
  }
  return out;
}

function collectFiles(rootDir, includeRes, excludeRes) {
  const files = [];
  const walk = (abs) => {
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      return;
    }
    const rel = repoPath(rootDir, abs);
    if (rel && excludeRes.some((re) => re.test(rel))) return;
    if (stat.isDirectory()) {
      for (const entry of readdirSync(abs)) walk(path.join(abs, entry));
      return;
    }
    if (includeRes.some((re) => re.test(rel))) files.push(abs);
  };
  walk(rootDir);
  return files.sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const { config } = loadConfig(args.config, scriptDir, rootDir);

  const testGlobs = config.sourceTestGlobs ?? ["tests/tools/**/*.test.mjs"];
  const excludeGlobs = config.sourceTestExcludeGlobs ?? [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
  ];

  const includeRes = testGlobs.map(globToRegExp);
  const excludeRes = excludeGlobs.map(globToRegExp);
  const files = collectFiles(rootDir, includeRes, excludeRes);

  if (files.length === 0) {
    console.warn(
      `run-source-tests: no test files matched ${testGlobs.join(", ")}.`,
    );
    return;
  }

  console.log(`run-source-tests: running ${files.length} test file(s) under node --test`);
  const relFiles = files.map((f) => repoPath(rootDir, f));
  const result = spawnSync(process.execPath, ["--test", ...relFiles], {
    cwd: rootDir,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

main();
