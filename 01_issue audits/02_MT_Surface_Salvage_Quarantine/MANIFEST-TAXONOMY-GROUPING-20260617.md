# Manifest Taxonomy + Grouping Table (2026-06-17)

Phase 2 preflight (B). From `docs/dev-context/editor-control-manifest.json`
(scope/kind) cross-referenced with `src/projectModules/utahForge/layerIds.ts`.
The control scope's **width** is the entity-vs-channel discriminator; the
container hierarchy at the **lower grain** (group/subsection) is the grouping
prior (candidate common-fate sets).

## Entity vs channel (by scope width)

| Manifest scope | Class | Render entity / layer id(s) |
| --- | --- | --- |
| `mt-volume layers` | ENTITY | `utah-forge-mt-resistivity-volume` |
| `mt-threshold-surface layers` | ENTITY | `utah-forge-mt-resistivity-threshold-surfaces`, `utah-forge-mt-top-surface`, `utah-forge-mt-top-contact-surface` |
| `mt-slice layers` | ENTITY | `utah-forge-mt-resistivity-slices` |
| `point-marker layers` | ENTITY | `utah-forge-mt-stations` |
| `utah-forge full-density MT scalar layer` | ENTITY — **EXCLUDED (special kitten)** | `utah-forge-mt-resistivity-full-density` (PointsMaterial; never clip-owned) |
| `utah-forge MT scalar layers` | ENTITY (scalar appearance) | volume + full-density scalar fields (morph channel; full-density protected) |
| `seismic layers` / `seismic products` | ENTITY | `utah-forge-phase3-seismic-browser` (+ per-product) |
| `atmosphere-volume layers` | ENTITY | atmosphere volume |
| `borehole element kit` / `utah-forge borehole-log layer` | ENTITY | `utah-forge-borehole-logs`, `utah-forge-phase3-demo-boreholes` |
| `site-details layers` / `project-data` | ENTITY | site boundary, claims, geology, targets, hydrography |
| `projects-with-public-topo` / `image-backed-topo` / `projects-with-graticule` | ENTITY | topo surface, satellite image, `utah-forge-topo-graticule` |
| `scene-section layers` | **CHANNEL** (clip, cross-cutting) | `utah-forge-scene-section-planes` → targets volume/surfaces/slices/seismic/full-density |
| working-area focus | **CHANNEL** (clip, cross-cutting) | `utah-forge-working-area-focus` → targets configured layers |
| `all-projects` | non-entity (UI / environment / cards / cinematics) | legends, pages, environment scene |

## Grouping prior (lower grain: bar → group → subsection → entity)

- **Sections bar** (`section.sections`, utah-forge):
  - group `sections.scene-section` (scope `scene-section layers`) → the section
    CHANNEL: axis show/flip/controls/ground-trace/scale, object-visibility
    groups + opacity. (Channel, not a fate-set.)
- **MT** (control-families under the data section):
  - `mt.threshold.iso-resistivity-surfaces` (`mt-threshold-surface layers`) →
    threshold/top/contact surface group = one fate-set.
  - `mt.resistivity.log10-window` (`utah-forge MT scalar layers`) → volume scalar.
  - `mt.resistivity.isoline-rendering` (`utah-forge full-density MT scalar layer`)
    → EXCLUDED cloud.
- **Seismic** (`section ... seismic.*`): groups `seismic.products.3d`,
  `seismic.products.2d-sections`, `seismic.products.2d-details`,
  `seismic.display.global`, `seismic.depth.window` → seismic fate-sets per
  product/representation.
- **Topo** (`section.topo`): groups `topo.group.surface` / `.satellite` /
  `.extents` / `.environment` / `.graticule` / `.title` → topo fate-sets;
  `topo.environment.*` subsections are environment-channel, not entity.
- **Atmosphere**: `atmosphere-volume.appearance` / `.bounds`.

## Notes

- **Derived siblings bond is implicit.** Section ISO (bands/lines) is authored as
  fields ON the host layer (`sectionIso*` on volume and seismic), not a separate
  manifest entity. A diff of the host's state already contains the ISO — no
  separate bond table; the hierarchy (ISO controls nested under the host) only
  reinforces it.
- **Channels are cross-cutting.** `scene-section layers` and working-area focus
  scope across many entity groups; they are modifiers composed onto fate-sets,
  not sibling groups.
- **Cloud excluded** everywhere from clip ownership (special kitten).
