# Geovox — Dataset Research Handoff for James Golby
*Prepared by: AI assistant on behalf of the Geovox team*
*Date: May 11, 2026*

---

## COMPANY CONTEXT

**Company name:** Geovox (formerly GeoSee Services)

**What Geovox does:** A subsurface data visualisation and communication company. The core service is taking complex, multifaceted geophysical and geological datasets and turning them into professional, interactive 3D visual presentations for investors, boards, regulators, and technical teams.

**Business model:** Service-first. Take client data exports (point clouds, grids from Leapfrog/Surfer) and create professional 3D presentations — not selling software seats. Pricing is lower than competitors like VRFI and Leapfrog ($15,000–$25,000 USD/seat/year).

**Primary market:** Junior mining exploration companies and geophysics consultancies. Key near-term target: DMT (a geophysics consultancy) and Sitka Gold (junior mining, investor communications).

**Key differentiator:** Data integration — combining multiple geophysical data types into a single navigable 3D scene. Not just visualisation, but communication.

**Positioning note:** Avoid making analytical or inference claims. Position as a "light inference tool" at most due to team size and regulatory risk.

---

## IMMEDIATE TASK FOR JAMES

James's team has been asked to evaluate and potentially ingest **publicly available datasets from Utah FORGE** for use as Geovox demonstration material — specifically for an upcoming pitch to **DMT**, a geophysics consultancy that does environmental, hydrogeological, and mining work.

The goal is to build a single integrated Utah FORGE demo scene that shows Geovox handling multiple geophysical data types from one site — which is a uniquely strong demo narrative because Utah FORGE is one of the only public sites with this breadth of open-licence data.

---

## THE UTAH FORGE OPPORTUNITY

### Why Utah FORGE?

Utah FORGE (Frontier Observatory for Research in Geothermal Energy) is a US Department of Energy-funded research site near Roosevelt Hot Springs in central Utah. It is focused on Enhanced Geothermal Systems (EGS) — engineering a geothermal reservoir in hot dry rock.

It is one of the most data-rich publicly available subsurface sites in the world. Crucially, multiple geophysical data types from the same site are all publicly available under **Creative Commons Attribution 4.0 (CC BY 4.0)** licence — meaning Geovox can use them freely for commercial demonstration purposes with attribution.

### The Integrated Demo Vision

The proposed Utah FORGE demo scene would combine three fundamentally different geophysical data types from a single site:

| Layer | Data Type | Status |
|---|---|---|
| 1 | Microseismic event catalogue | Already in Geovox pipeline |
| 2 | 3D seismic reflection volume | Identified — see below |
| 3 | 3D MT resistivity model | Identified — see below |

Three data types, one coherent subsurface story. No competitor is currently showing this level of integration in a demo context.

---

## DATASET 1 — 3D Seismic Reflection Data

### What it is
Seismic reflection surveys send acoustic energy into the ground and record how it bounces back from subsurface rock boundaries. A **3D survey** does this across a full grid of lines and receiver spreads, producing a complete volumetric image of the subsurface — inlines, crosslines, and time slices all navigable in 3D. This is far more powerful for demonstration than a 2D survey (which produces only a single cross-section).

### Why 3D over 2D for Geovox demos
A 3D seismic volume can be flown through, sliced in any direction, and rendered as an immersive subsurface scene. It sits naturally alongside drill holes, resource shells, and geophysical models. Clients familiar with Leapfrog already expect 3D environments — a 2D line doesn't demonstrate Geovox's capability meaningfully.

### The dataset
**Utah FORGE: 2D and 3D Seismic Data**
- Link: https://gdr.openei.org/submissions/1015
- Reprocessed (Phase 2C — cleaner, recommended starting point): https://gdr.openei.org/submissions/1141
- Licence: CC BY 4.0
- Contains: 1,122 SEG-Y shot gather files (correlated and uncorrelated), complete 2D seismic lines, processed stack and depth data, velocity and navigation files
- Note: 3D data is split across multiple ~9 GB zip archives — download the Excel file list first (2D-and-3D-Files-List.xls) before tackling full volumes
- Attribution required: John Miller / Energy and Geoscience Institute at the University of Utah / DOE Utah FORGE Project

---

## DATASET 2 — Magnetotelluric (MT) Resistivity Data

### What it is
Magnetotelluric (MT) surveying is a passive geophysical method that measures natural variations in the Earth's electromagnetic field to image the electrical resistivity structure of the subsurface. It operates on the same principle as ERT (Electrical Resistivity Tomography) but penetrates far deeper — often imaging kilometres into the crust — making it ideal for geothermal, structural, and mineral exploration applications.

Different rock types, fluids, alteration zones, and fault structures all have distinct resistivity signatures. In a mining/exploration context, MT is particularly valuable for imaging hydrothermal alteration zones, fault and fracture systems, and deep conductive bodies that may indicate mineralisation — directly relevant to a Sitka-style porphyry copper-gold target.

### Why this is the DMT crossover
DMT primarily does environmental and hydrogeological work. MT resistivity sits exactly at the intersection of that work and hard rock mining/exploration — the same method, the same data structure, applicable to both audiences. This makes it ideal for a DMT demo: it speaks to their existing work while demonstrating applicability to the mining sector they want to grow into.

### The datasets

