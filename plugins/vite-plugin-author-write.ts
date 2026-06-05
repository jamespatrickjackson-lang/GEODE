import type { Plugin, ViteDevServer } from "vite";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, isAbsolute, normalize, posix, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

// Dev-only authoring write endpoint. Decision #022.
//
// Three endpoints, all under /api/:
//   POST /api/write-file   { path, content, encoding? }  -> 204
//   POST /api/write-batch  { files: [{ path, content, encoding? }] } -> 204
//   POST /api/read-file    { path }                       -> 200 with content
//   POST /api/copy-file    { from, to }                    -> 204
//   POST /api/delete-file  { path }                       -> 204
//
// path is project-root-relative. Hard validation:
//   - reject absolute paths
//   - reject any segment ".." or that resolves outside projects/
//   - reject existing symlinks (defense-in-depth: lstat before any write)
//   - reject existing non-regular-file (directories, sockets, etc.)
//
// This plugin runs only in dev. `vite build` does NOT include it, so the
// shipped static artifact has no write capability. End clients cannot reach
// these endpoints because they only ever see the published build.

const ALLOWED_PREFIX = "projects/";

interface WriteBody {
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
  expectedContent?: string | null;
}

interface WriteBatchBody {
  files: WriteBody[];
}

interface ReadBody {
  path: string;
}

interface CopyBody {
  from: string;
  to: string;
}

interface DeleteBody {
  path: string;
}

interface ConvertBrandingAssetBody {
  sourcePath: string;
  outputPath: string;
  sourceFormat?: string;
}

function badRequest(res: ServerResponse, msg: string, status = 400) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: msg }));
}

