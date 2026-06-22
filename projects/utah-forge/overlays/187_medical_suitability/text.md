# Why It Fits Medical Imaging

Clinical 3D demands exactly what this pipeline enforces: faithful geometry, honest uncertainty, and a trail you can defend.

## Fidelity that's safe to read
Surfaces a clinician can trust because they never overstate the scan.
- No-overshoot: geometry never shows signal the data doesn't contain
- Confidence-masked, feathered margins — low-SNR regions fade, not faked
- Topology-correct extraction (MC33) for hole-free, manifold surfaces

## Built on validated tooling
The clinical-imaging standard stack.
- ITK + VTK (itk-wasm / vtk.js) — the primitives used across medical 3D
- DICOM / NIfTI native; anisotropic voxels and window/level out of the box
- Segmentation labelmaps and probability maps as first-class inputs

## Uncertainty, quantified
Confidence is a first-class channel with pluggable per-modality providers.
- CT: HU-SNR × partial-volume fraction
- MRI: SNR and/or segmentation probability / entropy
- OCT: reflectivity SNR; MT: data-support coverage
- Feather surface opacity to zero across the confidence falloff

## Defensible by construction
Designed for settings where provenance is non-negotiable.
- Every asset carries source + method provenance
- Automated fidelity gates on every build
- Deterministic, reproducible pipeline — auditable end to end
