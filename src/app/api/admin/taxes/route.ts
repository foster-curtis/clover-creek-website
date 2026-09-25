// CSV export of the lodging tax report for one filing period — the download
// behind the "Download CSV" link on /admin/taxes.
//
// Built from the same @/lib/taxReport helpers the page renders, so the file and
// the table on screen can never disagree. Admin-only: unlike the /admin pages,
// a route handler is not behind the admin layout, so it re-checks the role
// itself before touching the service-role client.

import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole, isAdminUser, supabaseAdmin } from "@/lib/supabase/server";
import {
  csvFilename,
  parsePeriodKey,
  REPORTED_STATUSES,
  reportRows,
  rowsInPeriod,
  toCsv,
  type ReportableBooking,
} from "@/lib/taxReport";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminUser())) {
    return new NextResponse("Not authorized", { status: 403 });
  }
  if (!hasServiceRole()) {
    return new NextResponse("Tax reporting not configured", { status: 503 });
  }

  const period = parsePeriodKey(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return new NextResponse("Pass ?period=YYYY-Qn", { status: 400 });
  }

  const { data } = await supabaseAdmin()
    .from("bookings")
    .select(
      "id, stay, guest_name, status, total_cents, created_at, stripe_payment_intent, refund_cents, refunded_at"
    )
    .in("status", REPORTED_STATUSES)
    .order("created_at");

  const rows = rowsInPeriod(reportRows((data ?? []) as ReportableBooking[]), period);

  // A BOM so Excel opens the file as UTF-8 and doesn't mangle guest names.
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(period)}"`,
      "Cache-Control": "no-store",
    },
  });
}
