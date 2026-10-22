"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/data";
import { PREFERENCE_COOKIE_OPTIONS, SHOW_FACTS_COOKIE, THEME_COOKIE, THEMES } from "@/lib/preferences";
import { formDataToObject, zodFieldErrors, type FormState } from "@/lib/validation";

const profileSchema = z.object({
  full_name: z.string().trim().max(120, "Too long"),
  class_name: z.string().trim().max(120, "Too long"),
  institution: z.string().trim().max(160, "Too long"),
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireOrganizer();
  const values = formDataToObject(formData, ["full_name", "class_name", "institution"]);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const { error } = await supabase.from("organizers").update(parsed.data).eq("id", userId);
  if (error) return { ok: false, message: dbErrorMessage(error), values };
  revalidatePath("/", "layout");
  redirect("/settings?toast=profile-updated");
}

/** Turns the AI assistant's "From your class database" panel on or off. */
export async function setShowDatabaseFacts(formData: FormData) {
  await requireOrganizer();
  const enabled = formData.get("enabled") === "true";
  (await cookies()).set(SHOW_FACTS_COOKIE, enabled ? "1" : "0", PREFERENCE_COOKIE_OPTIONS);
  revalidatePath("/assistant");
  redirect("/settings?toast=preference-saved");
}

/** Appearance: follow the device, or force light / dark. */
export async function setTheme(formData: FormData) {
  await requireOrganizer();
  const theme = THEMES.find((t) => t === formData.get("theme"));
  if (!theme) return;
  (await cookies()).set(THEME_COOKIE, theme, PREFERENCE_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/settings?toast=preference-saved");
}
