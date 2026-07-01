import type { AppError, AppErrorCode } from "@inkora/domain";

/** Postgres SQLSTATE → AppErrorCode (single translation point). */
const PG_ERROR_MAP: Record<string, AppErrorCode> = {
  "42501": "forbidden", // RLS denial / insufficient privilege
  "23505": "conflict", // unique violation
  "23503": "constraint", // FK violation
  "23514": "constraint", // check violation
  "22P02": "validation", // invalid text representation
  P0001: "internal", // raise exception (parsed further by message)
};

interface PgLikeError {
  code?: string;
  message?: string;
  status?: number;
}

/** Normalize any Supabase/PostgREST/Auth error into the domain AppError taxonomy. */
export function toAppError(err: unknown, correlationId?: string): AppError {
  const e = (err ?? {}) as PgLikeError;
  const message = e.message ?? "Something went wrong";

  // Auth errors carry HTTP status; map the common ones.
  if (e.status === 400 || /invalid login credentials/i.test(message)) {
    return { code: "validation", message: "Invalid email or password.", retriable: false, correlationId };
  }
  if (e.status === 401 || e.status === 403) {
    return { code: "forbidden", message, retriable: false, correlationId };
  }
  if (e.status === 429) {
    return { code: "rate_limited", message: "Too many attempts. Please wait and try again.", retriable: true, correlationId };
  }

  if (e.code && PG_ERROR_MAP[e.code]) {
    const code = PG_ERROR_MAP[e.code]!;
    if (code === "internal" && /insufficient_points/i.test(message)) {
      return { code: "insufficient_points", message: "Not enough points.", retriable: false, correlationId };
    }
    return { code, message, retriable: code === "rate_limited", correlationId };
  }

  return { code: "internal", message, retriable: false, correlationId };
}
