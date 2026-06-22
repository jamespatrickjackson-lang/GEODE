# Modality-Generic Volume → Surface

The reconstruction-to-surface pipeline is built around a generic regular-volume representation, so the same code path that serves the geophysical model applies without modification to clinical imaging volumes.

## Same shape
Clinical modalities produce exactly the data this pipeline already consumes — dense, regular, measured scalar volumes — so their ingest and parameterisation map directly onto the existing model.
- Regular scalar volume: per-axis spacing, window/level, units, mask, confidence
- DICOM / NIfTI ingest; anisotropic voxels; intensity/Hounsfield windows
- Segmentation labelmaps and probability maps as inputs

## Methods
The constituent operations are the established primitives of medical 3D, taken from the standard imaging toolkits rather than re-implemented in-house.
- ITK: B-spline / tricubic resampling
- VTK: marching cubes, Flying Edges, MC33, gradient-normal shading
- itk-wasm + vtk.js components

## Fidelity
The correctness and provenance guarantees applied to the geophysical surfaces carry over unchanged, which is the property that makes the pipeline suitable for clinical use.
- No-overshoot reconstruction
- Per-voxel confidence channel + uncertainty feathering
- Full provenance + automated asset/fidelity gates
