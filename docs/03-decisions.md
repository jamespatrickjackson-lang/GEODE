# Decision Log

Last updated: 2026-05-12

This log records the current locked decisions. Earlier decisions are preserved in summarized form and later decisions explicitly supersede older scope where the app has moved on.

## Format

Each decision records:

- considered
- chose
- why
- trade-off accepted
- supersedes, if applicable

## #001 - 2026-04-29 - Renderer: Three.js

**Considered:** Cesium, Three.js, Unreal Engine.

**Chose:** Three.js.

**Why:** GeoSee needs art-directed cinematic presentation control in the browser.

**Trade-off accepted:** No globe, terrain streaming, or georeferencing for free.

## #002 - 2026-04-29 - Hosting: static self-hosted artifacts

**Considered:** managed 3D platforms, hosted tile services, static self-hosted output.

**Chose:** Static self-hosted builds as the target artifact shape.

**Why:** Low cost, portable deliverables, and no platform dependency for alpha demos.

**Trade-off accepted:** GeoSee owns data preparation and scene optimization.

## #003 - 2026-04-29 - Original project model: one project, one presentation

**Considered:** one project per audience, multi-audience from one project.

**Chose:** originally one project = one presentation.

**Why:** The first alpha needed speed and clarity.

**Trade-off accepted:** Duplicated project work for audience variants.

**Superseded in part by:** #028 and #030.

## #004 - 2026-04-29 - Provenance: manual metadata, no workflow engine

**Considered:** full approval workflow, manual metadata.

**Chose:** manual provenance metadata and source notes.

**Why:** Provenance discipline matters immediately; workflow automation can wait.

**Trade-off accepted:** Human review remains outside the app.

## #005 - 2026-04-29 - Overlay charts: images first

**Considered:** rendered chart engine, static images.

**Chose:** images and markdown first.

**Why:** Faster for alpha, enough for current narrative panels.

**Trade-off accepted:** Chart updates are manual.

## #006 - 2026-04-29 - Video export target: scripted browser capture

**Considered:** browser MediaRecorder, headless capture, offline film pipeline.

**Chose:** scripted browser capture as future alpha export path.

**Why:** Deterministic and close to presenter output.

**Trade-off accepted:** Not a full cinematic offline render pipeline.

## #007 - 2026-04-29 - Original audience modes decision: defer

**Considered:** audience-mode multiplexing in alpha.

**Chose:** defer persistent audience-mode authoring.

**Why:** Too much early data-model and UI complexity.

**Trade-off accepted:** No persistent multi-audience authoring model yet.

**Superseded in part by:** #030.

## #008 - 2026-04-29 - Storage: local working tree with external backup

**Considered:** synced-drive working tree, local working tree.

**Chose:** local working tree.

**Why:** Active node/build workflows are unreliable in synced folders.

**Trade-off accepted:** Backup/sync is operational, not automatic project storage.

## #009 - 2026-04-29 - Repo root directly in working folder

**Considered:** nested wrapper folder, direct repo root.

**Chose:** direct repo root.

**Why:** Simpler paths and fewer wrappers.

**Trade-off accepted:** None material.

## #010 - 2026-04-29 - Documentation pattern

**Considered:** one large readme, routed docs.

**Chose:** short router docs plus detailed docs and decision log.

**Why:** Keeps handover context manageable.

**Trade-off accepted:** More docs to maintain.

## #011 - 2026-04-29 - Original supported formats

**Considered:** proprietary native importers, basic open formats.

**Chose:** open/prepared project files first.

**Why:** Alpha work should avoid vendor importer projects.

**Trade-off accepted:** Data is prepared outside the app.

## #012 - 2026-04-29 - CRS: one project basis

**Considered:** mixed CRS handling inside a project, one conformed basis.

**Chose:** one conformed project basis.

**Why:** Simpler and safer for current alpha.

**Trade-off accepted:** Preprocessing handles CRS alignment.

## #013 - 2026-04-29 - App framework: React

**Considered:** Svelte, React.

**Chose:** React.

**Why:** Fastest reliable implementation path for this repo.

**Trade-off accepted:** Some larger UI files and more boilerplate.

## #014 - 2026-04-29 - Alpha framing

**Considered:** build directly to v1, build an alpha probe.

**Chose:** alpha probe.

**Why:** The service/product shape should be learned from real demos.

**Trade-off accepted:** Some alpha code will be refactored or replaced.

## #015 - 2026-04-29 - Woodjam first

**Considered:** multiple first demos.

**Chose:** Woodjam as first reference project.

**Why:** Real public exploration data and a credible reference story.

**Trade-off accepted:** First reference was exploration-scale, not high-fidelity site-scale.

