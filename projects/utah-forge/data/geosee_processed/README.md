# Utah FORGE GeoSee-Processed Outputs

Updated: 2026-05-12

This folder is for reviewed, converted, GeoSee-loadable Utah FORGE outputs.

Original delivered/client files belong under:

```text
../client_preprocessed/
```

## Current Active Output Family

The current active output family is:

```text
utah_forge_phase_3/electrical_resistivity/
```

It contains:

- intake inventory and CRS/origin notes
- measured MT station markers
- source-derived MT resistivity point preview
- source-derived authored MT resistivity slices

## Current Inactive Output Families

These folders are reserved but not active:

```text
forge_southwestern/electrical_resistivity/
forge_southwestern/seismic_analysis/
utah_forge_phase_3/seismic_analysis/
```

Do not add project layer records for these until real processed outputs exist and provenance is written.

## Output Rule

Every app-ready output should have:

- a known source under `client_preprocessed/`
- a provenance sidecar or manifest
- CRS/transform documentation
- row counts or feature counts where relevant
- a clear classification
- a matching `project.json` layer only after the output exists
