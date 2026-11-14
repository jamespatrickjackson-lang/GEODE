// W4-ENV: non-destructive safeguards for intentionally disposable checkouts.
// This module never kills a process, resets Git, or removes a working tree.
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, relative, dirname, isAbsolute } from 'node:path';
import { createServer } from 'node:net';

export const REPOSITORY = 'jamespatrickjackson-lang/GEODE';
export const BRANCH = 'test/w4-env-isolated-preflight';
const remotes = new Set([
  'https://github.com/jamespatrickjackson-lang/GEODE.git',
  'https://github.com/jamespatrickjackson-lang/GEODE',
  'git@github.com:jamespatrickjackson-lang/GEODE.git',
  'ssh://git@github.com/jamespatrickjackson-lang/GEODE.git',
]);
const sandboxMarker = '.w4-env-owned.json';
const evidenceName = 'evidence';
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const reservedPorts = new Set([5173, 5194, 5273]);

function die(message) { throw new Error(`W4-ENV: ${message}`); }
function git(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio:['ignore','pipe','pipe'], timeout:30000 }).trim(); }
  catch(e) { die(`git ${args.join(' ')} failed: ${String(e.stderr||e.message).trim().slice(0,400)}`); }
}
function canonical(path) { try { return realpathSync(path); } catch { die(`path does not exist: ${path}`); } }
function digest(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function under(root, file) {
  const diff=relative(root,file);
  return diff && diff !== '..' && !diff.startsWith(`..${process.platform==='win32'?'\\':'/'}`) && !isAbsolute(diff);
}
function readMarker(sandbox) {
  const base=canonical(sandbox);
  const markerPath=join(base,sandboxMarker);
  if (!existsSync(markerPath) || lstatSync(markerPath).isSymbolicLink()) die('sandbox ownership marker missing or unsafe');
  let marker; try { marker=JSON.parse(readFileSync(markerPath,'utf8')); } catch { die('sandbox ownership marker malformed'); }
  if (marker.kind!=='geosee-w4-env-v1' || marker.path!==base || !/^[0-9a-f-]{36}$/.test(marker.token)) die('sandbox ownership marker invalid');
  return {base,marker};
}
function safeFile(root, path) {
  const abs=resolve(root,path);
  if (!under(root,abs) || !existsSync(abs)) die(`protected file missing or escaped: ${path}`);
  // Do not follow a symbolic link, including an ancestor placed after baseline capture.
  let check=root;
  for(const part of relative(root,abs).split(/[\\/]/)) {
    check=join(check,part);
    if (lstatSync(check).isSymbolicLink()) die(`symbolic link in protected path: ${path}`);
  }
  if (!lstatSync(abs).isFile()) die(`not a regular protected file: ${path}`);
  return abs;
}
function listTracked(root) {
  const raw=execFileSync('git',['ls-files','-z','--cached'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
  return raw.split('\0').filter(Boolean).sort();
}
function trackedHashes(root) {
  const map={};
  for (const file of listTracked(root)) map[file]=digest(safeFile(root,file));
  return map;
}

/** Allocate only a *new* clearly marked sandbox, never take ownership of a pre-existing directory. */
export function createSandbox({parent=tmpdir()}={}) {
  const base=canonical(parent);
  const sandbox=mkdtempSync(join(base,'geosee-w4-env-'));
  writeFileSync(join(sandbox,sandboxMarker),JSON.stringify({kind:'geosee-w4-env-v1',path:sandbox,token:randomUUID(),created:new Date().toISOString()},null,2)+'\n',{flag:'wx',mode:0o600});
  mkdirSync(join(sandbox,evidenceName));
  return sandbox;
}

export function verifyCheckout({sandbox,root,sha,branch=BRANCH}) {
  const {base}=readMarker(sandbox);
  if (!SHA_PATTERN.test(String(sha))) die('exact 40-character expected SHA required');
  if (branch==='main' || branch==='master' || branch!==BRANCH) die(`wrong or unsafe branch: ${branch}`);
  const checkout=canonical(root);
  if (checkout!==join(base,'checkout') || !under(base,checkout)) die('checkout is not the designated sandbox/checkout');
  if (lstatSync(checkout).isSymbolicLink()) die('checkout symlink prohibited');
  const top=canonical(git(checkout,['rev-parse','--show-toplevel']));
  if (top!==checkout) die('repository root mismatch');
  const remote=git(checkout,['remote','get-url','origin']);
  if (!remotes.has(remote)) die(`wrong repository remote: ${remote}`);
  const actualBranch=git(checkout,['symbolic-ref','--quiet','--short','HEAD']);
  if(actualBranch!==branch) die(`wrong branch: ${actualBranch} != ${branch}`);
  const actualSha=git(checkout,['rev-parse','HEAD']);
  if(actualSha!==sha) die(`wrong SHA: ${actualSha} != ${sha}`);
  const dirt=git(checkout,['status','--porcelain=v1','--untracked-files=all']);
  if(dirt) die(`dirty checkout: ${dirt.slice(0,400)}`);
  return {root:checkout,remote,branch:actualBranch,sha:actualSha};
}

/** Baseline outside Git checkout. Includes every tracked file and independently pinned fixture hashes. */
export function captureBaseline({sandbox,root,sha,branch=BRANCH,fixtureHashes={}}) {
  const info=verifyCheckout({sandbox,root,sha,branch});
  const {base}=readMarker(sandbox);
  const evidence=join(base,evidenceName);
  if(!existsSync(evidence) || lstatSync(evidence).isSymbolicLink()) die('invalid evidence directory');
  const output=join(evidence,'baseline.json');
  if(existsSync(output)) die('baseline already exists; do not overwrite evidence');
  const hashes=trackedHashes(info.root);
  for (const [file,expected] of Object.entries(fixtureHashes)) {
    if(!Object.hasOwn(hashes,file) || hashes[file]!==expected) die(`fixture hash mismatch: ${file}`);
  }
  const baseline={kind:'geosee-w4-baseline-v1',...info,trackedCount:Object.keys(hashes).length,hashes,fixtureHashes,created:new Date().toISOString()};
  writeFileSync(output,JSON.stringify(baseline,null,2)+'\n',{flag:'wx',mode:0o600});
  return baseline;
}

export function verifyIntegrity({sandbox,root}) {
  const {base}=readMarker(sandbox);
  const checkout=canonical(root);
  if(checkout!==join(base,'checkout')) die('integrity target is not the owned checkout');
  let baseline;
  try {baseline=JSON.parse(readFileSync(join(base,evidenceName,'baseline.json'),'utf8'));}
  catch {die('baseline integrity receipt missing or invalid');}
  if(baseline.kind!=='geosee-w4-baseline-v1' || baseline.root!==checkout) die('baseline identity mismatch');
  const branch=git(checkout,['symbolic-ref','--quiet','--short','HEAD']);
  const sha=git(checkout,['rev-parse','HEAD']);
  const remote=git(checkout,['remote','get-url','origin']);
  if(branch!==baseline.branch || sha!==baseline.sha || remote!==baseline.remote) die('repository integrity: ref or remote modified');
  const dirty=git(checkout,['status','--porcelain=v1','--untracked-files=all']);
  if(dirty) die(`repository integrity: dirty checkout: ${dirty.slice(0,400)}`);
  const now=trackedHashes(checkout);
  const old=baseline.hashes;
  const missing=Object.keys(old).filter(k=>now[k]!==old[k]);
  const added=Object.keys(now).filter(k=>!Object.hasOwn(old,k));
  if(missing.length||added.length) die(`repository integrity modified/missing/added: ${[...missing,...added].slice(0,8).join(', ')}`);
  return {ok:true,sha,branch,remote,trackedCount:Object.keys(now).length,protectedManifestCount:Object.keys(now).filter(k=>k.startsWith('projects/') && /(?:project|environment)\.json$/.test(k)).length};
}

export function validatePreviewConfiguration({port,url,reuseExistingServer}) {
  const n=Number(port);
  if(!Number.isInteger(n)||n<1024||n>65535||reservedPorts.has(n)) die('reserved or invalid port');
  if(url!==`http://127.0.0.1:${n}`) die('preview URL/port mismatch');
  if(reuseExistingServer!==false) die('reuseExistingServer must be false');
  return n;
}
export async function allocatePort(requested=0) {
  const n=Number(requested);
  if(!Number.isInteger(n)||n<0||n>65535||(n>0&&n<1024)||reservedPorts.has(n)) die('reserved or invalid port');
  const server=createServer();
  const port=await new Promise((resolvePort,reject)=>{
    server.once('error',e=>reject(new Error(`W4-ENV: occupied/unavailable port ${n}: ${e.code||e.message}`)));
    server.listen({host:'127.0.0.1',port:n,exclusive:true},()=>resolvePort(server.address().port));
  });
  await new Promise((resolveClose,reject)=>server.close(err=>err?reject(err):resolveClose()));
  if(reservedPorts.has(port)) die('kernel selected a reserved port');
  return port;
}
export function runCheckedCommand(command,args,{cwd,timeout=120000}={}) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',shell:false,timeout,maxBuffer:16*1024*1024});
  if(result.error) die(`command execution failed: ${result.error.message}`);
  if(result.status!==0) die(`command exit ${result.status}: ${(result.stderr||result.stdout||'').slice(0,600)}`);
  return {exitCode:result.status,stdout:result.stdout,stderr:result.stderr};
}
export function assertStaticWriteRejected({status,body=''}) {
  if(!Number.isInteger(status)||status<400) die(`static development-write request not rejected (status ${status}): ${String(body).slice(0,80)}`);
  return true;
}
