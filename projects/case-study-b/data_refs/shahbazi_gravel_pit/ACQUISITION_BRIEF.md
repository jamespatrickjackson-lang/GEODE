# Option B1 Acquisition Brief - Shahbazi Gravel Pit

Purpose: acquire the canonical Shahbazi gravel pit supplementary dataset for Case Study B without treating any placeholder or synthetic material as measured source data.

## Confirmed Source

Primary citation:

Shahbazi, M., Menard, P., Sohn, G., Theau, J. (2019). "Unmanned aerial image dataset: Ready for 3D reconstruction." Data in Brief 25, 103962.

DOI:

`10.1016/j.dib.2019.103962`

Known article pages:

- ScienceDirect: `https://www.sciencedirect.com/science/article/pii/S2352340919303154`
- PMC mirror: `https://pmc.ncbi.nlm.nih.gov/articles/PMC6554229/`
- PubMed: `https://pubmed.ncbi.nlm.nih.gov/31194095/`

Expected license: CC-BY 4.0. Confirm this from the article or source package before external publication.

## Source Dataset Location

Canonical article access remains the ScienceDirect article and its Appendix A / Supplementary data section.

The article text also names the large raw-image storage location:

`https://drive.google.com/open?id=1nFag4gJBDLiDD6muD-YkbRZocawbUBBR`

Treat this as the raw-image storage link from the paper, then confirm from ScienceDirect / DOI supplementary data before final receipt.

Elsevier supplementary assets found via the article's official CDN:

- `https://ars.els-cdn.com/content/image/1-s2.0-S2352340919303154-mmc1.pdf`
- `https://ars.els-cdn.com/content/image/1-s2.0-S2352340919303154-mmc2.zip`
- `https://ars.els-cdn.com/content/image/1-s2.0-S2352340919303154-mmc3.zip`

Likely role:

- `mmc1.pdf`: transparency / supplementary document
- `mmc2.zip` and `mmc3.zip`: non-image supplementary data packages

Download or inspect `mmc2.zip` and `mmc3.zip` from the archive/source location
before concluding any companion source files are missing.

Article-level source facts:

- Data source location: Sherbrooke, Quebec, Canada
- Type of data: TIFF images and text files
- Image folder: `RawImages`
- Direct exterior orientation file: `DirectEOPs.txt`
- Timestamp file: `TimeStamps.txt`
- Tie/corresponding point file: `TiePoints.txt`
- Coordinate reference system in `DirectEOPs.txt`: NAD83 / MTM Zone 7
- Elevations: ellipsoidal heights

## Current Local Acquisition Status

Archived source inventory:

- `Part3-RawImages.zip`
- `RawImages/`
- 158 `.tiff` images
- Extracted image payload is about 7 GB
- `DirectEOPs.txt`
- `TimeStamps.txt`
- `TiePoints.txt`
- Ground control / check point files
- TLS / terrestrial LiDAR point cloud
- `ObjectPoints.txt`
- `RefinedEOPs.txt`
- `RefinedIOPs.txt`
- `GCPs.txt`
- `DenseMatching.txt`
- `LaserScan.xyz`
- `1-s2.0-S2352340919303154-mmc2.zip`
- `1-s2.0-S2352340919303154-mmc3.zip`

Observed counts:

- `RawImages/`: 158 TIFF files
- `DirectEOPs.txt`: 158 rows
- `RefinedEOPs.txt`: 158 rows
- `TimeStamps.txt`: 158 rows
- `TiePoints.txt`: 41,346 rows
- `ObjectPoints.txt`: 3,682 rows
- `GCPs.txt`: 109 rows
- `DenseMatching.txt`: 17 image pairs
- `LaserScan.xyz`: 8,308,685 points

Candidate source packages for the remaining files:

- `1-s2.0-S2352340919303154-mmc2.zip`
- `1-s2.0-S2352340919303154-mmc3.zip`

## Expected Bundle Contents

Per the paper, expect:

- 158 uncompressed TIFF UAV images
- At least 1.5 cm GSD and more than 80 percent endlap
- About 150 x 200 m coverage at about 80 m altitude
- 109 GPS-surveyed ground control and check points with 3D coordinates
- About 40,000 pre-matched 2D corresponding image points
- 25 multi-view stereo images over a 30 x 40 m sub-zone
- Dense terrestrial laser scanner point cloud over the same sub-zone

These are expected contents only. Do not mark any item as present until the source package is downloaded and inspected.

## Step 1 - Find The Canonical Download

1. Open the ScienceDirect article page:
   `https://www.sciencedirect.com/science/article/pii/S2352340919303154`
2. Scroll to the article bottom and find Appendix A / Supplementary data.
3. Check the raw-image online storage link from the article:
   `https://drive.google.com/open?id=1nFag4gJBDLiDD6muD-YkbRZocawbUBBR`
4. Record what is available:
   - Inline ZIP or other attached file
   - Mendeley Data DOI, likely in the `10.17632/...` family
   - External repository link
   - Broken or missing link
5. Download the source package if available.
6. Place downloaded source files in the archive path mapped from:
   `projects/case-study-b/data/raw/shahbazi_gravel_pit/`
7. Do not commit raw source files unless that is an intentional repository decision.

## Step 2 - Record The Receipt

Create or update local receipt notes with:

- Source page URL
- Download URL
- Access date
- File names
- File sizes
- Checksums, if practical
- License text or license URL
- Any citation requirements

Keep source receipt notes in this folder. Historical sample staging receipts
were purged from the active repo; source recovery is through
`docs/archive-map.md` and `docs/archive-manifest.json`, not Git history.

## Step 3 - If Download Fails

If the supplementary material is missing, blocked, or broken, send the email in:

`AUTHOR_CONTACT_TEMPLATE.md`

Do this the same day as the failed download attempt so the project is not blocked silently.

## Step 4 - Handoff After Data Lands

Once files are located in the archive or temporarily restored from:

`projects/case-study-b/data/raw/shahbazi_gravel_pit/`

complete:

`TRIAGE_CHECKLIST.md`

Then update the unresolved and review records with real facts instead of assumptions.

## Boundaries

- Do not download data into the repo through automation unless explicitly directed.
- Do not enable Shahbazi layers in `project.json` until processed outputs exist.
- Do not remove the procedural Case Study B shell.
- Do not force Shahbazi coordinates into Woodjam CRS.
- Keep source data, processed derivatives, and synthetic overlays clearly separated.
