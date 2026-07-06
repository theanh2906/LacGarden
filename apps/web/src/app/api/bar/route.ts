import { NextResponse } from "next/server";
import { listBarQueue } from "@/server/pos";

export async function GET() {
  try {
    const data = await listBarQueue();
    return NextResponse.json({ data });
  } catch (error) {
    console.info("[pos-api] Bar queue request failed", error);
    return NextResponse.json({ data: [] });
  }
}
