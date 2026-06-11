import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  ROOT,
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json",
);

export function isAuditedMissingSourceGate(gate) {
  return (
    gate?.required === true &&
    gate.status === "missing-source" &&
    Array.isArray(gate.productIds) &&
    gate.productIds.length === 0 &&
    Array.isArray(gate.searchedRoots) &&
    gate.searchedRoots.length > 0
  );
}

export function isBlockingRequiredSourceGate(gate) {
  if (gate?.required !== true) return false;
  if (gate.status === "source-present-not-generated") return true;
  if (gate.status !== "missing-source") return false;
  return !isAuditedMissingSourceGate(gate);
}

export function validateSeismicSourceGates(manifest) {
  const gates = Array.isArray(manifest.requiredLineSourceGates)
    ? manifest.requiredLineSourceGates
    : [];
  return {
    gates,
    blockingGates: gates.filter(isBlockingRequiredSourceGate),
  };
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const { gates, blockingGates } = validateSeismicSourceGates(manifest);

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
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
