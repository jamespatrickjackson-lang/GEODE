// W4-only production-static browser harness. NOT the existing user Vite session.
// Deliberately has no Gate A/B tests; W4-ENV #9 authorizes infrastructure only.
import { defineConfig, devices } from '@playwright/test';
import { resolve, join } from 'node:path';
const port=Number(process.env.W4_PORT);
const sandbox=process.env.W4_SANDBOX;
const checkout=process.env.W4_CHECKOUT;
const sha=process.env.W4_EXPECTED_SHA;
if (!sandbox || !checkout || !sha || !Number.isInteger(port) || port<1024 || port>65535 || [5173,5194,5273].includes(port)) {
  throw new Error('W4-ENV requires owned W4_SANDBOX, W4_CHECKOUT, W4_EXPECTED_SHA and exclusive W4_PORT');
}
if (resolve(checkout)!==resolve(process.cwd())) throw new Error('W4-ENV cannot run outside the isolated checkout');
const origin=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./tests/w4/browser',
  outputDir:join(resolve(sandbox),'evidence','playwright'),
  workers:1,
  fullyParallel:false,
  forbidOnly:true,
  timeout:90_000,
  use:{ baseURL:origin,trace:'retain-on-failure',screenshot:'only-on-failure',acceptDownloads:true },
  webServer:{
    command:'node tools/w4/run-static-preview.mjs',
    cwd:resolve(checkout),
    url:origin,
    reuseExistingServer:false,
    timeout:120_000,
    env:{W4_PORT:String(port),W4_SANDBOX:resolve(sandbox),W4_CHECKOUT:resolve(checkout),W4_EXPECTED_SHA:sha,W4_BRANCH:'test/w4-env-isolated-preflight'},
  },
  projects:[{name:'w4-chromium-proposed',use:{...devices['Desktop Chrome']}}],
});
