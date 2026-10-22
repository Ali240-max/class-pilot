import type { Metadata } from "next";
import { requireOrganizer } from "@/lib/auth";
import { isAiConfigured } from "@/lib/ai/groq";
import { getShowDatabaseFacts } from "@/lib/preferences";
import { PageHeader } from "@/components/ui/card";
import { AssistantChat } from "./chat";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  await requireOrganizer();
  const showFacts = await getShowDatabaseFacts();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="AI Assistant" description="Ask anything about your class. Answers use your real deadlines, attendance and materials." />
      <AssistantChat aiConfigured={isAiConfigured()} showFacts={showFacts} />
    </div>
  );
}
