#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyIntegrity } from './guard-core.mjs';
const [sandbox,root]=process.argv.slice(2);
try {
  if(!sandbox||!root) throw Error('Usage: node tools/w4/check-worktree-integrity.mjs SANDBOX CHECKOUT');
  const result=verifyIntegrity({sandbox,root});
  const receipt={...result,checkedAt:new Date().toISOString()};
  writeFileSync(join(sandbox,'evidence/integrity-after.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(receipt,null,2));
} catch(e){console.error(`FAIL CLOSED: ${e.message}`);process.exitCode=1;}
