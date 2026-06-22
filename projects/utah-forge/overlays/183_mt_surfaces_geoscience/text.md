# MT Iso-Resistivity Surfaces

These surfaces are the Utah FORGE magnetotelluric resistivity inversion expressed as explicit 3D iso-resistivity geometry, so the model can be inspected, sectioned, and registered against the seismic, borehole, and topographic layers in a single scene rather than read from separate 2D figures.

## Source
The geometry is derived directly and deterministically from the delivered inversion model — nothing is hand-drawn or interpreted — and every boundary is an iso-resistivity threshold extracted from that same source volume.
- GDR 1255 model: ~1.09M cell-centres, EPSG:26912, log10 Ω·m
- Smoothness-regularized; full lateral extent, depth to −20 km
- 23 boundaries: semantic thresholds (≤10 / ≤30 / ≥1000 Ω·m) + log-spaced banks

## Reading
Each shell separates the model into resistivity regimes with established physical associations in a geothermal setting, which is what makes the geometry interpretable rather than decorative.
- Conductive (≤10–30 Ω·m): clay, alteration, fluids
- Resistive (≥1000 Ω·m): crystalline basement

## Authoring & variants
The surface set is configurable per presentation; thresholds, spatial extent, and per-boundary appearance can all be changed without re-deriving the underlying model.
- On-the-fly extraction at arbitrary thresholds (live boundary mode)
- Per-boundary visibility, colour, opacity and draw order
- Focused and full-extent crops, or a single uncropped product

## Limits
These are visualization surfaces communicating a regularized inversion, not interpreted geology, and their reliability is bounded by the physics of the measurement.
- Communication surfaces — not interpreted contacts, faults, or resource
- Resolution decays with depth (skin-depth); margins are data-support-aware
