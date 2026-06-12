import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const loaderPath = join(repoRoot, "src", "loaders", "loadSeismicBrowser.ts");

function readLoaderSource() {
  return readFileSync(loaderPath, "utf8");
}

function sourceSlice(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `source should include ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `source should include ${endNeedle}`);
  return source.slice(start, end);
}

test("seismic section display texture uses mipmapped prefiltered sampling without becoming data authority", () => {
  const source = readLoaderSource();
  const textureBuilder = sourceSlice(
    source,
    "function buildSectionDisplayAmplitudeTexture",
    "function sampleSectionAmplitudeAtUv",
  );
  const meshBuilder = sourceSlice(
    source,
    "async function buildSectionMesh",
    "function raymarchVertexShader",
  );

  assert.match(
    source,
    /THREE\.MathUtils\.ceilPowerOfTwo/,
    "display texture should resample to power-of-two dimensions for mipmap support",
  );
  assert.match(
    textureBuilder,
    /THREE\.LinearMipmapLinearFilter/,
    "display texture should use mipmapped minification to avoid oblique seismic striping",
  );
  assert.match(
    textureBuilder,
    /texture\.generateMipmaps\s*=\s*true/,
    "display texture should generate mipmaps for browser minification",
  );
  assert.match(
    meshBuilder,
    /geometry\.userData\.seismicAmplitudeValues\s*=/,
    "raw source amplitude values should remain available for iso overlays and diagnostics",
  );
  assert.match(
    meshBuilder,
    /seismicSectionDisplayTextureSize/,
    "mesh diagnostics should expose display texture dimensions separately from source dimensions",
  );
  assert.match(
    meshBuilder,
    /seismicSectionDisplayTextureFilter:\s*"mipmapped-prefiltered"/,
    "mesh diagnostics should record the reusable display texture policy",
  );
  assert.doesNotMatch(
    source,
    /projects\/utah-forge\/pages|projects\\\\utah-forge\\\\pages/,
    "runtime texture policy must not depend on disposable Utah FORGE page fixtures",
  );
});
