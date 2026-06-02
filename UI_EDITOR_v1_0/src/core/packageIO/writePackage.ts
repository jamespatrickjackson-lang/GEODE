import type { Package, PackageFiles } from "../schema/package";
import { canonicalStringify } from "./canonicalJson";
import { packageFilesFromPackage } from "./readPackage";
import { clientWritePackage } from "./packageWriteClient";

export interface WritePackageResult {
  ok: boolean;
  written: string[];
  reason?: string;
}

export async function writePackage(pkg: Package): Promise<WritePackageResult> {
  const files = serialisePackageFiles(pkg);
  const res = await clientWritePackage(pkg.manifest.id, files);
  return { ok: res.ok, written: res.written ?? [], reason: res.reason };
}

export function serialisePackageFiles(pkg: Package): Record<string, string> {
  const files: PackageFiles = packageFilesFromPackage(pkg);
  const out: Record<string, string> = {};
  const base = `packages/${pkg.manifest.id}`;
  out[`${base}/manifest.json`] = canonicalStringify(files.manifest);
  out[`${base}/frames.json`] = canonicalStringify(files.frames);
  out[`${base}/containers.json`] = canonicalStringify(files.containers);
  out[`${base}/components.json`] = canonicalStringify(files.components);
  out[`${base}/tokens.json`] = canonicalStringify(files.tokens);
  out[`${base}/libraries.json`] = canonicalStringify(files.libraries);
  out[`${base}/guides.json`] = canonicalStringify(files.guides);
  out[`${base}/validation/rule_pack.json`] = canonicalStringify(files.rulePack);
  out[`${base}/validation/findings.json`] = canonicalStringify(files.findings);
  out[`${base}/change_log.json`] = canonicalStringify(files.changeLog);
  return out;
}
