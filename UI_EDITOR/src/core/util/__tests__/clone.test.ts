import { describe, expect, it } from "vitest";
import { clone } from "../clone";

describe("clone", () => {
  it("returns a deep copy disjoint from the input", () => {
    const input = { a: 1, b: { c: 2 }, d: [3, 4] };
    const out = clone(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out.b).not.toBe(input.b);
    expect(out.d).not.toBe(input.d);
  });

  it("preserves explicit undefined fields", () => {
    const input = { present: 1, absent: undefined };
    const out = clone(input);
    expect("absent" in out).toBe(true);
    expect(out.absent).toBeUndefined();
  });

  it("handles nested arrays of objects", () => {
    const input = [{ id: "a" }, { id: "b", nested: { v: 1 } }];
    const out = clone(input);
    expect(out).toEqual(input);
    expect(out[0]).not.toBe(input[0]);
    expect((out[1] as { nested: { v: number } }).nested).not.toBe(
      (input[1] as { nested: { v: number } }).nested,
    );
  });

  it("returns primitives as-is", () => {
    expect(clone(1)).toBe(1);
    expect(clone("x")).toBe("x");
    expect(clone(null)).toBe(null);
  });
});
