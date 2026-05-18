import * as THREE from "three";
import { PROJECT_BOUNDS, utmToScene } from "../constants";
import { setOverlayMask } from "../scene/heightSampler";
import { debugLog } from "../utils/debugLog";

// Bedrock geology layer. The fetch script (prep/fetch_geology.py)
// produces:
//   data/bedrock_geology.geojson    -- one feature per stratigraphic
//                                      polygon, with strat_unit code,
//                                      displayName, and fallback color
//   data/bedrock_geology_colors.json -- { strat_unit_code: "#hex" }
//
// Render approach: rasterize each polygon directly in its effective
// colour onto a single RGBA canvas covering the full project bounds.
// Publish the canvas as overlay mask slot "geology". The terrain shader
// samples this texture per-fragment and mixes the texel's RGBA into
// the surface colour, so the geology reads as a wash over terrain that
// follows hillshade and conforms to relief by construction.
//
// Effective per-unit colour resolves in this priority order:
//   1. env override (env.layerStyles["bedrock-geology"].geologyColorMap[code])
//   2. BCGS canonical from bedrock_geology_colors.json
//   3. feature.properties.color (fallback baked into geojson by fetch)
//   4. neutral grey #808080
//
// Per-unit visibility: env.layerStyles["bedrock-geology"]
// .geologyUnitOverrides[code].visible === false hides that unit's
// polygons in the rasterization. Default visible.
//
// Returns a handle so SceneManager can call rebuild(...) when the user
// edits the colour map or unit-visibility map (live re-rasterisation
// of the canvas; the texture is updated in place).

const MASK_RES = 2048;
const NEUTRAL_GREY = "#808080";

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export interface GeologyUnitInfo {
  code: string;
  displayName: string;
  defaultColor: string; // BCGS canonical or grey fallback
}

export interface GeologyOverrides {
  /** Sparse per-unit colour overrides. Keys = strat_unit codes. */
  colorMap?: Record<string, string>;
  /** Sparse per-unit visibility / opacity overrides. */
  unitOverrides?: Record<string, { visible?: boolean; opacity?: number }>;
}

export interface GeologyHandle {
  /** All distinct units present in the clipped data, sorted by code. */
  units: GeologyUnitInfo[];
  /**
   * Re-paint the canvas using the supplied overrides and republish
   * the texture. Cheap (~16 ms for a 2048² fill of 65 polygons).
   */
  rebuild(overrides: GeologyOverrides): void;
}

export async function loadGeology(
  geojsonUrl: string,
  colorsUrl: string,
): Promise<THREE.Group & { geologyHandle?: GeologyHandle }> {
  const [collection, colorsRaw] = await Promise.all([
    fetch(geojsonUrl).then((r) => r.json()) as Promise<FeatureCollection>,
    fetch(colorsUrl).then((r) => r.json()) as Promise<Record<string, string>>,
  ]);

  const group = new THREE.Group() as THREE.Group & {
    geologyHandle?: GeologyHandle;
  };
  group.name = "bedrock-geology";

  // Mask covers the full project bounds in scene-local XY (sceneOrigin
  // already subtracted). Same convention as the lake / claim masks.
  const [minSx, minSy] = utmToScene(
    PROJECT_BOUNDS.min.easting,
    PROJECT_BOUNDS.min.northing,
    0,
  );
  const [maxSx, maxSy] = utmToScene(
    PROJECT_BOUNDS.max.easting,
    PROJECT_BOUNDS.max.northing,
    0,
  );

  const c = document.createElement("canvas");
  c.width = MASK_RES;
  c.height = MASK_RES;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("loadGeology: failed to get 2d canvas context");

  const sceneToCanvasX = (sx: number) =>
    ((sx - minSx) / (maxSx - minSx)) * MASK_RES;
  const sceneToCanvasY = (sy: number) =>
    (1 - (sy - minSy) / (maxSy - minSy)) * MASK_RES;

  // Build the unit registry once at load. Display name is taken from
  // the FIRST feature carrying that strat_unit; later features with
  // the same code don't overwrite it. Default colour resolves the
  // BCGS table -> feature property -> grey fallback.
  const unitMap = new Map<string, GeologyUnitInfo>();
  for (const feat of collection.features) {
    const props = feat.properties ?? {};
    const code = String(props.strat_unit ?? "").trim();
    if (!code) continue;
    if (unitMap.has(code)) continue;
    const displayName =
      (typeof props.displayName === "string" && props.displayName) ||
      code ||
      "Unknown unit";
    const defaultColor =
      colorsRaw[code] ||
      (typeof props.color === "string" ? props.color : "") ||
      NEUTRAL_GREY;
    unitMap.set(code, { code, displayName, defaultColor });
  }
  const units = Array.from(unitMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );

  const drawRing = (ring: Array<[number, number, number?]>) => {
    if (ring.length < 3) return;
    for (let i = 0; i < ring.length; i++) {
      const [e, n] = ring[i];
      const [sx, sy] = utmToScene(e, n, 0);
      const cx = sceneToCanvasX(sx);
      const cy = sceneToCanvasY(sy);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.closePath();
  };

  const drawPolygon = (
    polygon: Array<Array<[number, number, number?]>>,
  ) => {
    if (!polygon[0] || polygon[0].length < 3) return;
    ctx.beginPath();
    drawRing(polygon[0]);
    for (let h = 1; h < polygon.length; h++) drawRing(polygon[h]);
    ctx.fill("evenodd");
  };

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;

  const paint = (overrides: GeologyOverrides) => {
    ctx.clearRect(0, 0, MASK_RES, MASK_RES);
    let drawn = 0;
    for (const feat of collection.features) {
      const g = feat.geometry;
      if (!g) continue;
      const props = feat.properties ?? {};
      const code = String(props.strat_unit ?? "").trim();
      // Visibility: missing entry = visible.
      const ov = overrides.unitOverrides?.[code];
      if (ov?.visible === false) continue;
      const baseColor =
        overrides.colorMap?.[code] ||
        colorsRaw[code] ||
        (typeof props.color === "string" ? props.color : "") ||
        NEUTRAL_GREY;
      ctx.fillStyle = baseColor;
      if (g.type === "Polygon") {
        drawPolygon(g.coordinates as Array<Array<[number, number, number?]>>);
        drawn++;
      } else if (g.type === "MultiPolygon") {
        for (const p of g.coordinates as Array<
          Array<Array<[number, number, number?]>>
        >) {
          drawPolygon(p);
        }
        drawn++;
      }
    }
    tex.needsUpdate = true;
    setOverlayMask("geology", {
      texture: tex,
      boundsMin: [minSx, minSy],
      boundsMax: [maxSx, maxSy],
    });
    return drawn;
  };

  // Initial paint with no overrides -- BCGS canonical palette.
  const drawn = paint({});

  debugLog(
    `[loadGeology] ${collection.features.length} features, ` +
      `${units.length} distinct units, painted ${drawn} polygons ` +
      `into ${MASK_RES}^2 mask`,
  );

  group.geologyHandle = {
    units,
    rebuild: (overrides) => {
      paint(overrides);
    },
  };
  return group;
}
