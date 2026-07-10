import { createClient } from "@supabase/supabase-js";

/** Anon server client for public pages. RLS guarantees only published
 * content is readable — same guarantee as the browser. */
export function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ldxpockcgcxvsrbyhcnt.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_3tn2UadRVekIf5Pw6F5z-A_40ZbdvTm",
    { auth: { persistSession: false } }
  );
}
