import type { Metadata } from "next";
import { Download, FileImage, FileText, FolderOpen, Info, Presentation } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { formatDate } from "@/lib/time";
import { stagger } from "@/lib/cn";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ShareButton } from "@/components/share-dialog";

export const metadata: Metadata = { title: "Materials" };

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return Presentation;
  return FileText;
}

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MaterialsPage() {
  const { supabase } = await requireOrganizer();
  const materials = must(
    await supabase
      .from("materials")
      .select("id, title, description, file_name, mime_type, size_bytes, created_at, course:courses(name, code)")
      .order("created_at", { ascending: false }),
    "materials",
  );

  return (
    <>
      <PageHeader title="Materials" description="Notes, slides and handouts, stored privately." />
      <div role="note" className="mb-4 flex animate-fade-up items-start gap-2 rounded-xl bg-info-soft px-3.5 py-3 text-sm text-info">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Uploading from the app is coming next. Downloads use private links that expire after 5 minutes.
      </div>
      <Card>
        {materials.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No materials yet" description="Course files will be listed here." />
        ) : (
          <ul className="stagger divide-y divide-line">
            {materials.map((m, i) => {
              const Icon = iconFor(m.mime_type);
              const course = m.course?.code ?? m.course?.name ?? "";
              return (
                <li key={m.id} style={stagger(Math.min(i, 12))} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {course && <Badge className="font-mono">{course}</Badge>}
                      <span className="truncate">{m.file_name}</span>
                      <span>{size(m.size_bytes)}</span>
                      <span>{formatDate(m.created_at)}</span>
                    </p>
                    {m.description && <p className="mt-1 text-xs text-ink-2">{m.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <ShareButton
                      variant="ghost"
                      label="Share"
                      title={m.title}
                      message={`📎 *${m.title}*${course ? ` — ${course}` : ""}\n${m.description ?? ""}\n\nI'll send the file in the group.\n\n_— Your CR_`.replace(/\n\n\n/g, "\n\n")}
                    />
                    <a href={`/api/materials/${m.id}/download`} className={buttonClass("secondary", "sm")} aria-label={`Download ${m.title}`}>
                      <Download className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
