import { describe, expect, it } from "vitest";
import { isValidId, isValidKebabId, isValidSnakeId, newId } from "../ids";

describe("ids", () => {
  it("generates ids that vary on each call", () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("supports a prefix", () => {
    const id = newId("component-pill-button");
    expect(id.startsWith("component-pill-button-")).toBe(true);
  });

  it("validates kebab-case ids", () => {
    expect(isValidKebabId("page-list-row")).toBe(true);
    expect(isValidKebabId("a")).toBe(true);
    expect(isValidKebabId("Page-list")).toBe(false);
    expect(isValidKebabId("page_list")).toBe(false);
  });

  it("validates snake_case ids", () => {
    expect(isValidSnakeId("geosee_editor_sidebar")).toBe(true);
    expect(isValidSnakeId("Geosee")).toBe(false);
    expect(isValidSnakeId("a-b")).toBe(false);
  });

  it("isValidId accepts either kebab or snake", () => {
    expect(isValidId("page-list-row")).toBe(true);
    expect(isValidId("geosee_editor_sidebar")).toBe(true);
    expect(isValidId("BadId")).toBe(false);
  });
});
