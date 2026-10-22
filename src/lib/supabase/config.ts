// Public Supabase settings (safe for the browser: access is enforced by RLS).
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = supabaseConfig();
  return /^https:\/\/.+/.test(url) && !url.includes("your-project") && key.length > 30;
}
