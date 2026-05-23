export type TopoEdgeFadeShape = "square" | "rounded-square" | "circle";

export interface TopoEdgeFadeBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

export interface TopoEdgeFadeState extends TopoEdgeFadeBounds {
  shape: TopoEdgeFadeShape;
  fadeDistanceM: number;
  insetM: number;
  cornerRadiusM: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeTopoEdgeFadeShape(
  shape: string | null | undefined,
): TopoEdgeFadeShape {
  if (shape === "rounded-square" || shape === "circle") return shape;
  return "square";
}

export function topoEdgeFadeInsideDistance(
  point: { x: number; y: number },
  edge: TopoEdgeFadeState,
): number {
  const centerX = (edge.min.x + edge.max.x) * 0.5;
  const centerY = (edge.min.y + edge.max.y) * 0.5;
  const halfX = Math.max(1, (edge.max.x - edge.min.x) * 0.5 - edge.insetM);
  const halfY = Math.max(1, (edge.max.y - edge.min.y) * 0.5 - edge.insetM);
  const localX = point.x - centerX;
  const localY = point.y - centerY;
  if (edge.shape === "circle") {
    return Math.min(halfX, halfY) - Math.hypot(localX, localY);
  }
  if (edge.shape === "rounded-square") {
    const radius = clamp(
      edge.cornerRadiusM,
      0,
      Math.max(0, Math.min(halfX, halfY) - 1),
    );
    const qx = Math.abs(localX) - (halfX - radius);
    const qy = Math.abs(localY) - (halfY - radius);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const inside = Math.min(Math.max(qx, qy), 0);
    return -(outside + inside - radius);
  }
  return Math.min(halfX - Math.abs(localX), halfY - Math.abs(localY));
}

export function topoEdgeFadePreferenceScore(
  point: { x: number; y: number },
  edge: TopoEdgeFadeState,
  preference: "west" | "north",
): number {
  const centerX = (edge.min.x + edge.max.x) * 0.5;
  const centerY = (edge.min.y + edge.max.y) * 0.5;
  return preference === "west" ? centerX - point.x : point.y - centerY;
}

export const TOPO_EDGE_FADE_GLSL = `
float topoEdgeFadeInsideDistance(
  vec2 worldPos,
  vec2 boundsMin,
  vec2 boundsMax,
  float shape,
  float insetM,
  float cornerRadiusM
) {
  vec2 terrainCenter = ( boundsMin + boundsMax ) * 0.5;
  vec2 halfSize = max(
    ( boundsMax - boundsMin ) * 0.5 - vec2( max( insetM, 0.0 ) ),
    vec2( 1.0 )
  );
  vec2 local = worldPos - terrainCenter;
  if ( shape > 1.5 ) {
    return min( halfSize.x, halfSize.y ) - length( local );
  }
  if ( shape > 0.5 ) {
    float radius = clamp( cornerRadiusM, 0.0, max( 0.0, min( halfSize.x, halfSize.y ) - 1.0 ) );
    vec2 q = abs( local ) - ( halfSize - vec2( radius ) );
    float outside = length( max( q, vec2( 0.0 ) ) );
    float inside = min( max( q.x, q.y ), 0.0 );
    return -( outside + inside - radius );
  }
  return min( halfSize.x - abs( local.x ), halfSize.y - abs( local.y ) );
}
`;
