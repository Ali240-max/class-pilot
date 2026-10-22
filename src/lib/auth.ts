import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Returns the signed-in organizer and a Supabase client acting as them.
 * Redirects to /login when there is no valid session. Call this at the top of
 * every page, Server Action and Route Handler that touches class data.
 */
export const requireOrganizer = cache(async () => {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  return { supabase, userId, email };
});

/** Same check for Route Handlers, which should answer 401 instead of redirecting. */
export async function getOrganizerOrNull() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { supabase, userId };
}
