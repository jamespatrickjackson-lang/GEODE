import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

const overlayDisplay = readSource("src", "presenter", "OverlayDisplay.tsx");
const navControls = readSource("src", "ui", "NavControls.tsx");
const decisionLog = readSource("docs", "03-decisions.md");

test("Global Settings suppresses the page overlay card", () => {
  assert.match(
    overlayDisplay,
    /ENVIRONMENT_SENTINEL/,
    "OverlayDisplay should know about the Global Settings sentinel.",
  );
  assert.match(
    overlayDisplay,
    /selectedPageId\s*===\s*ENVIRONMENT_SENTINEL/,
    "OverlayDisplay should detect the Global Settings authoring target.",
  );
  assert.match(
    overlayDisplay,
    /globalSettingsSuppressesOverlayCard[\s\S]{0,500}\?\s*\[\]/,
    "Global Settings should produce no overlay panel instances.",
  );
  assert.match(
    overlayDisplay,
    /renderedPanels\.length === 0\) return null/,
    "Empty overlay panel lists should render no presenter card.",
  );
});

test("navigator treats Global Settings as virtual page 00 before page 1", () => {
  assert.match(
    navControls,
    /ENVIRONMENT_SENTINEL/,
    "NavControls should know when Global Settings is selected.",
  );
  assert.match(
    navControls,
    /globalSettingsSelected/,
    "NavControls should branch on Global Settings selection.",
  );
  assert.match(
    navControls,
    /"00\. Global Settings"/,
    "Navigator title should show the virtual page-00 label.",
  );
  assert.match(
    navControls,
    /const handleNext = \(\) => \{[\s\S]{0,260}selectPage\(firstVisiblePage\.id\);[\s\S]{0,80}goto\(firstVisibleIndex\);/,
    "Next from page 00 should select and navigate to the first visible authored page.",
  );
  assert.match(
    navControls,
    /onClick=\{handleNext\}/,
    "The next button should use the Global Settings-aware handler.",
  );
});

test("decision log records Global Settings as an editor-only virtual page", () => {
  assert.match(
    decisionLog,
    /DEC-102 - Global Settings is virtual page 00 in editor navigation/,
    "decision log should capture the page-00 navigation invariant.",
  );
  assert.match(
    decisionLog,
    /Global Settings[\s\S]{0,220}no presenter overlay card/,
    "decision should record that page 00 has no card.",
  );
  assert.match(
    decisionLog,
    /Next[\s\S]{0,220}first visible authored page/,
    "decision should record the next-from-00 behavior.",
  );
});