**Utah FORGE Phase 3 MT Data (122 sites)**
- Link: https://gdr.openei.org/submissions/1255
- Contains: High-quality tensor MT data at 122 sites in industry-standard EDI format, plus a 3D resistivity inversion model in ASCII format (x-y-z-resistivity in UTM coordinates)
- Used to delineate fault/fracture densities in crystalline basement and define heat sources

**Utah FORGE Southwestern Utah MT Data (600 sites — comprehensive)**
- Link: https://data.openei.org/submissions/7659
- Contains: 600 MT sites integrating Utah FORGE, SubTER, and Play Fairway surveys; full 3D finite element inversion model; graphic slices, node graphics, resistivity graphics, and acquisition/inversion reports
- The most complete resistivity picture of the region publicly available

- Licence: Publicly accessible — same Utah FORGE / DOE umbrella
- Attribution required: Phil Wannamaker and Virginia Maris / Energy and Geoscience Institute at the University of Utah / DOE Utah FORGE Project

### Reference figure
The Wannamaker et al. paper (referenced in the dataset metadata) contains Figure 16 — a cross-section through the 3D MT inversion model showing log resistivity from surface to -25 km depth. Low resistivity lineaments (greenish zones) represent altered fracture zones and fault trends. This is exactly the kind of output Geovox would render interactively. The contrast between a static figure on a page and a navigable 3D scene is a core part of the DMT pitch.

A second highly relevant figure (Figure 6 from the same paper series) shows east-west density cross-sections from a 3D gravity inversion rendered as a volumetric block with draped topographic surface and perpendicular slice planes — essentially illustrating the target Geovox output format. This is a useful reference for what the demo scene should look like.

---

## BROADER DATASET CONTEXT

### Other public ERT/resistivity datasets (if MT proves too complex to start)
These are simpler ERT datasets that could serve as stepping stones:

- **Jim Woodruff Lock and Dam, Florida (USGS)** — 11 ERT profiles with raw data, processed data, and inverted models: https://www.sciencebase.gov/catalog/item/5e101068e4b0b207aa163765
- **East River Watershed, Colorado (DOE/Lawrence Berkeley)** — Time-lapse ERT, 128 electrodes, well-documented CSV format: https://www.osti.gov/biblio/1969563
- **APEX Permafrost Site, Alaska (USGS)** — ERT with inverted models, public domain: https://catalog.data.gov/dataset/apex-electrical-resistivity-tomography-ert-data-and-models-from-2018

### Other public 3D seismic datasets (alternatives to Utah FORGE if needed)
- **F3 Block, offshore Netherlands** — Industry-standard open 3D dataset, ~2,900 km², 7 wells, CC licence via dGB Open Seismic Repository: https://wiki.seg.org/wiki/Open_data
- **Penobscot 3D, offshore Nova Scotia** — Canadian context, available via dGB Open Seismic Repository (101 GB pre-stack)
- **Soda Lake, Nevada (GDR)** — 3D/3C petroleum-quality survey, ~36 square miles, SEG-Y format: https://gdr.openei.org/submissions/1655

---

## LICENSING SUMMARY

All Utah FORGE datasets are published under **Creative Commons Attribution 4.0 (CC BY 4.0)**. This means Geovox can:
- Use them freely for commercial purposes including client demonstrations
- Share and display them publicly
- Adapt or build on them

The one requirement is appropriate attribution (credited in demo materials or accompanying documentation).

---

## KEY PITCH NARRATIVE FOR DMT

The core story for the DMT meeting is:

> "We can take your seismic deliverables and your resistivity results and put them in the same scene."

That single sentence addresses DMT's core frustration — they produce multiple geophysical datasets per project but currently have no way to present them in an integrated, client-facing 3D environment. Their current workflow relies on screen grabs from Surfer, which lack polish for international proposals.

The Utah FORGE demo makes this concrete: three different data types, one site, one navigable scene. The Wannamaker et al. figure is useful to show in the meeting as a "this is what a static academic figure looks like — here's what Geovox makes it into."

---

## ACTION ITEMS FOR JAMES

1. Download the Excel file list from the seismic dataset first: https://gdr.openei.org/submissions/1015
2. Start with the **reprocessed seismic data** (Phase 2C): https://gdr.openei.org/submissions/1141 — cleaner than the raw version
3. For MT resistivity, start with the **Phase 3 dataset (122 sites)**: https://gdr.openei.org/submissions/1255 — smaller and better documented than the 600-site version
4. Reference the Wannamaker et al. paper figures when scoping the MT visualisation output
5. Target demo scene: microseismic events + 3D seismic volume + 3D resistivity model, all co-rendered at the Utah FORGE site

---

## REFERENCE SEARCHES FOR FIGURES

If James needs visual reference material, the following Google Image searches are recommended:

- `Utah FORGE magnetotelluric resistivity model Roosevelt Hot Springs` (direct site figures)
- `magnetotelluric resistivity section EDI inversion model` (general MT output examples)
- `3D seismic inline crossline timeslice visualization` (seismic volume rendering examples)
- `MT resistivity porphyry copper exploration` (mining crossover context)
- `3D resistivity model fault fracture zone geophysics` (structural interpretation examples)

The Wannamaker et al. paper is the primary academic source and contains directly relevant figures from the exact dataset James will be working with.

---

*End of handoff document. Questions should be directed back through the Geovox team.*
