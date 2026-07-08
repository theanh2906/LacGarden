import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { getEmptySalesAnalyticsReport, getSalesAnalyticsReport, parseSalesReportSearchParams } from "@/server/sales-reports";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("reports:view");
    const query = parseSalesReportSearchParams(new URL(request.url).searchParams);
    const data = await getSalesAnalyticsReport(query).catch((error) => {
      console.info("[sales-reports-api] Analytics data load failed", error);
      return getEmptySalesAnalyticsReport(query);
    });

    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[sales-reports-api] Analytics request failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Report filters are invalid.",
            details: error.flatten()
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "SALES_REPORT_ERROR", message: "Unable to load sales analytics report. Check admin logs for details." } },
      { status: 400 }
    );
  }
}
