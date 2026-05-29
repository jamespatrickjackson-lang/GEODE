# Decision Log

This log records the current locked decisions. Earlier decisions are preserved in summarized form and later decisions explicitly supersede older scope where the app has moved on.

## Format

Each decision records:

- considered
- chose
- why
- trade-off accepted
- supersedes, if applicable

## DEC-001 - Renderer: Three.js

**Considered:** Cesium, Three.js, Unreal Engine.

**Chose:** Three.js.

**Why:** GeoSee needs art-directed cinematic presentation control in the browser.

**Trade-off accepted:** No globe, terrain streaming, or georeferencing for free.

## DEC-002 - Hosting: static self-hosted artifacts

**Considered:** managed 3D platforms, hosted tile services, static self-hosted output.

**Chose:** Static self-hosted builds as the target artifact shape.

**Why:** Low cost, portable deliverables, and no platform dependency for alpha demos.

**Trade-off accepted:** GeoSee owns data preparation and scene optimization.

## DEC-003 - Original project model: one project, one presentation

**Considered:** one project per audience, multi-audience from one project.

**Chose:** originally one project = one presentation.

**Why:** The first alpha needed speed and clarity.

**Trade-off accepted:** Duplicated project work for audience variants.

**Superseded in part by:** DEC-028 and DEC-030.

## DEC-004 - Provenance: manual metadata, no workflow engine

**Considered:** full approval workflow, manual metadata.

**Chose:** manual provenance metadata and source notes.

**Why:** Provenance discipline matters immediately; workflow automation can wait.

**Trade-off accepted:** Human review remains outside the app.

## DEC-005 - Overlay charts: images first

**Considered:** rendered chart engine, static images.

**Chose:** images and markdown first.

**Why:** Faster for alpha, enough for current narrative panels.

**Trade-off accepted:** Chart updates are manual.

## DEC-006 - Video export target: scripted browser capture

**Considered:** browser MediaRecorder, headless capture, offline film pipeline.

**Chose:** scripted browser capture as future alpha export path.

**Why:** Deterministic and close to presenter output.

**Trade-off accepted:** Not a full cinematic offline render pipeline.

## DEC-007 - Original audience modes decision: defer

**Considered:** audience-mode multiplexing in alpha.

**Chose:** defer persistent audience-mode authoring.

**Why:** Too much early data-model and UI complexity.

**Trade-off accepted:** No persistent multi-audience authoring model yet.

**Superseded in part by:** DEC-030.

## DEC-008 - Storage: local working tree with external backup

**Considered:** synced-drive working tree, local working tree.

**Chose:** local working tree.

**Why:** Active node/build workflows are unreliable in synced folders.

**Trade-off accepted:** Backup/sync is operational, not automatic project storage.

## DEC-009 - Repo root directly in working folder

**Considered:** nested wrapper folder, direct repo root.

**Chose:** direct repo root.

**Why:** Simpler paths and fewer wrappers.

**Trade-off accepted:** None material.

## DEC-010 - Documentation pattern

**Considered:** one large readme, routed docs.

**Chose:** short router docs plus detailed docs and decision log.

**Why:** Keeps handover context manageable.

**Trade-off accepted:** More docs to maintain.

## DEC-011 - Original supported formats

**Considered:** proprietary native importers, basic open formats.

**Chose:** open/prepared project files first.

**Why:** Alpha work should avoid vendor importer projects.

**Trade-off accepted:** Data is prepared outside the app.

## DEC-012 - CRS: one project basis

**Considered:** mixed CRS handling inside a project, one conformed basis.

**Chose:** one conformed project basis.

**Why:** Simpler and safer for current alpha.

**Trade-off accepted:** Preprocessing handles CRS alignment.

## DEC-013 - App framework: React

**Considered:** Svelte, React.

**Chose:** React.

**Why:** Fastest reliable implementation path for this repo.

**Trade-off accepted:** Some larger UI files and more boilerplate.

## DEC-014 - Alpha framing

**Considered:** build directly to v1, build an alpha probe.

**Chose:** alpha probe.

**Why:** The service/product shape should be learned from real demos.

**Trade-off accepted:** Some alpha code will be refactored or replaced.

## DEC-015 - Woodjam first

**Considered:** multiple first demos.

**Chose:** Woodjam as first reference project.

**Why:** Real public exploration data and a credible reference story.

**Trade-off accepted:** First reference was exploration-scale, not high-fidelity site-scale.

## DEC-016 - Woodjam narrative guardrail

**Considered:** unsupported Three Firs drilling, vectoring narrative, later data acquisition.

**Chose:** narrative constrained to supportable public data.

**Why:** Do not show falsifiable or unsupported drilling geometry.

**Trade-off accepted:** Some chapters are visually thinner until source data exists.

## DEC-017 - Hosting target: Cloudflare Pages

**Considered:** Cloudflare Pages, S3/CloudFront, Netlify.

**Chose:** Cloudflare Pages as preferred static target.

**Why:** Fast alpha deployment with minimal overhead.

**Trade-off accepted:** Light provider coupling.

## DEC-018 - Build model: solo with AI coding support

**Considered:** contractor, mixed team, solo with AI support.

**Chose:** solo with AI coding support for alpha.

**Why:** Lowest coordination cost for a fast alpha.

**Trade-off accepted:** Low bus factor.

