# Y-Axis Section — Second Audit & Inconsistency Register

- **Report ID:** `YAX-CLAUDE-OPUS48-20260613-02`
- **Companion to:** `YAX-CLAUDE-OPUS48-20260613-01` (root-cause report)
- **Author agent:** Claude Code (Opus 4.8)
- **Date (UTC):** 2026-06-13
- **Repo:** `C:\GeoSee\GeoSee_Dev` — branch `main` (working-tree edits per report 01 §10)
- **Scope:** Broad second sweep of all scene-section + section-iso code for (a) any *other* cause of the Y wrong-plane symptom, and (b) all inconsistencies ("full house clean").

---

## 1. Headline conclusions

1. **The Y wrong-plane symptom has a single root cause** (the left-handed `makeBasis`, report 01 / DEC-165). A granular per-mesh live check (§3) confirms **every** Y helper sub-mesh — outline, section fill, push/pull cone, both pairs of resize cones — is correctly oriented after the fix. **No other code path produces the wrong-plane symptom.**
2. The section **clip/crop, dashed ribbon, ground trace, and iso overlays are handedness-agnostic** and were never affected (§4).
3. The handedness defect is **systemic in shape, not in count**: the default per-axis basis producer is left-handed for Y while a second producer is right-handed. The applied fix neutralises it at the consumer that crashed (the orientation matrix); two **secondary** consumers assume `planeQuaternion` local +Z = +normal and warrant follow-up hardening (§2, INC-3/INC-4). They are cosmetic/interaction-level, not the reported wrong-plane bug.

---

## 2. Inconsistency register

| ID | Location | Severity | Status | Summary |
|---|---|---|---|---|
| **INC-1** | `rebuildSceneSectionHelpers` `makeBasis` (`sceneSectionController.ts:3605`) | High (visual) | **FIXED** (DEC-165) | Left-handed Y basis → `makeBasis` reflection (det −1) → `setFromRotationMatrix` mangled the quaternion → entire Y helper group rendered in the X-Y plane. Fix: third column = `tangentA × tangentB`. |
| **INC-2** | `sceneSectionBasisVectors` (`:1558`) vs `sceneSectionOrthonormalSourceBasis` (`:1605`) | Medium (latent) | **OPEN (deferred)** | Two basis producers, different handedness conventions: the default per-axis basis is **left-handed for Y** (`east × up = −north`); the source-face path derives `axisB = normal × axisA` and is right-handed. The default basis is the *source* of INC-1. Making it right-handed would flip Y `axisB` sign → reinterpret authored B-extents/positions (data-affecting), so deferred. |
| **INC-3** | `axisBHeadingQuaternion` (`:3963`) | Low (cosmetic) | **OPEN (verify)** | Rotates the B-axis heading text +90° about **local Z**. After INC-1's fix, `planeQuaternion` local +Z = −normal for Y (was +normal for X/Z). The in-plane 90° rotation is therefore mirrored for Y, so the Y B-heading text may read in the reversed in-plane direction. Plane is correct; only text rotation sense is suspect. Recommend rotating about the true normal or deriving heading orientation from `tangentB` directly. |
| **INC-4** | push-pull handle `localDirection (0,0,1)` (`:3809`) + drag handler (`EditorContext.tsx`, `scene.ts`, `SceneManager.ts`) | Low (interaction) | **OPEN (verify)** | The push-pull cone is authored along **local Z**, which is −normal for Y after the fix. The cone is a **symmetric double-arrow**, so the *visual* is correct (verified §3: cone elongated along ±Y). The *drag* delta must be driven by the true plane normal (`getSceneSectionPlaneNormal`, which returns `plane.normal`, handedness-agnostic) — recommend confirming the Y push-pull drag is not inverted. Not traced to ground truth in this pass. |
| **INC-5** | `sceneSectionBasisVectors` hand-coded per-axis triples (`:1576-1582`) | Low (maintainability) | **OPEN (note)** | The basis is enumerated per axis by hand rather than derived (`axisB = normal × axisA`), which is exactly how the left-handed Y case slipped in. Deriving it would remove the class of bug but is the same data-affecting change as INC-2. |

---

## 3. Granular verification — every Y helper mesh (page 180, Y-only)

Per-mesh world bounding box; for planar meshes the **flat axis** = the plane's normal axis; for cones the **largest extent** = the pointing direction.

