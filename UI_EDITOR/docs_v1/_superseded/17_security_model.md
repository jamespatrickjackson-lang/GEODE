# v1 Security Model

## 1. Goal

State the v1 threat model and the concrete lockdown rules that follow from it. The Vite plugin `vite-plugin-package-write.ts` writes arbitrary files inside `UI_EDITOR/packages/` based on HTTP requests from the workbench shell. Codex implementing that plugin must know the threat posture so the lockdown is correct from the first commit.

The workbench is **localhost-only dev-time tooling**. It is not deployed. It does not run in production. Its security posture matches GeoSee's existing `vite-plugin-author-write` rather than a public web service.

## 2. Threat posture

| Property | v1 stance | Why |
| --- | --- | --- |
| Audience | Single local author on a developer machine | The workbench is not multi-user, not network-shared, not deployed. |
| Network exposure | Localhost only (`127.0.0.1` / `::1`) | Vite dev server defaults; v1 must not bind to `0.0.0.0`. |
| Authentication | None | Same posture as Vite dev server; localhost-only access is the trust boundary. |
| Filesystem authority | Full author's home tree minus the allowlist | Mitigated entirely by path policy (see §4 below). |
| Untrusted input | None expected | The author types into the workbench; there is no external data ingestion. |
| Dependencies | npm registry resolution at install time | Lockfile (`package-lock.json`) committed; reviewed before any `npm install`. |
| Production deployment | Explicitly out of scope (and out of capability) | v1's plugin is dev-only and refuses to load in production builds. |

## 3. What v1 explicitly does **not** do

These are reaffirmed (not new — they propagate from earlier docs):

- No network calls from the workbench at runtime (no fetch, no XHR, no WebSocket beyond Vite HMR). The only HTTP traffic is to `localhost:5174/api/package/*`.
- No telemetry, analytics, or remote logging.
- No external code execution (no `eval`, no dynamic `import()` of user-provided paths, no shell-out).
- No file uploads from the browser. The only "ingestion" is the Eyedropper Tool reading `document.elementFromPoint` results — purely DOM-local.
- No persistent worker threads, service workers, or push notifications.
- No automatic update mechanism. The workbench is updated by `git pull` + `npm install`.

## 4. Path policy (the load-bearing piece)

`src/core/packageIO/pathPolicy.ts` enforces every filesystem write. The plugin invokes the policy before touching disk. Reject criteria:

```ts
export function isWritePathAllowed(
  requestPath: string,
  resolvedPackagesRoot: string,
): { ok: true } | { ok: false; reason: string } {
  // 1. Must start with packages/<id>/
  // 2. Must not contain ".." segments
  // 3. Must match the v1 allowlist regex (see below)
  // 4. Resolved absolute path must stay under resolvedPackagesRoot
  // 5. No symlinks anywhere in the resolved path
  // 6. No filenames > 255 bytes
  // 7. No filenames with control characters (< 0x20) or path separators inside a segment
}
```

### 4.1 Allowlist

The write allowlist matches **exactly** the canonical Package Folder layout in [07_package_format.md](07_package_format.md) §2. The regex (single source of truth in `pathPolicy.ts`):

```text
^packages/[a-z0-9_]+/(
    manifest\.json
  | frames\.json
  | containers\.json
  | components\.json
  | tokens\.json
  | libraries\.json
  | guides\.json
  | change_log\.json
  | validation/(rule_pack|findings)\.json
  | docs/(spec|ai_agent_brief)\.md
  | assets/backgrounds/[a-z0-9_-]+\.(png|jpg|jpeg|webp)
  | assets/thumbnails/[a-z0-9_-]+\.(png|jpg|jpeg|webp|svg)
)$
```

Any path outside this regex → HTTP 403 with reason `path_not_allowlisted`.

The allowlist is **structural**: it does not check file *contents*. Content validation (schema version, required fields, etc.) is the responsibility of `readPackage.ts` on the next load.

### 4.2 Reject on symlink

Before write, the plugin resolves the target path via `fs.realpath()`. If the real path differs from the requested path in a way that escapes `resolvedPackagesRoot`, the request is refused. This blocks an attacker who managed to plant a symlink in `packages/` (e.g. via an out-of-band action) from redirecting writes outside the packages tree.

### 4.3 Reject on length / control chars

255-byte filename cap (matches ext4 / NTFS). Control characters and path separators inside a single segment are rejected to prevent encoding-trick attacks on the underlying filesystem.

## 5. Plugin scope

