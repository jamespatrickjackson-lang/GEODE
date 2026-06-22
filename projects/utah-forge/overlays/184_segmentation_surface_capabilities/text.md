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

## Extraction
Best-practice isosurfacing end to end.
- Mask-aware marching cubes; MC33 + asymptotic decider for hole-free topology
- Flying Edges for medical-scale volumes
- Analytic field-gradient (∇f) normals — grid-independent, no striation
- Loop subdivision; vertex weld + Taubin smoothing (λ 0.15 / μ −0.16, ×6)

## Cleanup & tuning
Reliability controls layered on top of the mesh.
- Morphological mask cleanup — open/close + connected-component island removal
- Tunable per build: blur σ, supersample factor, smoothing strength
