# MT Surface Transition Salvage — Quarantine Log (2026-06-16)

Status: quarantine working log. Audit + salvage only. No replant to `main` or
to the problematic branches has occurred.

## Scope and branch

- Quarantine worktree: `C:\GeoSee\Claude_WT\GeoSee_Dev\mt-surface-salvage`
- Branch: `claude/mt-surface-salvage`, created off `main` @ `02935eb`.
- `node_modules` is a Windows junction to the canonical repo (dep parity:
  `package.json` and `package-lock.json` byte-identical).
- Held untouched, as directed: `main`, `CODEX_Tansition_002`,
  `CODEX_Tansition_003` (and its dirty working tree in `C:\GeoSee\GeoSee_Dev`).
- CODEX_003's full dirty diff preserved read-only at
  `_QUARANTINE_codex003-reference.patch` (588 lines).

## Reported symptoms (radius)

- `1 -> 16`: background correct during transition, pops to wrong treatment when
  the transition stops (target dark page lands light).
- `20/19 -> 25` and `25 -> 20`: large emissive-yellow MT surface flashes during
  transition; bleeds into the full-density MT cell/point-cloud view.
- `30 -> 31`: MT iso surfaces snap in/out.

## Root-cause findings (the defect in `main`)

1. **MT surface family is doc-ahead-of-code.** DEC-172 (section enter-gate) and
   DEC-173 (source-masked exit snapshot), authored in `docs/03-decisions.md`
   (`65ab78a`), describe both the MT raymarched volume **and** the
   top/threshold/contact surfaces, but the runtime shipped them for
   `UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID` only:
   - `shouldSnapshotScalarVolumeSectionExit` —
     `src/scene/transitions/transitionEffectiveLayersForPage.ts:1311` — volume
     only.
   - `sectionIsoRootSourceLayerIds` — `:1055` — `[VOLUME, SEISMIC]`; surfaces and
     slices/preview excluded.
   - The top/contact surface layer ids are not referenced anywhere in
     `transitionEffectiveLayersForPage.ts`. The surface family falls through to
     `SCENE_SECTION_AFFECTED_LAYER_IDS` membership only
     (`transitionStyles.ts:454`), which triggers a snapshot crossfade only when a
     frame actually dissolves. On active<->inactive section changes the surfaces
     run a bare opacity tween while inactive target section is applied
     immediately, so they render unclipped (full extent) while fading — the
     yellow flash. Emissive material is `0xffffff` (`surfaceRenderPolicy.ts:124`).
2. **DEC-172 volume shader is in, surfaces are not.** `loadScalarVolume.ts`
   (`65ab78a`) adds source/target scene-section mask transition uniforms
   (`sceneSectionTargetAlpha`, etc.) so the raymarched volume enters already
   sectioned. The built-in/material surface path got no equivalent.
3. **Background pop is a final-commit ordering defect.**
   `finalizePageTransitionCommit` (`SceneManager.ts:3389`) runs
   `applyEnvironment(environment)` before `applyPageScene(nextPage)` updates
   `lastEffectivePage`, so the source page's lightMode override is reasserted
   over the target. The env-scene transition lands the correct target during the
   tween; final commit overwrites it.

Symptom -> owner: `25<->20` yellow + `30->31` snap = surface-family gap (1, 2);
`1->16` pop = final-commit ordering (3).

## Intention audit (preserve useful tuning)

- **CODEX_002 (`65ab78a`, archived `02935eb`)** — sound, contract-first,
  test-backed. Authored DEC-169..173 and the supporting Section ISO root
  lifecycle, per-frame partition move-follow (DEC-164/170), env-scene fog
  transition, commit/interruption gates. The protected MT full-density
  scalar/cloud path is intact and is not the bug. Evidence:
  `TRANSITION-PRESERVATION-AUDIT`, `SECTION-ISO-NARROW-EXCEPTION-IMPLEMENTATION-PLAN`,
  `TRANSITION-TUNE-LOG` (all in `00_Transition Tune/`).
