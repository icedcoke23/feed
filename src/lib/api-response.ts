import { NextResponse } from "next/server";

// Success response: { data: T, message?: string }
export function successResponse<T>(data: T, message?: string, status = 200) {
  const body: Record<string, unknown> = { data };
  if (message) body.message = message;
  return NextResponse.json(body, { status });
}

// Error response: { error: string, code?: string, ...extra }
export function errorResponse(
  error: string,
  status = 400,
  code?: string,
  extra?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { error };
  if (code) body.code = code;
  if (extra) Object.assign(body, extra);
  return NextResponse.json(body, { status });
}

// Paginated response: { data: T[], pagination: {...} }
export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number; totalPages: number },
  status = 200
) {
  return NextResponse.json({ data, pagination }, { status });
}
