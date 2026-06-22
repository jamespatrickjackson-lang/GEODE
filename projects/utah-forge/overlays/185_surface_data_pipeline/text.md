# From Inversion Volume to Surface

## Data pipeline
Source MT inversion (~1.09M cell-centres) → CRS → scene transform → **bounded
continuity reconstruction** → **tricubic supersample (C2)** → **mask-aware
marching cubes** → **analytic ∇f gradient normals** → **Taubin smoothing** →
**lazy per-surface GPU streaming** → transition-safe cinematic render.

## Why each step
- Reconstruction is clamped to the source range — the model is never shown
  resistivities it does not contain (no overshoot); data gaps are bridged, not
  faked.
- Tricubic supersampling removes grid-lattice terracing at the source, not
  cosmetically.
- Normals are the field gradient, not the facets — grid-independent smooth
  shading.
- Every build passes automated fidelity gates; full provenance is retained.

## Also in the platform
Co-registered seismic sections, borehole logs, TEM / DCIP / IP, topography &
terrain draping, and point clouds; GPU volume raymarching, section-plane
iso-contours, and 8K / EXR cinematic capture.
