# Field Reconstruction & Mesh Extraction

Scattered inversion cells become smooth, watertight surfaces — without inventing data.

## Reconstruction
A continuity-first field that bridges gaps but never overshoots.
- Cell-centres binned to a 730 m regular grid
- Separable Gaussian blend (σ = 2.5 vox): gaps bridged, far voids left empty
- Values hard-clamped to the source range — no fabricated extremes

## Supersample
Detail comes from a higher-order field, not cosmetic smoothing.
- Tricubic Catmull-Rom ×2 → ~365 m C2 field (mask-aware, range-clamped)
- Removes grid-lattice terracing at the source

## Mesh
Best-practice isosurfacing end to end.
- Mask-aware marching cubes
- Analytic field-gradient (∇f) normals — grid-independent, no striation
- Vertex weld + unpinned Taubin smoothing (λ 0.15 / μ −0.16, ×6)

## Also available
Stages we can switch in when a dataset needs them.
- Loop mesh subdivision for extra refinement (dormant since the tricubic field replaced it)
- Morphological mask cleanup — open/close + connected-component island removal (built, gated)
- Tunable per build: blur σ, supersample factor, smoothing strength
