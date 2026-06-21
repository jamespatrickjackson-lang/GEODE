// Shared substrate for the GeoSee gate checks (ported from the DMT template,
// DMT/template/checks/lib/config.mjs). No external deps (plain Node ESM).

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Locate and parse the checks config. Resolution order:
//   1. explicit path (--config)
//   2. <cwd>/tools/checks/config.json
//   3. <scriptDir>/config.json
export function loadConfig(explicitPath, scriptDir, rootDir) {
  const candidates = [
    explicitPath ? path.resolve(rootDir, explicitPath) : null,
    path.join(rootDir, "tools", "checks", "config.json"),
    path.join(scriptDir, "config.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const config = JSON.parse(readFileSync(candidate, "utf8"));
      return { config, configPath: candidate, configDir: path.dirname(candidate) };
    }
  }
  throw new Error(`No checks config found. Looked for: ${candidates.join(", ")}`);
}

export function repoPath(rootDir, absPath) {
  return path.relative(rootDir, absPath).split(path.sep).join("/");
}

// Minimal glob -> RegExp (supports **, *, ?), matched against POSIX repo-relative paths.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += "(?:.*)";
        i += 1;
        if (glob[i + 1] === "/") i += 1;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function git(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    const spawnError = result.error instanceof Error ? result.error.message : "";
    throw new Error(stderr || spawnError || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

export function parseGitStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      let rawPath = line.slice(3);
      if (rawPath.startsWith('"')) {
        try {
          rawPath = JSON.parse(rawPath);
        } catch {
          rawPath = rawPath.slice(1, -1);
        }
      }
      return { status, path: rawPath.replaceAll("\\", "/") };
    });
}
