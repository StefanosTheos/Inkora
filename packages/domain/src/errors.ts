/**
 * Typed error taxonomy. Services produce these; the BFF serializes them; the UI
 * renders them per the error-state catalog. Postgres/PostgREST errors are mapped
 * to these codes in data-access (the single translation point).
 */
export type AppErrorCode =
  | "unauthenticated"
  | "forbidden"           // RLS denial (PG 42501) or role check
  | "not_found"
  | "validation"          // zod / invalid input (PG 22P02)
  | "conflict"            // unique violation (PG 23505)
  | "constraint"          // check/FK violation (PG 23514 / 23503)
  | "insufficient_points" // raised by apply_reward_transaction (PG P0001)
  | "rate_limited"
  | "illegal_transition"  // booking state machine
  | "upstream"            // FCM / 3rd-party failure
  | "internal";

export interface AppError {
  code: AppErrorCode;
  message: string;                 // safe, user-facing
  detail?: string;                 // dev-only; stripped from prod responses
  retriable: boolean;
  fields?: Record<string, string>; // field-level, for `validation`
  correlationId?: string;          // ties to logs / Sentry
}

/** Result type so callers handle errors explicitly instead of try/catch everywhere. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

// TODO: export an `isAppError` guard and a `PG_ERROR_MAP` const in data-access (not here — keep domain pure).
