# Gravel Pit — Reverse-Z Surface Regression: Investigation Log (2026-06-20)

Status: **INTERIM FIX APPLIED + VERIFIED (gravel-pit-scoped). DEEP/PROCESS FIX
DEFERRED to a later session — see §13–§15 + Future Work. MAJOR.**
Project affected: `case-study-b` ("Shahbazi Gravel Pit").
Origin commit: `3c46a48 "Stabilize MT section iso rendering"` (Utah FORGE MT work).
Constraint: Utah FORGE must not regress; transitions must not regress.

This is a running log. New entries append under "Session Entries" with a date.

---

## 1. Summary (TL;DR)

Opening the gravel pit shows the extrapolated ground surfaces missing (only the
topo/contour lines remain) and the projected UAV images rendering partially /
torn ("broken as surfaces"). The surfaces are not black — they are
depth-rejected.

Root cause: a Utah FORGE MT commit (`3c46a48`) switched the **global** WebGL
renderer to a **reverse-Z depth buffer** (`reverseDepthBuffer`, with
`logarithmicDepthBuffer` fallback) at `src/scene.ts:542-547` to improve MT
isosurface depth precision in the deep (±120 km) MT scenes. Reverse-Z inverts
the depth convention and the effective direction of `polygonOffset`. The gravel
pit's preview surfaces are made visible by a delicate polygon-offset
arrangement: an opaque, color-suppressed, depth-writing **depth occluder**
pushed "behind" the surface (`polygonOffset +8`) so the transparent surface
(`-1`) and projected image (`-16`) win the depth test. Under reverse-Z that `+8`
offset flips, so the occluder now wins and **erases its own surface**.

The depth occluder is used **exclusively** by the gravel pit. Utah FORGE uses
the same surface-preview material for its MT slices but has **no occluders**, so
those MT slices render correctly under reverse-Z. That asymmetry is both the
explanation and the safe-fix boundary.

---

## 2. Symptom

- User report (2026-06-20): on opening the gravel pit, "surfaces we extrapolated"
  and "the images" are wrong. Refined: "I can see the topo lines but not
  surfaces. I can see some images broken as surfaces. It's not just a black
  surface."
- First clean preview screenshot (page `00_global_settings`): contour lines
  (outer pink, TLS teal) render; the surface area reads dark; point-cloud color
  shows in the TLS footprint; no visible image drape.

Affected layers (exact):
- `shahbazi-tls-surface-preview` — extrapolated surfaces (IDW outer surface +
  TLS island surface). `projects/case-study-b/project.json:485`.
- `shahbazi-photo-overlay-preview` — six UAV image previews projected onto those
  surfaces. `projects/case-study-b/project.json:528`.

---

## 3. What was ruled out (reliable scene-graph inspection)

Live inspection of the loaded `case-study-b` scene confirmed both layers load
and are well-formed:
- present, `visible: true`, `parentVisible: true`;
- valid geometry (zero NaN positions), identity world transforms (scale 1,
  translate 0);
- valid unit-length, up-facing normals;
- correct materials: surfaces are `MeshStandardMaterial`, `vertexColors: true`
  with light vertex colors (avg 0.61, max 0.93), `FrontSide`, `transparent`,
  `depthWrite: false`; photo overlays are `MeshBasicMaterial` with textures
  loaded (`hasMap: true`), `opacity` driven to 0.8;
- each surface carries its opaque depth occluder (`colorWrite: false`,
  `depthWrite: true`, `polygonOffset +8`, renderOrder 12.7);
- lighting rig healthy (HemisphereLight 0.7 + 3 DirectionalLights 1.05/1.16/0.24,
  matching layer masks, targets at origin), no clipping planes, tone mapping
  ACES exposure 1.08, `scene.environment` null.

Therefore NOT: data loss, fetch/load failure, schema rejection, visibility-off,
transform corruption, NaN geometry, missing textures, missing normals, clipping,
or material misconfiguration.

---

## 4. Root cause

`src/scene.ts:542-547`:

```
const useReverseDepthBuffer = browserSupportsReverseDepthBuffer();
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  reverseDepthBuffer: useReverseDepthBuffer,
  logarithmicDepthBuffer: !useReverseDepthBuffer,
});
```

- Runtime-confirmed: `renderer.capabilities.reverseDepthBuffer === true`.
- `browserSupportsReverseDepthBuffer()` (`src/scene.ts:130`) returns true when
  WebGL2 + `EXT_clip_control` are present.
