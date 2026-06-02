import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const typesSource = readFileSync(
  join(repoRoot, "src", "pages", "types.ts"),
  "utf8",
);
const editorRootSource = readFileSync(
  join(repoRoot, "src", "editor", "EditorRoot.tsx"),
  "utf8",
);
const environmentPanelSource = readFileSync(
  join(repoRoot, "src", "editor", "EnvironmentScenePanel.tsx"),
  "utf8",
);

test("editor chrome schema includes project-heading logo controls", () => {
  for (const field of [
    "uiScale?: number",
    "headerLogoPath?: string",
    "headerLogoVisible?: boolean",
    "headerLogoSizePx?: number",
    "headerLogoGapPx?: number",
    "headerLogoPaddingTopPx?: number",
    "headerLogoPaddingRightPx?: number",
    "headerLogoPaddingBottomPx?: number",
    "headerLogoPaddingLeftPx?: number",
    "headerLogoOpacity?: number",
    "headerLogoBackgroundTransparent?: boolean",
    "headerLogoBackgroundCutoff?: number",
    "headerLogoEdgeSoftness?: number",
    "headerLogoForegroundWhite?: boolean",
    "headerLogoCropX?: number",
    "headerLogoCropY?: number",
    "headerLogoCropWidth?: number",
    "headerLogoCropHeight?: number",
    "headerTitleVisible?: boolean",
  ]) {
    assert.ok(
      typesSource.includes(field),
      `EditorChromeSettings should expose ${field}`,
    );
  }
});

test("editor chrome can emulate compact browser zoom through app UI scale", () => {
  assert.ok(
    editorRootSource.includes("editorUiScale"),
    "EditorRoot should derive editorUiScale from scene.gui.editor",
  );
  assert.ok(
    editorRootSource.includes("transform: `scale(${editorUiScale})`"),
    "EditorRoot should scale the editor chrome rather than relying on browser zoom",
  );
  assert.ok(
    editorRootSource.includes("transformOrigin: \"top left\""),
    "EditorRoot should keep scaled editor chrome anchored to the top-left position",
  );
});

test("editor heading renders a configured logo before the project title", () => {
  assert.ok(
    editorRootSource.includes("editorHeaderLogoSrc"),
    "EditorRoot should derive a header logo src from scene.gui.editor",
  );
  assert.ok(
    editorRootSource.indexOf("editorHeaderLogoSrc") <
      editorRootSource.indexOf("state.manifest.name"),
    "logo render branch should appear before the project name text",
  );
});

test("editor heading title text can be toggled independently of the logo", () => {
  assert.ok(
    editorRootSource.includes("editorHeaderTitleVisible"),
    "EditorRoot should derive a header title visibility flag",
  );
  assert.ok(
    editorRootSource.includes("{editorHeaderTitleVisible && (") &&
      editorRootSource.includes("data-editor-header-title=\"true\"") &&
      editorRootSource.includes("{state.manifest.name}"),
    "project title text should render only when the visibility flag is enabled",
  );
  assert.ok(
    environmentPanelSource.includes("Heading text") &&
      environmentPanelSource.includes("headerTitleVisible"),
    "Cinematics editor should expose a heading text toggle",
  );
});

test("editor heading logo supports non-destructive transparent background treatment", () => {
  assert.ok(
    editorRootSource.includes("EditorHeaderLogo"),
    "EditorRoot should render the heading logo through a dedicated component",
  );
  assert.ok(
    editorRootSource.includes("createTransparentHeaderLogo"),
    "EditorRoot should create a transparent logo at source image resolution",
  );
  assert.ok(
    editorRootSource.includes("const naturalWidth = image.naturalWidth") &&
      editorRootSource.includes("const naturalHeight = image.naturalHeight") &&
      editorRootSource.includes("canvas.width = sourceWidth") &&
      editorRootSource.includes("canvas.height = sourceHeight"),
    "logo processing should preserve natural crop resolution instead of downsampling",
  );
  assert.ok(
    !editorRootSource.includes("mixBlendMode: editorHeaderLogoKnockout ? \"screen\" : undefined") &&
      !editorRootSource.includes("filter: editorHeaderLogoFilter"),
    "the previous CSS filter/blend path should not be used for logo background removal",
  );
});

