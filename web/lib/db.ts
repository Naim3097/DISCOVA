import { createClient } from "@supabase/supabase-js";

// Server-side only. Uses the service role, which bypasses RLS —
// never import this from a client component.
export function db() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw || !key) return null;
  // Tolerate common paste styles: trailing slash, or the /rest/v1
  // endpoint copied instead of the bare project URL.
  const url = raw.replace(/\/(rest|auth|storage)\/v1\/?$/, "").replace(/\/+$/, "");
  return createClient(url, key, { auth: { persistSession: false } });
}
