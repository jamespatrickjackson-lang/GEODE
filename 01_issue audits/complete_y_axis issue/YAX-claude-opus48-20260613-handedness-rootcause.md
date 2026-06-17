# Y-Axis Section Frame — Root-Cause Findings

- **Report ID:** `YAX-CLAUDE-OPUS48-20260613-01`
- **Author agent:** Claude Code (Opus 4.8)
- **Date (UTC):** 2026-06-13
- **Repo:** `C:\GeoSee\GeoSee_Dev` — branch `main`, baseline commit `035e3a8` (findings reflect uncommitted working-tree edits noted in §10)
- **Status:** Root cause identified, fixed, and verified live. **A section-data purge/rebuild is NOT required.**
- **Severity:** High (visual correctness of every Y-axis section frame) / Low blast radius (single matrix construction).

---

## 1. TL;DR (verdict)

The Y-axis section **frame helper** (outline rectangle, push/pull cones, axis ticks/labels/headings, ground trace) rendered in the **wrong plane** — lying in the world X-Y plane (coincident with the Z frame, 90° from the real Y cut).

Root cause: a single matrix construction in `rebuildSceneSectionHelpers` builds the helper-group orientation with
`Matrix4.makeBasis(tangentA, tangentB, normal)` followed by `Quaternion.setFromRotationMatrix`. For the **Y axis only**, the resolved basis triple `(axisA, axisB, normal)` is **left-handed** (`axisA × axisB = −normal`), so `makeBasis` produces a **reflection (determinant −1)**. `setFromRotationMatrix` cannot represent a reflection; it silently produced a wrong rotation that mapped the helper's local +Z to world **+Z** instead of world **+Y**.

The section **clip** (the actual cut applied to data / MT volume) was always correct, because clipping uses the plane normal directly and is handedness-agnostic. Only the **helper visuals** were wrong. Therefore the authored section data is correct and re-authoring would never have fixed it.

Fix: derive the third `makeBasis` column from `tangentA × tangentB` (always right-handed). X and Z are unaffected (already right-handed); only Y is corrected. `tangentA`/`tangentB` are untouched, so all world-space helper positions and the separately-passed true normal remain correct.

---

## 2. Symptoms (reproduction pages)

Two authored diagnostic pages (disposable fixtures, used as reproduction evidence only):

| Page file | Title | Active section state |
|---|---|---|
| `projects/utah-forge/pages/180_page.json` | **Y issue 1** | only Y plane enabled (pos 10492.84) |
| `projects/utah-forge/pages/181_page.json` | **Y issue 2** | X, Y, Z all enabled |

Reported visuals:
- **Y issue 1:** the Y cut frame's parts render at 90° to each other / to the cut, when they should be coplanar with the cut.
- **Y issue 2:** the Z (yellow) and Y (blue) frames render on the **same** plane, when the Y plane and Z plane must be perpendicular.

Both pages author the **X** frame with `axisAlignment: cardinal`, `axisDatum: latlon`; Y and Z use UTM defaults. (This is not causal — see §6 — but is noted for completeness.)

---

## 3. Investigation method

Live runtime introspection against a dev server serving the canonical repo (`npm --prefix C:/GeoSee/GeoSee_Dev run dev`, driven by the preview MCP). The app exposes:
- `window.__pageController` — `goto(index)`, `getState()`.
- `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` — the live `SceneManager`, including `sceneSectionRuntime` (the helper group), `lastSceneSectionStyle`, and the resolver methods (`resolveSceneSectionFrames`, `sceneSectionBounds`, etc.).

Key technique: **per-axis world bounding box of the rendered helper meshes**, grouped by `userData.sceneSectionAxis`. A section frame for axis A lies in the plane perpendicular to A, so its world bbox is **flat (≈0 extent)** along A. The flat dimension therefore reveals which plane each frame physically occupies — independent of any code assumptions.

---

## 4. Evidence

