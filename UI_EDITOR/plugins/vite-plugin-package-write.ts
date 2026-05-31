import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs, type Stats } from "node:fs";
import * as path from "node:path";
import {
  isValidPackageId,
  isWritePathAllowed,
  packageIdFromPath,
  PACKAGE_FILE_ALLOWLIST,
} from "../src/core/packageIO/pathPolicy";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const ALLOWED_ORIGINS_DEFAULT = new Set([
  "http://localhost:5174",
  "http://127.0.0.1:5174",
]);

export interface PackageWritePluginOptions {
  packagesDir?: string;
  allowedOrigins?: ReadonlyArray<string>;
}

export function packageWritePlugin(options: PackageWritePluginOptions = {}): Plugin {
  const packagesDir = path.resolve(
    options.packagesDir ?? path.resolve(process.cwd(), "packages"),
  );
  const allowedOrigins = new Set(options.allowedOrigins ?? Array.from(ALLOWED_ORIGINS_DEFAULT));

  return {
    name: "geosee-workbench-package-write",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/package", async (req, res, next) => {
        try {
          await handleRequest(req, res, { packagesDir, allowedOrigins });
        } catch (err) {
          server.config.logger.error(
            `[workbench] plugin error: ${err instanceof Error ? err.message : String(err)}`,
          );
          if (!res.writableEnded) {
            sendJson(res, 500, { ok: false, reason: "internal_error" });
          }
          return next?.(err as Error);
        }
      });
    },
  };
}

interface HandleContext {
  packagesDir: string;
  allowedOrigins: ReadonlySet<string>;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: HandleContext,
): Promise<void> {
  const url = req.url ?? "/";
  if (req.method !== "POST") {
    logRequest(req, url, "—", 0, 0, 405, "method_not_allowed");
    return sendJson(res, 405, { ok: false, reason: "method_not_allowed" });
  }
  if (!checkOrigin(req, ctx.allowedOrigins)) {
    logRequest(req, url, "—", 0, 0, 403, "origin_rejected");
    return sendJson(res, 403, { ok: false, reason: "origin_rejected" });
  }
  const contentType = (req.headers["content-type"] ?? "").split(";")[0]!.trim();
  if (contentType !== "application/json") {
    logRequest(req, url, "—", 0, 0, 415, "unsupported_media_type");
    return sendJson(res, 415, { ok: false, reason: "unsupported_media_type" });
  }
  const raw = await readBody(req);
  if (raw == null) {
    logRequest(req, url, "—", 0, 0, 413, "body_too_large");
    return sendJson(res, 413, { ok: false, reason: "body_too_large" });
  }
  let body: unknown;
  try {
    body = raw.length ? JSON.parse(raw) : {};
  } catch {
    logRequest(req, url, "—", 0, raw.length, 400, "invalid_json");
    return sendJson(res, 400, { ok: false, reason: "invalid_json" });
  }

  if (url.startsWith("/list")) return handleList(req, res, body, ctx);
  if (url.startsWith("/read")) return handleRead(req, res, body, ctx);
  if (url.startsWith("/write")) return handleWrite(req, res, body, ctx);

  logRequest(req, url, "—", 0, raw.length, 404, "endpoint_not_found");
  return sendJson(res, 404, { ok: false, reason: "endpoint_not_found" });
}

async function handleList(
  req: IncomingMessage,
  res: ServerResponse,
  _body: unknown,
  ctx: HandleContext,
): Promise<void> {
  let entries: string[] = [];
  try {
    const items = await fs.readdir(ctx.packagesDir, { withFileTypes: true });
    entries = items
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => isValidPackageId(name));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      entries = [];
    } else {
      throw err;
    }
  }
  logRequest(req, "/api/package/list", "—", entries.length, 0, 200);
  return sendJson(res, 200, { ok: true, packageIds: entries });
}

async function handleRead(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  ctx: HandleContext,
): Promise<void> {
  const packageId = (body as { packageId?: unknown })?.packageId;
  if (!isValidPackageId(packageId)) {
    logRequest(req, "/api/package/read", "?", 0, 0, 400, "invalid_package_id");
    return sendJson(res, 400, { ok: false, reason: "invalid_package_id" });
  }
  const packageDir = path.join(ctx.packagesDir, packageId);
  const files: Record<string, string> = {};
  try {
    await walkPackage(ctx.packagesDir, packageDir, files);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      logRequest(req, "/api/package/read", packageId, 0, 0, 404, "package_not_found");
      return sendJson(res, 404, { ok: false, reason: "package_not_found" });
    }
    throw err;
  }
  logRequest(req, "/api/package/read", packageId, Object.keys(files).length, 0, 200);
  return sendJson(res, 200, { ok: true, packageId, files });
}

