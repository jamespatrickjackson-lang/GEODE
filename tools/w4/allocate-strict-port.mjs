#!/usr/bin/env node
import { allocatePort,validatePreviewConfiguration } from './guard-core.mjs';
try {
  const requested=process.env.W4_PORT??process.argv[2]??'0';
  const port=await allocatePort(requested);
  validatePreviewConfiguration({port,url:`http://127.0.0.1:${port}`,reuseExistingServer:false});
  console.log(`W4_PORT=${port}`);
  console.log('Port availability was checked, but not reserved. --strictPort will fail closed if another process binds before preview starts.');
} catch(e){ console.error(`FAIL CLOSED: ${e.message}`);process.exitCode=1;}