function ok(res: ServerResponse, body?: unknown) {
  if (body === undefined) {
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
}

/**
 * Validate a project-relative path and return its absolute resolution.
 * Throws on any rule violation.
 */
function resolveSafePath(projectRoot: string, requested: string): string {
  if (typeof requested !== "string" || requested.length === 0) {
    throw new Error("path required");
  }
  if (isAbsolute(requested)) {
    throw new Error("path must be relative to project root");
  }
  // Normalize both with POSIX semantics (the API contract uses forward
  // slashes) before checking the prefix.
  const posixNormalized = posix.normalize(requested.replace(/\\/g, "/"));
  if (posixNormalized.startsWith("..") || posixNormalized.includes("/../")) {
    throw new Error("path escapes project root");
  }
  if (!posixNormalized.startsWith(ALLOWED_PREFIX)) {
    throw new Error(`path must start with "${ALLOWED_PREFIX}"`);
  }

  // Convert to OS-native form for fs operations.
  const native = normalize(posixNormalized);
  const absolute = resolve(projectRoot, native);

  // Final containment check: the resolved absolute path must still live
  // inside the project root + allowed prefix. Guards against rare cases
  // where path manipulation slips past earlier checks (e.g. via Unicode
  // tricks the normalizer doesn't catch).
  const allowedRoot = resolve(projectRoot, ALLOWED_PREFIX);
  if (!absolute.startsWith(allowedRoot + sep) && absolute !== allowedRoot) {
    throw new Error("resolved path escapes projects/");
  }
  return absolute;
}

/**
 * If the path exists, refuse to operate on it unless it is a regular file.
 * Symlinks, directories, FIFOs, and sockets are all rejected here.
 */
async function refuseUnlessRegularOrMissing(absolute: string): Promise<void> {
  try {
    const st = await fs.lstat(absolute);
    if (!st.isFile()) {
      throw new Error(
        `refusing to write: existing path is not a regular file ` +
          `(symlink/dir/etc): ${absolute}`,
      );
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return; // OK -- new file
    throw e;
  }
}

async function readExpectedComparableContent(
  absolute: string,
): Promise<string | null> {
  try {
    await refuseUnlessRegularOrMissing(absolute);
    return await fs.readFile(absolute, "utf8");
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function assertExpectedContent(
  requestedPath: string,
  absolute: string,
  expectedContent: string | null | undefined,
): Promise<void> {
  if (expectedContent === undefined) return;
  const currentContent = await readExpectedComparableContent(absolute);
  if (currentContent !== expectedContent) {
    throw new Error(
      `write conflict: ${requestedPath} changed on disk since the editor loaded it; reload the project before saving.`,
    );
  }
}

async function runAssetTool(
  command: string,
  args: string[],
): Promise<void> {
  const result = await new Promise<{
    code: number | null;
    error?: NodeJS.ErrnoException;
    stderr: string;
  }>((resolveRun) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      resolveRun({ code: null, error, stderr });
    });
    child.on("close", (code) => {
      resolveRun({ code, stderr });
    });
  });

  if (result.error) {
    throw new Error(
      `${command} unavailable: ${result.error.message || result.error.code}`,
    );
  }
  if (result.code !== 0) {
    throw new Error(
      `${command} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }
}

async function convertBrandingAsset(
  projectRoot: string,
  body: ConvertBrandingAssetBody,
): Promise<{ outputPath: string }> {
  const sourceAbs = resolveSafePath(projectRoot, body.sourcePath);
  const outputAbs = resolveSafePath(projectRoot, body.outputPath);
  const sourceStats = await fs.lstat(sourceAbs);
  if (!sourceStats.isFile()) throw new Error("sourcePath is not a regular file");
  await refuseUnlessRegularOrMissing(outputAbs);
  await fs.mkdir(dirname(outputAbs), { recursive: true });

  const sourceFormat =
    (typeof body.sourceFormat === "string" ? body.sourceFormat : "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "") ||
    (sourceAbs.toLowerCase().endsWith(".eps")
      ? "eps"
      : sourceAbs.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : "");
  if (!outputAbs.toLowerCase().endsWith(".png")) {
    throw new Error("outputPath must be a .png file");
  }

  await fs.rm(outputAbs, { force: true });
  if (sourceFormat === "pdf") {
    const prefix = outputAbs.slice(0, -4);
    await runAssetTool("pdftoppm", [
      "-f",
      "1",
      "-l",
      "1",
      "-png",
      "-singlefile",
      sourceAbs,
      prefix,
    ]);
  } else if (sourceFormat === "eps") {
    await runAssetTool("magick", [
      "-density",
      "300",
      sourceAbs,
      "-background",
      "none",
      "-alpha",
      "on",
      outputAbs,
    ]);
  } else {
    throw new Error("sourceFormat must be pdf or eps");
  }

  const outputStats = await fs.lstat(outputAbs).catch(() => null);
  if (!outputStats?.isFile()) {
    throw new Error("conversion completed but did not create output");
  }
  return { outputPath: body.outputPath };
}

export function authorWritePlugin(): Plugin {
  return {
    name: "author-write",
    apply: "serve", // dev only -- not present in `vite build` output
    configureServer(server: ViteDevServer) {
      const projectRoot = server.config.root;

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";

        // GET /projects/<...> -- read-only static serve from the project tree.
        // Used by the OverlayDisplay so image refs in markdown (./img.jpg ->
        // /projects/woodjam/overlays/<id>/img.jpg) resolve in dev. Same path
        // validation as the write endpoints (must normalize under projects/,
        // refuse non-regular files).
        //
        // CRITICAL: skip any request with a query string. Vite uses query
        // params (?import, ?raw, ?url, ?t=, etc.) to mark its own internal
        // transforms of source modules -- including JSON glob imports that
        // loadPages.ts depends on. Letting those fall through to next()
        // hands them back to Vite to transform properly.
        if (
          req.method === "GET" &&
          url.startsWith("/projects/") &&
          !url.includes("?")
        ) {
          try {
            const cleanUrl = url.split("#")[0];
            const requested = decodeURIComponent(cleanUrl.replace(/^\//, ""));
            const abs = resolveSafePath(projectRoot, requested);
            const st = await fs.lstat(abs).catch(() => null);
            if (!st || !st.isFile()) {
              res.statusCode = 404;
              res.end();
              return;
            }
            const buf = await fs.readFile(abs);
            const ext = abs.toLowerCase().split(".").pop() ?? "";
            const mimeMap: Record<string, string> = {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
              svg: "image/svg+xml",
              pdf: "application/pdf",
              eps: "application/postscript",
              md: "text/markdown",
              json: "application/json",
            };
            res.setHeader(
              "content-type",
              mimeMap[ext] ?? "application/octet-stream",
            );
            res.statusCode = 200;
            res.end(buf);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.statusCode = 400;
            res.end(JSON.stringify({ error: msg }));
          }
          return;
        }

        if (!url.startsWith("/api/")) return next();
        if (req.method !== "POST") {
          badRequest(res, "method not allowed", 405);
          return;
        }

        try {
          if (url === "/api/write-file") {
            const body = await readJsonBody<WriteBody>(req);
            const abs = resolveSafePath(projectRoot, body.path);
            await refuseUnlessRegularOrMissing(abs);
            await assertExpectedContent(body.path, abs, body.expectedContent);
            await fs.mkdir(dirname(abs), { recursive: true });
            const buf =
              body.encoding === "base64"
                ? Buffer.from(body.content, "base64")
                : Buffer.from(body.content, "utf8");
            await fs.writeFile(abs, buf);
            ok(res);
            return;
          }

          if (url === "/api/write-batch") {
            const body = await readJsonBody<WriteBatchBody>(req);
            const files = Array.isArray(body.files) ? body.files : [];
            if (files.length === 0) {
              ok(res);
              return;
            }

            const batchId = `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;
            const prepared: Array<{
              target: string;
              temp: string;
              content: Buffer;
            }> = [];
            try {
              for (const [index, file] of files.entries()) {
                const target = resolveSafePath(projectRoot, file.path);
                await refuseUnlessRegularOrMissing(target);
                await assertExpectedContent(
                  file.path,
                  target,
                  file.expectedContent,
                );
                const temp = `${target}.geosee-${batchId}-${index}.tmp`;
                await refuseUnlessRegularOrMissing(temp);
                prepared.push({
                  target,
                  temp,
                  content:
                    file.encoding === "base64"
                      ? Buffer.from(file.content, "base64")
                      : Buffer.from(file.content, "utf8"),
                });
              }

              for (const item of prepared) {
                await fs.mkdir(dirname(item.target), { recursive: true });
                await fs.writeFile(item.temp, item.content);
              }
              for (const item of prepared) {
                await fs.rename(item.temp, item.target);
              }
            } catch (e) {
              await Promise.allSettled(
                prepared.map((item) => fs.unlink(item.temp)),
              );
              throw e;
            }
            ok(res);
            return;
          }

          if (url === "/api/read-file") {
            const body = await readJsonBody<ReadBody>(req);
            const abs = resolveSafePath(projectRoot, body.path);
            try {
              const st = await fs.lstat(abs);
              if (!st.isFile()) {
                badRequest(res, "not a regular file");
                return;
              }
              const content = await fs.readFile(abs, "utf8");
              ok(res, { content });
            } catch (e: unknown) {
              if ((e as NodeJS.ErrnoException).code === "ENOENT") {
                ok(res, { content: null });
                return;
              }
              throw e;
            }
            return;
          }

          if (url === "/api/copy-file") {
            const body = await readJsonBody<CopyBody>(req);
            const from = resolveSafePath(projectRoot, body.from);
            const to = resolveSafePath(projectRoot, body.to);
            await refuseUnlessRegularOrMissing(from);
            await refuseUnlessRegularOrMissing(to);
            await fs.mkdir(dirname(to), { recursive: true });
            await fs.copyFile(from, to);
            ok(res);
            return;
          }

          if (url === "/api/delete-file") {
            const body = await readJsonBody<DeleteBody>(req);
            const abs = resolveSafePath(projectRoot, body.path);
            await refuseUnlessRegularOrMissing(abs); // refuses if not a regular file
            try {
              await fs.unlink(abs);
            } catch (e: unknown) {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            }
            ok(res);
            return;
          }

          if (url === "/api/convert-branding-asset") {
            const body = await readJsonBody<ConvertBrandingAssetBody>(req);
            ok(res, await convertBrandingAsset(projectRoot, body));
            return;
          }

          badRequest(res, "unknown endpoint", 404);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          // eslint-disable-next-line no-console
          console.error(`[author-write] ${url} failed:`, msg);
          badRequest(res, msg, 400);
        }
      });
    },
  };
}
