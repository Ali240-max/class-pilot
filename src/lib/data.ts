import "server-only";

/** Throws a readable error when a Supabase query fails, so error.tsx can show it. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`Supabase error loading ${what}:`, res.error.message);
    throw new Error(`Couldn't load ${what}.`);
  }
  if (res.data === null) throw new Error(`Couldn't load ${what}.`);
  return res.data;
}

/** Maps Postgres errors to friendly form messages. */
export function dbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That already exists.";
  if (error.code === "23503") return "This is linked to other records and can't be changed that way.";
  if (error.code === "23514") return "Some values aren't allowed. Check the form and try again.";
  if (error.code === "42501") return "You don't have permission to do that.";
  console.error("Supabase write error:", error.code, error.message);
  return "Couldn't save. Please try again.";
}
