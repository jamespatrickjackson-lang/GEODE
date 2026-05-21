// Case Study B audience lens configurations.
//
// Each lens describes the scene/style/visibility patch applied when an
// audience role (investor, public, government, regulatory) is selected
// in the editor. AudienceLensControls picks one and the editor pipes it
// through applyAudienceLensToState / applyAudienceLensSceneToEnvironment
// (which live in src/audience/audienceLenses.ts — they're project-agnostic).
//
// The lens types (AudienceLensId, AudienceLensConfig) also stay in
// src/audience/audienceLenses.ts so future projects can declare their own
// arrays against the same shape.
//
// TLS_SURFACE / TLS_CONTOUR layer IDs are Shahbazi-specific assets the
// case-study-b demo references for surface backdrop. Imported from the
// Shahbazi project module via import-as aliases so call sites below stay
// readable.

import type {
  AudienceLensConfig,
  AudienceLensId,
} from "../../audience/audienceLenses";
import { CASE_STUDY_B_DEMO_SHELL_LAYER_ID as DEMO_SHELL_LAYER_ID } from "./layerIds";
import {
  SHAHBAZI_GROUND_SURFACE_LAYER_ID as TLS_SURFACE_LAYER_ID,
  SHAHBAZI_GROUND_CONTOUR_LAYER_ID as TLS_CONTOUR_LAYER_ID,
} from "../shahbazi/layerIds";

