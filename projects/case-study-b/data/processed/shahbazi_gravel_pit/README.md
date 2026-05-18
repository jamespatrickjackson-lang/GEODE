# Processed Shahbazi Gravel Pit Outputs

This folder holds reviewed or staged GeoSee-ready outputs derived from the Shahbazi gravel pit source dataset.

Current output:
- `tls_preview_points.json` is a lightweight sampled preview derived from `data/raw/shahbazi_gravel_pit/LaserScan.xyz`.
- `tls_preview_points.provenance.json` records the source, sampling method, scene transform, and review boundary.
- `tls_tiled_preview/manifest.json` plus `tls_tiled_preview/*.bin` is a higher-density binary tiled preview derived from `data/raw/shahbazi_gravel_pit/LaserScan.xyz`.
- `tls_tiled_preview/tls_tiled_preview.provenance.json` records the source, tiling, sampling, transform, and review boundary.
- `tls_surface_mesh_preview.json` is a binned TLS mesh preview derived from `data/raw/shahbazi_gravel_pit/LaserScan.xyz`, with only small enclosed interior display gaps filled from neighboring TLS cells.
- `tls_surface_mesh_preview.provenance.json` records the source, grid cell size, interior gap-fill policy, boundary smoothing, transform, and review boundary.
- `tls_surface_contours.geojson` is preview contour linework derived from `tls_surface_mesh_preview.json`.
- `tls_surface_contours.provenance.json` records the contour interval, source mesh dependency, gap policy, and review boundary.
- `outer_surface_mesh_preview.json` is the restored surrounding surface preview derived from `object_points_preview.json`, with coarse cells trimmed inside the actual TLS island footprint.
- `outer_surface_mesh_preview.provenance.json` records the source, grid, TLS footprint trim, boundary smoothing, no-rectangular-cutout, and no-seam/no-combined-mesh policy.
- `outer_surface_contours.geojson` is preview contour linework derived from `outer_surface_mesh_preview.json`.
- `outer_surface_contours.provenance.json` records the contour interval and source mesh dependency for the outer surface.
- `ground_control_points.geojson` is a normalized point-marker layer derived from `data/raw/shahbazi_gravel_pit/GCPs.txt`.
- `ground_control_points.provenance.json` records the source table, transform, and review boundary.
- `camera_poses.geojson` is a normalized camera-position and flight-path layer derived from `data/raw/shahbazi_gravel_pit/RefinedEOPs.txt`, with timestamps and direct EOP comparison metadata attached.
- `camera_poses.provenance.json` records the source tables, transform, and review boundary.
- `camera_frustums.geojson` is a sampled visual frustum preview derived from `data/raw/shahbazi_gravel_pit/RefinedEOPs.txt` and `RefinedIOPs.txt`.
- `camera_frustums.provenance.json` records the source tables, display sampling, orientation convention, transform, and review boundary.
- `photo_overlay_preview/photo_overlay_manifest.json` is a first-pass projected UAV image overlay manifest using six selected downsampled TIFF previews ray-projected onto the current Shahbazi preview surfaces.
- `photo_overlay_preview/photo_overlay_manifest.provenance.json` records selected image ids, camera model, projection method, source surfaces, and review boundary.
- `dense_matching_links.geojson` connects the image pairs listed in `data/raw/shahbazi_gravel_pit/DenseMatching.txt` using the processed camera-pose coordinates.
- `dense_matching_links.provenance.json` records the source pair list, camera-pose dependency, transform, and review boundary.
- `object_points_preview.json` is a sparse object-point QA preview derived from `data/raw/shahbazi_gravel_pit/ObjectPoints.txt`, with `TiePoints.txt` observation counts attached for color-by-observation display.
- `object_points_preview.provenance.json` records the source tables, transform, and review boundary.
- `tie_point_support_isolines.geojson` is tight isobar-style QA linework derived from the object-point tie observation counts.
- `tie_point_support_isolines.provenance.json` records the interpolation grid, observation levels, source dependencies, and review boundary.
- `tie_point_support_isobands_mesh.json` is the colored infill mesh loaded under the tie-point support isolines toggle.
- `tie_point_support_isobands_mesh.provenance.json` records the infill interpolation and color-ramp provenance.

The preview is suitable for an internal visual demo layer. It is not the final full-resolution Potree/EPT point cloud, and it should not be treated as a GIS-registered engineering layer until CRS/orientation review is complete.

Editor visibility:
- The default Case Study B view keeps the Shahbazi ground surface visible as two separate meshes under one control: the restored outer object-point surface and the TLS island surface. Both meshes keep separate surfaces, with only their exterior boundary loops smoothed to reduce grid-edge chatter.
- The projected image preview is a toggleable visual alignment layer. It uses selected downsampled UAV image previews and is not an orthomosaic, final texture, or final photogrammetric product.
- Photogrammetry QA layers are grouped separately in the editor and should be enabled deliberately for source review: ground control/check points, camera positions, sampled frustums, and dense-matching links. Raw sparse object points and tie-point support isobands remain on disk as provenance/QA artifacts, but are not exposed as primary render layers.

Planned output targets:
- `shahbazi_gravel_pit_textured_mesh.glb` for a textured mesh / glTF layer
- `point_cloud_potree/metadata.json` plus tile files for a web-ready reconstructed point cloud
- `orthomosaic.tif` or equivalent image texture / orthomosaic
- `tls_subzone_potree/metadata.json` plus tile files for the 30 x 40 m TLS sub-zone
- `derived_demo_overlays.geojson` for clearly marked interpretive demo overlays

The existing procedural quarry shell remains the fallback scene. The sampled TLS preview, higher-density tiled TLS preview, restored outer object-point surface preview trimmed against the actual TLS footprint, TLS island surface preview with small enclosed display gaps filled, split contour preview, projected UAV image preview, normalized GCP/check point markers, camera flight-path layer, sampled frustum preview, and dense-matching image-pair links are source-derived preview layers. Seam, island-knit, and combined mesh experiments are not active; boundary smoothing only adjusts the edge loops of each separate surface. The full Shahbazi mesh, orthomosaic, reconstructed point cloud, and synthetic overlays remain disabled until outputs exist and scale, CRS, orientation, and source attribution are confirmed.
