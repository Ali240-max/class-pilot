import { NextResponse } from "next/server";
import { getOrganizerOrNull } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Redirects to a short-lived signed URL for a private material.
 * RLS makes sure organizers can only read their own material rows and files.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/materials/[id]/download">) {
  const organizer = await getOrganizerOrNull();
  if (!organizer) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: material } = await organizer.supabase.from("materials").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!material) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data, error } = await organizer.supabase.storage
    .from("materials")
    .createSignedUrl(material.storage_path, 60 * 5, { download: material.file_name });
  if (error || !data) return NextResponse.json({ error: "File unavailable." }, { status: 404 });

  return NextResponse.redirect(data.signedUrl, { status: 303 });
}
