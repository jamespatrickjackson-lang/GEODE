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

**Superseded in part by DEC-147:** L5/L11 sections may use trace-header-derived
State Plane-to-UTM paths when those coordinates are plausible. The approximate
registration guard still applies; precise registration must not be claimed
without control-point validation.

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

## DEC-100 - Scene section transitions do not bleed into inactive target pages

**Supersedes:** DEC-098 and DEC-099 only where they allow active-to-inactive section exit fades to carry source page section masks, helpers, frame controls, ground traces, or Section ISO roots into a target page with `sceneSectionEnabled !== true`.

**Considered:** keep source section masks and derived Section ISO roots fading out across unrelated target page transitions, or make section transition smoothing target-active only.

**Chose:** section transition smoothing is target-active. Active-to-active section changes keep dual-mask alpha fades, helper crossfades, and Section ISO root crossfades. Inactive-to-active section changes may fade the target section state in. Active-to-inactive and active-to-unrelated transitions must apply the inactive target section state at transition start, must not create source helper snapshots, and must not snapshot or preserve Section ISO transition roots. Transition interruption must discard transition-owned Section ISO roots instead of promoting target roots to full opacity.

**Why:** An inactive or unrelated target page is authored as unsectioned. Showing source page section cuts, helper controls, frame outlines, cones, ground traces, or Section ISO roots during that target transition reads as page bleed, even when the fade is technically smooth.

**Trade-off accepted:** Exit transitions from section pages are less visually continuous when the target page has no active section. That is intentional: no section visual should appear on a target page that does not own section state. Active-to-active and inactive-to-active smoothing remain intact.

## DEC-101 - Editor saves reject stale disk snapshots

**Supersedes:** DEC-022 only where the dev-only write endpoint previously allowed unconditional project file overwrites.

**Considered:** keep trusting the open editor's in-memory dirty entities as write authority, or require every saved project file to match the disk state loaded by that editor before the write batch commits.

**Chose:** editor saves must carry per-file expected disk content into `/api/write-batch`. The dev author-write endpoint must reject any file whose current disk content no longer matches that expected snapshot. The editor must log these as `[editor] save conflict`, leave dirty state in place, and surface a save error instead of clearing dirty bits. A reload is the recovery path because the disk has a newer project state than the open editor.

**Why:** Global Settings edits persist `environment.json` as a whole entity. An editor tab opened before a source or agent change can hold a stale Global Settings environment.json snapshot and later overwrite newer MT full-density defaults, making duplicated or new pages inherit the old cloud opacity, point size, or inclusion mode. Stale writes are a persistence conflict, not a rendering or duplication behavior.

**Guard:** `write-file` and `write-batch` both accept `expectedContent`. Batch writes must validate every expected snapshot before writing temp files or renaming targets. Editor save code tracks known disk content for project, environment, page, and overlay files; JSON comparison is semantic, while overlay text comparison is exact. Future editor save paths must either participate in this precondition model or explicitly document why a direct write is safe.

## DEC-102 - Global Settings is virtual page 00 in editor navigation

**Supersedes:** DEC-095 only where selected Global Settings could be visually treated as the first authored page through the presenter overlay and bottom navigator.

**Considered:** keep the page controller's active index as the only navigation source, or make the editor-selected Global Settings sentinel behave as a virtual page before the active `pageOrder`.

**Chose:** in editor mode, selected Global Settings is page `00` for navigator display and page-forward semantics, but it is not a renderable `PresentationPage`. Global Settings renders no presenter overlay card. The bottom navigator label shows `00. Global Settings`; clicking Next selects and navigates to the first visible authored page. Clicking Previous from page `00` selects and navigates to the last visible authored page, matching the existing wraparound navigation model.

**Why:** The editor opens on Global Settings so global controls are immediately available. Showing page 1's overlay card while the selected authoring target is Global Settings made the app appear to be on page 1 while navigation logic treated the first active page as already current, so a forward click skipped to page 2.

**Guard:** `OverlayDisplay` must suppress card panel instances when the selected editor target is `ENVIRONMENT_SENTINEL`. `NavControls` must branch on the same sentinel, show the `00. Global Settings` label, and select the first visible authored page before calling `goto(firstVisibleIndex)` for Next from page `00`. Source and browser checks should cover both the no-card boot state and the Next-to-page-1 transition.

## DEC-103 - Hidden seismic layers do not load product payloads

**Supersedes:** DEC-086 only where eager project-layer initialization implied that hidden seismic product data could be fetched at scene mount.

**Considered:** keep the seismic browser's manifest loader preloading its default product, or make seismic product payloads lazy and visible-state driven.

**Chose:** the seismic browser loads manifest and navigation metadata at layer initialization, but amplitude section and raymarch volume payloads follow the `visible-style-request-only` policy. Product payload loading is allowed only when the seismic layer is effectively visible and the requested product is enabled by product visibility state. A selected product id alone is not enough to fetch data when every product is disabled or the parent layer is hidden.

**Why:** Initial MT pages do not need seismic sample or volume `.u8` payloads. Eager hidden-product loading caused hidden seismic products to fetch and decode during page boot, increasing browser CPU, GPU memory pressure, and network churn even when the visible page had no seismic content.

**Guard:** `loadSeismicBrowser` must not call `seismicEnsureProductsLoaded([manifest.defaultProductId], ...)` before returning its runtime group. `applySeismicBrowserStyle` must gate product loads on `group.visible === true`, non-empty requested product ids, and product-enabled state. Source and browser audits should flag repeated project payload requests from hidden seismic layers.

## DEC-104 - Vite source chunks stay at async app boundaries

**Considered:** raise Vite's chunk-size warning limit, manually slice many scene/editor source folders, or add narrow code-splitting at natural async boundaries.

**Chose:** keep `chunkSizeWarningLimit: 600` and split only along boundaries that do not cut through mutually dependent runtime code. Scene loader modules build as the `app-scene-loaders` source chunk. `EditorRoot` is loaded through a React `lazy` boundary from `EditorChrome`, while the existing scene mount remains a dynamic `import("./scene")` from `App`. Vendor chunks remain separate for React, Three core, Three examples, raster decoding, markdown, animation, and remaining shared vendor code.

**Why:** The large build chunks came from the editor and Three.js scene runtime, not from page JSON or project payload duplication. Broad manual source chunks removed the large-chunk warning but introduced Rollup circular chunk warnings because scene styles, sectioning, topo runtime, page controller, editor controls, and scene loaders cross-import shared runtime state. Narrow async-boundary splitting keeps the production chunks below the guard without creating circular chunk output.

**Guard:** `vite-source-code-splitting-source.test.mjs` must cover `sourceManualChunk`, the `app-scene-loaders` route, `EditorRoot` lazy loading, type-only `SceneManager` use in `layerLoaders`, and the unchanged 600 kB warning limit. Build verification must report no Vite large-chunk warning and no Rollup circular chunk warnings before claiming this issue fixed.

## DEC-105 - Section legend mirrors per-axis editor controls

**Supersedes:** DEC-060 only where built-in X/Y/Z `sceneSectionFrames[].legendVisible` could hide quick legend rows or scene helper controls.

**Considered:** keep `legendVisible` as the shared quick-legend/helper gate, keep one global Gizmo/P Controle toggle, or make built-in section axes expose the same page-local controls in both the editor header and quick legend.

**Chose:** built-in X/Y/Z section axes use `Show`, `Flip`, and `Controls`. `Show` is `sceneSectionPlanes.<axis>.enabled` and controls the actual section cut. `Flip` is `sceneSectionPlanes.<axis>.invert`. `Controls` is `sceneSectionFrameByAxis.<axis>.controlsVisible` and hides only outlines plus push/pull handles. The quick legend always lists X/Y/Z when the section legend is visible and mirrors the selected authoring page. It also exposes per-axis Scale axes and X/Y-only Ground trace controls.

**Why:** The old `legendVisible` field mixed three concerns: whether a row appeared in the quick legend, whether outlines/handles rendered, and whether an enabled section looked available from the viewport legend. Duplicate pages could keep a section cut on while hiding its only enabled row, so the quick legend appeared to contradict the editor. A per-axis Controls field keeps the section cut, helper controls, ground trace, and scale axes independent.

**Guard:** built-in X/Y/Z frame entries must not persist `legendVisible`. Existing built-in values are migrated to `sceneSectionFrameByAxis.<axis>.controlsVisible` when they were false, then removed. `validate-project-pages` rejects built-in `legendVisible`, and `scene-section-legend-contract-source.test.mjs` covers the quick legend/editor/runtime mapping.

## DEC-106 - Section ISO quick legend separates availability from state

**Considered:** make every Section ISO quick icon reflect only its own stored toggle state, let controls opener buttons reflect whether their popout is open, or separate parent availability from child state in the quick legend.

**Chose:** Section ISO quick rows use three visual states. Parent buttons (`ISO Volume`, `ISO Section`) show the feature on/off state. Controls opener buttons show row availability, not popout-open state: volume controls are full white when `ISO Volume` is on, and section controls are full white when `ISO Section` is on. State toggles (`Remove empty`, `ISO Lines`, `ISO Bands`) show their own stored state only while their parent row is on; otherwise they render gray/off even if a stored detailed setting is true.

**Why:** The quick legend is a compact editor mirror. A controls opener that turns gray while its parent feature is active reads as unavailable, even when it can still be selected. Popout-open state is interaction chrome, not the authored feature state. Separating availability from stored toggle state keeps the legend aligned with the editor and prevents active ISO Section controls from looking disabled.

**Guard:** `SectionIsoLegend.tsx` must keep controls opener styling on an availability helper and state toggles on a separate state helper. `scene-section-legend-contract-source.test.mjs` covers the helper split, `section-iso-configure`, `section-iso-volume-controls`, and durable doc anchors in this decision plus `UI-Visual-Standards.md`.

## DEC-107 - Compact quick legends use shared geometry

**Considered:** keep Scene Section, Section ISO, and MT threshold boundary quick legend button geometry local to each component, or centralize the primary pill, icon circle, gap, inactive gray, and color-alpha rules.

**Chose:** compact quick legends use the shared helpers in `src/ui/legendStyles.ts`. Primary pills are fixed at `108px` by `28px`, centered, `11px` technical-mono text, dark text/icons, and no outline. Icon circles are fixed at `24px` with centered `14px` icons. Quick rows use the shared `6px` horizontal gap, stacked quick rows use the shared compact vertical gap, inactive buttons use `rgba(128, 134, 145, 0.38)`, and color transparency uses the shared `colorWithAlpha()` helper.

**Why:** the quick legend is one reusable viewport control surface. Local geometry drift made MT thresholds left-aligned and smaller than Scene/ISO pills, and made icon alignment regress without a shared source contract.

**Guard:** local quick-legend button geometry is not allowed for Scene Section, Section ISO, or MT threshold boundary quick legends without a documented decision-log exception. `scene-section-legend-contract-source.test.mjs` must verify the shared `legendStyles.ts` helpers, component imports, centered MT threshold buttons, centered Scene Section flip icon path, and this durable docs/agent guard.

## DEC-108 - MT resistivity title controls cloud visibility only

**Status:** superseded by DEC-109.

**Considered:** keep the MT resistivity title static, make `Full-density` and `Volume` target buttons act as visibility toggles, or make the title a narrow master visibility toggle for the heavy cloud-like MT sources.

**Chose:** the MT resistivity title is the cloud master. It toggles only `utah-forge-mt-resistivity-full-density` and `utah-forge-mt-resistivity-volume`. Turning it off hides those two layers and collapses the legend body to title-only. Turning it on forces those two layers visible for the current authoring target and selects the full-density point-cloud ramp target. The target selector buttons remain scalar ramp selectors and use clear labels: `Full-density points`, `3D volume`, `Authored slices`, and `QA subset`.

**Why:** authors need a quick clarity toggle for the dense MT point cloud and 3D volume without disturbing Section ISO bands/lines, scene sections, threshold boundaries, authored slices, or QA preview. The former `Full density` / `Volume` labels looked like show/hide buttons even though they only changed which scalar ramp was being edited.

**Guard:** the cloud master layer tuple must contain only full-density points and 3D volume. It must not include slices, QA preview, threshold surfaces, section planes, Section ISO helpers, top surfaces, or project/page fixture-specific ids. Full-density point-cloud scalar sliders must keep the all-valid source inclusion guard unless `scalarInclusionMode === "thresholded"`. `mt-resistivity-legend-cloud-toggle-source.test.mjs` covers this contract.

## DEC-109 - MT resistivity point-cloud legend separates volume

**Status:** superseded by DEC-110.

This decision supersedes DEC-108.

**Considered:** keep the prior MT title cloud-master behavior, move volume into the same quick bar under a different label, or make the MT quick legend point-cloud-only and leave volume to its own controls.

**Chose:** the viewport bar is named `3D MT resistivity point cloud`. Its title button toggles only `utah-forge-mt-resistivity-full-density`. The controls button opens full-density point-cloud controls. `utah-forge-mt-resistivity-volume`, slices, QA preview, Section ISO, scene sections, and threshold boundaries are not toggled, selected, restored, or described by this legend.

**Why:** the dense full-density point cloud is the clarity toggle authors need in this legend. Volume is a different render product and needs a separate legend/control owner instead of being hidden by a point-cloud title.

**Guard:** `UTAH_FORGE_MT_RESISTIVITY_POINT_CLOUD_LEGEND_LAYER_IDS` must contain only the full-density point-cloud layer. The point-cloud legend must keep the existing spectrum math and respect effective page/environment inclusion mode: thresholded pages may filter, while all-valid pages keep valid source points drawn. Full-density sliders must still route through `scalarInclusionFilterActive` so filtering happens only when `scalarInclusionMode === "thresholded"`.

## DEC-110 - MT Cell Points legend separates Full Cloud and Spectrum views

This decision supersedes DEC-109.

**Considered:** keep `3D MT resistivity point cloud` as a single title-plus-controls bar, make Full Cloud reset all scalar trim values to the source range, or rename the legend to `MT Cell Points` and make Full Cloud/Spectrum separate view buttons over the same full-density layer.

**Chose:** the viewport bar is named `MT Cell Points`. Its title button toggles only `utah-forge-mt-resistivity-full-density`. `Full Cloud` is a view button that sets `scalarLegendVisible: false` and `scalarInclusionMode: "all-valid"`, hides the compact spectrum/ramp body, and closes spectrum controls without changing trim, feather, noise, opacity, point size, or color fields. `Spectrum` is a filter view button that sets `scalarLegendVisible: true` and `scalarInclusionMode: "thresholded"`, shows the compact spectrum/ramp body, and makes the controls button available for trim, feather, noise, color, inclusion, value legend, distance light, draw QA, and point size edits.

**Why:** authors need a quick way to see the complete MT cell-point cloud and a separate way to introduce a spectrum filter for selecting part of the scalar range. Resetting scalar fields when viewing the full cloud would destroy useful trim/feather work and could break the existing page-transition scalar tween path, but leaving thresholded inclusion active in Full Cloud would not show the full cloud.

