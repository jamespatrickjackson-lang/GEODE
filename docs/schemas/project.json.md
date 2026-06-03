# project.json schema

The manifest file at the root of every project folder. Defines what the
project is, what data layers exist, what coordinate system everything is
in, and what order the pages run in.

## Where it lives

    projects/<project-name>/project.json

Always at the project root. There is exactly one per project.

## Complete annotated example

```json
{
  "id": "woodjam-2026-investor",
  "name": "Woodjam Project — Investor Story",
  "client": "Vizsla Copper Corp.",
  "description": "District-targeting story for the Woodjam copper-gold project, central BC.",
  "version": "0.1.0",
  "status": "draft",
  "audience": "investor",
  "geoseeVersion": "alpha-0.1",

  "crs": {
    "code": "EPSG:26910",
    "label": "NAD83 / UTM zone 10N"
  },

  "registrationFrame": {
    "horizontalCrs": "EPSG:26910",
    "verticalDatum": "layer-specific",
    "units": "m",
    "coordinateBasis": "utm",
    "origin": {
      "easting_m": 602000,
      "northing_m": 5820000,
      "elevation_m": 1200
    },
    "rotationDeg": 0,
    "registrationStatus": "unverified"
  },

  "bounds": {
    "min": [592000, 5810000, 800],
    "max": [612000, 5830000, 1900]
  },

  "sceneOrigin": [602000, 5820000, 1200],

  "defaultCamera": {
    "position": [3500, 2800, 4200],
    "target": [0, 0, 0],
    "up": [0, 0, 1],
    "fov": 45
  },

  "layers": [
    {
      "id": "drillholes-2023",
      "label": "2023 Drilling",
      "type": "drillhole",
      "files": {
        "collars": "data/drillholes_2023_collars.csv",
        "surveys": "data/drillholes_2023_surveys.csv",
        "intervals": "data/drillholes_2023_intervals.csv"
      },
      "style": {
        "renderMode": "trace",
        "color": "#C85000",
        "lineWidth": 2,
        "collarSize": 6
      },
      "metadata": {
        "sourceFile": "ARIS 41597",
        "sourceDate": "2023-12-15",
        "sourceOrigin": "BC ARIS public assessment report",
        "classification": "observation",
        "confidentiality": "public",
        "notes": "19 surface drillholes, 7503.5 m total"
      }
    },
    {
      "id": "claim-boundary",
      "label": "Property Footprint",
      "type": "geojson",
      "files": {
        "geojson": "data/claim_boundary.geojson"
      },
      "style": {
        "color": "#1A1916",
        "opacity": 0.8,
        "extrudeHeight": 0
      },
      "metadata": {
        "sourceFile": "MTO claim export",
        "sourceDate": "2026-03-01",
        "sourceOrigin": "BC Ministry of Energy, Mines",
        "classification": "observation",
        "confidentiality": "public"
      }
    },
    {
      "id": "terrain",
      "label": "Topography",
      "type": "geotiff",
      "files": {
        "raster": "data/woodjam_dem_30m.tif"
      },
      "style": {
        "renderMode": "elevation-mesh",
        "verticalExaggeration": 1.5,
        "shading": "hillshade"
      },
      "metadata": {
        "sourceFile": "USGS 3DEP 30m DEM",
        "sourceDate": "2024-08-01",
        "sourceOrigin": "USGS public elevation data",
        "classification": "observation",
        "confidentiality": "public"
      }
    }
  ],

  "pageOrder": [
    "01_district_overview",
    "02_known_zones",
    "03_great_plains_target",
    "04_three_firs_vectoring",
    "05_campaign_update"
  ],

  "theme": {
    "background": "#1C1A18",
    "panelColor": "#F0EDE8",
    "accentColor": "#C85000",
    "textColor": "#1A1916",
    "fontHeading": "Inter",
    "fontBody": "Inter",
    "fontMono": "IBM Plex Mono"
  },

  "branding": {
    "logo": "assets/vizsla-logo.png",
    "subtitle": "Copper-Gold Porphyry District, Central BC"
  },

  "watermark": "Not for engineering use",

  "created": "2026-04-29T00:00:00Z",
  "modified": "2026-04-29T00:00:00Z"
}
```

## Field reference

