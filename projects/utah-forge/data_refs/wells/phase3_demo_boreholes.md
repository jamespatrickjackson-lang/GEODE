# Utah FORGE Phase 3 Demo Boreholes

This note records the source path for the browser-ready demo/orientation
borehole layer `utah-forge-phase3-demo-boreholes`.

## Active Artifact

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/demo_boreholes/phase3_demo_boreholes.json
```

The artifact contains:

- `16A(78)-32` injection trajectory parsed from the public GDR 1283 survey workbook.
- `16B(78)-32` production trajectory parsed from the public GDR 1516 final survey report workbook.
- A `Bore Holes` priority registry sourced from GDR 1358 and the active trajectory sources.
- A schematic white surface facility/orientation block centered on the measured 16A-32 pad corners from GDR 1358.

The borehole trajectories are public-source survey-derived, but the white block
is not a measured building footprint. It is orientation geometry only.

## Display Controls

The editor exposes this artifact under `FORGE Data > Bore Holes`. The two
demo boreholes and the surface facility block have independent presentation
controls for visibility, size, color, opacity, line style, labels, and path
cleanup. `survey` mode shows the parsed public survey points. `smoothed` and
`presentation normalized` modes are visual cleanup modes only; they preserve
the collar/toe endpoints but must not be treated as engineering resurvey.

The `FORGE site boundary` control remains under `Site Details`; boreholes now
have their own container so priority wells can be listed without implying every
record has renderable trajectory geometry.

## Bore Holes Priority Registry

- `58-32`: core characterization and seismic/geologic anchor. GDR 1358 provides well and pad location rows; no active trajectory is rendered.
- `16A (78)-32`: primary injection/source well for stimulation and EM monitoring. GDR 1283 provides the rendered trajectory; GDR 1358 provides well and pad location rows.
- `78B-32`: key observation well for borehole EM/VEMP measurements. GDR 1358 provides well and pad location rows; no active trajectory is rendered.
- `16B`: production well, relevant to injection/production pair context. GDR 1516 provides the rendered trajectory; no matching GDR 1358 CSV row was found.
- `Acord-1`: supporting mapped reference well. No active source row or trajectory has been found.
- `FDST/ FORGE test drill site`: supporting mapped reference site. No active source row or trajectory has been found.
- `Unnamed`: possible seismic monitoring well. GDR 1358 contains `BOR1`, `BOR2`, and `BOR3` seismic feature rows, but no recovered well identifier is present.

## Public Sources

- Utah FORGE Data Dashboard: <https://utahforge.com/project-data-dashboard/>
- GDR 1283, `16A(78)-32 Survey.xlsx`: <https://gdr.openei.org/submissions/1283>
- GDR 1516, `16B(78)-32 Well Survey.zip`: <https://gdr.openei.org/submissions/1516>
- GDR 1358, updated well and seismic locations CSV: <https://gdr.openei.org/submissions/1358>

## Regeneration

```bash
npm run generate:utah:boreholes
```

The generator downloads only the small public survey/location files into local
staging under `.tmp/utah-forge-boreholes/`, parses them, converts survey feet
to meters, shifts coordinates into the existing Utah FORGE scene-local frame,
and rewrites the active artifact.

## Caveat

Classification is `demo-orientation`; `notForEngineeringUse` is `true`.
Do not use this layer for drilling, survey, engineering, or as-built building
geometry decisions.
