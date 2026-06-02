export function canonicalStringify(value: unknown): string {
  return jsonStringify(value, 0) + "\n";
}

function jsonStringify(value: unknown, depth: number): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot canonicalise non-finite number ${String(value)}`);
    }
    return canonicalNumber(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const pad = indent(depth + 1);
    const close = indent(depth);
    const parts = value.map((v) => pad + jsonStringify(v === undefined ? null : v, depth + 1));
    return `[\n${parts.join(",\n")}\n${close}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    if (keys.length === 0) return "{}";
    const pad = indent(depth + 1);
    const close = indent(depth);
    const parts = keys.map(
      (k) => `${pad}${JSON.stringify(k)}: ${jsonStringify(obj[k], depth + 1)}`,
    );
    return `{\n${parts.join(",\n")}\n${close}}`;
  }
  if (value === undefined) {
    throw new Error("Cannot canonicalise top-level undefined value");
  }
  throw new Error(`Cannot canonicalise value of type ${typeof value}`);
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function canonicalNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  let out = String(value);
  if (out.includes("e") || out.includes("E")) return out;
  if (out.includes(".")) {
    out = out.replace(/0+$/, "");
    if (out.endsWith(".")) out = out.slice(0, -1);
  }
  return out;
}
