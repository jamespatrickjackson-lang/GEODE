# sources.json schema

The provenance sidecar. Aggregates per-layer source metadata into a
single auditable record per project. Generated automatically from layer
metadata in `project.json`, then enriched manually with release info
before publishing.

This is GeoSee's evidence layer in alpha form. Per NI 43-101, written
disclosure includes pictures, maps, and websites — outputs from this
tool can sit on a mining company's disclosure surface. Provenance must
be traceable.

## Where it lives

    projects/<project-name>/provenance/sources.json

One file per project. Regenerated on every save (auto-merged with any
manual additions like approver name and release date).

A printable PDF version (`provenance/sources.pdf`) is generated at
publish time and ships alongside the published artifact.

## Complete annotated example

```json
{
  "project": "woodjam-2026-investor",
  "projectVersion": "0.1.0",
  "generated": "2026-04-29T14:32:00Z",

  "release": {
    "status": "draft",
    "releaseDate": null,
    "approver": null,
    "approverRole": null,
    "approvalNotes": null,
    "releaseNotes": null
  },

  "disclaimer": {
    "primary": "Not for engineering use. This visualization is provided for communication purposes only and must not be used as a basis for engineering, financial, or operational decisions.",
    "additional": [
      "Historical resource estimates shown are not current Mineral Resources or Mineral Reserves under NI 43-101 and should not be relied upon.",
      "Geophysical interpretations represent the company's reading of the data and are subject to revision."
    ]
  },

  "sources": [
    {
      "layerId": "drillholes-2023",
      "layerLabel": "2023 Drilling",
      "sourceFile": "ARIS 41597",
      "sourceFileLocation": "data/drillholes_2023_collars.csv (and surveys, intervals)",
      "sourceDate": "2023-12-15",
      "sourceOrigin": "BC ARIS public assessment report 41597",
      "sourceUrl": "https://apps.nrs.gov.bc.ca/pub/aris/Detail/41597",
      "classification": "observation",
      "confidentiality": "public",
      "approvalRequired": false,
      "approvalReceived": null,
      "approverName": null,
      "notes": "19 surface drillholes, 7503.5 m total, drilled by Vizsla Copper 2023 program."
    },
    {
      "layerId": "ip-chargeability-2024",
      "layerLabel": "2024 IP/DCIP Survey",
      "sourceFile": "ARIS 42648 — IP grids",
      "sourceFileLocation": "data/ip_chargeability_2024.tif",
      "sourceDate": "2024-09-30",
      "sourceOrigin": "BC ARIS public assessment report 42648",
      "sourceUrl": "https://apps.nrs.gov.bc.ca/pub/aris/Detail/42648",
      "classification": "interpretation",
      "confidentiality": "public",
      "approvalRequired": true,
      "approvalReceived": null,
      "approverName": null,
      "notes": "21.3 line-km IP/DCIP. Geophysical interpretation; not direct observation."
    },
    {
      "layerId": "great-plains-anomaly",
      "layerLabel": "Great Plains Anomaly Outline",
      "sourceFile": "Vizsla press release Oct 30 2024",
      "sourceFileLocation": "data/great_plains_anomaly.geojson",
      "sourceDate": "2024-10-30",
      "sourceOrigin": "Vizsla Copper public press release",
      "sourceUrl": "https://vizslacopper.com/news-releases/...",
      "classification": "interpretation",
      "confidentiality": "public",
      "approvalRequired": true,
      "approvalReceived": null,
      "approverName": null,
      "notes": "Anomaly polygon digitized from Figure 2 of the press release. Approximate. Company interpretation, not direct measurement."
    },
    {
      "layerId": "terrain",
      "layerLabel": "Topography",
      "sourceFile": "USGS 3DEP 30m DEM",
      "sourceFileLocation": "data/woodjam_dem_30m.tif",
      "sourceDate": "2024-08-01",
      "sourceOrigin": "USGS public elevation data",
      "sourceUrl": "https://www.usgs.gov/3d-elevation-program",
      "classification": "observation",
      "confidentiality": "public",
      "approvalRequired": false,
      "approvalReceived": null,
      "approverName": null,
      "notes": null
    }
  ],

  "summary": {
    "totalLayers": 4,
    "byClassification": {
      "observation": 2,
      "interpretation": 2,
      "narrative": 0,
      "planned": 0,
      "environmental": 0
    },
    "byConfidentiality": {
      "public": 4,
      "private": 0,
      "diligence-only": 0
    },
    "approvalsRequired": 2,
    "approvalsReceived": 0
  }
}
```

