# MT 3D Iso — Math Alignment and Co-Creation Record

Status: working note. Captures (a) the reframe that giving MT iso-bands a 3D
form is an *alignment* of representations already in the scene, not a new
feature; (b) the geometric model that makes the alignment exact; and (c) the
co-creation method the model was produced under.

This note keeps provenance visible on purpose — who contributed which claim —
because the method is part of what is being recorded. Tags: `[obs]` observed in
the work, `[inf]` inferred by reasoning, `[ext]` Claude's extension of Jam's
framing, `[spec]` speculative.

## The reframe: alignment, not a new feature

The MT resistivity tools — section iso-bands, horizontal slices, the 3D
iso-resistivity bands, the iso-surfaces, the cell point cloud — each currently
compute their own representation. They are siloed: each re-decides its levels,
windows, and colors. [inf]

The work is to make them all derive from **one source of truth: the section's
desired gradation** — its iso levels, windows, and colour ramp. [obs, Jam] Once
every representation reads the same scalar field and the same level set, they
align by construction. The nested 3D contour lines already render in the scene;
they are aligning but not yet tuned to the shared source. [obs, Jam]

So this is a **math alignment**, not new construction: unify the scalar field and
the level set across representations, and the 3D forms fall out of the same math
that draws the 2D section. Even a crude white horizontal contour is correct if it
reads from the right math. [obs, Jam; inf]

## The geometric model [ext — Claude's formalization, marked]

The section's 2D bands are a **cross-section of nested 3D iso-shells.**

Cartography flattens a 3D landform into nested closed contour lines; the reader
rebuilds the 3D in their head. This runs that backwards: the nested lines on the
section *are* slices of the 3D shells, so the shells are the section's contours
swept around the volume. The section is therefore not only the trailhead — it is
a literal cross-section of the 3D form. [ext]

Consequences:

- **Lines, not filled surfaces.** Nested contour *lines* are both the
  cartographic form and the legible one — a wireframe of nested contours is seen
  through, where solid shells occlude each other. The cartographic ask and the
  occlusion constraint are the same constraint. [ext]
- **Cloud and lines are a pair, not rivals.** The cell cloud is the *evidence*
  (cells voting for a band); the contour lines are the *derived structure* (the
  level set). Together, the cloud shows how much support each contour actually
  has, and the lines give the cloud cartographic legibility. Both segregable per
  band. [ext/inf]
- **The cloud must speak the same math.** Cell points must carry the same scalar
  the lines and the section use; today they carry only a precomputed colour.
  Retaining per-point resistivity at load is part of the alignment — making the
  cloud read the shared field — not a separate feature. [inf]
- **The user segregates.** Bands toggle on/off; the user pulls the cloud apart.
  An instrument, not a fixed picture — "afford others the ability to segregate".
  [obs, Jam]
- **Identity left open.** A band is a perceived 3D region of interest that will
  later be named (likely a rock type). The architecture should let a band carry a
  label later without a retrofit. [obs, Jam]

## The sweep

The sweep — 2D contours growing into their 3D shells — is a **cognitive
handshake**, a guide for newcomers crossing from the familiar 2D isobar to the 3D
form. [obs, Jam] It is a presentation/transition device (it belongs with the
cinematics/transition machinery), transient and triggerable, not a persistent
layer. Its one requirement is correspondence: the viewer must track the same
object from the 2D line they know to the 3D shell. [ext]

## Method note (why provenance is on the page)

The geometric formalization above is Claude's extension of Jam's framing, marked
as such throughout. Jam's are the load-bearing moves: the source-of-truth
principle, the cartographic inversion as the goal, the cloud / segregation /
affordance, the sweep-as-handshake, and the math-alignment reframe. Claude's is
the formalization — section-as-cross-section-of-nested-shells; lines as both
cartographic and occlusion-honest; cloud-and-lines as evidence-and-structure —
offered as a thinking move and kept attributed so it cannot quietly become a
shared assumption without its origin.

That continuous, visible attribution is the working method. It exists so that in
both generative and rigorous modes, the *type and provenance of every substantive
claim* stays legible — which is what lets the work be trusted regardless of which
mode produced it. The method is deliberate, and this document is an instance of
it rather than a description from outside.
