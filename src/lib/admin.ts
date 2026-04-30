/**
 * Centralized admin access: compares a user email to ADMIN_EMAIL from the environment.
 * Use only from Server Components, Route Handlers, or Server Actions — not from client components.
 */

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns the configured admin email, or undefined if unset/empty.
 */
export function getConfiguredAdminEmail(): string | undefined {
  const raw = process.env.ADMIN_EMAIL;
  if (typeof raw !== "string") return undefined;
  const normalized = normalizeEmail(raw);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * True when the given email matches ADMIN_EMAIL (case-insensitive, trimmed).
 */
export function isAdminEmail(userEmail: string | null | undefined): boolean {
  const admin = getConfiguredAdminEmail();
  if (!admin) return false;
  if (userEmail == null || typeof userEmail !== "string") return false;
  const candidate = normalizeEmail(userEmail);
  return candidate.length > 0 && candidate === admin;
}
