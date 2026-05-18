# Cinematic Render Presets

## Purpose

Define a thin cinematic preset layer for GeoVox world-building and page polish. A preset should resolve into existing scene, terrain, post-processing, label, and public-context style fields rather than creating a separate rendering system.

The first implementation should be opt-in and non-destructive: if no preset is selected, current project behavior must remain unchanged.

## Guardrails

- Do not change current Phase 3 MT model rendering.
- Do not touch scalar, MT, or seismic technical renderers.
- Do not change source data, computed artifacts, product files, CRS transforms, scalar computation, loaders, or prep scripts.
- Do not change global renderer/material behavior as part of the preset system.
- Do not use presets to hide, park, or downgrade seismic.
- Preserve current project opening behavior for Woodjam, Shahbazi, Utah FORGE, and Base GUI.
- Missing preset fields must preserve current behavior.
- Existing explicit environment and page overrides must remain authoritative.

## Preset IDs

Preset IDs should be stable, human-readable strings. Proposed first ID shape:

- `neutral-current`: documents the existing look and acts as the no-surprise baseline.
- `high-desert-review`: restrained Utah FORGE review mood with cleaner terrain contrast and atmospheric depth.
- `demo-cinematic-clear`: polished client-demo presentation with stronger composition, labels, and public context clarity.
- `technical-dark-context`: darker technical review mode for high-contrast layers and diagnostics.

These IDs are proposed only. They do not imply accepted defaults or runtime behavior.

## Fields Affected

Presets may patch only existing world-building and presentation fields where possible:

- `scene.background`
- `scene.fog`
- `scene.sun`
- `scene.lighting`
- `scene.terrain`
- `scene.topoDetails`
- `scene.toneMapping`
- `scene.exposure`
- `scene.bloom`
- `scene.ambientOcclusion`
- `scene.vignette`
- `scene.colorGrade`
- `scene.gui.labels`
- public-context layer style fields for roads, hydrography, boundaries, claims, site outlines, and similar reference layers
- topo, contour, and isoline presentation style fields such as color, opacity, width, index emphasis, fog response, and distance fade
- page-level cinematic presentation fields, including existing `cinematicExposure`, `bloomBoost`, and `sunLockToCamera`

The preset system should prefer shallow patches onto existing config objects. It should not introduce duplicate scene concepts.

## Fields Explicitly Not Affected

Presets must not alter technical data rendering or computed-artifact meaning. Excluded fields include:

- MT scalar ranges, scalar transforms, scalar color ramps, scalar thresholds, slice depths, model density, or sampling
- Phase 3 seismic product files, product selection, amplitudes, raymarch/section computation, or seismic source interpretation
- loader behavior, runtime loading policy, disposal behavior, or lazy loading
- layer source paths, manifests, artifact metadata, provenance files, or generated outputs
- project `pageOrder`, unless a separate page/demo task explicitly allows it
- global material definitions or renderer internals
- computed artifact generation for isolines, contours, heat maps, slices, threshold surfaces, volumes, meshes, point-cloud tiles, or seismic products

If a future preset needs to influence a technical layer's visibility or opacity for a page, that should be a page-local review choice, not a preset-side technical renderer change.

## Resolution Order

Proposed resolution order for future implementation:

1. Engine and code defaults.
2. Project `environment.json` scene and layer style values.
3. Optional project-level active cinematic preset patch.
4. Page-level preset patch, if the page opts into one.
5. Existing explicit page scene controls, such as `cinematicExposure`, `bloomBoost`, and `sunLockToCamera`.
6. Existing page `visibilityOverrides` and `layerOverrides`.
7. Runtime/editor user adjustments, if present.

Rules:

- No selected preset means no behavior change.
- Missing preset fields are no-ops.
- Page-local explicit overrides win over preset values.
- Layer-specific page overrides win over public-context style presets.
- Preset resolution should be inspectable for diagnostics and future verification receipts.

## Recommended First Presets

Start with presets that mostly touch scene mood and public context, not technical layers:

| Preset ID | Role | Initial field families |
| --- | --- | --- |
| `neutral-current` | Baseline/current project look | Document current scene values, no visual change |
| `high-desert-review` | Utah FORGE geological review mood | Background, fog, sun, terrain ramp, topo fade, roads/hydro styling |
| `demo-cinematic-clear` | Client-demo clarity | Background, exposure, bloom, color grade, label density, public context contrast |
| `technical-dark-context` | Dense technical layer review | Background, fog, contour/public-context contrast, label restraint |

The first runtime pass should implement preset resolution with one or two opt-in pages only, then verify screenshots before any broader rollout.

