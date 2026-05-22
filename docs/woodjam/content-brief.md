# Woodjam Demo — Content Brief

The Woodjam presentation is GeoSee's first demo and the artifact taken to
market-feedback meetings. This brief defines what story it tells, what
chapters it has, and what content goes on each page.

This brief is the source of truth for narrative. Page authoring (camera
poses, layer visibility, exact wording) happens in the GeoSee tool, but
the structure here should not be improvised mid-build.

## Audience

Single audience for the alpha: **investors and corporate development
contacts at junior and mid-tier mining companies**. Specifically, people
who already understand drilling, geophysics, and exploration economics.
Not retail investors. Not regulators. Not communities.

This shapes everything: vocabulary stays technical, NI 43-101 disclaimer
is present but not over-explained, the story emphasizes evidence and
forward-looking targets rather than safety culture or social licence.

## Project context

Woodjam is a copper-gold porphyry district in central BC, owned by
Vizsla Copper Corp. The property contains multiple historic
mineralized zones (Southeast, Deerhorn) and several earlier-stage
targets (Megabuck, Takom, Megaton). The 2023 drill campaign added 19
holes (~7,500 m) across the district. The 2024 work added ZTEM
airborne EM and ground IP/DCIP geophysics over a 40 km² grid, plus a
focused seven-hole drill program that included the first holes at
Three Firs. Late-2024 public disclosures describe new concealed
targets — Great Plains (Oct 2024 release) and Three Firs (Nov 2024
release).

The story for investors is roughly:

> "This is a known copper-gold district with established resources at
> Southeast and Deerhorn. The 2023 drilling and 2024 geophysics
> together reveal that the district is larger than the historical
> pictures suggested. Specifically, there are concealed porphyry
> centers — Great Plains, Three Firs — that the geophysics has now
> imaged but drilling has barely tested. The 2024 work *near* Three
> Firs intersected mineralized breccia clasts that point toward a
> concealed porphyry source — vectoring evidence, not a hit on the
> target itself. The forward case is to drill the source of those
> clasts."

The presentation needs to make that arc viscerally clear.

## Chapter structure (5 chapters, ~5–8 minutes total)

### Chapter 1 — District orientation

**Goal:** Establish where this is, what scale it is, and what the
existing mineralized footprint looks like.

**Camera arc:** Start from a regional fly-in (continental → BC →
Cariboo Plateau → property). Settle on an oblique 3D view of the full
property with terrain visible. Show the cluster of all 19 drill collars
as small markers, no traces yet.

**Layers visible:** terrain, claim/property footprint (if available;
otherwise a bounding box), all 19 drillhole collars (collar-only render
mode), regional reference imagery if helpful.

**Overlay copy (~80 words):**
> Woodjam is a copper-gold porphyry district on the Cariboo Plateau in
> central British Columbia. The property covers approximately 90,000
> hectares and hosts multiple historically mineralized zones. Vizsla
> Copper has been advancing the district since 2022. The 2023 drill
> campaign placed 19 holes across the historically known zones; the
> 2024 program added focused drilling at Three Firs plus
> property-wide geophysics. This presentation shows what those holes
> — and the geophysics that followed — reveal about the district's
> scale.

**Annotations:** none. Keep this opening clean.

**Holds:** ~5 seconds at final pose for video export.

---

### Chapter 2 — The known cluster

**Goal:** Show the existing mineralized zones — Southeast and Deerhorn
as the historical resources, and the broader cluster of named targets
that anchor the district.

**Camera arc:** Pull in from the regional view to a closer perspective
showing the Southeast and Deerhorn zones with drillholes traces visible.
Camera should sit slightly elevated and oblique — investor-deck angle.

**Layers visible:** terrain, drillhole collars + traces (full minimum
curvature paths from `drills.geojson`), TMI magnetics overlay (as draped
texture if exported as PNG, otherwise as 2D inset image in the overlay
panel).

