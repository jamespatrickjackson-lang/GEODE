# Encoding, Streaming & Rendering

Delivery is engineered separately from generation: the full-resolution surface set is encoded, streamed, and rendered so that a large triangle budget loads quickly and composites correctly with the volume and other transparent layers.

## Tiles
Geometry is stored as compact quantised binary tiles with a small JSON sidecar for metadata, replacing the earlier verbose JSON arrays at a fraction of the size.
- Positions per-bbox uint16, normals oct-snorm16, indices u32
- Per-vertex feather alpha for the uncertainty falloff
- JSON sidecar (counts, bbox, threshold, colour); 23 boundaries ≈ 67 MB (4.6×)

## Streaming
Only the geometry currently required is transferred: the runtime reads metadata first, then fetches and de-quantises individual boundaries on demand.
- Metadata-only preview; visible boundaries fetched + dequantized on demand
- Lazy per-boundary GPU upload and unload

## Rendering
The render path maintains correct depth ordering and per-threshold colour through page transitions, fades, and lazy loads, including inter-surface occlusion while geometry is still arriving.
- Double-sided MeshStandardMaterial; per-threshold colour from the layer style
- Solid-shell depth writes — front-over-back occlusion holds through fades/loads
- Wireframe mode; per-surface metalness / emissive / opacity
- Transition-safe opacity on the page-transition clock
