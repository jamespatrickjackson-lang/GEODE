# NAIP 2024 Regional Source Expansion (2026-06-03)

## Scope

Expanded the Utah FORGE NAIP 2024 regional topo material after additional
county MrSID source folders were added under:

`C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\Satellite Maps`

This update follows the NAIP terrain remediation contract: source SIDs remain
authoritative, identity ties are preserved, CRS is validated before mosaic, and
runtime texture references use cache-busted URLs.

## Added Sources

Four new source folders were present and included in the generator catalog:

| County | Source folder | EPSG | Bounds |
| --- | --- | --- | --- |
| Garfield | `NAIP2024_Garfield` | 26912 | `[345498.0, 4150140.0, 598806.0, 4227882.0]` |
| Kane | `NAIP2024_Kane` | 26912 | `[327396.0, 4094688.0, 533376.0, 4159242.0]` |
| Piute | `NAIP2024_Piute` | 26912 | `[363432.0, 4219794.0, 434856.0, 4269588.0]` |
| Wayne | `NAIP2024_Wayne` | 26912 | `[423108.0, 4219482.0, 598806.0, 4268742.0]` |

The existing five counties remain in the catalog: Beaver, Iron, Millard,
Sanpete, and Sevier.

All nine sources use identity ties (`ties: []`). No source rotation or
manual tie transform was introduced.

## Regional Output

The regenerated regional extent is:

`[229069.2, 4094688.0, 598806.0, 4414308.0]`

Generated files:

| Variant | Dimensions | Approx resolution | Cache token |
| --- | ---: | ---: | --- |
| `naip_2024_regional_4096.webp` | `4096 x 3541` | `90.27 m/px` | `71d894cdd3c0c64b` |
| `naip_2024_regional_8192.webp` | `8192 x 7082` | `45.13 m/px` | `684f5a7e42719aa9` |

The manifest now records all nine archive paths, the new AOI bounds, generated
dimensions, hashes, and cache tokens.

## Runtime Updates

Updated the NAIP material bounds and active `orthoPhotoBounds` to the new
nine-county regional extent in:

- `projects/utah-forge/environment.json`
- `projects/utah-forge/pages/139_page.json`
- `projects/utah-forge/pages/152_page.json`
- `projects/utah-forge/pages/153_page.json`
- `projects/utah-forge/pages/154_page.json`

Updated `projects/utah-forge/project.json` diagnostic `naipTiles` metadata to
show all nine county source rectangles, each with a distinct color.

## Commands

Source validation used QGIS GDAL:

```powershell
& "C:\Program Files\QGIS 3.44.10\OSGeo4W.bat" gdalinfo -json <source.sid>
& "C:\Program Files\QGIS 3.44.10\OSGeo4W.bat" gdalsrsinfo -o epsg <source.sid>
```

Regeneration:

```powershell
python tools/generate-naip-regional-overview-assets.py --overwrite
```

Targeted source verification:

```powershell
node tests/tools/naip-terrain-remediation-source.test.mjs
python -m py_compile tools/generate-naip-regional-overview-assets.py
```

## Notes

The earlier five-county alignment audit remains valid for its scope and for the
runtime terrain/LOD conclusion. This note supersedes only the active NAIP
regional source count, source bounds, output dimensions, hashes, and runtime
material bounds.
