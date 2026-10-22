"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/client";
import { SessionForm } from "../session-form";

type CourseOption = { id: string; name: string; code: string | null };
type SessionValues = { id: string; session_date: string; course_id: string | null; notes: string | null };

/** "Edit details" button that opens the date / course / notes form in a dialog. */
export function EditSessionButton({ session, courses, today }: { session: SessionValues; courses: CourseOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-4" aria-hidden />
        Edit details
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Session details">
        {open && <SessionForm session={session} courses={courses} today={today} onCancel={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}
