import type { Package } from "../schema/package";
import { exportSpec } from "./exportSpec";
import { exportAiAgentBrief } from "./exportAiAgentBrief";
import { exportValidationReport } from "./exportValidationReport";
import { exportChangeLog } from "./exportChangeLog";
import { serialisePackageFiles } from "../packageIO/writePackage";
import { clientWritePackage } from "../packageIO/packageWriteClient";

export interface ExportResult {
  ok: boolean;
  written: string[];
  reason?: string;
}

export function buildExportFiles(pkg: Package): Record<string, string> {
  const base = `packages/${pkg.manifest.id}`;
  const updatedPkg: Package = {
    ...pkg,
    manifest: {
      ...pkg.manifest,
      updatedAt: new Date().toISOString(),
      packageState:
        pkg.manifest.packageState === "Draft" &&
        !pkg.findings.some((f) => f.severity === "blocker" || (f.severity === "error" && !f.acknowledged))
          ? "Validated"
          : pkg.manifest.packageState,
    },
  };
  const files = serialisePackageFiles(updatedPkg);
  files[`${base}/docs/spec.md`] = exportSpec(updatedPkg);
  files[`${base}/docs/ai_agent_brief.md`] = exportAiAgentBrief(updatedPkg);
  files[`${base}/validation/findings.json`] = exportValidationReport(updatedPkg);
  files[`${base}/change_log.json`] = exportChangeLog(updatedPkg);
  return files;
}

export async function exportPackage(pkg: Package): Promise<ExportResult> {
  const files = buildExportFiles(pkg);
  const res = await clientWritePackage(pkg.manifest.id, files);
  return { ok: res.ok, written: res.written ?? [], reason: res.reason };
}
