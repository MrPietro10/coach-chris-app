export function getConfiguredAdminPasscode(): string | undefined {
  const raw = process.env.ADMIN_PASSCODE;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidAdminPasscode(value: string): boolean {
  const expected = getConfiguredAdminPasscode();
  if (!expected) return false;
  return value.trim() === expected;
}
