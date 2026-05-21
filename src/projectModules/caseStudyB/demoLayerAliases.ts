// Case Study B demo-shell aliasing table.
//
// In the case-study-b demo, loadDemoQuarry assembles every visible feature
// (quarry surface, drill traces, haul route, etc.) as named children of a
// single demo-shell mesh. The project.json declares logical "public" layer
// IDs (e.g. "quarry-imagery-base", "bench-conformance-overlay"). This map
// tells SceneManager how to translate a public layer ID to the shell-child
// objects + zones it owns, so visibility/style edits on public layers
// affect the right pieces of the shell.
//
// Pure data table — SceneManager owns the lookup and apply logic.

export type CaseStudyBDemoLayerAlias = {
  all?: boolean;
  zoneIds?: readonly string[];
  objectNames?: readonly string[];
  applyColor?: boolean;
};

export const CASE_STUDY_B_DEMO_LAYER_ALIASES: Record<
  string,
  CaseStudyBDemoLayerAlias
> = {
  "quarry-imagery-base": {
    objectNames: ["case-study-b-demo-surface"],
    applyColor: true,
  },
  "quarry-lidar-surface": {
    objectNames: ["case-study-b-demo-grid"],
    applyColor: true,
  },
  "bench-conformance-overlay": {
    zoneIds: ["bench-walkthrough"],
    objectNames: ["case-study-b-demo-bench-lines"],
    applyColor: true,
  },
  "haul-route-equipment-demo": {
    objectNames: ["case-study-b-demo-haul-route"],
    applyColor: true,
  },
  "stockpile-volume-zones": {
    zoneIds: ["stockpile-volume-zone"],
    applyColor: true,
  },
  "quarry-drill-traces": {
    objectNames: ["case-study-b-demo-drill-traces"],
    applyColor: true,
  },
  "quarry-ore-grade-heatmap": {
    zoneIds: ["ore-grade-hotspot"],
    applyColor: true,
  },
  "slope-stability-anomaly": {
    zoneIds: ["slope-stability-anomaly"],
    applyColor: true,
  },
  "erosion-runoff-planning": {
    objectNames: ["case-study-b-demo-runoff-lines"],
    applyColor: true,
  },
  "restoration-preview": {
    zoneIds: ["restoration-preview"],
    applyColor: true,
  },
  "public-viewshed-overlay": {
    zoneIds: ["public-viewpoint"],
    applyColor: true,
  },
};
