import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireLocationAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation, runAgentTurn } from "@/lib/agent/chat";

const bodySchema = z.object({
  locationId: z.string().min(1),
  conversationId: z.string().nullish(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  try {
    const { locationId, conversationId, message } = bodySchema.parse(await req.json());
    const session = await requireLocationAccess(locationId);

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "The AI Agent isn't configured yet. Set ANTHROPIC_API_KEY on the server." },
        { status: 503 }
      );
    }

    const conversation = await getOrCreateConversation(session.user.id, locationId, conversationId ?? undefined);

    const result = await runAgentTurn({
      conversationId: conversation.id,
      userId: session.user.id,
      userName: session.user.name ?? "there",
      locationId,
      accountId: session.user.accountId!,
      userMessageText: message,
    });

    const pendingActions = await prisma.agentAction.findMany({
      where: { id: { in: result.pendingActionIds } },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      assistantText: result.assistantText,
      pendingActions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
