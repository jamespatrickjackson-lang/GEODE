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

**Why:** Whole-stack crossfades produce overlapping, drifting legend panels and allow MT resistivity to appear in the middle of the stack. Per-container transition state matches page-transition legend membership changes while preserving a stable bottom anchor for the primary MT resistivity legend.

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

**Trade-off accepted:** Edge-aware graticule lines are governed by generated bounds and depth testing rather than forcing public clip planes onto every line role. Edge awareness clips interior grid lines, but it does not recolor them into white/gray edge strokes or apply directional edge-gradient fading. White edge leaders remain as capped boundary ticks, attach to the same boundary-side crossing used by their edge labels, and are hard-clipped to the public surface clip. Topo graticule lines and labels were originally treated as terrain/reference context and excluded from scene-section clipping; DEC-097 supersedes that default exclusion for targeted topo context. Threshold-surface attenuation for ISO lines is smoothed over short frames, so it prioritizes visual stability over per-frame exact raycast changes.

**See also:** `docs/dev-context/Page-Transitions-And-Section-Frames.md` is the canonical directives doc for the section-frame helper stability contract that DEC-071 enforces at composition time. DEC-076 formalises that contract. DEC-077 historically relaxed the topo / graticule scene-section exclusion through `topoSectionable`; DEC-097 supersedes that opt-in contract and makes targeted topo context section by default.

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

## DEC-076 - Page-transition and section-frame helper directives live in one doc

**Considered:** keep the page-transition / section-frame helper rules scattered across `docs/03-decisions.md` (DEC-053 → DEC-075), `docs/dev-context/UI-Visual-Standards.md`, `docs/dev-context/Active-Build-Context.md`, and `docs/dev-context/Runtime-Diagnostics.md`, or consolidate the runtime contract into one named directives file that the other docs and `CLAUDE.md` route to.

**Chose:** `docs/dev-context/Page-Transitions-And-Section-Frames.md` is the canonical directives doc. `CLAUDE.md` Source Of Truth, `Active-Build-Context.md`, `UI-Visual-Standards.md`, `Runtime-Diagnostics.md`, and DEC-071 each carry a one-line pointer to it. The pre-existing visual-standard tables, decision entries, and rendering-mode notes stay where they are; the directives doc is the routing entry point that ties them together and codifies the helper-stability contract the runtime must obey.

