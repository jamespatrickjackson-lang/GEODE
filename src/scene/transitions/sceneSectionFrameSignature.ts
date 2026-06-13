import type { EditableStyle, SceneSectionFrameState } from "../../pages/types";

// Pure scene-section frame identity logic, isolated from the THREE-heavy
// transition-styles module so it can be unit-tested directly. These functions
// describe WHICH frames are the "same" frame across two pages (discrete
// identity) and partition them into move-vs-dissolve sets. They reference only
// plain style fields — no renderer, no layer registry. DEC-164.

function sceneSectionFrameAlignmentSignature(
  frame: Partial<SceneSectionFrameState>,
): "utm" | "cardinal" {
  return frame.axisAlignment === "cardinal" ? "cardinal" : "utm";
}

function sceneSectionFrameDatumSignature(
  frame: Partial<SceneSectionFrameState>,
): "utm" | "local" | "latlon" {
  return frame.axisDatum === "local" || frame.axisDatum === "latlon"
    ? frame.axisDatum
    : "utm";
}

function finiteSceneSectionFrameNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface SceneSectionFrameDiscreteSignatureEntry {
  id: string;
  axis: string | null;
  enabled: boolean;
  invert: boolean;
  frameEnabled: boolean | null;
  controlsVisible: boolean | null;
  groundTraceVisible: boolean | null;
  axisAHeading: string | null;
  axisBHeading: string | null;
  axisHeadingColor: string | null;
  axisAlignment: string | null;
  axisDatum: string | null;
  axisDatumOriginEastingM: number | null;
  axisDatumOriginNorthingM: number | null;
  axisDatumLatLonDecimals: number | null;
}

// The per-frame discrete identity. Deliberately excludes numeric geometry
// (plane position, crop bounds, window) — those interpolate and must NOT change
// a frame's identity. It captures only the fields where a difference means the
// frame is a different cut: enable, axis, flip, headings, alignment, datum.
export function sceneSectionFrameDiscreteSignature(
  style: EditableStyle,
): SceneSectionFrameDiscreteSignatureEntry[] {
  const planes = style.sceneSectionPlanes ?? {};
  const frames = style.sceneSectionFrameByAxis ?? {};
  const explicit = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  const explicitById = new Map(
    explicit
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry]),
  );
  const signatures: SceneSectionFrameDiscreteSignatureEntry[] = [];
  for (const axis of ["x", "y", "z"] as const) {
    const id = `axis:${axis}`;
    const explicitEntry = explicitById.get(id);
    const plane = { ...(explicitEntry?.plane ?? {}), ...(planes[axis] ?? {}) };
    const frame = { ...(frames[axis] ?? {}), ...(explicitEntry?.frame ?? {}) };
    const axisDatum = sceneSectionFrameDatumSignature(frame);
    signatures.push({
      id,
      axis,
      enabled: plane.enabled === true,
      invert: plane.invert === true,
      frameEnabled:
        typeof frame.enabled === "boolean" ? frame.enabled : null,
      controlsVisible:
        typeof frame.controlsVisible === "boolean"
          ? frame.controlsVisible
          : null,
      groundTraceVisible:
        typeof frame.groundTraceVisible === "boolean"
          ? frame.groundTraceVisible
          : null,
      axisAHeading:
        typeof frame.axisAHeading === "string" ? frame.axisAHeading : null,
      axisBHeading:
        typeof frame.axisBHeading === "string" ? frame.axisBHeading : null,
      axisHeadingColor:
        typeof frame.axisHeadingColor === "string"
          ? frame.axisHeadingColor
          : null,
      axisAlignment: sceneSectionFrameAlignmentSignature(frame),
      axisDatum,
      axisDatumOriginEastingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginEastingM)
          : null,
      axisDatumOriginNorthingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginNorthingM)
          : null,
      axisDatumLatLonDecimals:
        axisDatum === "latlon"
          ? finiteSceneSectionFrameNumber(frame.axisDatumLatLonDecimals) ?? 3
          : null,
    });
  }
  for (const entry of explicit) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.startsWith("axis:")
    ) {
      continue;
    }
    const plane = entry.plane ?? {};
    const frame = entry.frame ?? {};
    const axisDatum = sceneSectionFrameDatumSignature(frame);
    signatures.push({
      id: entry.id,
      axis:
        entry.axis === "x" || entry.axis === "y" || entry.axis === "z"
          ? entry.axis
          : null,
      enabled: plane.enabled === true,
      invert: plane.invert === true,
      frameEnabled:
        typeof frame.enabled === "boolean" ? frame.enabled : null,
      controlsVisible:
        typeof frame.controlsVisible === "boolean"
          ? frame.controlsVisible
          : null,
      groundTraceVisible:
        typeof frame.groundTraceVisible === "boolean"
          ? frame.groundTraceVisible
          : null,
      axisAHeading:
        typeof frame.axisAHeading === "string" ? frame.axisAHeading : null,
      axisBHeading:
        typeof frame.axisBHeading === "string" ? frame.axisBHeading : null,
      axisHeadingColor:
        typeof frame.axisHeadingColor === "string"
          ? frame.axisHeadingColor
          : null,
      axisAlignment: sceneSectionFrameAlignmentSignature(frame),
      axisDatum,
      axisDatumOriginEastingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginEastingM)
          : null,
      axisDatumOriginNorthingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginNorthingM)
          : null,
      axisDatumLatLonDecimals:
        axisDatum === "latlon"
          ? finiteSceneSectionFrameNumber(frame.axisDatumLatLonDecimals) ?? 3
          : null,
    });
  }
  return signatures.sort((a, b) => a.id.localeCompare(b.id));
}

