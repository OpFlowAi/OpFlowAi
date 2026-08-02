import { NextResponse } from "next/server";
import { requireAccountAdmin } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { generateTemplateCsv } from "@/lib/bulk-import/template";

export async function GET() {
  try {
    await requireAccountAdmin();
    return new NextResponse(generateTemplateCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="opsflow-location-import-template.csv"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
