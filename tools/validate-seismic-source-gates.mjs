import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  ROOT,
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json",
);

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const gates = Array.isArray(manifest.requiredLineSourceGates)
  ? manifest.requiredLineSourceGates
  : [];

const blockingGates = gates.filter(
  (gate) =>
    gate?.required === true &&
    (gate.status === "missing-source" ||
      gate.status === "source-present-not-generated"),
);

if (blockingGates.length > 0) {
  for (const gate of blockingGates) {
    console.error(
      [
        `Missing required seismic source for ${gate.lineLabel ?? gate.lineId}.`,
        `status=${gate.status}`,
        `productIds=${JSON.stringify(gate.productIds ?? [])}`,
        `searchedRoots=${JSON.stringify(gate.searchedRoots ?? [])}`,
        gate.reason ? `reason=${gate.reason}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${gates.length} required seismic source gates.`);
}