**Guard:** `UTAH_FORGE_MT_RESISTIVITY_POINT_CLOUD_LEGEND_LAYER_IDS` must still contain only the full-density point-cloud layer. Full Cloud and Spectrum must write only `scalarLegendVisible` plus `scalarInclusionMode` and must not mutate visibility overrides, volume, slices, QA preview, Section ISO, scene sections, thresholds, or scalar trim/feather/noise/color fields. Spectrum mode intentionally opts the effective authoring target into thresholded filtering; Full Cloud intentionally restores all-valid inclusion while preserving the authored scalar window values for the next Spectrum use. Full-density sliders must keep routing through `scalarInclusionFilterActive`, and MT Cell Points scalar transitions must keep using the existing `full-density-scalar` path. No page-id, page-index, fixture-title, project page, or environment fixture special cases are allowed, and implementation must not edit project page or environment fixtures for this behavior.

## DEC-111 - MT Cell Points mode buttons are exclusive and slider-transitioned

This decision supersedes DEC-110 only where that decision allowed Full Cloud and Spectrum to behave like independent clickable toggles or allowed the mode switch to snap the full-density point index.

**Considered:** keep both mode buttons independently clickable, instantly flip `scalarInclusionMode`, or make Full Cloud and Spectrum a one-of-two mode group with a live scalar transition.

**Chose:** `Full Cloud` and `Spectrum` are mutually exclusive MT Cell Points modes. The selected mode is not re-selectable while active, and controls are available only in a settled Spectrum mode. Switching modes uses a local 1.5s slider-style scalar interpolation over the same numeric scalar fields used by spectrum handle drags: Full Cloud expands the live preview to a full scalar window and clears noise and scalar edge-line width before the final all-valid mode write, while Spectrum animates from the full scalar window back to the authored trim, feather, noise, and edge-line values before the final thresholded mode write.

**Why:** authors read Full Cloud and Spectrum as alternative views of the same point cloud, not independent toggles. Snapping from all-valid to thresholded filtering causes a point-index pop even though moving the spectrum sliders already proves the point cloud can transition through the scalar window smoothly.

**Guard:** final persistence still writes only `scalarLegendVisible` plus `scalarInclusionMode`. The live transition may temporarily apply numeric scalar preview values through `SceneManager.applyStyle`, and Full Cloud display must suppress scalar edge-line overlays by driving `scalarEdgeLineWidth` to `0` in the live/full-cloud display style. It must not persist trim, feather, noise, color, opacity, point size, edge-line settings, visibility overrides, volume, slices, QA preview, Section ISO, scene sections, thresholds, page fixtures, or environment fixtures. Do not add a new transition kind or mutate `scalarInclusionFilterActive`, `scalarFullDensityAllValidMode`, `SCALAR_TRANSITION_STYLE_FIELDS`, or the existing `full-density-scalar` page-transition path for this legend click. A stale local mode animation must be scoped to the effective page context and invalidated when that context changes, so an unfinished Full Cloud/Spectrum click cannot apply or persist an old page's style after navigation.

## DEC-112 - MT Cell Points Spectrum load preserves authored scalar fields

This decision extends DEC-111 for page-load behavior while the editor is selected on Global Settings/page 00.

**Considered:** repair Spectrum-authored pages by editing page fixtures, force users through the Full Cloud/Spectrum button transition on every load, or make the preview-environment page resolver preserve the authored MT Cell Points scalar fields that the scene needs for initial Spectrum rendering.

**Chose:** `UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS` preserves the full-density MT scalar window, color ramp, display range, edge-line, surface-mask, opacity, `scalarLegendVisible`, and `scalarInclusionMode` fields when `previewEnvironmentBase` strips unrelated page deltas. Spectrum-authored pages must therefore resolve into the same visual scalar style on initial load that the Full Cloud/Spectrum button transition can apply live.

**Why:** Global Settings/page 00 is a virtual editor target, but page navigation still needs the selected page to present its authored MT Cell Points Spectrum look. Stripping all full-density scalar fields except inclusion mode makes the viewport say Spectrum while the scene lacks the authored edge-line and scalar-window fields, so lines/details appear only after a manual mode click.

**Guard:** this is an app-level preview-resolution contract, not page authoring. Do not add page-id, page-index, fixture-title, project page, or environment fixture special cases, and do not edit `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`, or `projects/*/environment.json` for this behavior. Do not mutate `setMtCellPointsMode`, `scalarInclusionFilterActive`, `scalarFullDensityAllValidMode`, `SCALAR_TRANSITION_STYLE_FIELDS`, scalar edge overlay generation, or the existing `full-density-scalar` transition path for this load bug.

## DEC-113 - MT threshold boundary all-off maps inherit default visibility

**Considered:** repair pages that carry all MT threshold boundaries as false, keep canonical `mtSurfaceBoundariesById.*.visible = false` authoritative even when every boundary is off, or treat all-off boundary maps as empty/stale visibility state and fall back to legacy/default boundary visibility.

**Chose:** the MT threshold boundary resolver treats canonical boundary visibility as authoritative only when at least one canonical boundary is visible. If the canonical map has no visible boundary, the resolver uses legacy visibility only when legacy has at least one visible boundary; otherwise it falls back to default/environment boundary visibility. Hiding every threshold line should be done by hiding the threshold-boundary layer, not by leaving the layer visible with every boundary false.

**Why:** page-to-page navigation can otherwise land on a visible MT threshold-boundary layer with no boundary lines because disposable page state contains an all-false boundary map. That reads as a broken transition even though the render layer is present. The reusable product behavior should keep the line product visible when the layer is visible, without repairing page fixtures.

**Guard:** this is an app-level resolver rule in `mtSurfaceBoundaries.ts`. Do not fix missing MT threshold boundary lines by editing `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`, or `projects/*/environment.json`, and do not add page-id, page-index, or fixture-title special cases. Keep canonical per-boundary on/off behavior for states where at least one boundary is visible.

## DEC-114 - MT Cell Points Spectrum lines assert final target style after page navigation

**Status:** superseded by DEC-115.

This decision extends DEC-111 and DEC-112 for page-to-page navigation.

**Considered:** repair individual Spectrum pages, make users click Full Cloud and Spectrum after navigation, or make page-transition completion assert the final target effective style.

**Chose:** page-transition commit performs a final target-style assertion after commit tracing. The final target page visibility and effective styles are replayed through the normal scene style path so the full-density point cloud receives its authored `scalarLegendVisible`, scalar window, and scalar edge-line fields, and `applyScalarPreviewStyle` rebuilds `mt-scalar-edge-line-overlay`. The MT Cell Points quick legend derives its selected Full Cloud/Spectrum header state from the target authored mode, while using interpolated scalar style only for ramp and handle visuals during transitions.

**Why:** a Spectrum page with line controls on must land with the sketchy scalar edge/isoline overlay visible. Relying only on the scalar tween end frame or a later suppressed post-commit reapply can leave the point cloud in a target-looking ramp state without the edge overlay until a manual Full Cloud/Spectrum click reapplies the style.

**Guard:** this is app-level transition/UI code. Do not edit `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`, or `projects/*/environment.json`, and do not add page-id, page-index, fixture-title, or page-order conditionals. Do not change `setMtCellPointsMode`, `scalarInclusionFilterActive`, `scalarFullDensityAllValidMode`, `SCALAR_TRANSITION_STYLE_FIELDS`, scalar edge overlay generation, or the existing `full-density-scalar` interpolation. Header mode buttons must reflect the target authored mode; the controls button is available only when the target mode is Spectrum and no local mode transition is running.

## DEC-115 - MT Cell Points Spectrum lines use scalar transition ownership

**Status:** extended by DEC-116 for settled page-load and suppressed reapply
rebuilds.

This decision supersedes DEC-114 only where DEC-114 repaired missing Spectrum
edge lines by replaying final target visibility/styles after transition commit.

**Considered:** keep the final target-style assertion, special-case pages that
missed MT Spectrum lines, or make the page-transition classifier always register
the MT full-density scalar tween when authored Spectrum scalar fields differ.

**Chose:** MT Cell Points Spectrum line entry is owned by the existing
`full-density-scalar` page-transition path. When the full-density point cloud is
visible on both source and target pages and authored scalar fields differ, the
transition classifier records a scalar tween even if the scalar edge geometry is
not ready at setup time. Runtime ticks and async layer reapply then apply the
interpolated scalar style on the page-transition clock until the authored target
style is reached.

**Why:** final target-style replay made the edge/isoline overlay appear, but it
also cleared transition state and visibly popped the lines in after navigation.
The slider and Full Cloud/Spectrum mode paths already prove scalar edge width,
noise, and trim can move smoothly through `interpolatedScalarStyle`; page
navigation should use the same numeric scalar path rather than a commit-time
repair.

**Guard:** post-commit graph checks are observational and must not call
`applyEffectiveVisibilityForPage` or `applyEffectiveStylesForPage` as an MT line
repair. Do not edit `projects/*/pages/**`, `projects/*/overlays/**`,
`projects/*/project.json`, or `projects/*/environment.json`, and do not add
page-id, page-index, fixture-title, or page-order conditionals. Do not change
`setMtCellPointsMode`, `scalarInclusionFilterActive`,
`scalarFullDensityAllValidMode`, `SCALAR_TRANSITION_STYLE_FIELDS`, scalar edge
overlay generation, or the existing `full-density-scalar` transition kind.

## DEC-116 - MT Cell Points settled loads refresh only full-density target style

This decision extends DEC-115 for settled page loads and suppressed post-commit
page reapply.

**Considered:** bring back the broad final target-style replay, let the
post-commit PageController reapply stay fully suppressed, or apply only the
settled MT full-density target style when that reapply is suppressed.

**Chose:** when a settled post-commit page reapply is suppressed for the target
page, `SceneManager` may narrowly reapply only
`utah-forge-mt-resistivity-full-density` through `applyStyle(effectiveStyle(...))`.
That rebuilds `mt-scalar-edge-line-overlay` for Spectrum-authored pages whose
point-cloud geometry or scalar edge overlay was not ready during the first style
application. If a full-density scalar tween is active, the narrow refresh is
skipped so the page-transition clock remains the owner.

**Why:** removing the broad final replay fixed the visible jump, but it also
removed the settled safety net that built missing Spectrum edge lines after a
suppressed target-page reapply. A narrow layer-style refresh keeps page-load
correctness without clearing tweens, replaying visibility, rebuilding unrelated
layers, or editing disposable page fixtures.

**Guard:** this is app-level scene style repair only. Do not call
`applyEffectiveVisibilityForPage` or `applyEffectiveStylesForPage` from the
settled MT Cell Points repair path, and do not edit `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`. The transition path from DEC-115 remains
authoritative while scalar tweens are active.

## DEC-117 - MT resistivity cell terminology replaces metaphor labels

This decision supersedes DEC-110 through DEC-116 only for user-facing labels and
documentation terminology. Runtime mode keys, persisted fields, scalar math, and
transition ownership remain unchanged.

**Considered:** keep the authoring metaphors `MT Cell Points`, `Full Cloud`,
`Spectrum`, `trim`, `feather`, `noise`, `nuance`, and generic value/distance
labels, or rename the app-level controls to geophysics terms tied to
log10(resistivity_ohm_m) and the MT inversion cell-center model.

**Chose:** the viewport legend is named `MT Resistivity Cells`. The exclusive
mode labels are `All Valid Cells` and `Log10 Resistivity Window`. The editor
controls use `Filter by log10 resistivity`, `Window min/max log10(Ohm-m)`,
`Fade min/max log10(Ohm-m)`, `Lateral support filter`, `Ramp contrast`,
`Resistivity legend`, `Distance brightness`, and `Render count`. The
full-density target label is `MT inversion cell centers`.

**Why:** the current scalar values are log10(resistivity_ohm_m), and the
rendered full-density object is an MT inversion cell-center point cloud. Labels
should name the data and transform directly instead of using visual metaphors
that imply arbitrary color spectrum editing or generic point filtering.

**Guard:** this is an app-level terminology alignment only. Do not rename or
mutate `scalarLegendVisible`, `scalarInclusionMode`, `scalarFocus*`,
`scalarBlend*`, `scalarNoiseThreshold`, `scalarDistanceLightStrength`,
`scalarInclusionFilterActive`, `SCALAR_TRANSITION_STYLE_FIELDS`, or
`full-density-scalar`. Do not change source data, scalar transforms, threshold
conversion, transition logic, page fixture state, project fixture state, or
environment fixture state for this terminology change.

## DEC-118 - MT resistivity controls use model-cell and isoline terms

This decision supersedes DEC-117 only where DEC-117 still allowed render
metaphors such as point cloud, edge line, fade, rho, and generic volume density
to appear in user-facing app-level labels.

**Considered:** keep those remaining labels because they map to implementation
fields, or finish the source-level rename so visible controls use the same
geophysical vocabulary as the MT resistivity model.

**Chose:** visible MT resistivity controls use `MT inversion cell centers`,
`full-density model cells`, `Log10 Resistivity Window`, `Opacity ramp`,
`isoline`, `Band fill offset`, `Volume attenuation`, `Ray samples`, `Transfer
function`, `Volume threshold window`, `Iso-resistivity surfaces`, and
`Threshold log10(Ohm-m)`. Historical decision entries and runtime field names
remain unchanged unless a separate migration is approved.

**Why:** the source model is an electrical resistivity inversion in Ohm-m, with
the app displaying log10 resistivity and derived iso-resistivity geometry.
Visible copy should name the model cells, units, transfer function, and isolines
instead of renderer or metaphor terms.

**Guard:** this remains an app-level terminology change. Do not edit
`projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`. Do not rename persisted `scalar*` fields,
stable test ids, `scalarInclusionFilterActive`, `SCALAR_TRANSITION_STYLE_FIELDS`,
or `full-density-scalar`.

## DEC-119 - Capture Director v1 uses app-owned marketing capture

**Considered:** use browser display capture for all recording modes, build a full
deterministic processware exporter first, or add a smaller capture lab that keeps
marketing capture owned by the app renderer.

**Chose:** Capture Director v1 records scene-only marketing output from the
WebGL canvas, records scene-annotation and presentation output through an
app-owned composited Canvas 2D capture surface, and reserves browser display
capture for Full UI/tutorial recordings only. The v1 toolbar exposes capture
mode, 1080p/1440p/4K resolution presets, 30/60 FPS, start/stop, elapsed state,
and downloadable WebM output. `CaptureRecipeV1` defines the deterministic export
spine for scene state, camera keyframes, layer visibility/styles, environment
state, quality preset, supersampling, fixed FPS, and duration.

**Why:** marketing footage needs clean scene output and intentional
capture-native overlays rather than ordinary DOM clutter or loose screen grabs.
The capture lab should be real enough for preview recordings while leaving the
future frame-sequence exporter free to render fixed-timestep frames without
depending on live browser timing.

**Guard:** display capture remains tutorial/full-app only. Scene-only,
scene-annotation, and presentation captures must use the scene canvas or
composited capture canvas. Capture sizing must restore the live renderer,
camera aspect, postprocessing size, and line-material resolution after recording.
Do not edit `projects/*/pages/**`, `projects/*/overlays/**`,
`projects/*/project.json`, or `projects/*/environment.json` for capture mode
behavior. The deterministic frame-sequence exporter is not complete in v1.

