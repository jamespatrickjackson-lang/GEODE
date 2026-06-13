import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// DEC-165 regression guard. The scene-section frame helper group is oriented by
// Matrix4.makeBasis(tangentA, tangentB, third) -> Quaternion.setFromRotationMatrix.
// setFromRotationMatrix only represents PROPER rotations; if the basis is
// left-handed (determinant -1) it silently mangles the quaternion. The resolved
// per-axis basis is left-handed for the Y axis, so using the raw plane normal as
// the third column dropped the entire Y helper group (outline, handle cones,
// ticks/labels, ground trace) into the X-Y plane -- coincident with Z and 90deg
// from the real Y cut. The fix derives the third column from tangentA x tangentB,
// which is always right-handed. This test locks both the geometric invariant and
// the source-level fix so the Y-section orientation cannot regress.

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
// determinant of the column matrix [c0 | c1 | c2] = c0 . (c1 x c2)
const det3 = (c0, c1, c2) => {
  const cx = cross(c1, c2);
  return c0[0] * cx[0] + c0[1] * cx[1] + c0[2] * cx[2];
};

// The resolved per-axis frame bases (axisA, axisB, normal), UTM alignment.
const AXIS_BASES = {
  x: { axisA: [0, 1, 0], axisB: [0, 0, 1], normal: [1, 0, 0] },
  y: { axisA: [1, 0, 0], axisB: [0, 0, 1], normal: [0, 1, 0] },
  z: { axisA: [1, 0, 0], axisB: [0, 1, 0], normal: [0, 0, 1] },
};

test("the Y axis frame basis is left-handed (the latent trap)", () => {
  // x and z are right-handed; y is the odd one out (axisA x axisB = -normal).
  assert.equal(det3([0, 1, 0], [0, 0, 1], [1, 0, 0]), 1, "x is right-handed");
  assert.equal(det3([1, 0, 0], [0, 1, 0], [0, 0, 1]), 1, "z is right-handed");
  const y = AXIS_BASES.y;
  assert.equal(
    det3(y.axisA, y.axisB, y.normal),
    -1,
    "y basis with the raw normal as third column is a reflection (det -1) -> setFromRotationMatrix mangles it",
  );
  assert.deepEqual(
    cross(y.axisA, y.axisB),
    [0, -1, 0],
    "axisA x axisB = -normal for Y",
  );
});

test("deriving the third column from axisA x axisB is always a proper rotation", () => {
  for (const [axis, b] of Object.entries(AXIS_BASES)) {
    const third = cross(b.axisA, b.axisB);
    assert.equal(
      det3(b.axisA, b.axisB, third),
      1,
      `${axis}: makeBasis(axisA, axisB, axisA x axisB) must be proper (det +1)`,
    );
  }
});

const controllerSource = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);

test("the frame helper orientation uses the cross-product third column, not the raw normal", () => {
  // The makeBasis third argument must be the cross product of the tangents, so a
  // left-handed (Y) basis can never reach setFromRotationMatrix as a reflection.
  assert.match(
    controllerSource,
    /crossVectors\(\s*tangentA,\s*tangentB\s*\)[\s\S]{0,200}makeBasis\(\s*\n?\s*tangentA,\s*\n?\s*tangentB,\s*\n?\s*orientationNormal/,
    "planeBasis must makeBasis(tangentA, tangentB, tangentA x tangentB)",
  );
  assert.doesNotMatch(
    controllerSource,
    /makeBasis\(\s*\n?\s*tangentA,\s*\n?\s*tangentB,\s*\n?\s*basisNormal\s*,?\s*\n?\s*\)/,
    "the raw basisNormal must NOT be the makeBasis third column (it is left-handed for Y)",
  );
});