## #016 - 2026-04-29 - Woodjam narrative guardrail

**Considered:** unsupported Three Firs drilling, vectoring narrative, later data acquisition.

**Chose:** narrative constrained to supportable public data.

**Why:** Do not show falsifiable or unsupported drilling geometry.

**Trade-off accepted:** Some chapters are visually thinner until source data exists.

## #017 - 2026-04-29 - Hosting target: Cloudflare Pages

**Considered:** Cloudflare Pages, S3/CloudFront, Netlify.

**Chose:** Cloudflare Pages as preferred static target.

**Why:** Fast alpha deployment with minimal overhead.

**Trade-off accepted:** Light provider coupling.

## #018 - 2026-04-29 - Build model: solo with AI coding support

**Considered:** contractor, mixed team, solo with AI support.

**Chose:** solo with AI coding support for alpha.

**Why:** Lowest coordination cost for a fast alpha.

**Trade-off accepted:** Low bus factor.

## #019 - 2026-04-29 - No auth in current alpha

**Considered:** password gate, hosted access control, no auth.

**Chose:** no auth for current public/demo alpha.

**Why:** Current demo data is public/demo and meetings are controlled.

**Trade-off accepted:** Non-public projects will need a new decision.

## #020 - 2026-04-29 - Woodjam terrain source

**Considered:** SRTM, CDEM, MRDEM.

**Chose:** MRDEM for Woodjam terrain.

**Why:** Current public Canadian elevation product with no login friction.

**Trade-off accepted:** Project-specific preprocessing remains needed.

## #021 - 2026-04-29 - Working tree: `C:\GeoSee_Dev`

**Considered:** synced-drive working folder, local working folder.

**Chose:** `C:\GeoSee_Dev`.

**Why:** Avoid file-locking and build-output issues.

**Trade-off accepted:** Backup is separate from active development.

## #022 - 2026-04-29 - Authoring writes through dev-only endpoint

**Considered:** File System Access API, dev-only Vite write endpoint.

**Chose:** dev-only write endpoint.

**Why:** Smooth local authoring without production backend.

**Trade-off accepted:** Authoring remains a trusted local/dev workflow.

## #023 - 2026-04-29 - Environment setup as source of truth

**Considered:** every page fully defines scene state, environment plus page deltas.

**Chose:** `environment.json` as the world/default state, pages as deltas.

**Why:** Removes ambiguity around which page owns the scene.

**Trade-off accepted:** Editor needs explicit global/page distinction.

## #024 - 2026-05-01 - Scene overlays as first-class layer family

**Considered:** markdown images, ordinary layers, first-class scene overlays.

**Chose:** first-class scene overlays.

**Why:** Georeferenced/projected figures need provenance, page activation, and scene-space control.

**Trade-off accepted:** More schema and loader surface.

## #025 - 2026-05-01 - Authoritative palettes with sparse overrides

**Considered:** manually maintained color maps, canonical source palettes, sparse overrides.

**Chose:** canonical palette defaults with sparse environment overrides.

**Why:** Better credibility and lower authoring burden for large categorical geology-style layers.

**Trade-off accepted:** Requires source palette preparation.

## #026 - 2026-05-01 - Commercial shape: project-anchored entry

**Considered:** annual subscription first, project artifact first.

**Chose:** project-anchored artifact as entry point.

**Why:** Better fit for early stakeholder conversations and service-first delivery.

**Trade-off accepted:** Retainer/SaaS framing comes later.

## #027 - 2026-05-11 - Multi-project folder support

**Considered:** keep hardcoded Woodjam paths, project-aware folder loading.

**Chose:** project-aware loading.

**Why:** Woodjam and Case Study B must coexist without path hacks.

**Trade-off accepted:** Project path resolution becomes a shared concern.

**Supersedes:** #003 in part.

## #028 - 2026-05-11 - Shahbazi Gravel Pit as high-fidelity Case Study B

**Considered:** keep Case Study B procedural only, use a real open dataset.

**Chose:** Shahbazi et al. gravel pit dataset as the first high-fidelity quarry source.

**Why:** It provides UAV images, GCP/check points, object/tie points, and TLS point cloud source material.

**Trade-off accepted:** Current app uses preview products until full photogrammetry/orthomosaic/Potree assets exist.

## #029 - 2026-05-11 - Keep procedural shell as fallback

**Considered:** replace the procedural shell immediately, keep it as fallback.

**Chose:** keep procedural shell.

**Why:** Case Study B must still open when real/future processed files are absent.

**Trade-off accepted:** Demo placeholders must remain visibly labelled as placeholders.

## #030 - 2026-05-11 - Audience Lens: runtime-only for Shahbazi

