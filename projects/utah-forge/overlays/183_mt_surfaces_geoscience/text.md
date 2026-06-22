# MT Iso-Resistivity Surfaces

A magnetotelluric inversion turned into 3D geometry you can navigate, slice, and integrate with everything else in the scene.

## Source
Built straight from the published inversion — no hand-digitizing.
- GDR 1255 model: ~1.09M cell-centres, EPSG:26912, log10 Ω·m
- Smoothness-regularized; full lateral extent, depth to −20 km
- 23 boundaries: semantic thresholds (≤10 / ≤30 / ≥1000 Ω·m) + log-spaced banks

## Reading
Every shell is an iso-resistivity contour with a clear physical meaning.
- Conductive (≤10–30 Ω·m): clay, alteration, fluids
- Resistive (≥1000 Ω·m): crystalline basement

## Limits
Honest about what an inversion can and can't say.
- Communication surfaces — not interpreted contacts, faults, or resource
- Resolution decays with depth (skin-depth); margins are data-support-limited

## Also available
Modes the surface product can flex into, on or off.
- On-the-fly extraction at arbitrary thresholds (live boundary mode)
- Per-boundary visibility, colour, opacity and draw order — all authorable
- Previously shipped as focused + full-extent crops (consolidated to one, DEC-180)