- Introduced by commit `3c46a48 "Stabilize MT section iso rendering"`
  (`git log -S "reverseDepthBuffer" -- src/scene.ts` and
  `-S "browserSupportsReverseDepthBuffer"` both point to `3c46a48`). Three.js
  version: `three@^0.169.0` (reverse-Z supported since r163).

Mechanism (why surfaces vanish but lines survive):
- The depth occluder (`createSurfaceDepthOccluderMaterial`, `polygonOffset +8`)
  is meant to render "behind" the transparent surface so the surface wins the
  depth test and paints; the occluder writes depth without color so foreground
  geometry still occludes the surface.
- Under reverse-Z the depth range and `polygonOffset` direction invert, so the
  occluder's depth lands "in front of" the surface. The transparent surface
  (`depthWrite: false`) then fails the depth test against the occluder and is
  not drawn — the surface disappears (not blackened).
- Contour/topo lines have no occluder and use simpler depth handling, so they
  still render — matching "topo lines but not surfaces."
- The projected images (`polygonOffset -16`) partially fail the same way —
  matching "some images broken as surfaces."

Secondary, pre-existing data artifact (NOT this regression): photo overlay
"Shahbazi projected image 104" has a baked triangle stretched from the surface
(z≈122) down to z≈0.12 — a projection ray that missed the surface, baked into
`projects/case-study-b/data/processed/shahbazi_gravel_pit/photo_overlay_preview/photo_overlay_manifest.json`
(May 11). It is newly conspicuous now that the real surfaces are gone.

---

## 5. Blast-radius analysis

### 5.1 Fix-site modules and consumers

`src/loaders/surfaceRenderPolicy.ts` is a shared hub feeding BOTH projects.
Importers: `loadLineStrings.ts`, `loadMeshPreview.ts`, `loadPhotoOverlayPreview.ts`,
`SceneManager.ts`, `isoOverlays/sectionIsoOverlay.ts`, `layerLoaders.ts`,
`styles/mtThresholdSurfaceStyle.ts`.

`SceneManager` imports only `applyMtThresholdSurfaceMaterialOpacity`,
`createMtThresholdSurfaceMaterial`, `MT_THRESHOLD_SURFACE_POLICY`,
`SURFACE_RENDER_ORDER` — it does NOT reference the occluder/preview/photo
factories.

### 5.2 Three concentric rings

Ring A — gravel-pit-EXCLUSIVE (safe to change; zero Utah / zero transition blast
radius):
- `createSurfaceDepthOccluderMaterial` + `SURFACE_PREVIEW_DEPTH_POLICY.occluder`
  (`+8`) + `addDepthOccluder` + `depthPolicy:"depth-occluding-preview"`. The
  occluder path appears only at `src/scene/layerLoaders.ts:509,514`.
  Runtime-confirmed: **occluders in Utah FORGE = 0**.
- `createPhotoOverlayMaterial` + `PHOTO_OVERLAY_PREVIEW_POLICY` (`-16`) +
  `loadPhotoOverlayPreview` (only importer is the case-study-b loader).
- `SURFACE_RENDER_ORDER.depthOccluder` and `.photoOverlayPreview` (no other
  consumer).

Ring B — SHARED with Utah FORGE (do NOT change):
- `createSurfacePreviewMaterial` / `SURFACE_PREVIEW_DEPTH_POLICY.material`
  (`-1`): runtime-confirmed used by **10 Utah MT meshes** (MT observed-top,
  full-density, all horizontal slices/sections). Proof the shared surface
  material is fine under reverse-Z — Utah's MT slices use the identical material
  and render correctly because they have no occluder. The surface material needs
  no change; only the occluder is broken.
- `SURFACE_RENDER_ORDER.meshPreview / outerMeshPreview / contourLine /
  boundaryLine` (both projects).

Ring C — Utah-FORGE-only / global (forbidden for this fix):
- `MT_THRESHOLD_SURFACE_POLICY`, `createMtThresholdSurfaceMaterial`,
  `applyMtThresholdSurfaceMaterialOpacity`, `SECTION_ISO_OVERLAY_POLICY`,
  `SURFACE_RENDER_ORDER.sectionIsoOverlay` (46 MT-threshold + 16 section-iso
  meshes).
- The global `reverseDepthBuffer` renderer flag (Utah MT depth precision +
  capture pipeline depend on it).

### 5.3 Transition exposure — confirmed isolated

