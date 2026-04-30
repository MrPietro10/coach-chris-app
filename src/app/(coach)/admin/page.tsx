import { AccessDenied } from "@/components/admin/access-denied";
import { AdminProviderSettings } from "@/components/admin/admin-provider-settings";
import { isAuthenticatedUserAdmin } from "@/lib/session-user";

export default async function AdminPage() {
  const isAdmin = await isAuthenticatedUserAdmin();

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <AdminProviderSettings />;
}