test("editor heading logo crop is applied at source image resolution", () => {
  assert.ok(
    editorRootSource.includes("headerLogoCropX") &&
      editorRootSource.includes("headerLogoCropY") &&
      editorRootSource.includes("headerLogoCropWidth") &&
      editorRootSource.includes("headerLogoCropHeight"),
    "EditorRoot should read normalized crop settings from scene.gui.editor",
  );
  assert.ok(
    editorRootSource.includes("sourceX") &&
      editorRootSource.includes("sourceY") &&
      editorRootSource.includes("sourceWidth") &&
      editorRootSource.includes("sourceHeight"),
    "logo processing should derive crop source pixels from the natural image",
  );
  assert.ok(
    editorRootSource.includes("context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)"),
    "logo processing should crop from source pixels before transparent-background processing",
  );
});

test("editor heading logo layout height follows the processed crop aspect", () => {
  assert.ok(
    editorRootSource.includes('height: "auto"'),
    "EditorRoot should let the processed logo image define its own cropped height",
  );
  assert.ok(
    !editorRootSource.includes("height: sizePx"),
    "EditorRoot should not reserve square vertical space after applying a wide crop",
  );
});

test("editor heading logo supports logo-specific padding on all sides", () => {
  assert.ok(
    editorRootSource.includes("editorHeaderLogoPaddingTop") &&
      editorRootSource.includes("editorHeaderLogoPaddingRight") &&
      editorRootSource.includes("editorHeaderLogoPaddingBottom") &&
      editorRootSource.includes("editorHeaderLogoPaddingLeft"),
    "EditorRoot should derive logo-specific padding on all sides from scene.gui.editor",
  );
  assert.ok(
    editorRootSource.includes("paddingTop: logoPaddingTopPx") &&
      editorRootSource.includes("paddingRight: logoPaddingRightPx") &&
      editorRootSource.includes("paddingBottom: logoPaddingBottomPx") &&
      editorRootSource.includes("paddingLeft: logoPaddingLeftPx"),
    "EditorHeaderLogo should apply logo-specific padding without changing shared header padding",
  );
  assert.ok(
    environmentPanelSource.includes("Pad top") &&
      environmentPanelSource.includes("headerLogoPaddingTopPx") &&
      environmentPanelSource.includes("Pad right") &&
      environmentPanelSource.includes("headerLogoPaddingRightPx") &&
      environmentPanelSource.includes("Pad bottom") &&
      environmentPanelSource.includes("headerLogoPaddingBottomPx") &&
      environmentPanelSource.includes("Pad left") &&
      environmentPanelSource.includes("headerLogoPaddingLeftPx"),
    "Cinematics editor should expose logo-specific padding controls on all sides",
  );
});

test("editor heading logo can be sized larger than the current compact default", () => {
  assert.ok(
    editorRootSource.includes("headerLogoSizePx,") &&
      editorRootSource.includes("160,"),
    "EditorRoot should allow larger heading logos through the size clamp",
  );
  assert.ok(
    environmentPanelSource.includes("max={160}"),
    "EnvironmentScenePanel should expose a larger logo size range",
  );
});

test("cinematics editor exposes upload and sizing controls for the heading logo", () => {
  for (const required of [
    "UI scale",
    "onEditorLogoFile",
    "data-testid=\"editor-heading-logo-file\"",
    "Header logo",
    "headerLogoPath",
    "headerLogoSizePx",
    "headerLogoGapPx",
    "headerLogoPaddingTopPx",
    "headerLogoPaddingRightPx",
    "headerLogoPaddingBottomPx",
    "headerLogoPaddingLeftPx",
    "headerLogoOpacity",
    "Transparent bg",
    "Crop",
    "Logo crop preview",
    "Crop X",
    "Crop Y",
    "Crop W",
    "Crop H",
    "cropMidlineHorizontalStyle",
    "cropMidlineVerticalStyle",
    "data-testid=\"editor-heading-logo-crop\"",
    "BG cutoff",
    "Edge softness",
    "Text to white",
  ]) {
    assert.ok(
      environmentPanelSource.includes(required),
      `EnvironmentScenePanel should include ${required}`,
    );
  }
});
