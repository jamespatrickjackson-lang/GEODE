# Topo Environment, Clouds, Sun, And Cinematics Thread Update - 2026-06-03

Status: current thread receipt for the implementation committed as `d6110dd`.

## What Landed

- Topo now has an Environment section with Scene atmosphere, Clouds, Sun, and Fog containers.
- Cloud controls are backed by `atmosphere-volume` layers. Authors can add, duplicate, delete, select, show/hide, and page-override cloud volumes from `Topo > Environment > Clouds`.
- Cloud volume style lives in `environment.layerStyles` and page `layerOverrides`. Immutable/default placement and provenance stay in `project.json` layer metadata.
- On-screen cloud bounds helpers are optional and default off. When enabled, the helper exposes a bounds outline plus move, size-X, size-Y, and size-Z handles that write back to the same atmosphere bounds fields.
- Runtime cloud puffs use deterministic seeded `THREE.Sprite` impostors and generated canvas textures. There are no external cloud assets, no `Data3DTexture`, no raymarcher, and no global `scene.fog` mutation path.
- A one-puff cloud is now supported. When `atmospherePuffCount` is `1`, the puff is centered in the authored bounds and its base opacity comes directly from density.
- Sun controls now separate light-source behavior from sky-image behavior. The author can show a visible orb/halo/source marker, hide the visible sky image while keeping light effects on terrain, or make a fake visual sun that is not the light source.
- Cinematic scene controls include page-local dynamic camera motion and cinematic post transition channels. Numeric post fields blend through `main-camera/cinematic-post`; cloud layer opacity composes with transition opacity rather than flattening puff falloff.

## Current Utah FORGE Visual State

- Utah FORGE has a visible default test cloud layer named `Topo test cloud`.
- Current visible test style is intentionally obvious for review: one white puff, high opacity/density, `depthTest: false`, `affectedByFog: false`, and high render order.
- Page `12_mt_volume_overview` explicitly keeps `utah-forge-topo-clouds` visible.
- Human review in this thread accepted the visible cloud state with "it worked."

## Render-Stack Trace From The Visual Check

- `environment.scene`: active Utah FORGE scene with user preset `user-3`.
- Sub Master `envSnapshot`: none for the checked page.
- Render preset: `user-3`; page scene overrides merged after the resolved environment.
- Terrain material authority: `environment.scene.terrain`.
- Active topo texture URL/cache key: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=14db7e6b94489d80`.
- Texture bounds: `[229069.2, 4144854, 484164, 4414308]`.
- Public clip: render-stack trace reports enabled, center `[0, 0, 2000]`,
  size `[1395706.5, 1139445, 12600]`. The inspector also reports a
  `layer.terrain.publicSurfaceClipEnabled` authority conflict: environment
  `true`, active preset layer patch `false`, winner `active render preset layer
  patch`.
- Material edge fade: rounded-square distance `10000`, inset `10000`, corner radius `75000`.
- Edge outline: enabled.
- Cloud texture source: `generated-canvas`.
- Cloud cache key: `local-atmosphere:utah-forge-topo-clouds:101:0.68`.
- Cloud material/shader: `THREE.SpriteMaterial`, transparent, `depthWrite: false`, configurable depth test.
- Cloud geometry: one `THREE.Sprite` screen-aligned quad billboard.

## Verification Run Before Commit

- `node tests/tools/topo-cloud-authoring-source.test.mjs`
- `node tests/tools/local-atmosphere-volume-source.test.mjs`
- `node tests/tools/topo-environment-sun-source.test.mjs`
- `npm run check:pages`
- `npm run build`
- `npm run check:workspace`

## Follow-Up Boundaries

- Do not treat local atmosphere as measured meteorology or technical evidence. Provenance classification is `environmental`.
- Keep debug visuals toggleable and default off.
- Do not add Utah-specific runtime branches for clouds, sun, or cinematic post.
- If the visible test cloud is later made subtle, keep a page or QA fixture that proves a single one-puff cloud can be seen, moved, saved, reloaded, and transitioned.
