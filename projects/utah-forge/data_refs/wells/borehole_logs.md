# Utah FORGE Borehole Logs

This note records the source path and claim boundary for the source-derived
layer `utah-forge-borehole-logs`.

## Active Artifact

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/borehole_logs/borehole_logs_manifest.json
```

The artifact is generated from public GDR source intake staged outside source
control:

```text
.tmp/source-intake/utah-forge-borehole-logs/
```

Raw LAS, ZIP, PDF, CSV, XLSX, and DLIS source bytes are not committed. The
committed JSON manifest keeps only derived samples, trajectory references,
inventory summaries, render eligibility, source URLs, and explicit gap status.

## Source Set

- GDR 1358: updated well, pad, and seismic GPS coordinates.
- GDR 1283: 16A drilling data, survey workbook, and final mud log.
- GDR 1292: 16A Schlumberger logs, including the standalone spectral LAS.
- GDR 1516: 16B survey and drilling/mud log archives.
- GDR 1531: 16B Schlumberger wireline logs. The 5.14 GB wireline ZIP is
  recorded as `download-skipped:large-resource` unless supplied locally.
- GDR 1006: 58-32 drilling, PT, sonic, and large log packages. The 1.6 GB log
  ZIP is recorded as `download-skipped:large-resource` unless supplied locally.
- GDR 1153: Phase2C well locations and 68-32/78-32 drilling, lithology, and
  cuttings packages.
- GDR 1440: external borehole sensor and trajectory spreadsheet collection,
  recorded as an external trajectory cross-check source.

## Current Render Status

`16A(78)-32` is the only renderable well in the generated manifest. The
renderer maps the parsed GDR 1292 HCGR and HSGR gamma tracks by measured depth
onto the existing validated 16A trajectory from the demo borehole manifest.

`78-32` has a parsed GDR 1153 gamma track, but no validated trajectory is
available in the active project, so it remains
`source-blocked:no-validated-trajectory`.

`16B(78)-32`, `58-32`, `68-32`, and `78B-32` remain explicit source gaps for
this layer. The intake inventories machine-readable and PDF-only material, but
no renderable GR/resistivity/lithology track is emitted unless a tested parser
extracts the track and a validated trajectory is present.

DLIS and PDF members are inventoried only. They are not parsed or rendered by
this patch.

## Display Controls

The editor exposes the layer under `FORGE Data > Bore Holes` as `Borehole
logs`. It is hidden by default. Controls cover active well, track selection,
track offset, track width, GR scale, resistivity log-axis bounds, curve cutoff,
depth window, vertical exaggeration, lithology opacity, provenance, and readout.

No vertical projection fallback exists. A track without a validated as-drilled
trajectory remains in the manifest as a non-renderable source gap.

## Regeneration

```bash
python tools/ingest-utah-forge-borehole-logs.py --download --out projects/utah-forge/data/geosee_processed/utah_forge_phase_3/borehole_logs/borehole_logs_manifest.json --inventory-out .tmp/utah-forge-borehole-logs-inventory.json
node tools/validate-utah-forge-borehole-logs.mjs
```

Use `--source-root` to point at a local intake directory with pre-downloaded
GDR packages. Use `--well` to restrict a regeneration to one or more canonical
well ids. Use `--require-renderable` only when the run must fail unless at
least one well emits renderable tracks.

## Caveat

Classification is `source-derived borehole logs`, with per-well render status
inside the manifest. Do not use this layer for drilling, resurvey, calibration,
or engineering interpretation. Display claims are limited to machine-readable
source-derived tracks mapped onto validated trajectories.
