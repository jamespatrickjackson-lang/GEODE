import { describe, expect, it } from "vitest";
import { applyEdit } from "../applyEdit";
import type { Package } from "../../schema/package";

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
      profileDefaults: { deviceId: "desktop-1080p", inputId: "mouse-keyboard", useCaseId: "technical-editing" },
      rulePackId: "desktop-technical-editing",
    },
    frames: [
      {
        id: "f1",
        name: "F1",
        positionOnCanvas: { x: 0, y: 0 },
        size: { w: 400, h: 400 },
        safeArea: null,
        background: {},
        containerIds: [],
        componentIds: ["cmp1"],
      },
    ],
    activeFrameId: "f1",
    containers: {},
    components: {
      cmp1: {
        id: "cmp1",
        archetype: "pill-button",
        name: "Btn",
        frameId: "f1",
        parentId: null,
        rect: { x: 10, y: 10, w: 80, h: 28 },
        constraints: { horizontal: "left", vertical: "left" },
        locked: false,
        hidden: false,
        props: { archetype: "pill-button", label: "Hello", surface: "dark" },
      },
    },
    tokens: {},
    libraries: { components: [], colours: [], icons: [], tokens: [], styles: [] },
    guides: [],
    rulePack: { rulePackId: "desktop-technical-editing", rulePackVersion: 1 },
    findings: [],
    findingsGeneratedAt: "2026-05-31T00:00:00.000Z",
    changeLog: [],
  };
}

describe("applyEdit", () => {
  it("MOVE appends one Change Record", () => {
    const pkg = basePkg();
    const result = applyEdit(pkg, { type: "MOVE", targets: [{ kind: "component", id: "cmp1", rect: { x: 50, y: 30, w: 80, h: 28 } }] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pkg.components["cmp1"]!.rect.x).toBe(50);
      expect(result.pkg.changeLog).toHaveLength(1);
      expect(result.editClass).toBe("schema");
    }
  });

  it("RESIZE updates rect + appends record", () => {
    const pkg = basePkg();
    const result = applyEdit(pkg, { type: "RESIZE", targetKind: "component", targetId: "cmp1", rect: { x: 10, y: 10, w: 120, h: 28 } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pkg.components["cmp1"]!.rect.w).toBe(120);
  });

  it("PROPERTY_CHANGED writes nested path", () => {
    const pkg = basePkg();
    const result = applyEdit(pkg, {
      type: "PROPERTY_CHANGED",
      targetKind: "component",
      targetId: "cmp1",
      propertyPath: "label",
      value: "Save",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.pkg.components["cmp1"]!.props as { label: string }).label).toBe("Save");
    }
  });

  it("refuses edit on a locked element with a blocker finding", () => {
    const pkg = basePkg();
    pkg.components["cmp1"]!.locked = true;
    const result = applyEdit(pkg, { type: "MOVE", targets: [{ kind: "component", id: "cmp1", rect: { x: 50, y: 30, w: 80, h: 28 } }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]!.severity).toBe("blocker");
      expect(result.findings[0]!.ruleId).toBe("restricted.locked-property-mutated.blocker");
    }
  });

  it("refuses archetype mutation", () => {
    const pkg = basePkg();
    const result = applyEdit(pkg, {
      type: "PROPERTY_CHANGED",
      targetKind: "component",
      targetId: "cmp1",
      propertyPath: "archetype",
      value: "slider",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings.some((f) => f.ruleId === "restricted.archetype-mutated.blocker")).toBe(true);
    }
  });

  it("INTENT_EDITED stores intent annotation", () => {
    const pkg = basePkg();
    const result = applyEdit(pkg, {
      type: "INTENT_EDITED",
      targetKind: "component",
      targetId: "cmp1",
      patch: { name: "Save button", intent: "Persists changes." },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pkg.components["cmp1"]!.intent?.intent).toBe("Persists changes.");
    }
  });
});
