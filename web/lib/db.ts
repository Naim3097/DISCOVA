import { createClient } from "@supabase/supabase-js";

// Server-side only. Uses the service role, which bypasses RLS —
// never import this from a client component.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
