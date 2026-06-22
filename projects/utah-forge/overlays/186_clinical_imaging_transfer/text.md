# Modality-Generic Volume → Surface

The same engine drives any regular scalar volume — geophysics today, clinical imaging next.

## Same shape
CT, MRI and OCT are the identical data shape we already handle.
- Regular scalar volume: per-axis spacing, window/level, units, mask
- DICOM / NIfTI ingest; anisotropic voxels; intensity/Hounsfield windows; labelmaps

## Methods
Standards-aligned building blocks, not bespoke one-offs.
- ITK: B-spline / tricubic resampling
- VTK: marching cubes, Flying Edges, MC33, gradient-normal shading
- itk-wasm + vtk.js as validated components

## Fidelity
Trust is built into the pipeline.
- No-overshoot reconstruction
- Per-voxel confidence + uncertainty feathering (generic; gated for MT)
- Full provenance + automated asset/fidelity gates

## Also available
The volume model already carries more than MT needs.
- Per-axis voxel spacing + window/level handling (anisotropic-ready)
- Occupancy mask + per-voxel confidence channel (built)
- Dual-path loader: binary tiles or JSON arrays, one runtime