- The occluder carries `userData.ignoreLayerStyle: true`; both transition-opacity
  paths skip it — `currentRenderOpacityForTree` (`SceneManager.ts:1453`) and
  `applyRenderOpacityToTree` (`SceneManager.ts:1642`).
- Transitions tween opacity, not render order; the Ring-A render-order constants
  are inert to the transition system.
- The `transition-*` node:test suite asserts opacity/channel/clip logic, not
  depth/render order, so a Ring-A change cannot touch it.

### 5.4 Other projects

- woodjam: no mesh-preview/photo/occluder layers; only `megaton-dcip-anomaly`
  (cosmetic `-1` offset). Not in this blast radius.
- base-gui: its `type:"mesh"` layer (`base-gui-reference-stage`) has `files:{}`,
  does not hit `loadMeshPreview`; procedural reference stage, no occluder.

### 5.5 Full reverse-Z exposure surface (all `polygonOffset` users)

`surfaceRenderPolicy.ts` (preview `-1`, occluder `+8`, photo `-16`, MT `-2`,
section-iso `-4`), terrain `terrainStyleController.ts` `-2`, scene overlays
`loadSceneOverlays.ts` `-3`, DCIP `loadDcipAnomaly.ts` `-1`, a line material
`SceneManager.ts:4716` `-6`, `isoOverlays/sectionIsoOverlay.ts` (section-iso).
All except the gravel-pit occluder use small cosmetic offsets (lift lines /
overlays above a coplanar surface) where a reverse-Z sign flip is at worst mild
z-fighting — not disappearance. The occluder is uniquely catastrophic because it
is opaque + color-suppressed + depth-writing and is meant to lose the depth test
to its own surface.

---

## 6. Guard inventory and gap

Static guards (`check:workspace`, `check:gate`, `check:pages`, `check:artifacts`,
`check:editor-controls`, `check:utah-runtime`, `check:seismic-source-gates`,
`check:mt-resistivity`) validate workspace/data/manifest integrity — none catch
a render regression.

Runtime/Playwright guards that WOULD catch a Utah or transition regression:
- `test:tools` (`run-source-tests.mjs`, ~90 node:test files incl. ~15
  `transition-*` + scene-section + clip suites) — transition logic.
- `audit:transition-matrix` / `audit:transition-report` — transition behavior.
- `test:utah-forge` (→ `check:utah-runtime` + `test:utah:browser`),
  `test:utah:sections` (`section-iso.spec.ts`), `test:utah:seismic`,
  `test:utah:topo` — Utah rendering/editor.

Gaps found:
- **Zero** gravel pit rendering coverage. A search of `tests/` for `case-study-b`,
  `shahbazi`, `gravel`, `photo-overlay`, `surface-preview`, `depth-occlud`
  returns nothing. This is why the regression shipped unnoticed.
- `test:utah:mt` references `tests/utah-forge/mt-rendering.spec.ts`, which **does
  not exist** — Utah MT *rendering* is also unguarded at the Playwright level.

---

## 7. Recommended fix (not yet applied)

- Scope to Ring A only: make the depth occluder reverse-Z-aware — sign-correct
  `SURFACE_PREVIEW_DEPTH_POLICY.occluder` / `createSurfaceDepthOccluderMaterial`
  based on `renderer.capabilities.reverseDepthBuffer`, OR drop the occluder when
  reverse-Z is active (Utah's identical surface material renders fine without
  one). Leave Ring B/C and the renderer flag untouched.
- Treat the image-104 baked projection artifact as a separate data-side item.
- Close the guard gap: add a Playwright spec asserting gravel pit surfaces
  render; create the missing `tests/utah-forge/mt-rendering.spec.ts`.

Verification matrix to run before/after any fix:
- `npm run build` (tsc), `npm run test:tools` (transitions),
  `npm run test:utah-forge`, `npm run test:utah:sections`,
  `npm run audit:transition-matrix`.
- Manual foreground render check of BOTH `case-study-b` and `utah-forge`.

---

## 8. Tooling notes / caveats

- The dev preview here runs in a backgrounded tab → its `requestAnimationFrame`
  render loop pauses when idle (`frameIndex` frozen). Consequently
  `preview_screenshot` times out and ad-hoc `readPixels` / `renderCaptureFrame`
  pixel readbacks return artifacts (uniform values / all-black even with emissive
  forced white). **Scene-graph property reads are reliable; pixel-level visuals
  require a foreground run.** All findings above rest on scene-graph reads + the
  one clean first screenshot + git evidence.
