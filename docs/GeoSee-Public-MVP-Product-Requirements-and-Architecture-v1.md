# GeoSee public-use MVP — product requirements and minimum architecture v1.0

**Status:** OWNER-APPROVED PRODUCT INTENT; VERSIONED REQUIREMENTS DOCUMENT STAGED IN DRAFT PR #8 (NOT MERGED). G1-01 IS SOURCE-IMPLEMENTED IN SEPARATE DRAFT PR #21, BUT BROWSER ACCEPTANCE AND THE REMAINDER OF GATE A/B ARE NOT VERIFIED.  
**Decision date:** 2026-11-14. **W3 owner record:** [approved W3 scope](https://app.notion.com/p/418fb09932768185a02cf9cb3492fb3e). **Tracking:** [W3 #6](https://github.com/jamespatrickjackson-lang/GEODE/issues/6).  
**Implementation evidence reference:** `main` at `29d9c4c7eee77ac1b104289b09b1382c574145d0`; [staged README V2](https://github.com/jamespatrickjackson-lang/GEODE/blob/822465e7ad86c6fb0d785484fee2fd35cf30c6cf/README.md).  
**Workstream:** W3 product and architecture. W1 agent governance, W2 current-state documentation and W4 release/verification remain separate.  
**Versioning rule:** This is a product-target document. It does **not** correct the as-built documentation, supersede historic decisions by silent implication, or assert that an unimplemented feature works. Changes require an issue, rationale, owner approval if scope changes, and a reviewed PR.

## 1. Scope and user promise

GeoSee is a free public **geoscience** visualization application for geoscientists, researchers and educators. The intended first useful public workflow is desktop-browser, single-user, static-hosted, and local-first. The target release will permit exploration of prepared scientific examples and, at Gate B, independent visualization of a deliberately constrained spatial dataset without source-code editing or a service account. These are release targets, not present-tense claims about current main. It is **not** the separate exploratory cross-domain GEODE OSS V2 platform, a geological modeller, a survey/metrology system, a generic native scientific parser or a certified engineering decision-support system.

**Primary MVP user:** a geoscientist, geology student or educator with small georeferenced point/line/polygon observations to inspect and communicate. **Secondary user:** someone exploring curated Utah FORGE, Woodjam or Shahbazi scientific examples. Raw seismic/MT, borehole logs and survey point-cloud authors are later users, not native-import users in v1.

### Owner-approved release progression

- **Gate A — curated-example explorer:** open Utah FORGE; read source and scientific limits; orbit/pan/reset; toggle a named layer; display a prepared section and legend; produce and open a valid labelled PNG. Remove or explicitly disable misleading new-project, staged-intake and server-save affordances in the public view-only route. Gate A may be published as a **curated-example preview only**, subject to W4 acceptance and separate release authorization.
- **Gate B — first independently reusable public MVP (target):** Gate A plus create a local project, import a bounded 2D WGS84 GeoJSON FeatureCollection, inspect features and properties, toggle/style layers, persist a self-contained local JSON project file, reopen after browser restart, and export a labelled PNG. No account, back-end write endpoint or manual manifest editing.
- **Gate C — later:** broader prepared source pathways, terrain import, drilling/log interpretation, raw SEG-Y/EDI/LAZ, derived calculations, arbitrary geospatial annotation, complex saved presentations, managed storage, collaboration and accepted video/advanced capture. None is a v1 acceptance requirement.

**Definition of independent use:** A representative user completes the documented Gate B journey on a static deploy with a fresh browser profile and a rights-cleared sample GeoJSON without Vite dev APIs, repository access or direct assistance. The project and exported figure survive refresh/restart. The software explicitly explains data limitations.

### Journey requirements

| Journey | Gate A | Gate B | Explicitly later |
| --- | --- | --- | --- |
| Explore included scientific example | Required; browser verification gate | Retained | Further case studies |
| Import own data | Not available, labelled | Constrained WGS84 GeoJSON | Other native formats |
| Configure project | Not available, labelled | Name, reference policy, layer options | Advanced project types |
| Visualize and inspect | Layers, source/legend, curated section | Imported attributes, styles and simple layer comparison | New calculations |
| Author result | Preset section, composition | Basic title/legend/view saved in bundle; PNG | Full annotation/deck authoring |
| Save/reopen/share/export | PNG only, **no project save** | Self-contained file bundle + PNG | Cloud links, video, shared edits |

## 2. Evidence boundary: what exists today

The pinned application implements a React 18/TypeScript/Three.js/Vite SPA, fixed project catalog, project JSON and authored pages, scene/layer registry, prepared GeoTIFF/GeoJSON/mesh/scalar renderers, editor/presenter and conditional capture routes. Audits B–D establish source wiring, not full public browser acceptance. The current **Add New Project** opens an existing Base GUI template, Utah **Add to Project** stages files without registering a scientific layer, and static hosting does not offer the Vite development-only `/api/write-batch` save endpoints. Generic own-data import, independent project creation and portable save/reopen **do not currently exist** as complete product flows.

The pinned [GitHub Actions CI run 43516222592](https://github.com/jamespatrickjackson-lang/GEODE/actions/runs/43516222592) passed its configured build/source checks (including 679 tool tests). It did not establish Gate A or B browser acceptance, scientific metrology, codec reliability or professional V&V. Historic local smoke tests have a different environment/receipt. **No newly proposed requirement below is called implemented or verified by this document.**

Primary audit sources: [B architecture](https://app.notion.com/p/418fb09932768168b8a6cd081ef03673), [C scientific data](https://app.notion.com/p/418fb0993276815b87eef3e1b722e294), [D functionality](https://app.notion.com/p/418fb09932768172bf51e3bd79c612f5), [E verification](https://app.notion.com/p/418fb09932768182b2d4f3a5ee5a39b9). W2 [current-state reconciliation](https://app.notion.com/p/418fb09932768134adfcebb24483d52e) remains the authority for proposed corrections to current claims.

## 3. Supported data and scientific claims

| Family | Pinned implementation pathway | v1 new user import? | Scientific boundary |
| --- | --- | --- | --- |
| Elevation terrain/GeoTIFF | Curated project-specific raster/terrain loader; sometimes prepared offline | **No** | Elevation CRS and vertical datum not generic |
| Ortho/satellite imagery | Prepared site imagery/positioning | **No** | An ordinary image does not establish georeferencing |
| GeoJSON points, lines, polygons | Existing project/schema-specific loaders and overlays | **Yes, a new constrained generic route must be built** | 2D horizontal WGS84; explicit local render transform |
| Boreholes, assays, geochemistry | Woodjam prepared drilling/assay/lithology plus site feature layers | **No** | No general trajectory/assay parser; intervals need units and surveys |
| SEG-Y seismic | Utah trace/header-driven offline preprocessing to prepared browser products | **No** | Time/depth and spatial geometry unqualified for general use |
| MT EDI and inversion | Utah EDI prep to stations, QC context, slices and scalar/volume products | **No** | Station observation, model output and interpretation distinct |
| Survey/point cloud/derived surfaces | Shahbazi sampled/tiled previews and project-specific derived products | **No** | Previews not complete LAS/LAZ or survey-grade quantities |
| Scalar volumes/meshes | Project-wired JSON and binary data | **No** | Visualization not validated inversion/metrology |

Public docs must distinguish source/observation, transformed/derived, interpretation, synthetic/demo and unknown. Missing dataset rights block inclusion in a distributed curated example until reviewed; Apache-2.0 licensing for authored software does not transfer third-party data rights.

### GeoJSON v1 input contract (approved direction; engineering details below remain gate-controlled)

- Input: an explicitly selected, **local** UTF-8 `.geojson` or `.json` file that parses as RFC 7946 `FeatureCollection`; provisional first implementation slice **Point, LineString and Polygon**, subject to later explicit geometry-subset owner approval and acceptance tests, with finite 2D longitude/latitude coordinate pairs. Multi geometries may be added by an independently tested contract amendment, not by broad advertisement.
- Reference: input locations are WGS84 longitude, latitude in degrees (EPSG:4326 / RFC 7946 order). Explicit contradictory CRS information, coordinate-order uncertainty, coordinates outside valid bounds or unsupported altitudes/datum must never be silently corrected or positioned as valid. **No imported Z/depth, time, terrain draping or vertical correctness claim.**
- Spatial placement: calculate a controlled, documented local render frame for a bounded working region. Capture source frame, origin, transform method/version, numeric precision envelope and unknown vertical datum. Validate at independent control points before accepting the working envelope or tolerance. Do not silently overlay newly imported features on existing Utah/Woodjam layers if their coordinate frames have not been verified compatible.
- Security/resource boundary: parse in a bounded manner; reject malformed inputs, non-finite coordinates, unsafe property content, unrecognized geometry and resource excess with a specific message. **Trial-only planning limit**: 5 MiB or 25,000 vertices; W4 measures and owner approves actual supported limits before release. Never execute file content or inject properties as HTML.
- Preview/commit: parse and validate without mutating scene; show feature count, spatial bounds, assumptions and warnings; user commits only a valid layer. On failure retain the existing project and scene.
- Provenance: preserve source filename and content digest, user-supplied source/rights when known (otherwise **unknown**), UTC import time, format and schema version, coordinate statement, transform version, feature count/bounds, observed/derived/interpretation/demo/unclassified label (default **unclassified**) and warnings. Do not infer “measured” from a point geometry. Retain original source bytes or exactly reproducible normalized geometry in the saved local bundle.

### Minimum scientific integrity

Every visible scientific layer should make its **source, classification, horizontal reference frame, known/unknown vertical datum, quantitative units where present, transform/derivation provenance and scientific limitations** accessible. Blank metadata are not silently replaced with “verified”. Legends must not imply units or scale accuracy absent from data. Disable or qualify survey-grade measures, resource estimates, borehole depth, seismic velocity/time-to-depth and MT inversion interpretations until separately scientifically validated.

## 4. Minimum architecture and interface seams

### Retain

Continue with existing React/TypeScript/Vite app shell, Three.js/OrbitControls and scene manager, project and page data, current curated-example loaders, layer visibility/style controls, preauthored Utah sections and a narrow PNG capture route. No rewrite of rendering engine, universal scientific plug-in SDK, new core platform or hosted authoring API is justified by v1.

### Binding page and transition independence (owner clarification, 2026-11-14)

**Application and project data are independent of presentation pages.** A page is a disposable viewer state: it may contain camera position, selected section, layer-visibility/style overrides, generic presentation properties, order and transition settings. Scientific datasets, layer specifications, loaders, metadata/provenance, geoscience controls, calculations and capture implementation belong to the application, project or scientific layer. Creating, duplicating, renaming, reordering, archiving or deleting a page must not create, remove, gate or change the underlying scientific capability. For example, Utah FORGE's 23 project-layer specifications and seven active authored pages are separate dimensions; no one-to-one mapping or restoration of archived pages is required to implement a feature.

**Transitions are semantic, reusable runtime behaviors.** The current live source render/view state and normalized destination state, including scientific entity identity, section geometry, material/scalar settings, visibility, representation compatibility and data readiness, determine the generic transition plan. Authored page ID, title, index, order or a hard-coded page pair must never choose a scientific transition algorithm. Page-local easing/duration or generic transition presets remain allowed. Follow the active `docs/dev-context/Transition-Runtime-Operating-Spec.md`, including its protected MT and Section ISO behaviors.

**Regression acceptance:** using disposable synthetic pages, verify that deleting/reordering/duplicating arbitrary view states retains project-layer data and functionality; creating a new view can access applicable project scientific capabilities; and semantically equivalent transitions behave consistently for different page IDs/order, including interruption/readiness and final target convergence. No edits to authored Utah pages or data are permitted as test fixes. See [page independence Issue #18](https://github.com/jamespatrickjackson-lang/GEODE/issues/18), [transition audit Issue #19](https://github.com/jamespatrickjackson-lang/GEODE/issues/19), and [synthetic test-only PR #22](https://github.com/jamespatrickjackson-lang/GEODE/pull/22). PR #22 currently has three intentional RED assertions and is not merge-ready. This paragraph adopts the owner's existing architectural invariant; it does not claim those regressions have been repaired or accept Gate A/B.

### Isolate

- A clear **curated example (read-only) versus user local project (editable)** capability boundary. Prevent the Base GUI template being marketed as self-service project creation.
- Project-specific Utah/Shahbazi/Woodjam rules from new generic feature intake; ordered registry matching must not accidentally invoke special-case loaders.
- Developer-only Vite filesystem writes; these stay available to developers but are never a public hosting or save dependency.
- Advanced conditional capture routes from the one tested public PNG contract.
- Project bundle formats/version handling from the source-code structure of old developer-authored project folders. Do not change historic files to make new-project tests pass.

### Add only a narrow new-project path

~~~text
STATIC HOSTED APP (no production backend)
Landing
  |-- Curated example -> existing bundled project manifest/data
  |                      -> existing scene / layer / section / PNG route
  |
  +-- New local project -> versioned in-memory project state
                           |
Local file picker -> bounded GeoJSON parse + semantic and CRS validation
                 -> review preview -> atomic in-memory layer commit
                           |
                  local feature-layer adapter
                           |
                 existing scene/layer manager
                           |
          layer inspection, visibility, basic styling
                           |
            +--------------+--------------+
            |                             |
       Save local bundle             PNG with metadata
            |
       Explicit local reopen -> schema/integrity check -> restore state

Dev-only Vite write API: unchanged, not a dependency of hosted workflow.
SEG-Y, EDI, large point-cloud preparation: existing specialist offline paths,
not converted to generic browser ingestion in v1.
~~~

**Suggested logical contracts, not yet frozen TypeScript definitions:**

| Boundary | Input → result | Failure contract |
| --- | --- | --- |
| `ProjectSource` | example slug or local bundle → validated project context | Unknown example or unsupported version gives explicit error, no partial scene |
| `GeoJSONValidator` | local byte stream + chosen 2D source policy → `Preview | Rejection` | Typed actionable error, no scene side effect |
| `FeatureLayerAdapter` | accepted feature geometry + known transform → scene objects and feature-id mapping | Out-of-range transform or unsupported shape rejected; no fake Z |
| `ProjectBundleCodec` | project + source + provenance + view → self-contained versioned JSON; inverse `open` | Corrupt, incompatible or newer versions never replace current project |
| `ImageExport` | current accepted view + visible metadata + dimensions → valid PNG | Unsupported size/GPU/path exposes failure; never report “saved” without file |

**Persistence:** Save via deliberate user download of one self-contained, versioned project JSON file for small supported inputs; reopen with an explicit file picker on a fresh session. Store feature identities, original or reproducible geometry, source digest/provenance, coordinate context, visible styles, layer order, selected view/camera and title. Temporary browser cache is convenience only. No autosave, account, cloud storage or silent upload promise. Large curated datasets may remain referenced by bundled assets; label such saves **not self-contained** rather than pretending portability. Version migrations are separate explicit work.

**Key code touchpoints (for later narrow PRs):** `src/projects/projectCatalogRuntime.ts`, `src/pages/loadPages.ts`, `src/scene/layerLoaderRegistry.ts`, `src/scene/layerLoaders.ts`, `src/scene/SceneManager.ts`, `src/editor/EditorContext.tsx`, `src/editor/save.ts`, and `plugins/vite-plugin-author-write.ts`. Inspect scoped agent contracts before implementation. No code edits are included in this W3 documentation PR.

## 5. Prioritized requirements register and observable acceptance

All IDs below are **approved target requirements**, **not implemented or verified at this W3 commit**. “Pass” is only recorded when W4 supplies a dated exact-SHA receipt. Efforts are uncertain incremental **engineer-weeks**, not additive calendar commitments. Define thresholds and observed test environments with W4 before a public release decision.

| ID / gate | User need / contract | Failure and provenance controls | Acceptance evidence | Indicative effort |
| --- | --- | --- | --- | --- |
| **MVP-F01 P0 A** | Select and reset curated example; known slug → deterministically loaded scene | Missing asset visible/retry; source and classification accessible | Static-browser Utah open/reset and missing-asset exercise | 1–2 w |
| **MVP-F02 P0 A** | Layer toggles, legend and one prepared section preset; visibility/preset → expected view | Unsupported section disabled, not fabricated | Fresh-browser named layer + prepared X/Y/Z section, novice findability | 1–2 w |
| **MVP-F03 P0 A** | Export labelled PNG; visible scene/dimensions → actual image file | Encoder/GPU/size failure explicit; source/limits accompany figure | Inspect magic bytes, dimensions, nonblank pixels, title/legend/context | 1–3 w |
| **MVP-F04 P0 A** | View-only public capabilities; static hosted app → only workable controls | Disable dev Save/staging/New Project until real workflow exists | No /api/write dependency or false-save success | 0.5–1.5 w |
| **MVP-F05 P0 B** | Create independent project; user name/reference selection → unique project | Invalid title/area/CRS blocks commit; no Base GUI substitution | Browser creates independent blank project; documented no-terrain state | 2–4 w |
| **MVP-F06 P0 B** | Validated GeoJSON import; chosen local file → preview → layer | Invalid format/frame/size/geometry leaves scene unchanged; no upload | Good/bad fixture paths, counts, bounds, messages and zero partial layers | 2–4 w |
| **MVP-F07 P0 B** | Visualize/inspect features; accepted coordinates/style/selection → mapped objects/properties | Unverified placement rejected, script text sanitized; datum unknown | Independent control fixtures, feature ID and property fidelity, visual browser check | 2–4 w |
| **MVP-F08 P0 B** | Portable project save/reopen; state → versioned local bundle → restored state | Unsupported/corrupt bundle does not overwrite; failed download explained | Fresh-profile round-trip of geometry, digest, metadata, view and styles | 2–4 w |
| **MVP-F09 P0 B** | Scientific context in UI and output; layer metadata → source/classification/units/reference/limits | Missing values shown **unknown**, never silently invented | Change-layer source/legend test; provenance round-trip; PNG metadata review | 1–3 w |
| **MVP-F10 P1 B** | First-run usability/error recovery; guided actions → complete documented journey | Disabled reasons and retry paths; prior state retained | 3–5 representative novice users; completion/errors documented, owner-set threshold | 1–3 w |
| **MVP-N01 P0** | Static, privacy-preserving, hosted operation | No public dev writer, unsafe upload or unapproved third-party requests | W4 static route, network, security and rights acceptance | W4-owned |
| **MVP-N02 P0** | Checked spatial visualization without false precision | Unknown CRS/vertical datum blocked/qualified; no survey-grade claim | Independent control-point fixture and recorded tolerance/working envelope | W3/W4/science |
| **MVP-N03 P0** | Reproducible build/browser evidence | CI fails for blocking errors and corrupted exports | Exact SHA, clean build, deterministic tests, static Playwright, bundle/PNG receipts | W4-owned |
| **MVP-N04 P0** | Rights and attribution integrity | Unclear redistributed data rights block affected asset | Dataset/third-party review with decision receipts | W4/owner |
| **MVP-N05 P1** | Bounded resources and browser support | Oversized input/memory exhaustion has recoverable error | Measured Chromium/Firefox profiles and owner-approved load/size thresholds | W4-owned |
| **MVP-N06 P1** | Accessible and compatible saved projects | Keyboard focus/errors; unsupported bundle version identified | Keyboard journey and legacy/newer-schema rejection fixture | ~1–3 w |

**Three independent acceptance layers:**

1. **Software correctness:** contracts, parser/security and schema tests, project/layer state, deterministic coordinate transformation, bundle round-trip, no scene mutation on import failure, source-level regressions and build. Existing CI at pinned main is background evidence only.
2. **Runtime and user acceptance:** real static deployment; actual navigation/section/layer actions; PNG download and open; fresh-browser project reopen; appropriate keyboard/novice success; explicit target browser/hardware/GPU details; captured failures.
3. **Scientific integrity and V&V:** independently checked control points, CRS/units/origin/provenance and stated limits for permitted visualization. This does **not** validate original SEG-Y survey geometry across arbitrary sites, MT inversions, interpreted lithology, survey-grade lengths/volumes or consequential engineering decisions.

**Release receipt:** W4 records source SHA, environment, commands, fixture hashes, browsers/GPU, screenshots/console/network, invalid inputs, reloaded bundle, actual image bytes, review of rights and security advisories, numeric fixture tolerances, residual risk and explicit owner acceptance. Never equate `npm run build` or green CI with scientific acceptance.

## 6. Incremental engineering plan (after authorization of each code change)

| Gate / proposed independently reviewable future issue/PR | Deliverable | Hard acceptance/dependency |
| --- | --- | --- |
| G0 — W3 scope versioning | This approved product direction and scope, with traceability | Product owner approval recorded; draft doc PR reviewed separately; W2 factual conflicts held per claim |
| G1 — Curated explorer | Working guide, static view-only affordances, preset section, labelled real PNG | W4 static-browser + asset/rights + output verification |
| G2 — New local-project contract | Versioned logical model, independent creation and explicit CRS/no-terrain policy | Unit/project fixture and owner/maintainer schema review |
| G3 — GeoJSON intake + adapter | Safe bounded validator, preview, generic feature loader and coordinate fixture | Invalid input leaves scene untouched; independent spatial checks |
| G4 — Bundle/reopen + provenance | Downloadable self-contained project, exact reimport, visible metadata | Fresh-session round-trip and corrupt/newer-version recovery |
| G5 — Communicable output | Basic inspection/style/title, labelled view and PNG | End-to-end own-data → saved project → scientifically qualified image |
| G6 — W4 release acceptance | Software/browser/security/rights/usability/scientific-bounds evidence | Owner release authorization after written residual risks |

**Sequence:** G0 → G1 for the optional public curated preview; G0 → G2 → G3 → G4 → G5 → G6 for the B MVP. Some independent tests may run in parallel but no public claim advances without a gate. Use one scoped engineering issue and focused PR for each substantive independently verifiable increment after approval. Do not create speculative placeholders or merge unverified work. W1 [draft PR #2](https://github.com/jamespatrickjackson-lang/GEODE/pull/2) and W2's owner-accepted ten-file [documentation draft PR #16](https://github.com/jamespatrickjackson-lang/GEODE/pull/16) (including README V2) must not be modified by W3. W4 [#7](https://github.com/jamespatrickjackson-lang/GEODE/issues/7) owns final check implementation and verification receipts.

## 7. Economics, risks and unresolved engineering parameters

**Engineering order of magnitude, cumulative:** Gate A **3–6 engineer-weeks**, B **12–24 engineer-weeks**, advanced C **24–45+ engineer-weeks**. Assumes reuse of current software, a suitably experienced engineer and fractional scientific/UX review; no new managed backend or full native scientific converters. Include 30–50% contingency until first integration/profile spike. These are **not quotes, delivery dates or approved budgets**.

**Operating cost:** Static/CDN hosting and downloadable prepared asset bandwidth dominate; own data remain local. There is no required per-user server compute, data storage or user-account budget for v1. Actual traffic, third-party asset rights, hosted data footprint and chosen provider remain uncosted. Raw geophysical ingestion, cloud collaboration and full video services would materially expand costs.

| Risk | Priority | Response |
| --- | --- | --- |
| Wrong coordinate frame, wrong vertical assumption or apparent scientific precision | Critical | Bounded 2D WGS84 policy, explicit unknown datum, independent controls and rejected unsupported transforms |
| Data loss and false project-save assurances | High | Explicit download, fresh-profile reimport, incompatible bundle safety, no dev API |
| Malicious or excessive file input | High | Strict format/resource limits, no HTML execution, failure isolation |
| Third-party scientific/imagery rights | High | Asset-level rights and attribution gate before distribution |
| Regression caused by project-specific loader dispatch | High | Isolate new adapter, preserve Utah/Woodjam/Shahbazi regression fixtures |
| Browser GPU/export variance | Medium/high | Static image-bytes acceptance on defined browser profiles |
| Uncontrolled scope expansion | High | One data family, incremental reviewed issues and PRs |
| Novice usability and maintenance | Medium | Intro path, disabled reasons, docs and measured novice exercise |

**Open measured parameters, not silent requirements:** initial exact project-schema field shape; first supported GeoJSON geometry subset beyond singular types; projection/local-frame algorithm and numerical tolerance; supported geographic extent; realistic max bytes/vertices/load time; accepted browser version/hardware matrix; hosting/rights budget; quantified novice pass threshold. W3 owner has approved the direction, **not fictitious measured values**. Close each with W4 evidence, explicit review and a versioned decision amendment before invoking a binding numerical release test.

## 8. Decision record, status and interfaces

**Approved W3-D01–D10, 2026-11-14:** Option B MVP / Option A earlier gate; local-first desktop static architecture; constrained 2D GeoJSON; terrain-free local project with bounded frame; explicit JSON save/reopen; simple source-aware inspection/PNG; non-engineering and non-survey scientific scope; W4-led browser/size thresholds after profiling; distinct W4 readiness; representative novice acceptance study. [Owner approval and original alternatives](https://app.notion.com/p/418fb09932768185a02cf9cb3492fb3e). The underlying proposal remains for dated rationale. There is **no owner approval** of arbitrary data formats, numeric precision or unchecked release claims.

**Status meanings:** `APPROVED PRODUCT TARGET` (owner chose expected behavior); `IMPLEMENTED` (merged software at known SHA); `VERIFIED` (test receipt for exact acceptance); `RELEASE-ACCEPTED` (independent owner sign-off). An approved requirement is not an implemented feature.

**Document authority:** This W3 v1 target is not the source of truth for what current `main` does; W2 owns current-state correction and 34 GDR items. No AGENTS.md/CLAUDE.md changes are in this PR; W1 controls its 61-rule crosswalk and live provider-loading holds. W4 derives specific test suites/limits for the accepted workflow, while keeping actual execution evidence separate. Maintain issue-to-PR links and distinguish hard/soft dependencies.

**Review and merge gate:** Source-aligned terminology; full W3 requirement coverage; no overlap with W1/W2 owned files; exact base SHA; owner review of open numerical/schema decisions; no scope creep or unsupported verification claims. **Draft PR creation does not authorize merge or implementation.**
