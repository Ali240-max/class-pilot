import { z } from "zod";
import { normalizePhone } from "./phone";
import { pktInputToIso, pktToday } from "./time";

// Empty form fields arrive as "" — store them as null.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v));

export const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  student_code: optionalText(40),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const normalized = normalizePhone(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 0300-1234567" });
        return z.NEVER;
      }
      return normalized;
    }),
  status: z.enum(["active", "inactive"]),
  notes: optionalText(2000),
});

export const courseSchema = z.object({
  name: z.string().trim().min(1, "Course name is required").max(120, "Name is too long"),
  code: optionalText(30),
  instructor_name: optionalText(120),
  description: optionalText(2000),
  status: z.enum(["active", "archived"]),
});

export const activitySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "Title is too long"),
  description: optionalText(4000),
  course_id: z.uuid("Choose a course"),
  type: z.enum(["assignment", "quiz", "exam"], "Choose a type"),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  due_at: z.string().transform((v, ctx) => {
    const iso = pktInputToIso(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    const year = new Date(iso).getUTCFullYear();
    if (year < 2000 || year > 2100) {
      ctx.addIssue({ code: "custom", message: "Date looks wrong — check the year" });
      return z.NEVER;
    }
    return iso;
  }),
});

/** "YYYY-MM-DD" → day count, for comparing plain dates without timezones. */
function dayNumber(ymd: string): number {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000;
}

export const sessionSchema = z.object({
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((v) => !Number.isNaN(dayNumber(v)) && Number(v.slice(0, 4)) >= 2000, "Choose a valid date")
    // Attendance is for classes that happened; allow tomorrow for early setup only.
    .refine((v) => dayNumber(v) <= dayNumber(pktToday()) + 1, "Date can't be more than a day in the future"),
  course_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Choose a course").nullable()),
  notes: optionalText(1000),
});

export const attendanceMarksSchema = z.object({
  sessionId: z.uuid(),
  marks: z
    .array(
      z.object({
        studentId: z.uuid(),
        // null = not marked (no record kept for this student)
        status: z.enum(["present", "absent", "late", "excused"]).nullable(),
      }),
    )
    .max(1000),
});

export const uuidSchema = z.uuid();

export type FieldErrors = Record<string, string | undefined>;

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  /** Echo of submitted values so the form keeps them after an error. */
  values?: Record<string, string>;
};

export function formDataToObject(formData: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = formData.get(key);
    out[key] = typeof v === "string" ? v : "";
  }
  return out;
}

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
