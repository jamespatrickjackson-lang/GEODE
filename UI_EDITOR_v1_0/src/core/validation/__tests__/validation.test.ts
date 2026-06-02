import { describe, expect, it } from "vitest";
import { runValidation } from "../runValidation";
import type { Package } from "../../schema/package";
import type { ProfileSelection } from "../../schema/profiles";

const profile: ProfileSelection = {
  deviceId: "desktop-1080p",
  inputId: "mouse-keyboard",
  useCaseId: "technical-editing",
};

function basePkg(): Package {
  return {
    manifest: {
      id: "test_pkg",
      name: "Test",
      schemaVersion: 1,
      workbenchVersion: "1.0.0",
      packageState: "Draft",
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z",
      targetHostApp: { name: "geosee" },
      profileDefaults: { deviceId: profile.deviceId, inputId: profile.inputId, useCaseId: profile.useCaseId },
      rulePackId: "desktop-technical-editing",
    },
    frames: [
      {
        id: "f1",
        name: "F1",
        positionOnCanvas: { x: 0, y: 0 },
        size: { w: 200, h: 200 },
        safeArea: null,
        background: {},
        containerIds: [],
        componentIds: [],
      },
    ],
    activeFrameId: "f1",
    containers: {},
    components: {},
    tokens: {},
    libraries: { components: [], colours: [], icons: [], tokens: [], styles: [] },
    guides: [],
    rulePack: { rulePackId: "desktop-technical-editing", rulePackVersion: 1 },
    findings: [],
    findingsGeneratedAt: "2026-05-31T00:00:00.000Z",
    changeLog: [],
  };
}

describe("runValidation", () => {
  it("empty package yields no findings", () => {
    const pkg = basePkg();
    pkg.frames = [];
    pkg.activeFrameId = null;
    expect(runValidation(pkg, null, profile)).toEqual([]);
  });

  it("touch target rule fires for tiny clickable component", () => {
    const pkg = basePkg();
    pkg.components["c1"] = {
      id: "c1",
      archetype: "icon-button",
      name: "Tiny",
      frameId: "f1",
      parentId: null,
      rect: { x: 0, y: 0, w: 6, h: 6 },
      constraints: { horizontal: "left", vertical: "left" },
      locked: false,
      hidden: false,
      props: { archetype: "icon-button", iconLibraryEntryId: "icon-add", ariaLabel: "x", surface: "dark", size: 20 },
    };
    pkg.frames[0]!.componentIds = ["c1"];
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "component.touch-target-min")).toBe(true);
  });

  it("button with empty label yields a Warning", () => {
    const pkg = basePkg();
    pkg.components["c1"] = {
      id: "c1",
      archetype: "pill-button",
      name: "Pill",
      frameId: "f1",
      parentId: null,
      rect: { x: 0, y: 0, w: 80, h: 28 },
      constraints: { horizontal: "left", vertical: "left" },
      locked: false,
      hidden: false,
      props: { archetype: "pill-button", label: "", surface: "dark" },
    };
    pkg.frames[0]!.componentIds = ["c1"];
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "component.button.label-non-empty" && f.severity === "warning")).toBe(true);
  });

  it("element wholly outside frame yields a blocker", () => {
    const pkg = basePkg();
    pkg.components["c1"] = {
      id: "c1",
      archetype: "text",
      name: "outside",
      frameId: "f1",
      parentId: null,
      rect: { x: 1000, y: 1000, w: 10, h: 10 },
      constraints: { horizontal: "left", vertical: "left" },
      locked: false,
      hidden: false,
      props: { archetype: "text", value: "x", fontSize: 13 },
    };
    pkg.frames[0]!.componentIds = ["c1"];
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "layout.element-outside-frame.blocker")).toBe(true);
  });

  it("unresolved tokenRef yields a Warning", () => {
    const pkg = basePkg();
    pkg.components["c1"] = {
      id: "c1",
      archetype: "text",
      name: "ref",
      frameId: "f1",
      parentId: null,
      rect: { x: 0, y: 0, w: 100, h: 16 },
      constraints: { horizontal: "left", vertical: "left" },
      locked: false,
      hidden: false,
      props: { archetype: "text", value: "x", fontSize: { tokenRef: "space.does-not-exist" } },
    };
    pkg.frames[0]!.componentIds = ["c1"];
    const findings = runValidation(pkg, null, profile);
    expect(findings.some((f) => f.ruleId === "library.unresolved-token-ref" && f.severity === "warning")).toBe(true);
  });

  it("findings sort with worst severity first", () => {
    const pkg = basePkg();
    pkg.components["c1"] = {
      id: "c1",
      archetype: "icon-button",
      name: "tiny",
      frameId: "f1",
      parentId: null,
      rect: { x: 0, y: 0, w: 6, h: 6 },
      constraints: { horizontal: "left", vertical: "left" },
      locked: false,
      hidden: false,
      props: { archetype: "icon-button", iconLibraryEntryId: "icon-add", ariaLabel: "x", surface: "dark", size: 20 },
    };
    pkg.components["c2"] = {
      id: "c2",
      archetype: "text",
      name: "out",
      frameId: "f1",
      parentId: null,
      rect: { x: 1000, y: 1000, w: 10, h: 10 },
      constraints: { horizontal: "left", vertical: "left" },
      locked: false,
      hidden: false,
      props: { archetype: "text", value: "x", fontSize: 13 },
    };
    pkg.frames[0]!.componentIds = ["c1", "c2"];
    const findings = runValidation(pkg, null, profile);
    expect(findings[0]!.severity).toBe("blocker");
  });
});
