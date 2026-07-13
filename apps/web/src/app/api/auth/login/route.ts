import { ZodError, z } from "zod";
import { NextResponse } from "next/server";
import { authenticateStaff, authErrorResponse, getStaffClientPermissions } from "@/server/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  pin: z.string().trim().min(4).max(32)
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const session = await authenticateStaff(input.username, input.pin);
    return NextResponse.json({
      data: {
        staff: {
          username: session.staff.username,
          displayName: session.staff.displayName,
          role: session.staff.role
        },
        permissions: getStaffClientPermissions(session.staff.role),
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Thông tin đăng nhập không hợp lệ.",
            details: error.flatten()
          }
        },
        { status: 400 }
      );
    }

    console.info("[auth-api] Staff login failed", error);
    return NextResponse.json({ error: { code: "LOGIN_ERROR", message: "Không thể đăng nhập." } }, { status: 500 });
  }
}
