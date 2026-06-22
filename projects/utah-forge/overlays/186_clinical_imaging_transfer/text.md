# The Same Engine for Clinical Imaging

## Direct transfer
The volume→surface pipeline is modality-generic: a regular scalar volume in
(per-axis spacing, window/level, units, mask), smooth validated surfaces out.
CT, MRI, and OCT are exactly that — dense, regular, measured volumes. DICOM/NIfTI
ingest, anisotropic voxels, Hounsfield/intensity windows, and segmentation
labelmaps drop straight in.

## Standards-aligned
The same methods are the clinical-imaging standard: B-spline / tricubic
resampling (ITK), marching cubes / Flying Edges with gradient-normal shading
(VTK), and topologically-correct extraction (MC33).

## Fidelity & safety by construction
- **No-overshoot** — surfaces never show signal the data does not contain.
- **Confidence masking + uncertainty feathering** — never surface into
  low-SNR / low-confidence voxels; margins fade rather than fake a hard edge.
- **Full provenance + automated validation gates** — the foundation for
  verification, design-history, and regulatory defensibility.

## Foundations
itk-wasm (DICOM/NIfTI, B-spline resampling) + vtk.js (Flying Edges, MC33) as
validated building blocks; modality confidence providers — CT HU-SNR, MRI SNR /
segmentation probability, OCT reflectivity SNR.
