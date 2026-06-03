# Cinematic Scene QA Checklist

Use this checklist before treating a cinematic render preset or tuned page as demo-ready. It is a visual review aid only; it does not replace provenance, artifact metadata, source review, or computed-artifact verification.

## Terrain
- Terrain reads as intentional, not a default GIS dump.
- Surface form remains spatially coherent with project scale.
- Terrain mode supports the page purpose: matte for premium context, relief for topology, ghost for subsurface reveal.
- Terrain does not obscure source-derived technical layers.

## Contours / Isolines
- Contours or isolines are legible at the page camera distance.
- Line weight and opacity support hierarchy without dominating technical data.
- Styling does not imply false precision or accepted interpretation beyond the source/provenance state.
- Labels or caveats are present when interval, source, or derivation could be misunderstood.

## Roads / Public Context
- Roads, hydrography, boundaries, and infrastructure remain secondary to technical data.
- Boundaries are readable without becoming visual noise.
- Hydrography stays subdued unless the page is explicitly public-context focused.
- Public context layers are not confused with client/private measured data.

## Labels
- Label density matches the page role.
- Cinematic and boardroom pages avoid all-label clutter.
- Technical/data-room pages show enough labels for orientation.
- Important labels do not overlap UI, legends, or key visual evidence.

## Lighting
- Lighting supports terrain form and data readability.
- Key light and ambient balance avoid blown-out surfaces.
- Rim or edge lighting adds separation without making data look synthetic unless intended.
- Locked sun/camera behavior is reviewed for moving pages.

## Fog / Atmosphere
- Fog adds depth without hiding evidence.
- Fog color matches the background and scene mood.
- Dense technical layers remain visible enough for review.
- Atmospheric styling does not hide provenance or caveat text.
- Local cloud/mist volumes are identified as environmental presentation aids,
  not measured atmospheric data.
- Single-cloud fixtures remain visible when `atmospherePuffCount` is `1`.
- Cloud bounds helpers, if used for review, are intentionally enabled and not
  left on as accidental diagnostic clutter.

## Sun
- The authored sun mode is clear: light source, visible sky image, both, or fake
  visual only.
- Hiding the visible orb/halo/source marker does not unintentionally disable
  terrain lighting when the page needs light-source effects.
- Orb edge softness, halo opacity, and marker opacity support the shot without
  reading as an accidental UI artifact.

## Camera Composition
- Camera framing shows the page's main visual argument immediately.
- The page leaves enough context to understand scale and location.
- Motion/orbit pages avoid disorienting angles.
- Important layers are not clipped by the viewport or hidden behind overlays.

## Depth Of Field
- DOF is off unless the page/preset intentionally enables it.
- Focus mode is understandable for the page: page target, camera object, manual distance, or picked point.
- Object-aware focus uses the saved camera-object world point when present; missing object focus falls back without snapping to an unrelated target.
- Manual-distance focus is reviewed from the active camera distance and does not blur the primary evidence by accident.
- Blur strength, aperture, and max blur support the presentation look without hiding technical meaning.
- Focus debug plane is toggleable and off before a client/demo capture unless the capture is a DOF diagnostic.

## Composition Guides And Presentation Frame
- Guides, safe frame, aspect masks, matte bars, corner fade, and frame lines are off unless intentionally used for a composition review or final look.
- Guide and presentation-frame strokes use the reviewed thin default: `compositionGuides.lineThickness: 0.25`.
- Rule-of-thirds, center cross, safe frame, and aspect-mask lines do not cover key labels, legends, boreholes, MT products, seismic sections, or provenance text.
- If guides or frame lines look too thick in the app, hard-refresh the running browser before diagnosing source code.

## Layer Hierarchy
- The primary artifact is visually dominant.
- Context layers remain supportive.
- QA/future/placeholder layers are hidden unless the page purpose calls for them.
- High-fidelity or full-density layers are treated as valuable evidence, not bloat.
- Utah FORGE full-density MT review views should show the side walls and shell points from oblique camera angles; focus/blend/color windows must not remove full-density source points unless an explicit thresholded inclusion mode is selected.
- Switching cinematic presets must not change full-density MT draw inclusion. Presets may affect scene mood and public context, but not whether source MT points are emitted.

## Provenance Clarity
- Source-derived, preview, synthetic, placeholder, and review-required states remain honest.
- Overlay text does not overclaim engineering accuracy.
- Final interpretation and acceptance stay human-reviewed where appropriate.
- Legends/status/provenance remain visible when needed for technical meaning.

## Screenshot Readiness
- Screenshot captures the intended page state.
- Visual evidence includes the project, page, visible layers, and any active preset when possible.
- No transient editor clutter appears unless the screenshot is specifically an editor QA capture.
- Screenshot filename and receipt path are recorded for later review.

## Render-Stack Diagnostics
- For Utah FORGE visual bugs, run `npm run inspect:effective -- --render-stack` before editing.
- Record active preset, environment scene, Sub Master `envSnapshot`, preset `scenePatch`, page `sceneOverrides`, layer styles, topo material authority winner, texture URL/cache key, bounds, public clip, edge fade, edge outline, material/shader, terrain geometry/LOD, and post-processing pass order.
- Current Utah FORGE cinematic baseline uses active preset `user-3`, topo authority `image:naip-2024-aerial`, and the NAIP raster cache key `v=14db7e6b94489d80`.