export const CASE_STUDY_B_AUDIENCE_LENSES: AudienceLensConfig[] = [
  {
    id: "investor",
    label: "Investor",
    targetPageId: "03_anomaly_story",
    summary:
      "Dark, focused, high contrast; emphasizes hotspot, drill trace, volumes, and risk cue.",
    scene: {
      background: "#151819",
      exposure: 1.08,
      fog: { color: "#151819", density: 0.000095 },
      colorGrade: {
        contrast: 1.12,
        saturation: 1.08,
        tint: "#11161b",
        tintStrength: 0.045,
      },
      vignette: { strength: 0.92, smoothness: 0.68 },
      bloom: { strength: 0.12, radius: 0.52, threshold: 0.86 },
      camera: { fov: 46 },
      gui: {
        labels: {
          maxSiteLabelsDesktop: 18,
          maxSiteLabelsMobile: 10,
          fadeNearM: 2400,
          fadeFarM: 7600,
        },
      },
    },
    layerStyles: {
      [DEMO_SHELL_LAYER_ID]: {
        showLabels: true,
        labelKind: "area",
        labelTextColor: "#fff8ec",
        labelOutlineColor: "#ffd27a",
        labelFillColor: "#141219",
        labelFillOpacity: 0.78,
      },
      "quarry-ore-grade-heatmap": { opacity: 0.82 },
      [TLS_SURFACE_LAYER_ID]: { opacity: 0.68, showLabels: false },
      [TLS_CONTOUR_LAYER_ID]: { opacity: 0.9, lineWidth: 1.6, showLabels: false },
      "quarry-drill-traces": { opacity: 1, showLabels: true },
      "stockpile-volume-zones": { opacity: 0.94, showLabels: true },
      "slope-stability-anomaly": { opacity: 0.86, showLabels: true },
      "restoration-preview": { opacity: 0.18, showLabels: false },
      "public-viewshed-overlay": { opacity: 0.12, showLabels: false },
    },
    visibilityOverrides: {
      [DEMO_SHELL_LAYER_ID]: true,
      "quarry-ore-grade-heatmap": true,
      [TLS_SURFACE_LAYER_ID]: true,
      [TLS_CONTOUR_LAYER_ID]: true,
      "quarry-drill-traces": true,
      "stockpile-volume-zones": true,
      "slope-stability-anomaly": true,
      "restoration-preview": false,
      "public-viewshed-overlay": false,
      "erosion-runoff-planning": false,
    },
    zoneOpacity: {
      "bench-walkthrough": 0.72,
      "ore-grade-hotspot": 1.35,
      "stockpile-volume-zone": 1.2,
      "slope-stability-anomaly": 1.12,
      "restoration-preview": 0.18,
      "public-viewpoint": 0.16,
    },
    zoneLabels: {
      "bench-walkthrough": true,
      "ore-grade-hotspot": true,
      "stockpile-volume-zone": true,
      "slope-stability-anomaly": true,
      "restoration-preview": false,
      "public-viewpoint": false,
    },
  },
  {
    id: "public",
    label: "Public",
    targetPageId: "05_public_communication",
    summary:
      "Lighter, calmer landscape context; emphasizes walkthrough, restoration, and public viewpoint.",
    scene: {
      background: "#dce8ee",
      exposure: 1.08,
      fog: { color: "#dce8ee", density: 0.00008 },
      colorGrade: { contrast: 0.96, saturation: 0.92, tint: "#e7efe8" },
      bloom: { strength: 0, radius: 0.45, threshold: 0.9 },
      camera: { fov: 52 },
      gui: {
        labels: {
          maxSiteLabelsDesktop: 8,
          maxSiteLabelsMobile: 5,
          fadeNearM: 2100,
          fadeFarM: 6200,
        },
      },
    },
    layerStyles: {
      [DEMO_SHELL_LAYER_ID]: {
        showLabels: true,
        labelKind: "area",
        labelTextColor: "#183323",
        labelOutlineColor: "#ffffff",
        labelFillColor: "#eff7ed",
        labelFillOpacity: 0.82,
      },
      "restoration-preview": { opacity: 0.86, showLabels: true },
      [TLS_SURFACE_LAYER_ID]: { opacity: 0.55, showLabels: false },
      [TLS_CONTOUR_LAYER_ID]: { opacity: 0.38, lineWidth: 1.1, showLabels: false },
      "public-viewshed-overlay": { opacity: 0.72 },
      "erosion-runoff-planning": { opacity: 0.48 },
      "quarry-ore-grade-heatmap": { opacity: 0.08, showLabels: false },
      "quarry-drill-traces": { opacity: 0.08, showLabels: false },
      "slope-stability-anomaly": { opacity: 0.1, showLabels: false },
    },
    visibilityOverrides: {
      [DEMO_SHELL_LAYER_ID]: true,
      [TLS_SURFACE_LAYER_ID]: true,
      [TLS_CONTOUR_LAYER_ID]: true,
      "restoration-preview": true,
      "public-viewshed-overlay": true,
      "erosion-runoff-planning": true,
      "quarry-ore-grade-heatmap": false,
      "quarry-drill-traces": false,
      "slope-stability-anomaly": false,
      "stockpile-volume-zones": false,
    },
    zoneOpacity: {
      "bench-walkthrough": 0.9,
      "ore-grade-hotspot": 0.12,
      "stockpile-volume-zone": 0.28,
      "slope-stability-anomaly": 0.16,
      "restoration-preview": 1.28,
      "public-viewpoint": 1.2,
    },
    zoneLabels: {
      "bench-walkthrough": true,
      "ore-grade-hotspot": false,
      "stockpile-volume-zone": false,
      "slope-stability-anomaly": false,
      "restoration-preview": true,
      "public-viewpoint": true,
    },
  },
  {
    id: "government",
    label: "Government",
    targetPageId: "04_planning_governance",
    summary:
      "Neutral, map-like presentation; emphasizes access, planning, runoff, and stockpile context.",
    scene: {
      background: "#d2d5d2",
      exposure: 1.04,
      fog: { color: "#d2d5d2", density: 0.00009 },
      colorGrade: { contrast: 1.0, saturation: 0.86, tint: "#d6d5cf" },
      bloom: { strength: 0, radius: 0.45, threshold: 0.9 },
      camera: { fov: 50 },
      gui: {
        labels: {
          maxSiteLabelsDesktop: 14,
          maxSiteLabelsMobile: 8,
          fadeNearM: 2400,
          fadeFarM: 7800,
        },
      },
    },
    layerStyles: {
      [DEMO_SHELL_LAYER_ID]: {
        showLabels: true,
        labelKind: "area",
        labelTextColor: "#202728",
        labelOutlineColor: "#ffffff",
        labelFillColor: "#f0f1ec",
        labelFillOpacity: 0.76,
      },
      "haul-route-equipment-demo": { opacity: 0.92 },
      [TLS_SURFACE_LAYER_ID]: { opacity: 0.62, showLabels: false },
      [TLS_CONTOUR_LAYER_ID]: { opacity: 0.78, lineWidth: 1.35, showLabels: false },
      "stockpile-volume-zones": { opacity: 0.9, showLabels: true },
      "erosion-runoff-planning": { opacity: 0.9 },
      "bench-conformance-overlay": { opacity: 0.76, showLabels: true },
      "quarry-ore-grade-heatmap": { opacity: 0.16 },
    },
    visibilityOverrides: {
      [DEMO_SHELL_LAYER_ID]: true,
      [TLS_SURFACE_LAYER_ID]: true,
      [TLS_CONTOUR_LAYER_ID]: true,
      "haul-route-equipment-demo": true,
      "stockpile-volume-zones": true,
      "erosion-runoff-planning": true,
      "bench-conformance-overlay": true,
      "quarry-ore-grade-heatmap": false,
      "restoration-preview": false,
      "public-viewshed-overlay": false,
    },
    zoneOpacity: {
      "bench-walkthrough": 0.85,
      "ore-grade-hotspot": 0.18,
      "stockpile-volume-zone": 1.28,
      "slope-stability-anomaly": 0.58,
      "restoration-preview": 0.48,
      "public-viewpoint": 0.45,
    },
    zoneLabels: {
      "bench-walkthrough": true,
      "ore-grade-hotspot": false,
      "stockpile-volume-zone": true,
      "slope-stability-anomaly": true,
      "restoration-preview": false,
      "public-viewpoint": false,
    },
  },
  {
    id: "regulatory",
    label: "Regulatory",
    targetPageId: "04_planning_governance",
    summary:
      "Restrained, source-forward view; emphasizes conformance, slope anomaly, runoff, and review status.",
    scene: {
      background: "#f0f0ec",
      exposure: 0.96,
      fog: { color: "#f0f0ec", density: 0.00007 },
      colorGrade: { contrast: 0.98, saturation: 0.72, tint: "#eeeeea" },
      bloom: { strength: 0, radius: 0.35, threshold: 0.95 },
      camera: { fov: 49 },
      gui: {
        labels: {
          maxSiteLabelsDesktop: 22,
          maxSiteLabelsMobile: 12,
          fadeNearM: 2600,
          fadeFarM: 8200,
        },
      },
    },
    layerStyles: {
      [DEMO_SHELL_LAYER_ID]: {
        showLabels: true,
        labelKind: "area",
        labelTextColor: "#1d2222",
        labelOutlineColor: "#4c5454",
        labelFillColor: "#ffffff",
        labelFillOpacity: 0.88,
      },
      "bench-conformance-overlay": { opacity: 0.95, showLabels: true },
      "slope-stability-anomaly": { opacity: 0.95, showLabels: true },
      "erosion-runoff-planning": { opacity: 0.92 },
      [TLS_SURFACE_LAYER_ID]: { opacity: 0.66, showLabels: false },
      [TLS_CONTOUR_LAYER_ID]: { opacity: 0.92, lineWidth: 1.55, showLabels: false },
      "quarry-ore-grade-heatmap": { opacity: 0.1, showLabels: false },
      "restoration-preview": { opacity: 0.16, showLabels: false },
    },
    visibilityOverrides: {
      [DEMO_SHELL_LAYER_ID]: true,
      "bench-conformance-overlay": true,
      "slope-stability-anomaly": true,
      "erosion-runoff-planning": true,
      [TLS_SURFACE_LAYER_ID]: true,
      [TLS_CONTOUR_LAYER_ID]: true,
      "quarry-ore-grade-heatmap": false,
      "restoration-preview": false,
      "public-viewshed-overlay": false,
      "haul-route-equipment-demo": false,
    },
    zoneOpacity: {
      "bench-walkthrough": 0.62,
      "ore-grade-hotspot": 0.12,
      "stockpile-volume-zone": 0.56,
      "slope-stability-anomaly": 1.25,
      "restoration-preview": 0.18,
      "public-viewpoint": 0.12,
    },
    zoneLabels: {
      "bench-walkthrough": true,
      "ore-grade-hotspot": false,
      "stockpile-volume-zone": true,
      "slope-stability-anomaly": true,
      "restoration-preview": false,
      "public-viewpoint": false,
    },
  },
];

export function audienceLensById(id: AudienceLensId): AudienceLensConfig {
  return (
    CASE_STUDY_B_AUDIENCE_LENSES.find((lens) => lens.id === id) ??
    CASE_STUDY_B_AUDIENCE_LENSES[0]
  );
}
