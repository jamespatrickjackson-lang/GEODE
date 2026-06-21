#!/usr/bin/env node
// Auto-enable the repo git hooks on `npm install` (prepare lifecycle).
// Points git at .githooks so the pre-commit gate runs without a manual step.
// Safe no-op outside a git work tree (e.g. if installed as a dependency).
import { spawnSync } from "node:child_process";

const inRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  stdio: "ignore",
  windowsHide: true,
});
if (inRepo.status === 0) {
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
    stdio: "ignore",
    windowsHide: true,
  });
  console.log("hooks: core.hooksPath -> .githooks (pre-commit gate enabled)");
} else {
  console.log("hooks: not a git work tree; skipping hook install");
}