The plugin registers **only** in dev (Vite's `apply: "serve"`). Production builds (`vite build`) do not include the plugin. If Codex accidentally registers the plugin in production, the workbench's `npm run build` succeeds but the plugin endpoints simply do not exist.

```ts
// plugins/vite-plugin-package-write.ts
export function packageWritePlugin(): Plugin {
  return {
    name: "geosee-workbench-package-write",
    apply: "serve",                       // dev only
    configureServer(server) { /* ... */ }
  };
}
```

The plugin must verify the request `Origin` header matches the dev server's origin (`http://localhost:5174` by default) and rejects requests from any other origin. This is belt-and-suspenders against a hypothetical malicious browser tab making cross-origin POSTs.

## 6. Request validation

Each `/api/package/*` request:

1. Method check — only POST accepted; everything else returns 405.
2. Content-Type check — `application/json` required; else 415.
3. Body size cap — max 5 MB per request (covers even large pages with many embedded SVG paths); else 413.
4. JSON parse — invalid JSON returns 400.
5. Body schema check — required fields validated; missing/extra returns 400 with diagnostics.
6. Path policy on every path mentioned in the body (read: `packageId`; write: every file path).
7. Atomic write (see §7 below).

## 7. Atomic write

For multi-file writes (the common case during save / export):

1. Plugin writes each file as `<path>.tmp` first.
2. If all `.tmp` writes succeed, plugin renames each `.tmp` to its final name (atomic on POSIX; near-atomic on NTFS).
3. If any `.tmp` write fails, the plugin deletes all `.tmp` files it created in this batch and returns an error.
4. The plugin never leaves stray `.tmp` files on disk after a request, success or failure.

Reads do not need atomicity at the plugin level; readers may observe a partial state only if a write is in flight, and v1's reducer flushes the entire package on every save (no per-file save granularity).

## 8. Logging

The plugin logs each request to the Vite server console:

```text
[workbench] POST /api/package/write packageId=geosee_editor_sidebar files=11 bytes=82455 → 200 OK
[workbench] POST /api/package/write packageId=geosee_editor_sidebar files=1  bytes=520    → 403 path_not_allowlisted
```

Logged fields: timestamp, method, path, packageId, file count, total body bytes, response code, optional reason. No file contents logged.

No logs persisted to disk by the plugin. Vite's stdout is the only sink. CI or production environments are not in scope.

## 9. Trust boundaries

| Boundary | Trust direction | What's verified |
| --- | --- | --- |
| Browser shell → Vite dev plugin | Browser is **trusted**; verified by Origin header + localhost-only bind. | Path policy + body schema. |
| Vite dev plugin → filesystem | Plugin is **trusted**; verified by path policy. | Real path resolution + symlink rejection. |
| External processes → Vite dev server | **Not trusted**. | Origin header rejection. |
| User-typed content (intent annotations, labels, etc.) | **Not sanitised**. Author owns content. | Stored verbatim; rendered as plain text in the shell. |

The "not sanitised" point for user-typed content is intentional. The author is the only consumer of their own content; no XSS surface exists because the content is rendered locally for the same author. If v1 grew a multi-user surface, sanitisation would become mandatory at that boundary.

## 10. Dependency hygiene

`UI_EDITOR/package.json` pins all dependencies to exact minor versions (`^` allowed for patches only). The lockfile is committed.

`npm audit` is run as part of Phase 14 (end-to-end smoke). High-severity findings block the phase; the agent surfaces them rather than auto-fixing.

No `postinstall` scripts in any direct dependency without prior human approval. v1's chosen dependencies (React, Vite, TypeScript, Vitest, `@vitest/ui`) are all well-known and `postinstall`-free as of common recent versions.

## 11. What happens if the threat posture changes

If a future version of the workbench:

- Binds to non-localhost — re-evaluate origin checks, add authentication.
- Serves multiple users — sanitise user content, add CSRF protection.
- Accepts file uploads — add MIME sniffing, scan for known-bad signatures.
- Deploys to production — write a separate threat model; do not reuse this one.

v1 does none of these things, so the lockdown above is sufficient.

## 12. Acceptance criteria

| # | Check | How to verify |
| --- | --- | --- |
| 1 | Plugin only loads in dev | `vite build && grep -r "geosee-workbench-package-write" dist/` finds nothing. |
| 2 | Localhost-only bind | `vite.config.ts` does not set `server.host` to `0.0.0.0` or a non-loopback address. |
| 3 | Path traversal rejected | POST `/api/package/write` with `{ files: { "packages/x/../../etc.txt": "..." } }` returns 403; no file created. |
| 4 | Outside-allowlist rejected | POST with `{ files: { "packages/geosee_editor_sidebar/secret.json": "..." } }` (not in allowlist) returns 403. |
| 5 | Symlink rejected | Plant a symlink inside `packages/x/` pointing outside the tree; POST to a path that resolves through it; returns 403. |
| 6 | Origin enforced | POST from `Origin: http://evil.example` returns 403 / 400. |
| 7 | Wrong method | GET `/api/package/write` returns 405. |
| 8 | Oversized body | POST a > 5 MB body; returns 413. |
| 9 | Atomic rollback | Force one of N writes in a batch to fail (e.g. a path that triggers 403); verify no `.tmp` files left behind. |
| 10 | `npm audit` clean (high+) | Phase 14 step runs `npm audit --audit-level=high`; exit 0. |
| 11 | No postinstall scripts | `npm ls --all --json` scanned for `postinstall` in any dep; none present. |
| 12 | No external network calls in runtime | grep `src/` for `fetch(`, `XMLHttpRequest`, `WebSocket`; only legitimate Vite HMR connections present. |
