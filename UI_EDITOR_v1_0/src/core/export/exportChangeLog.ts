import type { Package } from "../schema/package";
import { canonicalStringify } from "../packageIO/canonicalJson";

export function exportChangeLog(pkg: Package): string {
  return canonicalStringify({
    schemaVersion: 1 as const,
    records: pkg.changeLog,
  });
}
