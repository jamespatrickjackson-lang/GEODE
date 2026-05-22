# Woodjam Demo — Data Manifest

This document maps the actual files in
`G:\My Drive\AI WORK\GeoSee\GeoSee_V1\Dev_files_V1\docs\woodjam`
to the alpha's schema layer types. It is the bridge between raw Drive
contents and what the GeoSee tool ingests.

This file is **specific to the Woodjam demo project**. Other projects
will get their own manifests.

## CRS decision (locked for this project)

**Project CRS: `EPSG:26910` (NAD83 / UTM Zone 10N).**

Rationale: most source data is natively in this CRS — drillhole
headers, all geophysics, the survey shapefile. Only `drills.geojson`
is in WGS84 (EPSG:4326), and reverse-converting it back to UTM is
trivial. Working in UTM means coordinates are in meters, which Three.js
handles cleanly without precision loss when combined with a
project-local `sceneOrigin`.

**`sceneOrigin: [612000, 5790000, 1000]`** — centroid of the drill
cluster, easting / northing / elevation in meters. All Three.js scene
coordinates are relative to this point, keeping numbers in the
–5000 to +5000 range for good floating-point precision.

**Project bounds (approximate, from drill collar extents plus a 2 km
buffer for geophysics):**
```
min: [608000, 5785000, 400]
max: [617000, 5795000, 1400]
```
~9 km × 10 km × 1 km. Comfortable scene size for a single Three.js
view with no LOD streaming required.

## Three Firs and the 2023 campaign — verified