- No code or project files were modified during this investigation. Live-scene
  probes (visibility toggles, emissive/side/light/camera nudges) were ephemeral
  and restored / reset on reload.

---

## 9. Evidence index

- Origin commit: `3c46a48` (reverse-Z), confirmed via
  `git log -S "reverseDepthBuffer" -- src/scene.ts`.
- Renderer state: `renderer.capabilities.reverseDepthBuffer === true`.
- Occluder exclusivity: `depth-occluding-preview` only at
  `src/scene/layerLoaders.ts:509,514`; Utah occluder count = 0 (runtime).
- Shared material: 10 Utah MT meshes report
  `material.userData.surfaceRenderPolicy === "depth-occluding-transparent-surface-preview"`.
- Transition isolation: occluder `ignoreLayerStyle` skip at
  `SceneManager.ts:1453,1642`.

---

## 10. three.js r169 reverse-Z engine behavior (authoritative)

Verified against the installed `three@0.169.0` source in `node_modules/three/src`.

What r169 auto-corrects when `reverseDepthBuffer` is active:
- Sets the reversed flag globally:
  `if (capabilities.reverseDepthBuffer) state.buffers.depth.setReversed(true)`
  (`node_modules/three/src/renderers/WebGLRenderer.js:295`).
- Remaps the projection matrix to reversed depth
  (`WebGLRenderer.js:1983-1988`, `toNormalizedProjectionMatrix` +
  `toReversedProjectionMatrix`).
- Flips clear depth to 0 (`WebGLRenderer.js:599`).
- Auto-reverses `depthFunc` via a `reversedFuncs` map in `DepthBuffer.setFunc`
  (`WebGLState.js:5-14, 122`); material `depthFunc` is routed through it
  (`WebGLState.js:745`), e.g. `LessEqual → GreaterEqual`.

What r169 does NOT correct:
- **`polygonOffset`.** `setPolygonOffset` passes the material's
  `polygonOffsetFactor`/`Units` verbatim to `gl.polygonOffset()` with no
  reference to the reversed state (`WebGLState.js:836-850`), called with raw
  material values (`WebGLState.js:760`).

Consequence: every hand-tuned `polygonOffset` is applied with its original sign,
so its push direction is **inverted** under reverse-Z. This is the confirmed
engine-level mechanism behind the occluder rendering in front of (and erasing)
its own surface. The hypothesis "the engine does not correct `polygonOffset`
sign" is CONFIRMED.

---

## 11. Scope refinement (correction to earlier framing)

- The explicit `depthFunc = LessEqualDepth` at `SceneManager.ts:4713` is **NOT**
  a latent reverse-Z bug — the engine auto-reverses it to `GreaterEqual`
  (§10). Earlier framing that treated `depthFunc` as a second broken class is
  withdrawn. The universal remediation centers on **`polygonOffset` only**.
- Residual caveat: any depth comparison set OUTSIDE the material→`setFunc` route
  (e.g. a direct `gl.depthFunc` call, or writing `gl_FragDepth` manually) bypasses
  the auto-reverse. None found in `src/` today; the per-mode test should guard
  against introduction.

---

## 12. Universal remediation design (PREFERRED — supersedes the Ring-A-only patch in §7)

Per direction: avoid a ring-fenced gravel-pit patch; remediate the root cause so
no project or future layer carries latent reverse-Z offset bugs.

Root cause restated: convention-specific magic numbers (`polygonOffset`)
scattered across feature code, tuned for the standard depth convention, silently
invalidated by the global reverse-Z switch. The gravel pit occluder is the first
catastrophic failure; terrain/overlay/DCIP/section-iso/MT offsets are latent
(currently sub-visible) failures of the same family.

Design (not a patch):
1. **Express intent, not raw numbers.** Replace signed `polygonOffset` literals
   with semantic intent — "render BEHIND reference by N", "render IN FRONT by N",
   "coplanar lift" — at every call site.
2. **One depth-policy module owns the conversion** intent → correct
   `polygonOffset` sign + per-mode magnitude, reading the single source of truth
   already present: `depthBufferMode` / `renderer.capabilities.reverseDepthBuffer`
   (`src/scene.ts:549`).