**Considered:** persistent multi-audience authoring, runtime-only lens controls.

**Chose:** runtime-only Audience Lens for Shahbazi.

**Why:** Demonstrates audience-specific readings without committing to persistent authoring complexity.

**Trade-off accepted:** Lens choice resets on reload and does not save.

**Supersedes:** #007 in part.

## #031 - 2026-05-11 - Shahbazi surfaces remain separate

**Considered:** combined mesh, seam mesh, island knit, separate surfaces.

**Chose:** separate broad outer surface and TLS island surface.

**Why:** Mesh-stitching created visual and provenance problems.

**Trade-off accepted:** The transition between sparse outer surface and fine TLS surface remains a visible data-resolution boundary.

## #032 - 2026-05-11 - Broad Shahbazi outer surface is preview interpolation

**Considered:** label outer surface as LiDAR, label it as sparse object-point preview.

**Chose:** label it as sparse photogrammetry object-point interpolation.

**Why:** It is not LiDAR and must not be represented as measured LiDAR terrain.

**Trade-off accepted:** The layer is less impressive than a final reconstructed surface, but honest.

## #033 - 2026-05-11 - Active preview files separate from future targets

**Considered:** mix missing future paths with active files, split them.

**Chose:** `previewFiles` for active assets and `futureTargets` for planned outputs.

**Why:** Audits should not flag planned GLB/Potree/orthomosaic targets as broken active files.

**Trade-off accepted:** Layer specs carry two file maps.

## #034 - 2026-05-11 - Surface/photo render policy is named

**Considered:** keep material/depth settings inline, centralize them.

**Chose:** `surfaceRenderPolicy.ts`.

**Why:** Surface, contour, and photo layering are fragile enough to need a named contract.

**Trade-off accepted:** Loaders import a shared policy file.

## #035 - 2026-05-11 - Generated Shahbazi mesh winding should be correct

**Considered:** fix face side at runtime, fix generated artifacts.

**Chose:** fix generated artifacts and keep loader generic.

**Why:** UAV/top side should be the front face and future meshes should follow the same contract.

**Trade-off accepted:** Prep scripts own more validation.

## #036 - 2026-05-12 - Base GUI Template

**Considered:** edit GUI defaults inside a real project, create a blank template project.

**Chose:** Base GUI Template.

**Why:** Shared GUI/environment defaults need an empty safe editing context.

**Trade-off accepted:** It is a placeholder project, not real data.

## #037 - 2026-05-12 - Dark frosted GUI aesthetic

**Considered:** old light editor, dark overlay-box-aligned GUI.

**Chose:** dark frosted overlay-box style across landing/editor/HUD.

**Why:** The authoring shell should visually align with the actual presentation artifact.

**Trade-off accepted:** More style state is shared with project GUI settings.

## #038 - 2026-05-12 - Home exits to landing with unsaved prompt

**Considered:** home jumps to first page, home returns to landing.

**Chose:** home returns to landing and prompts when unsaved.

**Why:** Bottom HUD home should mean app/project home, not page one.

**Trade-off accepted:** Home control now depends on editor dirty/save state.

## #039 - 2026-05-12 - Editor chrome lazy-loaded

**Considered:** bundle editor with landing, lazy-load editor after project selection.

**Chose:** lazy-load editor chrome.

**Why:** Keeps landing lighter and addresses part of the large-bundle issue.

**Trade-off accepted:** The first project open has a Suspense loading state.

## #040 - 2026-05-12 - Layer loader registry

**Considered:** keep loader branches in `scene.ts`, move to registry.

**Chose:** `src/scene/layerLoaders.ts`.

**Why:** New projects/layers should register loader behavior without bloating scene mounting.

**Trade-off accepted:** The registry still contains project-specific cases and should be refined over time.

## #041 - 2026-05-12 - Sun lock-to-camera can be global or page-level

**Considered:** fixed model-locked sun, global camera lock only, page override.

**Chose:** global lock plus page-level inherit/on/off behavior.

**Why:** Some pages need dynamic camera-aware lighting while others should preserve authored static light.

**Trade-off accepted:** Environment and page application must coordinate lighting state carefully.

## #042 - 2026-05-12 - Utah FORGE starts as a foundation project

**Considered:** wait for the full briefing before adding the project, or add a clean placeholder foundation now.

**Chose:** add Utah FORGE as a selectable foundation project.

**Why:** The landing/project architecture should be ready before the detailed briefing arrives, while keeping all real technical claims out of the repo until sources are known.

**Trade-off accepted:** Utah FORGE currently opens with a procedural reference stage only. CRS, bounds, source data, and real layers remain pending.
