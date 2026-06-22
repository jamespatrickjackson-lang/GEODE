# Why It Fits Medical Imaging

Clinical three-dimensional visualization has specific requirements — faithful geometry, explicit handling of uncertainty, and a verifiable record of how each surface was produced — and these are properties the pipeline enforces by construction rather than adds afterward.

## Fidelity that's safe to read
The surfaces are constrained so that what is displayed never implies more than the underlying scan supports, which matters wherever geometry informs clinical judgement.
- No-overshoot: geometry never shows signal the data doesn't contain
- Confidence-masked, feathered margins — low-SNR regions fade, not faked
- Topology-correct extraction (MC33) for hole-free, manifold surfaces

## Built on validated tooling
The implementation rests on the toolkits already established and validated across medical imaging, reducing the surface area that would otherwise require independent verification.
- ITK + VTK (itk-wasm / vtk.js) — the primitives used across medical 3D
- DICOM / NIfTI native; anisotropic voxels and window/level out of the box
- Segmentation labelmaps and probability maps as first-class inputs

## Uncertainty, quantified
Confidence is represented as an explicit per-voxel channel rather than left implicit, with the metric chosen per modality from quantities each scan actually provides.
- CT: HU-SNR × partial-volume fraction
- MRI: SNR and/or segmentation probability / entropy
- OCT: reflectivity SNR; MT: data-support coverage
- Feather surface opacity to zero across the confidence falloff

## Defensible by construction
The pipeline is built for environments where the provenance and reproducibility of every artefact must be demonstrable, not asserted.
- Every asset carries source + method provenance
- Automated fidelity gates on every build
- Deterministic, reproducible pipeline — auditable end to end
