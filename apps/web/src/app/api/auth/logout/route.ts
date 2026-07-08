import { NextResponse } from "next/server";
import { clearStaffSession } from "@/server/auth";

export async function POST() {
  await clearStaffSession();
  return NextResponse.json({ data: { ok: true } });
}