## DEC-120 - Capture frame-sequence exporter writes browser frames

This decision extends DEC-119 with the first deterministic export implementation
step. The encoder remains deferred.

**Considered:** wire FFmpeg/WebCodecs immediately, record deterministic exports
through `MediaRecorder`, or make the next step a browser-frame sequence writer
that produces fixed-timestep still frames first.

**Chose:** the deterministic exporter consumes `CaptureRecipeV1`, rejects
`full-ui` display capture, applies recipe layer visibility/styles, sizes the
renderer to the recipe resolution times `supersampleScale`, and renders frames
at `frameIndex / fps` through `sceneHandle.renderCaptureFrame`. Each frame is
copied from the WebGL canvas to an output canvas, optionally receives
capture-native overlays for annotation and presentation modes, and is encoded as
a PNG or WebP frame with blob URL metadata. The result keeps recipe provenance,
frame count, resolution, FPS, supersampling, per-frame names, and a cleanup
method for object URLs.

**Why:** frame sequences are the right deterministic marketing-export spine.
They separate fixed-time rendering, renderer restoration, and image quality from
later video encoding decisions, and they avoid reusing realtime `MediaRecorder`
semantics for deterministic output.

**Guard:** fixed-frame export must not use `Date.now()`, `performance.now()`, or
`requestAnimationFrame` for frame time. Export cleanup must restore layer
visibility, layer styles, camera pose, renderer size, camera aspect,
postprocessing size, and line-material resolution even when frame encoding
throws or export is aborted. Browser display capture remains tutorial/full-app
only; the frame-sequence exporter does not support `full-ui`. FFmpeg/WebCodecs
encoding remains the next task and must consume the frame sequence rather than
replace it with realtime capture.

## DEC-121 - Capture frame-sequence encoder consumes deterministic frames

This decision extends DEC-120 with the first video-encoding boundary. The
encoder does not replace fixed-frame rendering.

**Considered:** wire video export back into realtime preview recorders, make
FFmpeg pull from the WebGL canvas directly, or keep encoding as a downstream
step that consumes `DeterministicFrameSequenceResult`.

**Chose:** the first encoder boundary validates a complete deterministic frame
sequence, writes sanitized PNG/WebP frame names into an injected FFmpeg virtual
filesystem runtime, and builds app-owned MP4/H.264 and WebM/VP9 marketing
presets. A browser FFmpeg adapter lazily loads `@ffmpeg/ffmpeg`, maps the
virtual filesystem calls required by the encoder, forwards abort signals, and
exposes disposal for the FFmpeg worker. The Capture Director toolbar exposes
deterministic MP4 and WebM export for scene marketing modes, frame-render
progress, and cancellation while leaving realtime WebM preview recording
intact. Encoding returns a video blob URL and cleanup hook for the encoded
output while leaving frame-sequence ownership explicit.

**Why:** deterministic marketing export needs a clean split between fixed-time
scene rendering and video muxing. The renderer has already handled camera,
visibility, overlays, supersampling, and restoration before the encoder runs.
The encoder should therefore validate those frames, preserve FPS and dimensions,
and provide reproducible FFmpeg arguments without reopening browser timing or
display-capture paths.

**Guard:** the encoder accepts only `DeterministicFrameSequenceResult`.
It must reject `off` and `full-ui` sequences, must not use realtime preview
capture APIs, and must not call scene rendering APIs. The browser FFmpeg adapter
must remain lazy and downstream-only. Progress detail, cancellation controls,
and format selection belong in the provider/toolbar layer. Background-worker
orchestration beyond the FFmpeg worker and WebCodecs muxing remain later
implementation steps.

## DEC-122 - Capture preview recorders reject empty realtime output

This decision extends DEC-119 with the 4K realtime preview failure contract.
Deterministic export remains the final-quality marketing path.

**Considered:** allow browser `MediaRecorder` to return a downloadable empty
WebM when a high-resolution realtime preset fails, silently downgrade 4K60
preview to a lower preset, or fail the preview recording cleanly while keeping
the selected preset explicit.

**Chose:** realtime preview recorders must flush pending data with
`MediaRecorder.requestData()` when available, request canvas capture frames from
`CanvasCaptureMediaStreamTrack.requestFrame()` when available, and reject
zero-byte output before creating or keeping a download URL. Scene-only capture
subscribes to the scene after-render hook so direct canvas capture can request a
frame for rendered scene updates. Composited annotation and presentation capture
also request an initial composited frame after recorder start. The provider
clears stale preview output, restores capture sizing, returns capture mode to
`off`, and displays a resolution/FPS-specific error when no video data is
produced.

**Why:** 4K60 realtime preview depends on browser encoder capacity and can fail
without useful `MediaRecorder` errors. A zero-byte file is not a valid marketing
output and should not be offered for download. Failing visibly preserves the
author's selected preset and points final 4K marketing work toward deterministic
fixed-frame export rather than masking encoder limits with a silent downgrade.

**Guard:** do not silently downgrade realtime preview presets. A failed
realtime recording must not leave app chrome hidden, renderer size overridden,
stream tracks running, or stale download links visible. Deterministic
frame-sequence export remains the correct next implementation step for reliable
high-quality 4K marketing video.

## DEC-123 - Capture render-out production separates preview from output

This decision extends DEC-119 through DEC-122 with production deterministic
export controls.

**Considered:** keep one resolution selector for both realtime recording and
final export, upscale recorded WebM previews into MP4 files, or split realtime
preview from deterministic render-out.

**Chose:** Capture Director now treats realtime recording as preview and
deterministic export as render-out. Preview recording remains limited to
1080p, 1440p, and 4K. Render-out video and app-owned Screen Capture use a
separate render-output resolution with 1080p, 1440p, 4K, and 8K. `8K` is
UHD `7680 x 4320` and is deterministic-only. `CaptureRecipeV1.resolution`
means final render-output resolution; optional `previewResolution` is provenance
only. Capture recipes can be saved and loaded as portable JSON files, and
Capture Director owns session-scoped camera keyframes for repeatable marketing
exports. Browser FFmpeg core assets are self-hosted from `@ffmpeg/core` under
`/runtime/ffmpeg/`; deterministic MP4/WebM encoding must not depend on CDN
core defaults.

**Why:** marketing output needs a render pass, not a screen recorder artifact.
Authors can record a lower-resolution preview to frame timing and then render
the same scene state, overlays, recipe, and camera keyframes to a higher output
resolution. Still Screen Capture uses the same deterministic scene sizing,
overlay, validation, and cleanup path so 8K stills preserve app-owned visual
state without DOM/browser screenshots.

**Guard:** realtime `MediaRecorder` preview must not expose 8K and must not
silently upscale. Render-out and Screen Capture must validate output size,
supersampling, and WebGL/browser limits before mutating scene visibility,
styles, camera, renderer size, or postprocessing state. Recipe save/load remains
portable file state in this phase and must not write `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`. `full-ui` still capture remains a browser
display-capture tutorial path and must fail cleanly on permission denial.

## DEC-124 - Capture production uses max-detail exact-output rendering

This decision extends DEC-119 through DEC-123 and supersedes DEC-120 and
DEC-123 only where those entries allow supersampling/downsampling in
deterministic capture.

**Considered:** keep deterministic render-out quality as a supersampled browser
frame sequence, rely on realtime preview detail settings for final exports, or
make Capture Director final-output paths exact-size max-detail renders with an
external 8K still fallback.

**Chose:** Capture Director now separates four production areas: Realtime
Capture, Render Out, Still Capture, and Camera Path. Realtime Capture remains a
quick `MediaRecorder` preview path and may use live-app performance settings.
Render Out and Still Capture enter a max-detail fidelity lock, set renderer and
postprocessing dimensions exactly to the requested output, force renderer pixel
ratio to `1`, update line-material resolution to the exact output dimensions,
disable capture-system supersampling/downsampling, and restore every changed
renderer, camera, postprocessing, and overlay setting in `finally`. If a source
asset is already a preview artifact, capture uses the highest available source
and reports that provenance instead of reducing it further. App-owned 8K still
capture first attempts deterministic browser output; when browser/GPU limits
block a single-pass output, Capture Director creates a `CaptureStillRenderJobV1`
for the local tiled still renderer. Camera paths are Capture Director recipe
state only: spline keyframes, path JSON, realtime path preview, and deterministic
path sampling never write page camera fields or project fixtures.

**Why:** marketing render-out should be a render, not an upscaled recording or a
blurred preview pass. Exact-output max-detail rendering preserves point density,
line thickness, postprocessing sharpness, camera aspect, clipping, opacity, and
scene meaning at the selected final resolution. The 8K still path needs a
practical fallback because live browser WebGL/canvas limits can prevent a single
7680 x 4320 render surface even when a tiled local render can produce the file.

**Guard:** no deterministic Render Out or Still Capture path may silently
downsample, upscale a realtime preview, expose 8K as realtime recording, leave
the camera-path overlay in exported scene output, write `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`, or alter authored visual presets. The external
still renderer is an output fallback, not a project persistence path.

## DEC-125 - Capture Director Camera Path v2 is recipe-only production state

This decision extends DEC-124 for the Camera Path production area.

**Considered:** keep camera paths as v1 spline keyframes only, store timeline
camera staging in page camera fields, or make Camera Path v2 a Capture
Director recipe timeline with explicit node and segment semantics.

**Chose:** Camera Path v2 is a capture-recipe timeline. A timeline contains
keyframe nodes that hold authored camera poses and transition nodes that define
the motion boundary between keyframes. Segment transition time belongs to the
segment/transition node, and hold time belongs to the keyframe node. Lower
timeline scrub and playback sample the same deterministic timeline used by
Render Out, so preview playback, timeline scrubbing, and frame-sequence export
resolve identical camera poses for the same recipe time. Look modes are explicit
per node/segment state: explicit camera target, fixed world focus point,
follow-bound focus binding, or path tangent look where supported. Focus point
binding stores recipe references and offsets rather than mutating scene, page,
or project camera fields.

**Why:** production camera movement needs repeatable render timing and readable
marketing-shot semantics. Separating keyframe hold time from segment transition time
prevents a waypoint pause from becoming hidden interpolation state. Separating
keyframe nodes from transition nodes lets the lower timeline expose the same
structure that deterministic export samples. Keeping focus binding in the recipe
allows a path to follow a scene object or fixed point for marketing output
without converting that path into persistent page/editor persistence state.

**Guard:** Camera Path v2 state is recipe-only. Save/load may create portable
JSON files and object URLs, but must not write `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`. The v2 module/schema must preserve stable ids for
keyframe nodes, transition nodes, segments, look modes, focus bindings, lower
timeline scrub/playback controls, and deterministic exporter sampling. Render
Out must sample camera path time from fixed `frameIndex / fps` recipe time, not
from live clock APIs or page navigation side effects. The camera-path overlay is
a marketing setup preview and must remain out of exported scene output.

## DEC-126 - Capture Director camera track options and preview monitor

This decision extends DEC-125 for camera-path marketing setup preview controls.

**Considered:** keep camera track styling as hard-coded scene constants, store
preview controls in editor/page state, or make track display options part of the
Capture Director path/recipe state.

**Chose:** camera track line size, track color, selected color, target color,
focus color, handle scale, direction ray length, frustum visibility, look-ray
visibility, focus-lock ray visibility, node labels, timeline ghosting, and
preview monitor mode are Capture Director display options stored in
recipe/path JSON. The scene overlay renders node kind, camera position, travel
direction, look direction, focus-lock state, target/focus markers, and the
scrubbed sample while Capture Director is open. A floating preview monitor can
render the selected or scrubbed path camera view without changing the live
editor camera.

**Why:** camera-path marketing setup needs clear visual logic separate from final
marketing output. Authors must see how the camera moves and what it points at,
including focus-lock behavior, while retaining a clean exported scene.

**Guard:** camera track options and the preview monitor must not write page camera fields,
project fixtures, visual presets, `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`. The camera path overlay and preview monitor are
marketing setup aids and must remain out of exported scene output unless a future
explicit export-overlay option is added.

## DEC-127 - Capture Director Line2 camera overlay and external 8K still route

This decision extends DEC-124 through DEC-126 for the next Capture Director
production step.

**Considered:** draw the camera path overlay with ordinary `THREE.Line`
helpers, reuse browser single-pass still capture for every 8K output, or add a
production route that separates marketing setup overlay preview from final still
rendering.

**Chose:** the Capture Director camera path overlay uses the Three.js `Line2`
wide-line path for marketing setup preview so track width remains readable and
resolution-aware in the editor. The overlay is Capture Director display state
only and remains excluded from exported scene output. Still Capture first
attempts the exact-size browser render required by DEC-124; when browser or GPU
limits block 8K single-pass output, Capture Director creates a real
`CaptureStillRenderJobV1` and routes it to the external/local tiled still
renderer. The tiled renderer consumes the same recipe, scene state, camera
sample, overlay exclusions, and max-detail output contract as browser Still
Capture.

**Why:** camera-path marketing setup needs a visible path overlay without turning that
overlay into marketing output. 8K still output also needs a concrete render-job
route rather than a placeholder, browser screenshot, downsampled preview, or
fixture mutation. A tiled external fallback preserves the requested
`7680 x 4320` output when a single WebGL surface cannot be allocated.

**Guard:** do not write `projects/*/pages/**`, `projects/*/overlays/**`,
`projects/*/project.json`, or `projects/*/environment.json` for camera-path
overlay, still render jobs, tiled fallback setup, output provenance, or preview
state. Do not leave the Line2 camera-path overlay in exported scene output. Do
not expose 8K through realtime `MediaRecorder`, silently downsample, upscale
preview output, or mutate authored visual presets. Static checks and source
inspection only make this ready for visual check; use the exact status wording
`ready for visual check` until a running browser inspection or human review
confirms the rendered result.

## DEC-128 - Capture Director camera paths use rows, transitions, and timeline blocks

This decision tightens DEC-125 after the first Camera Path workflow repair.

**Considered:** keep path playback tied to the legacy keyframe list, serialize
empty draft paths into recipes, or make `CaptureCameraPathV2` the only editable
source for path rows, transition timing, playback, recording, recipe export,
overlay state, and lower-timeline display.

**Chose:** `CaptureCameraPathV2` is the canonical camera-path marketing setup model.
An empty v2 path is valid draft state but is not a renderable recipe path.
Still Capture and Render Out use the current camera pose when no explicit,
enabled, renderable path exists, and recipe snapshots serialize that state as
`cameraPath: null`. Numbered camera-view rows (`01`, `02`, `03`) own active
state, setup-overlay hidden state, node kind, hold time, look mode, focus
binding, jump/update/delete actions, and row selection. Transition containers
live between rows and own segment active state, setup-overlay hidden state,
transition duration, and easing. The lower timeline displays full-width hold
and transition blocks, plus position/look/focus lanes, and scrubs through the
same deterministic v2 sample path used by Render Out.

