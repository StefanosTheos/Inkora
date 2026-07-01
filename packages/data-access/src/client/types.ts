import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";

export type { Database } from "../db/database.types";

/** Strongly-typed Supabase client bound to our schema. */
export type InkoraClient = SupabaseClient<Database>;

/**
 * Platform-injected factory contract. Each app constructs its own Supabase client
 * (different session storage/transport) and hands it in — behavior is then identical.
 */
export interface DataAccessConfig {
  /** the platform-built Supabase client (mobile: SecureStore; web: ssr cookies) */
  client: InkoraClient;
  /** base URL for Edge Functions (privileged calls) */
  functionsUrl: string;
}

export interface DataAccess {
  client: InkoraClient;
  // TODO: expose constructed repositories/services here, e.g. artists, feed, booking…
}

// TODO: export `createDataAccess(config: DataAccessConfig): DataAccess`.