| Mesh | world extent [X, Y, Z] | interpretation | correct? |
|---|---|---|---|
| `Y Section frame` (outline) | [128647, **0**, 78079] | planar, flat in **Y** → X-Z plane | ✓ |
| `Y Section` (fill/window) | [980, **0**, 260] | planar, flat in **Y** | ✓ |
| push/pull cone (×2 arms) | [1297, **2352**, 1317] | long axis **Y** = normal | ✓ |
| resize-A cones | [**2352**, 1317, 1297] | long axis **X** = tangentA | ✓ |
| resize-B cones | [1297, 1317, **2352**] | long axis **Z** = tangentB | ✓ |

Histogram of "flat axis" across 12 meshes: {X:6, Y:2, Z:4} — the 2 planar meshes are flat in Y (correct); the 10 cones' flat-axis is not meaningful (3-D shapes), but their **length** axes are all correct (push/pull along Y, resize along X and Z). **No residual mis-planed Y mesh.**

Before/after on page 181 (X+Y+Z), from report 01: Y frame world bbox flat-axis **Z → Y**; X and Z unchanged.

---

## 4. Verified consistent / not implicated (the "clean" half of the sweep)

| Area | Location | Finding |
|---|---|---|
| Per-axis index spec | `SCENE_SECTION_AXIS_SPECS` (`:78`) | Correct (x→A=1,B=2; y→A=0,B=2; z→A=0,B=1). |
| Frame resolution | `resolveSceneSectionFrames` (`:2069`) | Output basis correct for all axes (Y normal=(0,1,0)). |
| Frame crop / clip planes | `sceneSectionFrameClippingPlanes` (`:2312`) | Built from `±axisA`/`±axisB` offsets — **handedness-agnostic**; Y crop correct. This is why the *cut* was always right. |
| Clip uniforms | `setSceneSectionUniforms` (`:2375`) | Uses `plane.normal` directly — handedness-agnostic. |
| Dashed intersection ribbon | `buildSceneSectionDashedTraceRibbonGeometry` (`:245`) | Offsets in world space using the true `planeNormal` (passed `basisNormal`); correct. ("ribbon edge thickness" hypothesis cleared.) |
| Ground trace | helper loop (`:4053`, `plane.axis !== "z"`) | World-space; uses true normal; x/y-only is intentional (z is horizontal). |
| Section iso overlay | `isoOverlays/sectionIsoOverlay.ts` | No `makeBasis`/`setFromRotationMatrix`; band side = `direction × normal` from per-segment geometry normals — no handedness trap. |
| Resize handles | `:3817-3840` | Directions local X/Y = tangentA/tangentB — unaffected by handedness. |
| Window feature | `resolveSceneSectionWindow` (`:2284`), uniforms (`:2606`) | x/y only, `windowAxis` 0/1 encoding — intentional and internally consistent. |
| Partition flip-slide (DEC-164) | `sceneSectionFrameSignature.ts` | `frameGeometryIdentity` excludes `invert` by design (flips slide); consistent. |

---

## 5. Recommendations (priority order)

1. **Keep INC-1 fix + DEC-165 + `scene-section-frame-orientation-source.test.mjs`.** Confirmed complete for the reported symptom (§3).
2. **Verify INC-4 (push-pull drag) and INC-3 (B-heading text) on a Y frame** in the editor. Both are low-severity and the geometry is correct; this is a 2-minute visual confirmation, not a blocker.
3. **Harden against the handedness class (addresses INC-2/INC-3/INC-5 together):** make `sceneSectionBasisVectors` derive `axisB = normal × axisA` (right-handed by construction), and at the same time **migrate authored Y-frame B-extents** so positions are preserved. This removes the root inconsistency and lets the orientation code trust local +Z = +normal again (simplifying INC-3/INC-4). It is data-affecting, so schedule it deliberately, not inline. Until then, the consumer-side fix (INC-1) is the safe, complete resolution.
4. **No section-data purge/rebuild.** The data is correct end-to-end; every defect found is in helper rendering math, not authored state.

---

## 6. Method notes (for other agents)

- Live diagnosis via `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` + `window.__pageController` against a dev server.
- Decisive technique: per-axis **world bounding box** of `sceneSectionRuntime` meshes; the flat dimension reveals the plane (planar meshes) and the long dimension reveals the pointing direction (cones). This isolates a rendering-orientation fault from a data fault in one measurement and works without reading the rendering code.
- Handedness check: `det([axisA | axisB | normal])` must be +1; if any axis is −1, `Matrix4.makeBasis` → `Quaternion.setFromRotationMatrix` will silently mangle that axis.
