import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import {
  createSandbox, verifyCheckout, captureBaseline, verifyIntegrity,
  allocatePort, runCheckedCommand, validatePreviewConfiguration,
  assertStaticWriteRejected,
} from '../../tools/w4/guard-core.mjs';

const branch = 'test/w4-env-isolated-preflight';
const remote = 'https://github.com/jamespatrickjackson-lang/GEODE.git';
function git(cwd, ...args) {
  return execFileSync('git', args, {cwd, encoding:'utf8'}).trim();
}
function fixture() {
  const sandbox = createSandbox({parent:os.tmpdir()});
  const root = path.join(sandbox, 'checkout');
  fs.mkdirSync(root);
  git(root,'init','-q','-b',branch);
  git(root,'config','user.email','test@example.invalid');
  git(root,'config','user.name','Synthetic Test');
  git(root,'remote','add','origin',remote);
  fs.mkdirSync(path.join(root,'tests','w4','fixtures'),{recursive:true});
  fs.writeFileSync(path.join(root,'tests','w4','fixtures','tiny.json'),'{}\n');
  fs.writeFileSync(path.join(root,'protected.txt'),'original\n');
  git(root,'add','.');git(root,'commit','-q','-m','synthetic baseline');
  return {sandbox,root,sha:git(root,'rev-parse','HEAD')};
}

test('clean, explicitly owned synthetic checkout passes, and unchanged content verifies',()=>{
  const x=fixture();
  assert.equal(verifyCheckout({...x,branch}).sha,x.sha);
  const baseline=captureBaseline({...x,branch});
  assert.equal(verifyIntegrity({sandbox:x.sandbox,root:x.root}).ok,true);
  assert.ok(Object.keys(baseline.hashes).includes('protected.txt'));
});

test('dirty, wrong branch and wrong SHA are independently rejected',()=>{
  const x=fixture();
  assert.throws(()=>verifyCheckout({...x,sha:'f'.repeat(40),branch}),/SHA/);
  assert.throws(()=>verifyCheckout({...x,branch:'main'}),/branch/);
  fs.writeFileSync(path.join(x.root,'untracked.txt'),'never allowed');
  assert.throws(()=>verifyCheckout({...x,branch}),/dirty/);
});

test('unowned checkout cannot be enrolled by using arbitrary parent directory',()=>{
  const x=fixture();
  assert.throws(()=>verifyCheckout({...x,sandbox:os.tmpdir(),branch}),/owned|checkout|marker/);
});

test('wrong committed fixture digest fails closed',()=>{
  const x=fixture();
  assert.throws(()=>captureBaseline({...x,branch,fixtureHashes:{'tests/w4/fixtures/tiny.json':'0'.repeat(64)}}),/fixture hash/);
});

test('source modification after capture is detected, never repaired',()=>{
  const x=fixture();captureBaseline({...x,branch});
  fs.writeFileSync(path.join(x.root,'protected.txt'),'mutated\n');
  assert.throws(()=>verifyIntegrity({sandbox:x.sandbox,root:x.root}),/integrity|modified|dirty/);
  assert.equal(fs.readFileSync(path.join(x.root,'protected.txt'),'utf8'),'mutated\n');
});

test('occupied port is rejected without stopping the listener',async()=>{
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const p=server.address().port;
  try {
    await assert.rejects(allocatePort(p),/occupied|EADDRINUSE/);
    assert.equal(server.listening,true);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('strict preview configuration rejects wrong URLs, dev port, and reuse',()=>{
  assert.doesNotThrow(()=>validatePreviewConfiguration({port:18182,url:'http://127.0.0.1:18182',reuseExistingServer:false}));
  assert.throws(()=>validatePreviewConfiguration({port:18182,url:'http://127.0.0.1:5173',reuseExistingServer:false}),/mismatch/);
  assert.throws(()=>validatePreviewConfiguration({port:18182,url:'http://127.0.0.1:18182',reuseExistingServer:true}),/reuse/);
  assert.throws(()=>validatePreviewConfiguration({port:5173,url:'http://127.0.0.1:5173',reuseExistingServer:false}),/reserved/);
});

test('deliberately failing command propagates nonzero instead of false-green',()=>{
  const x=fixture();
  assert.throws(()=>runCheckedCommand(process.execPath,['-e','process.exit(17)'],{cwd:x.root}),/exit 17/);
});

test('static API SPA fallback is not mistaken for a rejected write',()=>{
  assert.doesNotThrow(()=>assertStaticWriteRejected({status:404,body:'Not found'}));
  assert.throws(()=>assertStaticWriteRejected({status:200,body:'<!doctype html>'}),/not rejected/);
  assert.throws(()=>assertStaticWriteRejected({status:200,body:'{"ok":true}'}),/not rejected/);
});
