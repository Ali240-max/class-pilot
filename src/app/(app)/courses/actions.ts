"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/data";
import { courseSchema, formDataToObject, uuidSchema, zodFieldErrors, type FormState } from "@/lib/validation";

const FIELDS = ["name", "code", "instructor_name", "description", "status"] as const;

export async function saveCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireOrganizer();
  const values = formDataToObject(formData, FIELDS);
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuidSchema.safeParse(rawId) : null;
  if (id && !id.success) return { ok: false, message: "Invalid course.", values };

  const parsed = courseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };

  const res = id
    ? await supabase.from("courses").update(parsed.data).eq("id", id.data).select("id").single()
    : await supabase
        .from("courses")
        .insert({ ...parsed.data, organizer_id: userId })
        .select("id")
        .single();

  if (res.error) {
    if (res.error.code === "23505") return { ok: false, fieldErrors: { code: "Another course already uses this code." }, values };
    return { ok: false, message: dbErrorMessage(res.error), values };
  }
  revalidatePath("/courses");
  revalidatePath("/planner");
  redirect(`/courses/${res.data.id}?toast=${id ? "course-updated" : "course-created"}`);
}

export async function setCourseArchived(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = uuidSchema.safeParse(formData.get("id"));
  const archive = formData.get("archive") === "true";
  if (!id.success) return;
  const { error } = await supabase
    .from("courses")
    .update({ status: archive ? "archived" : "active" })
    .eq("id", id.data);
  if (error) throw new Error(dbErrorMessage(error));
  revalidatePath("/courses");
  revalidatePath(`/courses/${id.data}`);
  redirect(`/courses/${id.data}?toast=${archive ? "course-archived" : "course-restored"}`);
}
