# GUI Workbench
## GOC First Context Brief

**Document status:** v0.1 working draft  
**Purpose:** Define how GOC acts as the first proving ground for the GUI Workbench without making the workbench GOC-specific.

---

# 1. Purpose

GOC is the first real product context for the GUI Workbench.

This document captures how the workbench applies to GOC, what GOC needs from it, which GUI surfaces matter, which areas should remain protected, and how GOC can test the broader product concept.

The intent is to use GOC as a proving ground without collapsing the GUI Workbench into a GOC-only tool.

---

# 2. GOC Context

GOC — geology and sea — is a mining/geoscience visualization application.

It is expected to support complex visual material such as:

- terrain
- maps
- satellite imagery
- geology overlays
- drillhole information
- assay intervals
- seismic or geophysical data
- project-specific visualization layers
- presentation views
- stakeholder-facing scenes

The GUI around those materials must support both technical and non-technical use.

---

# 3. Why GOC Needs the GUI Workbench

GOC likely needs many different interface surfaces:

- technical editing panels
- visualization controls
- layer managers
- tool containers
- inspectors
- presentation controls
- project-specific display variants
- stakeholder-facing simplified modes

Building every GUI iteration directly in app code creates friction.

The workbench provides a faster way to:

- create panel structures
- test controls
- validate screen/device suitability
- preview over realistic backgrounds
- generate implementation briefs
- document interface rationale
- create project-specific overrides
- refine embedded app GUI surfaces safely

---

# 4. GOC User Contexts

GOC may need to support several user contexts.

## 4.1 Technical Editing

Dense, expert-facing panels are acceptable.

Likely needs:

- layer controls
- drillhole data inspection
- geological overlays
- tool configuration
- data import/checking
- precise controls
- mouse/keyboard assumptions

## 4.2 Internal Review

Users may inspect project data and visualization states without fully editing everything.

Likely needs:

- simplified inspector panels
- review controls
- toggles
- annotations
- comparison views

## 4.3 Field or Tablet Review

Users may review project information away from a workstation.

Likely needs:

- touch-safe controls
- larger spacing
- reduced density
- simplified workflows
- robust panel stacking

## 4.4 Client / Investor Presentation

The interface should help explain technical material clearly.

Likely needs:

- simplified visible controls
- stronger hierarchy
- clean presentation state
- large labels
- minimal technical clutter
- safe boardroom/projector display

## 4.5 Boardroom / Large Display Use

The app may be shown on a TV, projector, or large touchscreen.

Likely needs:

- readable text at distance
- high contrast
- large controls
- no tiny sliders
- no hover dependency
- simple navigation
- presentation-safe panels

---

# 5. GOC Interface Surfaces of Interest

The following surfaces are likely relevant to the GUI Workbench.

## 5.1 Layer Control Panel

Controls visibility, opacity, grouping, ordering, and status of visualization layers.

Potential controls:

- layer list
- visibility toggle
- opacity slider
- group collapse
- active layer state
- warning/error indicator
- search/filter
- reorder handle

## 5.2 Lighting Control Panel

Controls visual lighting of terrain or 3D scenes.

Potential controls:

- sun angle
- intensity
- ambient light
- shadow toggle
- preset buttons
- reset control
- terrain contrast/exaggeration relationship note

## 5.3 Camera / Navigation Panel

Controls viewpoint, camera presets, navigation mode, and presentation framing.

Potential controls:

- camera preset buttons
- reset view
- orbit/pan mode
- zoom-to-target
- presentation path controls
- field-of-view settings

## 5.4 Data Import Container

Supports bringing project data into GOC.

Potential controls:

- file selector
- data type selector
- import status
- validation warnings
- mapping controls
- preview table
- confirm/cancel actions

## 5.5 Map Overlay Controller

Controls map, imagery, terrain, and overlay visibility.

Potential controls:

- basemap selector
- opacity controls
- overlay toggles
- legend visibility
- coordinate/grid options

## 5.6 Drillhole Inspector

Shows information about selected drillholes.

Potential controls:

- selected hole identity
- collar data
- depth interval controls
- assay highlights
- lithology view
- focus/isolate button
- export/share selected interval

## 5.7 Seismic / Geophysical Tool Container

Supports specialized geophysical visualization controls.

