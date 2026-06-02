import { describe, expect, it } from "vitest";
import { exportSpec } from "../exportSpec";
import { exportAiAgentBrief } from "../exportAiAgentBrief";
import type { Package } from "../../schema/package";

function pkg(): Package {
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
        name: "Frame 1",
        positionOnCanvas: { x: 0, y: 0 },
        size: { w: 320, h: 900 },
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
        props: { archetype: "pill-button", label: "Save", surface: "dark" },
        intent: { name: "Save button", intent: "Persists pending edits.", authorNotes: "secret" },
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

describe("exportSpec", () => {
  it("lists every frame and every component", () => {
    const md = exportSpec(pkg());
    expect(md).toContain("# Test — Implementation Brief");
    expect(md).toContain("Frame 1");
    expect(md).toContain("`cmp1`");
    expect(md).toContain("pill-button");
  });

  it("renders author notes in spec.md", () => {
    const md = exportSpec(pkg());
    expect(md).toContain("Author notes: secret");
  });
});

describe("exportAiAgentBrief", () => {
  it("includes the intent block per element", () => {
    const brief = exportAiAgentBrief(pkg());
    expect(brief).toContain("Implement this element with the following intent");
    expect(brief).toContain("Persists pending edits.");
  });

  it("omits authorNotes from the brief", () => {
    const brief = exportAiAgentBrief(pkg());
    expect(brief.includes("secret")).toBe(false);
  });

  it("includeIntent: false suppresses intent blocks", () => {
    const brief = exportAiAgentBrief(pkg(), { includeIntent: false });
    expect(brief.includes("Implement this element with the following intent")).toBe(false);
  });
});
