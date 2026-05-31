import { describe, expect, it } from "vitest";
import { isWritePathAllowed, isValidPackageId, packageIdFromPath } from "../pathPolicy";

describe("isWritePathAllowed", () => {
  const allowed = [
    "packages/geosee_editor_sidebar/manifest.json",
    "packages/geosee_editor_sidebar/frames.json",
    "packages/geosee_editor_sidebar/containers.json",
    "packages/geosee_editor_sidebar/components.json",
    "packages/geosee_editor_sidebar/tokens.json",
    "packages/geosee_editor_sidebar/libraries.json",
    "packages/geosee_editor_sidebar/guides.json",
    "packages/geosee_editor_sidebar/change_log.json",
    "packages/geosee_editor_sidebar/validation/rule_pack.json",
    "packages/geosee_editor_sidebar/validation/findings.json",
    "packages/geosee_editor_sidebar/docs/spec.md",
    "packages/geosee_editor_sidebar/docs/ai_agent_brief.md",
    "packages/geosee_editor_sidebar/assets/backgrounds/plain_dark.png",
    "packages/geosee_editor_sidebar/assets/thumbnails/component-pill-button.svg",
  ];
  it.each(allowed)("accepts %s", (p) => {
    expect(isWritePathAllowed(p)).toEqual({ ok: true });
  });

  const rejected: Array<[string, string]> = [
    ["packages/geosee_editor_sidebar/../etc.txt", "path_traversal"],
    ["packages/geosee_editor_sidebar/secret.json", "path_not_allowlisted"],
    ["packages/UPPER/manifest.json", "path_not_allowlisted"],
    ["packages/geosee_editor_sidebar/assets/backgrounds/../secret.png", "path_traversal"],
    ["..\\..\\etc.txt", "path_separator_backslash"],
    ["", "path_empty"],
    ["packages/geosee_editor_sidebar/docs/CHANGELOG.md", "path_not_allowlisted"],
  ];
  it.each(rejected)("rejects %s with reason %s", (p, reason) => {
    const result = isWritePathAllowed(p);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
    }
  });
});

describe("isValidPackageId", () => {
  it("accepts snake_case ids", () => {
    expect(isValidPackageId("geosee_editor_sidebar")).toBe(true);
    expect(isValidPackageId("foo123")).toBe(true);
  });
  it("rejects bad ids", () => {
    expect(isValidPackageId("UPPER")).toBe(false);
    expect(isValidPackageId("kebab-case")).toBe(false);
    expect(isValidPackageId("with space")).toBe(false);
    expect(isValidPackageId("../escape")).toBe(false);
    expect(isValidPackageId(undefined)).toBe(false);
  });
});

describe("packageIdFromPath", () => {
  it("extracts package id from a valid path", () => {
    expect(packageIdFromPath("packages/geosee_editor_sidebar/manifest.json")).toBe(
      "geosee_editor_sidebar",
    );
  });
  it("returns null for non-packages path", () => {
    expect(packageIdFromPath("notpackages/x/manifest.json")).toBeNull();
  });
});