**Why:** camera-path marketing setup needs to behave like shot editing rather than a
flat list of unnamed keyframes. Empty drafts should not block still capture or
render-out. Per-row active/hidden semantics let an author test path structure
without deleting rows, while keeping overlay visibility separate from final
sampling. Transition containers make speed and easing visible where they occur,
and timeline blocks give direct control over how long camera holds and moves
last.

**Guard:** `enabled` controls participation in playback, realtime path
recording, deterministic render-out, Still Capture path sampling, recipe path
export, and legacy keyframe export. `hidden` controls authoring overlay visibility only.
Hidden enabled rows remain active in the path. Transition
nodes cannot hold. Disabled middle nodes are not automatically bridged unless
an explicit enabled segment exists. Play Path and Record Path Preview must use
v2 playback validation and must not start on empty, all-disabled, broken-route,
or zero-duration paths. Camera Path state remains recipe/path JSON state only;
do not write page camera fields, `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json` for row edits, transition edits, timeline scrubs,
focus picking, playback, or preview recording.

## DEC-129 - Capture Director camera paths separate temporal easing from geometric continuity

This decision extends DEC-125 through DEC-128 for future camera-path surfacing
work. Current production code remains `CaptureCameraPathV2` until a future V3
or compatible extension is implemented.

**Considered:** keep one generic transition easing control, overload
`segment.easing` to control both speed and path shape, or document separate
marketing-production tracks for time, geometry, focus distance, and equation overlays.

**Chose:** Capture Director camera paths separate temporal easing from
geometric continuity. Temporal easing controls speed, acceleration,
deceleration, and ramp profile along an already-defined path. Geometric
continuity controls curve shape and fairing between nodes using surfacing
language: `G0` positional continuity, `G1` tangent continuity, `G2` curvature
continuity, `G3` curvature-flow continuity, and `Gd` in/out influence distance.
Focus distance and aim geometry are a third independent track that resolves
free look vectors, path-tangent following, target blending, and recipe-local
focus locks. Equation overlays are editor/session display state for labels such
as `A`, `T`, `D`, `G`, `Gd`, temporal ramp graphs, tangent handles, influence
handles, and curvature combs.

**Why:** camera movement needs both animation timing and modeled path quality.
A soft speed ramp does not make a sharp rail geometrically fair, and a `G2` or
`G3` rail should not alter transition duration. Treating time easing, path
fairing, and focus distance as separate tracks lets authors build camera moves
with video-editor timing and surfacing-editor rail quality.

**Guard:** do not overload current `CaptureCameraPathSegmentV2.easing`; it
means temporal easing only. Do not implement `G0` through `G3` as a single
Catmull-Rom tension slider. Do not move explicit node positions when changing
fairing; fairing changes interpolation and handle influence around those nodes.
Do not write surfacing edits, equation-overlay state, focus-distance controls,
or direct-manipulation handles to page camera fields, `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`. Future V3 work must preserve V2 recipe
compatibility and keep equation overlays out of Render Out and Still Capture
unless a future explicit export-overlay option is added.

## DEC-130 - Capture Director Camera Path V3 is a surfacing-aware schema

This decision implements the DEC-129 surfacing model while preserving the V1/V2
capture/export contract.

**Considered:** overload `CaptureCameraPathV2.segment.easing`, add ad hoc
fairing fields to v2 segments, or introduce a discriminated v3 camera-path
schema with explicit timing, geometry, aim, and overlay tracks.

**Chose:** add `CaptureCameraPathV3` as a new discriminated camera-path schema.
V2 remains load-compatible and upgrades into V3 in Capture Director UI state.
The outer recipe remains `CaptureRecipeV1`; recipe `cameraPath` may be v1, v2,
v3, or `null` for an empty draft path. Recipe saves use V3 when the authored
path is renderable and still emit legacy `cameraKeyframes` for compatibility.

**Why:** V3 keeps temporal easing, geometric rail fairing, focus/aim geometry,
and equation overlays independent. `timeCurve` controls speed only.
`pathFairing` controls `G0`, `G1`, `G2`, `G3`, `Gd`, tension, bias, and handle
influence without moving explicit node positions or changing segment duration.
`aimGeometry` controls free direction, path-tangent following, focus-point
lock, target blending, fixed FOV, maintain-focus-size, and dolly-zoom behavior.
`equationOverlayOptions` controls marketing setup visualization without changing
marketing output.

**Guard:** V2 `segment.easing` remains temporal-only. Render Out and Still
Capture sample V3 through fixed `frameIndex / fps` and exclude equation
overlays by default. Equation overlays, direct-manipulation handles, surfacing
edits, focus-distance edits, and path playback remain Capture Director
session/recipe state only. Do not write V3 camera-path state to page camera
fields, `projects/*/pages/**`, `projects/*/overlays/**`,
`projects/*/project.json`, `projects/*/environment.json`, visual presets, or
snapshot-sensitive Utah FORGE files.

## DEC-131 - Capture Director Camera Path V3.1 uses node-owned spline controls

This decision repairs the first V3 surfacing implementation from DEC-130.

**Considered:** keep `Gd`, continuity, and fairing authority on individual
segments, add more per-segment correction rules, or move runtime rail geometry
to node-owned incoming/outgoing spline handles like standard DCC spline editors.

**Chose:** V3.1 keeps segment `pathFairing` fields for recipe compatibility and
migration, but runtime geometry reads node-owned `splineControls`. Each node
owns an incoming handle and outgoing handle with `auto`, `manual`, or `vector`
mode, plus `tangent` or `non-tangent` coupling. Each segment samples a bounded
cubic Bezier from `from.position`, `from.out`, `to.in`, and `to.position`.
`Tangent` coupling keeps handles collinear through a node so pulling one side
updates both adjacent curve sides. `Non-tangent` coupling breaks the handles so
pulling one side affects only that adjacent segment. `Vector` mode is the hard
corner `G0` staging mode.

**Why:** segment-owned fairing is inherently one-sided at shared nodes. It lets
two adjacent segments disagree about tangent and influence at the same camera
view, which makes `G1` through `G3` controls fragile and causes undesirable
curve extension. Node-owned handles match established animation/surfacing
marketing setup behavior, keep node positions as interpolation truth, and give
authors visible spline handles plus explicit XYZ node movement.

**Guard:** `timeCurve` remains temporal-only. G-continuity, tension, influence
length, and spline handle pulls must not move explicit node positions. Only
explicit XYZ node handles move nodes, and manual handles translate with that
node. Spline controls, equation overlays, path video preview, and direct
manipulation remain Capture Director session/recipe state only. Do not write
V3.1 camera-path state to page camera fields, `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`,
`projects/*/environment.json`, visual presets, or snapshot-sensitive Utah FORGE
files. Realtime path video may record through preview presets up to 4K;
deterministic Render Out remains the final-quality video path.

## DEC-132 - Capture Director uses a runtime job layer for production capture work

This decision extends DEC-119 through DEC-131 for Capture Director production
operations.

**Considered:** keep every capture/export flow as independent provider state,
reuse realtime `MediaRecorder` path video as the final marketing path, or add a
shared in-memory job runtime with separate preview and deterministic path-video
actions.

**Chose:** Capture Director owns an in-memory Capture Job Runtime. Jobs track
kind, status, progress, diagnostics, cancellation, output blobs, output URLs,
and cleanup callbacks for realtime preview, path preview, deterministic video,
rendered path video, still capture, and external still work. Camera Path now
separates `Record Path Video` from `Render Path Video`: the first is realtime
WebM preview up to the preview presets, while the second uses deterministic
fixed-frame rendering, max-detail fidelity, and the FFmpeg frame-sequence
encoder for final marketing output.

**Why:** path-video preview and final path rendering have different reliability
and quality contracts. `MediaRecorder` is useful for quick review, but final
marketing output needs deterministic frame timing, exact render resolution,
shared diagnostics, cancellation, and output validation. A shared runtime job
layer keeps these concerns out of page/project fixtures and avoids more
independent status/output branches in the provider.

**Guard:** job state is runtime-only and must not be written to
`projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`,
`projects/*/environment.json`, browser storage, visual presets, or recipe JSON.
`Render Path Video` uses the current page and current `CaptureCameraPathV3`
timeline for this pass; page-range path rendering is a later extension.
Equation overlays, spline controls, and marketing setup handles remain excluded from
rendered output by default. Long Playwright and visual QA are not required for
this implementation pass; until the running browser is inspected, report the
result as `ready for visual check`.

## DEC-133 - Path video outputs require explicit save and encoding visibility

This decision amends DEC-132 after field use of Camera Path video export showed
that a long 4K MP4 encode could look like a stuck or already-saved render.

**Considered:** continue exposing only `Encoding path video`, attempt to save
automatically after encode, rely on realtime `MediaRecorder` for MP4, or make
path-video output ownership explicit in the Camera Path panel.

**Chose:** rendered path video now reports encoding elapsed time and explicitly
states that no file has been saved until encoding completes. After completion,
the UI exposes `Save Rendered Video` through the browser save picker when
available, plus a download link fallback. Realtime path recording remains a WebM
MediaRecorder preview; MP4 preview output is a separate FFmpeg transcode job
from the completed WebM preview.

**Why:** browser FFmpeg encodes, especially 4K MP4, can take minutes and do not
provide reliable progress callbacks through the current runtime seam. A visible
elapsed watchdog and no-file-saved copy distinguish slow encoding from a saved
file. The File System Access picker cannot be reliably opened after a long async
encode without a fresh user action, so saving is a deliberate button press after
the Blob exists. Browser `MediaRecorder` MP4 support is inconsistent, so MP4
preview must be a conversion step rather than the primary realtime capture
promise.

**Guard:** Capture Director must not create stale download links for failed or
cancelled preview conversions or path renders. Path video save/transcode jobs
remain runtime-only and must not write project/page fixtures, overlays,
environment files, browser storage, or recipe JSON.

## DEC-134 - Capture Director V3.1 Gx fairing resolves effective handles with guards

This decision completes the core V3.1 spline surfacing repair from DEC-131.

**Considered:** treat `G2` and `G3` as labels over the same Bezier handles,
switch to high-degree per-segment curves, or keep cubic Bezier rails and solve
bounded effective handles with diagnostics.

**Chose:** V3.1 keeps cubic Bezier as the runtime rail primitive:
`from.position`, effective `from.out`, effective `to.in`, and `to.position`.
The explicit node positions remain immutable interpolation constraints. `G1`
keeps tangent-coupled in/out handles collinear at shared nodes. `G2` solves
bounded in/out handle-length ratios to reduce curvature discontinuity at shared
nodes. `G3` applies an additional bounded fairness pass that reduces
curvature-flow spikes across neighboring segments while still using cubic
Bezier segments. Segment `pathFairing` remains compatibility and migration
state; runtime sampling uses node-owned `splineControls` and the effective
Bezier resolver.

**Why:** exact high-degree `G3` continuity would add unstable per-segment
degrees of freedom and undermine the direct spline-handle workflow. Bounded
effective handles match DCC rail editing expectations better: authors keep
Bezier-like controls, node positions stay fixed, and the solver can improve
curvature quality without changing transition timing.

**Guard:** unsafe Gx edits must be diagnosed and stabilized before playback,
scrub preview, Render Out, or Still Capture sampling. The resolver checks for
non-finite samples, derivative reversal, non-monotonic projected progress,
excessive chord-envelope exit, and loopback risk. It damps effective handles
before falling back from requested `G3` to stable `G2`, then stable `G1` auto
handles. Transition UI must show compact guard/fallback feedback when effective
continuity is lower than requested or a guard applied. Gx guards must not move
explicit camera nodes, alter hold time, alter transition duration, overload
temporal easing, or write page/project fixtures, overlays, environment files,
visual presets, browser storage, or recipe-external state.

## DEC-135 - Capture Director Page Bar is the scene datum for camera-spine renders

This decision connects the editor/presentation system to Camera Studio without
letting either state model contaminate the other.

**Considered:** keep page range as a detached Render Out form field, make Camera
Path own page sequencing, write camera-path timing back into page cameras, or
add a shared Capture Director timeline where pages and camera spine sample from
one clock.

**Chose:** Capture Director owns a recipe/session `CaptureTimelineState`. The
Page Bar is the scene datum: it owns the ordered page clips, holds, transition
timing, enabled/locked state, layer/environment scene state, and authored
presentation context. Camera Path is a separate spatial camera spine that owns
camera pose, target/focus, FOV/lens behavior, and camera timing. Both tracks
sample from the same shared capture timeline clock, `timeSeconds`.

**Why:** Phase/page sequencing already carries the editorial scene state. Camera
Studio should ride that editorial clock instead of becoming the page system or
mutating page cameras. This lets Render Out and path video combine page state
and camera state deterministically: the Pages lane answers which scene exists
at a frame, while the Camera Path lane answers where the camera is at that same
frame. Empty Page Bar state remains valid and falls back to current-page
capture.

**Guard:** Page Bar clips are Capture Director recipe/session state only. Camera
Path state remains camera-only. Page clip edits must not mutate camera path
nodes or segments, and Camera Path edits must not mutate page cameras, page
timing, page fixtures, project files, overlays, environment files, visual
presets, browser storage, or snapshot-sensitive Utah FORGE files. Diagnostics
lanes are hidden by default and marketing-setup-only. Internal Page Bar boundary edits
are bilateral and local, changing only adjacent clips while preserving their
combined duration; final edge edits may change total duration.

**Render queue note:** the external 8K still route is treated as the first
hardware-independent frame primitive. Future production video rendering should
queue Page Bar plus Camera Path frame references, render exact-size tiled frames
outside the live browser when needed, and compile those frames into the selected
MP4/WebM/image-sequence output. The browser deterministic frame path remains
the fast local renderer, but it is not the ceiling of the Capture Director
render architecture.

## DEC-136 - Capture Director is a marketing layer, not project truth

This decision clarifies the boundary across DEC-119 through DEC-135.

**Considered:** let Capture Director edits become normal page/project persistence,
write camera paths into page camera fields, use page fixture edits to force
marketing shots, or keep Capture Director as a separate directorial layer over
the existing webpage and editor.

**Chose:** Capture Director remains a marketing and directorial layer. In the
current build, all Capture Director surfaces are marketing production, not
shipped editor-side features. It may read and sample page scene state, page order, page
transitions, layer state, environment state, current camera state, and active
editor context. It owns runtime/session capture state: page clips, camera
paths, focus points, spline handles, equation overlays, preview monitors,
render recipes, capture jobs, output URLs, and media-export settings. Those
states are saved only through explicit Capture Director recipe/path/job
artifacts and output media.

**Why:** marketing media needs shot direction, camera choreography, render
queues, and external compute paths without contaminating the website or
presentation source. Page/editor data is the stable product datum. Capture
Director should compose directorial intent on top of that datum, then render or
record media from the composed recipe. Persisting capture choreography into
page fixtures would blur page/editor persistence state with marketing-production
state and make later site edits harder to reason about. Some Capture Director
surfaces intentionally resemble future reusable editor capabilities, but that
promotion requires a separate product/process decision, editor
manifest ownership, persistence contract, accessibility review, UI standards
review, and regression coverage.

