# The Same Engine for Clinical Imaging

Because the geophysical and clinical paths share a single implementation, moving to medical imaging is a matter of supplying a different input volume rather than building a separate system.

## Direct transfer
The pipeline consumes a regular scalar volume with explicit geometry and intensity metadata, and clinical acquisitions conform to that shape directly, including their segmentation products.
- Volume model: per-axis spacing, window/level, units, mask, confidence
- CT, MRI and OCT — dense, regular, measured volumes
- DICOM / NIfTI ingest; anisotropic voxels; Hounsfield/intensity windows; segmentation labelmaps drop straight in

## Standards-aligned
Each stage corresponds to an established method in the clinical-imaging literature and toolchain, so the approach is familiar and independently documented.
- B-spline / tricubic resampling (ITK)
- Marching cubes / Flying Edges with gradient-normal shading (VTK)
- Topologically-correct extraction (MC33 + asymptotic decider)

## Fidelity & safety by construction
Correctness, uncertainty handling, and provenance are properties of the pipeline itself, providing the foundation expected for verification and regulatory review.
- No-overshoot — surfaces never show signal the data does not contain
- Confidence masking + uncertainty feathering — never surface into low-SNR / low-confidence voxels; margins fade rather than fake a hard edge
- Full provenance + automated validation gates — the foundation for verification, design-history, and regulatory defensibility

## Foundations
The system is assembled from validated open building blocks and a pluggable confidence model that adapts to each modality's noise characteristics.
- itk-wasm (DICOM/NIfTI, B-spline resampling) + vtk.js (Flying Edges, MC33)
- Modality confidence providers — CT HU-SNR, MRI SNR / segmentation probability, OCT reflectivity SNR
- Quantized binary tiles + lazy GPU streaming for clinical-scale volumes
