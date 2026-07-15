import { redirect } from "next/navigation";
import { getActiveLocation } from "@/lib/active-location";
import { AgentChat } from "@/components/agent/AgentChat";

export default async function AgentPage() {
  const { location, session } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-foreground">AI Agent</h1>
        <p className="text-sm text-muted mt-1">
          Ask about {location.name}&apos;s data, or ask me to take action - I&apos;ll always check with you first.
        </p>
      </div>
      <AgentChat locationId={location.id} userName={session.user.name ?? "there"} />
    </div>
  );
}
