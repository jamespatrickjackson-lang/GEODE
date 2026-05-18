# page.json schema

A single page in the presentation sequence. Captures a moment: where
the camera is, what is visible, what the audience is reading, and
which annotations are pinned to 3D positions.

## Where it lives

    projects/<project-name>/pages/<page-id>.json

One file per page. The page IDs are referenced by `pageOrder` in
`project.json`. Filename prefix convention is `NN_descriptive-slug.json`
(e.g. `01_district_overview.json`) — the prefix makes file ordering
match presentation order on disk.

## Complete annotated example

```json
{
  "id": "03_great_plains_target",
  "title": "Great Plains Target",
  "subtitle": "Concealed Porphyry Anomaly",

  "camera": {
    "position": [1200, -800, 2400],
    "target": [800, -1200, 1100],
    "up": [0, 0, 1],
    "fov": 38
  },

  "transition": {
    "duration": 3500,
    "easing": "easeInOutCubic"
  },

  "holdDuration": 4000,

  "visibleLayers": [
    "terrain",
    "claim-boundary",
    "drillholes-2023",
    "ip-chargeability-2024",
    "great-plains-anomaly"
  ],

  "layerOverrides": {
    "drillholes-2023": {
      "opacity": 0.4,
      "color": "#9A9790"
    },
    "great-plains-anomaly": {
      "opacity": 0.85
    }
  },

  "overlay": {
    "position": "right",
    "width": 380,
    "contentFile": "overlays/03_great_plains_target/text.md",
    "images": [
      {
        "file": "overlays/03_great_plains_target/dcip_section.png",
        "caption": "DCIP chargeability section, line 6",
        "position": "below-text"
      }
    ]
  },

  "annotations": [
    {
      "id": "ann-anomaly-extent",
      "type": "label",
      "position": [800, -1200, 1100],
      "text": "2 km × 2 km broad chargeability anomaly",
      "anchor": "right",
      "calloutTo": null
    },
    {
      "id": "ann-southeast-comparison",
      "type": "callout",
      "position": [-400, -200, 1300],
      "text": "Geology interpreted as analogous to Southeast",
      "anchor": "left",
      "calloutTo": [200, -100, 1280]
    }
  ],

  "presenterNotes": "Lead with the concealed nature of the target. Glacial till cover means surface evidence is weak — the case for drilling rests on geophysics + analog logic to Southeast. Pause on the anomaly extent annotation."
}
```

## Field reference

### Identification

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique page identifier. Must match the filename (without `.json`) and an entry in `project.json`'s `pageOrder`. |
| `title` | string | yes | Page title shown in the presenter view and in the page indicator. |
| `subtitle` | string | no | Optional secondary line shown below the title. |
| `renderPreset` | string | no | Optional cinematic render preset override for this page. Missing inherits the project environment default. Supported built-in IDs: `"cinematic-dark"`, `"survey-daylight"`, `"boardroom"`, `"data-room"`, `"night-ops"`. User preset IDs such as `"user-1"` may also be selected when defined in `environment.json` `customRenderPresets`. |

`renderPreset` is presentation mood only. It must not be used to alter MT,
scalar, seismic, coordinate, loader, or computed-artifact behavior.

### Camera

| Field | Type | Required | Description |
|---|---|---|---|
| `camera.position` | [number, number, number] | yes | Camera position in **scene coordinates** (relative to `sceneOrigin` in `project.json`). |
| `camera.target` | [number, number, number] | yes | Point the camera looks at, in scene coordinates. |
| `camera.up` | [number, number, number] | yes | Up vector. Usually `[0, 0, 1]` for Z-up georeferenced scenes. |
| `camera.fov` | number | yes | Field of view in degrees. Typical: `35`–`60`. Lower values feel more cinematic; higher values feel more documentary. |

**How camera values are captured:** the authoring UI's "Capture pose"
button reads the current Three.js camera state and writes these values
directly. You should rarely edit them by hand.

### Transition

How the camera moves from the *previous* page to *this* page. The first
page in the sequence ignores transition (camera starts at this pose).

| Field | Type | Required | Description |
|---|---|---|---|
| `transition.duration` | number | yes | Milliseconds for the camera flight. Typical: `2000`–`5000`. |
| `transition.easing` | string | yes | Tween.js easing function name. Common: `"linear"`, `"easeInOutCubic"`, `"easeOutQuart"`, `"easeInOutSine"`. |

**Easing recommendations for cinematic feel:**
- `easeInOutCubic` — default, smooth start and stop
- `easeOutQuart` — punchy arrival (good for hero reveals)
- `easeInOutSine` — gentle and slow (good for contemplative scenes)

