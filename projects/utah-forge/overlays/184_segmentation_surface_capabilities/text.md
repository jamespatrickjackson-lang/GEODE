# Segmentation & Surface Extraction

## From volume to geometry
Any regular scalar volume becomes clean 3D surfaces: threshold /
iso-classification (segmentation) of the volume into one or many regions, each a
closed, smooth shell.

## What we can produce
- **Multi-region, multi-threshold** surface families, authored and toggled
  independently (e.g. nested conductive → resistive shells).
- **Confidence-masked** surfaces — clipped to reliable data; low-confidence /
  low-SNR margins are excluded, not rendered as fact.
- **Uncertainty feathering** — surfaces fade across the confidence falloff:
  honest edges, not faked boundaries.
- **Smooth, grid-independent geometry** (tricubic field + gradient-normal
  shading), double-sided, per-surface colour/opacity, live section-plane cuts.

## In context
Surfaces co-register with seismic, boreholes, topography, and point clouds, over
GPU volume raymarching; lazy GPU streaming keeps many high-resolution surfaces
interactive.