**Per-zone breakdown in overlay (verified against `Diamond
Drilling_Headers.csv`):**
- **Southeast (SE):** 5 holes — SE23-100, 101, 102, 108, 110
- **Deerhorn (DH):** 5 holes — DH23-104, 107, 109, 112, 114
- **Megabuck (ME):** 2 holes — ME23-115, 117
- **Takom (TK):** 2 holes — TK23-111, 113
- **Megaton (MT):** 2 holes — MT23-116, 118
- **Central / unnamed (WJ):** 3 holes — WJ23-103, 105, 106 (one collar
  location, drilled in three orientations; not at Three Firs or any
  other named zone — confirmed against Vizsla's public disclosure)

**Overlay copy (~100 words):**
> The 2023 program placed 19 holes across the district. Southeast and
> Deerhorn host the historically defined mineralization; five holes in
> each extend and infill those zones. Megabuck, Takom, and Megaton are
> earlier-stage but geologically connected — three smaller programs of
> two holes each. Three additional holes (WJ23-103, 105, 106) tested a
> central area between the named clusters. The campaign treated the
> property as one continuous porphyry trend, not isolated prospects.
> This map view makes the spatial relationship plain: a connected
> mineralized district, not a handful of unrelated showings.

**Annotations:** zone labels on each cluster (Southeast, Deerhorn,
Megabuck, Takom, Megaton, Central). Keep them small.

---

### Chapter 3 — Reading the geophysics

**Goal:** Introduce the 2024 ZTEM and IP/DCIP work and what it reveals
beyond what drilling alone showed. This is the chapter where the
"district is larger than it looks" claim gets its evidence.

**Camera arc:** Tilt to a more vertical (plan-view leaning) angle to
show the geophysical footprint properly. May rotate slowly during the
overlay to let the eye track anomalies.

**Layers visible:** terrain (dimmed), drillhole collars (small, dimmed),
TMI magnetics as full-property draped overlay, IP chargeability anomaly
outlines (digitized from the Vizsla 40K profile PDFs — manual
digitizing required, see data manifest).

**Overlay copy (~120 words):**
> In 2024, Vizsla flew a ZTEM airborne electromagnetic survey across
> the property and acquired ground IP/DCIP on a denser grid. ZTEM
> images conductive structures at depth. IP measures chargeability,
> which tracks disseminated sulphides — the textural signature of
> porphyry mineralization. The 2024 dataset shows that chargeable,
> conductive responses extend well beyond the drilled footprint. The
> known zones light up — but so do areas that have seen little or no
> drilling. The pattern is consistent with a district-scale system,
> not a handful of isolated centers. The next chapter shows the two
> most prospective concealed targets, and the evidence Vizsla used to
> vector toward one of them in 2024.

**Annotations:** "TMI" label on the magnetics layer; "Chargeability
high" labels on the principal anomaly highs.

---

### Chapter 4 — Vectoring the concealed targets

**Goal:** Show the Great Plains and Three Firs targets as the named
forward bets, and walk through Vizsla's 2024 vectoring evidence at
Three Firs. These are the punch line of the story.

**Narrative approach (decision DEC-016):** No 2023 drillhole sits at
Three Firs. The chapter relies on three pieces of evidence:
(1) the IP chargeability anomaly outlines under the Three Firs target,
(2) the three 2024 TF24 collar markers showing where Vizsla drilled
~500 m northwest of the target, and (3) the public interpretation that
mineralized breccia clasts in those 2024 holes vector toward a
concealed porphyry source under Three Firs itself. The chapter does
not claim Three Firs has been drilled; it tells the vectoring story
that Vizsla itself told investors in November 2024.

**Camera arc:** Two camera moves in sequence — first a tighter view
centered on Great Plains (broad anomaly, no drilling), then a
transition to Three Firs (tighter signature, three 2024 collars
visible NW of the target outline).

**Layers visible:** terrain (dim), TMI overlay (dim), IP
chargeability (emphasized), 2023 drillhole collars (very dim
background context), 2024 TF24 collar markers (highlighted, distinct
color/shape from 2023), target-area outlines (digitized from public
Vizsla figures — Great Plains and Three Firs).

**Overlay copy (~170 words):**
> Two concealed targets stand out from the geophysics. **Great Plains**
> is a broad, approximately 2 km × 2 km chargeability and ZTEM anomaly
> south of the Southeast resource. The geological reading — concealed
> porphyry under shallow glacial cover — is consistent with the data.
> Drilling has not tested it. **Three Firs** is a tighter geophysical
> signature in the northwest of the property. In 2024, Vizsla drilled
> three holes (TF24-123, TF24-124, TF24-126) approximately 500 metres
> northwest of the target proper. These holes did not test Three Firs
> directly — they tested the structural step-out toward it.
>
> What they intersected was significant: a polymictic breccia
> containing intrusive clasts with porphyry-related
> quartz-chalcopyrite±bornite stockwork. The clasts are the diagnostic
> piece. They suggest proximity to a mineralized porphyry system that
> has not yet been drilled, and the geophysics models the breccia
> system plunging southeast toward the Three Firs target. The forward
> case for the district is not infill at known resources. It is
> drilling the source of these vectoring clasts.

**Annotations:**
- "Great Plains: ~2 × 2 km broad chargeability anomaly. Concealed under glacial till. Untested by drilling."
- "Three Firs target outline (concealed)."
- "TF24-123 / 124 / 126: 2024 vectoring holes. Intersected mineralized breccia clasts ~500 m NW of target. Source untested."

---

### Chapter 5 — Evidence and caveats

**Goal:** Provenance chapter. Investors with discipline want to see
what's measured, what's interpreted, and what's still narrative. This
chapter exists for that audience and to satisfy the NI 43-101-aware
mindset.

**Camera arc:** Pull back to a wider view of the property. Slow,
contemplative pace. No dramatic moves.

**Layers visible:** all layers visible at low opacity, with classification
labels overlaid (each layer tagged as Observation / Interpretation /
Narrative / Planned per the sources.json schema).

**Overlay copy (~130 words):**
> Everything in this presentation is one of four things. **Observations**
> are direct measurements — the 19 drillhole collars and traces, the
> three 2024 TF24 collars, the raw geophysical responses, the
> topography. **Interpretations** are readings of those measurements —
> anomaly outlines, target areas, "this is probably a concealed
> porphyry," "the breccia clasts vector toward Three Firs."
> **Narrative** is content created for this presentation — labels,
> simplifications, story phrasing. **Planned** is forward-looking —
> proposed drill targets and untested geophysical signatures. The
> provenance document that ships with this build (sources.pdf) lists
> each layer with its classification, source, and date. Investors
> doing diligence should read the full original source materials before
> making any investment decision.

**Annotations:** small classification badges on each layer (O / I / N / P).

**Persistent watermark:** "Not for engineering use" remains visible
throughout, as on every chapter.

---

## Closing frame (post-chapter 5)

For the video export, after Chapter 5 holds, fade to a closing card:
- "Woodjam Project — Vizsla Copper Corp."
- "Sources: ARIS 41597Z, Vizsla public disclosures (Oct 2024, Nov 2024), GeoSee analysis"
- "Not for engineering use. See sources.pdf for full provenance."
- GeoSee + Vizsla logos at small scale

Closing card holds 4 seconds, then end.

---

## Resolved content questions

Moved out of "Open" because they were verified or decided in earlier
sessions. Listed here so future readers don't re-litigate.

1. **Three Firs hole identification** — RESOLVED 2026-04-29. No 2023
   drillhole sits at Three Firs. The three WJ23 holes (103, 105, 106)
   are at an unnamed central location between Southeast and Megaton,
   verified against `Diamond Drilling_Headers.csv` and Vizsla's
   November 27, 2024 press release. Three Firs drilling occurred in
   2024 with the TF24- prefix (TF24-123, TF24-124, TF24-126), all
   collared approximately 500 m NW of the target. Chapter 4 narrative
   reframed to vectoring approach (decision DEC-016) using existing 2023
   data + the three 2024 TF24 collar markers + the public Vizsla
   interpretation.

## Open content questions

These should be resolved during week 6 (demo content build) unless
flagged otherwise:

1. **Claim boundary** — do we have a polygon, or do we approximate from
   the drill cluster bounding box? Without a polygon, Chapter 1 needs
   a different visual treatment. BC MTO export is the recommended
   first attempt.
2. **TMI as draped overlay** — is exporting the Geosoft .map to a
   georeferenced PNG worth doing for one demo, or do we use the PDF as
   a 2D inset image in the overlay panel? Decision affects Chapter 2
   and 3 visuals.
3. **Anomaly outlines** — to show IP chargeability anomalies and the
   Three Firs target outline as 3D overlays in the scene, someone has
   to digitize them from the Vizsla 40K profile PDFs. About a half-day
   of QGIS work. Worth it for the alpha or skip to PDF panels?
   Particularly load-bearing for chapter 4 under the vectoring
   narrative — without a target outline polygon, the chapter relies
   entirely on inset imagery and 3D-pinned text.
4. **Forward-look numbers** — the operating plan / Vizsla disclosures
   should give a rough budget figure for "what would it cost to drill
   the source of the Three Firs vectoring clasts." If a clean public
   figure exists, Chapter 4 closing line could anchor on it. If not,
   leave it qualitative.

## Tone notes

- Confident but not promotional. Investors smell hype; Cardinal-Vizsla
  comparison is on the table mentally for them already.
- "Concealed," "vectored," and "vectoring" are good words; they signal
  exploration literacy without being jargon.
- Avoid the words "world-class," "tier-one," "company-maker," and
  "elephant." All triggered.
- Numbers: if quoting drill metres, hole counts, intervals, or budgets
  — quote exactly from public sources, never round for emphasis.
- The visual quality of the scene carries more weight than the words.
  Spend overlay time on framing, not narration.
- For chapter 4 specifically: the vectoring narrative is *Vizsla's
  story*, not GeoSee's invention. Quote the Nov 2024 release language
  where it lands ("intersected polymictic breccia containing intrusive
  clasts with porphyry-related quartz-chalcopyrite±bornite stockwork")
  rather than paraphrasing in our own voice. Adds credibility.

## Length budget

Target total runtime for video export: **6–8 minutes**. Each chapter
caps at ~90 seconds of camera + hold time. The MP4 should be tight
enough that an investor watches it through; the live walkthrough can
linger longer where the conversation goes.
