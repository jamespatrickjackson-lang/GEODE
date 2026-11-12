# GEODE publication manifest

Review date: 12 November 2026. Candidate source: `76e6bf47d2be144049f61ed390879996022cb19c` on GeoSee `main`.

## Publication decision

**Historical-content gate resolved with explicit owner approval.** Only the two browser-debug directories listed below were removed from an isolated publication-history copy. All 395 historical commits were retained; every corresponding tree was checked and differs only by the approved exclusions. The original repository and recovery bundle remain unchanged. Rights clearance is complete by the repository owner's explicit statement, “All rights are cleared,” on 12 November 2026. That clearance does not substitute for credential/private-content screening and does not select a software reuse licence.

## Included, excluded and review items

| Status | Content | Reason |
| --- | --- | --- |
| Include in intended candidate | `src/`, root application/configuration files, `package.json`, lockfile, `plugins/` | Executable GeoSee scientific visualization and authoring application |
| Include | `projects/woodjam/`, `projects/case-study-b/`, `projects/utah-forge/`, `projects/base-gui/`, tracked `data/` | Cleared demonstrations, prepared runtime data, project/page/environment state, branding and provenance |
| Include | `prep/`, `tools/`, `tests/`, `.githooks/`, `.github/workflows/checks.yml` | Reproducibility, offline preparation, source/runtime tests and release guards |
| Include | Existing architecture, decisions, risk and provenance documentation; `AGENTS.md` and `CLAUDE.md` | Engineering evidence and maintained development instructions |
| Include with historical label | `01_issue audits/` (311 tracked files, approximately 126.6 MiB) | Existing technical diagnostics, captured application views and development evidence; not current acceptance results |
| Include, explicitly reviewed as tracked exceptions | Six Markdown audit/archive files matched by current ignore rules | Existing Git-tracked engineering records; ignore patterns do not remove tracked files |
| Include as legacy generated exception | `prep/__pycache__/fetch_utah_forge_public_context.cpython-314.pyc` | Historical Python bytecode is still tracked. It is not a dependency or scientific source; no new generated artifacts are staged |
| Exclude | Original 14 modified tracked files and three untracked files | Unfinished developer work; preserved and not copied into the committed candidate |
| Exclude | Ignored dependencies/build outputs, temporary files, logs, recordings and private local configuration | Not part of the intended Git tree |
| Exclude | `med/field-probe-array`, other local branches, tags, stash and Codex checkpoint refs | Initial publication is `main` only; no `push --all`, no tag publication, no medical merge |
| Exclude | Offshore Vancouver Island and DMT_02 workspaces | Outside mission; untouched |
| Excluded from publication history | Two historical `.chrome-debug-*` directories containing Chrome crash dumps and auxiliary diagnostic artifacts | Explicitly approved exclusion of unnecessary process-memory artifacts; paths and dump blobs are no longer reachable in the publication copy |

## History review scope and result

The candidate baseline has 1,655 tracked files totaling 540,921,696 bytes (515.9 MiB) and 395 reachable commits. Review enumerated 8,586 reachable Git objects and scanned 5,280 blob/commit objects totaling 1,954,743,505 uncompressed bytes for credential patterns. The largest reachable blob was 32,299,094 bytes, below GitHub's single-file 100 MiB hard limit. This was a pattern-based review, not a proof that every form of confidential information is absent.

One credential-URL pattern match occurred across nonprintable binary bytes in a historical dump. A follow-up scan of printable ASCII and UTF-16 strings found no matching credential URL, high-confidence token/key, or credential keyword in either dump. **No live credential was confirmed.** Both files are genuine Windows minidumps with thread and memory streams; their private-memory content is not cleared by a text-pattern scan.

The exact historical directories are:

- `.chrome-debug-2ac3d386860f4c179becdcd31c2bf784/`
- `.chrome-debug-35f28de655654a7b851d6845946145f4/`

The exact dump objects are:

| Path within directory | Blob |
| --- | --- |
| First directory: `Crashpad/reports/fe23ea5a-44f1-4da6-939b-3f32c66a5518.dmp` | `a9948e4c4222f33b0c639afa05730e2edbcf3a44` |
| Second directory: `Crashpad/reports/7c5f7956-3cc1-466d-bd7d-5ee06a3d06c8.dmp` | `880c7a59a80cbe660c21dd0a7dbfdf56433d6e90` |

The first dump appears in the initial baseline commit `90cc6631bc9b48b2dc41e395e3dca8b30ba9ea21` and is removed by `231d35928264826c677d6a80ef8c5419a0ac2bb2`. Removal from the current tree does not remove it from a normal history-preserving push.

Executed resolution: git-filter-repo 2.47.0 excluded exactly the two listed directory prefixes in a separate clone, with empty and degenerate commits retained. All 395 old/new commit trees were compared. Twelve historical file paths were excluded; no other tree entries changed. Both dump blobs are absent from reachable objects, and `git fsck --full` passed. The application tip tree remains `16d2301112ed3931f4143a0b4c66c944d902a2f5`; the sanitized baseline is `f406bc5102f24641dcfb5401bfcd7a7f1ed333e7`. See the [machine-readable proof](GEODE-history-exclusion-proof.json). Original commit IDs remain available in the private recovery bundle and the old/new commit map stored with the release records. Publication uses only `main`, without a force push.

## Attribution and interpretation

Retain all existing per-project source citations, metadata and derived-product provenance. The owner's rights clearance covers the intended release; the following links help identify source material and do not replace source-specific terms.

| Demonstration | Source records |
| --- | --- |
| Woodjam | [Dataset manifest](woodjam/data-manifest.md), [ARIS disclaimer](woodjam/ARIS%20Digital%20Data%20Disclaimer.txt), tracked source figures and prepared geospatial data |
| Shahbazi | Shahbazi, Menard, Sohn and Theau (2019), *Unmanned aerial image dataset: Ready for 3D reconstruction*, DOI [10.1016/j.dib.2019.103962](https://doi.org/10.1016/j.dib.2019.103962); [source reference](../projects/case-study-b/data_refs/shahbazi_gravel_pit/README.md) |
| Utah FORGE MT | Wannamaker and Maris, [GDR 1255](https://gdr.openei.org/submissions/1255), DOI [10.15121/1776598](https://doi.org/10.15121/1776598); [prepared data](../projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/README.md) |
| Utah FORGE seismic | [GDR 1141](https://gdr.openei.org/submissions/1141), DOI [10.15121/1542059](https://doi.org/10.15121/1542059), and [GDR 1015](https://gdr.openei.org/submissions/1015); [seismic preparation records](../projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/README.md) |
| Other terrain, imagery and context | Project manifests, [dataset map](dev-context/Dataset-Map.md) and [archive manifest](archive-manifest.json) |

The developer reports literature comparison and professional geophysics review of Utah FORGE. The exact paper, comparison material and review record remain unresolved; Wannamaker et al. (2020), Figure 16, is a candidate. Do not equate visual agreement with engineering qualification, verified registration or endorsement.

## Licence

No application software licence has been selected or added. Public readability does not grant a general software reuse licence. Third-party data and dependency terms remain distinct.
