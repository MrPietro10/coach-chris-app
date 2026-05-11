export function getRequestIp(request: Request): string {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function getUserAgent(request: Request): string {
  return request.headers.get("user-agent")?.trim() || "unknown";
}

export function getRequestPath(request: Request, submittedPath: string): string {
  if (submittedPath) return submittedPath;

  const referer = request.headers.get("referer");
  if (!referer) return "";

  try {
    return new URL(referer).pathname;
  } catch {
    return "";
  }
}