**Why:** The current runtime mis-call site is `rebuildSceneSectionHelpers()` inside `tickLayerTweens()` ([layerTweenRuntime.ts:104-110](../src/scene/transitions/layerTweenRuntime.ts#L104-L110), [sceneSectionController.ts:2845-2851](../src/scene/section/sceneSectionController.ts#L2845-L2851)). The rule that prevents it — helper geometry built at tween start and tween end only, with material instances stable across the tween and per-frame motion limited to opacity and uniforms — was not stated anywhere as a contract. An agent following the established docs would still have to infer it from four files plus the runtime trace. The directives doc states the contract once and the cross-links make sure agents arriving via any of the older docs reach it.

**Trade-off accepted:** One additional doc to maintain. Updates to the helper-stability contract must edit the directives doc and may need a new decision entry referencing this one. The visual-standard tables stay readable as standards (numeric ranges, defaults) rather than absorbing prose contract language. DEC-076 does not change runtime behaviour by itself; Phase 2 of the rollout implements the gated rebuild.

## DEC-077 - Topo-context section clipping is an opt-in style flag (supersedes DEC-071 exclusion clause)

**Considered:** keep `sceneSectionObjectExcludedFromClipping` as an unconditional exclusion list for the topo map surface labels/legends, the longitude/latitude graticule (lines, ribbons, labels), and the topo map branding — preserving the rule from DEC-071 that topo / graticule are terrain-reference context only — or relax the exclusion behind a per-layer style flag so authors can choose section frames that cut the topo context the same way they cut data layers.

**Chose:** add an opt-in style flag `EditableStyle.topoSectionable` (default unset / `false`). When `true` on a layer's style, the layer's topo-context objects and materials flow through the standard scene-section clipping pipeline. The runtime mirrors the flag from style onto `obj.userData.topoSectionable` and `material.userData.topoSectionable` for every descendant in `graticuleRuntime.applyTopoGraticuleStyle` and `brandingRuntime.rebuild`. `sceneSectionObjectExcludedFromClipping` returns `false` early when the per-object flag is set; the material-level early-return in `applySceneSectionMaterial` skips its `topoGraticule*Material` short-circuit when the per-material flag is set so the material falls through to the normal clipping-planes path. When the flag is off, behaviour is bit-for-bit identical to DEC-071.

**Why:** DEC-071's blanket exclusion was right for the original "terrain reference context" use case but the user surfaced a real authoring need: section frames that show the cut surface relationship to the topo map and its long/lat graticule. Hard-coding the exclusion made that authorable look impossible without a global edit to the section controller. A per-style opt-in keeps the safe default (no surprise behavior change in any existing project) and lets new pages enable the cut where it tells the story.

**Trade-off accepted:** DEC-071's topo-graticule exclusion clause is **superseded** by this decision **only for layers that set `topoSectionable: true`**. The rest of DEC-071 — ISO composition, frame-compatibility transitions, edge-aware behavior — is unchanged. White edge leaders inside the public-surface clip still apply because the graticule line material's `publicSurfaceClipPlanes` path is preserved when section clipping is off; when sectioning is on, the material's `clippingPlanes` carry the section planes instead and the public-surface clip is composed inside the scene-section path. Editor surface for DEC-077 was the now-removed graticule opt-in checkbox; DEC-097 removes that control and makes targeted topo context section by default. Topo branding inherited the flag from the terrain layer's style under DEC-077; that flag is now deprecated/no-op compatibility state.

**Superseded by DEC-097:** The per-style opt-in default and editor checkbox are historical. Targeted topo context now participates in scene-section clipping by default, and `EditableStyle.topoSectionable` is deprecated/no-op compatibility state.

## DEC-078 - Section frame alignment and measurement datum are per-frame

**Considered:** keep every section frame locked to the scene's UTM grid axes and print only absolute UTM coordinate tick labels, or let each frame independently choose geometric alignment and measurement-label datum.

**Chose:** add per-frame `axisAlignment` and `axisDatum` fields. The scene, source data, terrain, MT volumes, drillholes, topo graticules, saved cameras, and authored layer coordinates remain in UTM-grid scene space. A frame with `axisAlignment: "cardinal"` computes the local UTM convergence at that frame center and rotates only that frame's section plane, crop basis, handles, scale axes, ground trace, and section-cut overlays around scene Z. A frame with `axisDatum: "local"` or `"latlon"` changes scale-axis tick/readout behavior only; it does not reproject or rotate the scene.

**Why:** Utah FORGE data is authored in UTM, but geological section presentation sometimes needs true-cardinal frame geometry and sometimes needs labels as local distance or longitude/latitude. Bundling those concerns would make geometry and text behavior ambiguous. Per-frame settings keep old pages unchanged while allowing a single page to mix UTM, cardinal, local-distance, and lat/lon section readouts.

**Trade-off accepted:** `axisAlignment` defaults to `"utm"` and `axisDatum` defaults to `"utm"` for all persisted projects, so existing frames render unchanged. If a UTM zone cannot be resolved from the active source CRS, cardinal alignment falls back to UTM geometry. Local datum origins default to the frame center in absolute UTM metres. Lat/lon labels use the existing UTM conversion helpers extracted for shared runtime use rather than introducing a new projection dependency.

## DEC-079 - Sub Master pages: scoped intermediate authoring surface with frozen environment snapshot, explicit re-sync, single-level hierarchy, cascade-delete, and group-coloured page list

**Considered:** keep `environment.json` as the single global authoring surface and rely on per-page `layerOverrides` / `visibilityOverrides` to defend grouped authoring work from global cascade pollution (DEC-023's model), or introduce an intermediate "Sub Master" authoring surface that freezes a snapshot of the global environment at creation time and becomes the inheritance base for its own children pages.

**Chose:** add Sub Master pages. A Sub Master is a renderable `PresentationPage` that carries an `envSnapshot: EnvironmentSetup` captured from the live global environment at creation, plus the standard page-level deltas. Three new optional fields on `PresentationPage`: `parentMasterId?` (default `"global"`), `envSnapshot?` (present iff this page IS a Sub Master), `subMasterOrdinal?` (assigned-once, stable across reorders). The resolver in [PageController.tsx](../src/pages/PageController.tsx) `resolvePresentationState` selects the inheritance base: Sub Master uses its own `envSnapshot`; Sub Master child uses its parent's `envSnapshot`; Global child uses the live environment. [effective.ts](../src/pages/effective.ts) is unchanged. The editor's env-change re-apply effect depends on the resolved environment, not the raw environment, so global edits never re-apply on Sub Master pages or their children — this is the central runtime invariant that prevents cascade pollution. Page numbering displays as `XX.M.NN` (`XX` = global slot, `M` = ordinal, `NN` = `00` for the master and 1-based for children); display-only, `pageOrder` slug is unchanged. The page list reserves a distinct Sub Master accent sub-palette in [styles.ts](../src/editor/styles.ts); master rows get a 4 px left border in their hue, child rows are indented 12 px and share the master's hue. A `+` button on the Global Settings row creates a new Sub Master. A `+` button on each Sub Master row adds a child to that Sub Master. A `↻` button on each Sub Master row triggers an inline two-click `Re-snapshot from Global` that replaces only the Sub Master's `envSnapshot`, preserving the Sub Master's own page-level overrides and every child's deltas. The auto-cancel for the re-snapshot confirm prompt is 5 seconds. Deleting a Sub Master cascade-deletes every page whose `parentMasterId` references it; the editor surfaces the child count in the confirm dialog. `REORDER_PAGE` is group-aware: a Sub Master block (master + children) moves atomically; a Sub Master child is clamped to its sibling block; Global children skip over a Sub Master block as one unit. A page with `parentMasterId` referencing a missing or non-Sub-Master id falls back to the global environment and logs a `console.warn` so authoring proceeds.

**Why:** `environment.json` edits cascade live to every page lacking an explicit override (DEC-023). When authoring a focused sub-task — e.g. tuning seismic look across five pages — a later global edit silently regresses the locked-in look. Defending against this by writing explicit per-page overrides for every potentially affected field is impractical and bloats page JSON. Sub Master gives the author a scoped freeze of the global state for a chosen subset of pages without leaving the existing delta-merge model behind. The single-level hierarchy keeps the resolver shallow and the editor UX legible; the explicit re-snapshot affordance keeps Global → Sub Master propagation author-controlled rather than automatic.

**Trade-off accepted:** Sub Master `envSnapshot` is a full `EnvironmentSetup` (typically tens of KB per Sub Master in `utah-forge`-scale projects), accepted as the cost of guaranteed disconnect across every environment-shaped field. Re-snapshot replaces only `envSnapshot`; Sub Master's own per-page edits and children's deltas survive. Cascade-delete is destructive and not auto-reversible — the dialog showing the child count is the only safety net. Backward compatibility is mandatory: old projects load unchanged because `parentMasterId` and `envSnapshot` are optional and absent fields imply Global child. The vite author-write plugin does no schema validation, so the new fields pass through `/api/write-batch` transparently with no persistence-layer change. Coexists with DEC-080's `cameraObjectFocus` — Sub Master fields slot after `cameraObjectFocus` in `PresentationPage`, and a Sub Master itself may carry `cameraObjectFocus` since it is a renderable page.

## DEC-080 - Scene clicks reveal editor rows and double-clicks lock camera focus

**Considered:** keep viewport picking limited to specialised tools such as MT station selection and seismic product selection, or add a shared scene-target interaction path for editor reveal and camera inspection.

**Chose:** scene picking emits additive target events with stable ids (`layer:<layerId>` and `product:<layerId>:<productId>`). Single click reveals the owning editor row without opening nested disclosure sections. Double click enters camera object focus at the exact picked world point and uses the target bounds only to compute fit distance. Focus persists until right mouse button release or page navigation releases it.

**Why:** Large editor panels make manual layer discovery slow, and large scene objects are difficult to inspect when the orbit target stays elsewhere. A shared picking contract keeps MT/seismic side effects intact while giving every visible scene object a predictable reveal and focus affordance.

**Trade-off accepted:** `DEC-079` remains reserved for Sub Master pages. Camera focus settings live under global `SceneProperties.cameraFocus`, while per-page `cameraObjectFocus` stores only the durable target id and picked world point. Focus is re-engaged after a page's normal transition; missing saved targets log a warning and leave the camera at the transitioned pose. This does not introduce a second camera tween pipeline: the existing `CameraTweener` remains the sole focus transition path.

## DEC-081 - Utah public topo gradient is a named terrain preset

**Considered:** keep Utah FORGE topo colour as an ad hoc `surface-elevation` edit in `environment.json`, or add a reusable named Public Topo Map material preset.

**Chose:** add a built-in `Utah` public topo material preset. The preset uses a five-stop ramp derived from regional satellite colour reads: khaki desert floor, muted alluvial/sage tones, pastel green tree belts, darker forested relief, and warm snow/rock peaks. Utah FORGE's active terrain default points at this preset.

**Why:** The regional public topo map needs a recognizable Utah high-desert read without behaving like a custom one-off. A named preset keeps the editor affordance clear, lets authors reselect the same style after experimentation, and avoids changing terrain data, CRS, camera, graticule, or geophysical products.

**Trade-off accepted:** This is visual presentation only. The terrain raster, elevation range, topo graticules, public surface crop, and MT/seismic products remain unchanged. The preset still uses the existing five-stop surface-elevation shader model, so future palette refinements should update the preset and Utah FORGE default together rather than hand-editing only persisted project JSON.

## DEC-082 - Structured scene labels and Sub Master authoring targets

**Considered:** keep using `displayName` as both object identity and rendered scene-label source, or add explicit scene-label eligibility metadata while preserving legacy fallback behavior. Also considered letting Sub Master rows keep writing ordinary page overrides, or treating Sub Master rows as authoring surfaces for inherited defaults.

**Chose:** scene labels now prefer structured anchors. If a visible layer contains any object marked `userData.labelAnchor === true` or `userData.sceneLabelEligible === true`, only those structured objects can render DOM labels. Objects marked `userData.sceneLabelEligible === false` never render labels. Legacy `displayName` fallback remains only for layers without structured anchors, so older generic layers keep labeling. Sub Master style and visibility edits write into `page.envSnapshot`; stale Sub Master `layerOverrides` and `visibilityOverrides` for the same fields are folded into `envSnapshot` on load/save and then cleared. Page-scoped authoring paths are disabled or deferred while a selected page is still waiting for the visual page controller to land.

**Why:** `displayName` is needed by hover, picking, and debug identity, but it is too broad for author-facing scene labels. Site Details, boreholes, block meshes, helper edges, camera frustums, point markers, and outline tools need explicit label anchors without allowing every helper object to become an unmanaged label. Sub Master rows represent inherited defaults for their child pages, so writing ordinary page-local overrides there creates conflicts with the inheritance model from DEC-079. Pending page transitions can otherwise send edits to the newly selected row while the live scene still shows the previous page.

**Trade-off accepted:** Label authorship becomes metadata-driven for new structured loaders, so loader authors must mark unmanaged helper objects with `sceneLabelEligible: false` whenever the layer also contains structured anchors. Legacy layers without structured anchors remain compatibility-preserving. Sub Master normalization may rewrite old Sub Master page JSON to move existing overrides into `envSnapshot`, but regular pages and child-page overrides remain unchanged and child overrides still win over inherited defaults.

## DEC-083 - Imported layer registration requires explicit CRS, datum, origin, rotation, and status

**Considered:** keep accepting layer coordinates once they visually sit near the Utah FORGE scene frame, or require every imported layer to declare its horizontal CRS, vertical datum, unit basis, coordinate basis, origin, rotation, and registration status before any accuracy claim is allowed.

**Chose:** imported geospatial layers declare `metadata.crsRegistration`, and projects can declare a top-level `registrationFrame`. The registration object records `horizontalCrs`, `verticalDatum`, `units`, `coordinateBasis`, `origin`, `rotationDeg`, and `registrationStatus`. Valid status values are `unverified` and `validated`. `validated` is reserved for layers with recorded control-point evidence. Source import code must transform source coordinates into the project horizontal CRS before subtracting the GeoSee project origin.

**Why:** Utah FORGE combines UTM coordinates, local/model coordinates, rotated MT mesh assumptions, seismic source/navigation products, time-domain displays, depth-domain products, public terrain, and well references. A shared scene can look plausible while still mixing horizontal and vertical references. Treating scene-local subtraction as CRS conversion masks that risk. The explicit registration contract separates horizontal CRS from vertical datum and blocks `CRS verified` language until evidence exists.

**Trade-off accepted:** Existing Utah FORGE layers currently remain `unverified`, including layers that are source-derived and visually useful. This is intentional: source-derived visual communication is allowed, but survey-grade or engineering-grade spatial accuracy claims require control-point validation. Runtime rendering does not change from this decision by itself; import paths, manifests, validation, and UI/status labels become stricter first.

## DEC-084 - Fallback seismic line placement is approximate reference context

**Considered:** allow seismic line curtains with approximate fallback endpoints to participate in the same CRS/scale language as delivered navigation lines, or mark fallback placement as approximate and block precise registration claims until delivered navigation or control-point validation exists.

**Chose:** every seismic product/section records `navigationPlacement` with `navigationSource`, `placementAccuracy`, and `canClaimPreciseRegistration`. Fallback placement must set `navigationSource: "fallback"`, `placementAccuracy: "approximate"`, and `canClaimPreciseRegistration: false`. Utah FORGE legacy L5/L11 products currently use this fallback status. Their validation path requires delivered navigation or georeferenced control points with stored residual error before promotion.

**Why:** Legacy L5/L11 are useful reference lines, but approximate endpoints are not ground truth. Presenting them with the same language as delivered 301/302 navigation or 3D source geometry would imply scale and registration accuracy that the source set does not prove.

**Trade-off accepted:** L5/L11 remain renderable as section curtains for visual context and processing comparison, but UI/status text, recipes, exports, and validation treat them as approximate. This does not move the lines or alter seismic rendering; it only prevents precision claims from being attached to fallback placement.

## DEC-085 - Topo Environment owns clouds, sun visuals, and fog controls

**Considered:** keep cloud, fog, and sun controls scattered between generic
Cinematics, layer cards, and Topo surface settings, or group them under the
Topo tool where the author is already shaping the public map context.

**Chose:** create `Topo > Environment` with Scene atmosphere, Clouds, Sun, and
Fog. Clouds are ordinary `atmosphere-volume` environmental layers. Sun authoring
separates the terrain light source from the visible sky orb, halo, and source
marker. Fog controls include scene fog and map/layer fog participation.

**Why:** The user's authoring intent was topo-centric: place visible clouds,
move/size them, tune fog, and decide whether the sun is a real light source, a
visible sky image, both, or neither. Keeping those controls under Topo makes
the workflow coherent and avoids hiding cloud/fog state inside unrelated layer
or cinematic sections.

**Trade-off accepted:** Local atmosphere remains a first-pass impostor model:
deterministic generated-canvas `THREE.Sprite` puffs, not volumetric raymarching
or meteorological simulation. `atmosphere-volume` layers are classified as
`environmental`, not observation, interpretation, narrative, or planned work.
Project metadata owns stable identity, provenance, and immutable/default
placement; mutable style and page variants stay in `environment.layerStyles`
and `layerOverrides`. On-screen bounds helpers are toggleable and default off.
Single-puff clouds are explicitly supported for review fixtures and simple
fake-cloud looks.

## DEC-086 - Cinematic camera and post controls are presentation-only

**Considered:** keep Cinematics limited to a small render-preset, FOV, and color-grade surface, or expose a full camera/post-production toolset for authored presentations.

**Chose:** split Cinematics into `Camera Studio` and `Post Processing`. `Camera Studio` owns render preset selection, lens presets/FOV, and double-click camera focus timing. `Post Processing` owns default-off Depth of Field, Tilt-Shift, Post Production, Image finish, Glow, Film / Optics, Motion Trails, Composition Guides, Presentation Frame, and Contact Depth. DOF is split into `Focus Target`, `Blur Strength`, and `Focus Debug`, with page-target, camera-object, manual-distance, and picked-point focus modes. The runtime post stack is `RenderPass -> SSAOPass -> BokehPass -> UnrealBloomPass -> TiltShiftPass -> AfterimagePass -> LensGradePass -> SMAAPass -> OutputPass`.

**Why:** GeoSee presentations need cinematic composition controls comparable to camera/lens/post workflows in Unreal, Blender, Unity HDRP, and color tools, but those controls must not change the meaning or inclusion of technical products.

**Trade-off accepted:** These controls are aesthetic only. They must not alter MT/scalar/seismic products, CRS transforms, source paths, generated artifacts, loaders, or computed geometry. Page-local numeric cinematic post fields blend through `main-camera/cinematic-post`; toggles, focus mode, debug helpers, and aspect-mask choices remain discrete. Composition guide/presentation-frame `lineThickness` defaults to `0.25`, half of the prior guide/frame stroke weight. Visual looks remain ready for human visual check until the running browser or a human review confirms them.

**Diagnostics:** `npm run inspect:effective -- --render-stack` is the required starting trace for Utah FORGE visual diagnosis. It reports active preset, environment/Sub Master/preset/page scene sources, layer styles, topo material authority, texture URL/cache key, bounds, public clip, edge fade, edge outline, material/shader, terrain geometry/LOD, and pass order.

## DEC-087 - Seismic product names stay source-backed; figure annotations are presentation overlays

**Considered:** allow short app-authored names for Utah FORGE seismic products and encode figure text directly into product identity, or keep seismic product identity tied to source-backed product labels while adding separate presentation annotations.

**Chose:** Utah FORGE seismic labels use canonical source-backed names in the form `2D Line <line> <source-backed product description>`. SEG-Y text headers are primary evidence, filenames are secondary evidence, and folder/submission context is only fallback evidence. The product catalog and controls group products by line family and processing stage. Figure annotations are independent presentation styles on the seismic layer and must not replace product names, product ids, source evidence, registration status, or source lineage.

**Why:** The app had started to hide real product distinctions behind convenience names and page-level assumptions. Source-backed naming keeps GDR-1015 migrated-depth Line 301, GDR-1141 migrated/unmigrated/time/depth products, legacy L11/L5 variants, and future Line 95 products auditable. Presentation annotations solve the need for readable section figures without mutating source identity.

**Trade-off accepted:** Some labels are longer than shorthand app names, and the editor needs grouped controls to keep them readable. Line 95 remains source-gated until a real product exists. Legacy L5/L11 fallback navigation remains approximate reference context under DEC-084 and cannot be promoted by renaming.

## DEC-088 - Site Details and station markers align to rendered topo as display-only state

**Considered:** keep Site Details and MT station marker Z fixed at source-authored elevation regardless of terrain exaggeration and surface lift, or add authored display toggles that drape them to the currently rendered topo surface.

**Chose:** add independent `siteDetailsAlignToTopo` and `pointMarkerAlignToTopo` style fields. Utah FORGE defaults both on. When enabled and terrain is visible, the runtime samples DEM height at scene XY, converts to scene Z, applies terrain `scale.z` and `position.z`, and uses that rendered topo Z for display. Station markers add their authored marker and label lift after the topo sample. When terrain is hidden, no sampler is available, or a toggle is off, the objects fall back to source-authored Z.

**Why:** Utah FORGE terrain can use strong vertical exaggeration and surface lift, so source-Z Site Details and station markers appeared below or detached from the rendered surface. The requested authoring behavior is visual alignment with the active topo, while still preserving source coordinates for provenance and registration.

**Trade-off accepted:** Drape behavior is display-only and may visually distort borehole trajectory shape under exaggerated topo. Source survey coordinates, manifests, registration evidence, and CRS status remain unchanged. Visual acceptance still requires a browser/runtime check because static validation only proves the fields and code paths exist.

## DEC-089 - Editor sidebar controls require a manifest guard

**Considered:** keep editor control protection in scattered source-string tests and reference docs, or create a canonical field-level manifest that must be updated whenever editor sidebar controls move, appear, disappear, or become hidden.

**Chose:** create `docs/dev-context/editor-control-manifest.json` with stable ids for top-level bars, peer groups, subsections, persisted controls, action controls, and dynamic control families. Editor sidebar source changes must keep active manifest anchors valid. Removals, renames, and hidden controls require structured approval metadata in the manifest.

**Why:** Repeated editor regrouping has made it too easy to lose, hide, or orphan controls and backed fields. A checked manifest makes control identity explicit and gives future agents a preflight checklist before touching the editor bar.

**Trade-off accepted:** Individual future control removals use manifest approval metadata rather than a durable decision entry by default. A new `docs/03-decisions.md` entry is still required when a control change alters product architecture, persistence, runtime ownership, or another durable product decision.

## DEC-090 - Page manager hierarchy controls use grip drag, Make Master, and Make Child

**Considered:** keep arrow buttons for page reordering and row-only Sub Master creation, or expose the hierarchy operations in the page-manager footer while making reordering direct-manipulation.

**Chose:** page rows use one three-dot grip handle for drag reordering. Dragging a Sub Master moves its full block, dragging a Global child moves only that page and skips Sub Master blocks as units, and dragging a Sub Master child reorders only within its current sibling block. The footer exposes `Make Master` and `Make Child`: `Make Master` converts a selected non-master page into a Sub Master by freezing its current effective visual state into `envSnapshot`; `Make Child` is enabled only for a selected Sub Master and duplicates that master into a new child directly under it.

**Why:** Arrow controls were slower for larger page sets and hid the real grouped behavior. Footer controls make the authoring hierarchy explicit without changing the single-level Global -> Sub Master -> child model from DEC-079.

**Trade-off accepted:** Drag does not reparent pages across Sub Masters. `Make Child` does not convert arbitrary pages into children; it duplicates the selected master so the new child starts from the master's authored presentation state.

## DEC-091 - UI_EDITOR prototype package remains separate from the active app tree

**Considered:** merge parked `UI_EDITOR` / `UI_EDITOR_v1_0` prototype package history into active `main`, or keep that work separate from the current GeoSee app tree.

**Chose:** keep standalone `UI_EDITOR` prototype/package work separate. The active repo tree remains the Vite + React + TypeScript GeoSee app under `src/`, `projects/`, `docs/`, `tests/`, and current tooling. Parked `UI_EDITOR/` and `UI_EDITOR_v1_0/` package content must not be merged, resurrected, or used as active source unless a future request explicitly scopes that standalone package.

**Why:** The active app already owns the editor sidebar, runtime, project persistence, and verification pipeline. Mixing the separate UI editor package back into `main` would reintroduce obsolete package files and broad deletes/reverts from parked branch history.

**Trade-off accepted:** Any future UI editor package work needs an explicit branch/package task. Normal GeoSee editor work continues in the active app tree and should not mine the parked package branch for source unless the task asks for it.

## DEC-092 - Page manager footer compacts hierarchy actions

**Supersedes:** DEC-090 for page-manager grip orientation and footer layout only.

**Considered:** keep the vertical three-dot grip and a two-button hierarchy footer row, or compact the page-manager footer while keeping the direct-manipulation reorder model.

**Chose:** page rows keep one three-dot reorder grip, but the grip is horizontal and right-aligned after color and visibility controls. Page row action buttons use the same 28px target, 14px centered icon, and opaque tinted fill as the Global Settings add button, so the live 3D scene cannot tint identical controls differently through the translucent editor panel. While dragging, the source row remains in its original slot at 50% opacity, a floating page-row preview follows the pointer with the same editor-panel material and text styling, and the hovered target row shows a crisp insertion line on the before/after edge. The footer keeps add, duplicate, and reset as the top icon row. The lower footer row is `M`, `C`, and delete, with accessible labels/tooltips preserving `Make Master`, `Make Child`, and `Delete selected page`.

**Why:** The compact row keeps hierarchy actions and deletion on the same visual line while preserving the existing Sub Master behavior and confirmation semantics. The half-opacity source row preserves the original location, while the floating preview and insertion rule make the direct-manipulation reorder state visible before release.

**Trade-off accepted:** The visible `M` and `C` labels are abbreviated, so accessible names and tooltips carry the full action names.

## DEC-093 - Page manager action controls match Global Settings add geometry

**Supersedes:** DEC-092 for Page Manager action-button surface and geometry guard only.

**Considered:** keep page-row actions on a darker unselected surface, or make every enabled Page Manager action button match the visually accepted Global Settings add button.

**Chose:** enabled Page Manager action buttons use the Global Settings add-button treatment everywhere: 28px circular target, 14px centered icon, zero padding, opaque tinted fill `rgb(32, 36, 40)`, and stable accessible labels. Page accent swatches keep the same 28px target but remain page-accent filled. Disabled action buttons keep the opaque dark fill and signal disabled state through text/icon opacity.

**Why:** The accepted Global Settings add button is the reference control. Matching that geometry and surface prevents row-to-row apparent size or centering drift, especially over the translucent editor shell and changing scene colors.

**Guard:** Do not reintroduce translucent pale fills, selected-versus-unselected row action surface switching, or per-row button geometry differences in the Pages panel. Current docs should name `MOVE_PAGE_BLOCK` for page reorder behavior rather than the historical `REORDER_PAGE` reducer name. UI docs and focused Page Manager tests must be updated with any future Page Manager action-button geometry change.

## DEC-094 - Staff Page Archive is an editable authoring shelf, not delete recovery

**Supersedes:** DEC-079, DEC-090, and DEC-092 only where those entries assume a Sub Master and all of its children must always remain visible, active, and contiguous inside `pageOrder`.

**Considered:** reuse `pages/_archive` as the visible staff archive, mark archived pages with `hidden`, or add an explicit staff archive list on the project manifest.

**Chose:** add a staff-only Page Archive concept backed by `project.json` `archivedPageOrder?: string[]`. `pageOrder` remains the active presentation sequence. `archivedPageOrder` is an ordered authoring shelf for draft or alternate pages that stay saved, selectable, previewable, and editable in the editor but are excluded from presenter next/previous navigation and audience playback. Archived page files remain ordinary `pages/<id>.json` files in the dev/editor workspace, but must be excluded from built client/project output. The existing `pages/_archive/` folder remains delete-recovery storage and must not be used as the staff archive or auto-imported into it.

**Why:** Staff need a place to keep draft pages without cluttering the active presentation tree. `hidden` only changes navigation visibility and keeps the row in the main Pages list. Reusing delete recovery would blur the difference between intentional draft storage and pages removed as a safety fallback.

**Sub Master behavior:** A Sub Master may live in the staff archive while one or more of its children remain active in `pageOrder`. The child keeps `parentMasterId` and continues inheriting from the archived master's `envSnapshot`. Making a child into a new Sub Master is the deliberate way to break that relationship. Active children of an archived master are no longer required to appear contiguously under the master row, because the master row is not in the active presentation list.

**UI guard:** The Archive affordance belongs below the Page Manager footer, aligned to the three-button footer column. Clicking the Archive header toggles reveal/collapse; dropping a page onto the header archives that page without toggling reveal state. Archived rows render as full page rows. `M` and `C` relationship badges appear at the start of master/child row names in the group accent color. Clicking a `C` badge reveals and pulses its master row, opening Archive if needed, but does not select it. Clicking an `M` badge reveals and pulses the first tied child row, preferring active Pages before archived rows, but does not select it.

**Trade-off accepted:** The inheritance graph can reference a master outside the active presentation sequence. Implementation must therefore distinguish active-page controller indexes from all editable pages and must resolve Sub Master inheritance against active plus archived pages, not only `pageOrder`.

**Build/export guard:** Static/client builds and future export packaging must emit `pageOrder` pages only. `archivedPageOrder` and archived page JSON are authoring-only state. Build or export code that copies project folders must filter archived page ids and omit archive-only page files from shipped output.

## DEC-095 - Authoring scene edits are scoped by selected page target

**Supersedes:** DEC-079 and DEC-094 only where their implementation notes could imply that editor scene controls write through a single global or active-index-only path.

**Considered:** keep scene controls writing to the current active page index, or route scene writes through the selected authoring target across Global Settings, active pages, archived pages, Sub Masters, and Sub Master children.

**Chose:** editor scene controls must write through selected authoring target semantics. Global Settings writes `environment.scene`. A selected Sub Master writes its local `envSnapshot.scene`. A selected normal page or Sub Master child writes page-local `sceneOverrides`. Archived pages follow the same rules as active pages: they remain editable and previewable by id, but they do not enter presenter next/previous indexes. Selecting an active page after an archived preview must force-apply that active page's resolved presentation state even when the active numeric `currentIndex` is unchanged.

**Why:** Light/dark, atmosphere, and other scene controls are authoring state. Changing them on a normal page or child page must create a page-local override, while changing them on a Sub Master must update the inheritance source for its children. Global scene edits should remain global only when the author is editing Global Settings.

**Render-stack guard:** The selected page render path must trace through `environment.scene`, Sub Master `envSnapshot.scene`, render preset `scenePatch`, page `sceneOverrides`, layer styles, topo material authority, active asset URL/cache key, shader/material, and mesh geometry before visual-scene fixes. `PageController.resolvePresentationState` remains the inheritance merge point. The scene application order remains resolved environment, visibility/styles, page scene, and overlays; this decision does not change topo material, texture URL, bounds, public clip, edge fade, edge outline, or geometry authority.

## DEC-096 - Background and fog blend through an environment-scene transition owner

**Supersedes:** DEC-086 only where it could imply that page-transition scene blending is limited to `main-camera/cinematic-post` numeric post fields.

**Considered:** keep renderer background and fog as final-commit environment state, or add a narrow page-transition owner for background/fog scene channels.

**Chose:** background color, fog color, and fog density blend over the target page's `transition.duration` and `transition.easing` through a dedicated environment-scene transition owner. The frame path updates renderer clear color, `scene.background`, `THREE.FogExp2`, topo fog uniforms, layer fog density, and fog-driven post tint before cinematic post-processing renders the frame. Disabled fog maps to density `0` during the blend; the final enabled/disabled state still lands through the normal target `applyEnvironment(...)` commit.

**Why:** Dark/light and fog handoffs are resolved scene mood channels, not page fixtures. Leaving them to the final environment commit caused a visible snap after otherwise smooth camera/post/layer transitions.

**Trade-off accepted:** This is not a full scene mood interpolation system. Terrain light-mode ramps, lighting colors/intensities, visible sun state, material preset identity, texture URL/cache key, bounds, public clip, edge fade, edge outline, shader choice, and geometry remain discrete unless a later decision explicitly expands the environment-scene transition owner. Background/fog must stay outside `LayerTransitionKind` and outside the cinematic-post policy list.

## DEC-097 - Scene section planes and frames clip all visible topo context

**Considered:** keep DEC-077's per-style topo opt-in behavior, or make scene section planes and section-frame crops apply to all visible targeted render content by default.

**Supersession scope:** This supersedes DEC-077 for terrain/topomap surface pixels, satellite/orthophoto imagery, terrain-composited overlays, longitude/latitude graticule lines/ribbons/labels, topo labels, topo legends, and topo branding.

**Chose:** scene section planes and section frames clip targeted topo context by default. This includes terrain/topomap surface pixels, satellite/orthophoto imagery sampled by the terrain shader, terrain-composited overlays, longitude/latitude graticule lines/ribbons/labels, topo labels/legends, and topo branding. Existing target-scope behavior remains: `all-visible` clips all visible content, while `selected-targets` clips only selected layers/products.

**Why:** Authors expect section tools to cut the complete visible scene, not only MT/seismic/data meshes. Satellite imagery is sampled inside the terrain shader, so the terrain shader must consume the shared scene-section uniforms for section planes and frames instead of relying on ordinary `material.clippingPlanes`.

**Trade-off accepted:** `EditableStyle.topoSectionable` remains readable as deprecated compatibility state, but it no longer controls whether topo context participates in section clipping. This supersedes DEC-077 for default topo-context sectioning and the editor opt-in checkbox. DEC-071 and DEC-077 remain historical for graticule composition, edge-aware behavior, public surface clip composition, and helper transition stability where those clauses do not conflict with this default sectioning rule.

## DEC-098 - Scene section masks and studio controls transition as scene overlay channels

**Supersedes:** DEC-071 and DEC-076 only where they could imply that sectioned render content may snap to the target mask while helper visuals fade separately, or that section-frame outline/control handles may be occluded by scene content in editor/studio views.

**Considered:** keep scene section masks as final-commit clipping state with helper-only fades, or make section masks and section helper opacity transition-aware scene channels.

**Chose:** scene section masks are transition-scene channels, not `LayerTransitionKind` values. Compatible same-frame section changes interpolate numeric style values. Incompatible section-frame, target, enable-state, or target-scope changes use a dual-mask alpha fade, evaluating the source and target section masks independently and blending final alpha as `lerp(sourceMaskAlpha, targetMaskAlpha, easedProgress)` on the target page's `transition.duration` and `transition.easing`. Section object outside-opacity maps are continuous opacity channels and fade on the same transition clock. Transition frames update material/shader uniforms and helper opacity only; helper rebuilds and cut-ISO refreshes remain start/final-commit work. Helper snapshots are allowed only when both source and target pages have active section helpers; source page section-frame studio controls must not fade into inactive or unrelated target pages.

**Studio overlay guard:** Section-frame outlines and push/pull control cones are editor/studio controls. They must stay in the transparent render queue with depth testing disabled and use the top scene-section control render order so terrain, topo/satellite imagery, Section ISO, and transparent data products cannot cover them while authoring.

**Why:** Sectioned content uses outside-opacity settings as presentation state. Snapping the mask while the rest of the page transition eases creates a visible mismatch, especially across pages that add/remove frames or change hidden-object opacity. Keeping frame controls topmost preserves direct manipulation over clipped terrain and transparent products.

**Trade-off accepted:** This decision does not animate terrain material preset identity, texture URL/cache key, bounds, public surface clip settings, material edge fade, edge outline, shader identity, terrain geometry, lighting, sun visuals, or camera path. Those remain discrete unless a later decision expands the transition-scene owner.

## DEC-099 - Section ISO overlay roots crossfade during page transitions

**Supersedes:** DEC-098 only where it says cut-ISO refreshes remain start/final-commit work.

**Considered:** keep Section ISO bands and isolines as final full-apply rebuilds, or make their derived overlay roots participate in the page transition clock.

**Chose:** Section ISO overlay roots are transition-scene derived entities. During page navigation, current Section ISO roots are snapshotted before target style application, target roots are built once and attached at the current Section ISO transition opacity, and source/target roots crossfade on the target page's `transition.duration` and `transition.easing`. Enter transitions fade target roots from `0` to authored opacity; exit transitions fade source roots to `0`; geometry/identity changes crossfade source and target roots. Delayed height-sampler rebuilds must attach at the current transition opacity, not full opacity.

**Why:** Section ISO bands and lines are derived geometry, not just material uniforms. Leaving target cut ISO refresh to final full apply caused bands and isolines to appear in one frame even while section masks and helper opacity eased correctly.

**Trade-off accepted:** This is opacity/crossfade smoothing, not per-frame contour geometry morphing. Terrain material preset identity, texture URL/cache key, bounds, public clip, edge fade, edge outline, shader identity, terrain geometry, lighting, sun visuals, and camera path remain outside this transition owner.
