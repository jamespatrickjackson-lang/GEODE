import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();

async function loadGraphAnnotationModule() {
  const source = readFileSync(
    join(repoRoot, "src", "geophysics", "graphAnnotationModel.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString(
    "base64",
  )}`;
  return import(dataUrl);
}

test("graph annotation target keys are stable and page-agnostic", async () => {
  const { graphAnnotationTargetKey } = await loadGraphAnnotationModule();

  const key = graphAnnotationTargetKey({
    layerId: "utah-forge-phase3-seismic-browser",
    family: "seismic",
    productId: "gdr-1141-line-301-pdm-enh",
    objectKind: "2d-section-line",
    objectId: "section",
    comparisonRole: "primary",
  });

  assert.equal(
    key,
    "graph:seismic:layer:utah-forge-phase3-seismic-browser:product:gdr-1141-line-301-pdm-enh:object:2d-section-line:section:role:primary",
  );
  const colonSafeKey = graphAnnotationTargetKey({
    layerId: "scene-section",
    family: "scene-section",
    productId: "gdr-1141-forge3d-ani-psdm-stack-unenh",
    objectKind: "scene-section-cut",
    objectId: "utah-forge-phase3-seismic-browser:axis:y",
    comparisonRole: "primary",
  });
  assert.match(colonSafeKey, /utah-forge-phase3-seismic-browser%3Aaxis%3Ay/);
  assert.doesNotMatch(
    colonSafeKey,
    /object:scene-section-cut:utah-forge-phase3-seismic-browser:axis:y:/,
  );
  assert.doesNotMatch(key, /page|pageId|pageIndex|pageTitle|pageOrder/i);
});

test("legacy seismic figure fields resolve into graph annotation defaults", async () => {
  const { resolveGraphAnnotationProfile } = await loadGraphAnnotationModule();

  const profile = resolveGraphAnnotationProfile(
    {
      seismicFigureAnnotationsVisible: true,
      seismicFigureTitle: "Line 301 figure",
      seismicFigureCaption: "Source-backed caption",
      seismicFigureScaleLabel: "1 km",
      seismicFigureTextColor: "#ffffff",
      seismicFigureAxisColor: "#ffeeaa",
      seismicFigureCaptionBoxColor: "#101010",
      seismicFigureCaptionBoxOpacity: 0.42,
      seismicFigureHorizonColor: "#ffcc33",
      seismicFigureWellColor: "#5875ff",
      seismicFigureWellVisible: true,
      seismicFigureWellLabel: "58-32",
      seismicFigureWellPosition: 0.65,
      seismicFigureHorizonVisible: true,
      seismicFigureHorizonPoints: [
        [0.1, 0.2],
        [0.9, 0.3],
      ],
      seismicFigureOutsideOffsetM: 220,
      seismicFigureLabelSizeM: 160,
    },
    "graph:seismic:layer:l:product:p:object:2d-section-line:s:role:primary",
  );

  assert.equal(profile.frameVisible, true);
  assert.equal(profile.title, "Line 301 figure");
  assert.equal(profile.caption, "Source-backed caption");
  assert.equal(profile.scaleLabel, "1 km");
  assert.equal(profile.textColor, "#ffffff");
  assert.equal(profile.axisColor, "#ffeeaa");
  assert.equal(profile.captionBoxColor, "#101010");
  assert.equal(profile.captionBoxOpacity, 0.42);
  assert.equal(profile.horizonColor, "#ffcc33");
  assert.equal(profile.wellColor, "#5875ff");
  assert.equal(profile.wellVisible, true);
  assert.equal(profile.wellLabel, "58-32");
  assert.equal(profile.wellPosition, 0.65);
  assert.deepEqual(profile.horizonPoints, [
    [0.1, 0.2],
    [0.9, 0.3],
  ]);
  assert.equal(profile.outsideOffsetM, 220);
  assert.equal(profile.labelSizeM, 160);
});

test("target profiles override defaults without mutating other targets", async () => {
  const { resolveGraphAnnotationProfile } = await loadGraphAnnotationModule();
  const targetKey = "graph:seismic:layer:l:product:p:object:3d-volume:volume:role:primary";
  const otherKey = "graph:seismic:layer:l:product:p:object:2d-section-line:section:role:primary";
  const style = {
    graphAnnotationDefaults: {
      frameVisible: true,
      title: "Default title",
      textColor: "#eeeeee",
      labelSizeM: 150,
    },
    graphAnnotationProfiles: {
      [targetKey]: {
        title: "Volume title",
        textColor: "#ff0000",
      },
    },
  };

  assert.equal(resolveGraphAnnotationProfile(style, targetKey).title, "Volume title");
  assert.equal(resolveGraphAnnotationProfile(style, targetKey).textColor, "#ff0000");
  assert.equal(resolveGraphAnnotationProfile(style, targetKey).labelSizeM, 150);
  assert.equal(resolveGraphAnnotationProfile(style, otherKey).title, "Default title");
  assert.equal(resolveGraphAnnotationProfile(style, otherKey).textColor, "#eeeeee");
});

test("seismic, volume, scene-section, and item targets use the same generic shape", async () => {
  const {
    graphAnnotationTargetKey,
    seismicSectionGraphAnnotationTarget,
    seismicVolumeGraphAnnotationTarget,
    sceneSectionGraphAnnotationTarget,
    itemGraphAnnotationTarget,
  } = await loadGraphAnnotationModule();

  const section = seismicSectionGraphAnnotationTarget({
    layerId: "seismic-layer",
    productId: "p301",
    objectKind: "2d-section-line",
    sectionId: "section",
    axis: "line",
    domainKind: "depth",
    domainUnit: "m",
  });
  const volume = seismicVolumeGraphAnnotationTarget({
    layerId: "seismic-layer",
    productId: "p3d",
    volumeId: "volume",
    domainKind: "time",
    domainUnit: "ms",
  });
  const sceneSection = sceneSectionGraphAnnotationTarget({
    layerId: "scene-section",
    targetLayerId: "seismic-layer",
    targetProductId: "p3d",
    frameId: "axis:y",
    axis: "y",
  });
  const item = itemGraphAnnotationTarget({
    layerId: "site-details",
    objectId: "well-58-32",
    objectKind: "well-trace",
    family: "item",
  });

  assert.equal(section.family, "seismic");
  assert.equal(volume.objectKind, "3d-volume");
  assert.equal(sceneSection.family, "scene-section");
  assert.equal(item.family, "item");
  for (const target of [section, volume, sceneSection, item]) {
    assert.equal(target.targetKey, graphAnnotationTargetKey(target));
    assert.doesNotMatch(JSON.stringify(target), /pageId|pageIndex|pageTitle|pageOrder/);
  }
});

test("source files expose generic graph annotation style fields and avoid Presentation Presets", () => {
  const typesSource = readFileSync(join(repoRoot, "src", "pages", "types.ts"), "utf8");
  const controlsSource = readFileSync(
    join(
      repoRoot,
      "src",
      "editor",
      "layerControls",
      "seismic",
      "SectionGraphOptionsControls.tsx",
    ),
    "utf8",
  );
  const transitionSource = readFileSync(
    join(repoRoot, "src", "scene", "transitions", "transitionEffectiveLayersForPage.ts"),
    "utf8",
  );
  const layerPanelConfigSource = readFileSync(
    join(repoRoot, "src", "editor", "layerControls", "layerPanelConfig.ts"),
    "utf8",
  );
  const seismicModelSource = readFileSync(
    join(repoRoot, "src", "editor", "layerControls", "seismic", "seismicModel.ts"),
    "utf8",
  );

  assert.match(typesSource, /graphAnnotationDefaults\?: GraphAnnotationProfile/);
  assert.match(typesSource, /graphAnnotationProfiles\?: Record<string, GraphAnnotationProfile>/);
  assert.match(typesSource, /graphAnnotationSelectedTargetKey\?: string/);
  assert.match(controlsSource, /graph-annotation-target-select/);
  assert.match(controlsSource, /graphAnnotationProfiles/);
  assert.match(controlsSource, /itemGraphAnnotationTarget/);
  assert.match(controlsSource, /Layer item\/object graph/);
  assert.match(controlsSource, /selectedProductSectionId/);
  assert.match(controlsSource, /selectedProductObjectId\(selectedProduct, style\)/);
  assert.match(layerPanelConfigSource, /"graphAnnotationDefaults"/);
  assert.match(layerPanelConfigSource, /"graphAnnotationProfiles"/);
  assert.match(layerPanelConfigSource, /"graphAnnotationSelectedTargetKey"/);
  assert.match(seismicModelSource, /sections\?: SeismicProductSectionOption\[\]/);
  assert.match(seismicModelSource, /product\.sections/);
  assert.match(seismicModelSource, /graphAnnotationDefaults/);
  assert.match(seismicModelSource, /graphAnnotationProfiles/);
  assert.match(transitionSource, /graphAnnotationProfiles|graphAnnotationSelectedTargetKey/);
  assert.doesNotMatch(controlsSource, /Presentation Presets|seismicAudiencePresetId|seismicExportLayoutId/);
});