### 4.1 Resolved frame basis is CORRECT (data is fine)

`resolveSceneSectionFrames(style, bounds)` on page 181 (rounded):

| axis | normal | axisA | axisB |
|---|---|---|---|
| x | (1, 0.027, 0) | (−0.027, 1, 0) | (0, 0, 1) |
| y | **(0, 1, 0)** | (1, 0, 0) | (0, 0, 1) |
| z | (0, 0, 1) | (1, 0, 0) | (0, 1, 0) |

Y normal = (0,1,0), Z normal = (0,0,1): distinct, perpendicular, exactly as authored. (X carries the slight cardinal-convergence tilt of 0.027, expected.) **The resolved geometry is correct — the fault is downstream of resolution.**

### 4.2 Rendered helper mesh world bbox — BEFORE fix (the bug)

Per-axis world bbox extent `[X, Y, Z]` of `sceneSectionRuntime` meshes (page 181):

| axis frame | world extent [X, Y, Z] | flat axis | expected | correct? |
|---|---|---|---|---|
| x | [1801, 65644, 32451] | **X** | X | ✓ |
| **y** | [128647, 48517, **0**] | **Z** | Y | ✗ — lies in X-Y plane |
| z | [135270, 60830, **0**] | **Z** | Z | ✓ |

The Y frame is **flat in Z** (X-Y plane) — physically coincident with the Z frame's plane. This is the bug, and it directly explains both reported symptoms.

### 4.3 Orientation math — the smoking gun

For each resolved basis, computing `det = determinant([axisA | axisB | normal])` and where the resulting quaternion sends the helper's local +Z `(0,0,1)`:

| axis | axisA × axisB | normal | det of makeBasis(A,B,N) | local +Z maps to (current) | local +Z maps to (fix: third = A×B) |
|---|---|---|---|---|---|
| x | (1, 0.027, 0) | (1, 0.027, 0) | **+1** | (1, 0.027, 0) = X | (1, 0.027, 0) = X |
| **y** | **(0, −1, 0)** | (0, 1, 0) | **−1** (reflection) | **(0, 0, 1) = Z** ✗ | (0, −1, 0) = −Y ✓ |
| z | (0, 0, 1) | (0, 0, 1) | **+1** | (0, 0, 1) = Z | (0, 0, 1) = Z |

For Y, `axisA × axisB = (0,−1,0) = −normal`: a **left-handed** triple. `makeBasis` det = −1 (reflection). `setFromRotationMatrix` maps local +Z to world **Z** (the bug). With the cross-product third column, det = +1 (proper) and local +Z maps to −Y, placing the rectangle in the correct X-Z plane.

### 4.4 Rendered helper mesh world bbox — AFTER fix (corrected)

| axis frame | world extent [X, Y, Z] | flat axis | expected | correct? |
|---|---|---|---|---|
| x | [1801, 65644, 32451] | X | X | ✓ (unchanged) |
| **y** | [128647, **0**, 48517] | **Y** | Y | ✓ (was Z) |
| z | [135270, 60830, 0] | Z | Z | ✓ (unchanged) |

Y now lies in the X-Z plane. Visual confirmation (page 181): red (X), blue (Y), yellow (Z) frames render in three mutually-perpendicular planes; Y and Z are no longer coplanar.

---

## 5. Root-cause analysis

### 5.1 The defective construction

`rebuildSceneSectionHelpers` (`src/scene/section/sceneSectionController.ts`, the per-plane loop; pre-fix near line 3590) built the helper group orientation:

```ts
const basisNormal = plane.normal.clone().normalize();
const planeBasis = new THREE.Matrix4().makeBasis(tangentA, tangentB, basisNormal); // <-- left-handed for Y
const planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(planeBasis); // <-- mangles a reflection
```

`tangentA`/`tangentB` come from the resolved frame (`frame.axisAVector` / `frame.axisBVector`), `basisNormal` from `plane.normal`.

