# Seismic Axis Metrics Requirements

Status: requirements/audit document only. No runtime behavior, page JSON, generated artifact, or schema change is accepted by this document.

Source of truth for current product facts: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json`.

## Purpose

GeoSee seismic displays need axis gradients and measurement labels that read as professional geoscience views. Axis labels must preserve the source measurement domain first, then add display-derived context only when the derivation is explicit.

The locked convention is:

- Depth-domain products: vertical axis is depth in metres below the source seismic datum, with absolute scene elevation available from `sceneZ_m = datumM - sample * verticalScaleMPerUnit`.
- Time-domain products: primary vertical axis is two-way travel time (TWT) in ms or s. Any metre/elevation annotation is secondary, display-derived, and must not be presented as true depth without depth-conversion authority.
- Velocity products: vertical axis follows the product sample domain; value legend is interval velocity in m/s, expected display range `2000-5000 m/s` unless source metadata supersedes it.

## Current Utah FORGE Product Audit

Current manifest count: 34 seismic products, 66 rendered sections, 4 raymarch-capable volumes.

| Product family | Count | Render axes | Vertical/source domain | Datum | Section/volume sizes observed | Axis requirement |
| --- | ---: | --- | --- | --- | --- | --- |
| 3D post-stack time migration | 1 | inline, crossline, horizontal sample slice | time, `0-4000 ms` | 1800 m ASL | sections `2048x798`, `168x169`; volume `88x89x1057` | Primary vertical axis: TWT. Secondary display-elevation context allowed only as derived. Horizontal slices labeled by fixed TWT. |
| 3D anisotropic PSDM depth stack | 1 | inline, crossline, horizontal sample slice | depth, `0-5000 m` | 1800 m ASL | sections `2048x314`, `190x190`; volume `116x116x615` | Primary vertical axis: depth below seismic datum in metres; optional absolute elevation annotation. Horizontal slices labeled by fixed depth. |
| 3D PSTM stack | 1 | inline, crossline, horizontal sample slice | time, `0-4000 ms` | 1800 m ASL | sections `2048x399`, `168x169`; volume `111x112x666` | Primary vertical axis: TWT. Secondary display-elevation context allowed only as derived. Horizontal slices labeled by fixed TWT. |
| 3D velocity-time model | 1 | inline, crossline, horizontal sample slice | velocity-time, `0-4000 ms` | 1800 m ASL | sections `67x201`, `19x19`; volume `19x19x201` | Primary vertical axis: TWT/sample time. Value legend: interval velocity in m/s. Secondary depth/elevation context requires explicit conversion basis. |
| 2D PSDM depth lines | 5 | line section | depth, `0-6000 m` and `0-8165.080078 m` | 1800 m ASL | `321x6001`, `321x1929`, `307x6001` | Horizontal axis: distance along line in m/km, with optional CMP/trace labels. Vertical axis: depth below seismic datum in metres. |
| Legacy 2D PSDM depth lines | 7 | line section | depth, `0-20000 m`, `0-10000 m`, `0-5800 m` | 1800 m ASL | `534x7848`, `439x2001`, `439x1161` | Horizontal axis: distance along line in m/km, with optional CMP/trace labels. Vertical axis: depth below seismic datum in metres; legacy placement caveats visible in metadata. |
| 2D PSTM/time lines | 4 | line section | time, `0-4000 ms` | 1800 m ASL | `321x4001`, `307x4001` | Horizontal axis: distance along line in m/km, with optional CMP/trace labels. Vertical axis: TWT in ms/s. |
| Line 302 PSTM/time exceptions | 2 | line section | time, `0-4000 ms` | 2100 m ASL | `307x4001` | Same as time lines, but datum annotation must display 2100 m ASL because source header records that datum. |
| Legacy 2D PSTM/time lines | 6 | line section | time, `0-4382 ms`, `0-4300 ms` | 1800 m ASL | `681x2192`, `439x2192`, `439x2151` | Horizontal axis: distance along line in m/km. Vertical axis: TWT in ms/s; legacy placement caveats visible in metadata. |
| 2D stack/time lines | 2 | line section | time, `0-4000 ms` | 1800 m ASL | `321x4001` | Horizontal axis: distance along line in m/km. Vertical axis: TWT in ms/s. |
| 2D velocity-time lines | 2 | line section | velocity-time, `0-10000 ms`, `0-6392 ms` | 1800 m ASL | `81x1251`, `103x800` | Horizontal axis: distance along line in m/km. Vertical axis: TWT/sample time. Value legend: interval velocity in m/s. |
| Legacy 2D velocity-time lines | 2 | line section | velocity-time, `0-20000 ms` | 1800 m ASL | `137x2501`, `89x2001` | Horizontal axis: distance along line in m/km. Vertical axis: TWT/sample time. Value legend: interval velocity in m/s; legacy placement caveats visible in metadata. |

## Required Axis And Gradient Model

### 2D Line Sections

- Horizontal gradient: distance along line in metres or kilometres, derived from section path endpoints or full polyline length when available.
- Optional horizontal labels: CMP, CDP, shotpoint, trace index, or line station labels when source header/navigation metadata is available.
- Vertical gradient for depth products: depth below seismic datum in metres; optional absolute elevation labels can be calculated from `datumM - depthM`.
- Vertical gradient for time products: TWT in ms/s. Display-derived metres may appear only as a secondary annotation with wording such as `display-derived elevation`, `approximate`, or `requires velocity model`.
- Annotation: product label, domain, datum, source submission, line id, render mode, and whether placement is legacy/fallback.

### 3D Inline And Crossline Sections

- Horizontal gradient: inline or crossline index where source grid metadata is present; scene distance/grid context in metres where only scene bounds are available.
- Orthogonal context: show the companion crossline/inline number or selected fraction.
- Vertical gradient follows the product source domain:
  - Depth products: metres below datum and optional absolute elevation.
  - Time products: TWT in ms/s as primary.
  - Velocity-time products: TWT/sample time as primary plus m/s color/value legend.
- Annotation: inline/crossline label, slice fraction/index, datum, sample interval/range, and value scale.

### 3D Horizontal Slices

- Map-plane axes: scene X/Y, inline/crossline, or map easting/northing depending on available metadata.
- Slice label:
  - Depth-domain sample slices: fixed depth in metres below datum and computed elevation.
  - Time-domain sample slices: fixed TWT in ms/s.
  - Velocity-time sample slices: fixed sample time plus velocity value legend.
- Do not label a time slice as a true depth or elevation slice unless depth conversion is available and documented.

### Raymarch Volumes

- Bounding-box rulers: X/Y scene distance and source-domain Z/sample range.
- Slice planes: labels inherit the section/slice rules above.
- Datum annotation: source datum and transform must be visible in diagnostics and available to UI text.
- Value legend:
  - Amplitude products: normalized processed amplitude with colormap/window controls.
  - Velocity products: interval velocity in m/s, default display range `2000-5000 m/s` unless source metadata provides a stronger range.

## Future App Build Checklist

- Manifest/UI inputs:
  - `productKind`, `domainKind`, `domainUnit`, `datumM`, `sampleRange`, `sampleDomain`, `verticalReference`, `valueEncoding`, section `axis`, section `path`, section `sceneBounds`, volume `sceneBounds`, and source labels.
- Tick generation:
  - Generate source-domain ticks first: metres for depth products, ms/s for time products.
  - Generate secondary display/elevation ticks only when derivation and wording are present.
  - Use stable “nice” tick intervals and avoid excessive tick density on long 2D legacy sections.
- Axis placement:
  - Attach axis geometry to section/volume bounds, not to screen overlay alone, so camera changes preserve spatial meaning.
  - Keep axis labels legible from presentation camera distances with depth testing/clipping rules matched to the seismic panel.
- Datum/elevation wording:
  - Use `depth below datum`, `TWT`, `display-derived elevation`, and `absolute scene elevation` consistently.
  - Show source datum exceptions, especially Line 302 PSTM products with 2100 m ASL.
- Value scales:
  - Keep amplitude colorbar separate from velocity colorbar.
  - Velocity scale uses m/s and the expected `2000-5000 m/s` display range unless product metadata supersedes it.
- Guardrails:
  - Time-domain axes must not be documented or rendered as metres without `display-derived`, `approximate`, or equivalent warning language.
  - Axis labels must be product/domain-driven, not page-specific or fixture-specific.
  - Future implementation should update runtime diagnostics so axis metadata can be inspected with the selected seismic product.

## Research Basis

- [SLB Two Way Time](https://www.apps.slb.com/cmd/PropertyItem.aspx?code=Two_Way_Time): TWT is the time for an acoustic wave to travel from source to reflector and return to receiver.
- [SLB Datum](https://glossary.slb.com/en/terms/d/datum): seismic datum is a correction/reference surface, distinct from terrain or well completion references.
- [SLB Time Slice](https://glossary.slb.com/en/terms/t/time_slice): a time slice is a horizontal display at a selected arrival time in 3D seismic data.
- [SLB Common Midpoint](https://glossary.slb.com/terms/c/common_midpoint): CMP/CDP concepts explain why trace/ensemble labels are useful but should not be confused with literal surface distance.
- [ResInsight Seismic Sections](https://resinsight.org/3d-main-window/seismicsections/index.html): seismic section types include inline, xline, depth slice, polyline section, and well-path section.
- [SEG-Y Rev 1 trace header fields](https://seg.org/wp-content/uploads/2025/11/seg_y_rev1.pdf): trace headers can carry CDP/CMP coordinates, inline/crossline numbers, shotpoint, coordinate scalar, time scalar, and trace value units that should inform future axis metadata.

## Acceptance Criteria For Future Runtime Work

- Every visible seismic section has a source-domain vertical axis.
- Time-domain products show TWT as the primary vertical axis.
- Depth-domain products show metres below datum as the primary vertical axis.
- Velocity products show a visible m/s value scale.
- Datum exceptions are visible in product diagnostics or panel annotation.
- Axis/tick behavior is derived from product metadata, never from page id, page order, or demo fixture names.
