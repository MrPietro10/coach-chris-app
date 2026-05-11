import { AppShell } from "@/components/layout/app-shell";
import { AlphaAccessGate } from "@/components/layout/alpha-access-gate";
import { getAdminDisplayName, isAuthenticatedUserAdmin } from "@/lib/session-user";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isAuthenticatedUserAdmin();
  const adminDisplayName = isAdmin ? await getAdminDisplayName() : undefined;
  return (
    <AlphaAccessGate adminSessionActive={isAdmin}>
      <AppShell isAdmin={isAdmin} adminDisplayName={adminDisplayName}>
        {children}
      </AppShell>
    </AlphaAccessGate>
  );
}
