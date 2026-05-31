import assert from "node:assert/strict";
import {
  effectiveStyleForPage,
  effectiveVisibilityForPage,
  resolveEnvironmentForPage,
} from "../../src/pages/effective";
import type { EnvironmentSetup, PresentationPage } from "../../src/pages/types";

const pose: PresentationPage["camera"] = {
  position: [0, 0, 0],
  target: [0, 0, 0],
  up: [0, 1, 0],
  fov: 45,
};

const globalEnvironment: EnvironmentSetup = {
  id: "environment",
  defaultVisibleLayers: ["global-layer"],
  layerStyles: {
    "shared-layer": { color: "#111111", opacity: 0.1 },
  },
};

const subMasterEnvironment: EnvironmentSetup = {
  id: "environment",
  defaultVisibleLayers: ["master-layer"],
  layerStyles: {
    "shared-layer": { color: "#222222", opacity: 0.8 },
  },
};

const subMaster: PresentationPage = {
  id: "sub-master",
  title: "Sub Master",
  camera: pose,
  transition: { duration: 0, easing: "linear" },
  holdDuration: 0,
  parentMasterId: "global",
  envSnapshot: subMasterEnvironment,
};

const child: PresentationPage = {
  id: "child",
  title: "Child",
  camera: pose,
  transition: { duration: 0, easing: "linear" },
  holdDuration: 0,
  parentMasterId: subMaster.id,
  visibilityOverrides: {
    "global-layer": true,
  },
  layerOverrides: {
    "shared-layer": { opacity: 0.4 },
  },
};

const orphan: PresentationPage = {
  ...child,
  id: "orphan",
  parentMasterId: "missing-master",
};

const pages = [subMaster, child, orphan];

assert.equal(
  resolveEnvironmentForPage(globalEnvironment, pages, subMaster),
  subMasterEnvironment,
);
assert.equal(
  resolveEnvironmentForPage(globalEnvironment, pages, child),
  subMasterEnvironment,
);
assert.equal(
  resolveEnvironmentForPage(globalEnvironment, pages, orphan),
  globalEnvironment,
);

const childVisibility = effectiveVisibilityForPage(
  globalEnvironment,
  pages,
  child,
);
assert.equal(childVisibility.has("master-layer"), true);
assert.equal(childVisibility.has("global-layer"), true);

assert.deepEqual(
  effectiveStyleForPage(globalEnvironment, pages, child, "shared-layer"),
  { color: "#222222", opacity: 0.4 },
);