### 5.2 Why the basis is left-handed for Y

The default per-axis basis is hand-coded in `sceneSectionBasisVectors` (line 1558):

```ts
if (axis === "x") return { normal: east,  axisAVector: north, axisBVector: up };   // north × up  = east  = +normal (RH)
if (axis === "y") return { normal: north, axisAVector: east,  axisBVector: up };   // east  × up  = -north = -normal (LH)
return                  { normal: up,    axisAVector: east,  axisBVector: north }; // east  × north = up   = +normal (RH)
```

For Y, `axisA=east(X)`, `axisB=up(Z)`, and `east × up = X × Z = −Y = −north = −normal`. X and Z are right-handed; Y is the unique left-handed case. This is intrinsic to choosing "A = horizontal (east)" and "B = up" for a plane whose normal is +north.

### 5.3 Why the reflection corrupts the quaternion

`THREE.Quaternion.setFromRotationMatrix` assumes a pure rotation (orthogonal, determinant +1). Given a determinant −1 matrix, it does not error — it computes a quaternion from the trace/diagonal that does **not** reproduce the reflection, yielding an unrelated rotation. Empirically (4.3) that rotation maps the helper's local +Z to world +Z for Y, dropping the helper rectangle (built in local A–B with local +Z as its normal) into the world X-Y plane.

### 5.4 Why the CLIP was unaffected

The section clip is applied as plane equations / shader uniforms keyed on `plane.normal` and `positionM` (`sceneSectionClippingPlanes`, `sceneSectionFrameClippingPlanes`, `setSceneSectionUniforms` at line 2375). A plane equation is invariant to basis handedness, so the cut on data and the MT volume was always geometrically correct. **Only the studio helper visuals consumed the mangled `planeQuaternion`.**

---

## 6. Blast radius

`planeQuaternion` is the orientation for the **entire** per-frame helper group. Confirmed consumers in `rebuildSceneSectionHelpers`:

- frame **outline** mesh (control group quaternion);
- push/pull **cone handles** (children of the control group — inherit the quaternion);
- axis **labels**, **A/B headings**, **scale ticks** (planar-text orientation);
- **ground trace** group.

All of these were mis-oriented for Y, and all are corrected by the single orientation fix. Note: helper **positions** (label/tick/heading world placement) are computed directly from `planeCenter + tangentA·a + tangentB·b` and were already correct; only orientation was wrong.

Cardinal/latlon authoring on the X frame (§2) is **not** causal: X is right-handed regardless of alignment, and the bug is specific to the Y handedness.

---

## 7. The fix (applied)

`src/scene/section/sceneSectionController.ts`, `rebuildSceneSectionHelpers` (now near line 3603):

```ts
const basisNormal = plane.normal.clone().normalize();
// Derive the third column from tangentA x tangentB so makeBasis always gets a
// right-handed (proper) basis. The resolved (tangentA, tangentB, normal) triple
// is left-handed for the Y axis (tangentA x tangentB = -normal); feeding the raw
// normal made makeBasis a reflection (det -1), which setFromRotationMatrix
// mangles -- dropping the Y helper group into the X-Y plane. (DEC-165)
const orientationNormal = new THREE.Vector3()
  .crossVectors(tangentA, tangentB)
  .normalize();
const planeBasis = new THREE.Matrix4().makeBasis(tangentA, tangentB, orientationNormal);
const planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(planeBasis);
```

**Properties of the fix:**
- X and Z bases are already right-handed → `tangentA × tangentB` equals their normal → behavior byte-identical.
- Y becomes proper (det +1) → correct plane.
- `tangentA`/`tangentB` untouched → all world-space positions and the true normal (`basisNormal`, still passed separately to camera-aware text for facing) unchanged.
- For Y, the helper's local +Z now faces −Y. The outline is a flat double-sided mesh and the handles are symmetric double-arrows, so facing sign is cosmetically irrelevant; text facing is corrected by the camera-aware path using the true `basisNormal`.

