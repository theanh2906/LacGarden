import { NextResponse } from "next/server";
import { barQueue } from "@/data/mock-pos";

export async function GET() {
  return NextResponse.json({ data: barQueue });
}
