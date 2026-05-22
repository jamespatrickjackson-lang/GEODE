# GeoSee Archive Map

Last updated: 2026-05-21

This file is the in-repo reference for source/raw buckets that were moved out of
Git history and out of the active working tree. The active repo is
`C:\GeoSee\GeoSee_Dev`; the source archive is `C:\GeoSee\GeoSee_Archive`.

Use this map when older provenance, prep scripts, project JSON, or generated
metadata mention repo-relative source paths that are no longer present in the
active repo.

## Rule

Archived paths preserve their former repo-relative structure. To recover a
source bucket, append the old repo path to the archive root:

```text
C:\GeoSee\GeoSee_Dev\<repo-relative-path>
  -> C:\GeoSee\GeoSee_Archive\<repo-relative-path>
```

Do not recommit large source/client files to the active repo. If regeneration is
needed, copy or reference the required archive sub-tree temporarily, regenerate
the browser-ready outputs, and keep only the processed/runtime artifacts in
Git.

## Archived Source Buckets

| Former repo path | Archive path | Use |
| --- | --- | --- |
| `data/source/trees_vri` | `C:\GeoSee\GeoSee_Archive\data\source\trees_vri` | Woodjam VRI forest polygon prep input |
| `data/source/Geophysical_Data` | `C:\GeoSee\GeoSee_Archive\data\source\Geophysical_Data` | Woodjam ARIS geophysical survey deliveries |
| `data/source/Images` | `C:\GeoSee\GeoSee_Archive\data\source\Images` | Stock/source image material |
| `docs/woodjam/Appendix C - ZTEM Survey Data` | `C:\GeoSee\GeoSee_Archive\docs\woodjam\Appendix C - ZTEM Survey Data` | Woodjam ZTEM source appendix |
| `docs/woodjam/Appendix E - IP Survey Data` | `C:\GeoSee\GeoSee_Archive\docs\woodjam\Appendix E - IP Survey Data` | Woodjam IP source appendix |
| `docs/woodjam/Appendix F - DHDB` | `C:\GeoSee\GeoSee_Archive\docs\woodjam\Appendix F - DHDB` | Woodjam drillhole database appendix |
| `docs/woodjam/Appendix G - Drillhole Assay Certificates` | `C:\GeoSee\GeoSee_Archive\docs\woodjam\Appendix G - Drillhole Assay Certificates` | Woodjam assay certificates |
| `docs/woodjam/Appendix J - Rock Sample Assay Certificates` | `C:\GeoSee\GeoSee_Archive\docs\woodjam\Appendix J - Rock Sample Assay Certificates` | Woodjam rock sample assay certificates |
| `projects/case-study-b/data/raw` | `C:\GeoSee\GeoSee_Archive\projects\case-study-b\data\raw` | Shahbazi UAV/TLS/photogrammetry raw source |
| `projects/utah-forge/data/client_preprocessed/forge_southwestern` | `C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\forge_southwestern` | Utah FORGE southwestern source delivery |
| `projects/utah-forge/data/client_preprocessed/Unsorted data` | `C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\Unsorted data` | Utah FORGE unsorted source delivery |
| `projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/seismic_analysis/source` | `C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\utah_forge_phase_3\seismic_analysis\source` | Utah FORGE Phase 3 seismic source inputs |
| `projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity` | `C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\utah_forge_phase_3\electrical_resistivity` | Utah FORGE Phase 3 MT EDI/model source inputs |
| `prep/raw/bc_digital_geology` | `C:\GeoSee\GeoSee_Archive\prep\raw\bc_digital_geology` | BC digital geology prep input |

The same data is also listed in `docs/archive-manifest.json` for agents and
scripts that need a structured lookup.

## Git History Rewrite Note

The raw/source buckets above are intended to be purged from reachable Git
history. That history rewrite changes commit hashes but preserves the current
app/runtime files. After the rewrite, this file and `docs/archive-manifest.json`
are the recovery pointers for source files that used to be in Git.

Rewrite record:

- Pre-rewrite HEAD: `be8de7eb8b77e2c2f3bfe8afb701d364b922cc78`
- Rewritten HEAD before this record: `634c02d29e684c760a8dbb7b8fc17c4c40abd149`
- Pre-rewrite Git object size: `17.06 GiB`
- Post-rewrite Git pack size after garbage collection: `197.37 MiB`
- Temporary recovery bundle: `C:\GeoSee\GeoSee_Dev_Past\GeoSee_Dev-pre-archive-history-rewrite.bundle`
- Bundle policy: delete after verification passes; keep only if verification fails.

## Prep Script Guidance

Some prep scripts still name the former repo-relative source path because
existing provenance and generated metadata use those strings. Treat those paths
as historical source identifiers, not as proof that the source bytes belong in
the active repo.

For a one-off regeneration:

1. Locate the required source bucket in `C:\GeoSee\GeoSee_Archive`.
2. Either point the prep script at that archive path or temporarily copy the
   source bucket back to its former repo-relative location.
3. Regenerate the processed/runtime artifacts.
4. Remove any temporary source copy from the active repo before committing.
