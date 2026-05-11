import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { ADMIN_ACCESS_COOKIE_NAME } from "@/lib/admin-access-constants";

/**
 * Returns the signed-in user's email, or null if unauthenticated / not wired yet.
 * Centralize auth provider calls here so admin checks stay consistent.
 */
export async function getSessionUserEmail(): Promise<string | null> {
  // TODO: replace with your auth session, e.g.:
  // const session = await auth();
  // return session?.user?.email ?? null;

  if (process.env.NODE_ENV === "development") {
    const mockCandidates = [process.env.MOCK_SESSION_EMAIL, process.env.ADMIN_EMAIL];
    for (const candidate of mockCandidates) {
      if (typeof candidate !== "string") continue;
      const trimmed = candidate.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return null;
}

async function hasPasscodeAdminAccess(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_ACCESS_COOKIE_NAME)?.value === "1";
}

/**
 * Whether the current request's authenticated user is the configured admin.
 */
export async function isAuthenticatedUserAdmin(): Promise<boolean> {
  if (await hasPasscodeAdminAccess()) return true;
  return isAdminEmail(await getSessionUserEmail());
}

export async function getAdminDisplayName(): Promise<string> {
  const email = await getSessionUserEmail();
  if (email && isAdminEmail(email)) return email;
  if (await hasPasscodeAdminAccess()) {
    const configured = process.env.ADMIN_DISPLAY_NAME?.trim();
    return configured && configured.length > 0 ? configured : "Pietro S.";
  }
  return "Pietro S.";
}
