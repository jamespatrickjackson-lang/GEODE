import { describe, expect, it } from "vitest";
import { runValidation } from "../runValidation";
import type { Package } from "../../schema/package";
import type { ComponentLibraryEntry } from "../../schema/library";
import type { ProfileSelection } from "../../schema/profiles";

const profile: ProfileSelection = {
  deviceId: "desktop-1080p",
  inputId: "mouse-keyboard",
  useCaseId: "technical-editing",
};

function pkgWith(components: ComponentLibraryEntry[]): Package {
  return {
    manifest: {
      id: "tier_pkg",
      name: "Tier",
      schemaVersion: 1,
      workbenchVersion: "1.0.0",
      packageState: "Draft",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      targetHostApp: { name: "geosee" },
      profileDefaults: { deviceId: profile.deviceId, inputId: profile.inputId, useCaseId: profile.useCaseId },
      rulePackId: "desktop-technical-editing",
    },
    frames: [
      { id: "f1", name: "F1", positionOnCanvas: { x: 0, y: 0 }, size: { w: 200, h: 200 }, safeArea: null, background: {}, containerIds: [], componentIds: [] },
    ],
    activeFrameId: "f1",
    containers: {},
    components: {},
    tokens: {},
    libraries: { components, colours: [], icons: [], tokens: [], styles: [] },
    guides: [],
    rulePack: { rulePackId: "desktop-technical-editing", rulePackVersion: 1 },
    findings: [],
    findingsGeneratedAt: "2026-06-01T00:00:00.000Z",
    changeLog: [],
  };
}

const baseEntry: Omit<ComponentLibraryEntry, "id" | "tier"> = {
  name: "x",
  kind: "container",
  archetype: "container-group",
  defaultProps: {},
  defaultSize: { w: 100, h: 24 },
};

describe("v1.1 tier validation rules", () => {
  it("flags an assembly with no aiNote and no intent (suggestion)", () => {
    const pkg = pkgWith([{ ...baseEntry, id: "a1", tier: "assembly", composition: [{ entryId: "c1" }] }]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.assembly-without-ainote.suggestion")).toBe(true);
  });

  it("does not flag an assembly that has aiNote.intent", () => {
    const pkg = pkgWith([
      { ...baseEntry, id: "a1", tier: "assembly", aiNote: { intent: "does a thing" }, composition: [{ entryId: "c1" }] },
    ]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.assembly-without-ainote.suggestion")).toBe(false);
  });

  it("flags an empty assembly (no composition children)", () => {
    const pkg = pkgWith([{ ...baseEntry, id: "a1", tier: "assembly", aiNote: { intent: "x" } }]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.assembly-empty.warning")).toBe(true);
  });

  it("flags a product with no aiNote and no frame (warning)", () => {
    const pkg = pkgWith([{ ...baseEntry, id: "p1", name: "Nowhere Product", tier: "product" }]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.product-without-ainote.warning")).toBe(true);
    expect(findings.some((f) => f.ruleId === "library.product-no-frame.warning")).toBe(true);
  });

  it("does not flag product-no-frame when a Frame demonstrates it by name", () => {
    const pkg = pkgWith([{ ...baseEntry, id: "p1", name: "F1", tier: "product", aiNote: { intent: "x" } }]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.product-no-frame.warning")).toBe(false);
  });

  it("flags a component that carries composition children (tier mismatch)", () => {
    const pkg = pkgWith([{ ...baseEntry, id: "c1", tier: "component", composition: [{ entryId: "x" }] }]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.tier-mismatch.warning")).toBe(true);
  });

  it("flags an assembly nesting another assembly (tier mismatch)", () => {
    const pkg = pkgWith([
      { ...baseEntry, id: "inner", tier: "assembly", aiNote: { intent: "x" }, composition: [{ entryId: "leaf" }] },
      { ...baseEntry, id: "outer", tier: "assembly", aiNote: { intent: "x" }, composition: [{ entryId: "inner" }] },
    ]);
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.tier-mismatch.warning")).toBe(true);
  });

  it("library rules fire once, not per-frame, on a multi-frame package", () => {
    const pkg = pkgWith([{ ...baseEntry, id: "a1", tier: "assembly", aiNote: { intent: "x" } }]);
    pkg.frames.push({ id: "f2", name: "F2", positionOnCanvas: { x: 300, y: 0 }, size: { w: 200, h: 200 }, safeArea: null, background: {}, containerIds: [], componentIds: [] });
    const findings = runValidation(pkg, null, profile);
    const emptyAssembly = findings.filter((f) => f.ruleId === "library.assembly-empty.warning");
    expect(emptyAssembly).toHaveLength(1);
  });
});