async function handleWrite(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  ctx: HandleContext,
): Promise<void> {
  const packageId = (body as { packageId?: unknown })?.packageId;
  const files = (body as { files?: unknown })?.files;
  if (!isValidPackageId(packageId)) {
    logRequest(req, "/api/package/write", "?", 0, 0, 400, "invalid_package_id");
    return sendJson(res, 400, { ok: false, reason: "invalid_package_id" });
  }
  if (typeof files !== "object" || files === null || Array.isArray(files)) {
    logRequest(req, "/api/package/write", packageId, 0, 0, 400, "invalid_files");
    return sendJson(res, 400, { ok: false, reason: "invalid_files" });
  }
  const entries = Object.entries(files as Record<string, unknown>);
  for (const [requestPath, content] of entries) {
    if (typeof content !== "string") {
      logRequest(req, "/api/package/write", packageId, 0, 0, 400, "invalid_content");
      return sendJson(res, 400, { ok: false, reason: "invalid_content", detail: requestPath });
    }
    const policy = isWritePathAllowed(requestPath);
    if (!policy.ok) {
      logRequest(req, "/api/package/write", packageId, 0, 0, 403, policy.reason);
      return sendJson(res, 403, { ok: false, reason: policy.reason, detail: requestPath });
    }
    const inferredPkg = packageIdFromPath(requestPath);
    if (inferredPkg !== packageId) {
      logRequest(req, "/api/package/write", packageId, 0, 0, 403, "path_package_mismatch");
      return sendJson(res, 403, { ok: false, reason: "path_package_mismatch", detail: requestPath });
    }
  }

  const tempPaths: string[] = [];
  const written: string[] = [];
  let totalBytes = 0;
  try {
    for (const [requestPath, content] of entries) {
      const abs = await resolveSafePath(ctx.packagesDir, requestPath);
      const tmp = `${abs}.tmp`;
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const bytes = Buffer.from(content as string, "utf8");
      await fs.writeFile(tmp, bytes);
      tempPaths.push(tmp);
      totalBytes += bytes.length;
    }
    for (let i = 0; i < tempPaths.length; i++) {
      const tmp = tempPaths[i]!;
      const final = tmp.slice(0, -".tmp".length);
      await fs.rename(tmp, final);
      written.push(entries[i]![0]);
    }
    logRequest(req, "/api/package/write", packageId, written.length, totalBytes, 200);
    return sendJson(res, 200, { ok: true, written });
  } catch (err) {
    for (const tmp of tempPaths) {
      try {
        await fs.unlink(tmp);
      } catch {
        // ignore cleanup failures
      }
    }
    logRequest(
      req,
      "/api/package/write",
      packageId,
      0,
      totalBytes,
      500,
      `write_failed:${(err as Error).message}`,
    );
    return sendJson(res, 500, { ok: false, reason: "write_failed", detail: (err as Error).message });
  }
}

async function walkPackage(
  packagesDir: string,
  packageDir: string,
  files: Record<string, string>,
): Promise<void> {
  const queue: string[] = [packageDir];
  while (queue.length) {
    const dir = queue.shift()!;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(packagesDir, abs).split(path.sep).join("/");
      const requestPath = `packages/${rel}`;
      if (!PACKAGE_FILE_ALLOWLIST.test(requestPath)) {
        continue;
      }
      const isBinary = /\.(png|jpg|jpeg|webp|svg)$/.test(requestPath);
      if (isBinary) {
        const buf = await fs.readFile(abs);
        files[requestPath] = buf.toString("base64");
      } else {
        files[requestPath] = await fs.readFile(abs, "utf8");
      }
    }
  }
}

async function resolveSafePath(packagesDir: string, requestPath: string): Promise<string> {
  const rel = requestPath.replace(/^packages\//, "");
  const abs = path.resolve(packagesDir, rel);
  const normalisedRoot = packagesDir.endsWith(path.sep) ? packagesDir : packagesDir + path.sep;
  if (!abs.startsWith(normalisedRoot) && abs !== packagesDir) {
    throw new Error(`Path escapes packages root: ${requestPath}`);
  }
  let stat: Stats | undefined;
  try {
    stat = await fs.lstat(abs);
  } catch {
    stat = undefined;
  }
  if (stat && stat.isSymbolicLink()) {
    throw new Error(`Refusing to write through symlink: ${requestPath}`);
  }
  let parent = path.dirname(abs);
  while (parent && parent !== path.dirname(parent) && parent !== packagesDir) {
    try {
      const ps = await fs.lstat(parent);
      if (ps.isSymbolicLink()) {
        throw new Error(`Parent contains symlink: ${requestPath}`);
      }
    } catch {
      // ignore missing intermediate dirs
    }
    parent = path.dirname(parent);
  }
  return abs;
}

function checkOrigin(req: IncomingMessage, allowed: ReadonlySet<string>): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    // No Origin header: same-origin POST from a tool like curl; permit only on loopback host header.
    const host = (req.headers.host ?? "").toString();
    return /^(localhost|127\.0\.0\.1|\[::1\]):/.test(host) || host.startsWith("localhost") || host.startsWith("127.");
  }
  return allowed.has(origin);
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  return await new Promise<string | null>((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", String(Buffer.byteLength(payload, "utf8")));
  res.end(payload);
}

function logRequest(
  req: IncomingMessage,
  url: string,
  packageId: string,
  files: number,
  bytes: number,
  status: number,
  reason?: string,
): void {
  const ts = new Date().toISOString();
  const tail = reason ? ` ${reason}` : "";
  // eslint-disable-next-line no-console
  console.log(
    `[workbench] ${ts} ${req.method ?? "?"} ${url} pkg=${packageId} files=${files} bytes=${bytes} → ${status}${tail}`,
  );
}
