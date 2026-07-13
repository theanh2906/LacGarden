import "server-only";

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import type { User, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import type { StaffClientPermissions, StaffPermission, StaffSession, StaffUser } from "@/types/auth";

const SESSION_COOKIE_NAME = "coffee_pos_staff_session";
const SESSION_VERSION = 1;
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_PARAMS = {
  N: 16_384,
  r: 8,
  p: 1
};

type SessionCookiePayload = {
  v: typeof SESSION_VERSION;
  sub: string;
  iat: number;
  exp: number;
};

type StaffLookup = Pick<User, "id" | "username" | "displayName" | "role" | "isActive">;

const permissionByRole: Record<UserRole, StaffPermission[]> = {
  OWNER: ["pos:access", "orders:manage", "payments:collect", "bar:manage", "reports:view", "inventory:manage", "settings:manage", "payroll:manage", "dorm:manage"],
  MANAGER: ["pos:access", "orders:manage", "payments:collect", "bar:manage", "reports:view", "inventory:manage", "settings:manage", "payroll:manage", "dorm:manage"],
  CASHIER: ["pos:access", "orders:manage", "payments:collect", "bar:manage"],
  BARISTA: ["pos:access", "bar:manage"],
  VIEWER: ["pos:access"]
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function authenticateStaff(username: string, pin: string): Promise<StaffSession> {
  const db = getDb();
  const staff = await db.user.findFirst({
    where: {
      username: username.trim(),
      isActive: true
    }
  });

  if (!staff || !verifyStaffPin(pin, staff.pinHash)) {
    throw new AuthError("Username or PIN is incorrect.", 401);
  }

  await db.user.update({
    where: { id: staff.id },
    data: { lastLoginAt: new Date() }
  });

  return createStaffSession(mapStaffUser(staff));
}

export async function createStaffSession(staff: StaffUser): Promise<StaffSession> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_MAX_AGE_SECONDS;
  const payload: SessionCookiePayload = {
    v: SESSION_VERSION,
    sub: staff.id,
    iat: now,
    exp: expiresAt
  };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signSessionPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });

  return {
    staff,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

export async function clearStaffSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = rawCookie ? parseSignedSessionPayload(rawCookie) : null;

  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const db = getDb();
  const staff = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true
    }
  });

  if (!staff?.isActive) {
    return null;
  }

  return {
    staff: mapStaffUser(staff),
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    throw new AuthError("Authentication is required.", 401);
  }
  return session;
}

export async function requireStaffPermission(permission: StaffPermission): Promise<StaffSession> {
  const session = await requireStaffSession();
  if (!hasStaffPermission(session.staff.role, permission)) {
    throw new AuthError("You do not have permission to access this resource.", 403);
  }
  return session;
}

export async function requirePageSession(nextPath = "/"): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function requirePagePermission(permission: StaffPermission, nextPath = "/"): Promise<StaffSession> {
  const session = await requirePageSession(nextPath);
  if (!hasStaffPermission(session.staff.role, permission)) {
    redirect("/");
  }
  return session;
}

export function hasStaffPermission(role: UserRole, permission: StaffPermission) {
  return permissionByRole[role].includes(permission);
}

export function getStaffClientPermissions(role: UserRole): StaffClientPermissions {
  return {
    canManageReports: hasStaffPermission(role, "reports:view"),
    canManageInventory: hasStaffPermission(role, "inventory:manage"),
    canManageSettings: hasStaffPermission(role, "settings:manage"),
    canManagePayroll: hasStaffPermission(role, "payroll:manage"),
    canManageDorm: hasStaffPermission(role, "dorm:manage")
  };
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: {
          code: error.status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
          message: error.message
        }
      },
      { status: error.status }
    );
  }
  return null;
}

export function hashStaffPin(pin: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(pin, salt, SCRYPT_KEY_LENGTH, SCRYPT_PARAMS).toString("base64url");
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${key}`;
}

function verifyStaffPin(pin: string, pinHash: string) {
  const [algorithm, n, r, p, salt, expectedKey] = pinHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expectedKey) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedKey, "base64url");
    const actual = scryptSync(pin, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    });

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function signSessionPayload(payload: SessionCookiePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function parseSignedSessionPayload(value: string): SessionCookiePayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expectedSignature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionCookiePayload>;
    if (parsed.v !== SESSION_VERSION || typeof parsed.sub !== "string" || typeof parsed.iat !== "number" || typeof parsed.exp !== "number") {
      return null;
    }
    return parsed as SessionCookiePayload;
  } catch {
    return null;
  }
}

function getSessionSecret() {
  return process.env.COFFEE_POS_SESSION_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "coffee-pos-local-session-secret";
}

function mapStaffUser(staff: StaffLookup): StaffUser {
  return {
    id: staff.id,
    username: staff.username,
    displayName: staff.displayName,
    role: staff.role
  };
}
