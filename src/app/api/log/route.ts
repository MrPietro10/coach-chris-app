import { NextResponse } from "next/server";

type LogRequestBody = {
  user?: string;
  event?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LogRequestBody;
    const user = typeof body.user === "string" ? body.user.trim() : "";
    const event = typeof body.event === "string" ? body.event.trim() : "";
    const timestamp = typeof body.timestamp === "string" ? body.timestamp : "";
    const metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!user || !event || !timestamp) {
      return NextResponse.json(
        { error: "user, event, and timestamp are required." },
        { status: 400 },
      );
    }

    console.log("ALPHA EVENT:", {
      user,
      event,
      metadata,
      timestamp,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid log payload." }, { status: 400 });
  }
}
