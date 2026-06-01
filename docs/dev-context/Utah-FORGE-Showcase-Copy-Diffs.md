# Utah FORGE Showcase Copy Diffs

Status: candidate / review-required.

Overlay copy was taken from the storyboard Modal Card copy source where current support makes the claim safe. This file records copy deviations made to avoid unsupported or over-specific claims.

| Page | Original storyboard/modal claim | Candidate overlay change | Reason |
| --- | --- | --- | --- |
| `40_geophysics_product_overview` | No change | No change | MT and seismic products are registered. Candidate status remains review-required. |
| `41_mt_station_network_footprint` | No change | No change | MT station markers are registered from EDI headers. Coverage polygon is not claimed. |
| `42_resistivity_volume_overview` | No change | No change | Page uses full-density cell-center point cloud, matching modal copy. |
| `43_resistivity_depth_elevation_slices` | No change | No change | Exact fixed authored elevations +1500 m, 0 m, and -2500 m exist. |
| `44_resistivity_cross_sections` | No change | No change | Existing fixed E-W and N-S station-centroid vertical sections support the claim. Arbitrary azimuth is not claimed. |
| `45_resistivity_isosurfaces` | No change | No change | Fixed mask-aware threshold surfaces include <=30 Ohm-m and >=1000 Ohm-m semantic thresholds. |
| `49_seismic_fence_panels` | "from the Utah FORGE Phase 3 3D seismic program" | "from the Utah FORGE Phase 3 seismic products" and "2D Line 301" | Active product is a registered 2D Line 301 seismic section. The 3D-program wording was too specific for this rendered product. |
| `50_integrated_seismic_resistivity_context` | "the Phase 2 5D velocity model" | "a registered 3D seismic velocity model product, rendered as a semi-transparent time-domain volume" | Active registered product is `gdr-1015-forge3d-velo5d-float-01312018` with label "3D velocity model (time domain)". Safer wording avoids over-specific external claim before human review. |

No source attribution was added to overlay body copy. Source/citation detail remains in review docs and the FigJam/storyboard source frame.
