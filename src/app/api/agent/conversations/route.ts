import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get("locationId");
    if (!locationId) return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    const session = await requireLocationAccess(locationId);

    const conversations = await prisma.conversation.findMany({
      where: { userId: session.user.id, locationId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1, where: { role: "USER" } } },
    });

    return NextResponse.json(
      conversations.map((c) => ({
        id: c.id,
        title: c.title ?? c.messages[0]?.content.slice(0, 60) ?? "New conversation",
        updatedAt: c.updatedAt,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
