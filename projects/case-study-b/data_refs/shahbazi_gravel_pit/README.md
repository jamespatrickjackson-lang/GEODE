# Shahbazi Gravel Pit Source Reference

This folder tracks reference notes for the Shahbazi gravel pit dataset before any source files are copied into GeoSee data folders.

Citation:

Shahbazi, Menard, Sohn, Theau (2019), "Unmanned aerial image dataset: Ready for 3D reconstruction," Data in Brief 25, 103962. DOI: 10.1016/j.dib.2019.103962.

Expected source material:

- UAV RGB image sets
- GPS ground control points and check points
- Corresponding image points
- Multi-view stereo images or reconstruction inputs
- Terrestrial laser scanner point cloud for the reported 30 x 40 m sub-zone

Source files are external to this repository. Keep download notes, checksums, filenames, license/citation notes, and inspection findings here. Do not treat derived GeoSee outputs as source truth.

Raw downloaded files should be placed in:

`projects/case-study-b/data/raw/shahbazi_gravel_pit/`

Reviewed processed outputs should be written later under:

`projects/case-study-b/data/processed/shahbazi_gravel_pit/`

Current action documents:

- `ACQUISITION_BRIEF.md` - step-by-step job for finding, downloading, and recording the canonical source package.
- `AUTHOR_CONTACT_TEMPLATE.md` - short email to send if the supplementary data link is unavailable or broken.
- `TRIAGE_CHECKLIST.md` - first-pass inspection checklist to complete after source files are placed locally.
- `INGEST_PIPELINE_BRIEF.md` - implementation brief for turning real files into GeoSee-ready assets.
- `SYNTHETIC_OVERLAY_SCHEMA.md` - required provenance rules for illustrative overlays.
- `CHAPTER_AND_DEMO_FLOW_NOTES.md` - chapter, provenance, and stakeholder demo-flow notes after real data lands.
- `PROCESSING_TODO.md` - processing and web-conversion sequence after triage.
