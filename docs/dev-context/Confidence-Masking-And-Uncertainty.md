# Confidence-Masked Surfaces and Uncertainty Feathering

Status: partially implemented, then **disabled** (2026-06-21). Decision:
`docs/03-decisions.md` DEC-181.

> As-built note: the first cut used this spec's **hard clip** (`Mhard = C ≥
> clipLow` + morphology) and removed ~57% of the MT model — data-support density
> mislabels a smoothness-regularized inversion's resolved interior as
> low-confidence. It was reworked to **feather-first** (no extent clip; only the
> sparsest ~5% of occupied voxels by support feather opacity → 0, via
> `prep/lib/confidence.mjs` `supportFeatherAlphaField`), then **gated off**
> (`CONF_FEATHER_ENABLED = false`) pending a better confidence basis (e.g.
> distance outside the station footprint, or true inversion sensitivity / DOI).
> The morphology helpers in `confidence.mjs` (`buildCleanedSurfaceMask`,
> erode/dilate/open/close, connected components) are built but currently
> unreferenced. Per-vertex feather is carried as RGBA vertex alpha; note the
> render policy moved to always-on `depthWrite` for solid shells (DEC-183), so
> the opaque-fast-path detail in §3 below is superseded. The sections below
> remain the design intent for the medical track; clip-based extent reduction is
> NOT in the current build.

This is the source-of-record spec for how iso-surfaces (and, later, any
volumetric surface in this codebase) handle **low-confidence / unreliable data
regions**. It is written modality-generic on purpose: the same machinery serves
the Utah FORGE MT model now and the CT/MRI/OCT medical track later.

## 1. Problem

Iso-surface edges fray into a splotchy, speckled fringe at the **low-confidence
margins** of the model — sparse coverage, poorly-constrained cells, low SNR —
where the field hovers near the threshold and noise breaks the contour into
specks, holes, and jagged spurs. Rendering that fringe as a clean surface
*implies reliability that does not exist*, which is scientifically wrong and, in
a medical context, unsafe.

Correct handling (the established geophysics + medical-imaging standard):

1. **Do not surface into low-confidence voxels** (mask by a quantitative
   confidence metric).
2. **Clean the speckle** morphologically (don't render isolated noise fragments).
3. **Communicate the falloff** by feathering surface opacity to zero across the
   confidence band — never fake a hard edge.

Cosmetically smoothing the fringe into a clean surface is explicitly **not**
acceptable: it manufactures confidence the data lacks (same integrity rule as
the no-overshoot reconstruction work — never represent more certainty than
exists).

## 2. Canonical confidence channel (modality-generic)

Add `confidence` as a first-class channel of the regular-volume model
(0..1 Float32, aligned to the scalar grid), alongside scalar / mask / per-axis
spacing / window-level / units / provenance. (This is the confidence facet of
the canonical volume model — roadmap R3.)

One pluggable **confidence provider** per modality produces the channel;
everything downstream consumes `confidence` identically and is modality-agnostic.

Provider interface (conceptual):

```
confidenceProvider(volume, sourceContext) -> Float32 confidence[0..1]  // grid-aligned
```

### Providers

- **MT (implement now):** *data-support coverage.* Normalized local sample
  density — the reconstruction already computes binned `counts` and a
  Gaussian-blurred support weight; normalize against an expected full-coverage
  count, optionally combined with distance-to-nearest-sample. This directly
  targets the sparse-margin fraying. Designed to be **swapped for a true
  inversion sensitivity / model-resolution / depth-of-investigation (DOI)** field
  when a source provides one (the cell-center `.dat` does not).

- **CT (medical):** HU SNR (HU is quantitative; estimate noise σ from an
  air/uniform ROI or DICOM noise metadata) combined with `(1 − partial-volume
  ambiguity)` near boundaries.

- **MRI (medical):** SNR (normalized — MRI intensity is not quantitative)
  and/or **segmentation probability / uncertainty** when surfaces are extracted
  from a labelmap or probability map (confidence = class probability, or
  `1 − normalized entropy`).

- **OCT (medical):** reflectivity SNR / inverse speckle variance (low in
  shadowed and deep regions).

The provider is selected per dataset; the surface pipeline never branches on
modality.

## 3. Prep pipeline

1. Provider → confidence volume `C` (0..1).
2. Hard support: `Mhard = C >= clipLow`.
3. **Morphological cleanup** on `Mhard`:
   - OPEN (erode by radius `r` → dilate by `r`) to kill speckle and thin spurs;
   - connected-component labeling, drop components smaller than `minIslandVoxels`;
   - optional CLOSE to fill small interior holes.
   → `Mclean`.
4. Marching cubes uses `Mclean` as its mask — surfaces extract **only** in the
   reliable region, so the splotchy fringe never appears.
5. **Per-vertex confidence:** sample `C` at each final mesh vertex → feather
   alpha = `smoothstep(featherLow, featherHigh, C)`, so the surface fades across
   the confidence band just inside the clip instead of ending in a hard cut.
6. Bake the feather alpha into the boundary asset (see §4).

## 4. Runtime / material — feather is transition-safe by construction

The MT threshold material is a `MeshStandardMaterial` with `vertexColors`
(`src/loaders/surfaceRenderPolicy.ts`). Carry the feather as **RGBA vertex
color** (A = feather alpha). The standard shader multiplies `material.opacity`
by the vertex alpha, so the feather **composes** with the transition-owned
opacity envelope automatically — it introduces **no new opacity owner**
(Transition Runtime Operating Spec: "opacity is composed, not overwritten").

Required care:

- `applyMtThresholdSurfaceMaterialOpacity`'s opaque fast-path
  (`opacity >= 0.999 → transparent=false, depthWrite=true`) MUST be disabled for
  any surface that carries sub-1 feather alpha, or the alpha is discarded.
- `loadMeshPreview.buildPreviewGeometry`: color attribute itemSize 3 → 4 (RGBA)
  when the asset provides confidence; the lazy per-boundary path inherits it.

## 5. Provenance + uncertainty communication

- Record provider id, metric, `clipLow`, feather band, and morphology params in
  the surface/volume provenance.
- Label surfaces: "clipped to data-support / confidence; margins are
  model-unconstrained and feathered to show falloff."
- Optional later: a separate "data-extent / DOI" boundary outline so the viewer
  sees where confidence runs out.

## 6. Files to change (when implemented)

- Prep: new `prep/lib/confidence.mjs` (providers + morphology: erode / dilate /
  open / close + connected-components); `prep/build_utah_forge_mt_volume_products.mjs`
  (compute `C` from `counts`, clean the mask, sample per-vertex confidence, write
  confidence into boundary assets and as a volume channel).
- Extract: `prep/lib/marchingCubes.mjs` (mask from `Mclean`; emit per-vertex
  feather alpha).
- Runtime: `src/loaders/loadMeshPreview.ts` (RGBA color/alpha);
  `src/loaders/surfaceRenderPolicy.ts` (opaque fast-path guard for feathered
  surfaces).
- Volume model + `src/pages/types.ts` (`confidence` channel field/metadata).
- Guards: `tools/audit-mt-resistivity.mjs` / `tools/validate-utah-derived-assets.mjs`
  (assert confidence present + within [0,1], clip/morphology metadata recorded,
  feather alpha present); `docs/dev-context/editor-control-manifest.json` if a UI
  control is added (e.g. a confidence-threshold slider).
- Docs: this file + the DEC entry.

## 7. Transition blast radius (lower than R9)

- The feather is geometry-baked per-vertex alpha → composes with the transition
  opacity envelope automatically; **no cross-layer dependency** (confidence is
  intrinsic to the volume, unlike the R9 Section-ISO coupling).
- Main caveats: the opaque fast-path guard (§4) and declaring any
  confidence-threshold control / feature toggle as a **discrete** transition
  channel.
- The clip changes surface *extent*, but it is static per page (authored), so
  transitions see normal geometry. Lazy boundary assets carry confidence, so no
  new readiness concern (ISO_SURFACES_002 readiness work unaffected).
- Verify against the standard transition gate (opacity regression test +
  `npm run audit:transition-matrix`); expect minimal movement.

## 8. Parameters (tunable; recorded in provenance)

`clipLow`, `featherLow` / `featherHigh` (confidence band), erosion radius `r`,
`minIslandVoxels`, close radius. Finalized by visual sign-off on the previously
frayed regions.

## 9. Verification

- Regenerate; confirm the splotchy margins are gone (clipped) and surfaces fade
  smoothly across the falloff instead of a hard cut; interiors unchanged.
- Guards green (confidence asserts); `npx tsc -b`; transition opacity regression
  + `audit:transition-matrix` (expect minimal change); in-app A/B on the frayed
  region.
- Integrity check: surfaces exist only where `C >= clipLow`; no fabricated
  coverage.

## 10. Relationship to other roadmap work

- **R1 (tricubic reconstruction):** smooths the *interior* silhouette; R10
  handles the *unreliable margins*. Complementary.
- **R3 (canonical volume model):** `confidence` is one of its channels.
- **R5 (itk-wasm / vtk.js medical foundations):** the CT/MRI/OCT providers here
  are where modality confidence metrics plug in for the medical track.