## DEC-019 - No auth in current alpha

**Considered:** password gate, hosted access control, no auth.

**Chose:** no auth for current public/demo alpha.

**Why:** Current demo data is public/demo and meetings are controlled.

**Trade-off accepted:** Non-public projects will need a new decision.

## DEC-020 - Woodjam terrain source

**Considered:** SRTM, CDEM, MRDEM.

**Chose:** MRDEM for Woodjam terrain.

**Why:** Current public Canadian elevation product with no login friction.

**Trade-off accepted:** Project-specific preprocessing remains needed.

## DEC-021 - Working tree: `C:\GeoSee\GeoSee_Dev`

**Considered:** synced-drive working folder, local working folder.

**Chose:** `C:\GeoSee\GeoSee_Dev`.

**Why:** Avoid file-locking and build-output issues.

**Trade-off accepted:** Backup is separate from active development.

## DEC-022 - Authoring writes through dev-only endpoint

**Considered:** File System Access API, dev-only Vite write endpoint.

**Chose:** dev-only write endpoint.

**Why:** Smooth local authoring without production backend.

**Trade-off accepted:** Authoring remains a trusted local/dev workflow.

## DEC-023 - Environment setup as source of truth

**Considered:** every page fully defines scene state, environment plus page deltas.

**Chose:** `environment.json` as the world/default state, pages as deltas.

**Why:** Removes ambiguity around which page owns the scene.

**Trade-off accepted:** Editor needs explicit global/page distinction.

## DEC-024 - Scene overlays as first-class layer family

**Considered:** markdown images, ordinary layers, first-class scene overlays.

**Chose:** first-class scene overlays.

**Why:** Georeferenced/projected figures need provenance, page activation, and scene-space control.

**Trade-off accepted:** More schema and loader surface.

## DEC-025 - Authoritative palettes with sparse overrides

**Considered:** manually maintained color maps, canonical source palettes, sparse overrides.

**Chose:** canonical palette defaults with sparse environment overrides.

**Why:** Better credibility and lower authoring burden for large categorical geology-style layers.

**Trade-off accepted:** Requires source palette preparation.

## DEC-026 - Commercial shape: project-anchored entry

**Considered:** annual subscription first, project artifact first.

**Chose:** project-anchored artifact as entry point.

**Why:** Better fit for early stakeholder conversations and service-first delivery.

**Trade-off accepted:** Retainer/SaaS framing comes later.

## DEC-027 - Multi-project folder support

**Considered:** keep hardcoded Woodjam paths, project-aware folder loading.

**Chose:** project-aware loading.

**Why:** Woodjam and Case Study B must coexist without path hacks.

**Trade-off accepted:** Project path resolution becomes a shared concern.

**Supersedes:** DEC-003 in part.

## DEC-028 - Shahbazi Gravel Pit as high-fidelity Case Study B

**Considered:** keep Case Study B procedural only, use a real open dataset.

**Chose:** Shahbazi et al. gravel pit dataset as the first high-fidelity quarry source.

**Why:** It provides UAV images, GCP/check points, object/tie points, and TLS point cloud source material.

**Trade-off accepted:** Current app uses preview products until full photogrammetry/orthomosaic/Potree assets exist.

## DEC-029 - Keep procedural shell as fallback

**Considered:** replace the procedural shell immediately, keep it as fallback.

**Chose:** keep procedural shell.

**Why:** Case Study B must still open when real/future processed files are absent.

**Trade-off accepted:** Demo placeholders must remain visibly labelled as placeholders.

## DEC-030 - Audience Lens: runtime-only for Shahbazi

**Considered:** persistent multi-audience authoring, runtime-only lens controls.

**Chose:** runtime-only Audience Lens for Shahbazi.

**Why:** Demonstrates audience-specific readings without committing to persistent authoring complexity.

**Trade-off accepted:** Lens choice resets on reload and does not save.

**Supersedes:** DEC-007 in part.

## DEC-031 - Shahbazi surfaces remain separate

**Considered:** combined mesh, seam mesh, island knit, separate surfaces.

**Chose:** separate broad outer surface and TLS island surface.

**Why:** Mesh-stitching created visual and provenance problems.

**Trade-off accepted:** The transition between sparse outer surface and fine TLS surface remains a visible data-resolution boundary.

## DEC-032 - Broad Shahbazi outer surface is preview interpolation

**Considered:** label outer surface as LiDAR, label it as sparse object-point preview.

**Chose:** label it as sparse photogrammetry object-point interpolation.

**Why:** It is not LiDAR and must not be represented as measured LiDAR terrain.

**Trade-off accepted:** The layer is less impressive than a final reconstructed surface, but honest.

## DEC-033 - Active preview files separate from future targets

**Considered:** mix missing future paths with active files, split them.

**Chose:** `previewFiles` for active assets and `futureTargets` for planned outputs.

**Why:** Audits should not flag planned GLB/Potree/orthomosaic targets as broken active files.

**Trade-off accepted:** Layer specs carry two file maps.

## DEC-034 - Surface/photo render policy is named

**Considered:** keep material/depth settings inline, centralize them.

**Chose:** `surfaceRenderPolicy.ts`.

**Why:** Surface, contour, and photo layering are fragile enough to need a named contract.

**Trade-off accepted:** Loaders import a shared policy file.

