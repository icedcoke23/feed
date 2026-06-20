import { ApiResponse } from "@/lib/api-types";

export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public info?: unknown
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    let info: unknown;
    try {
      info = await res.json();
    } catch {
      info = await res.text();
    }
    throw new FetchError(
      (info as { error?: string })?.error || `请求失败: ${res.status}`,
      res.status,
      info
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const result = (await res.json()) as ApiResponse<T>;
    return result.data as T;
  }

  return (await res.text()) as unknown as T;
}