---

## 8. Verification

- **Live (page 181):** Y frame world bbox flat-in-Z → **flat-in-Y** (§4.4); X/Z unchanged; visual shows three perpendicular frames.
- **Typecheck:** `npx tsc --noEmit` clean.
- **Tests:** `tests/tools/scene-section-frame-orientation-source.test.mjs` (new) proves the Y basis is left-handed (det −1) and the cross-product third column is always proper (det +1), and source-locks the fix; plus existing section suites. 20/20 pass across orientation + partition + helper-transition tests.
- **Validator:** `node tools/validate-project-pages.mjs` → OK.
- **Decision log:** `docs/03-decisions.md` → **DEC-165**.

---

## 9. Latent issue (recommended, deferred)

`sceneSectionBasisVectors` (default basis, line 1558) is left-handed for Y, whereas the source-face path `sceneSectionOrthonormalSourceBasis` (line 1605) derives `axisB = normal × axisA` and is right-handed. The two basis producers are inconsistent.

A "proper" fix would make `sceneSectionBasisVectors` right-handed for Y. However, that flips Y's `axisB` sign, which **reinterprets authored B-extents and B-positions** for existing Y frames (data-affecting). It is therefore **deferred**; the orientation-matrix fix resolves the rendered symptom without touching authored data. DEC-165 records the latent issue and adds a guard: **any `makeBasis` fed a frame basis must guarantee a right-handed triple.**

---

## 10. Working-tree state (uncommitted at time of report)

This report's fix plus prior in-flight transition work are present but not committed:

- **This report's Y fix:** `src/scene/section/sceneSectionController.ts` (orientation), `docs/03-decisions.md` (DEC-165), `tests/tools/scene-section-frame-orientation-source.test.mjs`.
- **Per-frame section transition (DEC-164, separate concern):** `src/scene/transitions/sceneSectionFrameSignature.ts` (new), `transitionStyles.ts`, `transitionEffectiveLayersForPage.ts`, `layerTweenRuntime.ts`, `SceneManager.ts`, `sceneSectionController.ts`, `tests/tools/scene-section-frame-partition-source.test.mjs`.
- **Camera clamp (DEC unrelated):** `src/pages/dynamicCameraPose.ts`, `tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs`.
- **No-op page-override strip:** 25 page JSONs under `projects/utah-forge/pages/`.

---

## 11. Code reference index (`src/scene/section/sceneSectionController.ts`, as of working tree)

| Symbol | Line | Role |
|---|---|---|
| `SCENE_SECTION_AXIS_SPECS` | 78 | per-axis positionIndex/frameAIndex/frameBIndex — correct |
| `sceneSectionBasisVectors` | 1558 | default per-axis basis — **left-handed for Y (latent, §9)** |
| `sceneSectionOrthonormalSourceBasis` | 1605 | source-face basis — right-handed (consistent target) |
| `resolveSceneSectionFrames` | 2069 | resolves frame basis/center/extents — output correct (§4.1) |
| `setSceneSectionUniforms` | 2375 | clip uniforms — handedness-agnostic, always correct (§5.4) |
| `rebuildSceneSectionHelpers` | 3426 | helper construction; the `makeBasis` orientation (line ~3603) — **fix site (§7)** |
| `applySceneSectionPlanes` | 4133 | applies clip + drives helper rebuild |

---

## 12. Recommendation summary

1. **Do not purge/rebuild section data.** The data and the clip are correct; the defect was one reflection in one matrix.
2. **Keep the orientation fix (§7) + DEC-165 guard + regression test.**
3. **Optionally** schedule the latent default-basis fix (§9) only alongside an authored-extent migration, since it changes Y `axisB` semantics.
4. **For future Y-frame regressions**, use the per-axis world-bbox flat-axis diagnostic (§3) — it isolates a rendering-orientation fault from a data fault in one measurement.
