import { describe, expect, it } from "vitest";
import { invariant } from "../invariant";

describe("invariant", () => {
  it("passes through when the condition is truthy", () => {
    expect(() => invariant(1, "ok")).not.toThrow();
    expect(() => invariant({}, "ok")).not.toThrow();
    expect(() => invariant("non-empty", "ok")).not.toThrow();
  });

  it("throws with the supplied message when falsy", () => {
    expect(() => invariant(0, "zero is falsy")).toThrow(/zero is falsy/);
    expect(() => invariant(null, "null is falsy")).toThrow(/null is falsy/);
    expect(() => invariant(undefined, "undef")).toThrow(/undef/);
  });
});
