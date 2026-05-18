# Case Study B Data

This folder is reserved for project-local rendered artifacts such as terrain rasters, orthomosaics, LiDAR-derived surfaces, GeoJSON overlays, and synthetic demo layers.

The current Case Study B project now includes source-derived Shahbazi preview artifacts under `processed/shahbazi_gravel_pit/`. These are browser-ready preview layers, not final GIS/engineering deliverables:

- sampled and tiled TLS point-cloud previews from `LaserScan.xyz`
- a separate TLS island surface preview from `LaserScan.xyz`
- a separate outer surface preview interpolated from sparse photogrammetry object points, not LiDAR
- split preview contours derived from those two separate surfaces
- normalized GCP/check point, camera-position, camera-frustum, dense-matching, and tie-point QA layers
- a first-pass projected UAV image overlay preview, not an orthomosaic

The older demo and synthetic planning layers remain placeholders unless explicitly marked as source-derived.

Shahbazi gravel pit preparation folders:
- `raw/shahbazi_gravel_pit/` for externally downloaded source archives and source files.
- `processed/shahbazi_gravel_pit/` for staged GeoSee-ready preview outputs. Future production targets such as GLB, Potree/EPT point clouds, and orthomosaic rasters are tracked separately as `futureTargets` in the project manifest until they exist.