Verified 2026-04-29 against Vizsla's November 27, 2024 press release
("Vizsla Copper Intersects Mineralized Breccia in Exploration Drilling
Near the Three Firs Target") and the project header CSV:

**No 2023 drillhole sits at the Three Firs target.** The Three Firs
drilling is in the 2024 campaign with the TF24- prefix (specifically
TF24-123 and TF24-126), and even those holes sit approximately 500 m
NW of the target proper. The 2024 dataset is not in Drive at
hole-resolution.

The three holes previously suspected of being at Three Firs
(WJ23-103, 105, 106) are at coordinates 612130–612194 E /
5789223–5789401 N, between the Southeast and Megaton clusters. The
"WJ" prefix is "Woodjam unspecified zone," not a zone code. WJ23-105
was abandoned at 111 m and restarted as WJ23-106 on a different
azimuth (per the `Comments` field in `Diamond Drilling_Headers.csv`).

**Implication — chapter 4 reframed (decision DEC-016).** Demo chapter 4
uses the **vectoring narrative**: 2023 drilling elsewhere on the
property + IP chargeability anomalies + Vizsla's publicly-reported
inference of a concealed porphyry under Three Firs based on
mineralized clasts in 2024 breccia. Two collar markers are added
for TF24-123 and TF24-126 at their published surface coordinates
(no traces — no downhole survey available; just collar dots labeled
"2024 drilling"). Coordinates to be extracted from Table 2 of the
press release; see prep checklist below.

**Hole count.** `Diamond Drilling_Headers.csv` contains 19 holes;
Vizsla's public statement says "18 holes" for 2023. The discrepancy
is almost certainly WJ23-105, which was abandoned at 111 m before
being redesigned as WJ23-106. The Drive data is authoritative for
the alpha; treat 19 as the working count.

## Data acquisition status

✅ **Have, in Drive:** drillhole pack (2023 campaign only), ZTEM data,
IP/DCIP profile maps and PDFs, ZTEM survey line shapefile, technical
reports.

❌ **Don't have, must source externally:**
- Terrain / DEM (no LiDAR)
- Claim or property boundary polygon
- Surface imagery for color overlay
- Drone photogrammetry / 3D site model
- Vizsla public press releases (Oct 2024 Great Plains, Nov 2024 Three
  Firs, May 2025) — Week 0 prereq per `04-build-sequence.md`
- TF24-123 and TF24-126 collar coordinates (in Table 2 of the Nov 2024
  press release; needs manual extraction — image format)

❓ **Have but need digitizing:** Three Firs target outline, Great
Plains anomaly outline — need to be digitized from Vizsla press
release figures or the IP map sheets in Drive.

## Layer-by-layer mapping

### 1. Terrain (`terrain`)

**Schema layer type:** `geotiff`, render mode `elevation-mesh`

**Source plan:** SRTM 30m DEM via NASA SRTM tile S52W122 (or its
USGS-mirrored equivalent). Sentinel-2 RGB composite for surface color
overlay.

**Why SRTM not USGS 3DEP:** USGS 3DEP doesn't cover Canada. SRTM 30m
covers the Woodjam coordinates (~52.24°N, -121.32°W) and is free.
Resolution is coarser than ideal but adequate for district-scale views.

**Canadian alternatives considered:**
- **CDEM/CDED** (Government of Canada, free, ~30m resolution at
  1:50k mapping scale) — comparable to SRTM, also viable, no login required
- **HRDEM** (1m–2m where coverage exists) — Cariboo Plateau coverage
  is patchy; would have to be checked tile-by-tile
- **CanElevation Series** via Open Government Portal — worth a quick
  check for any high-res tiles over the property

**Recommended pipeline (week 1 prep work):**
1. Download SRTM 30m or CDEM tile covering the property (~52.0–52.5°N, -121.5° to -121.0°W)
2. Reproject to EPSG:26910 in QGIS (raster reprojection, bilinear)
3. Clip to project bounds (608000–617000 E, 5785000–5795000 N)
4. Save as `data/terrain_woodjam.tif`
5. Optionally generate hillshade and save as PNG for use as a draped texture

**File budget:** ~5–10 MB after clipping at 30m resolution. Well within browser limits.

**Sentinel-2 imagery:** Optional for alpha. If time permits in week 4
(visual polish), download a cloud-free Sentinel-2 RGB composite of the
property area, reproject and clip the same way, save as
`data/imagery_woodjam.tif` and use as a color overlay on the elevation mesh.

---

### 2. Drillhole collars + traces, 2023 campaign (`drillholes-2023`)

**Schema layer type:** `drillhole`, render mode initially `trace`,
optionally `lithology-cylinder` for selected pages

**Best entry point: `drills.geojson` (61 KB)** — already pre-processed
minimum-curvature traces in WGS84. Each feature has hole ID, depth,
elevation, azimuth, dip, campaign, contractor, status. Both Point
(collar) and LineString (trace) per hole as a GeometryCollection.

**Conversion needed:** GeoJSON's coordinates are in WGS84 lat/lon.
Need to reproject to EPSG:26910 (NAD83/UTM Zone 10N) before scene
ingestion. Single proj4js pass; can run as a one-time script in week 1.

**The 19 holes by zone (verified against `Diamond Drilling_Headers.csv`):**

| Zone | Hole IDs | Count |
|---|---|---|
| Megaton (MT) | MT23-116, MT23-118 | 2 |
| Takom (TK) | TK23-111, TK23-113 | 2 |
| Megabuck (ME) | ME23-115, ME23-117 | 2 |
| Southeast (SE) | SE23-100, 101, 102, 108, 110 | 5 |
| Deerhorn (DH) | DH23-104, 107, 109, 112, 114 | 5 |
| Unnamed central (WJ) | WJ23-103, 105, 106 | 3 |
| **Total** | | **19** |

Notes on the WJ holes: all three sit at essentially one collar location
(612130–612194 E, 5789223–5789401 N), with WJ23-105 abandoned at 111 m
and WJ23-106 a restart of WJ23-103 on a different azimuth. They are
NOT at any of the named target zones. For visualization, render them
under their own group label ("Central / unnamed") rather than tying
them to a named zone.

**Coordinate extents (NAD83/UTM Zone 10N):**
- Easting: 610,318 to 615,006
- Northing: 5,787,532 to 5,792,258
- Collar elevation: 916.169 to 1,095.305 m
- Total drilled: ~7,500 m across the campaign

**Alternative source (if `drills.geojson` proves unreliable):**
build traces from the CSV pack directly:
- `Diamond Drilling_Headers.csv` (5.5 KB) → collar + planned azimuth/dip + total depth
- `Diamond Drilling_Coordinates.csv` (1.7 KB) → may be redundant with Headers
- `Diamond Drilling_Downhole Survey.csv` (34 KB) → actual downhole orientation per depth interval

Compute traces via minimum-curvature algorithm in the loader. More
work than using the pre-baked GeoJSON, but gives the same result with
full source traceability.

**Per-hole metadata to expose in the schema:**
- `id` — hole number (e.g. "MT23-118")
- `zone` — derived from prefix (MT → Megaton, TK → Takom, ME → Megabuck,
  SE → Southeast, DH → Deerhorn, WJ → Central / unnamed)
- `collarElevation_m`
- `totalDepth_m`
- `azimuth` and `dip` (planned)
- `contractor` ("Atlas" for all 2023 holes)
- `campaign` ("2023")
- `comments` — interesting holes have text (e.g. WJ23-105
  "Hole stopped as it had been redesigned"; WJ23-106 "A restart of
  WJ23-103 on a different azi")

---

### 2b. Drillhole collar markers, 2024 Three Firs (`drillholes-2024-tf`)

**Schema layer type:** `drillhole`, render mode `collar-marker` (a
simplified rendering — collar dot + label only, no trace, since no
downhole survey is available).

**Status: NEED TO ACQUIRE COORDINATES (~30 min).**

**Source:** Table 2 of Vizsla Copper's November 27, 2024 press release
("Vizsla Copper Intersects Mineralized Breccia in Exploration Drilling
Near the Three Firs Target, Woodjam Project"), accessible at
https://vizslacopper.com/news-releases/vizsla-copper-intersects-mineralized-breccia-in-exploration-drilling-near-the-three-firs-target-woodjam-project/

Table 2 in the press release contains "Drill Collar Information" for
the 2024 campaign holes including TF24-123 and TF24-126. The table is
embedded as an image (`vcu_tbl_2_2711.500x0-is.png`) and the
coordinates need to be transcribed manually.

**Two holes to include for chapter 4:**
- **TF24-123** — collar coordinates: `[easting from Table 2]` E,
  `[northing from Table 2]` N, elev `[from Table 2]` m. Total depth
  405 m. Mineralized clast-bearing breccia 363.4–405 m.
- **TF24-126** — collar coordinates: `[easting from Table 2]` E,
  `[northing from Table 2]` N, elev `[from Table 2]` m. Total depth
  638 m. Mineralized breccia in two intervals (499.7–527.3 m upper,
  598.15–638.0 m lower).

**Note on Table 2 typo:** Press release Figure 3 caption mentions a
third hole "TF24-24" — this appears to be a transcription error in
Vizsla's caption (probably TF24-124 or similar). Body text is
consistent on TF24-123 and TF24-126 only. Use only those two.

**Per-hole metadata:**
- `id` — "TF24-123" or "TF24-126"
- `zone` — "Three Firs"
- `collarElevation_m`
- `totalDepth_m` — 405 or 638 respectively
- `campaign` — "2024"
- `dataAvailable` — "collar only" (as opposed to "full trace" for 2023)
- `comments` — short summary per hole, e.g. for TF24-126:
  "Two intervals of polymictic breccia; lower returned 27.6 m of
  0.18% Cu and 0.13 g/t Au"

**Render guidance:** dot marker visually distinct from 2023 traces
(different color or shape), with a small labeled tag. Chapter 4 visual
hierarchy: target outline polygon (largest) > IP anomaly inset image
> 2024 collar dots. The point is to anchor "this is real and recent"
without overstating what we can render.

**Provenance:** Cite the press release in `provenance/sources.json`
with classification `published` and confidentiality `public`.

---

### 3. Lithology / mineralisation cylinders (`drillholes-lithology`, optional)

**Schema layer type:** `drillhole`, render mode `lithology-cylinder`

**Status for alpha: deferred unless time allows in week 4.**

The data exists and is clean:
- `Diamond Drilling_Lithology Log.csv` (147 KB) → lithology codes per
  depth interval per hole
- `Diamond Drilling_Mineralisation Log.csv` (92 KB) → mineralisation
  intensity per interval
- `Diamond Drilling_Alteration Log.csv` (115 KB) → alteration codes
  per interval

But cylinder rendering with per-interval color requires a more complex
loader than the trace-line render. Reasonable to defer to v1 unless a
specific page in chapter 2 calls for it. For alpha, the trace-line
render colored by zone is sufficient.

If implemented, expose as a separate layer (`drillholes-lithology`)
that can be toggled on individually.

---

### 4. Assay highlight intervals (`drillholes-assays`, optional)

**Schema layer type:** `drillhole`, render mode `assay-cylinder`

**Status for alpha: deferred.**

Source: `Diamond Drilling_Samples.csv` (1.6 MB, ~25,000 sample
intervals across the 19 holes). For investor demos, the typical
treatment is to show "highlight intervals" — sub-runs flagged as
mineralized — rather than every sample. Defining the highlight
threshold (e.g. ≥0.3% Cu over ≥10 m) is a deliberate editorial
decision that should be made with someone qualified, not chosen
arbitrarily during the build.

For alpha, the geophysical anomaly story is more visually compelling
than assay traces anyway. Defer.

---

### 5. Property / claim footprint (`claim-boundary`)

**Schema layer type:** `geojson`, extruded polygon at zero height
(flat outline)

**Status: NEED TO ACQUIRE.**

The Drive folder doesn't appear to contain a claim polygon shapefile
or GeoJSON. Options:

1. **BC MTO (Mineral Titles Online) public viewer** — Vizsla's claim
   tenures can be looked up by claim number from public records, and
   exported as a shapefile from the MTO portal. Free, official.
2. **Vizsla's NI 43-101 technical report** — may include a claim
   figure that can be georeferenced from a JPEG/PDF figure.
3. **Approximate from 90,163 ha footprint** — draw a bounding rectangle
   around the drill cluster + geophysics extents. Acceptable for alpha
   since the demo's first chapter only needs *roughly* "where is this."
   (Note: Vizsla's January 2024 expansion brought total claim area to
   90,163 ha; older numbers in earlier docs may say 65,252 ha.)

**Recommendation:** Try MTO export first (15 minutes if Vizsla's claim
numbers are known). Fall back to approximate bounding box if that's
slow.

---

### 6. ZTEM geophysics

**This is the largest dataset and the most painful to ingest.**

**Files in Drive:**
| File | Size | Format | Browser-loadable? |
|---|---|---|---|
| `Woodjam_ZTEM_mesh.csv` | 320 MB | CSV | ❌ way too big |
| `Woodjam_ZTEM_m_05_03.mod` | 66 MB | Geosoft binary | ❌ proprietary |
| `Woodjam_ZTEM_m_03_01.mod` | 66 MB | Geosoft binary | ❌ proprietary |
| `Woodjam_ZTEM_mesh.omf` | 10 MB | Open Mining Format | ❌ needs omf-python |
| `Woodjam_ZTEM_mesh.msh` | 65 B | UBC mesh (index only) | partial |
| `Woodjam_ZTEM_2023-01-18_ln.{shp,shx,dbf,prj,TAB}` | <2 KB | ESRI shapefile | ✅ small |

**For alpha: do NOT attempt to load the 3D ZTEM volume.** Three options
in priority order:

**Option A (recommended for alpha): treat ZTEM as 2D inset images.**
The IP/TMI/ZTEM PDF profile sheets render the geophysical
interpretations beautifully. Convert selected PDF pages to PNG (one
per chapter that mentions geophysics), include them as overlay images
in the corresponding pages' overlay panels. No 3D rendering of the
geophysical volume at all in alpha.

**Option B (if Option A feels insufficient): pre-process the OMF in
Python.** Use `omf-python` to read the mesh, extract iso-surfaces at
selected resistivity / chargeability thresholds, export the
iso-surfaces as glTF meshes. Each iso-surface becomes a small (~1–5 MB)
glTF that loads as a layer of type `gltf`. Pros: 3D geophysics in the
scene. Cons: a half-day of Python work + iso-surface threshold
selection requires geophysical judgment.

**Option C (do not do this for alpha): decimate the 320 MB mesh CSV
to a browser-loadable subsample.** Possible, but every step of this
pipeline degrades the data and bakes in arbitrary choices. Not worth
the effort for alpha.

**ZTEM survey line shapefile** (the small `*.shp/.shx/.dbf/.prj`
bundle): can be loaded as a `geojson` layer after a QGIS conversion
to GeoJSON. Useful as a thin reference layer showing where the survey
flew. Already in NAD83/UTM Zone 10N (read from `.prj` to confirm).

---

### 7. IP / DCIP geophysics

**Files in Drive (the GL220245_VizslaCopper_Woodjam_40K_* series):**

| Product | PDF size | .map size | Notes |
|---|---|---|---|
| TMI (magnetics) | 11.5 MB | 36.6 MB | Total magnetic intensity |
| IP_90Hz_TPR | 11.6 MB | 29.2 MB | Total PR chargeability, 90 Hz |
| IP_90Hz_DT | 12.2 MB | 29.3 MB | Decay-time chargeability |
| IP_360Hz_TPR | 11.7 MB | (in folder) | 360 Hz frequency |
| XIP_Profiles_PR | 14.1 MB | 47.8 MB | Cross-line in-phase |
| XQD_Profiles_PR | 14.2 MB | 47.8 MB | Cross-line quadrature |
| YIP_Profiles_PR | 14.4 MB | 47.8 MB | Inline in-phase |
| YQD_Profiles_PR | 14.2 MB | 47.8 MB | Inline quadrature |

**For alpha: PDFs as 2D overlay images.** Same approach as ZTEM
(Option A above). The .map files are Geosoft Oasis montaj proprietary
format and not browser-readable without a Geosoft licence.

**Specific use in the Woodjam content brief (chapter 4 now using
vectoring narrative + 2024 collar markers):**
- **Chapter 2** (known cluster): TMI PDF page showing the property-wide
  magnetic field, as an inset image
- **Chapter 3** (reading geophysics): IP_90Hz_TPR PDF page showing
  chargeability anomalies, as an inset image
- **Chapter 4** (vectoring concealed targets at Three Firs): one of
  the XIP or YIP profile sheets showing cross-section interpretation
  through the Three Firs area, plus the IP chargeability map showing
  the anomaly shape under the Three Firs target zone, plus the two
  TF24-123 and TF24-126 collar markers (per layer 2b above)

**Conversion step (manual, ~1 hour):**
1. Open each PDF in Acrobat or Preview
2. Identify the most relevant page (usually a single map per PDF)
3. Export that page as PNG at ~150 dpi (gives ~3000 × 4000 px)
4. Save into `projects/woodjam/overlays/<chapter>/geophysics_<product>.png`
5. Reference from the page's overlay JSON

---

### 8. Anomaly outlines (digitized)

**Schema layer type:** `geojson`, extruded polygons

**Status: REQUIRES MANUAL DIGITIZING (~half day in QGIS).**

For chapters 3 and 4, the IP chargeability anomalies and the named
target areas (Great Plains, Three Firs) appear as outlines on the
40K map sheets. To show them as 3D outlines in the Three.js scene
(rather than only as inset images), someone needs to:

1. Georeference the relevant PDF pages in QGIS (control points to
   project corners)
2. Trace the anomaly polygons as new vector features
3. Export as GeoJSON in EPSG:26910

This is the kind of work that pays off visually but takes deliberate
effort. **Decision pending** (logged in `03-decisions.md` open list).

**The Three Firs polygon is now particularly important.** Under the
chapter 4 vectoring narrative + collar markers, the Three Firs target
outline gives viewers the tangible "this is the concealed porphyry
we're inferring" anchor, and pairs with the two TF24 collar dots to
give the chapter visual depth without overclaim. If anomaly digitizing
is skipped, chapter 4 leans entirely on the IP inset image plus the
collar dots — workable but materially weaker.

**Recommendation:** Do it. Half a day of QGIS work for a visual that
materially strengthens the spine of the demo.

---

### 9. Reference reports (provenance only, not rendered)

These don't become 3D layers but they appear in the provenance trail:

| File | Size | Use |
|---|---|---|
| `2357WoodjamReport_rev1_complete.pdf` | 2.2 MB | Cited as primary technical reference in `sources.json`. |
| `2357WoodjamReport_rev1.pdf` | 64 KB | Earlier or summary version; cite if it's the document with the public-facing executive summary. |

Add to `provenance/sources.json` with classification `observation`
(report describes measured work) and confidentiality `public`. Link
the URL if a public-facing version exists; otherwise reference the
filename.

The Vizsla press releases (Oct 2024 Great Plains, Nov 2024 Three Firs,
May 2025) should also be cited in `sources.json` once acquired, since
the chapter 4 vectoring narrative + 2024 collar markers draw directly
on Vizsla's public release of November 27, 2024.

---

## Project layer summary table

This is what `project.json`'s `layers` array should ultimately contain
for the Woodjam demo:

| Layer ID | Type | Files | Status |
|---|---|---|---|
| `terrain` | geotiff | data/terrain_woodjam.tif | NEED TO ACQUIRE (SRTM/CDEM) |
| `drillholes-2023` | drillhole (trace) | data/drills.geojson (or CSV pack) | ✅ have, needs CRS reprojection |
| `drillholes-2024-tf` | drillhole (collar-marker) | data/drillholes_2024_tf.geojson | NEED TO ACQUIRE COORDS (Table 2) |
| `claim-boundary` | geojson | data/claim_boundary.geojson | NEED TO ACQUIRE (MTO export) |
| `tmi-magnetics` | image overlay | overlays/.../tmi.png | CONVERT FROM PDF (1 hour) |
| `ip-chargeability` | image overlay | overlays/.../ip_chargeability.png | CONVERT FROM PDF (1 hour) |
| `ztem-survey-lines` | geojson | data/ztem_lines.geojson | ✅ have shapefile, convert in QGIS |
| `great-plains-anomaly` | geojson | data/great_plains_anomaly.geojson | DIGITIZE FROM PDF (~half day) |
| `three-firs-anomaly` | geojson | data/three_firs_anomaly.geojson | DIGITIZE FROM PDF (~half day) |

**Optional (if time allows in week 4):**

| Layer ID | Type | Source |
|---|---|---|
| `drillholes-lithology` | drillhole (cylinder) | Lithology Log CSV |
| `imagery` | geotiff (color overlay) | Sentinel-2 |
| `ztem-isosurface` | gltf | Pre-processed from OMF in Python |

## Week 0 / Week 1 data prep checklist

Concrete tasks to complete *before* writing application code:

- [ ] Download SRTM 30m or CDEM tile for the Woodjam area
- [ ] Reproject and clip to project bounds in QGIS, save as GeoTIFF
- [ ] Reproject `drills.geojson` from EPSG:4326 to EPSG:26910, save as
  `data/drills.geojson` (overwrite — same filename)
- [ ] Get claim boundary from BC MTO portal (or fall back to bounding box)
- [ ] Convert ZTEM survey line shapefile to GeoJSON in NAD83/UTM
  Zone 10N, save as `data/ztem_lines.geojson`
- [ ] Export selected pages from TMI, IP_90Hz_TPR, XIP profiles PDFs
  as PNG (150 dpi)
- [ ] **Extract TF24-123 and TF24-126 collar coordinates from Table 2
  of Vizsla's Nov 27, 2024 press release** (manual, ~30 min); save as
  `data/drillholes_2024_tf.geojson` in EPSG:26910
- [ ] **Decision:** digitize Great Plains and Three Firs anomaly
  polygons from PDFs, or skip them in alpha
- [ ] **Decision:** keep the lithology-cylinder layer in alpha, or
  defer to v1
- [x] Confirm Three Firs hole identification from public Vizsla press
  releases — **DONE 2026-04-29.** No 2023 holes at Three Firs;
  chapter 4 reframed to vectoring narrative + 2024 collar markers
  (decision DEC-016).
- [ ] Acquire Vizsla press releases (Oct 2024 Great Plains, Nov 2024
  Three Firs, May 2025) — Week 0 prereq per `04-build-sequence.md`
- [ ] **Action:** update `docs/woodjam/content-brief.md` chapter 4 to
  reflect the vectoring narrative + 2024 collar markers

This work is not glamorous and not coding, but if it's not done by the
end of week 0, week 1 stalls. Block off time for it.

## Files NOT used in alpha

For traceability, these files exist in Drive but are not used in the
Woodjam alpha demo:

- `Woodjam_ZTEM_mesh.csv` (320 MB) — too large
- `Woodjam_ZTEM_m_05_03.mod`, `m_03_01.mod` — proprietary Geosoft
- `Woodjam_ZTEM_mesh.omf` — would require omf-python pipeline (deferred)
- All `.map` files — proprietary Geosoft, PDFs used instead
- `Diamond Drilling_Samples.csv` (assays) — deferred per layer 4 above
- `Diamond Drilling_Mineralisation Log.csv`, `Alteration Log.csv`,
  `Vein Log.csv` — deferred with lithology cylinder
- `Diamond Drilling_Specific Gravity.csv`, `Magnetic Susceptibility.csv`,
  `Geotechnical Data.csv`, `Quicklog.csv`, `Downhole Structure
  Event/Interval Log.csv` — not relevant for investor narrative

**Partially in scope (data not in Drive):**
- 2024 drilling — only TF24-123 and TF24-126 *collar coordinates* are
  pulled from the public press release. Downhole surveys, full assay
  data, and other 2024 holes (Deerhorn DH24-, Redgold RG24-) are not
  in Drive and out of scope for the alpha. Chapter 4 uses the two
  TF24 collars as markers + Vizsla's vectoring narrative.

These are not lost; they remain in Drive (where applicable) and can
be drawn on in v1 or in extended demos.