### Hold duration

How long the video export should dwell on this page after the camera
arrives, before transitioning to the next.

| Field | Type | Required | Description |
|---|---|---|---|
| `holdDuration` | number | yes | Milliseconds. Typical: `3000`–`6000`. Used by the video exporter; not used in interactive mode (the user controls pacing). |

### Visible layers

| Field | Type | Required | Description |
|---|---|---|---|
| `visibleLayers` | string[] | yes | Array of layer IDs (from `project.json`) visible on this page. Layers not in this list are hidden. |

### Layer overrides (optional)

Per-page style adjustments. Useful when one page wants to dim background
context while emphasizing a hero layer.

| Field | Type | Required | Description |
|---|---|---|---|
| `layerOverrides` | object | no | Map of `layerId → partial style object`. Any field omitted falls back to the layer's default style from `project.json`. |

Override fields are the same as the per-type style fields documented in
`project.json.md`. Most commonly overridden: `opacity`, `color`.

### Overlay

The narrative panel content for this page.

| Field | Type | Required | Description |
|---|---|---|---|
| `overlay.position` | enum | yes | Where the overlay sits: `"left"`, `"right"`, `"bottom"`, or `"none"`. |
| `overlay.width` | number | no | Width in pixels (for left/right). Defaults to `380`. |
| `overlay.contentFile` | string | yes | Relative path to a markdown file with the page's narrative text. |
| `overlay.images` | array | no | Array of image objects to display alongside the text. |

Each image object:

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | string | yes | Relative path to the image (PNG/JPG/SVG). |
| `caption` | string | no | Caption shown below the image. |
| `position` | enum | no | `"above-text"`, `"below-text"`, `"interleaved"`. Default: `"below-text"`. |

**Charts in alpha:** charts go here as image attachments. The data model
is designed so that future versions can replace `images` with `panels`
that include rendered chart references — but in alpha, images are the
only option. See decision #005.

### Annotations

3D-pinned text labels and callouts. Each annotation is anchored to a
specific 3D position and stays attached as the camera moves.

| Field | Type | Required | Description |
|---|---|---|---|
| `annotations[].id` | string | yes | Unique within the page. |
| `annotations[].type` | enum | yes | `"label"` (free-floating) or `"callout"` (with a leader line to a target). |
| `annotations[].position` | [number, number, number] | yes | 3D position in scene coordinates. The annotation text appears here. |
| `annotations[].text` | string | yes | The annotation text. Keep short — single line ideal. |
| `annotations[].anchor` | enum | no | Which side of the position the text floats: `"left"`, `"right"`, `"above"`, `"below"`. Default: `"right"`. |
| `annotations[].calloutTo` | [number, number, number] \| null | no | For `callout` type, the target the leader line points to. Null for `label` type. |

Annotations should be used sparingly. Two or three per page is plenty;
five or more becomes visual clutter.

### Presenter notes

| Field | Type | Required | Description |
|---|---|---|---|
| `presenterNotes` | string | no | Free text shown only in presenter mode (not the published view). What to emphasize, what to skip, what audience questions to anticipate. |

## Lifecycle

- **On page creation:** authoring UI generates a new file at
  `pages/<id>.json` with the current camera pose captured, an empty
  `visibleLayers`, and a stub overlay reference.
- **As the user edits:** UI writes back to the same file. Fields not yet
  set use defaults.
- **On page reorder:** `project.json`'s `pageOrder` is updated; page
  files themselves are not moved or renamed (rename is optional manual
  cleanup).
- **On page delete:** the page is removed from `pageOrder`, but the
  `pages/<id>.json` file is moved to `pages/_archive/` rather than
  deleted, in case it's wanted back.

## Common pitfalls

- **Camera coordinates in CRS instead of scene coords:** if you hand-edit
  camera values, remember they are in scene coordinates (small numbers
  near origin), not CRS coordinates (large UTM eastings). Use the
  Capture button instead of editing.
- **`visibleLayers` referencing nonexistent layer IDs:** silently
  ignored. If a layer doesn't show up, check the layer ID matches
  exactly (case-sensitive).
- **Transition duration too short:** anything under `1500` ms feels
  jarring. Anything over `6000` ms feels slow. Most pages should be in
  the `2500–4000` range.
- **Annotations off-screen:** an annotation at a position not currently
  visible in the camera frustum will not render. The authoring UI should
  warn but doesn't always — visual check after capture.
- **Filename prefix and `pageOrder` disagree:** if you rename a file but
  forget to update `pageOrder`, the page disappears from the sequence.
  Use the page-management UI to reorder, not file renames.
