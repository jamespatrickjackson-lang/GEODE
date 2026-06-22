# The Same Engine for Clinical Imaging

The volume→surface pipeline is modality-generic — the geophysics path and the clinical path are the same code.

## Direct transfer
A regular scalar volume in, smooth validated surfaces out — clinical data is exactly that shape.
- Volume model: per-axis spacing, window/level, units, mask, confidence
- CT, MRI and OCT — dense, regular, measured volumes
- DICOM / NIfTI ingest; anisotropic voxels; Hounsfield/intensity windows; segmentation labelmaps drop straight in

## Standards-aligned
The same methods are the clinical-imaging standard.
- B-spline / tricubic resampling (ITK)
- Marching cubes / Flying Edges with gradient-normal shading (VTK)
- Topologically-correct extraction (MC33 + asymptotic decider)

## Fidelity & safety by construction
Trust engineered into every surface.
- No-overshoot — surfaces never show signal the data does not contain
- Confidence masking + uncertainty feathering — never surface into low-SNR / low-confidence voxels; margins fade rather than fake a hard edge
- Full provenance + automated validation gates — the foundation for verification, design-history, and regulatory defensibility

## Foundations
Validated building blocks plus pluggable confidence.
- itk-wasm (DICOM/NIfTI, B-spline resampling) + vtk.js (Flying Edges, MC33)
- Modality confidence providers — CT HU-SNR, MRI SNR / segmentation probability, OCT reflectivity SNR
- Quantized binary tiles + lazy GPU streaming for clinical-scale volumes
