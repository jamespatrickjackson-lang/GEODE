# GeoVox Spine

Last populated: 2026-05-15

## Working Spine

| Layer | Role | Status | Evidence |
| --- | --- | --- | --- |
| Source / client data | Delivered or public source material preserved before GeoSee conversion | Observed | `docs/woodjam/`, `data/`, `projects/*/data/client_preprocessed/`, Shahbazi raw folders |
| Prep pipeline | Converts source data into browser-ready GeoSee artifacts | Observed | `prep/`, Shahbazi scripts, Utah FORGE scripts |
| GeoSee processed outputs | App-ready artifacts, manifests, provenance, previews, tiles, volumes, meshes | Observed | `projects/*/data/processed/`, `projects/utah-forge/data/geosee_processed/` |
| Project manifests | Runtime project metadata, layer records, source metadata, `previewFiles`, `futureTargets`, page order | Observed | `projects/*/project.json`, `src/pages/types.ts` |
| Environment/page state | Default visibility/style/scene state and page-specific presentation deltas | Observed | `projects/*/environment.json`, `projects/*/pages/*.json`, `docs/02-architecture.md` |
| Runtime renderer | Three.js scene, loaders, materials, visibility, style, transitions, legends | Observed | `src/scene.ts`, `src/scene/`, `src/loaders/`, `src/ui/` |
| Editor | Internal authoring controls for pages, layers, overlays, environment, dirty state, saves | Observed | `src/editor/`, `plugins/vite-plugin-author-write.ts` |
| Presenter / preview | Guided page experience and overlay display inside the app shell | Observed | `src/pages/`, `src/presenter/`, `src/editor/EditorChrome.tsx` |
| Verification | Build/test/render evidence for app behavior | Observed | `package.json`, `tests/utah-forge-smoke.spec.ts`, `CHANGELOG.md` verification notes |
| Control plane | Lab-book/register/receipt rail around the app | Observed | `docs/dev-context/` |

## Source vs Interpretation

| Type | Definition | Status | Example |
| --- | --- | --- | --- |
| Source | Direct file, manifest, config, test, generated artifact, or human acceptance record | Observed | `projects/utah-forge/project.json` says status is `phase-3-seismic-browser-and-mt` |
| Inference | Interpretation or recommendation derived from sources | Observed as concept | "SceneManager split is likely useful" |
| Acceptance | Human-promoted state | Unverified / needs human review | Existing `Acceptance-Register.md` has skeleton entries only |
| Verification | Build/test/source-count/render evidence | Observed | `npm run test:utah-forge` exists; smoke test source checks many Utah FORGE assets |

## Product Spine Now

| Product point | Status | Evidence |
| --- | --- | --- |
| GeoSee / Geovox is not just a Woodjam-only prototype in current code/docs. | Observed | `docs/START-HERE.md`, `projects/`, project catalog |
| The repo is still alpha/internal and not a production SaaS/GIS/engineering tool. | Observed | `README.md`, `CLAUDE.md`, `docs/00-purpose.md`, `docs/01-scope.md` |
| The current working product idea is a service-first visual communication artifact, with internal authoring and guided presentation. | Observed | `docs/00-purpose.md`, `docs/START-HERE.md` |
| The data-honesty spine is measured vs source-derived vs preview vs placeholder vs future target. | Observed | `docs/START-HERE.md`, project layer metadata |
| One project spine with audience-tuned readings is a product thesis, but persistent multi-audience authoring is not implemented. | Observed | `docs/START-HERE.md`, `docs/02-architecture.md`, `src/audience/` |

## Guardrails

- Observed: Do not treat this folder as official DHF.
- Observed: Do not collapse SRI, Processware, DHF, or control-plane concerns into runtime app code in this pass.
- Observed: Do not treat old handoff notes as active truth until contradictions are reviewed.
- Observed: Deterministic source state should remain separate from AI interpretation.
- Unverified / needs human review: Which docs become active references after Utah FORGE reconciliation.

## Current Tension

Observed tension: the app/data state has moved faster than several docs. Utah FORGE is the clearest example: older notes say foundation/no seismic, while manifests, environment defaults, CHANGELOG, and tests show active MT/seismic/public-context behavior. The spine needs a reviewed doc/register layer before more architecture work.

## Utah FORGE Intake Rail

For this repo context, GeoVox is a subsystem mapping and code/variables spine rail definition. In this documentation pass, it is a dev-context lab-book layer that maps project state, software endpoints, intake rails, data paths, review surfaces, and next valid moves.

Current intake rail for drop `2026-05-16_02-45-23_1kbq3z`:

```text
messy drop
-> intake_staging/drop folder
-> intake_context
-> intake_manifest
-> BUILD_DIRECTIVE
-> source_inventory
-> processing_plan
-> proposed_next_steps
-> proposed_page_update_plan
-> pdf_review
-> app review page
-> overlay
-> human review gate
```

Software endpoints identified:

| Endpoint | Path / evidence |
| --- | --- |
| Drop folder | `projects/utah-forge/intake_staging/drops/2026-05-16_02-45-23_1kbq3z/` |
| Intake manifest | `projects/utah-forge/intake_staging/drops/2026-05-16_02-45-23_1kbq3z/intake_manifest.json` |
| Source inventory | `projects/utah-forge/intake_staging/drops/2026-05-16_02-45-23_1kbq3z/source_inventory.json`, `projects/utah-forge/intake_staging/drops/2026-05-16_02-45-23_1kbq3z/source_inventory.md` |
| PDF review | `projects/utah-forge/intake_staging/drops/2026-05-16_02-45-23_1kbq3z/pdf_review/` |
| Review page | `projects/utah-forge/pages/intake_2026-05-16_02-45-23_1kbq3z.json` |
| Review overlay | `projects/utah-forge/overlays/intake_2026-05-16_02-45-23_1kbq3z/text.md` |
| Page order entry | `projects/utah-forge/project.json` includes `intake_2026-05-16_02-45-23_1kbq3z` |

Control boundaries:

- staged
- proposed
- accepted false
- review required
- no layers from dropped files
- no computed artifacts
- no `data/geosee_processed` writes reported by the source inventory

Why this system matters:

This rail lets messy project material become app-visible review state without becoming accepted project truth.
