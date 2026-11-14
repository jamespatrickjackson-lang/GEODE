# Projects — shared agent instructions

Scope: files under `projects/`. This is a provider-neutral working contract for scientific project content, not a replacement for source manifests or the technical specifications. The existing `projects/CLAUDE.md` remains unchanged while instruction routing is validated.

## Project structure

Each project combines small, authored JSON state with potentially large scientific inputs, processed outputs, visual assets, rasters, and provenance.

- `base-gui/`: base GUI scene.
- `case-study-b/`: Case Study B.
- `utah-forge/`: Utah FORGE Phase 3. The original project contract recorded approximately 116 MB under `utah-forge/data/`; this is a historical estimate, not a current measurement.
- `woodjam/`: Woodjam.

Treat this directory map as a navigation aid, not as evidence that all inputs are distributable or scientifically verified.

## Search and data boundaries

- Do not recursively search `projects/*/data/**` unless the task specifically requires source-data inspection. These folders contain huge GeoJSON coordinate arrays, binary scalar/position tiles, WebP/JPG/TIFF rasters, and manifests, statistics, and scientific provenance records.
- Search the smallest relevant project, dataset and product subtree. For example, scope work on Utah FORGE resistivity to `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/` rather than searching every project.
- Avoid interpreting generated visual assets as independent source evidence. Check the corresponding data/provenance manifests before making a spatial or geophysical accuracy claim.
- Review `docs/LICENSING.md`, `docs/GEODE-publication-manifest.md`, and relevant project manifests before republishing or extracting source material. The project software licence does not automatically cover external datasets, reports or imagery.

## Authoring persistence

- Project authoring state persists on disk under `projects/<project>/` through the development-only Vite endpoint `/api/write-file`, registered in `vite.config.ts`.
- Preserve existing `project.json`, `environment.json`, page/overlay and project authoring state unless the task explicitly requires editing it.
- Do not silently replace this persistence model with IndexedDB, LocalStorage or a new backend. Changing persistence architecture needs explicit owner direction.
- The live Utah FORGE page deck is disposable *authoring state*, not a fixture for generic application behavior tests. Use synthetic fixtures for app-level behavior; keep deck-specific checks labeled as such. Refer to `docs/dev-context/Verification-Routing.md` and `docs/dev-context/Transition-Runtime-Operating-Spec.md`.

## Upstream source and archive provenance

- Historical upstream/raw source buckets are separate from the tracked application repository. The original local source location was recorded as `C:\GeoSee\GeoSee_Archive\`; this is provenance, not a portable instruction or an assertion that the path exists in any current environment.
- Resolve historical repo-relative source identifiers through `docs/archive-map.md` and `docs/archive-manifest.json`. A path recorded in historical provenance is not authorization to switch working trees, alter archives, or assume access to a local drive.
- Preserve traceability to the original scientific source and explicitly label missing or unverified source members.

Historical source (immutable Git baseline): [`projects/CLAUDE.md` at 29d9c4c, lines 1–41](https://github.com/jamespatrickjackson-lang/GEODE/blob/29d9c4c7eee77ac1b104289b09b1382c574145d0/projects/CLAUDE.md#L1-L41). The source remains available if a future `CLAUDE.md` becomes a provider-specific router. Consolidation status and held decisions are tracked in [the migration plan](../docs/dev-context/Agent-Instruction-Consolidation-Plan.md).
