import type {
  Package,
  PackageFiles,
  PackageManifest,
} from "../schema/package";
import type { ChangeLogFile } from "../schema/changeLog";
import type { ComponentsFile } from "../schema/component";
import type { ContainersFile } from "../schema/container";
import type { FindingsFile, RulePackFile } from "../schema/validation";
import type { FramesFile } from "../schema/frame";
import type { GuidesFile } from "../schema/guide";
import type { LibrariesFile } from "../schema/library";
import type { TokensFile } from "../schema/tokens";
import { clientReadPackage } from "./packageWriteClient";

export interface ReadPackageError {
  kind: "ReadPackageError";
  reason: string;
  detail?: unknown;
}

export class PackageLoadError extends Error {
  constructor(public readonly detail: ReadPackageError) {
    super(`${detail.reason}`);
    this.name = "PackageLoadError";
  }
}

export async function readPackage(packageId: string): Promise<Package> {
  const { files } = await clientReadPackage(packageId);
  return parsePackageFromFiles(files);
}

const REQUIRED_FILES = [
  "manifest.json",
  "frames.json",
  "containers.json",
  "components.json",
  "tokens.json",
  "libraries.json",
  "guides.json",
  "validation/rule_pack.json",
  "validation/findings.json",
  "change_log.json",
] as const;

export function parsePackageFromFiles(filesByPath: Record<string, string>): Package {
  const stripped: Record<string, string> = {};
  for (const [k, v] of Object.entries(filesByPath)) {
    const strippedKey = k.replace(/^packages\/[a-z0-9_]+\//, "");
    stripped[strippedKey] = v;
  }
  for (const required of REQUIRED_FILES) {
    if (!(required in stripped)) {
      throw new PackageLoadError({
        kind: "ReadPackageError",
        reason: `missing_required_file:${required}`,
      });
    }
  }
  const manifest = parseJson<PackageManifest>(stripped["manifest.json"]!, "manifest.json");
  assertSchemaVersion(manifest.schemaVersion, "manifest");
  assertManifestRequired(manifest);

  const frames = parseJson<FramesFile>(stripped["frames.json"]!, "frames.json");
  assertSchemaVersion(frames.schemaVersion, "frames");

  const containers = parseJson<ContainersFile>(stripped["containers.json"]!, "containers.json");
  assertSchemaVersion(containers.schemaVersion, "containers");

  const components = parseJson<ComponentsFile>(stripped["components.json"]!, "components.json");
  assertSchemaVersion(components.schemaVersion, "components");

  const tokens = parseJson<TokensFile>(stripped["tokens.json"]!, "tokens.json");
  assertSchemaVersion(tokens.schemaVersion, "tokens");

  const libraries = parseJson<LibrariesFile>(stripped["libraries.json"]!, "libraries.json");
  assertSchemaVersion(libraries.schemaVersion, "libraries");

  const guides = parseJson<GuidesFile>(stripped["guides.json"]!, "guides.json");
  assertSchemaVersion(guides.schemaVersion, "guides");

  const rulePack = parseJson<RulePackFile>(
    stripped["validation/rule_pack.json"]!,
    "validation/rule_pack.json",
  );
  assertSchemaVersion(rulePack.schemaVersion, "rulePack");

  const findings = parseJson<FindingsFile>(
    stripped["validation/findings.json"]!,
    "validation/findings.json",
  );
  assertSchemaVersion(findings.schemaVersion, "findings");

  const changeLog = parseJson<ChangeLogFile>(stripped["change_log.json"]!, "change_log.json");
  assertSchemaVersion(changeLog.schemaVersion, "changeLog");

  return {
    manifest,
    frames: frames.frames,
    activeFrameId: frames.activeFrameId,
    containers: containers.containers,
    components: components.components,
    tokens: tokens.tokens,
    libraries: libraries.libraries,
    guides: guides.guides,
    rulePack: {
      rulePackId: rulePack.rulePackId,
      rulePackVersion: rulePack.rulePackVersion,
      configOverrides: rulePack.configOverrides,
    },
    findings: findings.findings,
    findingsGeneratedAt: findings.generatedAt,
    changeLog: changeLog.records,
  };
}

export function packageFilesFromPackage(pkg: Package): PackageFiles {
  return {
    manifest: pkg.manifest,
    frames: { schemaVersion: 1, frames: pkg.frames, activeFrameId: pkg.activeFrameId },
    containers: { schemaVersion: 1, containers: pkg.containers },
    components: { schemaVersion: 1, components: pkg.components },
    tokens: { schemaVersion: 1, tokens: pkg.tokens },
    libraries: { schemaVersion: 1, libraries: pkg.libraries },
    guides: { schemaVersion: 1, guides: pkg.guides },
    rulePack: {
      schemaVersion: 1,
      rulePackId: pkg.rulePack.rulePackId,
      rulePackVersion: pkg.rulePack.rulePackVersion,
      configOverrides: pkg.rulePack.configOverrides,
    },
    findings: {
      schemaVersion: 1,
      generatedAt: pkg.findingsGeneratedAt,
      rulePackId: pkg.rulePack.rulePackId,
      rulePackVersion: pkg.rulePack.rulePackVersion,
      findings: pkg.findings,
    },
    changeLog: { schemaVersion: 1, records: pkg.changeLog },
  };
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new PackageLoadError({
      kind: "ReadPackageError",
      reason: `invalid_json:${label}`,
      detail: String(err),
    });
  }
}

function assertSchemaVersion(version: unknown, label: string): void {
  if (version !== 1) {
    throw new PackageLoadError({
      kind: "ReadPackageError",
      reason: `unsupported_schema_version:${label}`,
      detail: { observed: version, supported: 1 },
    });
  }
}

function assertManifestRequired(manifest: PackageManifest): void {
  const required: Array<keyof PackageManifest> = [
    "id",
    "name",
    "schemaVersion",
    "workbenchVersion",
    "packageState",
    "createdAt",
    "updatedAt",
    "targetHostApp",
    "profileDefaults",
    "rulePackId",
  ];
  for (const field of required) {
    if (manifest[field] === undefined || manifest[field] === null) {
      throw new PackageLoadError({
        kind: "ReadPackageError",
        reason: `manifest_missing_field:${String(field)}`,
      });
    }
  }
}