3. **Cover all three depth regimes:** standard, reverse (`EXT_clip_control`), and
   the `logarithmicDepthBuffer` fallback (`src/scene.ts:547`, for browsers without
   `EXT_clip_control`). `polygonOffset` behaves differently under logarithmic
   depth (in-shader `gl_FragDepth`), so its behavior must be defined and tested,
   not assumed.
4. **Route every consumer through it:** `surfaceRenderPolicy`
   (preview / occluder / photo / MT-threshold / section-iso),
   `terrain/terrainStyleController`, `loaders/loadSceneOverlays`,
   `loaders/loadDcipAnomaly`, and the `SceneManager` line offset. Acceptance
   gate: zero raw `polygonOffset` literals outside the policy module (the
   six-file search becomes the gate).
5. **`depthFunc` stays engine-handled** — do not negate it manually (§10/§11).
6. **Guard:** a unit test asserting the intent→offset mapping per depth mode,
   plus a render-level check across projects (gravel pit + Utah FORGE), so the
   next depth-mode change cannot silently reintroduce this.

Why universal, not a patch: it fixes the gravel pit, the latent cosmetic glitches,
and any future project/layer at once — correct by construction in whatever depth
mode is active — instead of re-tuning one site for one mode. Utah FORGE is
preserved because its MT / section-iso intent is unchanged in reverse-Z (its
working mode); the gravel pit is fixed because the occluder's "behind the surface"
intent is finally honored regardless of convention.

---

## 13. Decision + deep-fix spectrum (best practice)

Decision (owner, 2026-06-20): the gravel-pit ground surface does **not** need to
be transparent. That unlocks the correct fix (opaque substrate) instead of a
sign-flipped `polygonOffset` band-aid.

Why a `polygonOffset`-sign policy alone is still a band-aid: it keeps two
patterns a reviewer would flag — using `polygonOffset` (a coplanar-shimmer tool)
as a **load-bearing draw-order mechanism**, and rendering a **ghost occluder
mesh** to fake depth for a transparent surface.

Root-of-root:
- (a) draw order encoded as convention-specific magic numbers (`polygonOffset`
  signs) scattered across feature code;
- (b) a ghost-occluder crutch for transparent surfaces;
- (c) the organizational lapse — a global rendering-convention change (reverse-Z)
  shipped without auditing depth-dependent code and with zero render tests.

Spectrum (depth of fix vs. blast radius):

| Level | What | Reviewer verdict | Blast radius |
|---|---|---|---|
| 0 Patch | flip the one occluder offset sign | band-aid | gravel pit only |
| 1 Offset policy | centralize offset signs per depth mode | tidy band-aid | ~6 offset sites |
| 2 Compositing contract | order via opaque/transparent + `renderOrder`; offsets only for shimmer; remove occluder | correct / idiomatic | scene render-order model (all projects) |
| 3 OIT | order-independent transparency | principled / heavy | renderer-wide |

Chosen now: a **Level-2-aligned fix scoped to the gravel pit only** (opaque
substrate, no occluder, decal drape) — correct for this layer, not a band-aid,
and it sets up the general contract. The full Level-2 generalization + the
process fix are deferred (see §15).

---

## 14. Interim fix applied (2026-06-20) — gravel-pit-scoped

Two gravel-pit-exclusive edits (no shared Utah / transition code changed):

1. `src/scene/layerLoaders.ts` — `shahbazi-split-surface-preview` loader:
   - Dropped `depthPolicy: "depth-occluding-preview"` from both `loadMeshPreview`
     calls → no depth occluder is created.
   - Post-process the two surface meshes to OPAQUE: `transparent=false`,
     `depthWrite=true`, `opacity=1`, `polygonOffset=false`,
     `userData.forceTransparent=false`. The opaque surface writes its own depth
     and is depth-convention-agnostic; the invertible occluder is gone.
2. `src/loaders/surfaceRenderPolicy.ts` — `createPhotoOverlayMaterial`
   (gravel-pit-exclusive; only `loadPhotoOverlayPreview` uses it):
   - Removed the load-bearing `polygonOffset` (was `-16`, inverted under
     reverse-Z). The drape now relies on its geometric clearance lift
     (`surfaceClearanceM`, applied in `makePhotoGeometry`) + `renderOrder` +
     depthTest against the opaque substrate. Removed the now-unused
     `polygonOffsetFactor/Units` from `PHOTO_OVERLAY_PREVIEW_POLICY`.

Why safe for Utah FORGE: the shared `createSurfacePreviewMaterial` and the MT /
section-iso paths are untouched. Material instances are per-mesh / per-call, so
mutating the gravel-pit instances cannot affect Utah's. The occluder and the
photo material are gravel-pit-exclusive.

