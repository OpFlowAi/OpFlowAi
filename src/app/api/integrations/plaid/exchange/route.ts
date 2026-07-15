import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireLocationAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { exchangePublicToken } from "@/server/services/banking";

const bodySchema = z.object({ locationId: z.string().min(1), publicToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { locationId, publicToken } = bodySchema.parse(await req.json());
    await requireLocationAccess(locationId);
    await exchangePublicToken(locationId, publicToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
