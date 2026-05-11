import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE_NAME } from "@/lib/admin-access-constants";
import { isValidAdminPasscode } from "@/lib/admin-passcode";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const body = (await request.json()) as { passcode?: string };
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  if (!isValidAdminPasscode(passcode)) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_ACCESS_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
