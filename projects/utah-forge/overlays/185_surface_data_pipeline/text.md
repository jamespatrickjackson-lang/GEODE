# Encoding, Streaming & Rendering

Heavy science, light delivery — millions of triangles that load fast and composite cleanly.

## Tiles
Compact binary geometry instead of bloated JSON.
- Positions per-bbox uint16, normals oct-snorm16, indices u32
- JSON sidecar: counts, bbox, threshold, colour
- 23 boundaries ≈ 67 MB — 4.6× smaller than JSON arrays

## Streaming
Only pay for what's on screen.
- Metadata-only preview; visible boundaries fetched + dequantized on demand
- Lazy per-boundary GPU upload

## Rendering
Correct depth and colour through every transition.
- Double-sided MeshStandardMaterial; per-threshold colour from the layer style
- Solid-shell depth writes — front-over-back occlusion holds through fades/loads
- Transition-safe opacity on the page-transition clock

## Also available
Encoding and rendering modes beyond the default.
- Per-vertex feather alpha (RGBA) for uncertainty falloff — built, gated
- Wireframe mode + per-surface metalness / emissive / opacity
- Inline JSON geometry path retained as a fallback to the binary tiles