## Field reference

### Top-level

| Field | Type | Required | Description |
|---|---|---|---|
| `project` | string | yes | Project ID, matches `id` in `project.json`. |
| `projectVersion` | string | yes | Project version at the time this sidecar was generated. |
| `generated` | ISO 8601 string | yes | When this file was last regenerated. |

### Release

Manually filled by the technical approver before publish.

| Field | Type | Required | Description |
|---|---|---|---|
| `release.status` | enum | yes | `"draft"` or `"released"`. Mirrors `project.json` status. |
| `release.releaseDate` | ISO 8601 string \| null | conditional | Required when status is `"released"`. |
| `release.approver` | string \| null | conditional | Name of the person who approved release. |
| `release.approverRole` | string \| null | conditional | Their role (e.g. "Head of Subsurface Solutions"). |
| `release.approvalNotes` | string \| null | no | Free text about what was reviewed and any caveats. |
| `release.releaseNotes` | string \| null | no | What changed in this release vs. the previous version. |

A project cannot publish without `release.status === "released"` and
all conditional fields filled. The build script enforces this.

### Disclaimer

| Field | Type | Required | Description |
|---|---|---|---|
| `disclaimer.primary` | string | yes | The main disclaimer shown on the published artifact and PDF. Default text provided; can be customized per project. |
| `disclaimer.additional` | string[] | no | Project-specific additional caveats (e.g. historical estimate warnings, geophysical interpretation caveats). |

### Sources

The `sources` array is the heart of the file. One entry per layer in `project.json`. Auto-generated from layer metadata, then enriched manually for approvals.

| Field | Type | Required | Description |
|---|---|---|---|
| `layerId` | string | yes | Matches a layer ID in `project.json`. |
| `layerLabel` | string | yes | Human-readable label, copied from layer. |
| `sourceFile` | string | yes | Original source identifier (e.g. "ARIS 41597", "Mining Co Internal Database export 2026-03-15"). |
| `sourceFileLocation` | string | yes | Where the data sits in the project folder. |
| `sourceDate` | ISO 8601 date string | yes | When the source data was originally generated/collected. |
| `sourceOrigin` | string | yes | Where the data came from (organization, repository, system). |
| `sourceUrl` | string | no | URL if the source is publicly retrievable. |
| `classification` | enum | yes | One of: `"observation"`, `"interpretation"`, `"narrative"`, `"planned"`, `"environmental"`. See classification reference below. |
| `confidentiality` | enum | yes | One of: `"public"`, `"private"`, `"diligence-only"`. |
| `approvalRequired` | boolean | yes | Whether this source requires technical approver signoff before release. |
| `approvalReceived` | ISO 8601 string \| null | conditional | Required when `approvalRequired` is true and project status is `"released"`. |
| `approverName` | string \| null | conditional | Required when approval is received. |
| `notes` | string \| null | no | Free text about provenance, caveats, or processing applied. |

### Classification reference

What each classification value means and when to use it:

