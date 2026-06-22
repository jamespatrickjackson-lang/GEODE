# Field Reconstruction & Mesh Extraction

Reconstruction converts the inversion's scattered cell-centre samples into a continuous, watertight surface set, prioritising fidelity to the source field over visual smoothing and never introducing values the data does not support.

## Reconstruction
The source cells are resampled onto a regular grid with a continuity-first weighted blend that closes small data gaps while leaving genuinely unconstrained regions empty, and every value is clamped to the source range.
- Cell-centres binned to a 730 m regular grid
- Separable Gaussian blend (σ = 2.5 vox): gaps bridged, far voids left empty
- Values hard-clamped to the source range — no fabricated extremes

## Supersample
Surface detail is recovered from a higher-order resampling of the field itself rather than from post-hoc mesh smoothing, which removes grid-aligned terracing at its origin instead of masking it later.
- Tricubic Catmull-Rom ×2 → ~365 m C2 field (mask-aware, range-clamped)
- Removes grid-lattice terracing at the source

## Extraction
Surfaces are extracted with mask-aware, topology-correct iso-surfacing and shaded from the analytic field gradient, giving grid-independent geometry free of lattice striation.
- Mask-aware marching cubes; MC33 + asymptotic decider for hole-free topology
- Flying Edges for medical-scale volumes
- Analytic field-gradient (∇f) normals — grid-independent, no striation
- Loop subdivision; vertex weld + Taubin smoothing (λ 0.15 / μ −0.16, ×6)

## Cleanup & tuning
Reliability and quality controls operate on the extracted mask and mesh, and the principal reconstruction parameters are exposed for per-build tuning.
- Morphological mask cleanup — open/close + connected-component island removal
- Tunable per build: blur σ, supersample factor, smoothing strength