Potential controls:

- data source selector
- visibility toggle
- opacity slider
- colour map selector
- depth/time range
- filters
- preview region
- apply/reset buttons
- data warnings

## 5.8 Presentation Control Panel

Supports stakeholder-facing presentation.

Potential controls:

- scene selection
- next/previous view
- simplified layer toggles
- annotation visibility
- reset presentation
- fullscreen/presentation-safe mode

---

# 6. GOC Safe Edit Surfaces

The workbench may eventually edit safe GOC GUI surfaces such as:

- panel labels
- section labels
- button labels
- panel widths
- section order
- collapsed/expanded defaults
- spacing
- padding
- component variants
- visible optional controls
- project-specific presentation settings
- layer panel defaults
- tool panel layout
- background preview selection
- project override settings

These should be exposed only through the GOC adapter.

---

# 7. GOC Restricted Surfaces

The following should remain locked unless deliberately exposed later:

- 3D renderer internals
- geological data processing
- geospatial file parsing
- project file save/load logic
- authentication or permissions
- external data integrations
- destructive project actions
- app state architecture
- camera/rendering engine behaviour
- mining/geoscience calculation logic
- database writes
- cloud/network configuration
- security-related settings

The GUI Workbench should not be able to mutate these by default.

---

# 8. GOC Device and Display Profiles

GOC should likely consider these profiles:

- desktop monitor
- laptop
- tablet/iPad
- field laptop
- boardroom TV
- projector
- large touchscreen
- ultrawide monitor

Phone may be considered for review or lightweight viewing, but likely not full technical editing.

---

# 9. GOC Input Profiles

Relevant input methods may include:

- mouse
- trackpad
- keyboard
- touch
- stylus
- presentation remote
- mixed input

Touch matters for tablet and large touchscreen use.

Keyboard/mouse matter for technical editing.

Remote/clicker matters for presentation flow.

---

# 10. GOC Background Stress Testing

GOC needs background stress testing because interface panels may sit over complex visual content.

Required test backgrounds should include:

- dark terrain
- light terrain
- satellite imagery
- map imagery
- geology overlay
- high-detail technical visualization
- noisy visual background
- low-contrast background
- stripe/pattern test
- moving scene or simulated motion background
- transparent panel stress background

This is especially important for transparent or floating panels.

---

# 11. GOC Project Overrides

GOC should support project-specific GUI overrides.

Examples:

- Woodjam
- Bingham Canyon
- Utah FORGE
- Kliyul

Overrides may adjust:

- panel ordering
- project terminology
- visible tools
- default visible layers
- presentation mode
- boardroom-friendly controls
- stakeholder-facing labels
- project-specific warnings
- background/test scenes

Overrides should not mutate the base GOC GUI system silently.

---

# 12. GOC as First Proving Ground

GOC is useful as a proving ground because it has:

- complex visual background requirements
- multiple user contexts
- technical and non-technical use cases
- project-specific needs
- likely embedded editing value
- real panel/container variety
- AI-agent handoff needs
- strong validation needs

If the workbench can handle GOC, it should generalize to other technical visualization products.

---

# 13. GOC-Specific Risk

The main risk is overfitting the workbench to GOC.

The core should remain generic.

GOC-specific concepts should live in:

- GOC adapter
- GOC package examples
- GOC container archetypes
- GOC validation profile presets
- GOC background test assets

The Workbench Core should not depend on geology, mining, or GOC-specific logic.

---

# 14. GOC Reviewer Questions

A reviewer should consider:

1. Which GOC panels are most important to expose first?
2. Which surfaces should remain permanently locked?
3. Which project override examples best test the model?
4. Which display contexts matter most for GOC?
5. Which background stress tests are essential?
6. Which users should be assumed for technical mode?
7. Which users should be assumed for presentation mode?
8. Should phone support be review-only or excluded from early assumptions?
9. What does GOC need from embedded mode that standalone mode cannot provide?
10. Where might GUI package import/export help current GOC development?

---

# 15. Summary

GOC is the first proving ground for the GUI Workbench.

The workbench should help GOC define, test, validate, document, and refine its interface layer while preserving strict boundaries around rendering, data processing, app logic, and security.

GOC should shape the first real use cases, but the workbench core should remain portable.