**Guard:** Capture Director must not write capture choreography, camera paths,
page clips, equation overlays, preview monitor state, capture job state,
render-output state, output URLs, or external-job diagnostics to
`projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`,
`projects/*/environment.json`, page camera fields, visual presets, browser
storage, or editor dirty state. Marketing setup aids such as spline handles,
equation labels, focus rays, camera preview markers, diagnostics lanes, preview
monitors, and editor chrome are excluded from Render Out, Still Capture, path
render, and external tiled jobs by default unless a future explicit
export-overlay option opts them into media output. External compute jobs may
render outside the live browser, but they must consume Capture Director recipes
and never repair or mutate project fixtures to produce a shot.

## DEC-137 - Scale and context helpers are visual cues, not measurement tools

This decision clarifies the measurement boundary for the main GeoSee app and
for Capture Director marketing output.

**Considered:** treat existing scale bars, section scale axes, km labels,
compass/readout widgets, graticules, and context graphics as measurement tools;
remove all scale/context helpers until a formal measurement subsystem exists;
or keep them as visual orientation cues with explicit language limits.

**Chose:** current GeoSee scale/context helpers are visual orientation cues.
They help viewers understand scene direction, relative scale, section context,
or presentation framing, but they are not metrology or engineering measurement
instruments. The current app deliberately does not ship usable
perspective-correct measurement tools or actionable metrology.

**Why:** GeoSee takes complex data and makes cognitive connections apparent.
It does not afford metrology. Measurement belongs to calibrated equipment,
controlled methods, and proper QA/RA. Scale and km labels can be useful
orientation language, but the existing helpers do not validate datum,
projection, surface intersection, camera perspective, screen-space distortion,
or measurement uncertainty well enough to support engineering decisions. The
product boundary exists so viewers can understand what should be measured and
why without mistaking the communication layer for the measurement layer.

**Guard:** no UI, docs, Capture Director overlay, presenter output, export, or
external render job may describe existing scale/context helpers as engineering
measurement tools, and no GeoSee workflow may expose actionable metrology such
as ruler, distance, scale, volume, grade, coordinate-pick, clearance,
measurement, or engineering-action controls. A future measurement subsystem
requires a separate
product/process decision, calibrated source-method expectations,
perspective-correct math, source/datum validation, clear UI copy, and
regression tests. DEC-059, DEC-061, and DEC-078 still allow section
scale/context helpers as presentation orientation aids; this decision clarifies
that those helpers are not measurement instruments.

## DEC-138 - Given tables and approved transforms are the data boundary

This decision clarifies the non-inference boundary for GeoSee data handling and
agent work.

**Considered:** allow agents or presentation code to infer missing joins,
labels, correlations, quantities, categories, or explanatory claims from visual
proximity and layer coexistence; allow helpful collation when it improves the
story; or limit GeoSee truth to supplied tables/source records and explicit
approved transforms.

**Chose:** given tables, source records, manifests, and explicitly approved
transform specs are the hard boundary. GeoSee may present and clarify supplied
engineering data, but it must not invent engineering meaning. A relationship,
label, quantity, category, join, correlation, or claim that is not present in a
given table/source record or approved transform remains unknown.

**Why:** GeoSee is a communication layer over technical material, not an
interpretation engine. Inferring relationships from incomplete inputs would
turn presentation work into unsupported technical analysis and create the
largest risk surface for AI-assisted work. The product should make supplied
relationships easier to see, not create new relationships because they seem
useful.

**Guard:** agents and runtime code must not infer missing engineering facts,
invent labels, merge records, join datasets, interpolate categories, correlate
layers, fill gaps, summarize source tables into new claims, or perform helpful
collation unless the relationship is present in a supplied table/source record
or the human provides an explicit transform rule. Unsupplied relationships must
remain questions, missing inputs, or proposed transforms for review. Do not
encode them as runtime truth, project data, overlay text, page copy, labels,
legends, recipes, Capture Director output, or marketing media.

## DEC-139 - Active data stays controlled; public demos use approved/stale material

This decision clarifies the public-release boundary for active project data.

**Considered:** allow GeoSee demos and marketing outputs to publish active
client/technical data when the visuals look useful, keep all active data out of
GeoSee entirely, or use GeoSee for controlled presentations while reserving
public demos for stale, complete, open, or explicitly approved material.

**Chose:** active data must not be made public by default. Public demos use
stale, complete, open, or explicitly approved source material. Active client or
technical work may be shaped into controlled presentations and handed to the
signed-off authority for review/release, but it must not become public data,
public self-serve output, or public marketing material without explicit public
release approval. Tool and demo development use stale datasets by default, stay
local by default, and produce direct handoff material for the client or
signed-off authority rather than public or self-serve outputs.
Controlled client handoff should carry explicit risks and client-side technical
acceptance by the head of engineering or equivalent authority.

**Why:** GeoSee can help people understand complex data without taking ownership
of public disclosure. Utah FORGE works as a demo because it is a stale/done
public-style case, not because active project data is safe to expose. Keeping
active work presentation-only and authority-reviewed protects clients,
technical teams, and downstream decisions.

**Guard:** agents must not create public data exports, public demo pages,
public repositories, public marketing packages, public Capture Director renders,
or public static builds from active data unless public release is explicitly
approved. Active-data presentations may be assembled for a signed-off authority
only. This guard applies to project files, overlays, generated assets, recipes,
exports, screenshots, video/still renders, docs, and external render jobs.

## DEC-140 - Upcoming and active project material is confidential by default

This decision clarifies confidentiality handling for upcoming and active
project material before any public-release question exists.

**Considered:** treat confidentiality as only a release/publication concern,
or treat working artefacts, generated outputs, diagnostics, and agent context as
possible disclosure paths.

**Chose:** upcoming and active project material is confidential by default.
Source values, client/project names, screenshots, rendered previews, copied
tables, logs, diagnostics, generated files, prompt/context material, issue/PR
text, docs, examples, and risk entries must stay inside controlled handling
paths unless the disclosure path is explicitly approved.

**Why:** upcoming projects can carry client, operational, technical, commercial,
or regulatory sensitivity long before there is a public output. A leak can come
from a screenshot, log, render, copied table, generated file, or agent summary
just as easily as from a deliberate demo release. Confidentiality is therefore
a handling responsibility, not only a publication decision.

**Guard:** when documenting or discussing a confidentiality concern, describe
the class of risk or use redacted placeholders. Do not paste sensitive source
values into risk entries, docs, commits, issue/PR text, examples, prompts, or
generated artefacts unless the disclosure path is explicitly approved. DEC-139
still governs public release; this decision governs controlled handling before
release. Before any client data is accepted, review the unresolved
confidentiality/intake gate in the risk register and confirm stale-data
development, local handling, direct handoff, confidentiality, and authority
controls.

## DEC-141 - Client data intake requires client-visible informed consent

This decision establishes the intake-process requirement that must exist before
client-side data enters GeoSee work.

**Considered:** treat client-data intake as an internal gate only, allow
case-by-case acceptance based on verbal context, or require a documented process
that can be shown to clients before data is accepted.

**Chose:** client-side data intake requires a documented, client-visible
informed-consent process before data is accepted. The process must explain what
data is being accepted, how it will be handled, what GeoSee may do with it,
what GeoSee will not do with it, who may receive outputs, and what public
release status applies. The current process file is a draft foundation only and
is not yet an approved intake SOP.

**Why:** confidentiality, non-inference, non-metrology, local handling, direct
handoff, and public-release boundaries need to be visible to the client before
data enters the workflow. Informed consent cannot be inferred from the fact
that data was provided.

**Guard:** do not accept client-side data until the intake process has been
reviewed and approved with QA/RA and the relevant signed-off authority. Until
that approval exists, tool and demo development remain on stale local datasets.
Controlled handoff must carry explicit risks and client-side technical
acceptance by the head of engineering or equivalent authority.

## DEC-142 - Capture Director 4K video uses external deterministic render jobs

This decision records the 4K video production boundary after browser FFmpeg
encoding proved ambiguous for large page-sequence renders.

**Considered:** keep 4K final Render Out and Render Path Video inside browser
FFmpeg, only improve status copy, or route final 4K video through an external
local render job while keeping browser encoding for smaller/preview outputs.

**Chose:** 4K-or-higher deterministic video starts a dev-only local external
renderer by default. Capture Director posts a `CaptureVideoRenderJobV1` to
`/api/capture/render-video`; the Vite dev server runs
`tools/render-capture-video-job.mjs`, writes the MP4/WebM under
`.tmp/capture-video-outputs/`, and reports output and diagnostics paths back to
the in-app job runtime. The job preserves the CaptureRecipe, Page Bar, Camera
Path, resolution, FPS, format, app URL, and max-detail no-downsampling fidelity.
Browser FFmpeg remains available for shorter/smaller deterministic videos, but
it now has explicit frame-writing, encoding, finalizing, timeout, and
stall-failure handling. JSON job download is a fallback/export artifact, not
the normal result of pressing Render.

**Why:** final marketing video must not hang behind a browser worker with no
clear destination. The external route renders deterministic frames from the
real app state, encodes through local FFmpeg, writes diagnostics, and gives the
operator a concrete output path. Browser output exists only after a blob has
been successfully encoded.

**Guard:** do not use browser display capture or browser FFmpeg as the only
4K/page-sequence final-video route. Do not write project/page fixtures while
creating or running external video jobs; local outputs live under `.tmp/`.
Equation, spline, camera-path, and editor overlays remain authoring/session aids
and are excluded from marketing output unless explicitly enabled in a future
export-overlay option.

## DEC-143 - Boreholes use an app-level composable element kit; pages carry per-borehole diffs

This decision records the borehole visualization model after source-location
boreholes (`58-32`, `78B-32`, the unnamed `BOR` seismic candidates) were found
hidden on most pages: the app-level `demoBoreholeSourceLocations.visible` was
`false`, and the shallow env→page style merge meant only the three pages that
re-authored the whole block showed any source markers.

**Considered:** keep the conservative default-off stance and enable boreholes
page by page; keep the exclusive `mode` shape selector; or make the visual model
an app-level, composable element kit shared across every borehole with
per-borehole show/hide.

**Chose:** every borehole carries a shared, composable element kit — line
(location/trajectory/depth, with width/color/opacity/dashed + dash settings),
ground torus, ground ball, ground crosshair, depth trace, label, and an optional
loadable SVG icon on top (axis or billboard). Element styling is shared across
all boreholes; show/hide is per borehole (`items[id]` for source-location
boreholes, the well `visible` for trajectory wells). The exclusive `mode` enum is
retained only for back-compat and is migrated to the per-element `*Visible` flags
by the resolver. App-level defaults are line + ground torus on. Trajectory wells
`16A(78)-32` / `16B(78)-32` keep their pipe + centerline and gain the same kit
layered at the collar.

**Why:** "pages are disposable presentation boards"; the canonical element kit
and default visibility belong at the app level (environment layer style), not in
page fixtures. The composable element set replaces the all-or-nothing shape mode
so multiple elements can show at once.

