import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLocationAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { executeAgentAction } from "@/lib/agent/execute-action";
import { ACTION_TYPE_LABEL } from "@/lib/agent/write-tools";

const bodySchema = z.object({ decision: z.enum(["confirm", "reject"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { decision } = bodySchema.parse(await req.json());

    const action = await prisma.agentAction.findUniqueOrThrow({ where: { id } });
    const session = await requireLocationAccess(action.locationId);

    if (action.status !== "PENDING_CONFIRMATION") {
      return NextResponse.json({ error: "This action has already been resolved." }, { status: 409 });
    }

    let messageContent: string;
    let updated;

    if (decision === "reject") {
      updated = await prisma.agentAction.update({
        where: { id },
        data: { status: "REJECTED", decidedById: session.user.id, decidedAt: new Date() },
      });
      messageContent = `Okay, I won't ${ACTION_TYPE_LABEL[action.actionType].toLowerCase()}.`;
    } else {
      try {
        const resultSummary = await executeAgentAction(action, session.user.id);
        updated = await prisma.agentAction.update({
          where: { id },
          data: {
            status: "EXECUTED",
            resultSummary,
            decidedById: session.user.id,
            decidedAt: new Date(),
          },
        });
        messageContent = `Done - ${resultSummary}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        updated = await prisma.agentAction.update({
          where: { id },
          data: {
            status: "FAILED",
            resultSummary: message,
            decidedById: session.user.id,
            decidedAt: new Date(),
          },
        });
        messageContent = `I couldn't complete that: ${message}`;
      }
    }

    const message = await prisma.message.create({
      data: { conversationId: action.conversationId, role: "ASSISTANT", content: messageContent },
    });

    return NextResponse.json({ action: updated, message });
  } catch (error) {
    return handleApiError(error);
  }
}
