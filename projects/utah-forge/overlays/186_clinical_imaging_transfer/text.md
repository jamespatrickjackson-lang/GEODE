# Modality-Generic Volume → Surface

The same engine drives any regular scalar volume — geophysics and clinical imaging alike.

## Same shape
CT, MRI and OCT are the identical data shape we handle.
- Regular scalar volume: per-axis spacing, window/level, units, mask, confidence
- DICOM / NIfTI ingest; anisotropic voxels; intensity/Hounsfield windows
- Segmentation labelmaps and probability maps as inputs

## Methods
Standards-aligned building blocks, not bespoke one-offs.
- ITK: B-spline / tricubic resampling
- VTK: marching cubes, Flying Edges, MC33, gradient-normal shading
- itk-wasm + vtk.js components

## Fidelity
Trust is built into the pipeline.
- No-overshoot reconstruction
- Per-voxel confidence channel + uncertainty feathering
- Full provenance + automated asset/fidelity gates
