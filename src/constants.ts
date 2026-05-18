// Project conventions (locked) for the Woodjam project.
// See docs/woodjam/data-manifest.md for the rationale.
//
// Project CRS: EPSG:26910 (NAD83 / UTM Zone 10N). All coordinates in meters.
// sceneOrigin is the project-local pivot; subtracting it from UTM coords keeps
// Three.js positions in the +/- 5000 range for clean float precision.

export const SCENE_ORIGIN = {
  easting: 612000,
  northing: 5790000,
  elevation: 1000,
} as const;

// Bounds expanded to a 40x40 km square so atmospheric fog has runway
// to dissolve terrain edges from every camera angle. Same sceneOrigin
// centroid.
export const PROJECT_BOUNDS = {
  min: { easting: 592000, northing: 5770000, elevation: 400 },
  max: { easting: 632000, northing: 5810000, elevation: 1800 },
} as const;

export const BOUNDS_WIDTH =
  PROJECT_BOUNDS.max.easting - PROJECT_BOUNDS.min.easting; // 40000 m
export const BOUNDS_HEIGHT =
  PROJECT_BOUNDS.max.northing - PROJECT_BOUNDS.min.northing; // 40000 m

// UTM (easting, northing, elevation) -> Three.js scene-local (x, y, z).
// We use a Z-up scene so terrain lies flat in the XY plane, which matches
// how geo data is naturally read.
export function utmToScene(
  easting: number,
  northing: number,
  elevation: number,
): [number, number, number] {
  return [
    easting - SCENE_ORIGIN.easting,
    northing - SCENE_ORIGIN.northing,
    elevation - SCENE_ORIGIN.elevation,
  ];
}