## DEC-035 - Generated Shahbazi mesh winding should be correct

**Considered:** fix face side at runtime, fix generated artifacts.

**Chose:** fix generated artifacts and keep loader generic.

**Why:** UAV/top side should be the front face and future meshes should follow the same contract.

**Trade-off accepted:** Prep scripts own more validation.

## DEC-036 - Base GUI Template

**Considered:** edit GUI defaults inside a real project, create a blank template project.

**Chose:** Base GUI Template.

**Why:** Shared GUI/environment defaults need an empty safe editing context.

**Trade-off accepted:** It is a placeholder project, not real data.

## DEC-037 - Dark frosted GUI aesthetic

**Considered:** old light editor, dark overlay-box-aligned GUI.

**Chose:** dark frosted overlay-box style across landing/editor/HUD.

**Why:** The authoring shell should visually align with the actual presentation artifact.

**Trade-off accepted:** More style state is shared with project GUI settings.

## DEC-038 - Home exits to landing with unsaved prompt

**Considered:** home jumps to first page, home returns to landing.

**Chose:** home returns to landing and prompts when unsaved.

**Why:** Bottom HUD home should mean app/project home, not page one.

**Trade-off accepted:** Home control now depends on editor dirty/save state.

## DEC-039 - Editor chrome lazy-loaded

**Considered:** bundle editor with landing, lazy-load editor after project selection.

**Chose:** lazy-load editor chrome.

**Why:** Keeps landing lighter and addresses part of the large-bundle issue.

**Trade-off accepted:** The first project open has a Suspense loading state.

## DEC-040 - Layer loader registry

**Considered:** keep loader branches in `scene.ts`, move to registry.

**Chose:** `src/scene/layerLoaders.ts`.

**Why:** New projects/layers should register loader behavior without bloating scene mounting.

**Trade-off accepted:** The registry still contains project-specific cases and should be refined over time.

## DEC-041 - Sun lock-to-camera can be global or page-level

**Considered:** fixed model-locked sun, global camera lock only, page override.

**Chose:** global lock plus page-level inherit/on/off behavior.

**Why:** Some pages need dynamic camera-aware lighting while others should preserve authored static light.

**Trade-off accepted:** Environment and page application must coordinate lighting state carefully.

## DEC-042 - Utah FORGE starts as a foundation project

**Considered:** wait for the full briefing before adding the project, or add a clean placeholder foundation now.

**Chose:** add Utah FORGE as a selectable foundation project.

**Why:** The landing/project architecture should be ready before the detailed briefing arrives, while keeping all real technical claims out of the repo until sources are known.

**Trade-off accepted:** Utah FORGE currently opens with a procedural reference stage only. CRS, bounds, source data, and real layers remain pending.

## DEC-043 - GeoSee is the product, case studies are feedback vehicles

**Considered:** frame Woodjam as the deliverable and the tool as secondary, or frame GeoSee as the tool being built and sharpened through multiple case studies.

**Chose:** GeoSee is the tool under test. Woodjam, Shahbazi / Case Study B, Utah FORGE, and future projects are equal case studies for end-user feedback and architecture learning.

**Why:** Each case study stresses different data, rendering, provenance, workflow, and presentation needs. Feedback should improve both the specific case-study experience and the reusable tool architecture.

**Trade-off accepted:** Alpha work still avoids production overbuild, but architecture should not be treated as disposable when it carries learning across case studies.

## DEC-044 - Active workspace lives under `C:\GeoSee`

