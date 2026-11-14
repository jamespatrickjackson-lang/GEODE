#!/usr/bin/env node
import { createSandbox } from './guard-core.mjs';
try {
  const sandbox=createSandbox();
  console.log(JSON.stringify({sandbox,checkout:`${sandbox}/checkout`,evidence:`${sandbox}/evidence`,note:'Clone explicitly into the new checkout path; never use an existing worktree.'},null,2));
} catch(e) { console.error(e.message);process.exitCode=1; }
