# Synthetic Overlay Schema - Case Study B

Purpose: define how illustrative technical overlays should be staged on top of the Shahbazi gravel pit case study without confusing them with observed source data.

All synthetic overlays must be clearly labelled as illustrative. They must not be described as measured results, operational recommendations, or engineering outputs.

## Overlay Families

Planned illustrative layers:

- Mock drill collars and intercepts
- Ore-grade heatmap / planted anomaly
- Slope stability vectors and flagged wedge
- Haul route polylines
- Blast pattern markers
- Stockpile volumetric measurements

## File Layout

Use one folder per overlay package:

```text
projects/case-study-b/data/processed/shahbazi_gravel_pit/overlays/<overlay_id>/
  geometry.geojson
  provenance.json
  README.md
```

The geometry file may be GeoJSON, raster, or another layer-specific asset, but every illustrative package must include `provenance.json`.

## `provenance.json`

Required fields:

```json
{
  "overlayId": "mock-drill-collars",
  "title": "Mock drill collars",
  "projectSlug": "case-study-b",
  "sourceDataset": "shahbazi-gravel-pit",
  "released": false,
  "illustrative": true,
  "measured": false,
  "engineeringUse": false,
  "createdBy": "GeoSee demo",
  "createdDate": "YYYY-MM-DD",
  "basis": "Illustrative geometry placed relative to reviewed Shahbazi visual base.",
  "inputFiles": [],
  "reviewStatus": "draft",
  "reviewNotes": "Do not present as measured drilling, assay, geotechnical, planning, or production data."
}
```

Allowed `reviewStatus` values:

- `draft`
- `internal-review`
- `approved-for-demo`
- `rejected`

## GeoJSON Feature Properties

Required feature properties:

```json
{
  "id": "feature-id",
  "overlayId": "mock-drill-collars",
  "label": "Display label",
  "classification": "illustrative",
  "measured": false,
  "released": false,
  "engineeringUse": false,
  "confidence": "demo",
  "notes": "Plain-language explanation of what the feature is meant to communicate."
}
```

Optional visual properties:

```json
{
  "symbol": "collar",
  "color": "#ffcc66",
  "opacity": 0.8,
  "radiusM": 3,
  "heightM": 20
}
```

## Layer-Specific Notes

Mock drill collars:

- Use `holeId`, `depthM`, `azimuthDeg`, `dipDeg`, and optional `mockIntercept`.
- `mockIntercept` must not use real assay language unless it is visibly prefixed as illustrative.

Ore-grade heatmap:

- Use `anomalyClass`, `relativeIntensity`, and `basis`.
- Do not use commodity grades, ppm, percent, or ounces unless the values are explicitly fake.

Slope stability:

- Use `vectorType`, `relativeRisk`, and `basis`.
- Do not imply engineering review or hazard confirmation.

Haul routes:

- Use `routeType`, `direction`, and `basis`.
- Do not imply live equipment tracking.

Blast pattern:

- Use `patternType`, `spacingM`, and `basis`.
- Keep it conceptual unless a real blast design is supplied.

Stockpile volumes:

- Use `volumeM3` only if generated from real measured geometry.
- For demo-only stockpiles, use `relativeVolumeClass` instead.

## Promotion Rules

An illustrative overlay can be enabled in `project.json` only when:

1. The underlying real visual base exists and loads.
2. The overlay has `provenance.json`.
3. `illustrative` is true, `measured` is false, and `engineeringUse` is false.
4. The layer label or notes make its demo status clear.
5. Review queue approval is recorded.

Do not promote synthetic overlays before the first real Shahbazi visual layer is loaded.
