import type { Package } from "../schema/package";
import { canonicalStringify } from "../packageIO/canonicalJson";

export function exportValidationReport(pkg: Package): string {
  const report = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    rulePackId: pkg.rulePack.rulePackId,
    rulePackVersion: pkg.rulePack.rulePackVersion,
    findings: pkg.findings,
  };
  return canonicalStringify(report);
}
