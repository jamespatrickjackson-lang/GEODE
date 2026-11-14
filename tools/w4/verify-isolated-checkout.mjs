#!/usr/bin/env node
// Capture immutable baseline only in an owned, explicitly identified sandbox checkout.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureBaseline, verifyCheckout, BRANCH } from './guard-core.mjs';
const [sandbox,root,sha,branch=BRANCH]=process.argv.slice(2);
try {
  if (!sandbox||!root||!sha) throw Error('Usage: node tools/w4/verify-isolated-checkout.mjs SANDBOX CHECKOUT EXACT_SHA [BRANCH]');
  const manifest=join(root,'tests/w4/fixtures/manifest.json');
  if(!existsSync(manifest)) throw Error('committed synthetic fixture manifest missing');
  const fixtureHashes=JSON.parse(readFileSync(manifest,'utf8')).sha256;
  if(!fixtureHashes || typeof fixtureHashes!=='object' || !Object.keys(fixtureHashes).length) throw Error('invalid fixture manifest');
  verifyCheckout({sandbox,root,sha,branch});
  const receipt=captureBaseline({sandbox,root,sha,branch,fixtureHashes});
  console.log(JSON.stringify({result:'PASS',branch:receipt.branch,sha:receipt.sha,tracked:receipt.trackedCount,fixtureHashes:receipt.fixtureHashes,evidence:join(sandbox,'evidence/baseline.json')},null,2));
} catch(e) {console.error(`FAIL CLOSED: ${e.message}`);process.exitCode=1;}