Why safe for transitions: the removed occluder was `ignoreLayerStyle` (already
skipped by the transition / opacity system); `polygonOffset` is not part of
transition timing. The opaque surface still participates in opacity tweens via
the normal path.

Verification (this session):
- `tsc -b` clean.
- `check:workspace` pass; transition + scene-section source suite 38/38;
  `transition-page-agnostic-source` 3/3. (An earlier run flagged that guard
  because a comment contained the literal `01_issue` folder token, which matches
  its `\d{2,3}_[a-z]` disposable-page pattern — reworded to drop the numbered
  folder path; now green. Lesson: keep numbered issue-folder paths out of
  `src/{editor,pages,scene}` comments.)
- Gravel pit scene-graph: surfaces `transparent:false / depthWrite:true /
  opacity:1 / polygonOffset:false / forceTransparent:false`; occluders = 0;
  photo overlays `polygonOffset:false`.
- Gravel pit visual: ground surface renders solid + lit with the UAV photo
  imagery draping correctly (was all-black before).
- Utah FORGE no-regression: 10 shared-material MT meshes still `transparent`,
  occluders = 0, MT-threshold path intact; Utah renders clean (terrain + NAIP
  drape + MT cells legend).

Caveat: visual confirmation succeeded this session, but the backgrounded
preview's screenshot tool is intermittent on heavy scenes — a foreground run
remains the gold standard before sign-off.

---

## 15. Future Work (MAJOR — next session): the durable / process fix

The interim fix restores the gravel pit and is safe, but the **latent inverted
offsets remain** in the other (currently cosmetic) sites until the general fix
lands. This is the part that makes it review-proof rather than a workaround:

1. **Generalize to the Level-2 compositing contract** across ALL layers: order
   via opaque/transparent separation + `renderOrder`; reserve `polygonOffset` for
   true coplanar shimmer only (tiny, sign-robust); remove / justify every ghost
   occluder. Consumers to migrate: `surfaceRenderPolicy` (remaining preview / MT /
   section-iso), `terrain/terrainStyleController`, `loaders/loadSceneOverlays`,
   `loaders/loadDcipAnomaly`, the `SceneManager` line offset.
2. **Single owner for the depth convention:** `scene.ts` already computes
   `depthBufferMode` — make it the documented source of truth, and add a rule
   that any global rendering-state change requires a depth-dependent-code audit.
3. **Render tests:** add a gravel-pit render spec (currently zero coverage) and
   create the missing `tests/utah-forge/mt-rendering.spec.ts` (referenced by
   `test:utah:mt` but absent). The reverse-Z flip should have failed a test on
   day one.
4. **Data-side:** fix the baked image-104 projection artifact (a triangle
   stretched to z≈0.12) in the gravel pit photo-overlay manifest.

---

## Session Entries

### 2026-06-20 — initial investigation (CLAUDE)
- Identified affected project/layers; ruled out data/load/visibility/geometry/
  material causes via scene-graph inspection.
- Discovered `reverseDepthBuffer === true`; traced to commit `3c46a48`.
- Completed blast-radius mapping (Rings A/B/C), transition isolation, guard
  inventory + gap. Fix not applied; awaiting direction.

### 2026-06-20 — engine-behavior confirmation + universal-remediation design (CLAUDE)
- Confirmed from installed `three@0.169.0` source that r169 auto-corrects
  `depthFunc` but NOT `polygonOffset` under `reverseDepthBuffer` (§10).
- Withdrew the earlier "`depthFunc` is a second broken class" framing — the
  engine handles it; remediation centers on `polygonOffset` only (§11).
- Recorded the universal remediation design (intent-based depth policy owning
  `polygonOffset` sign + per-mode magnitude across standard / reverse /
  logarithmic modes, single source of truth at `scene.ts:549`, all consumers
  routed through it, per-mode + cross-project guard) as PREFERRED over the
  Ring-A-only patch in §7 (§12).
- Still no code changed. Awaiting direction to implement the policy module.

### 2026-06-20 — interim fix applied + verified (CLAUDE)
- Owner decided the gravel-pit surface need not be transparent → applied the
  Level-2-aligned, gravel-pit-scoped interim fix (§14): opaque depth-writing
  substrate (no occluder) in `layerLoaders.ts`; photo drape relies on geometric
  lift + renderOrder (load-bearing `polygonOffset` removed) in
  `createPhotoOverlayMaterial`.
