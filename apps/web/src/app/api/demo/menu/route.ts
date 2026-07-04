import { NextResponse } from "next/server";
import { menuCategories } from "@/data/mock-pos";

export async function GET() {
  return NextResponse.json({ data: menuCategories });
}
