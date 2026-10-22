import { Suspense } from "react";
import { requireOrganizer } from "@/lib/auth";
import { BottomNav, Sidebar } from "@/components/shell/nav";
import { Toast } from "@/components/ui/client";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, email } = await requireOrganizer();
  const { data: profile } = await supabase.from("organizers").select("full_name, class_name").maybeSingle();
  const label = profile?.class_name || profile?.full_name || email;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <Sidebar organizerName={label} className="sticky top-0 hidden h-screen lg:flex" />
      <div className="min-w-0">
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">{children}</main>
      </div>
      <BottomNav />
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