- Verified: tsc clean; check:workspace pass; transition/scene-section suite
  38/38; page-agnostic guard 3/3; gravel pit surfaces + photo drape restored
  (scene-graph + visual); Utah FORGE unaffected (scene-graph + visual).
- Recorded the decision + deep-fix spectrum (§13) and the MAJOR deferred
  durable/process fix (§15) for a later session.

### 2026-06-21 — black backdrop/void: root cause = color grade, not reverse-Z (CLAUDE)
- New report: gravel-pit data renders fine but the empty backdrop/void reads
  pure black instead of the authored dark-gray look. Confirmed user-side as
  "only the backdrop/void," not the whole frame.
- METHOD CORRECTION worth keeping: this preview tab is hidden/`0×0`, so a single
  forced-size + synchronous `composer.render()` + `gl.readPixels()` IN ONE eval
  yields reliable pixels even though the idle rAF screenshot path does not. That
  numeric readback is what overturned the first hypothesis below.
- FIRST HYPOTHESIS (WRONG, reverted): three's stock `SSAOShader.js:131` guard
  `if ( depth == 1.0 )` assumes the standard cleared-depth value; reverse-Z
  flips it to `0.0`, so the guard misses the void. A reverse-Z-gated shader
  patch was applied in `src/scene/postprocessing.ts`, but a controlled readback
  proved SSAO contributes ~nothing here: toggling SSAO off left the void
  unchanged (`[0,0,0]` → `[0,0,0]`). The patch was REVERTED to keep the change
  set scoped. (The guard is still technically wrong under reverse-Z, but its
  effect is masked because the grade has already crushed the void to 0 by the
  time AO would apply — logged as a latent, non-load-bearing item, not fixed.)
- ACTUAL ROOT CAUSE (color management, NOT a depth-buffer bug): the cinematic
  `LensGradePass` runs `c = (c - 0.5) * contrast + 0.5` on LINEAR HDR values
  (the composer's intermediate RTs are linear; `OutputPass` does sRGB at the
  end). A dark scene background is ~0.02 linear — far below the 0.5 pivot — so
  contrast (1.11 here) drives it below zero (`max(c,0)` → black) before the
  vignette even applies. Bright geometry sits near/above the pivot, so it is
  pushed up and looks fine — exactly "data fine, void black," and it is global
  (Utah's void crushes the same way; only the open-void gravel pit makes it
  obvious). The homepage backdrop looks right only because it is pure CSS with
  no grade. Decomposed numerically on case-study-b: direct bg `[38,41,45]`;
  composer baseline `[0,0,0]`; contrast=1.0 → `[9..]`; SSAO/bloom off → no
  change; the contrast term is the dominant crusher.
- FIX (owner chose gravel-pit-only/quick): author the project grade to lift the
  shadows so the void reads dark-gray with the vignette supplying the gradient.
  `projects/case-study-b/environment.json` `scene.colorGrade` += `lift: 0.06`.
  NOTE: `blackPoint` would have been the cleaner (highlight-preserving) knob but
  `applyEnvironment.ts` clamps `blackPoint` to `[0, 0.8]`, so a negative
  (shadow-lifting) value is impossible via data; `lift` is clamped `[-0.5, 0.5]`
  and works. Scope: project-level look authoring only — no page/fixture edits,
  no Utah/capture/global render change.
- Verified by readback after a RELOAD (persisted value, not a live uniform):
  `persistedLift:0.06`; void `[42]` center / `[35]` corners (was `[0,0,0]`) —
  dark-gray + vignette gradient, ≈ homepage (46→21); data mild lift
  `[146]`→`[163]`. `check:workspace` pass; `postprocessing.ts` reverted clean.
- For §15 render-tests work: the real guard to add is "dark scene background is
  not crushed to black by the grade" (a backdrop luminance floor) across
  projects — the SSAO-vs-depth-mode note is secondary/latent.