- **CODEX_003 (dirty tree)** — provisional, INCOMPLETE fix attempt for the three
  regressions. Its own audits (`MT-BLEED-TRANSITION-AUDIT`,
  `BACKGROUND-LIGHTMODE-REGRESSION-AUDIT`) document that it does not resolve
  `25->20` / `30->31` / `1->16`. Two pieces in it are sound; the rest needs
  rework.

## Salvage performed (quarantine)

Two sound CODEX_003 pieces replanted into the quarantine, in `SceneManager.ts`
only (+67/-16):

1. **Detached source-root snapshot world-matrix capture** in
   `beginSectionIsoOverlayTransition`: bake source world transform, re-parent the
   exit snapshot to the neutral scene, so target application that hides the live
   layer parent cannot drag the fading snapshot.
2. **Live MT threshold surfaces via `createMtThresholdSurfaceMaterial`** +
   masked-opacity helper + `reapplyWorkingAreaFocus()` on attach, so
   runtime-generated surfaces carry the same render-policy/shader-hook metadata
   as loaded surfaces (DEC-173 rehydration prerequisite).

## Verification (quarantine, isolated)

- `tsc -b` -> exit 0 (full-project typecheck, deps via junction).
- `tests/tools/working-area-focus-transition-source.test.mjs` -> pass 2, fail 0.
- `tests/tools/section-iso-transition-smoothing-source.test.mjs` -> pass 13,
  fail 0.
- Change scope confirmed: `SceneManager.ts` only. `main`/`002`/`003` unmoved;
  `003` dirty tree still 8 entries.
- Visual acceptance deferred to the isolated branch server `127.0.0.1:42902`
  after rework. The salvage is enabling infrastructure and is not expected to
  move the visible symptoms on its own.

## Jank audit — encoding / tooling class

- **Line endings: clean.** All radius files CRLF-throughout; the
  `LF will be replaced by CRLF` warnings are normal `autocrlf=true`. The salvage
  preserved CRLF.
- **Stray debug: clean.** No `console.*` / `debugger` / `TODO` / `FIXME` /
  `as any` / `@ts-ignore` in the 002 source changes.
- **Junction command mangled under bash** (`cmd //c` quoting) — one-off, resolved
  via PowerShell. No file artifact.
- **Stray `desktop.ini` broken git refs** — Windows Explorer dropped
  `desktop.ini` into `.git/refs/**`; ~hundreds of `ignoring broken ref`
  warnings on every git call. Hygiene-only; can mask real ref warnings.
- **Branch-name typo** `CODEX_Tansition_002/003` (missing `r`). Cosmetic.

## Jank audit — logic / ownership / maintainability class (deeper)

