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