### 2026-06-21 (cont.) — grade `lift` rejected; depth-masked backdrop pass shipped (CLAUDE)
- Owner feedback on the `lift: 0.06` fix: it reads as a wash OVER the scene
  objects (lift adds to every pixel, not just the void) and the gradient is
  RINGED (the vignette's radial ramp bands on near-black). Correct read — any
  grade-side knob is the wrong tool: the grade is a fullscreen pass over the
  whole frame, so it cannot put a backdrop BEHIND the objects, and the vignette
  banding is inherent. The `lift` edit was REVERTED.
- Shipped fix — a real backdrop composited AFTER the grade, behind geometry:
  new `backdropShader` + `backdropPass` in `src/scene/postprocessing.ts`, added
  as the FINAL composer pass (after `OutputPass`, so it writes display/sRGB).
  It reads scene depth and repaints ONLY empty-background pixels (cleared
  far-plane depth) with a smooth, dithered radial gradient mirroring the landing
  page (`#2e302f`→`#1f201f`→`#151819`, center 55%/58%). Geometry pixels pass
  through untouched, so the backdrop is BEHIND the objects, never graded, and not
  ringed (dither kills 8-bit banding). It lives in the composer, so capture
  output matches live. Gated by `SceneProperties.gradientBackdrop` (+ skipped in
  light mode); passthrough for every other project.
- Depth source gotcha (important): attaching a shared `DepthTexture` to the
  EffectComposer's two ping-pong RTs does NOT work — fullscreen post passes
  write depth and clobber it (debug readback showed depth==1.0 everywhere). The
  pass instead reads `ssaoPass.normalRenderTarget.depthTexture` — SSAO's own
  per-frame scene-depth render, which is a dedicated target (not ping-ponged)
  and reverse-Z-correct. Dependency: the backdrop is only enabled where SSAO is
  on (true for the gravel pit). `clearedDepth` uniform = 0 under reverse-Z, else
  1.
- Enabled for the gravel pit: `projects/case-study-b/environment.json`
  `scene.gradientBackdrop: true`.
- Verified by reload readback (persisted, post-grade, real pixels): void corners
  `[21,24,25]` (= `#151819`) → center `[43,45,44]` (toward `#2e302f`); top-row
  sweep ramps smoothly with max adjacent step 2 (dither only → NO rings); data
  center `[146,148,151]` byte-identical to baseline (geometry untouched). `tsc`
  clean; `check:workspace` + `check:startup-console` PASS (root + utah-direct 0
  errors → Utah unaffected, passthrough).
- KNOWN CAVEAT (not handled): the backdrop gradient is screen-space and not
  tile-remapped, so a TILED 8K capture of the gravel pit would seam the gradient
  per tile (same class the vignette solved via `uTileOffset`/`uTileScale`). Live
  + single-frame capture are fine. Add the tile remap if gravel-pit tiled
  capture is ever needed.

### 2026-06-21 (cont.2) — backdrop mask switched depth → coverage (CLAUDE)
- Owner feedback: the depth-masked backdrop erased the drone-path lines and
  telemetry triangles WHERE THEY CROSS THE VOID. Cause: depth came from
  `ssaoPass.normalRenderTarget`, and SSAO only renders meshes — line/point/
  overlay geometry (and anything depthWrite=false) is absent from that depth, so
  those void pixels read as cleared far-plane and got repainted.
- Fix: replaced the depth mask with an ALPHA COVERAGE mask. New
  `SceneCoverageMaskPass` (a `Pass`, added right after RenderPass, enabled only
  with the backdrop) re-renders the whole scene into an offscreen RGBA target
  cleared to alpha 0, with `scene.background` temporarily nulled (otherwise the
  background clear would stamp alpha 1 everywhere and disable the backdrop). Any
  drawn pixel — mesh, line, point, sprite, depthWrite=false overlay — stamps
  alpha; the empty void stays alpha 0. The backdrop pass reads `tMask.a` and
  `mix(gradient, scene, smoothstep(0.04,0.6,drawn))` so AA edges/thin lines
  feather instead of leaving a fringe. Cost: one extra scene draw per frame, but
  only for the opted-in (gravel pit) project; passthrough + no mask render for
  everything else.
- Verified by readback: true void corner `[20,23,24]` / mid `[30,31,30]`
  (gradient) vs backdrop-off `[0,0,0]`; red telemetry markers (e.g.
  `[209,88,87]`,`[215,94,92]`) present in BOTH backdrop-on and -off void scans
  (preserved, not erased); ~2029 bright/colored void pixels survive with the
  backdrop on. `tsc` clean; `check:workspace` + `check:startup-console` PASS
  (utah-direct 0 errors). Net change ~174 lines across postprocessing.ts (pass +
  shader), applyEnvironment.ts (enable hook), types.ts (`gradientBackdrop`),
  case-study-b environment.json (flag on).