| # | Severity | Finding | Location | Disposition |
| --- | --- | --- | --- | --- |
| L1 | **High (fixed in quarantine)** | Live MT threshold surfaces lost boundary color. `createMtThresholdSurfaceMaterial` enables `vertexColors:true` (for the loaded mesh-preview path, which supplies a color attribute, `loadMeshPreview.ts:120`), but live `extractRuntimeMarchingCubesGeometry` is position-only (`runtimeMarchingCubes.ts:187`), so diffuse multiplied against an unbound `vColor`. The prior inline material correctly omitted `vertexColors`. | `SceneManager.ts` `ensureLiveMtSurfaceBoundaries` | Corrected: `material.vertexColors = false` + `preserveVertexColors = false` on the live path. **This defect is LATENT in the CODEX_003 dirty tree (`SceneManager.ts:4242`, no disable) — do not replant that tree as-is.** |
| L2 | Medium | Overlapping exit ownership. For an MT volume exiting an active section to a hidden target, `shouldSnapshotScalarVolumeSectionExit` (snapshot crossfade, registers `layerTransitionSnapshots`, `:1397`) and `shouldTweenScalarVolumeExitStyle` (registers `scalarStyleTweens`, `:1381`) can both arm for the same layer id; product-family records discrete-crossfade while a scalar style tween also runs on the opacity-0 live layer. No guard makes them mutually exclusive. Violates the spec's one-assignment-per-entity rule. Currently benign (live opacity -> 0, and gated by whether the volume supports scalar tween). | `transitionEffectiveLayersForPage.ts:1311,1315,1381,1397` | Rework: make snapshot-exit XOR scalar-style-exit explicit. |
| L3 | Medium | Overloaded userData key family — two incompatible meanings per key. `mtVolumeSectionIsoOverlayGroup` / `seismicVolumeSectionIsoOverlayGroup` / `seismicResistivitySectionIsoOverlayGroup` are each set as a boolean self-marker on the overlay GROUP (`= true`) and as a `THREE.Group` reference on the LAYER (`= group`). Read as boolean (`=== true`, `SceneManager.ts:1942`, 003 collector `:2079`) and as Group (`as THREE.Group`, `:2039`). | `volumeCutIsoOverlays.ts:582-583,1209-1210,1237-1238` | Rework: use a distinct key (e.g. `*IsRoot` boolean vs `*GroupRef`) or document the convention at the assignment sites. Functionally correct today. |
| L4 | Low | `this: any` on extracted `*Impl` methods disables type checking of all `this.*` access — precisely where L2/L3 live, which is why tsc does not catch them. | `volumeCutIsoOverlays.ts` and section/SceneManager Impl extractions | Pre-existing; out of scope. Note as the reason static checks miss these. |
| L5 | Low | Cosmetic over-indent of the `applyStyle(...)` second argument (+2 spaces). | `transitionEffectiveLayersForPage.ts:1375` (from 002) | Formatter pass. |

Negative findings (verified clean, recorded to avoid re-checking):

- `applyInactiveTargetSceneSectionAfterLayerSnapshots` is set (`:1196`) and
  consumed (`:1501`) — not a dead flag; correct DEC-173 ordering.
- sceneSectionController frame-follow reposition derefs are guarded by
  `instanceof THREE.Matrix4` (`:4238`) and `THREE.Vector3` (`:4217-4220`) — no
  null-deref hazard.
- The 002-added tween fields (`appliedDiscreteTarget`,
  `sectionIsoMoveFollowSourceStyles`, `sceneSectionHelperTransitionOpacity`) are
  all read, not write-only.
- 003 generic Section ISO root collector uses the boolean overlay-group marker
  correctly (not a correctness bug); its hazard is unconstrained breadth
  (all-layer scan), to be narrowed in rework.

## "Overloaded by design" — definition

The L3 key overloading is **by design**, meaning a deliberate authored choice,
not an incidental consequence of the design or of TypeScript structural typing.
Evidence: the two assignments are adjacent and purposeful —
`volumeCutIsoOverlays.ts:582-583` sets the group's boolean self-marker on one
line and the layer's group reference on the very next line, same key name. A
reader must know which object is in hand (group vs layer) to know the value
type. "By design" here denotes intentional, not good: it is a deliberate
convention that is also a maintainability hazard / design smell. It is therefore
distinct from an accidental type drift, which would be "overloaded due to the
design" (an unintended emergent collision). This case is the former.

**Deliberate intention (system + placement).** The key encodes one relationship
— "the MT-volume Section-ISO overlay group" — discoverable from both ends with
no side registry:

- On the layer (`= group`, `volumeCutIsoOverlays.ts:583`): a downward handle so
  `collectSectionIsoOverlayRootsForTransition` (`SceneManager.ts:2039`) fetches
  the overlay group in O(1) without traversing the layer subtree.
- On the group (`= true`, `:582`): a self-identity flag so tree-walkers
  (layer-snapshot cloning `SceneManager.ts:1942`; 003 ancestor-walk dedup)
  recognize the object as an overlay group and exclude it from layer snapshots /
  double-counting as a transition root.