## Utah FORGE First Tuning Target

The first tuning target should be the Utah FORGE demo walkthrough and MT plus seismic integration review pages.

Target outcome:

- Keep the existing Phase 3 MT resistivity rendering unchanged.
- Keep seismic visible and review-ready without changing seismic products globally.
- Improve terrain atmosphere, public roads/hydrography/boundary readability, contour/topo clarity, label density, and page mood.
- Keep provenance and review caveats visible in overlays or page context.
- Capture before/after screenshots and runtime diagnostics before considering any preset accepted.

The first Utah FORGE preset should be treated as proposed review input, not final demo scope and not human acceptance.

## Editor Manual QA

Use this checklist to verify the existing editor selectors before treating render presets as complete:

1. Open the app in editor mode.
2. Global selector path: `Page Manager` -> `00. Global Settings` -> `Cinematic Render Preset` -> `Project preset`.
3. Confirm `Current / Custom` is selected for projects that should preserve their authored look.
4. For Utah FORGE, confirm `Current / Custom` matches the existing visual appearance before preset preview.
5. Change `Project preset` from `Current / Custom` to `Survey Daylight` and confirm a visible world-building preview/change.
6. Switch back to `Current / Custom`, or use `Revert to Current / Custom`, and confirm the original authored look returns.
7. Save only after confirming the chosen mode is intentional.
8. Refresh and confirm the saved mode reloads.
9. Confirm the project `environment.json` stores only the top-level `renderPreset` field when a preset is intentionally selected; `Current / Custom` means the field is absent.
10. Page selector path: select a page in `Page Manager`, then use `Page Render Preset Override` -> `Page preset`.
11. Choose `Inherit project preset` to use the environment preset, or choose one of the five presets to save that page's `renderPreset` field.
12. Confirm Phase 3 MT, scalar, seismic, voxel/slice/heat-map, contour computation, product files, scalar ranges, and color ramps are unchanged.

This QA note verifies editor exposure and visible world-building behavior. It does not accept any preset, artifact, page, or render result as final.

## Custom User Presets

Custom user presets are project-local and live in `environment.json`:

```json
{
  "customRenderPresets": [
    {
      "id": "user-1",
      "label": "User 1",
      "source": "user",
      "createdAt": "2026-05-15T00:00:00.000Z",
      "scenePatch": {
        "background": "#23252a",
        "fog": { "enabled": true, "color": "#23252a", "density": 0.00002 }
      },
      "layerStylePatchesByLayerId": {
        "transport-roads": {
          "color": "#877864",
          "opacity": 0.46,
          "lineWidth": 1.35
        }
      }
    }
  ]
}
```

The GUI path for saving a custom preset is:

`Page Manager` -> `00. Global Settings` -> `Cinematic Render Preset` -> `Save Custom Preset`.

The first saved custom preset is named `User 1`; later saves use `User 2`,
`User 3`, and so on. Saved user presets appear in the same project and page
render preset dropdowns as the built-in presets. `Update Selected Custom
Preset` appears only when the active project preset is a user preset.

Captured fields are limited to cinematic/world-building fields:

- `scene.background`
- `scene.fog`
- `scene.sun`
- `scene.lighting`
- `scene.terrain`
- `scene.topoDetails`
- `scene.lightMode`
- `scene.toneMapping`
- `scene.exposure`
- `scene.bloom`
- `scene.ambientOcclusion`
- `scene.vignette`
- `scene.colorGrade`
- `scene.gui`
- safe public-context/contour layer style fields by layer ID, when represented globally in `environment.layerStyles`

Custom presets intentionally do not capture MT model data, scalar ranges,
seismic data, voxel/slice/heat-map state, source data paths, coordinates,
loader behavior, generated artifacts, or project/page navigation state.

### Custom Preset Manual QA

1. Open Utah FORGE in editor mode.
2. Confirm the project preset is `Current / Custom`.
3. In `Page Manager` -> `00. Global Settings` -> `Cinematic Render Preset`, click `Save Custom Preset`.
4. Confirm `User 1` appears in the `Project preset` dropdown and in the page-level `Page preset` dropdown.
5. Select `Survey Daylight` and confirm a visible world-building preview.
6. Select `User 1` and confirm the captured authored look returns.
7. Save, refresh, and confirm `environment.json` keeps `customRenderPresets` and the dropdown still includes `User 1`.
8. With `User 1` selected, make an intentional global scene change and confirm `Update Selected Custom Preset` is visible before using it.
9. Confirm Phase 3 MT rendering, scalar ranges, seismic products, source data, and computed artifacts are unchanged.
