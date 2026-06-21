#!/usr/bin/env node
// Gate check: files that must mirror (CLAUDE.md <-> AGENTS.md) may not drift in
// their fenced canonical section. Closes the defect found by the DMT audit — the
// CLAUDE/AGENTS monolith line-count lists had silently diverged.
// Ported from DMT/template/checks/check-mirror-diff.mjs (DEC: gate adoption).
//
// Usage: node tools/checks/check-mirror-diff.mjs [--config <path>]

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

function extractCanonical(text, beginMarker, endMarker) {
  if (!beginMarker || !endMarker) return text;
  const lines = text.split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (!inside && line.includes(beginMarker)) {
      inside = true;
      continue;
    }
    if (inside && line.includes(endMarker)) {
      inside = false;
      continue;
    }
    if (inside) out.push(line);
  }
  return out.length > 0 ? out.join("\n") : text;
}

function normalize(text, opts) {
  let t = text.replace(/\r\n/g, "\n");
  t = t
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  if (opts.lowercase) t = t.toLowerCase();
  for (const sub of opts.substitutions ?? []) {
    t = t.replace(new RegExp(sub.pattern, sub.flags ?? "g"), sub.replace ?? "");
  }
  return t;
}

function firstDiff(a, b) {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i += 1) {
    if (la[i] !== lb[i]) {
      return { line: i + 1, a: la[i] ?? "<missing>", b: lb[i] ?? "<missing>" };
    }
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const { config } = loadConfig(args.config, scriptDir, rootDir);

  const pairs = config.mirrorPairs ?? [];
  if (pairs.length === 0) {
    console.log("check-mirror-diff: no mirrorPairs configured; nothing to check.");
    return;
  }

  const errors = [];
  for (const pair of pairs) {
    const aRel = pair.a;
    const bRel = pair.b;
    const aAbs = path.resolve(rootDir, aRel);
    const bAbs = path.resolve(rootDir, bRel);
    if (!existsSync(aAbs)) {
      errors.push(`mirror pair source missing: ${aRel}`);
      continue;
    }
    if (!existsSync(bAbs)) {
      errors.push(`mirror pair target missing: ${bRel}`);
      continue;
    }
    const opts = {
      lowercase: pair.lowercase ?? false,
      substitutions: pair.substitutions ?? [],
    };
    const a = normalize(
      extractCanonical(readFileSync(aAbs, "utf8"), pair.beginMarker, pair.endMarker),
      opts,
    );
    const b = normalize(
      extractCanonical(readFileSync(bAbs, "utf8"), pair.beginMarker, pair.endMarker),
      opts,
    );
    if (a !== b) {
      const d = firstDiff(a, b);
      const detail = d
        ? ` first diff at canonical line ${d.line}:\n    ${aRel}: ${d.a}\n    ${bRel}: ${d.b}`
        : "";
      errors.push(`${aRel} and ${bRel} canonical sections differ.${detail}`);
    }
  }

  if (errors.length > 0) {
    console.error("Mirror-diff check failed:");
    for (const e of errors) console.error(`- ${e}`);
    console.error(
      "\nThe source-of-truth file and its mirror have drifted. Re-sync the canonical section.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Mirror-diff: ${pairs.length} pair(s) in sync.`);
}

main();
