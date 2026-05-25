# Utah FORGE Data References

This folder is for Utah FORGE source notes, citations, download instructions, provenance records, processing briefs, and decision notes that are not themselves active app data.

## Current State

The current authoritative project docs are:

```text
../Utah_Forge_Decisions.md
../Utah_Forge_DevPlan.md
../Utah_Forge_Data_Intake_Checklist.md
../AI_NEXT_AGENT_START_HERE.md
../AI_FUTURE_DATA_INPUT_PLAYBOOK.md
../Utah_Forge_Next_Stage_Gates.md
```

Current Phase 3 MT processing evidence and provenance is under:

```text
../data/geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/
../data/geosee_processed/utah_forge_phase_3/electrical_resistivity/stations/
../data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/
```

Current Phase 3 demo/orientation well evidence is under:

```text
wells/phase3_demo_boreholes.md
../data/geosee_processed/utah_forge_phase_3/demo_boreholes/
```

## What Is Known

Current Phase 3 MT baseline:

- source family: electrical resistivity / magnetotelluric
- source package: GDR submission 1255 related MT deliverables
- station archive: `FORGE_MT_190812_EDIs.zip`
- model archive: `FORGE_MT_mdl17_cellcenter.zip`
- CRS: EPSG:26912 / NAD83 UTM Zone 12N
- units: meters
- model value: resistivity in Ohm-m
- display value: `log10(resistivity_ohm_m)`
- station classification: measured
- model classification: source-derived inversion model
- crop: none
- vertical exaggeration: 1.0

## What Remains To Document Later

Create or update reference notes here when future datasets are activated:

```text
phase_3_mt/
phase_3_seismic/
southwestern_mt/
southwestern_seismic/
faults/
terrain/
infrastructure/
```

For each future source family, record:

- source/citation/delivery route
- file list and archive contents
- CRS and units evidence
- source bounds
- provenance and permission
- measured/source-derived/preview/placeholder/future classification
- processing script and output path
- known caveats

Do not use this folder for active browser-ready outputs. Those belong under `../data/geosee_processed/`.
