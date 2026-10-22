import "server-only";
import { cookies } from "next/headers";

// Display preferences are stored per browser in cookies (no database change needed).
export const SHOW_FACTS_COOKIE = "cp_show_db_facts";
export const THEME_COOKIE = "cp_theme";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Whether the AI assistant shows the "From your class database" panel. Off by default. */
export async function getShowDatabaseFacts(): Promise<boolean> {
  return (await cookies()).get(SHOW_FACTS_COOKIE)?.value === "1";
}

/** Light, dark, or follow the device (default). */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return THEMES.find((t) => t === value) ?? "system";
}

export const PREFERENCE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
} as const;
