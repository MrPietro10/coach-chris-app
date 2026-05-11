import { NextResponse } from "next/server";
import { isValidAlphaCode, normalizeAlphaCode } from "@/lib/alpha-code-store";
import { logAlphaAccessAttempt } from "@/lib/server/alpha-access-attempt-logger";
import {
  getRequestIp,
  getRequestPath,
  getUserAgent,
} from "@/lib/server/request-client-info";

type AlphaAccessRequestBody = {
  code?: string;
  path?: string;
};

function logAttempt(
  request: Request,
  alphaCode: string,
  success: boolean,
  submittedPath: string,
): void {
  logAlphaAccessAttempt({
    alphaCode,
    success,
    timestamp: new Date().toISOString(),
    ip: getRequestIp(request),
    userAgent: getUserAgent(request),
    path: getRequestPath(request, submittedPath),
  });
}

export async function POST(request: Request) {
  let body: AlphaAccessRequestBody;

  try {
    body = (await request.json()) as AlphaAccessRequestBody;
  } catch {
    logAttempt(request, "", false, "");
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawCode = typeof body.code === "string" ? body.code : "";
  const submittedPath = typeof body.path === "string" ? body.path.trim() : "";
  const alphaCode = normalizeAlphaCode(rawCode);
  const success = isValidAlphaCode(rawCode);

  logAttempt(request, alphaCode, success, submittedPath);

  if (!success) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