**Considered:** keep GeoSee project folders spread directly across `C:\`, or consolidate them under one parent folder.

**Chose:** `C:\GeoSee\GeoSee_Dev` is the active repo, `C:\GeoSee\GeoSee_Archive` is the raw/source archive, and `C:\GeoSee\GeoSee_Dev_Past` is old/backup material.

**Why:** One parent folder reduces workspace confusion and makes it clear what should be indexed, edited, archived, or ignored by agents and editors.

**Trade-off accepted:** Old absolute paths such as `C:\GeoSee_Dev` are obsolete except in historical receipts.

**Supersedes:** DEC-021.

## DEC-045 - Utah FORGE is an active case study

**Considered:** keep Utah FORGE framed as a placeholder foundation project, or treat it as an active case study with current MT, seismic, public-context, and topology work.

**Chose:** Utah FORGE is an equal active case study, not foundation-only.

**Why:** Current project files, generated artifacts, prep scripts, runtime layers, and tests now exercise geothermal/geophysics workflows and product architecture.

**Trade-off accepted:** Older docs that say Utah FORGE has no real data or only a procedural reference stage are historical unless confirmed against current project files.

**Supersedes:** DEC-042.

## DEC-046 - Raw/source data system of record is the archive

**Considered:** keep raw/source/client/prep buckets in Git, rely on Git history for recovery, or maintain a separate archive map.

**Chose:** raw/source/client/prep buckets live in `C:\GeoSee\GeoSee_Archive`; the active repo keeps processed/runtime artifacts, provenance identifiers, and archive references.

**Why:** Raw source data is too large and context-heavy for the active app repo, but source-to-artifact traceability still matters.

**Trade-off accepted:** Repo-relative source paths may remain in provenance as historical identifiers. Recovery goes through `docs/archive-map.md` and `docs/archive-manifest.json`, not by recommitting source bytes.

## DEC-047 - Git history is for app/runtime/docs history, not raw-data storage

**Considered:** preserve all old large and stale blobs in reachable Git history, or rewrite local history after adding archive references.

**Chose:** rewrite local Git history to purge archived raw/source buckets and stale context artifacts from reachable history.

**Why:** The archive is the system of record for source files. Keeping the same data in `.git` duplicates storage, slows agent/repo operations, and risks reviving stale context.

**Trade-off accepted:** Old commit hashes are not stable references after the rewrite. The durable recovery references are the archive map, manifest, and current decision log.

## DEC-048 - Private remote should back only the active repo

**Considered:** keep Git local-only, push the active repo, or upload archive/backup material with the repo.

**Chose:** add a private hosted Git remote for `C:\GeoSee\GeoSee_Dev` only.

**Why:** The rewritten repo is now normal hosted-Git size and needs off-machine recovery. The archive and past folders are separate storage concerns.

**Trade-off accepted:** Do not push `C:\GeoSee\GeoSee_Archive` or `C:\GeoSee\GeoSee_Dev_Past`. Avoid Git LFS for now; future large source data should go to archive/external storage unless a deliberate exception is recorded.

## DEC-049 - Agent context starts from active build docs

**Considered:** let agents route through the whole docs tree, historical receipts, screenshots, and old intake traces, or give them a narrow current-work entry point.

**Chose:** agents start normal software-build work with `docs/dev-context/Active-Build-Context.md`, then read only task-specific docs and source files.

**Why:** Broad/stale context was a major source of slow prompts, outdated assumptions, and drift away from current architecture.

**Trade-off accepted:** Historical receipts and screenshots remain useful only when explicitly requested for audit, verification, intake review, or visual QA history. During iteration, prefer `npm run build` and targeted checks over full broad suites.

## DEC-050 - Add to Project remains dormant, not deleted

**Considered:** delete the Add to Project UI with all old intake/staging material, or keep the UI while purging stale staging records.

**Chose:** keep the Add to Project UI surface as a dormant capability, but purge old staging/intake records and do not let agents follow those traces by default.

**Why:** The UI may still be useful later, but stale intake artifacts were non-current context and were distorting agent behavior.

**Trade-off accepted:** Add to Project work must be explicitly resumed by the human before agents use old intake concepts as active direction.

## DEC-051 - Agent-instruction files are their own commit-policy category

**Considered:** continue classifying `CLAUDE.md` under `entry-routing-docs`, fold AGENTS.md into `other`, and treat nested `CLAUDE.md` under `src/` as `app-code`; or define a dedicated `agent-instructions` category that captures every operating-contract file regardless of path.

**Chose:** add `agent-instructions` as a first-class category in `tools/check-workspace-state.mjs`. The category matches `CLAUDE.md` at any depth, `AGENTS.md` at any depth, `docs/dev-context/Active-Build-Context.md`, and `docs/dev-context/Verification-Routing.md`. `README.md` and `docs/START-HERE.md` remain in `entry-routing-docs` as human-facing landings.

**Why:** Phase 1 of the 2026-05-26 agent-slowness audit shipped a coordinated update to the agent operating contracts (root + nested files for both Claude Code and Codex CLI). Under the previous classifier those files split across three categories (`entry-routing-docs`, `app-code`, `other`), so the commit policy rejected the focused change. Treating operating-contract files as one category lets coordinated agent-context updates ship as a single focused commit.

**Trade-off accepted:** Subsequent agent-context edits will need to keep agent-instruction changes separate from runtime, app-code, snapshot, or docs work to stay inside the policy's two-category WARN allowance. New nested `CLAUDE.md` or `AGENTS.md` files anywhere in the tree are automatically grouped under this category.

## DEC-052 - MT section ISO overlays and threshold surfaces use separate render policies

**Considered:** stabilize section ISO / threshold-surface intersections by making threshold surfaces permanently transparent, or split the rendering policy between overlay readability and surface opacity semantics.

**Chose:** section ISO lines render as a late overlay for readability, while MT threshold surfaces keep true material opacity semantics. Fully opaque threshold surfaces render as opaque depth-writing solids; translucent threshold surfaces render as transparent non-depth-writing solids.

**Why:** Utah FORGE section ISO lines must stay visually stable at surface intersections, but surface-boundary editor controls must still support full opacity and per-boundary opacity changes.

**Trade-off accepted:** Section ISO line overlays intentionally prioritize readable contours over strict physical occlusion at intersections. Opaque threshold surfaces still write depth for normal surface rendering.

## DEC-053 - Scene-section frames are independent per axis

**Considered:** keep the legacy single active MT section window, or persist independent X/Y/Z section frames.

**Chose:** scene-section frames persist by axis through `sceneSectionFrameByAxis`, with legacy X/Y `sceneSectionWindowByAxis` still readable.

**Why:** Section crop frames are plane-specific authoring state. Editing one frame must not hide, reset, or move the other active plane frames, and helper geometry must share one X/Y/Z axis model for clipping, outlines, labels, and handles.

**Trade-off accepted:** Legacy window fields remain as compatibility input and X/Y mirror output, but new runtime/editor behavior is driven by per-axis frame state. Z frames do not create ground traces unless a future requirement defines that model.

## DEC-054 - Viewport legend toggle rows use shared spacing tokens

**Considered:** keep per-legend hand-tuned spacing for checkbox/swatch rows, or promote the current reviewed spacing to shared UI tokens.

**Chose:** viewport legend checkbox/swatch rows should use `src/ui/legendStyles.ts` as the spacing, shape, and text-color contract. Current reviewed tokens are 13px outline-free, tickless circles, a 16px box column, 4px row inset under the heading, 14px box-to-label gap, 11.475px heading-to-first-row gap, and 9px subsequent row gap. Legend heading, subtext, and body colors resolve from Overlay box text settings, and generic active circles use the resolved heading color.

**Why:** Lightweight viewport legends are edited visually and need consistent alignment as new controls are added. Keeping the spacing in shared code gives future legends an executable rule instead of relying on screenshots or memory.

**Trade-off accepted:** Individual legends can still opt out when their layout is not a checkbox/swatch row, but new circle-toggle legend rows should start from the shared spacing helper before introducing local exceptions.

## DEC-055 - Viewport legend stacks use shared container spacing

**Considered:** tune each stacked viewport legend container independently, or control inter-legend spacing through the shared legend style module.

**Chose:** stacked viewport legend containers use `LEGEND_STACK_GAP_PX` from `src/ui/legendStyles.ts`. The current reviewed stack gap is 14px.

**Why:** Legend containers need consistent vertical rhythm across editor and preview states, especially when multiple technical legends are visible together.

**Trade-off accepted:** Individual legends can still own internal layout, but the gap between stacked legend containers should remain centralized unless a specific overlay stack needs a documented exception.

## DEC-056 - Utah FORGE legend transitions are per-container with MT resistivity bottom-anchored

**Considered:** crossfade whole source/target legend stacks during page transitions, or transition each legend container independently in a single ordered stack.

**Chose:** Utah FORGE viewport legends transition per container through sequenced straight-line phases. Exiting containers slide horizontally left while keeping full row height, then their rows collapse so remaining rows close the gap. Entering containers reserve/open their target row space first, then slide horizontally in from the left. Stable containers remain horizontally fixed, and MT resistivity remains the final bottom legend row.

**Why:** Whole-stack crossfades produce overlapping, drifting legend panels and allow MT resistivity to appear in the middle of the stack. Per-container transition state matches page-to-page legend membership changes while preserving a stable bottom anchor for the primary MT resistivity legend.

**Trade-off accepted:** Presence checks are centralized in `EditorChrome` for the Utah FORGE stack, while each legend component still owns its detailed rendering and null-render guards.

## DEC-057 - Viewport legends use shared page-edge anchors

**Considered:** continue positioning each viewport legend with local offsets, or centralize edge anchors alongside existing legend spacing tokens.

**Chose:** viewport legends align to shared edge constants in `src/ui/legendStyles.ts`: `LEGEND_PAGE_EDGE_MARGIN_PX = 16` for the page-edge inset and `LEGEND_BOTTOM_EDGE_OFFSET_PX = 50` for the bottom-most visible legend container.

**Why:** Legend placement needs to match the standard viewport edge rhythm and avoid each legend drifting as panel layouts change. The bottom-most legend row also needs a stable visual anchor independent of the number of visible containers.

**Trade-off accepted:** Older standalone legend offsets are now expressed relative to the shared bottom anchor. Individual legends can still own vertical ordering when they render outside the Utah FORGE stack, but page-edge and bottom-anchor values stay centralized.

## DEC-058 - Viewport legend bottom anchor is 100px

**Considered:** keep the bottom-most viewport legend container 50px from the bottom edge, or increase that shared offset.

**Chose:** set `LEGEND_BOTTOM_EDGE_OFFSET_PX = 100` in `src/ui/legendStyles.ts`.

**Why:** The 50px anchor placed the bottom legend container too close to the viewport bottom during visual review.

**Trade-off accepted:** All legends using the shared bottom anchor move upward together. Standalone legends that express their vertical position relative to the shared anchor keep their relative ordering.

**Supersedes:** DEC-057 for the bottom-anchor value only. DEC-057 still applies to using shared edge-anchor tokens.

## DEC-059 - Section scale axes are independent presenter helpers

**Considered:** keep section scale axes tied to section gizmo/P Controle visibility, or let scale axes persist as their own presenter-readable helper when enabled.

**Chose:** section scale axes are controlled by `sceneSectionAxesVisible` and remain visible in presenter mode when enabled, even when `sceneSectionHelperVisible` hides clipping outlines and push/pull cones.

**Why:** Scale axes are interpretive presentation context, not edit handles. Hiding the gizmo in presenter mode should not remove authored distance/elevation references.

**Trade-off accepted:** Section scale axes now have separate authoring values for tick interval and text size: `sceneSectionAxisIntervalM` and `sceneSectionAxisTextScale`. Ground traces remain limited to X/Y frames.

## DEC-060 - Section frame controls are per axis

**Considered:** keep frame crop, ground trace, scale-axis visibility, tick interval, and text size as one shared `Section frames` control set, or move those controls into each X/Y/Z frame.

**Chose:** frame crop, ground trace, scale axes, axis interval, and text size are authored per axis through `sceneSectionFrameByAxis.<axis>`. Legacy global fields remain readable as fallback values for existing pages.

**Why:** Section frames are independent authoring surfaces. Changing the Y frame scale or crop state should not alter X or Z frame controls.

**Trade-off accepted:** Existing global `sceneSectionFrameEnabled`, `sceneSectionGroundTraceVisible`, `sceneSectionAxesVisible`, `sceneSectionAxisIntervalM`, and `sceneSectionAxisTextScale` fields remain compatibility fallbacks, but new editor writes target the per-axis frame object.

**Supersedes:** DEC-059 for scale-axis authoring field location only. DEC-059 still applies to presenter visibility being independent from P Controle.

## DEC-061 - Section scale-axis labels use kilometer controls and planar camera-facing text

**Considered:** keep scale-axis intervals and labels as fixed meter-based helper output, or expose kilometer-based authoring controls with explicit label and heading typography.

**Chose:** section scale-axis intervals are edited in kilometers while persisted as meters. Per-frame label controls now include tick text size, tick text padding, editable A/B headings, heading padding, heading color, and heading size.

**Why:** Section frames need readable measurement context at presentation scale. Authors need direct control over label density and typography without moving text farther from the axis just because text size increases.

**Trade-off accepted:** Scale-axis text remains flat on the section plane and flips to face the camera per frame. Heading text defaults are generated from the in-plane axis names with measurement type, such as `Northing (km)`.

## DEC-062 - Ground trace trims section cut overlays above terrain

**Considered:** keep ground trace as a visual helper only, or make it a cut boundary for generated section volume-cut overlays.

**Chose:** when an X or Y section frame has ground trace enabled, generated MT and seismic volume-cut ISO overlays suppress sampled vertices above the terrain height sampler.

**Why:** The ground trace communicates the terrain intersection. Section data above that sampled surface reads as bleed outside the meaningful crop and should be hidden with the same authoring toggle.

**Trade-off accepted:** The trim is applied to generated section volume-cut overlays, where per-vertex alpha already drives bands and contour output. Generic material clipping remains rectangular because Three.js clipping planes cannot represent the sampled terrain curve.

## DEC-063 - Section clipping culls floating labels at their anchors

**Considered:** let HTML floating labels continue to render when their source object is clipped by a scene section, or evaluate label anchors against the active section clipping state.

**Chose:** labelable objects receive a transient `sceneSectionLabelHidden` runtime flag when their label anchor point is outside the active section clipping planes. `SceneLabels` skips those anchors.

**Why:** Floating HTML labels are rendered outside Three.js material clipping. Without a parallel anchor check, a clipped feature can disappear while its label remains visible.

**Trade-off accepted:** Label culling is anchor-based. Objects spanning a section boundary can keep a label when their chosen label anchor remains on the visible side.

## DEC-064 - MT threshold surfaces draw dashed section-frame intersections

**Considered:** rely on clipped MT threshold surface edges to show where a threshold surface crosses a scene section, or generate an explicit section-frame intersection trace.

**Chose:** active section frames slice visible MT threshold surface meshes and render the resulting in-frame polylines as white dashed helper lines using the same visual contract as ground traces.

**Why:** Transparent and clipped surfaces can make the exact intersection hard to read. A stable dashed trace gives the section frame a CAD-like intersection cue without changing the underlying surface opacity behavior.

**Trade-off accepted:** The trace is generated from the visible triangle mesh at runtime and stitched by endpoint tolerance. It is a visual helper, not a source-data artifact.

## DEC-065 - Section frame headers own section plane controls

**Considered:** keep separate `X Section active`, `Y Section`, and `Z Section` editor subsections beside the newer `X/Y/Z Section frame` subsections, or collapse section-plane authoring into each frame.

**Chose:** each `X/Y/Z Section frame` header owns the matching section plane enable, flip-side, and active-handle controls. Cut position remains inside the same frame body. Separate section-plane subsections are removed.

**Why:** Section frames are now the primary authoring surface for X/Y/Z sections. Keeping a second set of section controls made enable/active state feel redundant and split related plane and frame edits across two editor locations.

**Trade-off accepted:** Existing style fields and test IDs remain stable. The UI placement changes, but persisted page/environment JSON still uses `sceneSectionPlanes.<axis>` for plane state and `sceneSectionFrameByAxis.<axis>` for frame state.

## DEC-066 - Section intersection traces belong to section frames

**Considered:** draw dashed white intersection traces where visible MT threshold surface meshes cross a section frame, or draw them where two enabled section frames overlap and section ISO surfaces visually meet.

**Chose:** when Section ISO is enabled, dashed white traces are generated from active section-plane positions and per-axis frame bounds. MT threshold boundaries no longer generate section-frame intersection traces.

**Why:** The intended cue is the seam where authored section ISO overlays meet, not where independent threshold boundary surfaces happen to cross a section. Binding the trace to section frames keeps the cue stable and independent from threshold boundary visibility.

**Trade-off accepted:** The X/Y vertical frame intersection can be trimmed to sampled ground when either frame has ground trace enabled. Other frame-pair intersections are rectangular frame overlaps until a terrain-trim model is explicitly defined for those pairings.

**Supersedes:** DEC-064.

## DEC-067 - Section ISO ground trim is a hard geometry mask

**Considered:** use interpolated alpha to hide section ISO content above a ground trace, or hard-mask section ISO triangles at the sampled ground boundary.

**Chose:** section ISO bands and contour ribbons use a separate hard mask for ground-trace trim. Triangles touching masked above-ground vertices are excluded from both band geometry and stitched contour generation.

**Why:** Interpolated alpha can leave faint band bleed and contour protrusions across the ground-trace boundary. A hard geometry mask keeps ISO output from crossing the authored ground trace.

**Trade-off accepted:** The trim follows the generated section grid resolution, so the boundary can step at grid-cell scale. This is preferable to visible above-ground bleed.

**Supersedes:** DEC-062 for section ISO overlay trim behavior only. DEC-062 still applies to the authoring intent of hiding above-ground section data when ground trace is enabled.

## DEC-068 - Section ISO bands conform to ground-trace geometry

**Considered:** keep section ISO bands as a rectangular grid with hard-masked boundary triangles, or reshape X/Y section cut grids so their top boundary follows the sampled ground trace.

**Chose:** when ground trace is enabled, generated X/Y section ISO cut grids clamp each along-axis column to the sampled ground elevation. Ground trace width is authored per section frame through `sceneSectionFrameByAxis.<axis>.groundTraceWidthM`.

**Why:** Hard-masked rectangular grids remove above-ground bleed but create stepped or torn-looking band edges. Reshaping the generated cut mesh makes the band boundary follow the same sampled ground profile as the visual trace.

**Trade-off accepted:** The band edge follows the section cut grid resolution and terrain sampler. Increasing section cut resolution remains a separate performance tradeoff.

**Supersedes:** DEC-067 for Section ISO band geometry only. DEC-067 still applies to contour-ribbon masking.

## DEC-069 - Section ISO isolines define band boundaries

**Considered:** quantize Section ISO fills into `sectionIsoLevelCount` bands, or treat `sectionIsoLevelCount` as the number of isoline boundaries and fill the `levelCount + 1` intervals between them.

**Chose:** Section ISO lines and bands share the same scalar thresholds. The fill shader renders one more band than the line count so every visible isoline lies on a color boundary.

**Why:** When bands and lines use different threshold spacing, contours visually drift through the middle of fill regions instead of matching the band changes. Shared thresholds make the legend and section surface read as one contour system.

**Trade-off accepted:** A setting of 5 levels now means 5 isolines and 6 fill bands. Existing persisted style values still represent isoline count.

## DEC-070 - Section frames own object hidden-opacity controls

**Considered:** keep global scene-section Type/Target controls, or move object visibility into each X/Y/Z section frame.

**Chose:** section object visibility is authored per frame axis through `sceneSectionObjectVisibilityByAxis`. Stable object IDs use `layer:<layerId>` and `product:<layerId>:<productId>`.

**Why:** Frame editing needs to answer which objects that specific frame hides and how strongly hidden content should remain visible. A global target selector split that decision from the frame being edited.

**Trade-off accepted:** Legacy `sceneSectionTargetScope`, `sceneSectionTargetLayerIds`, and `sceneSectionTargetProductIds` remain readable as defaults. When multiple frames hide the same object, the lowest outside opacity wins.

## DEC-071 - Grid and section ISO transitions use stable render composition

**Considered:** keep topo graticules and Section ISO overlays as late overlay-style helpers with independent opacity writes, or make their depth and opacity behavior deterministic during camera and page transitions.

**Chose:** topo graticule line materials depth-test against terrain and scene geometry while keeping `depthWrite: false`. Terrain underside grids use camera-side hysteresis. Section ISO line and band opacity is composed from authored opacity, page/layer transition opacity, and threshold-surface occlusion attenuation. Compatible section-frame transitions interpolate numeric frame geometry by stable frame id; incompatible section helper states crossfade through an outgoing helper snapshot and incoming helper fade.

**Why:** Camera motion was causing graticule/grid ghosting and snapping, and page transitions could let ISO overlays brighten, darken, or swap abruptly. A single opacity composition path plus deterministic section-frame compatibility rules prevents transition-time overwrite bugs.

**Trade-off accepted:** Edge-aware graticule lines are governed by generated bounds and depth testing rather than forcing public clip planes onto every line role. Edge awareness clips interior grid lines, but it does not recolor them into white/gray edge strokes or apply directional edge-gradient fading. White edge leaders remain as capped boundary ticks, attach to the same boundary-side crossing used by their edge labels, and are hard-clipped to the public surface clip. Topo graticule lines and labels are terrain/reference context and are excluded from scene-section clipping. Threshold-surface attenuation for ISO lines is smoothed over short frames, so it prioritizes visual stability over per-frame exact raycast changes.

## DEC-072 - Camera far plane is not a visual crop

**Considered:** allow the fixed camera far plane to clip distant topo imagery during overview zoom, or keep topo imagery and graticule context inside the scene frustum and reserve crop behavior for authored clip tools.

**Chose:** the scene camera far plane is raised to `5_000_000m` while keeping the near plane at `50m` and preserving the existing reversed/logarithmic depth-buffer selection.

**Why:** Public topo imagery, graticule context, and presentation overview shots should not slice away when the author zooms out. Far-plane clipping reads as missing image content rather than intentional composition.

**Trade-off accepted:** Camera depth range is wider, but the renderer already uses reversed depth where supported and logarithmic depth otherwise. Public surface crop and scene-section clipping remain the explicit mechanisms for authored cropping.

## DEC-073 - Topo line shader clips segments at the camera near plane

**Considered:** continue relying on the default `LineMaterial` screen-space line expansion for topo and graticule lines, or add a vertex-shader near-plane clip that prevents segments straddling the camera from rendering as full-screen streaks.

**Chose:** the patched `LineMaterial` in `src/loaders/topoLineMaterial.ts` clips segments behind a 100m view-space threshold inside `enableDistanceAttenuatedLineWidth`. When one endpoint is behind the threshold, the vertex shader parametrically moves it onto the threshold plane and lerps the world-space endpoint by the same parameter so edge-fade math stays consistent. When both endpoints are behind the threshold, the segment is collapsed and the fragment shader receives zero alpha through a new `vTopoLineNearClipVisible` varying.

**Why:** The default `LineMaterial` expands width in NDC after the perspective divide and does not clip segments that cross the camera near plane. A segment with one endpoint in front of the camera and one behind has midpoint view-space z near zero, which the previous `topoLineDepth = max(0, -mix(start.z, end.z, 0.5))` clamp resolved to full width and full alpha. The segment then projected as a long screen-aligned chord, which matched the long stray green and white lines reported at oblique camera angles in the longitude/latitude graticule. The shader-level clip is independent of the geometry-side edge-aware clipping and removes the artifact without altering the four graticule roles, render orders, white edge leaders, or scene-section exclusion.

**Trade-off accepted:** Topo line shaders are recompiled (cache key bumped to `v6`). A 100m clip distance is chosen to land safely beyond the standard `CAMERA_NEAR_M` of 50m; the visible gap between the camera and the clipped endpoint is imperceptible at the typical camera-to-graticule distances in the project. The clip distance is hard-coded inside the shader patch rather than exposed as a uniform.

## DEC-074 - Graticule perspective line width anchors on a per-frame reference depth

**Considered:** scale `LineMaterial` width per segment using each segment's own midpoint view-space depth, or anchor every segment in the frame to a single shared reference depth.

**Chose:** the perspective-on path in `src/loaders/topoLineMaterial.ts` computes `topoFrameReferenceDepth = length(cameraPosition - topoTerrainCenter)` once per frame from the built-in `cameraPosition` uniform and the existing `topoGraticuleTerrainBoundsMin/Max` uniforms. Each vertex's width scale is `clamp(topoFrameReferenceDepth / topoVertexDepth, 0.3, 3.0)`. Toggled by the `graticulePerspectiveLineWidth` style boolean; the previous distance-soften alpha vignette is neutralized in this mode so far lines do not double-fade. Cache key bumped to `v7`.

**Why:** Per-segment midpoint scaling fails for our line buffer because `rebuildTopoGraticuleEdgeLines` sub-samples each candidate pair into many small `LineSegments2` instances. The two endpoints of any one of those tiny segments sit at nearly identical view-space depths, so the per-segment ratio collapses to ≈1 everywhere and produces no visible taper. Anchoring against a per-frame reference shared by every segment makes the ratio reflect each vertex's absolute depth, which is what the eye reads as perspective. Using the camera's distance to the terrain footprint center keeps the look zoom-invariant: when the camera moves further away, both the reference and the per-vertex depths grow proportionally, so screen-space widths stay stable.

**Trade-off accepted:** the look depends on the terrain bounds uniforms already plumbed through the shader. When `graticulePerspectiveLineWidth` is off, behaviour is identical to before this decision. The taper does not attempt to model true world-units linewidth — it is an artistic falloff bounded by the `[0.3, 3.0]` clamp, not a metric.

## DEC-075 - Grade pass clamps non-negative between operations

**Considered:** leave the `grdShader` contrast/saturation/tint pipeline unclamped and accept the black-fringe halos that appeared around bright additive graticule pixels when contrast or saturation were pushed past 1.1, or clamp `c.rgb = max(c.rgb, vec3(0.0))` after each grade operation.

**Chose:** the `grdShader` in `src/scene/postprocessing.ts` clamps the colour to non-negative after contrast, after saturation, and after the new vibrancy step. A new `vibrancy` uniform applies a smart-saturation curve via `vibrancyAdj`: less-saturated pixels get the full boost, already-vivid pixels get progressively less. Vibrancy is exposed in the Image finish editor section and routed through `colorGrade.vibrancy` in `SceneProperties`. Default 1.0 (no effect).

**Why:** `mix(grey, rgb, adj)` extrapolates past `rgb` whenever `adj > 1`. On a bright additive ribbon pixel like `(0, 2, 0)` with the default saturation of 1.06, the off-hue red and blue channels resolve to approximately `(-0.12, …, -0.12)`. The negatives cascade into ACES tone mapping and the SMAA edge pass, which interpret the discontinuity as an edge and paint the dark dotted fringe reported by the user. Clamping after each operation prevents the negative values from leaving the grade pass. Vibrancy gives the user a way to lift muted regions without re-triggering the artifact, since the smart curve scales adjustment by `1 - currentSat` so already-saturated pixels (e.g. the graticule itself) receive minimal additional boost.

**Trade-off accepted:** at extreme settings (very high contrast/saturation against bright HDR-ish content), the grade pass loses a small amount of darkening on the off-hue channels relative to the previous behaviour. Authored looks at default values are visually unchanged.
