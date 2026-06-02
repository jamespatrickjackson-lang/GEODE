import { describe, expect, it } from "vitest";
import { GeoSeeAdapterStub } from "../geoSeeAdapter.stub";

const EXPECTED = /not implemented in v1/;

describe("GeoSeeAdapterStub", () => {
  const stub = new GeoSeeAdapterStub();

  it("throws on every method", () => {
    expect(() => stub.listEditableSurfaces()).toThrow(EXPECTED);
    expect(() => stub.componentMappings()).toThrow(EXPECTED);
    expect(() => stub.loadProjectOverrides()).toThrow(EXPECTED);
    expect(() => stub.saveProjectOverride()).toThrow(EXPECTED);
    expect(() => stub.hostValidationRules()).toThrow(EXPECTED);
    expect(() => stub.saveDraft()).toThrow(EXPECTED);
    expect(() => stub.applyToHost()).toThrow(EXPECTED);
    expect(() => stub.permissions()).toThrow(EXPECTED);
    expect(() => stub.changeLogSink()).toThrow(EXPECTED);
  });
});