export interface SceneSectionFramePartition {
  // Frames present and identity-compatible on both pages: numeric geometry
  // (plane position, crop bounds, window) interpolates — the plane slides to
  // meet, the extent moves in/out.
  movingFrameIds: Set<string>;
  // Frames added, removed, or with a changed discrete identity (enable, axis,
  // flip, heading, datum): these cross-dissolve through the dual-mask.
  dissolveFrameIds: Set<string>;
}

// A frame can SLIDE (interpolate position/extent) when the from/to frames share
// the same coordinate frame: same axis, alignment, and datum. Presentation-only
// differences (headings, control/ground-trace visibility, frame-enable) must
// NOT block the slide — those are helper concerns that transition by opacity.
// `invert` (which half-space is kept) is deliberately EXCLUDED: a plane that
// flips still slides (DEC-164). The flip can't be interpolated, so the runtime
// holds the source kept-side during the glide and applies the target flip at
// commit; the kept volume changes side once, at the end, instead of the whole
// section dissolving. Using the full discrete signature here is too strict.
function frameGeometryIdentity(
  sig: SceneSectionFrameDiscreteSignatureEntry,
): string {
  return JSON.stringify({
    axis: sig.axis,
    axisAlignment: sig.axisAlignment,
    axisDatum: sig.axisDatum,
    axisDatumOriginEastingM: sig.axisDatumOriginEastingM,
    axisDatumOriginNorthingM: sig.axisDatumOriginNorthingM,
    axisDatumLatLonDecimals: sig.axisDatumLatLonDecimals,
  });
}

// DEC-164: partition section frames per stable id instead of an all-or-nothing
// global discrete decision. A frame enabled on both pages with the same cut
// geometry moves (its numeric position/extent interpolates); added, removed,
// disabled, or geometry-changed frames dissolve. Frames inactive on both pages
// are ignored. This is what makes DEC-071's "interpolate numeric frame geometry
// by stable frame id" actually hold when another frame toggles.
export function sceneSectionFramePartition(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): SceneSectionFramePartition {
  const fromSigs = new Map(
    sceneSectionFrameDiscreteSignature(fromStyle).map((sig) => [sig.id, sig]),
  );
  const toSigs = new Map(
    sceneSectionFrameDiscreteSignature(toStyle).map((sig) => [sig.id, sig]),
  );
  const movingFrameIds = new Set<string>();
  const dissolveFrameIds = new Set<string>();
  const ids = new Set<string>([...fromSigs.keys(), ...toSigs.keys()]);
  for (const id of ids) {
    const from = fromSigs.get(id);
    const to = toSigs.get(id);
    const fromEnabled = from?.enabled === true;
    const toEnabled = to?.enabled === true;
    if (!fromEnabled && !toEnabled) continue; // not a live frame on either page
    if (
      fromEnabled &&
      toEnabled &&
      from &&
      to &&
      frameGeometryIdentity(from) === frameGeometryIdentity(to)
    ) {
      movingFrameIds.add(id);
    } else {
      dissolveFrameIds.add(id);
    }
  }
  return { movingFrameIds, dissolveFrameIds };
}
