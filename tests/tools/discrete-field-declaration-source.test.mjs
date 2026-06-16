import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// DEC-166 regression guard (review findings 6.1 + 6.2). Atmosphere puff/texture
// fields and borehole-log geometry fields must be declared discrete in exactly
// one place and must NOT sit in SCALAR_TRANSITION_STYLE_FIELDS, where they were
// dead duplicates (those layers carry no geometry scalarValues, so they never
// interpolated). This locks the single-declaration invariant at the source.

const stylesSource = readFileSync(
  "src/scene/transitions/transitionStyles.ts",
  "utf8",
);

// Extract the literal array body of a `const NAME ... = [ ... ];` declaration.
// The transition field arrays contain no nested `[`, so bracket matching is
// exact (the only inner token is a `...SPREAD` with no bracket).
function arrayBody(source, name) {
  // Anchor on the declaration (`NAME:`), not the first textual mention -- the
  // constant names also appear in comments and in forgeDiscreteDataStyleChanged.
  const start = source.indexOf(`${name}:`);
  assert.notEqual(start, -1, `${name} must be declared in transitionStyles.ts`);
  // Skip past the `=`; the type annotation `(keyof EditableStyle)[]` contains a
  // bracket pair that would otherwise be matched instead of the array literal.
  const eq = source.indexOf("=", start);
  assert.notEqual(eq, -1, `${name} must be assigned`);
  const open = source.indexOf("[", eq);
  assert.notEqual(open, -1, `${name} must be an array literal`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    else if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated array literal for ${name}`);
}

const ATMOSPHERE_FIELDS = [
  "atmosphereDensity",
  "atmosphereSoftness",
  "atmospherePuffCount",
  "atmospherePuffScaleM",
  "atmosphereScaleJitter",
  "atmosphereVerticalFalloff",
  "atmosphereEdgeFade",
  "atmosphereSeed",
  "atmosphereDriftSpeedMps",
  "atmosphereDriftDirectionX",
  "atmosphereDriftDirectionY",
  "atmosphereDriftDirectionZ",
  "atmosphereRenderOrder",
];

const BOREHOLE_FIELDS = [
  "boreholeLogTrackOffsetM",
  "boreholeLogTrackWidthM",
  "boreholeLogGammaScaleApi",
  "boreholeLogResistivityMinOhmM",
  "boreholeLogResistivityMaxOhmM",
  "boreholeLogCurveFillCutoff",
  "boreholeLogCurveOpacity",
  "boreholeLogCurveLineWidthPx",
  "boreholeLogDepthMinFt",
  "boreholeLogDepthMaxFt",
  "boreholeLogVerticalExaggeration",
  "boreholeLogLithologyOpacity",
  "boreholeLogLithologyWidthPx",
];

test("SCALAR_TRANSITION_STYLE_FIELDS carries no atmosphere or borehole fields", () => {
  const scalarBody = arrayBody(stylesSource, "SCALAR_TRANSITION_STYLE_FIELDS");
  for (const field of [...ATMOSPHERE_FIELDS, ...BOREHOLE_FIELDS]) {
    assert.ok(
      !scalarBody.includes(`"${field}"`),
      `${field} must not be declared in SCALAR_TRANSITION_STYLE_FIELDS (it cannot interpolate)`,
    );
  }
  // The scalar list must still carry a genuine scalar field, so the test is not
  // passing because the array vanished.
  assert.ok(scalarBody.includes('"scalarBlendMin"'), "scalar fields remain");
});

test("atmosphere structural fields are declared in the atmosphere discrete list", () => {
  const body = arrayBody(stylesSource, "LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS");
  for (const field of [
    "atmosphereDensity",
    "atmosphereSoftness",
    "atmosphereVerticalFalloff",
    "atmosphereEdgeFade",
    "atmospherePuffCount",
    "atmosphereSeed",
  ]) {
    assert.ok(
      body.includes(`"${field}"`),
      `${field} must be declared discrete in LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS`,
    );
  }
});

test("borehole geometry fields are declared in the borehole discrete list and wired into forgeDiscreteDataStyleChanged", () => {
  const body = arrayBody(stylesSource, "BOREHOLE_LOG_DISCRETE_STYLE_FIELDS");
  for (const field of BOREHOLE_FIELDS) {
    assert.ok(
      body.includes(`"${field}"`),
      `${field} must be declared discrete in BOREHOLE_LOG_DISCRETE_STYLE_FIELDS`,
    );
  }
  assert.match(
    stylesSource,
    /layerId === UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID[\s\S]{0,160}BOREHOLE_LOG_DISCRETE_STYLE_FIELDS/,
    "forgeDiscreteDataStyleChanged must crossfade borehole changes via BOREHOLE_LOG_DISCRETE_STYLE_FIELDS",
  );
});
