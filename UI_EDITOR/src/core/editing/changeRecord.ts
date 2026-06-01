import type { ChangeRecord, ChangeRecordKind } from "../schema/changeLog";
import type { Package } from "../schema/package";
import { newId } from "../util/ids";

export interface BuildChangeRecordInput {
  kind: ChangeRecordKind;
  summary: string;
  pkg: Package;
  affected?: ChangeRecord["affected"];
  rationale?: string;
}

export function buildChangeRecord(input: BuildChangeRecordInput): ChangeRecord {
  return {
    id: `cr-${newId()}`,
    timestamp: new Date().toISOString(),
    kind: input.kind,
    packageStateBefore: input.pkg.manifest.packageState,
    packageStateAfter: input.pkg.manifest.packageState,
    affected: input.affected ?? {},
    summary: input.summary,
    rationale: input.rationale,
    editClass: "schema",
  };
}
