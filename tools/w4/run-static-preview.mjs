#!/usr/bin/env node
// Called only by the dedicated Playwright W4 configuration in an owned checkout.
// Direct Vite preview child is a production-static equivalent of:
// npm run preview -- --host 127.0.0.1 --port $W4_PORT --strictPort
import { spawn } from 'node:child_process';
import { existsSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { verifyCheckout,verifyIntegrity,validatePreviewConfiguration,BRANCH } from './guard-core.mjs';
const sandbox=process.env.W4_SANDBOX;
const root=process.env.W4_CHECKOUT;
const sha=process.env.W4_EXPECTED_SHA;
const port=process.env.W4_PORT;
let child;
let stopping=false;
function die(e){console.error(`W4 static preview FAIL CLOSED: ${e.message}`);process.exitCode=1;}
try {
  if(!sandbox||!root||!sha||!port) throw Error('W4_SANDBOX, W4_CHECKOUT, W4_EXPECTED_SHA and W4_PORT are mandatory');
  if(resolve(root)!==resolve(process.cwd())) throw Error('Playwright cwd must equal isolated checkout');
  verifyCheckout({sandbox,root,sha,branch:process.env.W4_BRANCH||BRANCH});
  verifyIntegrity({sandbox,root});
  const n=validatePreviewConfiguration({port,url:`http://127.0.0.1:${port}`,reuseExistingServer:false});
  if(!existsSync(join(root,'dist/index.html'))) throw Error('production dist/index.html missing; run npm run build in isolated checkout first');
  const bin=join(root,'node_modules/vite/bin/vite.js');
  if(!existsSync(bin)) throw Error('isolated vite dependency missing; run npm ci in sandbox checkout');
  const receipt=join(sandbox,'evidence/preview-process.json');
  if(existsSync(receipt)) throw Error('existing process receipt; refuse to overwrite or attach to earlier run');
  child=spawn(process.execPath,[bin,'preview','--host','127.0.0.1','--port',String(n),'--strictPort'],{cwd:root,env:{...process.env,HOST:'127.0.0.1'},shell:false,stdio:'inherit'});
  if(!child.pid) throw Error('preview child spawn did not provide a PID');
  writeFileSync(receipt,JSON.stringify({owner:'W4-ENV',pid:child.pid,root,sha,port:n,mode:'production-static',startedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx',mode:0o600});
  child.on('error',e=>{die(e);process.exitCode=1;});
  child.on('exit',(code,signal)=>{
    if(!stopping && (code!==0 || signal)) die(new Error(`preview child exited ${code??signal}`));
    try { verifyIntegrity({sandbox,root}); console.log('W4 preview teardown integrity PASS (tracked files unchanged)'); }
    catch(e){die(e);}
    process.exitCode=process.exitCode||code||0;
  });
  const stop=()=>{if(stopping)return;stopping=true;if(child && child.pid && child.exitCode===null)child.kill('SIGTERM');};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
} catch(e) {
  if(child?.pid && child.exitCode===null) child.kill('SIGTERM');
  die(e);
}
