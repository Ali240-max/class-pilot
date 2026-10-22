"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/data";
import {
  attendanceMarksSchema,
  formDataToObject,
  sessionSchema,
  uuidSchema,
  zodFieldErrors,
  type FormState,
} from "@/lib/validation";

const FIELDS = ["session_date", "course_id", "notes"] as const;

function revalidateAttendance(sessionId?: string) {
  revalidatePath("/attendance");
  if (sessionId) revalidatePath(`/attendance/${sessionId}`);
  revalidatePath("/students", "layout");
  revalidatePath("/");
}

/** Creates a session (or opens the existing one for the same date + course). */
export async function saveSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireOrganizer();
  const values = formDataToObject(formData, FIELDS);
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? uuidSchema.safeParse(rawId) : null;
  if (id && !id.success) return { ok: false, message: "Invalid session.", values };

  const parsed = sessionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const { session_date, course_id, notes } = parsed.data;

  if (course_id) {
    const { data: course } = await supabase.from("courses").select("id").eq("id", course_id).maybeSingle();
    if (!course) return { ok: false, fieldErrors: { course_id: "Choose one of your courses." }, values };
  }

  // One session per date + course: reuse it instead of creating a duplicate.
  let dupQuery = supabase.from("attendance_sessions").select("id").eq("session_date", session_date);
  dupQuery = course_id ? dupQuery.eq("course_id", course_id) : dupQuery.is("course_id", null);
  const { data: duplicate } = await dupQuery.limit(1).maybeSingle();

  if (id) {
    if (duplicate && duplicate.id !== id.data) {
      return { ok: false, message: "Another session already exists for this date and course. Open that one instead.", values };
    }
    const { error } = await supabase.from("attendance_sessions").update({ session_date, course_id, notes }).eq("id", id.data);
    if (error) return { ok: false, message: dbErrorMessage(error), values };
    revalidateAttendance(id.data);
    redirect(`/attendance/${id.data}?toast=session-updated`);
  }

  if (duplicate) redirect(`/attendance/${duplicate.id}?toast=session-exists`);

  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({ session_date, course_id, notes, organizer_id: userId })
    .select("id")
    .single();
  if (error) return { ok: false, message: dbErrorMessage(error), values };
  revalidateAttendance();
  redirect(`/attendance/${data.id}`);
}

export type SaveMarksResult = { ok: true; saved: number } | { ok: false; message: string };

/**
 * Saves every student's mark for one session in a single batch.
 * Marked students are upserted; students set back to "not marked" lose their record.
 */
export async function saveAttendance(input: unknown): Promise<SaveMarksResult> {
  const { supabase, userId } = await requireOrganizer();
  const parsed = attendanceMarksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some marks were invalid. Reload the page and try again." };
  const { sessionId, marks } = parsed.data;

  // RLS hides other organizers' sessions, so this also checks ownership.
  const { data: session } = await supabase.from("attendance_sessions").select("id").eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, message: "This session no longer exists." };

  const toSave = marks.filter((m) => m.status !== null);
  const toClear = marks.filter((m) => m.status === null).map((m) => m.studentId);

  if (toSave.length) {
    const { error } = await supabase.from("attendance_records").upsert(
      toSave.map((m) => ({
        organizer_id: userId,
        session_id: sessionId,
        student_id: m.studentId,
        status: m.status!,
      })),
      { onConflict: "session_id,student_id" },
    );
    // The composite foreign key rejects students that belong to someone else.
    if (error) return { ok: false, message: dbErrorMessage(error) };
  }
  if (toClear.length) {
    const { error } = await supabase.from("attendance_records").delete().eq("session_id", sessionId).in("student_id", toClear);
    if (error) return { ok: false, message: dbErrorMessage(error) };
  }

  revalidateAttendance(sessionId);
  return { ok: true, saved: toSave.length };
}

export async function deleteSession(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  // Records are removed with the session (ON DELETE CASCADE).
  const { error } = await supabase.from("attendance_sessions").delete().eq("id", id.data);
  if (error) throw new Error(dbErrorMessage(error));
  revalidateAttendance();
  redirect("/attendance?toast=session-deleted");
}
