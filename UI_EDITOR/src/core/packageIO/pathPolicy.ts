export const PACKAGES_ROOT_SEGMENT = "packages";

export const PACKAGE_FILE_ALLOWLIST =
  /^packages\/[a-z0-9_]+\/(manifest\.json|frames\.json|containers\.json|components\.json|tokens\.json|libraries\.json|guides\.json|change_log\.json|validation\/(rule_pack|findings)\.json|docs\/(spec|ai_agent_brief)\.md|assets\/backgrounds\/[a-z0-9_-]+\.(png|jpg|jpeg|webp)|assets\/thumbnails\/[a-z0-9_-]+\.(png|jpg|jpeg|webp|svg))$/;

export const PACKAGE_ID_REGEX = /^[a-z0-9_]+$/;

export interface PathPolicyOk {
  ok: true;
}
export interface PathPolicyReject {
  ok: false;
  reason: string;
}
export type PathPolicyResult = PathPolicyOk | PathPolicyReject;

const MAX_SEGMENT_BYTES = 255;
const CONTROL_CHAR = /[\x00-\x1F\x7F]/;

export function isValidPackageId(id: unknown): id is string {
  return typeof id === "string" && PACKAGE_ID_REGEX.test(id) && id.length <= 64;
}

export function isWritePathAllowed(requestPath: string): PathPolicyResult {
  if (typeof requestPath !== "string" || requestPath.length === 0) {
    return { ok: false, reason: "path_empty" };
  }
  if (requestPath.includes("\\")) {
    return { ok: false, reason: "path_separator_backslash" };
  }
  const segments = requestPath.split("/");
  for (const segment of segments) {
    if (segment === "..") {
      return { ok: false, reason: "path_traversal" };
    }
    if (segment === "." && segments.length > 1) {
      return { ok: false, reason: "path_dot_segment" };
    }
    if (CONTROL_CHAR.test(segment)) {
      return { ok: false, reason: "path_control_char" };
    }
    if (Buffer.byteLength(segment, "utf8") > MAX_SEGMENT_BYTES) {
      return { ok: false, reason: "path_segment_too_long" };
    }
  }
  if (!PACKAGE_FILE_ALLOWLIST.test(requestPath)) {
    return { ok: false, reason: "path_not_allowlisted" };
  }
  return { ok: true };
}

export function packageIdFromPath(requestPath: string): string | null {
  const m = requestPath.match(/^packages\/([a-z0-9_]+)\//);
  return m ? m[1]! : null;
}
