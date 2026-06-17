# Decision-Point Map — transition behavior owners (2026-06-17)

Phase 2 preflight (A). The scattered owners that decide/apply per-entity
transition behavior today, what each decides, and the single resolver output it
collapses into under the settled model (constant | fade | clip(hold/apply/move) |
morph | interact | inert). Set/begin sites only (not `.has`/`.get`/`.delete`).

## Owners

| Owner | Set/begin sites | Channel | Scope kind | Collapses to |
| --- | --- | --- | --- | --- |
| `layerTweens` | transitionEffectiveLayersForPage.ts:1400, :1437; SceneManager.ts:3560 (late-attach), :5128/:5139 (editor-deferred preserve) | opacity | ENTITY (per layer) | **fade** (and **constant** when source==target opacity) |
| `scalarStyleTweens` | transitionEffectiveLayersForPage.ts:1382 | scalar appearance | ENTITY (per layer, MT scalar) | **morph** (in-place scalar range/colormap interpolation) |
| `layerTransitionSnapshots` | transitionEffectiveLayersForPage.ts:1407 | opacity + clip (snapshot crossfade / source-masked exit) | ENTITY (per layer) | **clip(hold)** on exit / else **fade** crossfade |
| `sceneSectionStyleTween` | transitionEffectiveLayersForPage.ts:1141 (set), :749/:1171 (null); SceneManager.ts:4695/:4742 (null); layerTweenRuntime.ts:224 (null) | clip (scene-section) | CHANNEL (cross-cutting) | **clip(move/hold/apply)** — the clip channel itself |
| `sectionIsoOverlayTransition` | begin: SceneManager.ts:2116; called transitionEffectiveLayersForPage.ts:1178, :1218 | derived-root (Section ISO bands/lines) | DERIVED (follows host volume/seismic) | **interact / derived-follow** (bond implicit in host state) |
| `sceneSectionHelperTransition` | begin: SceneManager.ts:1992 | derived-root (frame/cones/ground-trace/axes) | DERIVED (follows section) | **move / fade** (helper; keeps own owner) |
| working-area focus | apply: SceneManager.ts:2827 (`applyWorkingAreaFocusStyle`), :2839 (`transitionWorkingAreaFocusForPage`); called transitionEffectiveLayersForPage.ts:1510; layerTweenRuntime.ts:237 | clip (working-area) | CHANNEL (cross-cutting) | **clip(move/hold/apply)** modifier, composes with section |

Per-frame driver for the clip channel: `tickLayerTweens` (layerTweenRuntime.ts)
re-applies the section each frame (:207/:218); the active->inactive exit branch
(transitionEffectiveLayersForPage.ts:1501) has NO section tween — which is why a
held clip needs the registry to self-drive, not a re-map.

## Consolidated view (the three kinds)

- **ENTITY owners** (attach to a renderable): `layerTweens` (opacity →
  fade/constant), `scalarStyleTweens` (appearance → morph),
  `layerTransitionSnapshots` (exit → clip-hold/crossfade).
- **CHANNEL owners** (cross-cutting modifiers, own no entity): `sceneSectionStyleTween`
  (section clip), working-area focus (focus clip). These compose ONTO whatever
  entities they target; they are not groups.
- **DERIVED owners** (follow a host): `sectionIsoOverlayTransition` (ISO roots,
  bond implicit in host fields), `sceneSectionHelperTransition` (helpers).

This is why the seven feel strange: they live on three different axes (entity ×
channel × derived), lined up as peers. The consolidation: one resolver emits a
verb per ENTITY-group, composed with CHANNEL modifiers, with DERIVED following
their host; one applier executes; fade is branch zero.
