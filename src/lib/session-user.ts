import { isAdminEmail } from "@/lib/admin";

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

/**
 * Whether the current request's authenticated user is the configured admin.
 */
export async function isAuthenticatedUserAdmin(): Promise<boolean> {
  return isAdminEmail(await getSessionUserEmail());
}