### Top-level identification

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique slug for the project. Used in URLs and file names. Lowercase, hyphens only, no spaces. |
| `name` | string | yes | Human-readable project name shown in the UI. |
| `client` | string | no | Mining company name. Can be omitted or anonymized. |
| `description` | string | no | One-line description shown in the project list. |
| `version` | string | yes | Project version (semver). Bump on every meaningful edit. |
| `status` | enum | yes | `"draft"` or `"released"`. Affects publish behavior. |
| `audience` | string | yes | Single audience tag for alpha. Examples: `"investor"`, `"diligence"`, `"regulator"`, `"community"`, `"technical"`. |
| `geoseeVersion` | string | yes | Version of the GeoSee tool that created this project. |

### Coordinate system

| Field | Type | Required | Description |
|---|---|---|---|
| `crs.code` | string | yes | EPSG code. Examples: `"EPSG:26910"` (UTM Zone 10N NAD83), `"EPSG:32612"` (UTM Zone 12N WGS84), `"EPSG:4326"` (WGS84 lat/lon). |
| `crs.label` | string | no | Human-readable CRS name for display. |
| `registrationFrame.horizontalCrs` | string | yes for imported geospatial projects | Canonical horizontal CRS for the GeoSee project frame. Source data must be transformed into this CRS before scene-origin subtraction. |
| `registrationFrame.verticalDatum` | string | yes for imported geospatial projects | Project-level vertical reference summary. Layer-level vertical datums remain authoritative where products mix elevation, depth, model, or time domains. |
| `registrationFrame.units` | string | yes for imported geospatial projects | Project-frame unit, normally `"m"`. |
| `registrationFrame.coordinateBasis` | enum | yes for imported geospatial projects | One of `"utm"`, `"latlon"`, `"local-mesh"`, or `"model-origin"`. |
| `registrationFrame.origin` | object | yes for imported geospatial projects | CRS coordinate that maps to scene origin, with `easting_m`, `northing_m`, and `elevation_m` keys when the project frame is metre-based. |
| `registrationFrame.rotationDeg` | number | yes for imported geospatial projects | Rotation from source/model coordinates into the project frame. Use `0` only when no rotation is required or the source is already aligned. |
| `registrationFrame.registrationStatus` | enum | yes for imported geospatial projects | `"unverified"` until control-point checks validate the horizontal and vertical registration; `"validated"` only after recorded evidence exists. |
| `bounds.min` | [number, number, number] | yes | Minimum [easting, northing, elevation] of the project area in the project's CRS. |
| `bounds.max` | [number, number, number] | yes | Maximum [easting, northing, elevation] of the project area in the project's CRS. |
| `sceneOrigin` | [number, number, number] | yes | The CRS coordinate that maps to Three.js scene origin (0,0,0). Set once at project creation. Usually the centroid of `bounds`. |

**Important:** imported source data must declare its source CRS before
conversion. The import path must transform source coordinates into the project
horizontal CRS, then subtract the scene origin. Direct source-coordinate minus
scene-origin conversion is allowed only when the source CRS is explicitly the
same as the project horizontal CRS and that fact is recorded in layer metadata.
Horizontal registration and vertical datum status are tracked separately.

### Default camera

The pose used when no page is selected (e.g. when the project first loads
in the authoring UI). Page poses override this.

| Field | Type | Required | Description |
|---|---|---|---|
| `defaultCamera.position` | [number, number, number] | yes | Camera position in **scene coordinates**, not CRS coordinates. |
| `defaultCamera.target` | [number, number, number] | yes | Point the camera looks at, in scene coordinates. |
| `defaultCamera.up` | [number, number, number] | yes | Up vector. For Z-up georeferenced scenes use `[0, 0, 1]`. |
| `defaultCamera.fov` | number | yes | Field of view in degrees. Typical: `35`–`60`. |

### Layers

The `layers` array is the heart of the project. Each layer has:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique layer identifier within the project. Used in `pages/*.json`. |
| `label` | string | yes | Human-readable name shown in the layer panel. |
| `type` | enum | yes | One of: `"drillhole"`, `"geojson"`, `"gltf"`, `"geotiff"`, `"pointcloud"`. |
| `files` | object | yes | Map of role → file path (relative to project root). Role keys depend on `type`. |
| `style` | object | yes | Per-type style configuration. See per-type style reference below. |
| `metadata` | object | yes | Provenance fields. See `sources.json.md` for the canonical schema. |

