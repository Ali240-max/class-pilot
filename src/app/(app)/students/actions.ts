"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/data";
import { formDataToObject, studentSchema, uuidSchema, zodFieldErrors, type FormState } from "@/lib/validation";

const FIELDS = ["full_name", "student_code", "phone", "status", "notes"] as const;

export async function saveStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireOrganizer();
  const values = formDataToObject(formData, FIELDS);
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuidSchema.safeParse(rawId) : null;
  if (id && !id.success) return { ok: false, message: "Invalid student.", values };

  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };

  const res = id
    ? await supabase.from("students").update(parsed.data).eq("id", id.data).select("id").single()
    : await supabase
        .from("students")
        .insert({ ...parsed.data, organizer_id: userId })
        .select("id")
        .single();

  if (res.error) {
    if (res.error.code === "23505") {
      return { ok: false, fieldErrors: { student_code: "Another student already has this student ID." }, values };
    }
    return { ok: false, message: dbErrorMessage(res.error), values };
  }

  revalidatePath("/students");
  revalidatePath("/");
  redirect(`/students/${res.data.id}?toast=${id ? "student-updated" : "student-created"}`);
}

export async function deleteStudent(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const { error } = await supabase.from("students").delete().eq("id", id.data);
  if (error) throw new Error(dbErrorMessage(error));
  revalidatePath("/students");
  revalidatePath("/");
  redirect("/students?toast=student-deleted");
}
