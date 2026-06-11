import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("docs lock all-visible scene section behavior for topo and satellite content", () => {
  const decisions = readSource("docs", "03-decisions.md");
  const directives = readSource(
    "docs",
    "dev-context",
    "Page-Transitions-And-Section-Frames.md",
  );
  const activeContext = readSource(
    "docs",
    "dev-context",
    "Active-Build-Context.md",
  );

  assert.match(
    decisions,
    /## DEC-097 - Scene section planes and frames clip all visible topo context/,
    "A durable decision should supersede DEC-077's default topo exclusion.",
  );
  assert.match(
    decisions,
    /supersedes DEC-077[\s\S]*terrain\/topomap[\s\S]*satellite\/orthophoto[\s\S]*graticule[\s\S]*labels[\s\S]*legends[\s\S]*branding/,
    "The decision should name the all-visible topo and satellite scope.",
  );
  for (const doc of [directives, activeContext]) {
    assert.doesNotMatch(
      doc,
      /excluded from scene-section clipping by \*\*default\*\*|excluded from\s+scene-section clipping/i,
      "Active docs should not keep the old default topo section exclusion.",
    );
  }
  assert.match(
    directives,
    /topoSectionable[\s\S]*deprecated[\s\S]*no-op/i,
    "Section-frame directives should mark topoSectionable as compatibility-only.",
  );
});

test("topoSectionable is retained only as deprecated compatibility state", () => {
  const pageTypes = readSource("src", "pages", "types.ts");
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const manifest = readSource(
    "docs",
    "dev-context",
    "editor-control-manifest.json",
  );

  assert.match(
    pageTypes,
    /topoSectionable\?: boolean;[\s\S]*deprecated|deprecated[\s\S]*topoSectionable\?: boolean;/i,
    "The persisted style field should remain readable but deprecated.",
  );
  assert.doesNotMatch(
    topoPanel,
    /Section frames clip grid|field="topoSectionable"/,
    "The old opt-in checkbox should not remain in the topo editor.",
  );
  assert.doesNotMatch(
    manifest,
    /Section frames clip grid|topoSectionable/,
    "The control manifest should not describe topo sectioning as an opt-in control.",
  );
});

test("terrain shader consumes scene section planes and frames", () => {
  const terrainMaterial = readSource("src", "scene", "terrainMaterial.ts");

  for (const uniform of [
    "uSceneSectionEnabled",
    "uSceneSectionPlaneCount",
    "uSceneSectionNormals",
    "uSceneSectionPositions",
    "uSceneSectionInvert",
    "uSceneSectionPlaneOutsideOpacity",
    "uSceneSectionFrameCount",
    "uSceneSectionFrameAxisA",
    "uSceneSectionFrameAxisB",
    "uSceneSectionFrameBounds",
    "uSceneSectionFrameOutsideOpacity",
  ]) {
    assert.match(
      terrainMaterial,
      new RegExp(uniform),
      `Terrain material should expose ${uniform}.`,
    );
  }

  assert.match(
    terrainMaterial,
    /float sceneSectionAlpha\(vec3 position\)[\s\S]*uSceneSectionPlaneCount[\s\S]*uSceneSectionFrameCount/,
    "Terrain shader should compute section alpha from planes and frames.",
  );
  assert.match(
    terrainMaterial,
    /dot\(position,\s*normal\)\s*-\s*uSceneSectionPositions\[i\]/,
    "Terrain shader should evaluate scene section planes in world space.",
  );
  assert.match(
    terrainMaterial,
    /dot\(position,\s*axisA\)[\s\S]*uSceneSectionFrameBounds\[i\]/,
    "Terrain shader should evaluate section frame bounds in world space.",
  );
  assert.match(
    terrainMaterial,
    /float sectionAlpha = sceneSectionAlpha\(vWorldPos\);[\s\S]*if \(sectionAlpha <= 0\.001\) discard;/,
    "Terrain shader should discard fully clipped pixels after public clip.",
  );
  assert.match(
    terrainMaterial,
    /gl_FragColor = vec4\(surface,\s*alpha \* sectionAlpha\);/,
    "Terrain underside alpha should be multiplied by section alpha.",
  );
  assert.match(
    terrainMaterial,
    /gl_FragColor = vec4\(surface,\s*clamp\(uOpacity, 0\.0, 1\.0\) \* sectionAlpha\);/,
    "Terrain front-face alpha should be multiplied by section alpha.",
  );
  const textureSetter = terrainMaterial.match(
    /setOrthoPhotoTexture\(texture\) \{[\s\S]*?\n    \},/,
  );
  assert.ok(textureSetter, "Terrain material should keep setOrthoPhotoTexture.");
  assert.doesNotMatch(
    textureSetter[0],
    /uSceneSection/,
    "Scene section support should not alter satellite texture loading fields.",
  );
});

test("scene section controller routes terrain and topo overlay materials through section clipping", () => {
  const sectionController = readSource(
    "src",
    "scene",
    "section",
    "sceneSectionController.ts",
  );

  assert.doesNotMatch(
    sectionController,
    /sceneSectionObjectExcludedFromClipping/,
    "Topo object exclusion helper should be removed from the section path.",
  );
  assert.doesNotMatch(
    sectionController,
    /topoSectionable !== true[\s\S]*topoGraticuleLineMaterial/,
    "Graticule materials should not short-circuit scene section clipping by default.",
  );
  assert.match(
    sectionController,
    /terrainShader[\s\S]*material\.userData\?\.terrainMaterial === true[\s\S]*this\.setSceneSectionUniforms\(material, planes, visibility, frames\)/,
    "Terrain shader materials should receive scene section uniforms.",
  );
  assert.match(
    sectionController,
    /targeted && \(planes\.length > 0 \|\| activeFrames\.length > 0\) \? 1 : 0/,
    "Shader sectioning should activate for planes or section frames.",
  );
});
