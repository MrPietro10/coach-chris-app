import { AppShell } from "@/components/layout/app-shell";
import { AlphaAccessGate } from "@/components/layout/alpha-access-gate";
import { isAuthenticatedUserAdmin } from "@/lib/session-user";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isAuthenticatedUserAdmin();
  return (
    <AlphaAccessGate>
      <AppShell isAdmin={isAdmin}>{children}</AppShell>
    </AlphaAccessGate>
  );
}
