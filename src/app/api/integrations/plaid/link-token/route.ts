import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireLocationAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { createLinkToken, isPlaidConfigured } from "@/server/services/banking";

const bodySchema = z.object({ locationId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { locationId } = bodySchema.parse(await req.json());
    const session = await requireLocationAccess(locationId);

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: "Plaid isn't configured yet. Set PLAID_CLIENT_ID and PLAID_SECRET on the server." },
        { status: 503 }
      );
    }

    const linkToken = await createLinkToken(session.user.id, locationId);
    return NextResponse.json({ linkToken });
  } catch (error) {
    return handleApiError(error);
  }
}
