import { describe, expect, it } from "vitest";
import { canonicalStringify } from "../canonicalJson";
import { parsePackageFromFiles } from "../readPackage";
import { serialisePackageFiles } from "../writePackage";
import type { Package } from "../../schema/package";

function makeSyntheticPackage(): Package {
  return {
    manifest: {
      author: "test",
      createdAt: "2026-05-31T00:00:00.000Z",
      id: "test_pkg",
      name: "Test package",
      packageState: "Draft",
      profileDefaults: {
        deviceId: "desktop-1080p",
        inputId: "mouse-keyboard",
        useCaseId: "technical-editing",
      },
      rulePackId: "desktop-technical-editing",
      schemaVersion: 1,
      targetHostApp: { name: "geosee" },
      updatedAt: "2026-05-31T00:00:00.000Z",
      workbenchVersion: "1.0.0",
    },
    frames: [],
    activeFrameId: null,
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

describe("canonicalStringify", () => {
  it("sorts keys alphabetically", () => {
    const out = canonicalStringify({ z: 1, a: 2, m: 3 });
    expect(out).toContain('"a": 2');
    const aIdx = out.indexOf('"a"');
    const mIdx = out.indexOf('"m"');
    const zIdx = out.indexOf('"z"');
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  it("strips trailing zeros from decimals", () => {
    const out = canonicalStringify({ v: 1.5 });
    expect(out).toContain('"v": 1.5');
  });

  it("emits trailing newline", () => {
    expect(canonicalStringify({})).toBe("{}\n");
  });
});

describe("package round-trip", () => {
  it("export-then-import produces byte-identical canonical files", () => {
    const pkg = makeSyntheticPackage();
    const filesA = serialisePackageFiles(pkg);
    const parsed = parsePackageFromFiles(filesA);
    const filesB = serialisePackageFiles(parsed);
    expect(Object.keys(filesB).sort()).toEqual(Object.keys(filesA).sort());
    for (const key of Object.keys(filesA)) {
      expect(filesB[key]).toBe(filesA[key]);
    }
  });

  it("readPackage rejects an unsupported schemaVersion", () => {
    const pkg = makeSyntheticPackage();
    const files = serialisePackageFiles(pkg);
    const badManifest = JSON.parse(files["packages/test_pkg/manifest.json"]!);
    badManifest.schemaVersion = 2;
    files["packages/test_pkg/manifest.json"] = JSON.stringify(badManifest);
    expect(() => parsePackageFromFiles(files)).toThrow(/unsupported_schema_version/);
  });

  it("readPackage rejects a missing required manifest field", () => {
    const pkg = makeSyntheticPackage();
    const files = serialisePackageFiles(pkg);
    const badManifest = JSON.parse(files["packages/test_pkg/manifest.json"]!);
    delete badManifest.id;
    files["packages/test_pkg/manifest.json"] = JSON.stringify(badManifest);
    expect(() => parsePackageFromFiles(files)).toThrow(/manifest_missing_field/);
  });
});