**Trade-off accepted:** the env→page style merge for `demoBoreholeSourceLocations`,
`demoBoreholeWells`, and `demoBoreholeBlock` is now a targeted deep merge
(including nested `items`/`icon`), so a page diff layers over the shared kit
instead of replacing it. This narrows the shallow-merge composition rule (#023)
for these specific keys only.

**Claim safety:** `58-32` / `78B-32` / `BOR*` render as source-location markers
from GDR 1358 surface coordinates only (no trajectory or calibration claim).
`Acord-1` and `FDST / FORGE test drill site` remain registry-only with no source
geometry. `16A`/`16B`/`16B` keep orientation-only status.

**Guard:** do not move the canonical borehole element kit or default visibility
into page fixtures. Keep the per-key deep merge for borehole style objects.
Source-location boreholes must not be relabeled as trajectory or
survey-validated geometry.

## DEC-144 - Camera Path authored time curves are the motion authority

This decision repairs Capture Director camera-path transition motion so the
authored `timeCurve` on each transition container is the temporal authority
for playback, scrub preview, Render Out, and Still Capture sampling.

**Considered:** keep the v3 adaptive speed law that re-eased every transition
with a hidden power ease and blended segment boundaries back toward raw linear
time, gate that law behind an authoring option, or reduce it to a bounded
guard that never overrides the authored curve.

**Chose:** `sampleCaptureCameraPathV3` applies the authored `timeCurve` and
then a bounded motion guard only. The guard is identity on calm geometry, so
`linear` means constant time progression and each easing mode reads exactly as
authored. On stressed geometry the guard applies monotonic, endpoint-exact
warps: deceleration into and out of sharp travel corners (cubic Hermite with
reduced endpoint slope) and mid-segment compression for large look-direction
flips, near-focal orbits, and big FOV moves (sine-based warp, slope bounded
above zero). The equation-handoff stage that rewrote up to 72% of each segment
toward raw linear time was removed; adjacent segments meet exactly as their
authored boundary equations dictate. Newly authored transitions default to
`ease-in-out`; loaded paths keep their stored easing.

**Why:** the previous pipeline composed the authored curve with an
unconditional power-2.6 ease and boundary rewrites, so a default `linear`
transition crawled through roughly the first quarter of its duration, rushed
the middle at almost four times average speed, and the Timing easing control
produced no visible change. The corner law was also inverted: progress lagged
linear approaching a sharp corner, so arrival speed at the corner exceeded
average speed. The surfacing model and agent guide define `T` as an authored
stack; hidden time warps that override it break that contract and make
transition feel un-authorable.

**Guard:** `tests/tools/capture-director-camera-path-v3-runtime.test.mjs`
asserts guard identity on calm geometry, ahead-of-linear deceleration into
tight corners, flip-zone compression, monotonic focus-regulated progress, and
endpoint exactness. `tests/tools/capture-director-camera-path-v3-spline-runtime.test.mjs`
asserts that authored boundary equations meet in a continuous, symmetric soft
pause at handoff nodes with no speed spike. Do not reintroduce time-warp
stages that replace or rewrite the authored `timeCurve`; new motion shaping
must stay bounded, monotonic, endpoint-exact, and documented in
`docs/capture-director/camera-path-surfacing-model.md`.

## DEC-145 - Explicit MT boundary visibility maps are authoritative, including all-off

Supersedes the all-off-is-stale clause used by the MT threshold boundary
resolver and recorded in `CLAUDE.md`.

**Considered:** keep treating all-off visibility maps as empty/stale state
that inherits default boundary visibility, or treat any map carrying an
explicit `visible` flag as deliberate authoring.

**Chose:** `resolveMtSurfaceBoundaries` treats a canonical or legacy
visibility map as authoritative when any entry carries an explicit boolean
`visible` flag — including maps where every flag is `false`. Only maps with
no explicit flags at all inherit default boundary visibility.

**Why:** the stale-map rule made the default isosurfaces render on pages the
author deliberately set to show none, so surfaces appeared "out of nowhere"
during navigation onto those pages. An explicit all-off map is authored
intent, not stale state; the stale-map fallback remains for genuinely empty
legacy pages.

**Guard:** do not reintroduce visible-true-only authority checks in
`src/projectModules/utahForge/mtSurfaceBoundaries.ts`.

## DEC-146 - Source-gated seismic products stay visible but non-rendered

This decision governs required seismic products named by public source records
when the deliverable cannot be validated into renderable browser artifacts.

**Considered:** silently omit the product, fabricate it from a neighboring
unenhanced product, partially recover corrupt bytes, or surface it as a
source-gated product in the editor.

**Chose:** source-named seismic products that are missing, corrupt, or
unextractable stay out of the renderable seismic product manifest until a
complete SEG-Y member can be extracted and CRC-validated. The editor may still
show a source-gated heading with the source filename, expected size, source
citation, GDR landing page, zip member, and status. The source gate is carried
through the seismic manifest, inventory, recipes, and project layer metadata.

**Why:** a named public seismic deliverable is important project context, but a
partial or substituted seismic volume would look authoritative while violating
source fidelity. Keeping the product visible as a gate preserves auditability
without creating false render evidence.

**Guard:** do not generate amplitude sections, raymarch volumes, project
products, pages, or comparison presets from partial, corrupt, or neighboring
SEG-Y products. For `Forge3d_ANI_PSDM_Stack_Enh.segy`, use the GDR 1141 landing
page as the external source reference and do not construct or persist direct
download URLs. If a valid source copy is later supplied, rerun the seismic
browser builder so the gate can transition to a source-backed renderable
product through the normal manifest path.

## DEC-147 - Seismic sections use trace-header geometry before envelopes

This decision supersedes any seismic browser behavior that placed 2D or 3D
sections from file-order indexes, square trace-count grids, endpoint-only line
segments, or the broad navigation envelope when trace coordinates are present.
It also supersedes DEC-084 and DEC-087 only where those entries describe
legacy L5/L11 sections as endpoint fallback geometry despite usable
trace-header CMP coordinates.

**Considered:** keep using existing section rectangles and page styles, repair
only the visible editor toggles, approximate 3D sections from navigation
bounds, or rebuild section geometry from SEG-Y trace headers.

**Chose:** renderable seismic products must derive horizontal section placement
from source SEG-Y trace coordinates before any navigation or envelope fallback.
For Miller/GDR 1141 custom headers, CMP_X byte 189 and CMP_Y byte 193 are
decoded as 4-byte IBM real values, with inline bytes 9-10 and crossline bytes
13-14 decoded as 2-byte integers. Standard SEG-Y coordinate fields are fallback
only when the custom fields are invalid. 3D inline/crossline sections store
trace-derived paths, sample planes store trace-derived surface-grid geometry,
and 2D sections store full per-trace CMP paths where available. SEG-P1 paths
are fallback; endpoint-only paths are last-resort fallback.

**Why:** seismic sections are vertical cuts through a trace grid, not images
that can be stretched onto arbitrary rectangles. Trace-header UTM coordinates,
the 1800 m datum, and real sample spacing are required for co-registration with
wells, terrain, and other depth-domain overlays. Index-based placement can
create sheared panels, wrong depth scale, and false alignment.

**Guard:** generated manifests must record product `sourceGeometry`, section
`geometrySource`, `sourceAxis`, `path`, or `surfaceGrid` metadata, plus any
source-unit caveats. Runtime section meshes must tessellate trace paths instead
of collapsing them to first/last endpoints. Raymarch volumes may remain
axis-aligned browser envelopes only when explicitly labeled as envelopes; do
not claim validated exact volume orientation from those AABB meshes. Source
gates such as `Forge3d_ANI_PSDM_Stack_Enh.segy` remain non-renderable until a
complete CRC-valid source is available. L5/L11 trace-header paths may be used
for placement after plausible State Plane-to-UTM transformation, but must keep
`canClaimPreciseRegistration: false` and non-validated placement language until
control-point validation exists. Legacy L5/L11 SEG-Y headers that declare a
`7000 ft` processing datum are retained as `sourceHeaderDatumM: 2133.6` and
rendered against the shared `datumM: 1800` seismic reference frame with
`datumNormalizationM: -333.6`; do not use the raw header datum as rendered
scene datum or drop the audit fields.

## DEC-148 - Approved ANI PSDM surrogate uses source-derived unenhanced volume

Extends DEC-146 for the Utah FORGE demo case where the published enhanced 3D
ANI PSDM SEG-Y remains corrupt in the official GDR 1141 zip.

**Considered:** wait for a corrected `Forge3d_ANI_PSDM_Stack_Enh.segy`, render
the corrupt enhanced member from partial bytes, hide the enhanced deliverable
entirely, or render the complete unenhanced ANI PSDM product with explicit
presentation-enhancement disclosure.

**Chose:** the demo may render `gdr-1141-forge3d-ani-psdm-stack-unenh` through
the `psdm-depth-surrogate-showcase` preset as
`Presentation-enhanced PSDM surrogate - GDR 1141, unenhanced source`. The
surrogate provenance classification is `source-derived` because the geometry
and amplitudes are the real unenhanced GDR 1141 ANI PSDM depth volume. The
presentation transform must remain disclosed as in-app contrast/display tuning,
not as possession or reconstruction of the enhanced SEG-Y.

**Why:** the enhanced and unenhanced 3D ANI PSDM headers share the same CRS,
datum, sample interval, trace length, CMP bin size, and trace-coordinate header
fields, and the official zip central directory lists both delivered SEG-Y
members at `153,678,840` bytes. The enhanced header records post-stack
display-processing additions such as bilateral filtering on offbins and FXY
decon, while the unenhanced source is complete and renderable. This supports a
spatially faithful presentation surrogate without creating a false source
claim. Byte size is not treated as proof of identical amplitudes.

**Guard:** `gdr-1141-forge3d-ani-psdm-stack-enh` remains source-gated,
non-renderable, and `source-member-corrupt` until a complete CRC-valid source
member exists. The app must not claim a complete
`Forge3d_ANI_PSDM_Stack_Enh.segy`, construct direct GDR download URLs, render
time-domain products in the PSDM surrogate view, or label the surrogate as
`preview`, `synthetic-illustrative`, or recovered enhanced SEG-Y.

## DEC-149 - Seismic presentation bar separates PSDM amplitude from velocity reference

Extends DEC-148 for the Utah FORGE presentation view and the
`PSDM + MT + 58-32 Source-Location Tie` page.

**Considered:** reuse the technical seismic volume legend, relabel PSDM
amplitude as velocity, add page-specific overlay text, or add an opt-in
viewport presentation bar backed by normal seismic style fields.

**Chose:** the app may show a read-mostly `SeismicPresentationLegendBar` when
`EditableStyle.seismicPresentationBarVisible` is explicitly true. The bar
consolidates PSDM amplitude min/max and colormap, a separate velocity
companion reference from `gdr-1015-forge3d-velo5d-float-01312018` labeled
`2,000-5,000 m/s`, depth metres referenced to the `1,800 m` seismic datum, a
`source-derived` provenance chip, scale and compass context, vertical
exaggeration, and IL / XL / depth slice scrub controls that write only
`seismicSliceAxis` and `seismicSliceFraction`.

**Why:** presentation mode needs a compact, claim-safe readout that gathers the
items reviewers asked for without weakening source fidelity. PSDM amplitude is
not a velocity model, so m/s appears only as a companion reference. The
separate style flag keeps the bar out of general runtime behavior and makes
its use auditable through presets, page authoring, and editor controls.

**Guard:** do not enable the presentation bar through page-id, page-index, or
title runtime special cases. Do not use it to imply possession of a complete
`Forge3d_ANI_PSDM_Stack_Enh.segy`, to render the source-gated enhanced product,
or to relabel PSDM amplitude as velocity. New slice scrub behavior must keep
using the existing seismic slice style fields.

## DEC-150 - Seismic figure graphs use data/datum basis

Extends DEC-147 and DEC-149 for seismic figure annotations, transition graph
identity, and capture-mode visibility.

**Considered:** keep deriving graph axes from the first four mesh vertices,
attach all graph overlays to the visible section mesh as a child effect, attach
depth labels to terrain/ground, or add an explicit graph-basis model owned by
the seismic product/object.

**Chose:** seismic figure annotations use an explicit
`SeismicSectionGraphBasis` derived from the section metadata, product metadata,
and active display state. Path curtains use the full trace path, sample domain,
datum, vertical datum mode, and sample-to-scene transform for distance and
depth/time axes. Sample planes use their surface-grid footprint and fixed
sample/elevation state; they do not fabricate a vertical depth axis when
`min === max`. Ground attachment is reserved for terrain/source-location traces
and survey geometry that truly lives on ground. Stable graph identity is
`layerId + productId + objectKind + objectId`, not page id, page index, page
title, or page order.

**Why:** section graphs communicate product and datum coordinates, not mesh
corner order. First-four-vertex logic breaks on trace-path curtains,
trace-header tessellation, fixed-depth planes, and 3D inline/crossline slices.
Page-derived identity causes disposable deck state to leak into app behavior
and transition matching. Datum-based axes keep depth-domain products labelled
as metres below the seismic datum with elevation side labels, while
time-domain products keep TWT semantics.

**Guard:** runtime meshes must carry `userData.seismicSectionGraphBasis`, and
figure annotation roots/materials must carry stable seismic graph metadata and
base opacity. Transition render graphs model seismic figure annotations as
derived entities with their own representation key and opacity channels, so
source-only graphs exit, target-only graphs enter when ready, and preserved
graphs update without a full-opacity rebuild. Capture modes use the shared
native-annotation gate: `scene-only` hides presentation/authoring seismic graph
annotations by default, while `scene-annotations` and `presentation-ui` include
them according to capture visibility profiles. Deterministic still/frame export
must use the same native annotation semantics as realtime capture.

## DEC-151 - Scene section faces derive from source geometry and runtime channels

Extends DEC-147 and DEC-150 for Scene Section face display, helper geometry,
and quick legend controls.

**Considered:** continue authoring hard-coded X/Y/Z scene-section frames,
repair individual Utah FORGE pages, or make the scene-section face reuse the
active source graph basis when a targeted seismic product exposes one.

**Chose:** Scene Section keeps X/Y/Z axis-aligned fallback behavior, but the
active source-targeted face may resolve its frame and plane basis from
`SeismicSectionGraphBasis`. Trace-path curtains derive trace-distance and
elevation axes from the full path and sample domain. Sample planes derive
horizontal face axes from their source surface grid. The quick legend Section
Options popout owns runtime-only face display channels for seismic, volume,
isobars, and MT scalar overlays so more than one source can be compared on the
same face.

**Why:** the Y-frame regression came from coupling a generic axis-aligned
scene-section box to a separate seismic slice selection. Source-derived faces
make the helper frame, clipping plane, and face content share the same product
geometry. Runtime channels let authors compare overlays without baking
temporary face display state into disposable page fixtures.

**Guard:** do not fix section-face alignment by editing `projects/*/pages/**`,
`projects/*/overlays/**`, `projects/*/project.json`, or
`projects/*/environment.json`, and do not add page-id, page-title, page-index,
or page-order conditionals. Face display channel toggles are runtime UI state;
computed source frame coordinates must come from product/object basis metadata,
not persisted page geometry.

## DEC-152 - Transition execution layer consumes classifier assignments

Supersedes the TRD-008 classifier-only boundary recorded in
`docs/dev-context/Transition-Decision-Log.md`. Durable peer of TRD-013.

**Considered:** keep the pure classifier diagnostic-only and patch the seismic
transition defects through more imperative `shouldCrossfade*` booleans; build a
bounded execution layer for the seismic graph only; or make a single execution
layer the assignment-driven owner of all transition channels.

**Chose:** a transition execution layer that consumes classifier assignments and
owns per-entity execution for every channel. It is a dispatch layer, not a
reimplementation: `buildTransitionExecutionPlan` turns assignments into typed
operations, `evaluateTransitionExecutionPlan` advances them per frame, and a
channel-executor registry routes each operation to an existing interpolation
kernel. The environment-scene blend (TRD-009), scene-section mask/helper owner
(TRD-010), Section ISO root owner (TRD-011/012), working-area focus tween, and
the protected MT full-density scalar kernel become registered executors
triggered by assignment. Seismic derived entities gain a dedicated entity
executor keyed on trace-header `userData` identity.

**Why:** the classifier already resolves correct per-entity behavior, but a
parallel imperative ladder made the real decision, so the seismic derived-entity
graph classified without driving anything. Routing execution through assignments
satisfies Transition-Continuity-Contract invariant 11 (scene mutation consumes
assignments, not independent fades) while preserving the documented protected
paths byte-for-byte inside their kernels.

**Guard:** the existing transition source-pattern tests are the regression
contract and stay green; only assertions naming a replaced decision-ladder
boolean move to the assignment-driven equivalent. The MT-scalar/cloud kernel is
unchanged; only its dispatch trigger moves. Do not introduce page-id,
page-index, page-title, or page-order branches in the execution layer, and do
not reimplement interpolation math outside the registered kernels.

## DEC-153 - Transition execution migration is registered and phase-gated

Clarifies DEC-152 and durable peer of TRD-014.

**Considered:** treat DEC-152/TRD-013 as a completed migration for every
transition channel; abandon the execution-layer spine because only the seismic
runtime slice is currently executable; or keep the spine while requiring each
channel to become assignment-driven only through a registered, tested consumer.

**Chose:** keep the execution-layer spine and phase-gate migration by
registered consumers. The current implemented scope is exact-key entity-opacity
execution. Runtime objects expose `transitionEntityKey`,
`transitionRepresentationKey`, `transitionParentLayerId`,
`transitionObjectKind`, and optional `transitionRole`; the executor resolves
objects by exact entity key and composes `baseMaterialOpacity *
parentLayerOpacity * entityOpacityFactor`. The first migrated consumer is the
seismic graph: survey geometry uses product-agnostic role entities
(`navigation`, `lines`, `sources`, `receivers`), and figure annotations reuse
the runtime section graph entity key with a `:figure-annotation` suffix.

**Why:** the execution layer is still the right architecture for new tools and
objects, but claiming full migration before every channel is registered creates
false confidence and risks destabilizing protected paths. Exact-key
entity-opacity execution fixes the observed seismic over-fade without weakening
the MT scalar/cloud, scene-section, Section ISO, or environment-scene kernels.

**Guard:** new transition-capable tools/objects must prefer the generic
transition entity tag contract over renderer-specific kind collectors. Existing
TRD-009/010/011/012 and MT full-density scalar/cloud behavior remain guarded
legacy kernels until separate migrations land with dedicated tests and source
guards. Do not use page ids, page titles, page order, project page fixtures, or
source/target page pairs as runtime identity or proof of app behavior.

## DEC-154 - Graph annotations are target-scoped Section Options state

Extends DEC-150 and DEC-151 for figure/graph annotation authoring.

**Considered:** keep one layer-wide `seismicFigure*` container, add separate
2D/3D annotation containers, or make annotation profiles target keyed by graph
object identity.

**Chose:** Section Options owns graph annotation authoring through
`graphAnnotationDefaults`, `graphAnnotationProfiles`, and
`graphAnnotationSelectedTargetKey`. Legacy `seismicFigure*` fields remain
readable/writable fallback defaults for existing pages. Target keys are derived
from graph family, layer id, product id, object kind, object id, and comparison
role, not page ids or deck order. Static seismic section annotations resolve
their profile from `SeismicSectionGraphBasis` and keep using plane-locked mesh
text with back-face-readable UV flipping.

**Why:** a single figure annotation container cannot describe Line 301, Line
302, L5, L11, 3D slice planes, volume views, comparison graphs, item graphs,
and section-cut faces without cross-contaminating titles, captions, scale
labels, wells, horizons, colors, and offsets. Target-scoped profiles let each
graph object carry its own page-like annotation while keeping the same Section
Options control surface in the editor and quick-legend popout.

**Guard:** no Presentation Presets UI or state is introduced for graph
annotation. Do not repair annotation differences with `projects/*/pages/**`,
`projects/*/overlays/**`, page id, page title, page index, or page-order
branches. 3D volume and scene-section cut annotations must use the same target
profile model and move with their owning graph object or cut frame before any
visual claim is made.
## DEC-155 - Section helper visual variables are Cinematics scene state

Extends DEC-151 for generic section-helper visual tuning.

**Considered:** keep section helper widths and arrow dimensions as fixed runtime
constants, expose them as per-section layer controls under Sections, or expose
generic visual variables under Cinematics scene state.

**Chose:** `SceneProperties.sectionVisuals` owns generic section helper visual
variables: frame outline width scale/min/max, push-pull arrow length clamp,
arrow radius and gap scale, scale-axis tick length clamp, and default ground
trace width. Cinematics -> Post Processing exposes these under `Section
Visuals`. Runtime scene-section helper generation reads the current effective
scene after render-preset, page override, and preview patch resolution.

**Why:** these values are visual treatment controls, not per-plane geometry or
disposable page fixtures. Scene-level ownership lets presentations tune helper
legibility consistently while per-axis section geometry, visibility, and source
basis remain under the Sections tool.

**Guard:** do not encode section helper visual tuning in `projects/*/pages/**`,
`projects/*/overlays/**`, page ids, page titles, page indexes, or page order.
Per-frame authored values such as explicit `groundTraceWidthM` remain valid
overrides; generic defaults and clamps come from the effective Cinematics scene.

## DEC-156 - Seismic section curtains use display textures, not page repairs

Extends DEC-148 and DEC-151 for Utah FORGE seismic section display.

**Considered:** repair the observed panel gaps by editing the affected Utah
FORGE page, lowering opacity, changing palette defaults, or changing the
section mesh into independent panels.

**Chose:** section amplitude files remain the source authority, while runtime
section materials sample a derived, power-of-two, mipmapped display texture.
Raw amplitude samples remain available separately on geometry metadata for
diagnostics and section-derived overlays. The displayed curtain stays one
continuous trace-header-derived mesh.

**Why:** the source `.u8` section data and trace-path geometry are continuous;
the visible gap pattern is a minification artifact from high-frequency seismic
amplitude texture sampling on an oblique curtain. A reusable display texture
policy fixes the render path for every section without turning disposable page
fixtures into implementation evidence.

**Guard:** do not fix seismic panel continuity by editing
`projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`,
or `projects/*/environment.json`. Exact missing slice coverage, such as a true
IL-93 source product, must be handled through source preparation and manifest
generation, not page-level state.

## DEC-157 - Scene sections target seismic representations separately

Extends DEC-151 and DEC-156 for section masking of seismic products.

**Considered:** keep scene-section seismic targets keyed only by product id,
turn quick-legend section face buttons into seismic render-mode controls, or
make section object identity include the seismic representation being masked.

**Chose:** seismic scene-section object identity includes representation type:
raymarch volume targets use `:volume`, rendered section-image curtains use
`:section`, and legacy product-only ids remain readable fallback authored
state. Quick-legend face-channel buttons no longer write
`seismicRenderMode`; the seismic rendering controls and graph presets remain
the owners of slice versus raymarch mode.

**Why:** the same seismic product can have both a sectionable raymarch volume
and a rendered 2D section image. Product-only section object ids conflate those
representations, so sectioning the volume can also hide or fade the rendered
section image. Separating representation identity lets Section object
visibility section one representation without destroying the other.

**Guard:** do not repair seismic section/volume separation with
`projects/*/pages/**`, `projects/*/overlays/**`, page ids, page titles, page
order, or project fixture branches. New seismic section targets must preserve
representation kind through runtime target discovery, editor fallback targets,
and object-visibility opacity maps. Scene-section object-visibility
interpolation must derive missing source/target defaults from scene-section
targeting state, including legacy product-only seismic ids, so typed
`:volume` and `:section` targets do not pop during page transitions.

## DEC-158 - Borehole logs render only on validated trajectories

Extends DEC-143 for Utah FORGE borehole-log rendering.

**Considered:** render borehole logs as vertical projections from wellhead
coordinates, render every parsed LAS/CSV/XLSX track regardless of path status,
or gate rendering on a measured-depth path that has validated trajectory points.

**Chose:** `utah-forge-borehole-logs` renders only machine-readable
source-derived tracks mapped by measured depth onto validated as-drilled
trajectories. Tracks without a validated trajectory remain in the derived
manifest as explicit source gaps, not display geometry. DLIS and PDF members
are inventoried but not parsed unless a tested local parser is added.

**Why:** a vertical projection would create false geometry confidence for
deviated FORGE wells, and rendering parsed logs without a path would weaken the
source claim boundary. The manifest can still preserve source presence,
download status, units, sample spacing, and gap status so missing render output
is auditable.

**Guard:** raw GDR source packages stay in `.tmp/source-intake/utah-forge-borehole-logs/`
or another ignored local source root. Committed artifacts may include only
derived manifests, code, tests, docs, and explicit gap metadata. Do not repair
missing log rendering with page fixtures, vertical fallback geometry, or
unvalidated trajectory assumptions.

## DEC-159 - Borehole log curves render as fixed-frame UTM ribbons

Extends DEC-158 for the visible rendering method of validated borehole-log
tracks.

**Considered:** offset each sample in the trajectory-local normal frame, use a
camera-facing billboard, expose a manual lane azimuth, or compute a fixed
source-space lane per well.

**Chose:** render each machine-readable track as a flat ribbon in a fixed
horizontal UTM frame computed from the well trajectory. The trajectory path is
the ribbon baseline, log amplitude offsets in one constant lane direction, and
multiple tracks use parallel lane bases in manifest order. Lithology intervals
render on the path as column/segment geometry, not as amplitude wiggles.

**Why:** local normal offsets rotate through doglegs and produce a false
helical/DNA visual. A fixed UTM lane keeps gamma amplitude readable while
preserving measured-depth placement on the as-drilled path. Automatic lanes
avoid adding an authoring control before a real need for manual azimuth exists.

**Guard:** borehole-log rendering must not use per-sample local/Frenet normals,
vertical projection fallbacks, page-id-specific fixes, or camera-facing
billboards for source claims. Display scale controls may tune readability but
must not change source samples, measured depths, CRS, or trajectory gating.

## DEC-160 - Borehole log ribbons fill from lane-local spines

Supersedes the DEC-159 sentence that described the trajectory path as the
visible ribbon baseline for every track.

**Considered:** keep filling each track from the original trajectory path to its
offset curve, soften the page copy to avoid claiming lane separation, or give
each track its own lane-local baseline spine and fill only within that lane.

**Chose:** each renderable borehole-log track uses a visible fixed-frame
lane-local spine at its base offset. The ribbon mesh fills only between that
spine and the track curve edge. Multiple gamma tracks use separated lane bases
with a clear gap, while measured-depth placement remains anchored to the
validated as-drilled trajectory.

**Why:** the source HCGR and HSGR curves are distinct, but filling both ribbons
from the original trajectory made the farther lane cover the nearer lane and
visually fuse the display into one band. Lane-local spines make the zero line
visible for each curve and keep the overlay wording honest.

**Guard:** do not claim parallel lanes unless the rendered objects expose
separated lane bases. Do not use mirrored fills, duplicated source samples, or
overlapping lane meshes as proof of two measured curves. Lithology remains a
path column/segment, not an amplitude wiggle.

## DEC-161 - Borehole log legend and colors are layer style channels

Extends DEC-159 and DEC-160 for Utah FORGE borehole-log authoring and page
transitions.

**Considered:** keep HCGR/HSGR colors hardcoded in the loader, make a
page-specific quick legend for the showcase page, or promote Borehole Logs
colors, legend visibility, and track toggles into normal layer style channels.

**Chose:** Borehole Logs track colors, lane-spine color, legend visibility, and
track toggles live on `EditableStyle.boreholeLog*` fields. The editor panel and
quick legend write the same fields. The Utah quick-legend stack owns the
viewport legend transition, while page-to-page transition field lists declare
Borehole Log color, scalar, and categorical channels explicitly.

**Why:** the layer needs the same authoring and transition behavior as other
Utah source-derived layers. Hardcoded colors and unregistered style fields make
the runtime look detached from page transitions and prevent quick legend
buttons from matching the editor panel.

**Guard:** do not repair Borehole Logs transitions with page ids, page order,
page titles, or page fixture special cases. New legend controls must use the
shared compact quick-legend helpers from `src/ui/legendStyles.ts`, and quick
legend buttons must mutate the same layer style or visibility fields exposed in
the editor panel.

## DEC-162 - Deferred editor flush may pass post-finalize suppression

**Chose:** `editor-deferred-flush` is a distinct current-page reapply reason
that may pass post-finalize suppression only to apply known editor mutations
queued during a transition.

**Why:** generic duplicate final commits must stay suppressed, but deferred
editor edits are authored state changes that were intentionally held until the
transition landed.

**Guard:** `editor-deferred-flush` must preserve running enter tweens and must
not become a generic bypass for duplicate target assertions or final commits.

## DEC-163 - Color/material transition channels are explicitly discrete

**Chose:** the transition render-graph adapter declares `color-material`
channels with capability `discrete-commit`, and quick legends share the
editor panel's landed gate: legend writes are blocked while a page
transition is running or while the authoring page differs from the
displayed page (`legendWritesLanded`).

**Why:** color channels carried capability `interpolate` but no executor
interpolates them, so classifier assignments claimed an interpolation the
runtime silently snapped at frame one (review finding 2.2, Option A).
Quick-legend writes without a landed gate applied selected-page styles
onto a viewport showing a different page and persisted authored state to
pages the user was not looking at (review finding 8.1); MT mode clicks
mid-transition baked interpolated ramp values into the 1.5s mode
animation and replayed them over the committed target (finding 7.2).

**Guard:** a future color-lerp executor may restore `interpolate` for
same-identity visible-in-both layers, scoped per layer family, with its
own decision entry. The legend landed gate must stay shared
(`src/ui/legendAuthoringTarget.ts`); per-legend copies are not allowed.
The MT mode animation cancels its RAF when a page transition starts;
final persistence still writes only `scalarLegendVisible` plus
`scalarInclusionMode`.

## DEC-164 - Scene-section transitions partition frames per stable id

**Chose:** a page-to-page scene-section transition decides move-vs-dissolve
**per frame**, not for the whole section. Frames present on both pages with an
identical discrete identity (`sceneSectionFrameDiscreteSignature` — enable,
axis, flip, headings, alignment, datum; numeric geometry deliberately
excluded) interpolate their plane position / crop bounds / window (they slide
to meet, the extent moves in/out). Only added, removed, or
identity-changed frames cross-dissolve through the dual-mask. The dual-mask
source/target styles carry the interpolated geometry for surviving frames on
both sides, so those frames move with no dissolve, while
`dissolveFrameIds` frames blend source→target. A non-frame discrete change
(e.g. target scope) with no per-frame change falls back to dissolving every
active frame. Pure logic lives in the dependency-free
`src/scene/transitions/sceneSectionFrameSignature.ts`
(`sceneSectionFramePartition`); the tween carries `movingFrameIds` /
`dissolveFrameIds`; `currentSceneSectionStyle` no longer snaps the whole
section to `toStyle` on any discrete change.

**Why:** the runtime used a single global `sceneSectionDiscreteStyleChanged`
signature. Any one frame differing (typically a Y plane toggling on/off
between pages) flipped it true, routing the **entire** section through the
dual-mask dissolve — so a surviving X plane that only moved snapped, and the
MT volume it clips snapped with it. This is the recurring "Y-section snap":
prior fixes adjusted the global flag or helper opacity but never made the
clip decision per-frame, so it kept regressing. DEC-071 already intends
"interpolate numeric frame geometry by stable frame id"; this aligns the
implementation with that intent.

**Supersedes** the global discrete-mask routing for scene sections (refines
DEC-071, DEC-098). **Guard:** the move-vs-dissolve decision must stay
per-frame; do not reintroduce a section-wide snap on `discreteChanged`.
Locked by `tests/tools/scene-section-frame-partition-source.test.mjs`. The
helper-stability contract (no per-tick `rebuildSceneSectionHelpers`) is
unchanged.

## DEC-165 - Scene-section frame helper orientation must be a proper rotation

**Decision:** the scene-section frame helper group orientation
(`planeQuaternion` in `rebuildSceneSectionHelpers`,
`src/scene/section/sceneSectionController.ts`) derives its third basis column
from `tangentA x tangentB`, not from the raw plane normal, so
`Matrix4.makeBasis` always receives a right-handed (proper) basis.

**Why:** the resolved per-axis basis is right-handed for X and Z but
**left-handed for Y** (`axisA=east(X)`, `axisB=up(Z)`, `normal=north(Y)`, and
`X x Z = -Y`). Feeding `(tangentA, tangentB, normal)` to `makeBasis` produced a
reflection (determinant -1) for Y, and `Quaternion.setFromRotationMatrix`
cannot represent a reflection — it silently mangled the quaternion, mapping the
outline's local +Z to world +Z instead of +Y. The entire Y frame helper group
(outline, push/pull handle cones, axis ticks/labels/headings, ground trace)
dropped into the X-Y plane: coincident with the Z frame and 90deg from the
actual Y cut. The section CLIP was always correct (it uses the normal directly,
which is handedness-agnostic); only the helper VISUALS were wrong, which is why
re-authoring/"purging section data" would not have fixed it — the data is
correct, the bug was in helper rendering. Verified live: the Y frame mesh world
bounding box was flat in Z before, flat in Y after.

`tangentA`/`tangentB` are untouched, so all world-space helper positions and the
separately-passed true normal (`basisNormal`, used for camera-facing text) are
unchanged; X and Z orientation is byte-identical (already right-handed). Only Y
is corrected.

**Latent issue (not changed):** `sceneSectionBasisVectors` hand-codes the
default per-axis basis and is left-handed for Y, while the source-face path
(`sceneSectionOrthonormalSourceBasis`) derives `axisB = normal x axisA` and is
right-handed. Making the default basis right-handed would change the resolved
`axisB` sign for Y and thus reinterpret authored B-extents/positions, so it is
deferred; the orientation fix is the safe resolution. **Guard:** any
`makeBasis` fed a frame basis must guarantee a right-handed triple. Locked by
`tests/tools/scene-section-frame-orientation-source.test.mjs`.

## DEC-166 - Scalar-tween eligibility is spec-driven; atmosphere and borehole fields are declared discrete

**Chose:** three related transition-classification declarations, from review
findings 2.3, 6.1, and 6.2.

1. **Scalar-tween eligibility (2.3)** is resolved from the layer spec type
   (`pointcloud`, `volume`) plus the explicit topo-surface and MT-volume
   paths, independent of load timing. Geometry `scalarValues` presence
   (`layerHasScalarPreviewData`) remains only a secondary OR for loaded layers
   whose spec type falls through, never the primary gate.
2. **Atmosphere fields (6.1)** are declared discrete crossfade
   (`LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS`). Density, softness, edge fade,
   vertical falloff, puff count/scale/jitter, seed, subtype, and bounds all
   participate in `localAtmosphereStructuralKey`, so any change rebuilds the
   puff geometry and mist texture; none is a live shader uniform. Drift
   speed/direction and render order are the only live atmosphere fields and
   apply instantly at transition start.
3. **Borehole-log fields (6.2)** are declared discrete crossfade
   (`BOREHOLE_LOG_DISCRETE_STYLE_FIELDS`, keyed on
   `UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID` in `forgeDiscreteDataStyleChanged`).
   Track offset/width, gamma/resistivity scales, curve fill/opacity/width,
   depth window, vertical exaggeration, and lithology opacity/width drive
   ribbon and column geometry rebuilt by `updateUtahForgeBoreholeLogObject`.

The atmosphere and borehole fields were previously listed in
`SCALAR_TRANSITION_STYLE_FIELDS` as well, but those layers carry no geometry
`scalarValues`, so the scalar declaration was dead: the fields never
interpolated and a change snapped at transition start (borehole) or already
crossfaded via the atmosphere discrete branch. The duplicates are removed so
each field is declared in exactly one place.

**Why:** the operating spec requires unsupported channels to be explicitly
declared discrete, not silently snapped, and requires eligibility that does
not vary by async load timing. Finding 2.3's earlier partial fix covered only
the topo surface; this generalizes it to the scalar-capable spec types without
touching the protected MT full-density path (its kind is special-cased at the
classifier regardless of this predicate) and without enrolling seismic (spec
type `seismic`, excluded).

**Guard:** atmosphere/borehole live interpolation would require a
uniform-driven runtime (no geometry rebuild per change) and a new decision
entry; until then they stay discrete. Do not re-add atmosphere or borehole
fields to `SCALAR_TRANSITION_STYLE_FIELDS`. Locked by
`tests/tools/scalar-tween-eligibility-source.test.mjs` and
`tests/tools/discrete-field-declaration-source.test.mjs`.

## DEC-167 - Global Settings preview preserves page visibility deltas

**Extends:** DEC-112.

**Considered:** keep `previewEnvironmentBase` stripping both page
`layerOverrides` and `visibilityOverrides`, preserve only the MT Cell Points
style fields from DEC-112, or preserve page visibility while still filtering
unrelated page-local style deltas.

**Chose:** `previewEnvironmentBase` preserves page `visibilityOverrides`.
Global Settings/page 00 remains a virtual editor target, and page-local style
deltas can still be filtered through `UTAH_FORGE_PREVIEW_LAYER_OVERRIDE_FIELDS`,
but layer presence is part of page navigation. A page that authors seismic,
section, topo, or any other layer as visible must resolve as visible even when
Global Settings is the selected authoring target.

**Why:** stripping `visibilityOverrides` made section/seismic pages resolve
their authored style while hiding the parent layer group. The symptom looked
like sections disappeared after load, but the runtime trace showed valid page
style, loaded meshes, and `targetVisible:false` during transition
classification. Visibility is not an unrelated cosmetic delta; it is required
for the target render graph.

**Guard:** do not fix this with page fixtures, page ids, page indexes, or live
Utah page-pair logic. The resolver rule is page-agnostic. Locked by
`tests/tools/preview-environment-visibility-source.test.mjs`.

## DEC-168 - Scene-section helpers and ISO follow the cut during a move tween

**Chose:** during a pure section MOVE tween (frames interpolate, none dissolve,
so no dual-mask), the cut-derived helpers AND the scalar ISO overlays are
regenerated at the interpolated cut every transition frame, so they follow the
move instead of holding the source pose and snapping at commit. A move frame is
detected as `options.transitionFrame === true && !options.maskTransition`. On
such frames `applySceneSectionPlanes` runs the full `rebuildSceneSectionHelpers`
(frame outline, push/pull cones, axes, ground trace, ISO frame-intersection
traces) plus `updateMtVolumeCutIsoOverlays` / `updateSeismicVolumeCutIsoOverlays`
(isobars / isolines / bands). Dual-mask (dissolve) transition frames do NOT
rebuild — they only slide the surviving frame helpers via
`repositionSceneSectionFrameHelpers` (transform + cheap outline-geometry
resize), because regenerating dissolving frames would snap them.

**Why:** the section clip/content is shader-uniform driven and interpolates
smoothly, but the helper geometry and the ISO overlays were rebuilt only at
tween start/final commit, so they held the source pose and snapped at commit
while the content moved (user-observed: "frame/isobars/ground-trace/axes hold
then snap"). Supersedes the "helper geometry rebuilt only at tween start/final
commit" rule of the Page-Transitions directives for the move-only case.

**Why per-frame rebuild is safe for moves (the regressions that motivated the
gating do not apply):** for a pure move the helper opacity stays ~1 throughout
(no dissolve), so there is no ISO dim-then-snap; the cone is a lit
`MeshLambertMaterial` (not the old ShaderMaterial that read flat); and the
dashed traces follow the smoothly-moving line. Measured cost on Utah FORGE is
~4ms/frame (helper rebuild ~1.5ms, ISO update ~0ms after the one-time initial
generation), well under a 16ms frame.

**Scalar ISO (isobands/isolines/bands):** the Section ISO crossfade now starts
only on an incompatible change -- `sceneSectionDiscreteChanged ||
sectionIsoRootStateChanged` (was: any `sceneSectionStyleChanged`). A pure move
therefore does NOT crossfade (crossfading held the source contours at the
source position and popped the target in -- the "ISO snaps" symptom); instead
`applyMtVolumeCutIsoFollowForMoveTween` regenerates the live overlay at the
interpolated cut so it follows. The contour rebuild is ~40ms, so the follow is
THROTTLED (`SECTION_ISO_MOVE_FOLLOW_INTERVAL_MS`, ~70ms) -- a stepped follow,
far smoother than the snap. Exit/enter/target-change still crossfade (the
overlay fades), which also fixed an earlier regression where a per-frame ISO
update cleared an exiting overlay instantly instead of fading.

**Guard:** the per-frame helper regeneration is scoped to move-only frames
(`!maskTransition`); never enable it for dual-mask/dissolve frames. The ISO
follow runs only when no Section ISO crossfade is active. Locked by
`tests/tools/scene-section-transition-behavior-source.test.mjs`.

## DEC-169 - Detached Section ISO exit roots fade without section bleed

**Supersedes:** DEC-100 and TRD-012 only where they forbid detached
visual-only Section ISO source-root fade-out on active-to-inactive or
active-to-unrelated transitions. DEC-100/TRD-012 remain authoritative for live
scene-section state, source section masks, helpers, controls, frame visuals,
ground traces, axes, cones, crop boxes, live clipping, and inactive target
application.

**Chose:** source Section ISO/isobar/isoline roots may be cloned as
transition-owned detached source roots before inactive target section state is
applied. Those detached roots fade to zero on the page-transition clock and are
removed or discarded at completion or interruption. The inactive target section
state still applies immediately; no live source section clipping, helper state,
frame controls, ground trace, axes, cones, crop box, or page fixture logic may
carry into the target.

**Why:** DEC-100 correctly stopped source section state from bleeding into
unsectioned targets, but applying the inactive target before snapshotting
Section ISO roots made isobars and isolines disappear in one frame. Section ISO
roots are already transition-owned derived visual roots with a discard path that
does not promote target roots. Treating the source root as a detached exit
visual preserves the no-bleed invariant while removing the visible snap.

**State machine:** active-to-inactive fades detached source ISO roots to zero
while live section state becomes inactive immediately. Inactive-to-active
attaches target ISO roots at zero/current transition opacity and fades them in.
Active-to-active incompatible changes crossfade source and target roots.
Active-to-active pure moves do not crossfade; DEC-168 move-follow remains the
owner.

**Guard:** do not implement this with page fixtures, page ids, page titles,
page indexes, page order, Utah live page-pair logic, broad visibility replay,
per-tick helper rebuilds, or MT scalar ownership changes. Locked by
`tests/tools/section-iso-transition-smoothing-source.test.mjs` and
`tests/tools/scene-section-transition-behavior-source.test.mjs`.

## DEC-170 - Compatible section moves outrank non-geometric section differences

**Supersedes:** DEC-164 and DEC-168 only where they allowed a non-frame
scene-section discrete change to dissolve every otherwise-compatible moving
frame, or allowed fixed Section ISO roots to crossfade during a compatible
section move solely because helper/control/flip state changed.

**Chose:** when source and target pages share a compatible section frame, that
frame stays in `movingFrameIds` and keeps the interpolated section-mask owner.
Non-geometric section differences such as target scope, helper controls, frame
flip commit state, or helper presentation state do not erase moving-frame
ownership. Section-affected layer snapshot crossfades are gated to real
`dissolveFrameIds`, while scalar/style/visibility owners handle their own
internal transitions on the moving section envelope.

**Section ISO:** compatible active-to-active section moves do not start fixed
source/target Section ISO root crossfades for generic section discrete changes.
When source and target ISO roots are both active on a compatible move, live ISO
overlays follow the interpolated cut and scalar/style owners may tween the
internal appearance. Fixed Section ISO root crossfades remain for real dissolved
frames, inactive-target detached exits from DEC-169, and incompatible ISO root
enter/exit or identity changes that cannot follow the shared moving frame.

**Why:** page transitions such as section page 20 -> 27 correctly classify the
shared `axis:x` frame as moving, but the classifier later converted that move to
a dissolve because the section flip/helper state differed. The visible result
was the section frame and contour-like contents being left behind, then popping
or snapping at the end. The runtime should behave as one moving section cut:
compatible frame geometry moves, while changed internals fade/tween through
their own owners.

**Guard:** no page fixture, page id, page title, page index, page order, or Utah
live page-pair logic. Do not weaken DEC-100/TRD-012 inactive-target no-bleed
rules, DEC-169 detached source-root exit rules, or the MT full-density scalar
transition path. Locked by
`tests/tools/scene-section-frame-partition-source.test.mjs` and
`tests/tools/section-iso-transition-smoothing-source.test.mjs`.

## DEC-171 - Section ISO roots follow transition-frame section geometry

**Supersedes:** DEC-168 only where Section ISO follow behavior was limited to
pure section moves, and DEC-169 only where target roots could wait until final
commit to rebuild against the active target section.

**Chose:** transition-frame section applies may update derived Section ISO roots
against the current interpolated section geometry. This is a root-lifecycle
owner only: it rebuilds or replaces MT Section ISO root geometry at the current
Section ISO envelope so isobars, isolines, and bands move with the section cut
instead of sticking to an old cut and snapping after a later UI/style apply.
Old transition-owned target roots must unregister before disposal so the
transition clock never drives stale roots.

**Local controls:** the ISO Volume quick toggle fades
`sectionIsoSourceOpacity` over 1000 ms on a scoped local RAF before persisting
the final value. The button must not directly write binary opacity values that
make the volume snap in or out.

**Guard:** this does not allow per-frame helper rebuilds for dual-mask section
transitions. It does not carry source masks, helpers, controls, axes, cones,
ground traces, frame outlines, crop boxes, live clipping, page fixtures, page
ids, page order, or MT full-density scalar ownership into the fix. Locked by
`tests/tools/section-iso-transition-smoothing-source.test.mjs`.

## DEC-172 - MT raymarched volume follows section transition masks

**Supersedes:** DEC-171 only where Section ISO root follow was not enough to
keep the underlying MT raymarched volume spatially aligned with the transition
section envelope.

**Chose:** the MT scalar-volume raymarch shader consumes the same
scene-section source/target mask transition uniforms as the terrain and
built-in material shader paths. Target-active section transitions apply an
initial transition-frame section state before the first layer-opacity fade tick,
so a hidden-to-visible MT volume enters already sectioned instead of briefly
appearing as an unsectioned volume. When the MT volume exits to a hidden target,
transition setup preserves the source scalar-volume style while the layer
opacity fades to zero; the target off-style is applied only after the fade
commit path owns the final state.

**Why:** Section ISO bands, isolines, and helper roots could be moving on the
section clock while the raymarched volume still used either the source inactive
section state or a target-hidden style that zeroed source opacity before the
fade. The visible result was a full-volume cloud appearing before it snapped to
the section envelope, or a source volume snapping out instead of fading.

**Guard:** this is an app-level scalar-volume/scene-section transition rule.
Do not repair the behavior with page fixtures, page ids, page titles, page
indexes, page order, Utah live page-pair logic, launcher changes, broad
visibility replay, or MT full-density scalar ownership changes. Locked by
`tests/tools/section-iso-transition-smoothing-source.test.mjs`.

## DEC-173 - Source-masked exit snapshots preserve clipped outgoing visuals

**Supersedes:** DEC-100, TRD-012, and DEC-172 only where they could be read to
forbid a transition-owned source snapshot from preserving the exact
scene-section or working-area clipping that was already visible at transition
start. The inactive target section state still applies immediately to live
target layers.

**Chose:** when a sectioned or working-area-clipped source layer exits to a
target page where that layer is hidden or opacity-zero, the outgoing visual may
be cloned as a transition-owned source snapshot before target section state is
applied. The snapshot keeps source clipping planes, source section object
visibility shader hooks, source raymarch section uniforms, and source
working-area focus state, then fades to zero on the page-transition clock. Live
target layer state remains target-authored and inactive/unclipped as required.

**Why:** applying inactive target section state before a source exit fade made
hidden outside-section geometry become visible during the fade. The observed
failure affected both built-in materials (top/threshold surfaces lost the
scene-section shader hook and clipping planes on their transition snapshot) and
the MT raymarched volume (the live layer kept fading, but its source section
uniforms were cleared to the inactive target). A transition-owned source
snapshot preserves what was actually visible at transition start without
carrying live source section state into the target.

**Guard:** no page fixture, page id, page title, page index, page order, or Utah
live page-pair logic. Do not allow helpers, controls, axes, cones, ground
traces, frame outlines, crop boxes, or live section clipping to bleed into
inactive targets. Do not change MT full-density scalar ownership. Locked by
`tests/tools/working-area-focus-transition-source.test.mjs` and
`tests/tools/section-iso-transition-smoothing-source.test.mjs`.
