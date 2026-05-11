import { ALPHA_CODE_STORAGE_KEY } from "@/lib/alpha-code-store";
import { ADMIN_ACCESS_STORAGE_KEY } from "@/lib/admin-access-constants";

export function isAdminAccessStored(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === "1";
}

export function grantAdminAccessClient(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, "1");
  window.localStorage.removeItem(ALPHA_CODE_STORAGE_KEY);
}

export function clearAdminAccessClient(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY);
}
