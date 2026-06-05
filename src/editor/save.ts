// Thin wrappers over the dev /api/* endpoints. All paths are project-root
// relative and start with "projects/".
import { appAssetUrl } from "../projects/projectPathsRuntime";

interface WriteOpts {
  encoding?: "utf8" | "base64";
  expectedContent?: string | null;
}

export interface BatchWriteFile {
  path: string;
  content: string;
  encoding?: WriteOpts["encoding"];
  expectedContent?: string | null;
}

export async function writeFile(
  path: string,
  content: string,
  opts: WriteOpts = {},
): Promise<void> {
  const res = await fetch("/api/write-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path,
      content,
      encoding: opts.encoding ?? "utf8",
      expectedContent: opts.expectedContent,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`writeFile ${path}: ${err.error ?? res.statusText}`);
  }
}

export async function writeFilesBatch(
  files: BatchWriteFile[],
): Promise<void> {
  if (files.length === 0) return;
  const res = await fetch("/api/write-batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`writeFilesBatch: ${err.error ?? res.statusText}`);
  }
}

export async function readFile(path: string): Promise<string | null> {
  const res = await fetch("/api/read-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const staticRes = await fetch(appAssetUrl(path), { cache: "no-store" });
    if (staticRes.status === 404) return null;
    if (staticRes.ok) return staticRes.text();
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`readFile ${path}: ${err.error ?? res.statusText}`);
  }
  const body = (await res.json()) as { content: string | null };
  return body.content;
}

export async function copyFile(from: string, to: string): Promise<void> {
  const res = await fetch("/api/copy-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`copyFile ${from} -> ${to}: ${err.error ?? res.statusText}`);
  }
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch("/api/delete-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`deleteFile ${path}: ${err.error ?? res.statusText}`);
  }
}

export async function convertBrandingAsset(opts: {
  sourcePath: string;
  outputPath: string;
  sourceFormat: string;
}): Promise<{ outputPath: string }> {
  const res = await fetch("/api/convert-branding-asset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      `convertBrandingAsset ${opts.sourcePath}: ${err.error ?? res.statusText}`,
    );
  }
  return (await res.json()) as { outputPath: string };
}

export const PROJECT_ROOT = "projects/woodjam";
export const projectJsonPath = (projectRoot = PROJECT_ROOT) =>
  `${projectRoot}/project.json`;
export const environmentJsonPath = (projectRoot = PROJECT_ROOT) =>
  `${projectRoot}/environment.json`;
export const pageJsonPath = (id: string, projectRoot = PROJECT_ROOT) =>
  `${projectRoot}/pages/${id}.json`;
export const pageArchivePath = (id: string, projectRoot = PROJECT_ROOT) =>
  `${projectRoot}/pages/_archive/${id}.json`;
export const overlayMarkdownPath = (id: string, projectRoot = PROJECT_ROOT) =>
  `${projectRoot}/overlays/${id}/text.md`;
export const overlayImagePath = (
  id: string,
  fileName: string,
  projectRoot = PROJECT_ROOT,
) => `${projectRoot}/overlays/${id}/${fileName}`;
