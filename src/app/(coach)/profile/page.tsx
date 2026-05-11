import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { isAuthenticatedUserAdmin } from "@/lib/session-user";

export default async function ProfilePage() {
  const isAdmin = await isAuthenticatedUserAdmin();
  if (!isAdmin) {
    redirect("/resume");
  }

  return <ProfileForm />;
}
