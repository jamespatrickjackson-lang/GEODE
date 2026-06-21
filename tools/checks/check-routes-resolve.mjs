#!/usr/bin/env node
// Gate check: every command a routing doc names must exist in package.json and
// must not be a stub. Closes the defect found by the DMT audit — the retired
// `check:utah-snapshot` console.log stub was still routed by Verification-Routing.
// Ported from DMT/template/checks/check-routes-resolve.mjs (DEC: gate adoption).
//
// Usage: node tools/checks/check-routes-resolve.mjs [--config <path>]

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadConfig } from "./lib/config.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--config") out.config = argv[(i += 1)];
  }
  return out;
}

function discoverReferences(docText, patterns) {
  const names = new Set();
  for (const src of patterns) {
    const re = new RegExp(src, "g");
    let m;
    while ((m = re.exec(docText)) !== null) {
      if (m[1]) names.add(m[1].trim());
    }
  }
  return [...names];
}

function isStubBody(body) {
  const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*#.*$/gm, "")
    .trim();
  if (stripped === "") return true;
  const meaningful = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^console\.(log|error|warn|info)\s*\(/.test(l))
    .filter((l) => !/^echo\b/.test(l))
    .filter((l) => l !== "}" && l !== ")" && l !== ");" && l !== "});");
  if (meaningful.length === 0) return true;
  if (/\bnot (yet )?implemented\b/i.test(stripped)) return true;
  return false;
}

function singleFileTarget(scriptCmd) {
  const m = scriptCmd.match(/node\s+(?:--\S+\s+)*([^\s]+\.(?:mjs|js|cjs))\b/);
  return m ? m[1] : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const { config } = loadConfig(args.config, scriptDir, rootDir);

  const routingDocRel = config.routingDoc;
  if (!routingDocRel) {
    console.error("check-routes-resolve: config.routingDoc is required.");
    process.exitCode = 1;
    return;
  }
  const routingDoc = path.resolve(rootDir, routingDocRel);
  if (!existsSync(routingDoc)) {
    console.error(`check-routes-resolve: routing doc not found: ${routingDocRel}`);
    process.exitCode = 1;
    return;
  }

  const referencePatterns = config.routeReferencePatterns ?? [
    "npm run ([A-Za-z0-9:_-]+)",
    "`(check:[A-Za-z0-9:_-]+)`",
  ];
  const ignoreNames = new Set(config.routeIgnore ?? []);

  const docText = readFileSync(routingDoc, "utf8");
  const referenced = discoverReferences(docText, referencePatterns).filter(
    (n) => !ignoreNames.has(n),
  );

  const pkgPath = path.join(rootDir, "package.json");
  const scripts =
    existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, "utf8")).scripts
      ? JSON.parse(readFileSync(pkgPath, "utf8")).scripts
      : {};

  const errors = [];
  for (const name of referenced) {
    const cmd = scripts[name];
    if (!cmd) {
      errors.push(
        `${routingDocRel} routes to "${name}" but package.json has no such script.`,
      );
      continue;
    }
    const target = singleFileTarget(cmd);
    if (!target) continue;
    const targetAbs = path.resolve(rootDir, target);
    if (!existsSync(targetAbs)) {
      errors.push(
        `"${name}" -> ${target} does not exist (routed from ${routingDocRel}).`,
      );
      continue;
    }
    const body = readFileSync(targetAbs, "utf8");
    if (isStubBody(body)) {
      errors.push(
        `"${name}" -> ${target} is a stub (only logging / empty / "not implemented"), still routed from ${routingDocRel}.`,
      );
    }
  }

  if (referenced.length === 0) {
    console.warn(
      `check-routes-resolve: no routed commands discovered in ${routingDocRel}. Verify routeReferencePatterns.`,
    );
  }

  if (errors.length > 0) {
    console.error("Routes-resolve check failed:");
    for (const e of errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Routes resolve: ${referenced.length} routed command(s) all exist and are non-stub.`,
  );
}

main();