Each imported geospatial layer must include `metadata.crsRegistration` with:

- `horizontalCrs`
- `verticalDatum`
- `units`
- `coordinateBasis`
- `origin`
- `rotationDeg`
- `registrationStatus`

The only valid registration statuses are `"unverified"` and `"validated"`.
User-facing accuracy labels must show review required unless status is
`"validated"` and the layer has recorded control-point evidence.

### Per-type style reference

**drillhole:**
- `renderMode`: `"collar-only"` | `"trace"` | `"lithology-cylinder"` | `"assay-cylinder"`
- `color`: hex color (used when render mode does not need data-driven coloring)
- `lineWidth`: pixels (for trace mode)
- `collarSize`: pixels (for collar dot)
- `cylinderRadius`: meters (for cylinder modes)

**drillhole `files` keys:**
- `collars` (required): CSV with at minimum `holeId, easting, northing, elevation`
- `surveys` (optional): CSV with `holeId, depth, azimuth, dip` for downhole orientation
- `intervals` (optional): CSV with `holeId, fromDepth, toDepth, lithology, assay_*`

**geojson:**
- `color`: hex color
- `opacity`: 0–1
- `extrudeHeight`: meters (for extruded polygons; 0 = flat)
- `lineWidth`: pixels (for line features)
- `pointSize`: pixels (for point features)

**gltf:**
- No required style fields — glTF carries its own materials. Optional `tint` (hex) for an overlay color.

**geotiff:**
- `renderMode`: `"draped-texture"` | `"elevation-mesh"`
- `colorRamp`: name of color ramp for single-band rasters (e.g. `"viridis"`, `"magma"`)
- `verticalExaggeration`: number (for elevation mesh mode)
- `shading`: `"none"` | `"hillshade"` | `"both"`
- `opacity`: 0–1

**pointcloud:** (deferred from alpha unless Woodjam data requires it)

### Pages

| Field | Type | Required | Description |
|---|---|---|---|
| `pageOrder` | string[] | yes | Ordered list of page IDs. Each ID corresponds to a file at `pages/<id>.json`. |

### Theme

Optional. If omitted, defaults are used (dark background, copper accent, matching the prototype palette).

### Branding

Optional. Client logo path (relative to project root) and a project subtitle.

### Watermark

| Field | Type | Required | Description |
|---|---|---|---|
| `watermark` | string | yes | Persistent watermark text on the presenter view. Default: `"Not for engineering use"`. Do not remove this without an explicit decision logged in `03-decisions.md`. |

### Timestamps

| Field | Type | Required | Description |
|---|---|---|---|
| `created` | ISO 8601 string | yes | When the project was created. |
| `modified` | ISO 8601 string | yes | Last modification timestamp. Updated automatically on save. |

## Lifecycle

- **On project creation:** copy `projects/_template/project.json`, edit `id`, `name`, `client`, `crs`, `bounds`, `sceneOrigin`. Leave `layers` empty and `pageOrder` empty initially.
- **As layers are added:** the authoring UI appends to `layers`, writes data files to `data/`.
- **As pages are added:** the authoring UI creates `pages/<id>.json` and appends the ID to `pageOrder`.
- **On every save:** `modified` timestamp updates.
- **On version bump:** the user manually bumps `version` (semver). Patch for small edits, minor for new pages, major for restructures.
- **On release:** `status` flips to `"released"`. Should not be reversible without a new version bump.

## Common pitfalls

- **CRS mismatch:** if any file in `data/` is in a different CRS from `crs.code`, layers will render in the wrong place. The tool does not detect this. Always verify CRS in QGIS before adding files.
- **sceneOrigin too far from bounds centroid:** Three.js loses precision for very large coordinate values. If `sceneOrigin` is far from the actual data, expect visual jitter. Set `sceneOrigin` to the bounds centroid.
- **Layer IDs not unique:** the loader will silently overwrite duplicates. Use the layer-add UI rather than hand-editing to avoid this.
- **pageOrder out of sync with files:** if `pageOrder` references a page that does not exist as `pages/<id>.json`, that page is skipped. If a `pages/<id>.json` exists but is not in `pageOrder`, it is invisible. Use the page-management UI to keep them aligned.