- **`observation`** — direct measurement or recording. Drillhole assays, raw geophysical data, terrain DEMs, GPS-surveyed boundaries. The data is what was measured, not what someone concluded from it.
- **`interpretation`** — someone's reading of observations. Geological interpretations, target outlines digitized from anomaly maps, fracture network models, resource shells, geophysical inversions. The data depends on assumptions and methodology.
- **`narrative`** — explanatory content created for the presentation, not derived from technical data. Story labels, audience-facing simplifications, artistic illustrations. Should be clearly separated from technical content.
- **`planned`** — proposed or intended future work. Drill targets not yet drilled, planned campaign areas, conceptual mine plans. Must be clearly labeled as forward-looking.
- **`environmental`** — authored scene atmosphere or rendering context, such
  as an `atmosphere-volume` mist layer. It is not a technical observation,
  interpretation, narrative claim, or planned work item; use metadata notes to
  state the rendering purpose and avoid implying data provenance.

Approval is automatically required for `interpretation` and `narrative`
classifications by default. `observation`, `planned`, and `environmental`
default to no approval required, but can be flipped to required if specific
data or presentation context is sensitive.

### Confidentiality reference

- **`public`** — already in the public domain (ARIS, SEDAR+, company press releases, government data). Can appear in the public investor view.
- **`private`** — internal mining company data not yet public. Can appear in restricted-access views (diligence rooms) but not in public versions.
- **`diligence-only`** — data shared only for specific transaction or partnership contexts. Most restricted.

In alpha (single audience per project), confidentiality mainly serves
documentation. In v1 with audience-mode multiplexing, confidentiality
will drive what each audience mode shows.

### Summary

Auto-generated counts. Useful for a quick visual check on the printed
PDF and for catching imbalances (e.g. "this is supposed to be a
data-backed investor story but 80% of layers are interpretations").

| Field | Type | Description |
|---|---|---|
| `summary.totalLayers` | number | Count of source entries. |
| `summary.byClassification` | object | Counts per classification value. |
| `summary.byConfidentiality` | object | Counts per confidentiality value. |
| `summary.approvalsRequired` | number | How many entries have `approvalRequired: true`. |
| `summary.approvalsReceived` | number | Of those, how many have approval. |

## Lifecycle

- **On every save of the project:** the tool regenerates `sources.json`, preserving any manually filled approval and release fields.
- **Before publish:** the tool checks that `release.status === "released"`, all required approvals are received, and required fields are filled. Refuses to publish if any check fails.
- **On publish:** a PDF version is generated from `sources.json` and copied into `exports/published/sources.pdf`. The PDF is one page if possible, two if not.
- **On version bump:** the previous `sources.json` is archived to `provenance/archive/sources_v<previous>.json` so historical record is preserved.

## Approval workflow (manual, alpha-grade)

1. GeoSee staff finalize the project content
2. They flip `release.status` to `"released"` (or rather, ask the technical approver to do so)
3. The technical approver reviews each layer with `approvalRequired: true`
4. For each, they either approve (fill in name, date) or reject (the project goes back to draft)
5. Once all approvals are in and release fields are filled, publish proceeds

In alpha, "approval" is informal — an email confirmation, a Slack message, or a verbal sign-off captured in `approvalNotes`. There is no signed certificate, no cryptographic verification, no separate review UI. The honor system plus the audit trail in this file.

## Common pitfalls

- **Auto-generation overwrites manual fields:** the regeneration logic must merge manual fields (approval, release, notes) with auto fields (layer metadata). Do not blindly overwrite. The implementation must be careful here.
- **Classification drift:** layers initially marked `observation` may need to flip to `interpretation` as the project evolves (e.g. a "drillhole intervals" layer becomes a "lithology interpretation" layer when the user assigns lithology codes manually). The approver should re-check classifications at release time.
- **Forgotten `approvalRequired`:** the default is automatic based on classification, but a layer's classification can change. If approvalRequired isn't re-evaluated, the project might publish without proper review. The approver should check the summary counts at release.
- **PDF generation fails silently:** if puppeteer fails to render the PDF (missing fonts, network issue), the publish should fail loudly, not skip the PDF.
