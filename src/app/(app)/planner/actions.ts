"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/data";
import { activitySchema, formDataToObject, uuidSchema, zodFieldErrors, type FormState } from "@/lib/validation";

const FIELDS = ["title", "description", "course_id", "type", "status", "due_at"] as const;

function revalidateAll() {
  revalidatePath("/planner");
  revalidatePath("/courses", "layout");
  revalidatePath("/");
}

export async function saveActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireOrganizer();
  const values = formDataToObject(formData, FIELDS);
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuidSchema.safeParse(rawId) : null;
  if (id && !id.success) return { ok: false, message: "Invalid activity.", values };

  const parsed = activitySchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };

  // Make sure the course exists and belongs to this organizer (RLS hides others).
  const { data: course } = await supabase.from("courses").select("id").eq("id", parsed.data.course_id).maybeSingle();
  if (!course) return { ok: false, fieldErrors: { course_id: "Choose one of your courses." }, values };

  const res = id
    ? await supabase.from("academic_activities").update(parsed.data).eq("id", id.data).select("id").single()
    : await supabase
        .from("academic_activities")
        .insert({ ...parsed.data, organizer_id: userId })
        .select("id")
        .single();

  if (res.error) return { ok: false, message: dbErrorMessage(res.error), values };
  revalidateAll();
  redirect(`/planner?toast=${id ? "activity-updated" : "activity-created"}`);
}

export async function deleteActivity(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { error } = await supabase.from("academic_activities").delete().eq("id", id.data);
  if (error) throw new Error(dbErrorMessage(error));
  revalidateAll();
  redirect("/planner?toast=activity-deleted");
}

export async function completeActivity(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { error } = await supabase.from("academic_activities").update({ status: "completed" }).eq("id", id.data);
  if (error) throw new Error(dbErrorMessage(error));
  revalidateAll();
  redirect("/planner?toast=activity-completed");
}
