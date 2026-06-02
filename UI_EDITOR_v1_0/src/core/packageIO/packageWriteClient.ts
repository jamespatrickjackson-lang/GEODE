export interface PackageReadResponse<T = unknown> {
  ok: boolean;
  packageId?: string;
  files?: Record<string, string>;
  reason?: string;
  data?: T;
}

export interface PackageWriteResponse {
  ok: boolean;
  written?: string[];
  reason?: string;
}

export interface PackageListResponse {
  ok: boolean;
  packageIds: string[];
  reason?: string;
}

async function postJson<TResult>(endpoint: string, body: unknown): Promise<TResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text.length ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response from ${endpoint} (status ${res.status}): ${text}`);
  }
  if (!res.ok) {
    const reason = (parsed as { reason?: string } | undefined)?.reason ?? `http_${res.status}`;
    throw new Error(`Request to ${endpoint} failed: ${reason}`);
  }
  return parsed as TResult;
}

export async function clientReadPackage(packageId: string): Promise<{
  packageId: string;
  files: Record<string, string>;
}> {
  const res = await postJson<PackageReadResponse>("/api/package/read", { packageId });
  if (!res.ok || !res.files) {
    throw new Error(`Read failed for ${packageId}: ${res.reason ?? "unknown"}`);
  }
  return { packageId: res.packageId ?? packageId, files: res.files };
}

export async function clientWritePackage(
  packageId: string,
  files: Record<string, string>,
): Promise<PackageWriteResponse> {
  return postJson<PackageWriteResponse>("/api/package/write", { packageId, files });
}

export async function clientListPackages(): Promise<string[]> {
  const res = await postJson<PackageListResponse>("/api/package/list", {});
  return res.packageIds ?? [];
}