The value type is the role discriminator (`THREE.Group` = "the target", `true` =
"I am the target"), set atomically at overlay-group creation (`:582-583`). The
intent is legitimate — bidirectional discovery of one parent<->child
association. The smell is encoding two roles in one polymorphic key instead of
two typed keys (e.g. `*OverlayGroupRef` / `*IsOverlayGroup`).

## Diff <-> finding traceability

Diffs in this section = the quarantine working changes in
`src/scene/SceneManager.ts` (the only changed source file; +67/-16). Hunk
anchors are the `git diff` `@@` source-line headers.

| Diff hunk | Change | Tracks to |
| --- | --- | --- |
| `@@ -26` | import `createMtThresholdSurfaceMaterial` | Salvage piece 2 (enabler) |
| `@@ -2143` | detached source-root snapshot: `updateWorldMatrix` + bake `matrixWorld` + `this.scene.add(snapshot)` | Salvage piece 1 |
| `@@ -4154` | `let createdLiveBoundary = false` | Salvage piece 2 (focus-reapply tracking) |
| `@@ -4191` | `createMtThresholdSurfaceMaterial()` + `material.vertexColors = false` | Salvage piece 2; the `vertexColors = false` line = **Finding L1** |
| `@@ -4212` | `applyMtThresholdSurfaceMaterialOpacity(...)` + master/boundary/wireframe userData | Salvage piece 2 |
| `@@ -4225` | `createdLiveBoundary = true` + `reapplyWorkingAreaFocus()` | Salvage piece 2 |

Salvage pieces 1 and 2 are preserved advancements (not jank findings); they are
the DEC-173 infrastructure prerequisites for pending rework items RC1/RC2 below.

**Diffs left unassigned (diff with no finding): none.** Every hunk maps to
Salvage piece 1, Salvage piece 2, or Finding L1.

**Findings left unassigned (finding with no diff yet):**

| Finding | Why no diff | Routing |
| --- | --- | --- |
| RC1/RC2 — MT surface-family enter-gate + exit-snapshot gap (the core bug) | core rework not yet started | rework item 1 |
| RC3 — final-commit env ordering (`1->16` pop) | rework not yet started | rework item 3 |
| L2 — overlapping exit ownership (snapshot + scalar tween) | deferred | rework item 4 (fold into 1) |
| L3 — overloaded `*SectionIsoOverlayGroup` key family | deferred | rework item 2, or doc-only convention note |
| L4 — `this: any` on `*Impl` methods | out of scope | none (note only) |
| L5 — `applyStyle` over-indent | trivial | formatter pass |
| Repo-hygiene — `desktop.ini` broken refs; `CODEX_Tansition` typo | out of scope | separate hygiene task |
| Tooling — bash `cmd //c` junction mangle | resolved via PowerShell | none (no code) |

## Pending rework (held)

1. Generalize the MT surface family `{threshold, top, contact}` through the
   DEC-172 enter-gate and DEC-173 exit-snapshot on the scene-section channel
   (compose, do not overwrite, working-area focus).
2. Replace the unconstrained 003 collector with collection bounded to the
   registered MT/seismic overlay groups plus the explicit surface family.
3. Make final-commit environment landing target-page-aware (after
   `applyPageScene`) and clear/segregate `currentEnvironmentSceneTransitionFrame`;
   land cinematic post/tint with the same terminal target scene.
4. Resolve L2 (mutually exclusive exit owners) as part of (1).

Guards-first; protected-batch + `check:workspace` + `check:visual-qa-clean` +
`build`; visual acceptance only on `127.0.0.1:42902`.

## Replant / rollback criteria

- Replant to `main` only after: rework lands, full protected guard batch green,
  `tsc -b`/`build` clean, and human visual confirmation of `1->16`, `20/19->25`,
  `25->20`, `30->31` on the branch server.
- On failure: `git worktree remove` the quarantine; `main` and the problematic
  branches are untouched, so blast radius is the quarantine alone.
