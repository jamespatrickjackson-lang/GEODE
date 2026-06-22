# Why It Fits Medical Imaging

Clinical 3D demands exactly what this pipeline already enforces: faithful geometry, honest uncertainty, and a trail you can defend.

## Fidelity that's safe to read
Surfaces a clinician can trust because they never overstate the scan.
- No-overshoot: geometry never shows signal the data doesn't contain
- Confidence-masked, feathered margins — low-SNR regions fade, not faked
- Topology-correct extraction (MC33) for hole-free, manifold surfaces

## Built on validated tooling
The clinical-imaging standard stack, not a research prototype.
- ITK + VTK (itk-wasm / vtk.js) — the primitives used across medical 3D
- DICOM / NIfTI native; anisotropic voxels and window/level out of the box
- Segmentation labelmaps and probability maps as first-class inputs

## Defensible by construction
Designed for settings where provenance is non-negotiable.
- Every asset carries source + method provenance
- Automated fidelity gates on every build
- Deterministic, reproducible pipeline — auditable end to end

## Also available
Already built or exercised, ready to point at clinical data.
- Confidence-mask + uncertainty feather — built and exercised on MT, gated pending a clinical metric
- Morphological cleanup (open/close, island removal) for speckle / segmentation noise
- No-overshoot reconstruction + full provenance — enforced on every build today
